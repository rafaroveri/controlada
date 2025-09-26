const { pool } = require('../database/pool');

async function logAudit(clientOrPool, { userId, entity, entityId, action, payload }) {
  const target = clientOrPool?.query ? clientOrPool : pool;
  await target.query(
    `INSERT INTO audit_events (user_id, entity, entity_id, action, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId || null, entity, entityId, action, payload ? JSON.stringify(payload) : '{}']
  );
}

module.exports = {
  logAudit
};
