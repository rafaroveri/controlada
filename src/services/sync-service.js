const { pool } = require('../database/pool');
const { computeCycleKey } = require('../utils/cycle');
const { logAudit } = require('./audit-service');
const { createHttpError } = require('../utils/http-error');

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return Boolean(value);
}

function toIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function formatDateOutput(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function maybeUuid(value) {
  return typeof value === 'string' && /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(value);
}

async function getUserContext(userId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.email,
            p.full_name, p.phone, p.theme_preference, p.cycle_start_day, p.avatar_url
       FROM users u
       JOIN user_profiles p ON p.user_id = u.id
      WHERE u.id = $1`,
    [userId]
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    themePreference: row.theme_preference,
    cycleStartDay: row.cycle_start_day,
    avatarUrl: row.avatar_url
  };
}

async function getIncome(userId) {
  const [summary, benefits] = await Promise.all([
    pool.query(`SELECT base_income FROM income_summaries WHERE user_id = $1`, [userId]),
    pool.query(`SELECT id, name, type, balance, updated_at FROM income_benefits WHERE user_id = $1 ORDER BY created_at ASC`, [userId])
  ]);

  return {
    baseIncome: summary.rows[0] ? Number(summary.rows[0].base_income) : 0,
    benefits: benefits.rows.map((row) => ({
      id: row.id,
      nome: row.name,
      name: row.name,
      tipo: row.type,
      type: row.type,
      saldo: Number(row.balance),
      balance: Number(row.balance),
      updatedAt: row.updated_at
    }))
  };
}

async function getCategories(userId) {
  const { rows } = await pool.query(
    `SELECT id, label, slug, color, created_at FROM categories WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  return rows.map((row) => ({
    id: row.id,
    nome: row.label,
    name: row.label,
    valor: row.slug,
    slug: row.slug,
    cor: row.color,
    color: row.color,
    createdAt: row.created_at
  }));
}

async function getRemovedCategories(userId) {
  const { rows } = await pool.query(
    `SELECT category_id FROM removed_categories WHERE user_id = $1 ORDER BY removed_at DESC`,
    [userId]
  );
  return rows.map((row) => row.category_id);
}

async function getExpenses(userId) {
  const { rows } = await pool.query(
    `SELECT id, category_id, description, amount, paid_at, payment_method, cycle_key
       FROM expenses
      WHERE user_id = $1
      ORDER BY paid_at DESC, created_at DESC`,
    [userId]
  );
  return rows.map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    categoriaId: row.category_id,
    description: row.description,
    descricao: row.description,
    amount: Number(row.amount),
    valor: Number(row.amount),
    paidAt: formatDateOutput(row.paid_at),
    data: formatDateOutput(row.paid_at),
    paymentMethod: row.payment_method,
    metodoPagamento: row.payment_method,
    cycleKey: row.cycle_key
  }));
}

