const express = require('express');
const authRoutes = require('./routes/auth');
const syncRoutes = require('./routes/sync');
const reportRoutes = require('./routes/reports');

const app = express();

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'authorization,content-type');
  res.setHeader('Access-Control-Allow-Methods', req.headers['access-control-request-method'] || 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
}

app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/sync', syncRoutes);
app.use('/reports', reportRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('Erro na API Controlada:', err);
  const status = err.status || 500;
  const payload = { message: err.message || 'Erro interno do servidor.' };
  if (err.details) {
    payload.details = err.details;
  }
  res.status(status).json(payload);
});

module.exports = app;
