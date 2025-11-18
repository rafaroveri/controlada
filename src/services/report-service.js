const { pool } = require('../database/pool');
const { sendEmail } = require('./email-service');
const { createHttpError } = require('../utils/http-error');

function getInterval() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatDate(date) {
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

async function getUserContact(userId) {
  const query = `
    SELECT u.email, COALESCE(up.full_name, u.username) AS full_name
    FROM users u
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE u.id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows[0] || null;
}

async function getWeeklyExpenses(userId, interval) {
  const query = `
    SELECT e.description, e.amount::numeric::float AS amount, e.paid_at, e.payment_method,
           COALESCE(c.label, 'Outros') AS category
    FROM expenses e
    LEFT JOIN categories c ON c.id = e.category_id
    WHERE e.user_id = $1
      AND e.paid_at BETWEEN $2::DATE AND $3::DATE
    ORDER BY e.paid_at DESC
  `;
  const { rows } = await pool.query(query, [userId, interval.start.toISOString(), interval.end.toISOString()]);
  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount)
  }));
}

function buildEmailContent({ expenses, interval, contact }) {
  const totalAmount = expenses.reduce((acc, expense) => acc + expense.amount, 0);
  const categories = expenses.reduce((acc, expense) => {
    const key = expense.category || 'Outros';
    acc[key] = (acc[key] || 0) + expense.amount;
    return acc;
  }, {});

  const categoryList = Object.entries(categories)
    .sort(([, valueA], [, valueB]) => valueB - valueA)
    .map(([category, value]) => ({ category, value }));

  const textLines = [
    `Olá, ${contact.full_name}!`,
    '',
    `Aqui está o resumo dos seus gastos entre ${formatDate(interval.start)} e ${formatDate(interval.end)}.`,
    `Total gasto: ${formatCurrency(totalAmount)}.`,
    '',
    'Gastos por categoria:'
  ];

  if (categoryList.length === 0) {
    textLines.push('- Nenhum gasto registrado no período.');
  } else {
    categoryList.forEach((item) => {
      textLines.push(`- ${item.category}: ${formatCurrency(item.value)}`);
    });
  }

  const expenseRows = expenses.map((expense) => `
    <tr>
      <td>${expense.description}</td>
      <td>${expense.category}</td>
      <td>${expense.payment_method}</td>
      <td>${formatCurrency(expense.amount)}</td>
      <td>${formatDate(new Date(expense.paid_at))}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: 'Rubik', Arial, sans-serif; color: #1f2933;">
      <h2>Olá, ${contact.full_name}!</h2>
      <p>Aqui está o resumo dos seus gastos entre <strong>${formatDate(interval.start)}</strong> e <strong>${formatDate(interval.end)}</strong>.</p>
      <p style="font-size: 1.1rem; font-weight: 600;">Total gasto: ${formatCurrency(totalAmount)}</p>
      <h3>Gastos por categoria</h3>
      <ul>
        ${categoryList.length === 0 ? '<li>Nenhum gasto registrado.</li>' : categoryList.map((item) => `<li><strong>${item.category}</strong>: ${formatCurrency(item.value)}</li>`).join('')}
      </ul>
      ${expenses.length > 0 ? `
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th align="left">Descrição</th>
              <th align="left">Categoria</th>
              <th align="left">Pagamento</th>
              <th align="left">Valor</th>
              <th align="left">Data</th>
            </tr>
          </thead>
          <tbody>
            ${expenseRows}
          </tbody>
        </table>
      ` : '<p>Nenhum gasto registrado no período.</p>'}
    </div>
  `;

  return {
    totalAmount,
    categories: categoryList,
    text: textLines.join('\n'),
    html
  };
}

async function sendWeeklyExpenseReport(userId) {
  const contact = await getUserContact(userId);
  if (!contact) {
    throw createHttpError(404, 'Não foi possível localizar o usuário para enviar o relatório.');
  }

  const interval = getInterval();
  const expenses = await getWeeklyExpenses(userId, interval);
  const content = buildEmailContent({ expenses, interval, contact });

  const delivery = await sendEmail({
    to: contact.email,
    subject: `Seu relatório semanal de gastos (${formatDate(interval.start)} - ${formatDate(interval.end)})`,
    text: content.text,
    html: content.html
  });

  return {
    interval: {
      start: interval.start.toISOString(),
      end: interval.end.toISOString()
    },
    totalAmount: content.totalAmount,
    expensesCount: expenses.length,
    categories: content.categories,
    delivery
  };
}

module.exports = {
  sendWeeklyExpenseReport
};