async function getRecurringExpenses(userId) {
  const { rows } = await pool.query(
    `SELECT id, category_id, description, amount, payment_method, frequency, next_occurrence, active
       FROM recurring_expenses
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    categoriaId: row.category_id,
    description: row.description,
    descricao: row.description,
    amount: Number(row.amount),
    valor: Number(row.amount),
    paymentMethod: row.payment_method,
    metodoPagamento: row.payment_method,
    frequency: row.frequency,
    frequencia: row.frequency,
    nextOccurrence: formatDateOutput(row.next_occurrence),
    proximaData: formatDateOutput(row.next_occurrence),
    active: !!row.active,
    ativo: !!row.active
  }));
}

async function getGoals(userId) {
  const { rows } = await pool.query(
    `SELECT goal_key, payload FROM goals WHERE user_id = $1`,
    [userId]
  );
  return rows.reduce((acc, row) => {
    acc[row.goal_key] = row.payload;
    return acc;
  }, {});
}

async function getSnapshot(userId) {
  const context = await getUserContext(userId);
  if (!context) {
    throw createHttpError(404, 'Usuário não encontrado.');
  }

  const [income, categories, removedCategories, expenses, recurringExpenses, goals] = await Promise.all([
    getIncome(userId),
    getCategories(userId),
    getRemovedCategories(userId),
    getExpenses(userId),
    getRecurringExpenses(userId),
    getGoals(userId)
  ]);

  return {
    profile: {
      username: context.username,
      email: context.email,
      fullName: context.fullName,
      nomeCompleto: context.fullName,
      phone: context.phone,
      telefone: context.phone,
      avatarUrl: context.avatarUrl
    },
    settings: {
      cycleStartDay: context.cycleStartDay,
      themePreference: context.themePreference
    },
    income,
    categories: { custom: categories },
    removedCategories,
    expenses,
    recurringExpenses,
    goals
  };
}

async function updateIncomeSummary(client, userId, value) {
  const amount = toNumber(value, 0);
  await client.query(
    `INSERT INTO income_summaries (user_id, base_income)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET base_income = EXCLUDED.base_income`,
    [userId, amount]
  );
  await logAudit(client, {
    userId,
    entity: 'income_summaries',
    entityId: userId,
    action: 'update',
    payload: { baseIncome: amount }
  });
  return { baseIncome: amount };
}

async function updateBenefits(client, userId, value) {
  const benefits = Array.isArray(value) ? value : [];
  await client.query('DELETE FROM income_benefits WHERE user_id = $1', [userId]);
  const inserted = [];
  for (const item of benefits) {
    const name = item?.nome || item?.name || 'Benefício';
    const type = item?.tipo || item?.type || 'outro';
    const balance = toNumber(item?.saldo ?? item?.balance, 0);
    const maybeId = item?.id;
    if (maybeUuid(maybeId)) {
      const { rows } = await client.query(
        `INSERT INTO income_benefits (id, user_id, name, type, balance)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, type, balance`,
        [maybeId, userId, name, type, balance]
      );
      const row = rows[0];
      inserted.push({
        id: row.id,
        nome: row.name,
        name: row.name,
        tipo: row.type,
        type: row.type,
        saldo: Number(row.balance),
        balance: Number(row.balance)
      });
    } else {
      const { rows } = await client.query(
        `INSERT INTO income_benefits (user_id, name, type, balance)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, type, balance`,
        [userId, name, type, balance]
      );
      const row = rows[0];
      inserted.push({
        id: row.id,
        nome: row.name,
        name: row.name,
        tipo: row.type,
        type: row.type,
        saldo: Number(row.balance),
        balance: Number(row.balance)
      });
    }
  }
  await logAudit(client, {
    userId,
    entity: 'income_benefits',
    entityId: userId,
    action: 'replace',
    payload: { total: inserted.length }
  });
  return inserted;
}

async function updateCategories(client, userId, value) {
  const categories = Array.isArray(value) ? value : [];
  await client.query('DELETE FROM categories WHERE user_id = $1', [userId]);
  const inserted = [];
  for (const item of categories) {
    const label = item?.nome || item?.label || item?.valor || 'Categoria';
    const slug = item?.slug || (label || '').toLowerCase().replace(/\s+/g, '-');
    const color = item?.cor || item?.color || '#9acd32';
    const maybeId = item?.id;
    if (maybeUuid(maybeId)) {
      const { rows } = await client.query(
        `INSERT INTO categories (id, user_id, label, slug, color)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, label, slug, color`,
        [maybeId, userId, label, slug, color]
      );
      const row = rows[0];
      inserted.push({
        id: row.id,
        nome: row.label,
        name: row.label,
        valor: row.slug,
        slug: row.slug,
        cor: row.color,
        color: row.color
      });
    } else {
      const { rows } = await client.query(
        `INSERT INTO categories (user_id, label, slug, color)
         VALUES ($1, $2, $3, $4)
         RETURNING id, label, slug, color`,
        [userId, label, slug, color]
      );
      const row = rows[0];
      inserted.push({
        id: row.id,
        nome: row.label,
        name: row.label,
        valor: row.slug,
        slug: row.slug,
        cor: row.color,
        color: row.color
      });
    }
  }
  await logAudit(client, {
    userId,
    entity: 'categories',
    entityId: userId,
    action: 'replace',
    payload: { total: inserted.length }
  });
  return inserted;
}

async function updateRemovedCategories(client, userId, value) {
  const list = Array.isArray(value) ? value : [];
  await client.query('DELETE FROM removed_categories WHERE user_id = $1', [userId]);
  for (const categoryId of list) {
    if (!maybeUuid(categoryId)) {
      continue;
    }
    await client.query(
      `INSERT INTO removed_categories (user_id, category_id)
       VALUES ($1, $2)`,
      [userId, categoryId]
    );
  }
  await logAudit(client, {
    userId,
    entity: 'removed_categories',
    entityId: userId,
    action: 'replace',
    payload: { total: list.length }
  });
  return list.length;
}

async function updateGoals(client, userId, value) {
  const entries = value && typeof value === 'object' ? Object.entries(value) : [];
  await client.query('DELETE FROM goals WHERE user_id = $1', [userId]);
  for (const [key, payload] of entries) {
    await client.query(
      `INSERT INTO goals (user_id, goal_key, payload)
       VALUES ($1, $2, $3)`,
      [userId, key, JSON.stringify(payload ?? {})]
    );
  }
  await logAudit(client, {
    userId,
    entity: 'goals',
    entityId: userId,
    action: 'replace',
    payload: { total: entries.length }
  });
  return entries.length;
}

async function updateRecurringExpenses(client, userId, value) {
  const items = Array.isArray(value) ? value : [];
  await client.query('DELETE FROM recurring_expenses WHERE user_id = $1', [userId]);
  for (const item of items) {
    const description = item?.descricao || item?.description || 'Despesa recorrente';
    const amount = toNumber(item?.valor ?? item?.amount, 0);
    const paymentMethod = item?.metodoPagamento || item?.paymentMethod || 'outro';
    const frequency = item?.frequencia || item?.frequency || 'mensal';
    const nextOccurrence = toIsoDate(item?.proximaData || item?.nextOccurrence);
    const active = toBoolean(item?.ativo ?? item?.active ?? true);
    const categoryId = maybeUuid(item?.categoriaId || item?.categoryId) ? item?.categoriaId || item?.categoryId : null;
    if (maybeUuid(item?.id)) {
      await client.query(
        `INSERT INTO recurring_expenses (id, user_id, category_id, description, amount, payment_method, frequency, next_occurrence, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          item.id,
          userId,
          categoryId,
          description,
          amount,
          paymentMethod,
          frequency,
          nextOccurrence,
          active
        ]
      );
    } else {
      await client.query(
        `INSERT INTO recurring_expenses (user_id, category_id, description, amount, payment_method, frequency, next_occurrence, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          categoryId,
          description,
          amount,
          paymentMethod,
          frequency,
          nextOccurrence,
          active
        ]
      );
    }
  }
  await logAudit(client, {
    userId,
    entity: 'recurring_expenses',
    entityId: userId,
    action: 'replace',
    payload: { total: items.length }
  });
  return items.length;
}

async function updateExpenses(client, userId, value) {
  const items = Array.isArray(value) ? value : [];
  const { rows: profileRows } = await client.query(
    `SELECT cycle_start_day FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  const cycleStartDay = profileRows[0]?.cycle_start_day || 1;
  await client.query('DELETE FROM expenses WHERE user_id = $1', [userId]);
  for (const item of items) {
    const description = item?.descricao || item?.description || 'Despesa';
    const amount = toNumber(item?.valor ?? item?.amount, 0);
    const paidAt = toIsoDate(item?.data || item?.date || item?.paidAt);
    if (!paidAt) {
      continue;
    }
    const paymentMethod = item?.metodoPagamento || item?.paymentMethod || 'outro';
    const categoryId = maybeUuid(item?.categoriaId || item?.categoryId) ? item?.categoriaId || item?.categoryId : null;
    const cycleKey = computeCycleKey(paidAt, cycleStartDay) || computeCycleKey(new Date(paidAt), cycleStartDay) || paidAt.slice(0, 7);
    const params = [
      userId,
      categoryId,
      description,
      amount,
      paidAt,
      paymentMethod,
      cycleKey
    ];
    if (maybeUuid(item?.id)) {
      params.unshift(item.id);
      await client.query(
        `INSERT INTO expenses (id, user_id, category_id, description, amount, paid_at, payment_method, cycle_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        params
      );
    } else {
      await client.query(
        `INSERT INTO expenses (user_id, category_id, description, amount, paid_at, payment_method, cycle_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        params
      );
    }
  }
  await logAudit(client, {
    userId,
    entity: 'expenses',
    entityId: userId,
    action: 'replace',
    payload: { total: items.length }
  });
  return items.length;
}

async function updateCycleStartDay(client, userId, value) {
  const day = Math.min(Math.max(Number.parseInt(value, 10) || 1, 1), 31);
  await client.query(
    `UPDATE user_profiles SET cycle_start_day = $2 WHERE user_id = $1`,
    [userId, day]
  );
  const { rows } = await client.query(
    `SELECT id, paid_at FROM expenses WHERE user_id = $1`,
    [userId]
  );
  for (const row of rows) {
    const cycleKey = computeCycleKey(row.paid_at, day);
    if (cycleKey) {
      await client.query(
        `UPDATE expenses SET cycle_key = $2 WHERE id = $1`,
        [row.id, cycleKey]
      );
    }
  }
  await logAudit(client, {
    userId,
    entity: 'user_profiles',
    entityId: userId,
    action: 'update_cycle_start',
    payload: { cycleStartDay: day }
  });
  return day;
}

async function updateProfile(client, userId, value) {
  if (!value || typeof value !== 'object') {
    throw createHttpError(400, 'Perfil inválido.');
  }
  const fullName = value.nomeCompleto || value.fullName || value.name || null;
  const phone = value.telefone || value.phone || null;
  const themePreference = value.temaPreferido || value.themePreference || null;
  const avatarUrl = value.avatarUrl || null;
  const email = value.email || null;

  if (email) {
    await client.query(
      `UPDATE users SET email = $2 WHERE id = $1`,
      [userId, email.toLowerCase()]
    );
  }

  await client.query(
    `UPDATE user_profiles
        SET full_name = COALESCE($2, full_name),
            phone = $3,
            theme_preference = COALESCE($4, theme_preference),
            avatar_url = COALESCE($5, avatar_url)
      WHERE user_id = $1`,
    [userId, fullName, phone, themePreference, avatarUrl]
  );

  await logAudit(client, {
    userId,
    entity: 'user_profiles',
    entityId: userId,
    action: 'update_profile',
    payload: { fullName, phone, themePreference, avatarUrl }
  });

  const { rows } = await client.query(
    `SELECT user_id, full_name, phone, theme_preference, avatar_url
       FROM user_profiles
      WHERE user_id = $1`,
    [userId]
  );

  const profile = rows[0];
  if (!profile) {
    return null;
  }

  return {
    userId: profile.user_id,
    nomeCompleto: profile.full_name,
    fullName: profile.full_name,
    telefone: profile.phone,
    phone: profile.phone,
    temaPreferido: profile.theme_preference,
    themePreference: profile.theme_preference,
    avatarUrl: profile.avatar_url
  };
}

async function handleSyncUpdate(userId, key, value) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let result;
    switch (key) {
      case 'renda_usuario':
        result = await updateIncomeSummary(client, userId, value);
        break;
      case 'beneficios_usuario':
        result = await updateBenefits(client, userId, value);
        break;
      case 'categorias_usuario':
        result = await updateCategories(client, userId, value);
        break;
      case 'categorias_removidas':
        result = await updateRemovedCategories(client, userId, value);
        break;
      case 'gastos_usuario':
        result = await updateExpenses(client, userId, value);
        break;
      case 'gastos_recorrentes':
        result = await updateRecurringExpenses(client, userId, value);
        break;
      case 'metas_usuario':
        result = await updateGoals(client, userId, value);
        break;
      case 'config_inicio_mes':
        result = await updateCycleStartDay(client, userId, value);
        break;
      case 'perfil_usuario':
        result = await updateProfile(client, userId, value);
        break;
      default:
        throw createHttpError(404, `Chave de sincronização não suportada: ${key}`);
    }
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getSnapshot,
  handleSyncUpdate
};
