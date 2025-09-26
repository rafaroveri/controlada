const { verify } = require('../utils/jwt');
const { JWT_SECRET } = require('../env');

function extractToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== 'string') {
    return null;
  }
  const [type, token] = header.split(' ');
  if (type?.toLowerCase() !== 'bearer') {
    return null;
  }
  return token || null;
}

function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Não autenticado.' });
  }
  try {
    const payload = verify(token, JWT_SECRET);
    req.auth = payload;
    req.user = {
      id: payload.sub,
      username: payload.username,
      email: payload.email
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: error.message || 'Token inválido.' });
  }
}

module.exports = {
  authenticate
};
