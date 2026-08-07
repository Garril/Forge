const Router = require('koa-router');
const db = require('../config/db');

const router = new Router({ prefix: '/api/board-analysis' });
const keys = {
  preferences: 'board_analysis_preferences',
  indicators: 'board_analysis_custom_indicators',
  patterns: 'board_analysis_pattern_templates'
};

const parseValue = value => {
  try { return JSON.parse(value); } catch { return null; }
};

router.get('/config', async ctx => {
  try {
    const [rows] = await db.query(
      'SELECT setting_key, setting_value FROM settings WHERE setting_key IN (?, ?, ?)',
      [keys.preferences, keys.indicators, keys.patterns]
    );
    const values = Object.fromEntries(rows.map(row => [row.setting_key, parseValue(row.setting_value)]));
    ctx.body = {
      success: true,
      data: {
        preferences: Object.prototype.hasOwnProperty.call(values, keys.preferences) ? values[keys.preferences] : null,
        customIndicators: Object.prototype.hasOwnProperty.call(values, keys.indicators) ? values[keys.indicators] : null,
        patternTemplates: Object.prototype.hasOwnProperty.call(values, keys.patterns) ? values[keys.patterns] : null
      }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.put('/config', async ctx => {
  const body = ctx.request.body || {};
  const values = [
    [keys.preferences, body.preferences],
    [keys.indicators, body.customIndicators],
    [keys.patterns, body.patternTemplates]
  ];
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const [key, value] of values) {
      await connection.query(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, JSON.stringify(value ?? null), JSON.stringify(value ?? null)]
      );
    }
    await connection.commit();
    ctx.body = { success: true };
  } catch (error) {
    await connection.rollback();
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  } finally {
    connection.release();
  }
});

const readPatterns = async () => {
  const [rows] = await db.query('SELECT setting_value FROM settings WHERE setting_key = ?', [keys.patterns]);
  if (!rows.length) return [];
  const parsed = parseValue(rows[0].setting_value);
  return Array.isArray(parsed) ? parsed : [];
};

const writePatterns = async patterns => {
  const value = JSON.stringify(patterns);
  await db.query(
    'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
    [keys.patterns, value, value]
  );
};

const validPattern = pattern => pattern && typeof pattern === 'object' && String(pattern.name || '').trim() && Array.isArray(pattern.bars) && pattern.bars.length > 0;

router.get('/patterns', async ctx => {
  try { ctx.body = { success: true, data: await readPatterns() }; }
  catch (error) { ctx.status = 500; ctx.body = { success: false, message: error.message }; }
});

router.post('/patterns', async ctx => {
  const pattern = ctx.request.body || {};
  if (!validPattern(pattern)) { ctx.status = 400; ctx.body = { success: false, message: '结构模板数据无效' }; return; }
  try {
    const patterns = await readPatterns();
    const created = { ...pattern, id: pattern.id || `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, enabled: pattern.enabled !== false, updatedAt: Date.now() };
    patterns.push(created);
    await writePatterns(patterns);
    ctx.status = 201; ctx.body = { success: true, data: created };
  } catch (error) { ctx.status = 500; ctx.body = { success: false, message: error.message }; }
});

router.put('/patterns/:id', async ctx => {
  const pattern = ctx.request.body || {};
  if (!validPattern(pattern)) { ctx.status = 400; ctx.body = { success: false, message: '结构模板数据无效' }; return; }
  try {
    const patterns = await readPatterns();
    const index = patterns.findIndex(item => String(item.id) === String(ctx.params.id));
    if (index < 0) { ctx.status = 404; ctx.body = { success: false, message: '结构模板不存在' }; return; }
    const updated = { ...patterns[index], ...pattern, id: patterns[index].id, updatedAt: Date.now() };
    patterns[index] = updated;
    await writePatterns(patterns);
    ctx.body = { success: true, data: updated };
  } catch (error) { ctx.status = 500; ctx.body = { success: false, message: error.message }; }
});

router.delete('/patterns/:id', async ctx => {
  try {
    const patterns = await readPatterns();
    const next = patterns.filter(item => String(item.id) !== String(ctx.params.id));
    if (next.length === patterns.length) { ctx.status = 404; ctx.body = { success: false, message: '结构模板不存在' }; return; }
    await writePatterns(next);
    ctx.body = { success: true };
  } catch (error) { ctx.status = 500; ctx.body = { success: false, message: error.message }; }
});

module.exports = router;
