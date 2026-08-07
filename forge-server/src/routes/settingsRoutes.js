const Router = require('koa-router');
const router = new Router({ prefix: '/api/settings' });
const db = require('../config/db');
const multer = require('@koa/multer');
const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');

const BG_ORIGIN_DIR = 'uploads/bg/origin';
const BG_SMALL_DIR = 'uploads/bg/small';
const BG_ORIGIN_ABS = path.join(__dirname, `../../public/${BG_ORIGIN_DIR}`);
const BG_SMALL_ABS = path.join(__dirname, `../../public/${BG_SMALL_DIR}`);

// 生成小图缩略图
const generateSmallImage = async (originPath, smallPath) => {
  await fs.ensureDir(path.dirname(smallPath));
  await sharp(originPath)
    .resize({ width: 300, withoutEnlargement: true })
    .jpeg({ quality: 80, progressive: true })
    .toFile(smallPath);
};

// 配置 multer 用于头像上传
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../public/uploads/avatar');
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
    cb(null, 'avatar-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

router.post('/upload-avatar', upload.single('avatar'), async (ctx) => {
  try {
    if (!ctx.file) {
      ctx.status = 400;
      ctx.body = { success: false, message: '未上传任何文件' };
      return;
    }
    const filename = ctx.file.filename;
    const host = ctx.origin || 'http://localhost:5888';
    const newUrl = `${host}/uploads/avatar/${filename}`;
    
    // 删除旧头像（保留刚上传的新头像）
    const avatarDir = path.join(__dirname, '../../public/uploads/avatar');
    const files = await fs.readdir(avatarDir);
    for (const file of files) {
      if (file !== filename) {
        await fs.remove(path.join(avatarDir, file));
      }
    }
    
    ctx.body = {
      success: true,
      url: newUrl
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 配置 multer 用于背景图上传 - 原图保存到 origin 目录
const bgStorage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      await fs.ensureDir(BG_ORIGIN_ABS);
      cb(null, BG_ORIGIN_ABS);
    } catch (err) {
      cb(err);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'bg-' + uniqueSuffix + ext);
  }
});
const uploadBg = multer({ 
  storage: bgStorage,
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB
});

// 单文件上传（兼容旧接口）
router.post('/upload-bg', uploadBg.single('file'), async (ctx) => {
  try {
    if (!ctx.file) {
      ctx.status = 400;
      ctx.body = { success: false, message: '未上传任何文件' };
      return;
    }
    const filename = ctx.file.filename;
    const host = ctx.origin || 'http://localhost:5888';
    const originPath = path.join(BG_ORIGIN_ABS, filename);
    const smallPath = path.join(BG_SMALL_ABS, `${path.parse(filename).name}.jpg`);

    await generateSmallImage(originPath, smallPath);

    ctx.body = {
      success: true,
      url: `${host}/${BG_ORIGIN_DIR}/${filename}`,
      filename: filename
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 多文件上传
router.post('/upload-bg-multi', uploadBg.array('files', 10), async (ctx) => {
  try {
    if (!ctx.files || ctx.files.length === 0) {
      ctx.status = 400;
      ctx.body = { success: false, message: '未上传任何文件' };
      return;
    }
    const host = ctx.origin || 'http://localhost:5888';

    const files = await Promise.all(ctx.files.map(async (file) => {
      const originPath = path.join(BG_ORIGIN_ABS, file.filename);
      const smallPath = path.join(BG_SMALL_ABS, `${path.parse(file.filename).name}.jpg`);
      await generateSmallImage(originPath, smallPath);
      return {
        filename: file.filename,
        url: `${host}/${BG_ORIGIN_DIR}/${file.filename}`,
        originalname: file.originalname
      };
    }));

    ctx.body = {
      success: true,
      data: files,
      count: files.length
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 获取所有背景图 - 从 origin 读取，并确保 small 缩略图已生成
router.get('/bgs', async (ctx) => {
  try {
    await fs.ensureDir(BG_ORIGIN_ABS);
    await fs.ensureDir(BG_SMALL_ABS);
    const files = await fs.readdir(BG_ORIGIN_ABS);
    const host = ctx.origin || 'http://localhost:5888';

    const images = [];
    for (const f of files) {
      if (!/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(f)) continue;
      const originPath = path.join(BG_ORIGIN_ABS, f);
      const smallFilename = `${path.parse(f).name}.jpg`;
      const smallPath = path.join(BG_SMALL_ABS, smallFilename);
      if (!await fs.pathExists(smallPath)) {
        try {
          await generateSmallImage(originPath, smallPath);
        } catch (err) {
          console.error(`生成缩略图失败: ${f}`, err.message);
          continue;
        }
      }
      images.push({
        name: f,
        url: `${host}/${BG_SMALL_DIR}/${smallFilename}`,
        originUrl: `${host}/${BG_ORIGIN_DIR}/${f}`
      });
    }

    ctx.body = { success: true, data: images };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 删除背景图 - 同时删除 origin 和 small
router.delete('/bgs/:filename', async (ctx) => {
  try {
    const filename = ctx.params.filename;
    const originPath = path.join(BG_ORIGIN_ABS, filename);
    const smallPath = path.join(BG_SMALL_ABS, `${path.parse(filename).name}.jpg`);

    if (await fs.pathExists(originPath)) {
      await fs.remove(originPath);
    }
    if (await fs.pathExists(smallPath)) {
      await fs.remove(smallPath);
    }
    ctx.body = { success: true, message: 'Deleted successfully' };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 把旧版背景 URL 迁移为 origin 目录 URL
const normalizeBgUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  const match = url.match(/\/uploads\/bg\/(?!origin\/|small\/)([^/]+)$/);
  if (match) {
    return url.replace(/\/uploads\/bg\/([^/]+)$/, `/uploads/bg/origin/${match[1]}`);
  }
  return url;
};

router.get('/', async (ctx) => {
  try {
    const [rows] = await db.query('SELECT setting_key, setting_value FROM settings');
    const settings = {};
    rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    // 迁移旧版背景路径
    const bgKeys = ['background_path', 'lock_bg_path'];
    for (const key of bgKeys) {
      const normalized = normalizeBgUrl(settings[key]);
      if (normalized && normalized !== settings[key]) {
        settings[key] = normalized;
        await db.query(
          'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
          [key, normalized, normalized]
        );
      }
    }

    ctx.body = { success: true, data: settings };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.post('/unlock', async (ctx) => {
  const { password } = ctx.request.body;
  try {
    const [rows] = await db.query('SELECT setting_value FROM settings WHERE setting_key = "password"');
    if (rows.length > 0 && rows[0].setting_value === password) {
      ctx.body = { success: true, message: 'Unlocked successfully' };
    } else {
      ctx.body = { success: false, message: 'Invalid password' };
    }
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 验证密码
router.post('/verify-password', async (ctx) => {
  const { password } = ctx.request.body;
  try {
    const [rows] = await db.query('SELECT setting_value FROM settings WHERE setting_key = "password"');
    const currentPassword = rows.length > 0 ? rows[0].setting_value : '';
    if (currentPassword === password) {
      ctx.body = { success: true };
    } else {
      ctx.body = { success: false, message: '密码错误' };
    }
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.put('/', async (ctx) => {
  const { key, value } = ctx.request.body;
  try {
    await db.query(
      'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
      [key, value, value]
    );
    ctx.body = { success: true, message: 'Setting updated successfully' };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

module.exports = router;
