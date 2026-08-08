const Router = require('koa-router');
const router = new Router({ prefix: '/api/alarm-water' });
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// --- Alarms ---
router.get('/alarms', async (ctx) => {
  try {
    const [rows] = await db.query('SELECT * FROM alarms_v2 ORDER BY time ASC');
    ctx.body = { success: true, data: rows };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.post('/alarms', async (ctx) => {
  const { time, content, days, is_active } = ctx.request.body;
  try {
    const id = uuidv4();
    await db.query(
      'INSERT INTO alarms_v2 (id, time, content, days, is_active) VALUES (?, ?, ?, ?, ?)',
      [id, time, content, days, is_active ? 1 : 0]
    );
    ctx.body = { success: true, id };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.put('/alarms/:id', async (ctx) => {
  const { id } = ctx.params;
  const { time, content, days, is_active } = ctx.request.body;
  try {
    await db.query(
      'UPDATE alarms_v2 SET time = ?, content = ?, days = ?, is_active = ? WHERE id = ?',
      [time, content, days, is_active ? 1 : 0, id]
    );
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.delete('/alarms/:id', async (ctx) => {
  const { id } = ctx.params;
  try {
    await db.query('DELETE FROM alarms_v2 WHERE id = ?', [id]);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// --- Water Records ---
router.get('/water', async (ctx) => {
  try {
    const { date } = ctx.query; // format 'YYYY-MM-DD'
    let query = 'SELECT * FROM water_records';
    let params = [];
    if (date) {
      query += ' WHERE DATE(record_time) = ?';
      params.push(date);
    }
    query += ' ORDER BY record_time DESC';
    const [rows] = await db.query(query, params);
    ctx.body = { success: true, data: rows };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.get('/water/monthly', async (ctx) => {
  try {
    const { month } = ctx.query; // format 'YYYY-MM'
    const query = 'SELECT DATE(record_time) as date, SUM(amount) as total FROM water_records WHERE DATE_FORMAT(record_time, "%Y-%m") = ? GROUP BY DATE(record_time)';
    const [rows] = await db.query(query, [month]);
    ctx.body = { success: true, data: rows };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.post('/water', async (ctx) => {
  const { amount, record_time } = ctx.request.body;
  try {
    const id = uuidv4();
    await db.query(
      'INSERT INTO water_records (id, amount, record_time) VALUES (?, ?, ?)',
      [id, amount, record_time || new Date()]
    );
    ctx.body = { success: true, id };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.put('/water/:id', async (ctx) => {
  const { id } = ctx.params;
  const { amount, record_time } = ctx.request.body;
  try {
    await db.query(
      'UPDATE water_records SET amount = ?, record_time = ? WHERE id = ?',
      [amount, record_time, id]
    );
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.delete('/water/:id', async (ctx) => {
  const { id } = ctx.params;
  try {
    await db.query('DELETE FROM water_records WHERE id = ?', [id]);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

module.exports = router;
