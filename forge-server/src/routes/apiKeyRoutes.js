const Router = require('koa-router');
const router = new Router({ prefix: '/api/api-keys' });
const db = require('../config/db');
const crypto = require('crypto');

// 获取所有API密钥
router.get('/', async (ctx) => {
  try {
    const { expireDays } = ctx.query;
    let query = 'SELECT * FROM api_keys WHERE 1=1';
    let params = [];
    
    // 过期时间筛选
    if (expireDays) {
      const days = parseInt(expireDays);
      if (!isNaN(days)) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);
        query += ' AND expire_date <= ? AND expire_date >= CURDATE()';
        params.push(futureDate.toISOString().split('T')[0]);
      }
    }
    
    query += ' ORDER BY created_at DESC';
    
    const [rows] = await db.query(query, params);
    
    // 解析 JSON 字段
    const formattedRows = rows.map(row => {
      let parsedModels = [];
      if (row.supported_models) {
        if (typeof row.supported_models === 'string') {
          try {
            parsedModels = JSON.parse(row.supported_models);
          } catch (e) {
            console.error('Error parsing supported_models:', e);
          }
        } else if (Array.isArray(row.supported_models)) {
          parsedModels = row.supported_models;
        } else {
          parsedModels = [row.supported_models]; // object etc
        }
      }
      return {
        ...row,
        supported_models: parsedModels
      };
    });
    
    ctx.body = { success: true, data: formattedRows };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 获取所有模型列表（用于筛选）
router.get('/models', async (ctx) => {
  try {
    const [rows] = await db.query('SELECT DISTINCT model FROM api_keys ORDER BY model');
    ctx.body = { success: true, data: rows.map(r => r.model) };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 添加API密钥
router.post('/', async (ctx) => {
  const {
    model, supported_models, api_key, purchase_date, expire_date,
    purchase_amount, price, official_url, purchase_channel, remark
  } = ctx.request.body;
  
  const id = crypto.randomUUID();
  
  // 处理空值：将空字符串转为null
  const safeValue = (val) => val === '' || val === undefined ? null : val;
  // 处理price：确保是有效数字，否则设为null
  let safePrice = null;
  if (price !== null && price !== undefined && price !== '') {
    const parsed = parseFloat(price);
    safePrice = isNaN(parsed) ? null : parsed;
  }
  
  // 处理 supported_models
  let safeSupportedModels = null;
  if (supported_models) {
    try {
      const parsed = typeof supported_models === 'string' ? JSON.parse(supported_models) : supported_models;
      safeSupportedModels = JSON.stringify(Array.isArray(parsed) ? parsed : []);
    } catch {
      safeSupportedModels = null;
    }
  }
  
  try {
    await db.query(`
      INSERT INTO api_keys (
        id, model, supported_models, api_key, purchase_date, expire_date,
        purchase_amount, price, official_url, purchase_channel, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, 
      model, 
      safeSupportedModels,
      api_key, 
      safeValue(purchase_date), 
      safeValue(expire_date), 
      safeValue(purchase_amount), 
      safePrice, 
      safeValue(official_url), 
      safeValue(purchase_channel), 
      safeValue(remark)
    ]);
    
    ctx.body = { success: true, data: { id } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

// 更新API密钥
router.put('/:id', async (ctx) => {
  try {
    const {
      model, supported_models, api_key, purchase_date, expire_date,
      purchase_amount, price, official_url, purchase_channel, remark
    } = ctx.request.body;
    
    // 处理空值：将空字符串转为null（但model和api_key不能为空，用空字符串代替）
    const safeValue = (val) => {
      if (val === '' || val === undefined) return null;
      return val;
    };
    const safeStringValue = (val) => {
      if (val === undefined || val === null) return '';
      return String(val);
    };
    
    // 处理price：确保是有效数字，否则设为null
    let safePrice = null;
    if (price !== null && price !== undefined && price !== '') {
      const parsed = parseFloat(price);
      safePrice = isNaN(parsed) ? null : parsed;
    }
    
    // 处理 supported_models - 确保始终是有效的JSON字符串
    let safeSupportedModels = '[]';
    if (supported_models) {
      try {
        const parsed = typeof supported_models === 'string' ? JSON.parse(supported_models) : supported_models;
        safeSupportedModels = JSON.stringify(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Error parsing supported_models:', e);
        safeSupportedModels = '[]';
      }
    } else if (supported_models === null || supported_models === undefined) {
      safeSupportedModels = '[]';
    }
    
    const [result] = await db.query(`
      UPDATE api_keys SET
        model = ?, supported_models = ?, api_key = ?, purchase_date = ?, expire_date = ?,
        purchase_amount = ?, price = ?, official_url = ?, purchase_channel = ?, remark = ?
      WHERE id = ?
    `, [
      safeStringValue(model), 
      safeSupportedModels,
      safeStringValue(api_key), 
      safeValue(purchase_date), 
      safeValue(expire_date), 
      safeValue(purchase_amount), 
      safePrice, 
      safeValue(official_url), 
      safeValue(purchase_channel), 
      safeValue(remark), 
      ctx.params.id
    ]);
    
    ctx.body = { success: true };
  } catch (error) {
    console.error('PUT /api-keys/:id - Error:', error);
    ctx.status = 500;
    ctx.body = { success: false, message: error.message, stack: error.stack };
  }
});

// 删除API密钥
router.delete('/:id', async (ctx) => {
  try {
    await db.query('DELETE FROM api_keys WHERE id = ?', [ctx.params.id]);
    ctx.body = { success: true };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: error.message };
  }
});

module.exports = router;
