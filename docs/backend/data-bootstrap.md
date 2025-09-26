# Guia de geração de dados e credenciais da API

Este guia explica como preparar o banco de dados PostgreSQL e obter os tokens necessários para integrar o frontend com a API Node/Express.

## 1. Preparar variáveis de ambiente

1. Copie o arquivo `.env.example` para `.env` na raiz do projeto.
2. Ajuste as variáveis de acordo com o seu ambiente:
   - `DATABASE_URL`: string de conexão completa do PostgreSQL.
   - `DATABASE_SSL`: defina como `true` se o provedor exigir TLS.
   - `JWT_SECRET`: chave secreta utilizada para assinar os tokens (use um valor longo e aleatório).
   - `JWT_EXPIRATION` (opcional): tempo de vida do access token (padrão `15m`).
   - `REFRESH_TOKEN_TTL_DAYS` (opcional): dias de validade do refresh token (padrão `7`).

## 2. Executar migrações e subir a API

```bash
npm install
npm start
```

O comando `npm start` executa `src/server.js`, que por sua vez chama `ensureDatabase()` antes de inicializar o servidor. Isso cria todas as tabelas, extensões e triggers automaticamente.

## 3. Criar usuário e senha

Use a rota `POST /auth/register` para criar um usuário. O backend gera o hash da senha usando `scrypt` e popula todas as tabelas iniciais (perfil, renda base, etc.). Exemplo com `curl`:

```bash
curl -X POST http://localhost:3333/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "seu_usuario",
    "email": "voce@example.com",
    "password": "senha-forte",
    "fullName": "Seu Nome",
    "baseIncome": 5000
  }'
```

Resposta esperada:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "uuid",
    "username": "seu_usuario",
    "email": "voce@example.com",
    "profile": { "fullName": "Seu Nome", ... }
  }
}
```

> **Importante:** o hash da senha é armazenado automaticamente em `users.password_hash`. Você nunca precisa gerar esse hash manualmente.

## 4. Autenticar e renovar tokens

- **Login** (`POST /auth/login`): envia `username` ou `email` + `password` e recebe um novo par de tokens.
- **Refresh** (`POST /auth/refresh`): envia o refresh token válido e obtém um novo access token.
- **Logout** (`POST /auth/logout`): invalida o refresh token atual.

Os tokens JWT devolvidos nas rotas de autenticação devem ser enviados no header `Authorization: Bearer <accessToken>` para acessar rotas protegidas (`/sync/*`).

## 5. Sincronizar dados do frontend

1. **Snapshot inicial**: `GET /sync/snapshot` retorna todos os dados salvos no PostgreSQL.
2. **Atualizações**: utilize `PUT /sync/<chave>` com o access token ativo. Cada chave corresponde a uma coleção da `localStorage` (`income`, `benefits`, `categories`, `expenses`, `goals`, `profile`, `settings`).

Exemplo para atualizar categorias:

```bash
curl -X PUT http://localhost:3333/sync/categories \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "categoryId": "uuid",
        "name": "Essenciais",
        "color": "#4d6619"
      }
    ],
    "lastSyncedAt": "2024-05-01T12:00:00.000Z"
  }'
```

Cada chamada gera registros na tabela `audit_events`, permitindo rastrear alterações para futuros relatórios.

## 6. Revogar ou redefinir credenciais

- Para revogar tokens ativos, chame `POST /auth/logout` para cada sessão.
- Para redefinir a senha, implemente uma rota dedicada ou execute `UPDATE users SET password_hash = crypt('novaSenha', gen_salt('bf')) ...` diretamente no banco apenas em ambientes de suporte (não recomendado em produção sem fluxo apropriado).

## 7. Próximos passos

- Automatize a execução de migrações em pipelines de deploy.
- Configure variáveis seguras no provedor cloud escolhido (Supabase, Neon, etc.).
- Habilite TLS/SSL entre a API e o banco caso o serviço esteja exposto publicamente.

Com esses passos você consegue gerar usuários, tokens e dados sincronizados para integrar o frontend ao backend Controlada.
