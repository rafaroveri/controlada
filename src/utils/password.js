const { randomBytes, scryptSync, timingSafeEqual } = require('crypto');

const KEY_LENGTH = 64;

function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('A senha precisa ser uma string não vazia.');
  }
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string' || storedHash.indexOf(':') === -1) {
    return false;
  }
  const [salt, originalHash] = storedHash.split(':');
  const derived = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  const originalBuffer = Buffer.from(originalHash, 'hex');
  const derivedBuffer = Buffer.from(derived, 'hex');
  return originalBuffer.length === derivedBuffer.length && timingSafeEqual(originalBuffer, derivedBuffer);
}

module.exports = {
  hashPassword,
  verifyPassword
};
