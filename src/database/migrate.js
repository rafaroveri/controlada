const { pool } = require('./pool');

const MIGRATIONS = [
  `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`,
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
  `CREATE EXTENSION IF NOT EXISTS citext;`,
  `CREATE OR REPLACE FUNCTION trigger_set_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;`,
  `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username CITEXT NOT NULL UNIQUE,
      email CITEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
  `DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_set_updated_at') THEN
        CREATE TRIGGER users_set_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;
    END;
    $$;`,
  `CREATE TABLE IF NOT EXISTS user_profiles (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      phone TEXT,
      theme_preference TEXT DEFAULT 'light',
      cycle_start_day SMALLINT DEFAULT 1 CHECK (cycle_start_day BETWEEN 1 AND 31),
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
  `DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'user_profiles_set_updated_at') THEN
        CREATE TRIGGER user_profiles_set_updated_at
        BEFORE UPDATE ON user_profiles
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;
    END;
    $$;`,
  `CREATE TABLE IF NOT EXISTS user_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
  `CREATE TABLE IF NOT EXISTS income_summaries (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      base_income NUMERIC(12,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
  `DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'income_summaries_set_updated_at') THEN
        CREATE TRIGGER income_summaries_set_updated_at
        BEFORE UPDATE ON income_summaries
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;
    END;
    $$;`,
  `CREATE TABLE IF NOT EXISTS income_benefits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'outro',
      balance NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
  `DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'income_benefits_set_updated_at') THEN
        CREATE TRIGGER income_benefits_set_updated_at
        BEFORE UPDATE ON income_benefits
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;
    END;
    $$;`,
  `CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      slug TEXT NOT NULL,
      color TEXT DEFAULT '#9acd32',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT categories_unique_slug UNIQUE (user_id, slug)
    );`,
  `CREATE TABLE IF NOT EXISTS removed_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id UUID NOT NULL,
      removed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
  `CREATE TABLE IF NOT EXISTS expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id UUID REFERENCES categories(id),
      description TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      paid_at DATE NOT NULL,
      payment_method TEXT NOT NULL,
      cycle_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
  `DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'expenses_set_updated_at') THEN
        CREATE TRIGGER expenses_set_updated_at
        BEFORE UPDATE ON expenses
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;
    END;
    $$;`,
  `CREATE TABLE IF NOT EXISTS recurring_expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id UUID REFERENCES categories(id),
      description TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      payment_method TEXT NOT NULL,
      frequency TEXT DEFAULT 'mensal',
      next_occurrence DATE,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
  `DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'recurring_expenses_set_updated_at') THEN
        CREATE TRIGGER recurring_expenses_set_updated_at
        BEFORE UPDATE ON recurring_expenses
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;
    END;
    $$;`,
  `CREATE TABLE IF NOT EXISTS goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      goal_key TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT goals_unique_key UNIQUE (user_id, goal_key)
    );`,
  `DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'goals_set_updated_at') THEN
        CREATE TRIGGER goals_set_updated_at
        BEFORE UPDATE ON goals
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
      END IF;
    END;
    $$;`,
  `CREATE TABLE IF NOT EXISTS audit_events (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id),
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
];

async function ensureDatabase() {
  const client = await pool.connect();
  try {
    for (const command of MIGRATIONS) {
      await client.query(command);
    }
  } finally {
    client.release();
  }
}

module.exports = {
  ensureDatabase
};
