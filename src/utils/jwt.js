const { createHmac } = require('crypto');

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function parseExpiresIn(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric) && numeric.toString() === value) {
    return numeric;
  }
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) {
    return null;
  }
  const quantity = Number.parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return quantity * multipliers[unit];
}

function sign(payload, secret, options = {}) {
  if (!secret) {
    throw new Error('JWT secret is required');
  }
  const header = { alg: 'HS256', typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const expires = parseExpiresIn(options.expiresIn);
  const body = { ...payload, iat };
  if (expires) {
    body.exp = iat + expires;
  }
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(body));
  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verify(token, secret) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token inválido');
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Token inválido');
  }
  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  if (signature !== expectedSignature) {
    throw new Error('Assinatura inválida');
  }
  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error('Token expirado');
  }
  return payload;
}

module.exports = {
  sign,
  verify
};
