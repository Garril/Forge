const Router = require('koa-router');
const router = new Router({ prefix: '/api/resources' });
const db = require('../config/db');
const fs = require('fs');
const path = require('path');

function parseJsonField(str) {
  if (!str) return [];
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch { return []; }
}

// 列表（支持分页、标签筛选）
router.get('/', async (ctx) => {
  try {
    const limit = Math.min(parseInt(ctx.query.limit) || 12, 100);
    const offset = parseInt(ctx.query.offset) || 0;
    const tagFilter = ctx.query.tags;

    let where = '';
    let params = [];

    if (tagFilter) {
      const tags = tagFilter.split(',').map(t => t.trim()).filter(Boolean);
      if (tags.length > 0) {
        const conds = tags.map(() => 'JSON_CONTAINS(tags, ?)').join(' OR ');
        where = `WHERE ${conds}`;
        params = tags.map(t => JSON.stringify(t));
      }
    }

    const [rows] = await db.query(
      `SELECT id, title, prompt, tags, notes, ref_images, result_images, cover_url, created_at
       FROM resources ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM resources ${where}`,
      params
    );

    const data = rows.map(row => ({
      id: row.id,
      title: row.title,
      prompt: row.prompt || '',
      tags: parseJsonField(row.tags),
      notes: row.notes || '',
      refImages: parseJsonField(row.ref_images),
      resultImages: parseJsonField(row.result_images),
      imageUrl: row.cover_url || '',
      refCount: parseJsonField(row.ref_images).length,
      createdAt: new Date(row.created_at).getTime(),
    }));

    ctx.body = { success: true, data, total: countRows[0].total };
  } catch (error) {
    console.error('获取资源列表失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 创建
router.post('/', async (ctx) => {
  try {
    const { title, prompt, tags, notes, refImages, resultImages } = ctx.request.body;
    const cover = (resultImages && resultImages[0]) || (refImages && refImages[0]) || '';

    const [result] = await db.query(
      `INSERT INTO resources (title, prompt, tags, notes, ref_images, result_images, cover_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        title || '',
        prompt || '',
        tags ? JSON.stringify(tags) : '[]',
        notes || '',
        refImages ? JSON.stringify(refImages) : '[]',
        resultImages ? JSON.stringify(resultImages) : '[]',
        cover
      ]
    );

    ctx.body = {
      success: true,
      data: {
        id: result.insertId,
        title: title || '',
        prompt: prompt || '',
        tags: tags || [],
        notes: notes || '',
        refImages: refImages || [],
        resultImages: resultImages || [],
        imageUrl: cover,
        refCount: (refImages || []).length,
        createdAt: Date.now(),
      }
    };
  } catch (error) {
    console.error('创建资源失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 更新
router.put('/:id', async (ctx) => {
  try {
    const { title, prompt, tags, notes, refImages, resultImages } = ctx.request.body;
    const cover = (resultImages && resultImages[0]) || (refImages && refImages[0]) || '';

    await db.query(
      `UPDATE resources SET title=?, prompt=?, tags=?, notes=?, ref_images=?, result_images=?, cover_url=? WHERE id=?`,
      [
        title || '',
        prompt || '',
        tags ? JSON.stringify(tags) : '[]',
        notes || '',
        refImages ? JSON.stringify(refImages) : '[]',
        resultImages ? JSON.stringify(resultImages) : '[]',
        cover,
        ctx.params.id
      ]
    );

    ctx.body = {
      success: true,
      data: {
        id: parseInt(ctx.params.id),
        title: title || '',
        prompt: prompt || '',
        tags: tags || [],
        notes: notes || '',
        refImages: refImages || [],
        resultImages: resultImages || [],
        imageUrl: cover,
        refCount: (refImages || []).length,
      }
    };
  } catch (error) {
    console.error('更新资源失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 删除
router.delete('/:id', async (ctx) => {
  try {
    const [rows] = await db.query(
      'SELECT ref_images, result_images, cover_url FROM resources WHERE id = ?',
      [ctx.params.id]
    );
    const record = rows[0];
    if (record) {
      const urls = new Set();
      parseJsonField(record.ref_images).forEach(u => u && urls.add(u));
      parseJsonField(record.result_images).forEach(u => u && urls.add(u));
      if (record.cover_url) urls.add(record.cover_url);

      const baseDir = path.join(__dirname, '../../public');
      for (const url of urls) {
        let rel = '';
        if (url.startsWith('http://') || url.startsWith('https://')) {
          try { rel = new URL(url).pathname; } catch { continue; }
        } else if (url.startsWith('/')) {
          rel = url;
        }
        if (rel) {
          const filePath = path.join(baseDir, rel);
          try { fs.unlinkSync(filePath); } catch { /* 忽略不存在或无权限 */ }
        }
      }
    }

    await db.query('DELETE FROM resources WHERE id = ?', [ctx.params.id]);
    ctx.body = { success: true };
  } catch (error) {
    console.error('删除资源失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 迁移旧图片路径（一次性接口）
router.post('/migrate-paths', async (ctx) => {
  try {
    const [rows] = await db.query('SELECT id, ref_images, result_images, cover_url FROM resources');
    let updated = 0;
    for (const row of rows) {
      const refImages = parseJsonField(row.ref_images).map(u =>
        u.replace('/uploads/canvas/tips/', '/uploads/canvas/').replace('/uploads/canvas/', '/uploads/canvas/tips/')
      );
      const resultImages = parseJsonField(row.result_images).map(u =>
        u.replace('/uploads/canvas/tips/', '/uploads/canvas/').replace('/uploads/canvas/', '/uploads/canvas/tips/')
      );
      const coverUrl = (row.cover_url || '').replace('/uploads/canvas/tips/', '/uploads/canvas/').replace('/uploads/canvas/', '/uploads/canvas/tips/');

      await db.query(
        'UPDATE resources SET ref_images = ?, result_images = ?, cover_url = ? WHERE id = ?',
        [JSON.stringify(refImages), JSON.stringify(resultImages), coverUrl, row.id]
      );
      updated++;
    }
    ctx.body = { success: true, updated };
  } catch (error) {
    console.error('迁移路径失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

module.exports = router;
