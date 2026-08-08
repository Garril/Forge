const Router = require('koa-router');
const router = new Router({ prefix: '/api/upload' });
const multer = require('@koa/multer');
const path = require('path');
const fs = require('fs-extra');

// 图片上传目录
const MARKDOWN_UPLOAD_DIR = path.join(__dirname, '../../public/uploads/markdown');
const HABIT_UPLOAD_DIR = path.join(__dirname, '../../public/uploads/habit');
const CANVAS_UPLOAD_DIR = path.join(__dirname, '../../public/uploads/canvas/tips');
fs.ensureDirSync(MARKDOWN_UPLOAD_DIR);
fs.ensureDirSync(HABIT_UPLOAD_DIR);
fs.ensureDirSync(CANVAS_UPLOAD_DIR);

// 配置存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (req.url.includes('canvas-image')) {
      cb(null, CANVAS_UPLOAD_DIR);
    } else if (req.url.includes('habit-icon')) {
      cb(null, HABIT_UPLOAD_DIR);
    } else {
      cb(null, MARKDOWN_UPLOAD_DIR);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    let prefix = 'md-img-';
    if (req.url.includes('habit-icon')) prefix = 'habit-icon-';
    else if (req.url.includes('canvas-image')) prefix = 'canvas-img-';
    cb(null, prefix + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
  fileFilter: function (req, file, cb) {
    // 只允许图片
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// Markdown 图片上传
router.post('/markdown-image', upload.single('image'), async (ctx) => {
  try {
    if (!ctx.file) {
      ctx.status = 400;
      ctx.body = { success: false, message: '没有上传文件' };
      return;
    }
    
    const url = `/uploads/markdown/${ctx.file.filename}`;
    ctx.body = { 
      success: true, 
      url,
      filename: ctx.file.filename
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 习惯图标上传
router.post('/habit-icon', upload.single('image'), async (ctx) => {
  try {
    if (!ctx.file) {
      ctx.status = 400;
      ctx.body = { success: false, message: '没有上传文件' };
      return;
    }
    
    const url = `/uploads/habit/${ctx.file.filename}`;
    ctx.body = { 
      success: true, 
      url,
      filename: ctx.file.filename
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 获取所有习惯图标
router.get('/habit-icons', async (ctx) => {
  try {
    const files = await fs.readdir(HABIT_UPLOAD_DIR);
    const urls = files
      .filter(file => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file))
      .map(file => `/uploads/habit/${file}`);
    ctx.body = { success: true, urls };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// Canvas 图片上传
router.post('/canvas-image', upload.single('image'), async (ctx) => {
  try {
    if (!ctx.file) {
      ctx.status = 400;
      ctx.body = { success: false, message: '没有上传文件' };
      return;
    }

    const url = `/uploads/canvas/tips/${ctx.file.filename}`;
    ctx.body = {
      success: true,
      url,
      filename: ctx.file.filename,
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

module.exports = router;
