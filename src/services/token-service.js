const { randomBytes } = require('crypto');
const { sign } = require('../utils/jwt');
const { JWT_SECRET, JWT_EXPIRATION, REFRESH_TOKEN_TTL_DAYS } = require('../env');

function createAccessToken(user, extra = {}) {
  return sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      ...extra
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION }
  );
}

function createRefreshToken() {
  return randomBytes(48).toString('hex');
}

function getRefreshTokenExpiration() {
  const now = new Date();
  const ttl = Number.isFinite(REFRESH_TOKEN_TTL_DAYS) ? REFRESH_TOKEN_TTL_DAYS : 7;
  now.setUTCDate(now.getUTCDate() + ttl);
  return now;
}

module.exports = {
  createAccessToken,
  createRefreshToken,
  getRefreshTokenExpiration
};
