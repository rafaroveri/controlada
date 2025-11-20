const { pool } = require('../database/pool');
const { hashPassword, verifyPassword } = require('../utils/password');
const { createAccessToken, createRefreshToken, getRefreshTokenExpiration } = require('./token-service');
const { logAudit } = require('./audit-service');
const { createHttpError } = require('../utils/http-error');

async function findUserByIdentifier(client, identifier) {
  const normalized = identifier?.trim();
  if (!normalized) {
    return null;
  }
  const query = `
    SELECT id, username, email, password_hash
    FROM users
    WHERE username = $1 OR email = $1
    LIMIT 1
  `;
  const { rows } = await client.query(query, [normalized.toLowerCase()]);
  return rows[0] || null;
}

async function getUserById(client, userId) {
  const { rows } = await client.query(
    `SELECT id, username, email FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
}

async function getProfileByUserId(client, userId) {
  const { rows } = await client.query(
    `SELECT user_id, full_name, phone, theme_preference, cycle_start_day, avatar_url
       FROM user_profiles
       WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

async function registerUser(payload) {
  let inTransaction = false;
  const client = await pool.connect();
  try {
    const {
      username: rawUsername,
      email: rawEmail,
      password,
      fullName,
      phone = null,
      cycleStartDay = 1,
      themePreference = 'light',
      baseIncome = 0
    } = payload;

    const username = rawUsername?.trim();
    const email = rawEmail?.trim();
    const normalizedFullName = fullName?.trim() || username;
    const normalizedPhone = phone ? String(phone).trim() || null : null;
    const normalizedTheme = themePreference || 'light';

    if (!username || !email || !password) {
      throw createHttpError(400, 'Usuário, e-mail e senha são obrigatórios.');
    }

    await client.query('BEGIN');
    inTransaction = true;
    const existing = await findUserByIdentifier(client, username) || await findUserByIdentifier(client, email);
    if (existing) {
      throw createHttpError(409, 'Usuário ou e-mail já cadastrado.');
    }

    const passwordHash = hashPassword(password);
    const userInsert = await client.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email`,
      [username, email.toLowerCase(), passwordHash]
    );
    const user = userInsert.rows[0];

    await client.query(
      `INSERT INTO user_profiles (user_id, full_name, phone, theme_preference, cycle_start_day)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, normalizedFullName, normalizedPhone, normalizedTheme, cycleStartDay]
    );

    await client.query(
      `INSERT INTO income_summaries (user_id, base_income)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET base_income = EXCLUDED.base_income`,
      [user.id, Number(baseIncome) || 0]
    );

    const refreshToken = createRefreshToken();
    const expiresAt = getRefreshTokenExpiration();

    const sessionInsert = await client.query(
      `INSERT INTO user_sessions (user_id, refresh_token, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [user.id, refreshToken, expiresAt]
    );

    await logAudit(client, {
      userId: user.id,
      entity: 'users',
      entityId: user.id,
      action: 'register',
      payload: { username: user.username, email: user.email }
    });

    await client.query('COMMIT');
    inTransaction = false;

    const accessToken = createAccessToken(user, { sessionId: sessionInsert.rows[0].id });
    return { user, refreshToken, accessToken };
  } catch (error) {
    if (inTransaction) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

async function createSession(client, userId) {
  const refreshToken = createRefreshToken();
  const expiresAt = getRefreshTokenExpiration();
  const session = await client.query(
    `INSERT INTO user_sessions (user_id, refresh_token, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, refresh_token, expires_at`,
    [userId, refreshToken, expiresAt]
  );
  return session.rows[0];
}

async function loginUser({ identifier, password }) {
  let inTransaction = false;
  const client = await pool.connect();
  try {
    if (!identifier || !password) {
      throw createHttpError(400, 'Informe usuário/e-mail e senha.');
    }
    const userRecord = await findUserByIdentifier(client, identifier);
    if (!userRecord) {
      throw createHttpError(401, 'Credenciais inválidas.');
    }
    const isValid = verifyPassword(password, userRecord.password_hash);
    if (!isValid) {
      throw createHttpError(401, 'Credenciais inválidas.');
    }

    await client.query('BEGIN');
    inTransaction = true;
    const session = await createSession(client, userRecord.id);
    await logAudit(client, {
      userId: userRecord.id,
      entity: 'user_sessions',
      entityId: session.id,
      action: 'login',
      payload: { refreshToken: session.refresh_token }
    });
    await client.query('COMMIT');
    inTransaction = false;

    const user = { id: userRecord.id, username: userRecord.username, email: userRecord.email };
    const accessToken = createAccessToken(user, { sessionId: session.id });
    return {
      user,
      refreshToken: session.refresh_token,
      accessToken
    };
  } catch (error) {
    if (inTransaction) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

async function refreshSession(refreshToken) {
  if (!refreshToken) {
    throw createHttpError(400, 'refreshToken é obrigatório.');
  }
  let inTransaction = false;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    inTransaction = true;
    const { rows: sessionRows } = await client.query(
      `SELECT id, user_id, expires_at FROM user_sessions WHERE refresh_token = $1 LIMIT 1`,
      [refreshToken]
    );
    const session = sessionRows[0];
    if (!session) {
      throw createHttpError(401, 'Sessão inválida.');
    }
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      await client.query('DELETE FROM user_sessions WHERE id = $1', [session.id]);
      throw createHttpError(401, 'Sessão expirada.');
    }

    const user = await getUserById(client, session.user_id);
    if (!user) {
      throw createHttpError(401, 'Usuário não encontrado.');
    }

    await client.query('DELETE FROM user_sessions WHERE id = $1', [session.id]);
    const newSession = await createSession(client, user.id);
    await logAudit(client, {
      userId: user.id,
      entity: 'user_sessions',
      entityId: newSession.id,
      action: 'refresh',
      payload: { replacedSession: session.id }
    });
    await client.query('COMMIT');
    inTransaction = false;

    const accessToken = createAccessToken(user, { sessionId: newSession.id });
    return {
      user,
      refreshToken: newSession.refresh_token,
      accessToken
    };
  } catch (error) {
    if (inTransaction) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

async function logoutUser(userId) {
  let inTransaction = false;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    inTransaction = true;
    const { rowCount } = await client.query(
      `DELETE FROM user_sessions WHERE user_id = $1`,
      [userId]
    );
    await logAudit(client, {
      userId,
      entity: 'user_sessions',
      entityId: userId,
      action: 'logout',
      payload: { removedSessions: rowCount }
    });
    await client.query('COMMIT');
    inTransaction = false;
  } catch (error) {
    if (inTransaction) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

async function getAuthenticatedUser(userId) {
  const client = await pool.connect();
  try {
    const user = await getUserById(client, userId);
    if (!user) {
      return null;
    }
    const profile = await getProfileByUserId(client, userId);
    return { user, profile };
  } finally {
    client.release();
  }
}

module.exports = {
  registerUser,
  loginUser,
  refreshSession,
  logoutUser,
  getAuthenticatedUser
};
