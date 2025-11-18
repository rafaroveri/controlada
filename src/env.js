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

const PORT = toInteger(getEnv('PORT', '3333'), 3333);
const DATABASE_URL = getEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/controlada');
const DATABASE_SSL = getEnv('DATABASE_SSL', 'false').toString().toLowerCase() === 'true';
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
