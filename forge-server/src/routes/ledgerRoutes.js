const Router = require('koa-router');
const router = new Router({ prefix: '/api/ledgers' });
const db = require('../config/db');
const crypto = require('crypto');

// 获取流水列表 (支持日期范围、分类筛选、排序)
router.get('/', async (ctx) => {
  const { startDate, endDate, categories, sortBy, sortOrder } = ctx.query;
  try {
    let query = 'SELECT * FROM ledgers WHERE 1=1';
    let params = [];
    
    // 日期范围筛选
    if (startDate) {
      query += ' AND record_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND record_date <= ?';
      params.push(endDate);
    }
    
    // 分类筛选
    if (categories) {
      const categoryList = categories.split(',');
      const placeholders = categoryList.map(() => '?').join(',');
      query += ` AND category IN (${placeholders})`;
      params.push(...categoryList);
    }
    
    // 排序 - 优先按 record_date 升序，日期相同则按 created_at 升序
    const validSortFields = ['record_date', 'amount', 'category', 'created_at'];
    const validSortOrders = ['ascending', 'descending'];
    
    // 对于收入/支出列的排序，需要特殊处理
    if (sortBy === 'income') {
      query += ` ORDER BY CASE WHEN type = 1 THEN amount ELSE 0 END ${sortOrder === 'descending' ? 'DESC' : 'ASC'}, record_date ASC, created_at ASC`;
    } else if (sortBy === 'expense') {
      query += ` ORDER BY CASE WHEN type = 2 THEN amount ELSE 0 END ${sortOrder === 'descending' ? 'DESC' : 'ASC'}, record_date ASC, created_at ASC`;
    } else if (sortBy && validSortFields.includes(sortBy)) {
      // 用户点击了其他排序列
      const order = sortOrder === 'descending' ? 'DESC' : 'ASC';
      query += ` ORDER BY ${sortBy} ${order}`;
    } else {
      // 默认排序：优先按 record_date 升序，日期相同则按 created_at 升序
      query += ` ORDER BY record_date ASC, created_at ASC`;
    }
    
    const [rows] = await db.query(query, params);
    ctx.body = { success: true, data: rows };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 新增账本记录
router.post('/', async (ctx) => {
  const { type, amount, category, remark, record_date } = ctx.request.body;
  const id = crypto.randomUUID();
  const finalCategory = category || '无分类';
  
  try {
    // 先检查并自动添加新分类到分类表
    if (finalCategory !== '无分类') {
      const [existing] = await db.query('SELECT id FROM ledger_categories WHERE name = ?', [finalCategory]);
      if (existing.length === 0) {
        const categoryId = crypto.randomUUID();
        await db.query(
          'INSERT INTO ledger_categories (id, name, type) VALUES (?, ?, ?)',
          [categoryId, finalCategory, type]
        );
      }
    }
    
    await db.query(
      'INSERT INTO ledgers (id, type, amount, category, remark, record_date) VALUES (?, ?, ?, ?, ?, ?)',
      [id, type, amount, finalCategory, remark, record_date]
    );
    ctx.body = { success: true, message: 'Ledger created', data: { id } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 删除账本记录
router.delete('/:id', async (ctx) => {
  const { id } = ctx.params;
  try {
    await db.query('DELETE FROM ledgers WHERE id = ?', [id]);
    ctx.body = { success: true, message: 'Ledger deleted' };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 更新账本记录
router.put('/:id', async (ctx) => {
  const { id } = ctx.params;
  const { type, amount, category, remark, record_date } = ctx.request.body;
  const finalCategory = category || '无分类';
  
  try {
    // 先检查并自动添加新分类到分类表
    if (finalCategory !== '无分类') {
      const [existing] = await db.query('SELECT id FROM ledger_categories WHERE name = ?', [finalCategory]);
      if (existing.length === 0) {
        const categoryId = crypto.randomUUID();
        await db.query(
          'INSERT INTO ledger_categories (id, name, type) VALUES (?, ?, ?)',
          [categoryId, finalCategory, type]
        );
      }
    }
    
    await db.query(
      'UPDATE ledgers SET type = ?, amount = ?, category = ?, remark = ?, record_date = ? WHERE id = ?',
      [type, amount, finalCategory, remark, record_date, id]
    );
    ctx.body = { success: true, message: 'Ledger updated' };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 获取统计数据 (支持日期范围、分类筛选)
router.get('/stats', async (ctx) => {
  const { type, startDate, endDate, categories } = ctx.query;
  try {
    let query = 'SELECT category, SUM(amount) as total FROM ledgers WHERE type = ?';
    let params = [type || 2];
    
    if (startDate) {
      query += ' AND record_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND record_date <= ?';
      params.push(endDate);
    }
    
    // 分类筛选
    if (categories) {
      const categoryList = categories.split(',');
      const placeholders = categoryList.map(() => '?').join(',');
      query += ` AND category IN (${placeholders})`;
      params.push(...categoryList);
    }
    
    query += ' GROUP BY category ORDER BY total DESC';
    const [rows] = await db.query(query, params);
    ctx.body = { success: true, data: rows };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 获取所有分类
router.get('/categories', async (ctx) => {
  try {
    const [rows] = await db.query('SELECT * FROM ledger_categories ORDER BY name');
    ctx.body = { success: true, data: rows };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 添加分类
router.post('/categories', async (ctx) => {
  const { name, type = 2 } = ctx.request.body;
  
  if (!name || !name.trim()) {
    ctx.status = 400;
    ctx.body = { success: false, message: '分类名称不能为空' };
    return;
  }
  
  const id = crypto.randomUUID();
  const trimmedName = name.trim();
  
  try {
    // 检查是否已存在
    const [existing] = await db.query('SELECT id FROM ledger_categories WHERE name = ?', [trimmedName]);
    if (existing.length > 0) {
      ctx.body = { success: false, message: '分类已存在' };
      return;
    }
    
    await db.query(
      'INSERT INTO ledger_categories (id, name, type) VALUES (?, ?, ?)',
      [id, trimmedName, type]
    );
    ctx.body = { success: true, message: 'Category created', data: { id, name: trimmedName } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 删除分类
router.delete('/categories/:id', async (ctx) => {
  const { id } = ctx.params;
  try {
    // 先将该分类的记录改为"无分类"
    await db.query('UPDATE ledgers SET category = "无分类" WHERE category = (SELECT name FROM ledger_categories WHERE id = ?)', [id]);
    // 再删除分类
    await db.query('DELETE FROM ledger_categories WHERE id = ?', [id]);
    ctx.body = { success: true, message: 'Category deleted' };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 批量更新分类
router.post('/batch-update-category', async (ctx) => {
  const { ids, category } = ctx.request.body;
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请选择要更新的记录' };
    return;
  }
  
  if (!category) {
    ctx.status = 400;
    ctx.body = { success: false, message: '分类不能为空' };
    return;
  }
  
  try {
    const placeholders = ids.map(() => '?').join(',');
    const [result] = await db.query(
      `UPDATE ledgers SET category = ? WHERE id IN (${placeholders})`,
      [category, ...ids]
    );
    
    ctx.body = { 
      success: true, 
      message: '批量更新成功',
      updatedCount: result.affectedRows 
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 批量删除账本记录
router.post('/batch-delete', async (ctx) => {
  const { ids } = ctx.request.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请选择要删除的记录' };
    return;
  }
  try {
    const placeholders = ids.map(() => '?').join(',');
    await db.query(`DELETE FROM ledgers WHERE id IN (${placeholders})`, ids);
    ctx.body = { success: true, message: '批量删除成功' };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// ==================== 定期管理 API ====================

// 获取所有定期记录
router.get('/recurring', async (ctx) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM recurring_ledgers ORDER BY created_at DESC'
    );
    ctx.body = { success: true, data: rows };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 添加定期记录
router.post('/recurring', async (ctx) => {
  const { title, income_amount, expense_amount, category, cycle_type, trigger_value, end_date } = ctx.request.body;
  
  if (!title || !cycle_type || !trigger_value) {
    ctx.status = 400;
    ctx.body = { success: false, message: '定期内容、循环情况和触发日期不能为空' };
    return;
  }
  
  // 验证至少有一个金额
  if (!income_amount && !expense_amount) {
    ctx.status = 400;
    ctx.body = { success: false, message: '收入和支出至少填写一项' };
    return;
  }
  
  const id = crypto.randomUUID();
  
  try {
    await db.query(
      `INSERT INTO recurring_ledgers (id, title, income_amount, expense_amount, category, cycle_type, trigger_value, end_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, income_amount || null, expense_amount || null, category || '无分类', cycle_type, trigger_value, end_date || null]
    );
    ctx.body = { success: true, message: '定期记录创建成功', data: { id } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 更新定期记录
router.put('/recurring/:id', async (ctx) => {
  const { id } = ctx.params;
  const { title, income_amount, expense_amount, category, cycle_type, trigger_value, end_date, is_active } = ctx.request.body;
  
  try {
    await db.query(
      `UPDATE recurring_ledgers SET 
        title = ?, income_amount = ?, expense_amount = ?, category = ?, 
        cycle_type = ?, trigger_value = ?, end_date = ?, is_active = ? 
       WHERE id = ?`,
      [title, income_amount || null, expense_amount || null, category || '无分类', 
       cycle_type, trigger_value, end_date || null, is_active, id]
    );
    ctx.body = { success: true, message: '定期记录更新成功' };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 删除定期记录
router.delete('/recurring/:id', async (ctx) => {
  const { id } = ctx.params;
  try {
    await db.query('DELETE FROM recurring_ledgers WHERE id = ?', [id]);
    ctx.body = { success: true, message: '定期记录删除成功' };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 手动触发定期任务执行（强制执行，不受last_executed限制）
router.post('/recurring/execute', async (ctx) => {
  try {
    const result = await executeRecurringTasks(true);
    ctx.body = { success: true, message: '定期任务执行完成', data: result };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 执行定期任务的核心逻辑 - 导出供外部调用
// force参数：true表示强制执行（忽略last_executed检查）
async function executeRecurringTasks(force = false) {
  const today = new Date().toISOString().split('T')[0];
  const executedRecords = [];
  
  try {
    // 获取所有活跃的定期记录
    const [recurringRecords] = await db.query(
      'SELECT * FROM recurring_ledgers WHERE is_active = 1 AND (end_date IS NULL OR end_date >= ?)',
      [today]
    );
    
    for (const record of recurringRecords) {
      // 检查今天是否需要执行
      const shouldExecute = checkShouldExecute(record, today);
      
      if (shouldExecute || force) {
        // 非强制模式下，检查今天是否已经执行过
        if (!force && record.last_executed === today) {
          continue;
        }
        
        // 创建账本记录
        if (record.income_amount && parseFloat(record.income_amount) > 0) {
          await createLedgerRecord({
            type: 1,
            amount: record.income_amount,
            category: record.category,
            remark: `定期管理-自动录入: ${record.title}`,
            record_date: today
          });
        }
        
        if (record.expense_amount && parseFloat(record.expense_amount) > 0) {
          await createLedgerRecord({
            type: 2,
            amount: record.expense_amount,
            category: record.category,
            remark: `定期管理-自动录入: ${record.title}`,
            record_date: today
          });
        }
        
        // 更新最后执行时间
        await db.query(
          'UPDATE recurring_ledgers SET last_executed = ? WHERE id = ?',
          [today, record.id]
        );
        
        executedRecords.push(record.title);
      }
    }
    
    return { executedCount: executedRecords.length, executedRecords };
  } catch (error) {
    console.error('执行定期任务失败:', error);
    throw error;
  }
}

// 检查今天是否应该执行
function checkShouldExecute(record, today) {
  const todayDate = new Date(today);
  const dayOfWeek = todayDate.getDay() || 7; // 1-7 (周一到周日)
  const dayOfMonth = todayDate.getDate();
  const monthDay = `${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
  
  switch (record.cycle_type) {
    case 'daily':
      return true;
    case 'weekly':
      return parseInt(record.trigger_value) === dayOfWeek;
    case 'monthly':
      return parseInt(record.trigger_value) === dayOfMonth;
    case 'yearly':
      return record.trigger_value === monthDay;
    default:
      return false;
  }
}

// 创建账本记录
async function createLedgerRecord({ type, amount, category, remark, record_date }) {
  const id = crypto.randomUUID();
  const finalCategory = category || '无分类';
  
  // 先检查并自动添加新分类到分类表
  if (finalCategory !== '无分类') {
    const [existing] = await db.query('SELECT id FROM ledger_categories WHERE name = ?', [finalCategory]);
    if (existing.length === 0) {
      const categoryId = crypto.randomUUID();
      await db.query(
        'INSERT INTO ledger_categories (id, name, type) VALUES (?, ?, ?)',
        [categoryId, finalCategory, type]
      );
    }
  }
  
  await db.query(
    'INSERT INTO ledgers (id, type, amount, category, remark, record_date) VALUES (?, ?, ?, ?, ?, ?)',
    [id, type, amount, finalCategory, remark, record_date]
  );
  return id;
}

module.exports = router;
module.exports.executeRecurringTasks = executeRecurringTasks;
