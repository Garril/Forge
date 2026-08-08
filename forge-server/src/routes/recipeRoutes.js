const Router = require('koa-router')
const multer = require('@koa/multer')
const path = require('path')
const fs = require('fs-extra')
const crypto = require('crypto')
const db = require('../config/db')

const router = new Router({ prefix: '/api/recipes' })
const uploadDir = path.join(__dirname, '../../public/uploads/recipes')
fs.ensureDirSync(uploadDir)

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `recipe-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`)
  }
})
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, /\.(jpg|jpeg|png|webp|gif)$/i.test(path.extname(file.originalname)))
  }
})

const parseJson = value => {
  if (Array.isArray(value)) return value
  if (!value) return []
  try { return JSON.parse(value) } catch { return [] }
}

const normalizeRecipe = row => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  coverUrl: row.cover_url || '',
  servings: row.servings || '',
  ingredients: parseJson(row.ingredients),
  steps: parseJson(row.steps),
  createdAt: row.created_at
})

const initTable = async () => {
  try {
    await db.ready;
    const [recipeTable] = await db.query('SHOW TABLES LIKE "recipes"');
    if (recipeTable.length > 0) {
      const [priceColumns] = await db.query('SHOW COLUMNS FROM recipes LIKE "price_note"');
      if (priceColumns.length > 0) {
        await db.query('ALTER TABLE recipes DROP COLUMN price_note');
      }
    }
  } catch (error) {
    if (!['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(error.code)) console.error('recipes.price_note 字段清理失败:', error.message)
  }

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS recipes (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        description TEXT,
        cover_url VARCHAR(500),
        servings VARCHAR(100),
        ingredients JSON NOT NULL,
        steps JSON NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
  } catch (error) {
    console.error('recipes 表初始化失败:', error.message)
  }
}
initTable()

router.get('/', async ctx => {
  try {
    const [rows] = await db.query('SELECT * FROM recipes ORDER BY updated_at DESC, created_at DESC')
    ctx.body = { success: true, data: rows.map(normalizeRecipe) }
  } catch (error) {
    ctx.status = 500
    ctx.body = { success: false, message: error.message }
  }
})

router.post('/upload-image', upload.single('image'), async ctx => {
  if (!ctx.file) {
    ctx.status = 400
    ctx.body = { success: false, message: '请选择 JPG、PNG、WEBP 或 GIF 图片' }
    return
  }
  ctx.body = { success: true, url: `/uploads/recipes/${ctx.file.filename}` }
})

router.post('/', async ctx => {
  try {
    const { name, description, coverUrl, servings, ingredients, steps } = ctx.request.body
    if (!name?.trim()) {
      ctx.status = 400
      ctx.body = { success: false, message: '请输入食谱名称' }
      return
    }
    const id = crypto.randomUUID()
    await db.query(
      'INSERT INTO recipes (id, name, description, cover_url, servings, ingredients, steps) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name.trim(), description || '', coverUrl || '', servings || '', JSON.stringify(ingredients || []), JSON.stringify(steps || [])]
    )
    const [rows] = await db.query('SELECT * FROM recipes WHERE id = ?', [id])
    ctx.body = { success: true, data: normalizeRecipe(rows[0]) }
  } catch (error) {
    ctx.status = 500
    ctx.body = { success: false, message: error.message }
  }
})

router.put('/:id', async ctx => {
  try {
    const { name, description, coverUrl, servings, ingredients, steps } = ctx.request.body
    const [oldRows] = await db.query('SELECT cover_url FROM recipes WHERE id = ?', [ctx.params.id])
    if (!name?.trim()) {
      ctx.status = 400
      ctx.body = { success: false, message: '请输入食谱名称' }
      return
    }
    await db.query(
      'UPDATE recipes SET name=?, description=?, cover_url=?, servings=?, ingredients=?, steps=? WHERE id=?',
      [name.trim(), description || '', coverUrl || '', servings || '', JSON.stringify(ingredients || []), JSON.stringify(steps || []), ctx.params.id]
    )
    const oldCoverUrl = oldRows[0]?.cover_url || ''
    if (oldCoverUrl && oldCoverUrl !== (coverUrl || '') && oldCoverUrl.startsWith('/uploads/recipes/')) {
      await fs.remove(path.join(__dirname, '../../public', oldCoverUrl))
    }
    const [rows] = await db.query('SELECT * FROM recipes WHERE id = ?', [ctx.params.id])
    ctx.body = { success: true, data: rows[0] ? normalizeRecipe(rows[0]) : null }
  } catch (error) {
    ctx.status = 500
    ctx.body = { success: false, message: error.message }
  }
})

router.delete('/:id', async ctx => {
  try {
    const [rows] = await db.query('SELECT cover_url FROM recipes WHERE id = ?', [ctx.params.id])
    const url = rows[0]?.cover_url || ''
    if (url.startsWith('/uploads/recipes/')) {
      await fs.remove(path.join(__dirname, '../../public', url))
    }
    await db.query('DELETE FROM recipes WHERE id = ?', [ctx.params.id])
    ctx.body = { success: true }
  } catch (error) {
    ctx.status = 500
    ctx.body = { success: false, message: error.message }
  }
})

module.exports = router
