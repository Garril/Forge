const Router = require('koa-router');
const router = new Router({ prefix: '/api/memos' });
const db = require('../config/db');
const multer = require('@koa/multer');
const path = require('path');
const fs = require('fs-extra');

// 配置 multer 用于附件上传
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../public/uploads/memo');
    try {
      await fs.ensureDir(uploadDir);
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'memo-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

// 获取所有备忘录
router.get('/', async (ctx) => {
  try {
    const [rows] = await db.query(
      'SELECT id, title, content, attachments, display_type, random_count, created_at, updated_at FROM memos ORDER BY created_at DESC'
    );

    // 解析附件 JSON
    const memos = rows.map(row => {
      let attachments = [];
      try {
        const attStr = row.attachments;
        if (attStr && typeof attStr === 'string' && attStr.trim() !== '' && attStr !== '[]') {
          attachments = JSON.parse(attStr);
        }
      } catch (e) {
        console.error('解析附件失败:', row.attachments, e);
        attachments = [];
      }
      return {
        ...row,
        attachments
      };
    });

    ctx.body = { success: true, data: memos };
  } catch (error) {
    console.error('获取备忘录失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 获取单个备忘录
router.get('/:id', async (ctx) => {
  try {
    const [rows] = await db.query(
      'SELECT id, title, content, attachments, display_type, random_count, created_at, updated_at FROM memos WHERE id = ?',
      [ctx.params.id]
    );

    if (rows.length === 0) {
      ctx.status = 404;
      ctx.body = { success: false, message: '备忘录不存在' };
      return;
    }

    let attachments = [];
    try {
      const attStr = rows[0].attachments;
      if (attStr && typeof attStr === 'string' && attStr.trim() !== '' && attStr !== '[]') {
        attachments = JSON.parse(attStr);
      }
    } catch (e) {
      attachments = [];
    }
    const memo = {
      ...rows[0],
      attachments
    };

    ctx.body = { success: true, data: memo };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 创建备忘录
router.post('/', async (ctx) => {
  try {
    const { title, content, attachments, display_type, random_count } = ctx.request.body;
    // console.log('[DEBUG] 创建备忘录:', { title, content, display_type, random_count });

    const [result] = await db.query(
      'INSERT INTO memos (title, content, attachments, display_type, random_count) VALUES (?, ?, ?, ?, ?)',
      [
        title || '',
        content || '',
        attachments ? JSON.stringify(attachments) : '[]',
        display_type || 'permanent',
        random_count || 3
      ]
    );

    // console.log('[DEBUG] 创建成功, ID:', result.insertId);
    ctx.body = {
      success: true,
      data: { id: result.insertId, title, content, attachments: attachments || [], display_type, random_count }
    };
  } catch (error) {
    console.error('[DEBUG] 创建备忘录失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: error.message, sql: error.sql };
  }
});

// 更新备忘录
router.put('/:id', async (ctx) => {
  try {
    const { title, content, attachments, display_type, random_count } = ctx.request.body;
    const id = ctx.params.id;
    // console.log('[DEBUG] 更新备忘录 ID:', id, { title, display_type, random_count });

    // 获取原备忘录信息（用于删除旧附件）
    const [oldRows] = await db.query('SELECT attachments FROM memos WHERE id = ?', [id]);
    let oldAttachments = [];
    try {
      const attStr = oldRows[0]?.attachments;
      if (attStr && typeof attStr === 'string' && attStr.trim() !== '' && attStr !== '[]') {
        oldAttachments = JSON.parse(attStr);
      }
    } catch (e) {
      oldAttachments = [];
    }
    const newAttachments = attachments || [];

    // 找出被删除的附件并删除文件
    const deletedAttachments = oldAttachments.filter(old => !newAttachments.find(n => n.filename === old.filename));
    for (const att of deletedAttachments) {
      try {
        const filepath = path.join(__dirname, '../../public/uploads/memo', att.filename);
        if (await fs.pathExists(filepath)) {
          await fs.remove(filepath);
        }
      } catch (err) {
        console.error('删除附件失败:', err);
      }
    }

    await db.query(
      'UPDATE memos SET title = ?, content = ?, attachments = ?, display_type = ?, random_count = ? WHERE id = ?',
      [
        title || '',
        content || '',
        newAttachments ? JSON.stringify(newAttachments) : '[]',
        display_type || 'permanent',
        random_count || 3,
        id
      ]
    );

    ctx.body = { success: true, message: '更新成功' };
  } catch (error) {
    console.error('[DEBUG] 更新失败:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: error.message, stack: error.stack };
  }
});

// 删除备忘录
router.delete('/:id', async (ctx) => {
  try {
    const id = ctx.params.id;

    // 获取附件信息
    const [rows] = await db.query('SELECT attachments FROM memos WHERE id = ?', [id]);
    let attachments = [];
    try {
      const attStr = rows[0]?.attachments;
      if (attStr && typeof attStr === 'string' && attStr.trim() !== '' && attStr !== '[]') {
        attachments = JSON.parse(attStr);
      }
    } catch (e) {
      attachments = [];
    }
    if (attachments.length > 0) {
      // 删除所有附件文件
      for (const att of attachments) {
        try {
          const filepath = path.join(__dirname, '../../public/uploads/memo', att.filename);
          if (await fs.pathExists(filepath)) {
            await fs.remove(filepath);
          }
        } catch (err) {
          console.error('删除附件失败:', err);
        }
      }
    }

    await db.query('DELETE FROM memos WHERE id = ?', [id]);
    ctx.body = { success: true, message: '删除成功' };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 上传附件
router.post('/upload', upload.single('file'), async (ctx) => {
  try {
    if (!ctx.file) {
      ctx.status = 400;
      ctx.body = { success: false, message: '未上传任何文件' };
      return;
    }

    const filename = ctx.file.filename;
    const originalname = ctx.file.originalname;
    const host = ctx.origin || 'http://localhost:5888';
    const url = `${host}/uploads/memo/${filename}`;

    ctx.body = {
      success: true,
      data: {
        filename,
        originalname,
        url
      }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 删除附件
router.delete('/attachments/:filename', async (ctx) => {
  try {
    const filename = ctx.params.filename;
    const filepath = path.join(__dirname, '../../public/uploads/memo', filename);

    if (await fs.pathExists(filepath)) {
      await fs.remove(filepath);
    }

    ctx.body = { success: true, message: '附件已删除' };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 获取随机备忘录
router.get('/random/:count', async (ctx) => {
  try {
    const count = parseInt(ctx.params.count) || 3;

    const [rows] = await db.query(
      'SELECT id, title, content, attachments, display_type FROM memos WHERE display_type = "random"'
    );

    // 随机打乱并取前 N 个
    const shuffled = rows.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(count, rows.length));

    const memos = selected.map(row => {
      let attachments = [];
      try {
        const attStr = row.attachments;
        if (attStr && typeof attStr === 'string' && attStr.trim() !== '' && attStr !== '[]') {
          attachments = JSON.parse(attStr);
        }
      } catch (e) {
        attachments = [];
      }
      return {
        ...row,
        attachments
      };
    });

    ctx.body = { success: true, data: memos };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 获取随机展示数量设置
router.get('/settings/random-count', async (ctx) => {
  try {
    const [rows] = await db.query(
      'SELECT setting_value FROM settings WHERE setting_key = "memo_random_count"'
    );
    const count = rows.length > 0 ? parseInt(rows[0].setting_value) : 3;
    ctx.body = { success: true, data: count };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 设置随机展示数量
router.put('/settings/random-count', async (ctx) => {
  try {
    const { count } = ctx.request.body;
    const validCount = Math.max(1, Math.min(20, parseInt(count) || 3));

    await db.query(
      'INSERT INTO settings (setting_key, setting_value) VALUES ("memo_random_count", ?) ON DUPLICATE KEY UPDATE setting_value = ?',
      [validCount, validCount]
    );

    ctx.body = { success: true, data: validCount };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

module.exports = router;
