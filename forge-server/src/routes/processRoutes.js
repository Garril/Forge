const Router = require('koa-router');
const router = new Router({ prefix: '/api/processes' });
const db = require('../config/db');
const crypto = require('crypto');

// 确保 tasks 表有 sort_order 列
const ensureTasksSortOrder = async () => {
  try {
    await db.ready;
    await db.query(`
      CREATE TABLE IF NOT EXISTS processes (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        start_time DATETIME,
        deadline DATETIME,
        status TINYINT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(36) PRIMARY KEY,
        process_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        is_completed BOOLEAN DEFAULT FALSE,
        sort_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (process_id) REFERENCES processes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    const [columns] = await db.query('SHOW COLUMNS FROM tasks LIKE "sort_order"');
    if (columns.length === 0) {
      await db.query('ALTER TABLE tasks ADD COLUMN sort_order INT DEFAULT 0');
      console.log('Added sort_order column to tasks table');
    }
  } catch (err) {
    console.error('Failed to add sort_order to tasks:', err);
  }
};
ensureTasksSortOrder();

// 获取所有流程及其下属任务
router.get('/', async (ctx) => {
  const { status } = ctx.query;
  try {
    let query = 'SELECT * FROM processes';
    let params = [];
    if (status !== undefined && status !== '') {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC';
    const [processes] = await db.query(query, params);
    
    // 获取关联的任务（按 sort_order 排序）
    const [tasks] = await db.query('SELECT * FROM tasks ORDER BY sort_order ASC, created_at ASC');
    
    // 组装数据
    const data = processes.map(p => ({
      ...p,
      tasks: tasks.filter(t => t.process_id === p.id)
    }));
    
    ctx.body = { success: true, data };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 新建流程
router.post('/', async (ctx) => {
  const { name, start_time, deadline } = ctx.request.body;
  const id = crypto.randomUUID();
  try {
    await db.query(
      'INSERT INTO processes (id, name, start_time, deadline, status) VALUES (?, ?, ?, ?, 0)',
      [id, name, start_time, deadline]
    );
    ctx.body = { success: true, data: { id } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 更新流程
router.put('/:id', async (ctx) => {
  const { name, start_time, deadline } = ctx.request.body;
  try {
    await db.query(
      'UPDATE processes SET name = ?, start_time = ?, deadline = ? WHERE id = ?',
      [name, start_time, deadline, ctx.params.id]
    );
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 删除流程
router.delete('/:id', async (ctx) => {
  try {
    await db.query('DELETE FROM processes WHERE id = ?', [ctx.params.id]);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 归档流程
router.put('/:id/archive', async (ctx) => {
  try {
    await db.query('UPDATE processes SET status = 2 WHERE id = ?', [ctx.params.id]);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 取消归档流程
router.put('/:id/unarchive', async (ctx) => {
  try {
    // Check tasks to see if it should be 1 (completed) or 0 (active)
    const [allTasks] = await db.query('SELECT is_completed FROM tasks WHERE process_id = ?', [ctx.params.id]);
    const allCompleted = allTasks.length > 0 && allTasks.every(t => t.is_completed === 1 || t.is_completed === true);
    const newStatus = allCompleted ? 1 : 0;
    
    await db.query('UPDATE processes SET status = ? WHERE id = ?', [newStatus, ctx.params.id]);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 新增任务
router.post('/:processId/tasks', async (ctx) => {
  const { processId } = ctx.params;
  const { name } = ctx.request.body;
  const id = crypto.randomUUID();
  try {
    // 获取当前流程的最大 sort_order
    const [maxOrderResult] = await db.query(
      'SELECT MAX(sort_order) as maxOrder FROM tasks WHERE process_id = ?',
      [processId]
    );
    const sort_order = (maxOrderResult[0].maxOrder || 0) + 1;
    
    await db.query(
      'INSERT INTO tasks (id, process_id, name, is_completed, sort_order) VALUES (?, ?, ?, false, ?)',
      [id, processId, name, sort_order]
    );
    ctx.body = { success: true, data: { id, name } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 更新任务状态/内容
router.put('/tasks/:taskId', async (ctx) => {
  const { is_completed, name } = ctx.request.body;
  try {
    if (name !== undefined) {
      await db.query('UPDATE tasks SET name = ? WHERE id = ?', [name, ctx.params.taskId]);
    }
    
    if (is_completed !== undefined) {
      // 1. 更新当前任务状态
      await db.query('UPDATE tasks SET is_completed = ? WHERE id = ?', [is_completed, ctx.params.taskId]);
      
      // 2. 检查所属流程是否已全部完成
      const [taskInfo] = await db.query('SELECT process_id FROM tasks WHERE id = ?', [ctx.params.taskId]);
      if (taskInfo.length > 0) {
        const processId = taskInfo[0].process_id;
        const [allTasks] = await db.query('SELECT is_completed FROM tasks WHERE process_id = ?', [processId]);
        
        const allCompleted = allTasks.length > 0 && allTasks.every(t => t.is_completed === 1 || t.is_completed === true);
        const newStatus = allCompleted ? 1 : 0;
        
        // 更新流程状态 (如果是已归档2则不更新)
        await db.query('UPDATE processes SET status = ? WHERE id = ? AND status != 2', [newStatus, processId]);
      }
    }
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 删除任务
router.delete('/tasks/:taskId', async (ctx) => {
  try {
    await db.query('DELETE FROM tasks WHERE id = ?', [ctx.params.taskId]);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 批量更新任务排序
router.put('/:processId/tasks/sort', async (ctx) => {
  const { processId } = ctx.params;
  const { tasks } = ctx.request.body; // [{id: 'xx', sort_order: 1}, ...]
  
  if (!tasks || !Array.isArray(tasks)) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'Invalid payload' };
    return;
  }
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const task of tasks) {
      await connection.query(
        'UPDATE tasks SET sort_order = ? WHERE id = ? AND process_id = ?',
        [task.sort_order, task.id, processId]
      );
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

module.exports = router;