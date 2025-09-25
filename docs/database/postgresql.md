# Plano de Migração do Controlada para PostgreSQL

## 1. Visão Geral da Arquitetura

A migração substitui o Firebase (Auth + Realtime Database) por uma API própria construída em Node.js/Express que se comunica com um banco relacional PostgreSQL 16. A aplicação web continua 100% estática, consumindo os dados por meio de endpoints REST autenticados com JWT.

### Componentes Principais

1. **Frontend (SPA estática)** – arquivos HTML/CSS/JS existentes.
2. **API Gateway / Backend** – serviço Node.js com Express e camada de negócios.
3. **Banco de Dados** – PostgreSQL 16 rodando em ambiente gerenciado (RDS, Supabase, Neon, etc.).
4. **Pipeline ETL de Migração** – scripts responsáveis por exportar dados do Firebase, transformá-los e carregá-los no PostgreSQL.

## 2. Modelo Conceitual

As entidades principais e suas relações:

- **User** 1—1 **UserProfile**
- **User** 1—N **UserSession**
- **User** 1—N **IncomeBenefit**
- **User** 1—N **Expense**
- **User** 1—N **RecurringExpense**
- **User** 1—N **Goal**
- **User** 1—N **Category** (personalizadas)
- **Expense** N—1 **Category**
- **RecurringExpense** N—1 **Category**
- **AuditEvent** registra mudanças em dados críticos

O relacionamento de categorias removidas é representado por uma tabela ponte (`removed_categories`) para manter histórico.

## 3. Modelo Lógico (Tabelas)

### 3.1 users
| Campo | Tipo | Restrições | Observações |
| --- | --- | --- | --- |
| id | UUID | PK, default gen_random_uuid() | Identificador global |
| username | citext | UNIQUE NOT NULL | index case-insensitive |
| email | citext | UNIQUE NOT NULL | |
| password_hash | text | NOT NULL | Argon2id |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | trigger `set_updated_at` |

### 3.2 user_profiles
| Campo | Tipo | Restrições |
| --- | --- | --- |
| user_id | UUID | PK, FK -> users.id ON DELETE CASCADE |
| full_name | text | NOT NULL |
| phone | text | NULL |
| theme_preference | text | DEFAULT 'light' |
| cycle_start_day | smallint | DEFAULT 1 CHECK (cycle_start_day BETWEEN 1 AND 31) |
| avatar_url | text | NULL |

### 3.3 user_sessions
| Campo | Tipo | Restrições |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK -> users.id ON DELETE CASCADE |
| refresh_token | text | UNIQUE NOT NULL |
| expires_at | timestamptz | NOT NULL |
| created_at | timestamptz | DEFAULT now() |

### 3.4 income_summaries
| Campo | Tipo | Restrições |
| --- | --- | --- |
| user_id | UUID | PK, FK -> users.id ON DELETE CASCADE |
| base_income | numeric(12,2) | DEFAULT 0 |
| updated_at | timestamptz | DEFAULT now() |

### 3.5 income_benefits
| Campo | Tipo | Restrições |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK -> users.id ON DELETE CASCADE |
| name | text | NOT NULL |
| type | text | DEFAULT 'outro' |
| balance | numeric(12,2) | DEFAULT 0 |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

### 3.6 categories
| Campo | Tipo | Restrições |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK -> users.id ON DELETE CASCADE |
| label | text | NOT NULL |
| slug | text | NOT NULL |
| color | text | DEFAULT '#9acd32' |
| created_at | timestamptz | DEFAULT now() |

### 3.7 removed_categories
| Campo | Tipo | Restrições |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK -> users.id |
| category_id | UUID | FK -> categories.id |
| removed_at | timestamptz | DEFAULT now() |

### 3.8 expenses
| Campo | Tipo | Restrições |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK -> users.id ON DELETE CASCADE |
| category_id | UUID | FK -> categories.id NULLABLE |
| description | text | NOT NULL |
| amount | numeric(12,2) | NOT NULL |
| paid_at | date | NOT NULL |
| payment_method | text | NOT NULL |
| created_at | timestamptz | DEFAULT now() |
| cycle_key | text | NOT NULL | Calculado via trigger |

### 3.9 recurring_expenses
| Campo | Tipo | Restrições |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK -> users.id ON DELETE CASCADE |
| category_id | UUID | FK -> categories.id NULLABLE |
| description | text | NOT NULL |
| amount | numeric(12,2) | NOT NULL |
| payment_method | text | NOT NULL |
| frequency | text | DEFAULT 'mensal' |
| next_occurrence | date | NULL |
| active | boolean | DEFAULT true |
| created_at | timestamptz | DEFAULT now() |

### 3.10 goals
| Campo | Tipo | Restrições |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK -> users.id ON DELETE CASCADE |
| key | text | NOT NULL |
| payload | jsonb | NOT NULL |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

