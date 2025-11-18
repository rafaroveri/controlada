const express = require('express');
const asyncHandler = require('../utils/async-handler');
const { authenticate } = require('../middleware/auth');
const { sendWeeklyExpenseReport } = require('../services/report-service');

const router = express.Router();

router.use(authenticate);

router.post('/weekly-email', asyncHandler(async (req, res) => {
  const report = await sendWeeklyExpenseReport(req.user.id);
  res.json({
    message: 'Relatório semanal enviado com sucesso.',
    report
  });
}));

module.exports = router;
