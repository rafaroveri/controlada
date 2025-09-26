const app = require('./app');
const { ensureDatabase } = require('./database/migrate');
const { PORT } = require('./env');

async function bootstrap() {
  await ensureDatabase();
  app.listen(PORT, () => {
    console.log(`Controlada API iniciada na porta ${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error('Falha ao iniciar a API Controlada:', error);
  process.exit(1);
});
