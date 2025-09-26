const express = require('express');
const asyncHandler = require('../utils/async-handler');
const {
  registerUser,
  loginUser,
  refreshSession,
  logoutUser,
  getAuthenticatedUser
} = require('../services/auth-service');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
  const { username, email, password, fullName, phone, baseIncome, cycleStartDay, themePreference } = req.body || {};
  const result = await registerUser({
    username,
    email,
    password,
    fullName,
    phone,
    baseIncome,
    cycleStartDay,
    themePreference
  });
  res.status(201).json({
    token: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user
  });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { username, email, identifier, password } = req.body || {};
  const result = await loginUser({
    identifier: identifier || username || email,
    password
  });
  res.json({
    token: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user
  });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  const result = await refreshSession(refreshToken);
  res.json({
    token: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user
  });
}));

router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await logoutUser(req.user.id);
  res.status(204).send();
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const data = await getAuthenticatedUser(req.user.id);
  if (!data) {
    return res.status(404).json({ message: 'Usuário não encontrado.' });
  }
  res.json(data);
}));

module.exports = router;
