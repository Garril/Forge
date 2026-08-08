const Router = require('koa-router');
const router = new Router({ prefix: '/api/markdown' });
const fs = require('fs-extra');
const path = require('path');

const MARKDOWN_DIR = path.join(__dirname, '../../public/markdown');

// 确保目录存在
fs.ensureDirSync(MARKDOWN_DIR);

// 递归获取文件树
const getFileTree = async (dir, basePath = '') => {
  const items = await fs.readdir(dir, { withFileTypes: true });
  const result = [];
  
  for (const item of items) {
    const relativePath = basePath ? `${basePath}/${item.name}` : item.name;
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      const children = await getFileTree(fullPath, relativePath);
      result.push({
        name: item.name,
        path: relativePath,
        isDirectory: true,
        children
      });
    } else if (item.name.endsWith('.md')) {
      const stat = await fs.stat(fullPath);
      result.push({
        name: item.name,
        path: relativePath,
        isDirectory: false,
        size: stat.size,
        mtime: stat.mtime
      });
    }
  }
  
  // 目录在前，文件在后，按名称排序
  result.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
  
  return result;
};

// 获取文件列表
router.get('/files', async (ctx) => {
  try {
    const tree = await getFileTree(MARKDOWN_DIR);
    ctx.body = { success: true, data: tree };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 读取文件内容
router.get('/file', async (ctx) => {
  const { path: filePath } = ctx.query;
  if (!filePath) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少文件路径' };
    return;
  }
  
  // 安全检查：防止目录遍历
  const fullPath = path.join(MARKDOWN_DIR, filePath);
  if (!fullPath.startsWith(MARKDOWN_DIR)) {
    ctx.status = 403;
    ctx.body = { success: false, message: '非法路径' };
    return;
  }
  
  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    ctx.body = { success: true, content };
  } catch (error) {
    if (error.code === 'ENOENT') {
      ctx.status = 404;
      ctx.body = { success: false, message: '文件不存在' };
    } else {
      ctx.status = 500;
      ctx.body = { success: false, message: error.message };
    }
  }
});

// 保存文件（创建或更新）
router.post('/file', async (ctx) => {
  const { path: filePath, content = '' } = ctx.request.body;
  if (!filePath) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少文件路径' };
    return;
  }
  
  // 安全检查
  const fullPath = path.join(MARKDOWN_DIR, filePath);
  if (!fullPath.startsWith(MARKDOWN_DIR)) {
    ctx.status = 403;
    ctx.body = { success: false, message: '非法路径' };
    return;
  }
  
  try {
    // 确保父目录存在
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, 'utf-8');
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 重命名文件
router.put('/file/rename', async (ctx) => {
  const { oldPath, newPath } = ctx.request.body;
  if (!oldPath || !newPath) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少路径参数' };
    return;
  }
  
  const oldFullPath = path.join(MARKDOWN_DIR, oldPath);
  const newFullPath = path.join(MARKDOWN_DIR, newPath);
  
  // 安全检查
  if (!oldFullPath.startsWith(MARKDOWN_DIR) || !newFullPath.startsWith(MARKDOWN_DIR)) {
    ctx.status = 403;
    ctx.body = { success: false, message: '非法路径' };
    return;
  }
  
  try {
    await fs.ensureDir(path.dirname(newFullPath));
    await fs.rename(oldFullPath, newFullPath);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 删除文件
router.delete('/file', async (ctx) => {
  const { path: filePath } = ctx.query;
  if (!filePath) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少文件路径' };
    return;
  }
  
  const fullPath = path.join(MARKDOWN_DIR, filePath);
  
  // 安全检查
  if (!fullPath.startsWith(MARKDOWN_DIR)) {
    ctx.status = 403;
    ctx.body = { success: false, message: '非法路径' };
    return;
  }
  
  try {
    await fs.remove(fullPath);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 创建文件夹
router.post('/folder', async (ctx) => {
  const { path: folderPath } = ctx.request.body;
  if (!folderPath) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少文件夹路径' };
    return;
  }
  
  const fullPath = path.join(MARKDOWN_DIR, folderPath);
  
  // 安全检查
  if (!fullPath.startsWith(MARKDOWN_DIR)) {
    ctx.status = 403;
    ctx.body = { success: false, message: '非法路径' };
    return;
  }
  
  try {
    await fs.ensureDir(fullPath);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 移动文件
router.put('/file/move', async (ctx) => {
  const { oldPath, newPath } = ctx.request.body;
  if (!oldPath || !newPath) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少路径参数' };
    return;
  }
  
  const oldFullPath = path.join(MARKDOWN_DIR, oldPath);
  const newFullPath = path.join(MARKDOWN_DIR, newPath);
  
  // 安全检查
  if (!oldFullPath.startsWith(MARKDOWN_DIR) || !newFullPath.startsWith(MARKDOWN_DIR)) {
    ctx.status = 403;
    ctx.body = { success: false, message: '非法路径' };
    return;
  }
  
  try {
    await fs.ensureDir(path.dirname(newFullPath));
    await fs.move(oldFullPath, newFullPath);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

module.exports = router;
