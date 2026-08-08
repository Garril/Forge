const Router = require('koa-router');
const router = new Router({ prefix: '/api/files' });

// 文件管理路由预留
router.get('/', async (ctx) => {
  ctx.body = { success: true, message: 'File routes placeholder' };
});

module.exports = router;
