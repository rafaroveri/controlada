const express = require('express');
const asyncHandler = require('../utils/async-handler');
const { authenticate } = require('../middleware/auth');
const { getSnapshot, handleSyncUpdate } = require('../services/sync-service');

const router = express.Router();

router.use(authenticate);

router.get('/snapshot', asyncHandler(async (req, res) => {
  const snapshot = await getSnapshot(req.user.id);
  res.json(snapshot);
}));

router.put('/:key', asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { value } = req.body || {};
  const result = await handleSyncUpdate(req.user.id, key, value);
  res.json({ status: 'ok', key, result });
}));

module.exports = router;
