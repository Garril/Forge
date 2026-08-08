const Router = require('koa-router');
const router = new Router({ prefix: '/api/passwords' });
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// 确保表存在
const initTable = async () => {
  await db.ready;
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS \`passwords\` (
      \`id\` VARCHAR(36) PRIMARY KEY,
      \`platform\` VARCHAR(200) NOT NULL COMMENT '平台名称',
      \`account\` VARCHAR(200) NOT NULL COMMENT '账号',
      \`password\` VARCHAR(500) NOT NULL COMMENT '密码',
      \`remark\` TEXT COMMENT '备注',
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX \`idx_platform\` (\`platform\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  try {
    await db.query(createTableQuery);
  } catch (err) {
    console.error('Failed to create passwords table:', err);
  }
};
initTable();

// 获取所有密码
router.get('/', async (ctx) => {
  try {
    const [rows] = await db.query('SELECT * FROM passwords ORDER BY created_at DESC');
    ctx.body = { success: true, data: rows };
  } catch (err) {
    ctx.status = 500;
    ctx.body = { success: false, message: '获取密码列表失败', error: err.message };
  }
});

// 新增密码
router.post('/', async (ctx) => {
  try {
    const { platform, account, password, remark } = ctx.request.body;
    
    if (!platform || !account || !password) {
      ctx.status = 400;
      ctx.body = { success: false, message: '平台、账号、密码为必填项' };
      return;
    }
    
    const id = uuidv4();
    const query = `
      INSERT INTO passwords (id, platform, account, password, remark)
      VALUES (?, ?, ?, ?, ?)
    `;
    const params = [id, platform, account, password, remark || ''];
    
    await db.query(query, params);
    ctx.body = { success: true, data: { id, platform, account, password, remark } };
  } catch (err) {
    ctx.status = 500;
    ctx.body = { success: false, message: '新增密码失败', error: err.message };
  }
});

// 更新密码
router.put('/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    const { platform, account, password, remark } = ctx.request.body;
    
    if (!platform || !account || !password) {
      ctx.status = 400;
      ctx.body = { success: false, message: '平台、账号、密码为必填项' };
      return;
    }
    
    const query = `
      UPDATE passwords 
      SET platform = ?, account = ?, password = ?, remark = ?
      WHERE id = ?
    `;
    const params = [platform, account, password, remark || '', id];
    
    await db.query(query, params);
    ctx.body = { success: true, message: '更新成功' };
  } catch (err) {
    ctx.status = 500;
    ctx.body = { success: false, message: '更新密码失败', error: err.message };
  }
});

// 删除密码
router.delete('/:id', async (ctx) => {
  try {
    const { id } = ctx.params;
    await db.query('DELETE FROM passwords WHERE id = ?', [id]);
    ctx.body = { success: true, message: '删除成功' };
  } catch (err) {
    ctx.status = 500;
    ctx.body = { success: false, message: '删除密码失败', error: err.message };
  }
});

module.exports = router;