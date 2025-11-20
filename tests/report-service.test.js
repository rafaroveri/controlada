const { sendWeeklyExpenseReport } = require('../src/services/report-service');
const { pool } = require('../src/database/pool');
const emailService = require('../src/services/email-service');

jest.mock('../src/database/pool', () => {
  const pool = { query: jest.fn(), connect: jest.fn(), on: jest.fn() };
  return { pool, query: pool.query };
});

jest.mock('../src/services/email-service', () => ({
  sendEmail: jest.fn()
}));

describe('report-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('envia relatório semanal com totais e categorias', async () => {
    const now = new Date('2024-03-10T12:00:00Z');
    jest.useFakeTimers().setSystemTime(now);

    pool.query.mockImplementation((sql) => {
      if (sql.includes('FROM users u')) {
        return Promise.resolve({ rows: [{ email: 'user@email.com', full_name: 'Usuário Teste' }] });
      }
      if (sql.includes('FROM expenses e')) {
        return Promise.resolve({ rows: [
          { description: 'Mercado', amount: 150, paid_at: '2024-03-08', payment_method: 'cartao', category: 'Casa' },
          { description: 'Transporte', amount: 50, paid_at: '2024-03-09', payment_method: 'pix', category: 'Mobilidade' }
        ] });
      }
      return Promise.resolve({ rows: [] });
    });

    emailService.sendEmail.mockResolvedValue({ status: 'sent', provider: 'resend', id: 'email-1' });

    const result = await sendWeeklyExpenseReport('user-1');

    expect(emailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'user@email.com',
      subject: expect.stringContaining('relatório semanal'),
      text: expect.stringContaining('resumo')
    }));
    expect(result).toMatchObject({
      totalAmount: 200,
      expensesCount: 2,
      categories: [
        { category: 'Casa', value: 150 },
        { category: 'Mobilidade', value: 50 }
      ]
    });
    expect(result.interval).toEqual({
      start: '2024-03-04T00:00:00.000Z',
      end: '2024-03-10T23:59:59.999Z'
    });
  });

  test('retorna erro 404 quando usuário não é encontrado', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await expect(sendWeeklyExpenseReport('missing')).rejects.toHaveProperty('status', 404);
  });
});