### 3.11 audit_events
| Campo | Tipo | Restrições |
| --- | --- | --- |
| id | bigserial | PK |
| user_id | UUID | FK -> users.id |
| entity | text | NOT NULL |
| entity_id | text | NOT NULL |
| action | text | NOT NULL |
| payload | jsonb | NOT NULL |
| created_at | timestamptz | DEFAULT now() |

## 4. Scripts de Criação (trecho resumido)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username CITEXT NOT NULL UNIQUE,
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  theme_preference TEXT DEFAULT 'light',
  cycle_start_day SMALLINT DEFAULT 1 CHECK (cycle_start_day BETWEEN 1 AND 31),
  avatar_url TEXT
);

-- Demais tabelas seguem o modelo descrito acima.
```

Triggers úteis:
- `set_updated_at` para atualizar colunas `updated_at`.
- `set_cycle_key` em `expenses` para calcular o ciclo com base em `user_profiles.cycle_start_day`.

## 5. Estratégia de Autenticação

1. **Login** (`POST /auth/login`): retorna `{ token, refreshToken, user }`.
2. **Refresh** (`POST /auth/refresh`): renova tokens a partir de `refreshToken` persistido em `user_sessions`.
3. **Logout** (`POST /auth/logout`): invalida o refresh token (soft-delete) e remove sessão.
4. **Proteção**: middlewares validam JWT, anexam `req.user` e checam ownership.

## 6. Mapeamento de Endpoints ↔ Operações

| Endpoint | Método | Descrição | Tabela principal |
| --- | --- | --- | --- |
| `/sync/snapshot` | GET | Retorna payload consolidado para o frontend | diversas |
| `/sync/renda_usuario` | PUT | Atualiza renda base | income_summaries |
| `/sync/beneficios_usuario` | PUT | Substitui cartões de benefício | income_benefits |
| `/sync/gastos_usuario` | PUT | Sincroniza despesas do período | expenses |
| `/sync/gastos_recorrentes` | PUT | Sincroniza recorrentes | recurring_expenses |
| `/sync/metas_usuario` | PUT | Persiste metas personalizadas | goals |
| `/sync/categorias_usuario` | PUT | Persiste categorias customizadas | categories |
| `/sync/categorias_removidas` | PUT | Marca categorias removidas | removed_categories |
| `/sync/config_inicio_mes` | PUT | Atualiza `cycle_start_day` | user_profiles |

Todas as rotas respondem com o recurso atualizado e publicam evento em `audit_events`.

## 7. Estratégia de Migração Firebase ➜ PostgreSQL

1. **Exportação**: utilizar `firebase-admin` para gerar JSON por usuário (`users/{uid}`) e `usernames`.
2. **Transformação**: scripts Node.js mapeiam chaves para o formato relacional descrito.
3. **Carga**: utilizar `COPY`/`INSERT` em transações por usuário, garantindo atomicidade.
4. **Reprocessamento**: manter tabela de controle `migration_runs` com status (`pending`, `running`, `done`, `error`).
5. **Validação**: comparar totais de renda e quantidade de gastos antes/depois via queries agregadas.
6. **Cut-over**: colocar frontend em modo somente leitura, executar migração, publicar nova API.

### Considerações de Transformação

- `expenses`: converter chave do ciclo (`2024-05`) em `cycle_key` e data ISO em `paid_at`.
- `recurringExpenses`: mapear `proximaData` -> `next_occurrence`.
- `categories`: gerar `slug` com `slugify(nome)` + `user_id`.
- `benefits`: valores ausentes viram `0`.
- `goals`: payload armazenado como JSONB preservando estrutura original.

## 8. Estratégia de Sincronização Contínua

- O frontend continua escrevendo em `localStorage` primeiro.
- Cada alteração dispara `persistKey()` que envia PATCH/PUT incremental.
- Backend registra `updated_at` em todas as tabelas e pode fornecer diffs futuros (`/sync/changes?since=`).
- Jobs noturnos (`cron`) verificam inconsistências e regeneram materialized views analíticas (por exemplo `mv_monthly_expenses`).

## 9. Observabilidade, Backups e Segurança

- **Backups**: snapshots automáticos (RDS) + dumps diários `pg_dump` armazenados em storage criptografado.
- **Logs**: padrão JSON estruturado (Pino) com correlação `request_id`.
- **Monitoramento**: métricas via `pg_stat_statements`, dashboards no Grafana/Metabase.
- **Segurança**: TLS obrigatório, roles limitadas (app user sem privilégios de DDL), secrets no Vault/GitHub Actions.

## 10. Próximos Passos

1. Implementar camada de repositórios no backend Node.js seguindo este modelo.
2. Criar scripts de ETL conforme seção 7 e validar com um ambiente de staging.
3. Ajustar testes automatizados do frontend para considerar API offline/online.
4. Expandir documentação com diagramas (PlantUML/Mermaid) e playbooks de incidentes.

---

Este documento deve ser mantido atualizado conforme a implementação do backend evoluir, garantindo alinhamento entre o frontend, a API e o banco PostgreSQL.
