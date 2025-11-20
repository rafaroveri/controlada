const { getSnapshot, handleSyncUpdate } = require('../src/services/sync-service');
const { pool } = require('../src/database/pool');
const auditService = require('../src/services/audit-service');
const cycleUtils = require('../src/utils/cycle');

jest.mock('../src/database/pool', () => {
  const pool = { connect: jest.fn(), query: jest.fn(), on: jest.fn() };
  return { pool, query: pool.query };
});

jest.mock('../src/services/audit-service', () => ({
  logAudit: jest.fn(async () => {})
}));

jest.mock('../src/utils/cycle', () => ({
  computeCycleKey: jest.fn(() => '2024-05')
}));

describe('sync-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getSnapshot retorna contexto completo do usuário', async () => {
    pool.query.mockImplementation((sql) => {
      if (sql.includes('FROM users u')) {
        return Promise.resolve({
          rows: [{
            id: 'user-1', username: 'joao', email: 'j@e.com',
            full_name: 'João Silva', phone: '1199999999', theme_preference: 'dark', cycle_start_day: 3, avatar_url: 'avatar.png'
          }]
        });
      }
      if (sql.includes('income_summaries')) {
        return Promise.resolve({ rows: [{ base_income: 2500 }] });
      }
      if (sql.includes('income_benefits')) {
        return Promise.resolve({ rows: [{ id: 'b1', name: 'Vale', type: 'vr', balance: 120, updated_at: '2024-02-10' }] });
      }
      if (sql.includes('FROM categories')) {
        return Promise.resolve({ rows: [{ id: 'c1', label: 'Essenciais', slug: 'essenciais', color: '#fff', created_at: '2024-02-01' }] });
      }
      if (sql.includes('removed_categories')) {
        return Promise.resolve({ rows: [{ category_id: 'rem-1' }] });
      }
      if (sql.includes('FROM expenses')) {
        return Promise.resolve({ rows: [{
          id: 'e1', category_id: 'c1', description: 'Mercado', amount: 199.9,
          paid_at: '2024-03-02', payment_method: 'cartao', cycle_key: '2024-03'
        }] });
      }
      if (sql.includes('FROM recurring_expenses')) {
        return Promise.resolve({ rows: [{
          id: 'r1', category_id: 'c1', description: 'Internet', amount: 100,
          payment_method: 'debito', frequency: 'mensal', next_occurrence: '2024-03-10', active: true
        }] });
      }
      if (sql.includes('FROM goals')) {
        return Promise.resolve({ rows: [{ goal_key: 'save', payload: { value: 500 } }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const snapshot = await getSnapshot('user-1');

    expect(snapshot.profile).toEqual({
      username: 'joao',
      email: 'j@e.com',
      fullName: 'João Silva',
      nomeCompleto: 'João Silva',
      phone: '1199999999',
      telefone: '1199999999',
      avatarUrl: 'avatar.png'
    });
    expect(snapshot.settings).toEqual({ cycleStartDay: 3, themePreference: 'dark' });
    expect(snapshot.income).toEqual({
      baseIncome: 2500,
      benefits: [
        { id: 'b1', nome: 'Vale', name: 'Vale', tipo: 'vr', type: 'vr', saldo: 120, balance: 120, updatedAt: '2024-02-10' }
      ]
    });
    expect(snapshot.categories.custom[0]).toMatchObject({
      id: 'c1', nome: 'Essenciais', name: 'Essenciais', valor: 'essenciais', slug: 'essenciais', cor: '#fff', color: '#fff'
    });
    expect(snapshot.removedCategories).toEqual(['rem-1']);
    expect(snapshot.expenses[0]).toMatchObject({ descricao: 'Mercado', valor: 199.9, paidAt: '2024-03-02' });
    expect(snapshot.recurringExpenses[0]).toMatchObject({
      descricao: 'Internet', valor: 100, nextOccurrence: '2024-03-10', active: true
    });
    expect(snapshot.goals).toEqual({ save: { value: 500 } });
  });

  test('handleSyncUpdate atualiza gastos e registra auditoria', async () => {
    const clientQuery = jest.fn().mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
    const client = { query: clientQuery, release: jest.fn() };
    pool.connect.mockResolvedValue(client);

    await handleSyncUpdate('user-1', 'gastos_usuario', [
      { descricao: 'Cinema', valor: 80, data: '2024-05-10', metodoPagamento: 'credito', categoriaId: 'c1' }
    ]);

    expect(clientQuery).toHaveBeenCalledWith('BEGIN');
    expect(cycleUtils.computeCycleKey).toHaveBeenCalledWith('2024-05-10', expect.any(Number));
    const insertCall = clientQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO expenses'));
    expect(insertCall).toBeDefined();
    expect(insertCall[1]).toEqual(expect.arrayContaining(['user-1', null, 'Cinema', 80, '2024-05-10', 'credito', '2024-05']));
    expect(auditService.logAudit).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ entity: 'expenses', action: 'replace', payload: { total: 1 } })
    );
    expect(clientQuery).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('handleSyncUpdate lança erro para chave não suportada e faz rollback', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }), release: jest.fn() };
    pool.connect.mockResolvedValue(client);

    await expect(handleSyncUpdate('user-1', 'chave_invalida', {})).rejects.toHaveProperty('status', 404);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});
