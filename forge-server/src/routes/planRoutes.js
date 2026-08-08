const Router = require('koa-router');
const router = new Router({ prefix: '/api/plan' });
const db = require('../config/db');
const crypto = require('crypto');

// 修改 calendar_events 表 content 字段为 TEXT 类型（修复255字符限制）
const initTable = async () => {
  try {
    await db.ready;
    await db.query(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id VARCHAR(36) PRIMARY KEY,
        event_date DATE NOT NULL,
        content TEXT NOT NULL,
        is_completed TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_event_date (event_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
      ALTER TABLE calendar_events 
      MODIFY COLUMN content TEXT NOT NULL
    `);
  } catch (error) {
    // 忽略错误（可能是字段已经是 TEXT 或表不存在）
    console.log('calendar_events 表字段检查:', error.message);
  }

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schedule_presets (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        items JSON NOT NULL,
        sort_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS schedule_blocks (
        id VARCHAR(36) PRIMARY KEY,
        block_date VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        start_time VARCHAR(10) NOT NULL,
        end_time VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_block_date (block_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS diet_records (
        id VARCHAR(36) PRIMARY KEY,
        record_date VARCHAR(20) NOT NULL,
        meal_time VARCHAR(20) NOT NULL,
        content TEXT,
        category VARCHAR(50),
        shop_name VARCHAR(100),
        review VARCHAR(255),
        cost DECIMAL(10, 2) DEFAULT 0,
        is_favorite INT DEFAULT 0,
        UNIQUE KEY unique_date_meal (record_date, meal_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS habits (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(255),
        description TEXT,
        sort_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS habit_logs (
        id VARCHAR(36) PRIMARY KEY,
        habit_id VARCHAR(36) NOT NULL,
        check_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_habit_date (habit_id, check_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (error) {
    console.error('schedule_presets 表初始化失败:', error.message);
  }
};
const planTableReady = initTable();
router.use(async (ctx, next) => {
  await planTableReady;
  await next();
});

// === 日历事件 API ===
router.get('/events', async (ctx) => {
  try {
    const { start_date, end_date } = ctx.query;
    let query = 'SELECT * FROM calendar_events';
    let params = [];
    if (start_date && end_date) {
      query += ' WHERE event_date >= ? AND event_date <= ?';
      params.push(start_date, end_date);
    }
    const [rows] = await db.query(query, params);
    ctx.body = { success: true, data: rows };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.post('/events', async (ctx) => {
  const { event_date, content } = ctx.request.body;
  const id = crypto.randomUUID();
  try {
    await db.query('INSERT INTO calendar_events (id, event_date, content) VALUES (?, ?, ?)', [id, event_date, content]);
    ctx.body = { success: true, data: { id } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.delete('/events/:id', async (ctx) => {
  try {
    await db.query('DELETE FROM calendar_events WHERE id = ?', [ctx.params.id]);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 更新日历事件
router.put('/events/:id', async (ctx) => {
  const { content, is_completed } = ctx.request.body;
  try {
    if (is_completed !== undefined) {
      await db.query('UPDATE calendar_events SET is_completed = ? WHERE id = ?', [is_completed ? 1 : 0, ctx.params.id]);
    } else {
      await db.query('UPDATE calendar_events SET content = ? WHERE id = ?', [content, ctx.params.id]);
    }
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// === 打卡任务 API ===

// 确保 habits 表有 sort_order 列
const ensureHabitsSortOrder = async () => {
  try {
    await db.ready;
    await db.query('CREATE TABLE IF NOT EXISTS habits (id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, icon VARCHAR(255), description TEXT, sort_order INT DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    await db.query('CREATE TABLE IF NOT EXISTS habit_logs (id VARCHAR(36) PRIMARY KEY, habit_id VARCHAR(36) NOT NULL, check_date DATE NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uk_habit_date (habit_id, check_date)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    const [columns] = await db.query('SHOW COLUMNS FROM habits LIKE "sort_order"');
    if (columns.length === 0) {
      await db.query('ALTER TABLE habits ADD COLUMN sort_order INT DEFAULT 0');
    }
  } catch (err) {
    console.error('Failed to add sort_order to habits:', err);
  }
};
ensureHabitsSortOrder();

router.get('/habits', async (ctx) => {
  try {
    const [habits] = await db.query('SELECT * FROM habits ORDER BY sort_order ASC, created_at ASC');
    const [logs] = await db.query('SELECT * FROM habit_logs');
    ctx.body = { success: true, data: { habits, logs } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.post('/habits', async (ctx) => {
  const { name, icon, description } = ctx.request.body;
  const id = crypto.randomUUID();
  try {
    const [maxOrderResult] = await db.query('SELECT MAX(sort_order) as maxOrder FROM habits');
    const sort_order = (maxOrderResult[0].maxOrder || 0) + 1;
    await db.query('INSERT INTO habits (id, name, icon, description, sort_order) VALUES (?, ?, ?, ?, ?)', [id, name, icon, description, sort_order]);
    ctx.body = { success: true, data: { id, sort_order } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.delete('/habits/:id', async (ctx) => {
  try {
    await db.query('DELETE FROM habits WHERE id = ?', [ctx.params.id]);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 更新习惯
router.put('/habits/:id', async (ctx) => {
  const { name, icon, description } = ctx.request.body;
  try {
    await db.query('UPDATE habits SET name = ?, icon = ?, description = ? WHERE id = ?', 
      [name, icon, description, ctx.params.id]);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 批量更新习惯排序
router.put('/habits/sort/update', async (ctx) => {
  const { habits } = ctx.request.body; // [{id: 'xx', sort_order: 1}, ...]
  if (!habits || !Array.isArray(habits)) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'Invalid payload' };
    return;
  }
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const habit of habits) {
      await connection.query('UPDATE habits SET sort_order = ? WHERE id = ?', [habit.sort_order, habit.id]);
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

router.post('/habits/check', async (ctx) => {
  const { habit_id, check_date } = ctx.request.body;
  const id = crypto.randomUUID();
  try {
    await db.query('INSERT IGNORE INTO habit_logs (id, habit_id, check_date) VALUES (?, ?, ?)', [id, habit_id, check_date]);
    ctx.body = { success: true, data: { id } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.post('/habits/uncheck', async (ctx) => {
  const { habit_id, check_date } = ctx.request.body;
  try {
    await db.query('DELETE FROM habit_logs WHERE habit_id = ? AND check_date = ?', [habit_id, check_date]);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// === 饮食记录 API ===
const ensureDietRecordsTable = async () => {
  try {
    await db.ready;
    await db.query(`
      CREATE TABLE IF NOT EXISTS diet_records (
        id VARCHAR(36) PRIMARY KEY,
        record_date VARCHAR(20) NOT NULL,
        meal_time VARCHAR(20) NOT NULL,
        content TEXT,
        category VARCHAR(50),
        shop_name VARCHAR(100),
        review VARCHAR(255),
        cost DECIMAL(10, 2) DEFAULT 0,
        is_favorite INT DEFAULT 0,
        UNIQUE KEY unique_date_meal (record_date, meal_time)
      )
    `);
    
    // 尝试添加 is_favorite 列（如果不存在）
    try {
      await db.query(`ALTER TABLE diet_records ADD COLUMN is_favorite INT DEFAULT 0`);
    } catch (colErr) {
      // 如果列已存在会抛出错误，忽略即可
    }
  } catch (err) {
    console.error('Failed to create diet_records table:', err);
  }
};
ensureDietRecordsTable();

router.get('/diet', async (ctx) => {
  try {
    const [rows] = await db.query('SELECT * FROM diet_records ORDER BY record_date DESC, FIELD(meal_time, "早餐", "午餐", "晚餐", "夜宵")');
    ctx.body = { success: true, data: rows };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.post('/diet', async (ctx) => {
  const { record_date, meal_time, content, category, shop_name, review, cost } = ctx.request.body;
  const id = crypto.randomUUID();
  try {
    // 如果填写了店铺名，查询该店铺是否已被收藏
    let isFavorite = 0;
    if (shop_name) {
      const [favoriteRows] = await db.query(
        'SELECT is_favorite FROM diet_records WHERE shop_name = ? AND is_favorite = 1 LIMIT 1',
        [shop_name]
      );
      if (favoriteRows.length > 0) {
        isFavorite = 1;
      }
    }

    await db.query(
      `INSERT INTO diet_records (id, record_date, meal_time, content, category, shop_name, review, cost, is_favorite) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         content = COALESCE(VALUES(content), content),
         category = COALESCE(VALUES(category), category),
         shop_name = COALESCE(VALUES(shop_name), shop_name),
         review = COALESCE(VALUES(review), review),
         cost = COALESCE(VALUES(cost), cost),
         is_favorite = COALESCE(VALUES(is_favorite), is_favorite)`,
      [
        id, 
        record_date, 
        meal_time, 
        content !== undefined ? content : null, 
        category !== undefined ? category : null, 
        shop_name !== undefined ? shop_name : null, 
        review !== undefined ? review : null, 
        cost !== undefined ? cost : null,
        isFavorite
      ]
    );
    // 找出更新/插入后的新 id
    const [rows] = await db.query('SELECT id, is_favorite FROM diet_records WHERE record_date = ? AND meal_time = ?', [record_date, meal_time]);
    ctx.body = { success: true, data: { id: rows[0].id, is_favorite: rows[0].is_favorite } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 按店铺名更新收藏状态（更新该店铺所有记录）- 必须放在 /diet/:id 之前
router.put('/diet/shop/favorite', async (ctx) => {
  const { shop_name, is_favorite } = ctx.request.body;
  try {
    const [result] = await db.query('UPDATE diet_records SET is_favorite = ? WHERE shop_name = ?', [is_favorite ? 1 : 0, shop_name]);
    console.log('Update favorite for shop:', shop_name, 'is_favorite:', is_favorite, 'affected rows:', result.affectedRows);
    ctx.body = { success: true, data: { affectedRows: result.affectedRows } };
  } catch (error) {
    console.error('Failed to update favorite:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.put('/diet/:id', async (ctx) => {
  const { id } = ctx.params;
  const { record_date, meal_time, content, category, shop_name, review, cost } = ctx.request.body;
  try {
    // 如果填写了店铺名，查询该店铺是否已被收藏
    let isFavorite = null;
    if (shop_name) {
      const [favoriteRows] = await db.query(
        'SELECT is_favorite FROM diet_records WHERE shop_name = ? AND is_favorite = 1 LIMIT 1',
        [shop_name]
      );
      if (favoriteRows.length > 0) {
        isFavorite = 1;
      }
    }

    if (isFavorite !== null) {
      await db.query(
        `UPDATE diet_records SET record_date=?, meal_time=?, content=?, category=?, shop_name=?, review=?, cost=?, is_favorite=? WHERE id=?`,
        [record_date, meal_time, content, category, shop_name, review, cost, isFavorite, id]
      );
    } else {
      await db.query(
        `UPDATE diet_records SET record_date=?, meal_time=?, content=?, category=?, shop_name=?, review=?, cost=? WHERE id=?`,
        [record_date, meal_time, content, category, shop_name, review, cost, id]
      );
    }
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.put('/diet/:id/favorite', async (ctx) => {
  const { id } = ctx.params;
  const { is_favorite } = ctx.request.body;
  try {
    await db.query('UPDATE diet_records SET is_favorite = ? WHERE id = ?', [is_favorite ? 1 : 0, id]);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.delete('/diet/:id', async (ctx) => {
  try {
    await db.query('DELETE FROM diet_records WHERE id = ?', [ctx.params.id]);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// === 计划块 API ===
const ensureScheduleBlocksTable = async () => {
  try {
    await db.ready;
    await db.query(`
      CREATE TABLE IF NOT EXISTS schedule_blocks (
        id VARCHAR(36) PRIMARY KEY,
        block_date VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        start_time VARCHAR(10) NOT NULL,
        end_time VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_block_date (block_date)
      )
    `);
  } catch (err) {
    console.error('Failed to create schedule_blocks table:', err);
  }
};
ensureScheduleBlocksTable();

router.get('/schedule-blocks', async (ctx) => {
  try {
    const { start_date, end_date } = ctx.query;
    let query = 'SELECT * FROM schedule_blocks';
    let params = [];
    if (start_date && end_date) {
      query += ' WHERE block_date >= ? AND block_date <= ?';
      params.push(start_date, end_date);
    }
    query += ' ORDER BY block_date ASC, start_time ASC';
    const [rows] = await db.query(query, params);
    ctx.body = { success: true, data: rows };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.post('/schedule-blocks', async (ctx) => {
  const { block_date, content, start_time, end_time } = ctx.request.body;
  if (!block_date || !content || !start_time || !end_time) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少必要字段' };
    return;
  }
  const id = crypto.randomUUID();
  try {
    await db.query(
      'INSERT INTO schedule_blocks (id, block_date, content, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
      [id, block_date, content, start_time, end_time]
    );
    ctx.body = { success: true, data: { id } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.put('/schedule-blocks/:id', async (ctx) => {
  const { block_date, content, start_time, end_time } = ctx.request.body;
  try {
    const fields = [];
    const values = [];
    if (block_date !== undefined) { fields.push('block_date = ?'); values.push(block_date); }
    if (content !== undefined) { fields.push('content = ?'); values.push(content); }
    if (start_time !== undefined) { fields.push('start_time = ?'); values.push(start_time); }
    if (end_time !== undefined) { fields.push('end_time = ?'); values.push(end_time); }
    if (fields.length === 0) {
      ctx.status = 400;
      ctx.body = { success: false, message: '无更新字段' };
      return;
    }
    values.push(ctx.params.id);
    await db.query(`UPDATE schedule_blocks SET ${fields.join(', ')} WHERE id = ?`, values);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.delete('/schedule-blocks/:id', async (ctx) => {
  try {
    await db.query('DELETE FROM schedule_blocks WHERE id = ?', [ctx.params.id]);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.delete('/schedule-blocks/date/:date', async (ctx) => {
  try {
    await db.query('DELETE FROM schedule_blocks WHERE block_date = ?', [ctx.params.date]);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// ==================== 日程预设 API ====================
router.get('/schedule-presets', async (ctx) => {
  try {
    const [rows] = await db.query('SELECT id, name, items, sort_order FROM schedule_presets ORDER BY sort_order, created_at');
    ctx.body = {
      success: true,
      data: rows.map(row => ({
        id: row.id,
        name: row.name,
        items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
        sort_order: row.sort_order
      }))
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.post('/schedule-presets', async (ctx) => {
  const { name, items, sort_order = 0 } = ctx.request.body;
  if (!name || !Array.isArray(items)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '预设名称和时段数组不能为空' };
    return;
  }
  try {
    const id = crypto.randomUUID();
    await db.query(
      'INSERT INTO schedule_presets (id, name, items, sort_order) VALUES (?, ?, ?, ?)',
      [id, name, JSON.stringify(items), sort_order]
    );
    ctx.body = { success: true, data: { id, name, items, sort_order } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.put('/schedule-presets/:id', async (ctx) => {
  const { name, items, sort_order = 0 } = ctx.request.body;
  const { id } = ctx.params;
  if (!name || !Array.isArray(items)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '预设名称和时段数组不能为空' };
    return;
  }
  try {
    await db.query(
      'UPDATE schedule_presets SET name = ?, items = ?, sort_order = ? WHERE id = ?',
      [name, JSON.stringify(items), sort_order, id]
    );
    ctx.body = { success: true, data: { id, name, items, sort_order } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

router.delete('/schedule-presets/:id', async (ctx) => {
  try {
    await db.query('DELETE FROM schedule_presets WHERE id = ?', [ctx.params.id]);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

module.exports = router;