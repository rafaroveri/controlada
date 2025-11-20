const { registerUser, loginUser, refreshSession, logoutUser, getAuthenticatedUser } = require('../src/services/auth-service');
const { pool } = require('../src/database/pool');
const { hashPassword, verifyPassword } = require('../src/utils/password');
const tokenService = require('../src/services/token-service');
const auditService = require('../src/services/audit-service');

jest.mock('../src/database/pool', () => {
  const pool = { connect: jest.fn(), query: jest.fn(), on: jest.fn() };
  return { pool, query: pool.query };
});

jest.mock('../src/utils/password', () => ({
  hashPassword: jest.fn(() => 'hashed-password'),
  verifyPassword: jest.fn(() => true)
}));

jest.mock('../src/services/token-service', () => ({
  createAccessToken: jest.fn(() => 'access-token'),
  createRefreshToken: jest.fn(() => 'refresh-token'),
  getRefreshTokenExpiration: jest.fn(() => new Date('2024-01-01T00:00:00Z'))
}));

jest.mock('../src/services/audit-service', () => ({
  logAudit: jest.fn(async () => {})
}));

describe('auth-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createClient(responses) {
    const query = jest.fn().mockImplementation(() => {
      const next = responses.shift() || { rows: [], rowCount: 0 };
      return Promise.resolve(next);
    });
    return { query, release: jest.fn() };
  }

  test('registerUser cria usuário, perfil e sessão com tokens', async () => {
    const client = createClient([
      { rows: [] }, // BEGIN
      { rows: [] }, // find username
      { rows: [] }, // find email
      { rows: [{ id: 'user-1', username: 'novo', email: 'novo@email.com' }] }, // insert user
      { rows: [] }, // insert profile
      { rows: [] }, // income summary
      { rows: [{ id: 'session-1' }] }, // insert session
      { rows: [] }, // audit
      { rows: [] } // commit
    ]);

    pool.connect.mockResolvedValue(client);

    const result = await registerUser({
      username: 'novo',
      email: 'Novo@Email.com',
      password: '123456',
      fullName: 'Usuário Novo',
      baseIncome: 1500,
      cycleStartDay: 5,
      themePreference: 'dark'
    });

    expect(result).toEqual({
      user: { id: 'user-1', username: 'novo', email: 'novo@email.com' },
      refreshToken: 'refresh-token',
      accessToken: 'access-token'
    });

    expect(hashPassword).toHaveBeenCalledWith('123456');
    expect(tokenService.createRefreshToken).toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      ['novo', 'novo@email.com', 'hashed-password']
    );
    expect(auditService.logAudit).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ action: 'register', userId: 'user-1' })
    );
    expect(client.release).toHaveBeenCalled();
  });

  test('registerUser falha quando usuário já existe e faz rollback', async () => {
    const client = createClient([
      { rows: [] }, // BEGIN
      { rows: [{ id: 'user-1' }] }, // usuário encontrado
      { rows: [] } // rollback
    ]);
    pool.connect.mockResolvedValue(client);

    await expect(registerUser({ username: 'existente', email: 'j@e.com', password: '123' }))
      .rejects.toHaveProperty('status', 409);

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test('loginUser cria nova sessão com credenciais válidas', async () => {
    const client = createClient([
      { rows: [{ id: 'user-1', username: 'joao', email: 'j@e.com', password_hash: 'hashed' }] }, // find user
      { rows: [] }, // BEGIN
      { rows: [{ id: 'sess-1', refresh_token: 'refresh-token', expires_at: '2024-01-01T00:00:00Z' }] }, // insert session
      { rows: [] }, // audit
      { rows: [] } // COMMIT
    ]);
    pool.connect.mockResolvedValue(client);
    verifyPassword.mockReturnValue(true);

    const result = await loginUser({ identifier: 'joao', password: 'senha' });

    expect(verifyPassword).toHaveBeenCalledWith('senha', 'hashed');
    expect(result).toEqual({
      user: { id: 'user-1', username: 'joao', email: 'j@e.com' },
      refreshToken: 'refresh-token',
      accessToken: 'access-token'
    });
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('loginUser retorna erro 400 quando faltam credenciais', async () => {
    await expect(loginUser({ identifier: '', password: '' }))
      .rejects.toHaveProperty('status', 400);
  });

  test('refreshSession remove sessão expirada e retorna erro 401', async () => {
    const expired = new Date('2023-01-01T00:00:00Z').toISOString();
    const client = createClient([
      { rows: [] }, // BEGIN
      { rows: [{ id: 'sess-1', user_id: 'user-1', expires_at: expired }] }, // select session
      { rows: [] }, // delete session
      { rows: [] } // ROLLBACK
    ]);
    pool.connect.mockResolvedValue(client);

    await expect(refreshSession('refresh-token')).rejects.toHaveProperty('status', 401);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test('logoutUser remove sessões e registra auditoria', async () => {
    const client = createClient([
      { rows: [] }, // BEGIN
      { rowCount: 2 }, // delete sessions
      { rows: [] }, // audit
      { rows: [] } // COMMIT
    ]);
    pool.connect.mockResolvedValue(client);

    await logoutUser('user-1');

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM user_sessions'),
      ['user-1']
    );
    expect(auditService.logAudit).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ action: 'logout', payload: { removedSessions: 2 } })
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('getAuthenticatedUser retorna nulo quando usuário não existe', async () => {
    const client = createClient([
      { rows: [] }
    ]);
    pool.connect.mockResolvedValue(client);

    const result = await getAuthenticatedUser('missing');
    expect(result).toBeNull();
    expect(client.release).toHaveBeenCalled();
  });
});
