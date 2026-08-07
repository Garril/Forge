const Router = require('koa-router')
const router = new Router({ prefix: '/api/plan' })
const db = require('../config/db')
const crypto = require('crypto')

const ensureTables = async () => {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS schedule_blocks (
      id VARCHAR(36) PRIMARY KEY,
      block_date VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      start_time VARCHAR(10) NOT NULL,
      end_time VARCHAR(10) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_block_date (block_date)
    )`)
    await db.query('SHOW COLUMNS FROM habits LIKE "sort_order"').then(async ([columns]) => {
      if (!columns.length) await db.query('ALTER TABLE habits ADD COLUMN sort_order INT DEFAULT 0')
    })
  } catch (error) {
    console.error('计划表初始化失败:', error.message)
  }
}
ensureTables()

router.get('/habits', async ctx => {
  try {
    const [habits] = await db.query('SELECT * FROM habits ORDER BY sort_order ASC, created_at ASC')
    const [logs] = await db.query('SELECT * FROM habit_logs')
    ctx.body = { success: true, data: { habits, logs } }
  } catch (error) {
    ctx.status = 500
    ctx.body = { success: false, message: error.message }
  }
})

router.post('/habits', async ctx => {
  const { name, icon, description } = ctx.request.body
  if (!name) {
    ctx.status = 400
    ctx.body = { success: false, message: '习惯名称不能为空' }
    return
  }
  try {
    const id = crypto.randomUUID()
    const [rows] = await db.query('SELECT MAX(sort_order) AS maxOrder FROM habits')
    const sortOrder = (rows[0].maxOrder || 0) + 1
    await db.query('INSERT INTO habits (id, name, icon, description, sort_order) VALUES (?, ?, ?, ?, ?)', [id, name, icon || '⭐', description || '', sortOrder])
    ctx.body = { success: true, data: { id, sort_order: sortOrder } }
  } catch (error) {
    ctx.status = 500
    ctx.body = { success: false, message: error.message }
  }
})

router.delete('/habits/:id', async ctx => {
  try {
    await db.query('DELETE FROM habits WHERE id = ?', [ctx.params.id])
    ctx.body = { success: true }
  } catch (error) {
    ctx.status = 500
    ctx.body = { success: false, message: error.message }
  }
})

router.post('/habits/check', async ctx => {
  const { habit_id, check_date } = ctx.request.body
  try {
    await db.query('INSERT IGNORE INTO habit_logs (id, habit_id, check_date) VALUES (?, ?, ?)', [crypto.randomUUID(), habit_id, check_date])
    ctx.body = { success: true }
  } catch (error) {
    ctx.status = 500
    ctx.body = { success: false, message: error.message }
  }
})

router.post('/habits/uncheck', async ctx => {
  const { habit_id, check_date } = ctx.request.body
  try {
    await db.query('DELETE FROM habit_logs WHERE habit_id = ? AND check_date = ?', [habit_id, check_date])
    ctx.body = { success: true }
  } catch (error) {
    ctx.status = 500
    ctx.body = { success: false, message: error.message }
  }
})

router.get('/schedule-blocks', async ctx => {
  try {
    const [rows] = await db.query('SELECT * FROM schedule_blocks ORDER BY block_date ASC, start_time ASC')
    ctx.body = { success: true, data: rows }
  } catch (error) {
    ctx.status = 500
    ctx.body = { success: false, message: error.message }
  }
})

router.post('/schedule-blocks', async ctx => {
  const { block_date, content, start_time, end_time } = ctx.request.body
  if (!block_date || !content || !start_time || !end_time) {
    ctx.status = 400
    ctx.body = { success: false, message: '缺少必要字段' }
    return
  }
  try {
    const id = crypto.randomUUID()
    await db.query('INSERT INTO schedule_blocks (id, block_date, content, start_time, end_time) VALUES (?, ?, ?, ?, ?)', [id, block_date, content, start_time, end_time])
    ctx.body = { success: true, data: { id } }
  } catch (error) {
    ctx.status = 500
    ctx.body = { success: false, message: error.message }
  }
})

router.put('/schedule-blocks/:id', async ctx => {
  const { block_date, content, start_time, end_time } = ctx.request.body
  const fields = []
  const values = []
  if (block_date !== undefined) { fields.push('block_date = ?'); values.push(block_date) }
  if (content !== undefined) { fields.push('content = ?'); values.push(content) }
  if (start_time !== undefined) { fields.push('start_time = ?'); values.push(start_time) }
  if (end_time !== undefined) { fields.push('end_time = ?'); values.push(end_time) }
  if (!fields.length) { ctx.status = 400; ctx.body = { success: false, message: '无更新字段' }; return }
  try {
    values.push(ctx.params.id)
    await db.query(`UPDATE schedule_blocks SET ${fields.join(', ')} WHERE id = ?`, values)
    ctx.body = { success: true }
  } catch (error) {
    ctx.status = 500
    ctx.body = { success: false, message: error.message }
  }
})

router.delete('/schedule-blocks/:id', async ctx => {
  try {
    await db.query('DELETE FROM schedule_blocks WHERE id = ?', [ctx.params.id])
    ctx.body = { success: true }
  } catch (error) {
    ctx.status = 500
    ctx.body = { success: false, message: error.message }
  }
})

module.exports = router
