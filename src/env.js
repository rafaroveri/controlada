const dotenv = require('dotenv');

dotenv.config();

function getEnv(name, defaultValue) {
  const value = process.env[name];
  return value === undefined || value === '' ? defaultValue : value;
}

function toInteger(value, defaultValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/controlada';

function buildDatabaseUrlFromPgEnv() {
  const host = getEnv('PGHOST');
  const database = getEnv('PGDATABASE');
  const user = getEnv('PGUSER');
  const password = getEnv('PGPASSWORD');
  const port = getEnv('PGPORT');

  if (!host || !database || !user || !password) {
    return undefined;
  }

  const encodedPassword = encodeURIComponent(password);
  const portSegment = port ? `:${port}` : '';
  const encodedUser = encodeURIComponent(user);

  return `postgresql://${encodedUser}:${encodedPassword}@${host}${portSegment}/${database}`;
}

function getUrlSearchParam(url, key) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get(key);
  } catch (error) {
    return null;
  }
}

const PORT = toInteger(getEnv('PORT', '3333'), 3333);

const databaseUrlFromPgEnv = buildDatabaseUrlFromPgEnv();
const DATABASE_URL = getEnv('DATABASE_URL', databaseUrlFromPgEnv || DEFAULT_DATABASE_URL);

const sslMode = getEnv('PGSSLMODE', '').toLowerCase();
const sslFromUrl = getUrlSearchParam(DATABASE_URL, 'sslmode') || getUrlSearchParam(DATABASE_URL, 'ssl');
const isNeon = DATABASE_URL.includes('neon.tech') || getEnv('PGHOST', '').includes('neon.tech');
const sslDefault = isNeon || sslMode === 'require' || sslFromUrl === 'require' || sslFromUrl === 'true';

const DATABASE_SSL = getEnv('DATABASE_SSL', sslDefault ? 'true' : 'false').toString().toLowerCase() === 'true';
const JWT_SECRET = getEnv('JWT_SECRET', 'change-me-in-production');
const JWT_EXPIRATION = getEnv('JWT_EXPIRATION', '15m');
const REFRESH_TOKEN_TTL_DAYS = toInteger(getEnv('REFRESH_TOKEN_TTL_DAYS', '7'), 7);
const EMAIL_SENDER = getEnv('EMAIL_SENDER', 'relatorios@controlada.app');
const RESEND_API_KEY = getEnv('RESEND_API_KEY', '');

module.exports = {
  PORT,
  DATABASE_URL,
  DATABASE_SSL,
  JWT_SECRET,
  JWT_EXPIRATION,
  REFRESH_TOKEN_TTL_DAYS,
  EMAIL_SENDER,
  RESEND_API_KEY
};
