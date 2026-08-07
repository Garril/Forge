const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const dotenv = require('dotenv');
const serve = require('koa-static');
const path = require('path');
const cors = require('@koa/cors');

// Import routes
const settingsRoutes = require('./routes/settingsRoutes');
const planRoutes = require('./routes/planRoutes');
const passwordRoutes = require('./routes/passwordRoutes');
const memoRoutes = require('./routes/memoRoutes');
const marketRoutes = require('./routes/marketRoutes');
const boardAnalysisRoutes = require('./routes/boardAnalysisRoutes');
const aiRoutes = require('./routes/aiRoutes');

// 导入定期任务执行函数
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = new Koa();
const router = new Router();

app.use(cors());
app.use(bodyParser());
app.use(serve(path.join(__dirname, '../public')));

// 注册保留模块路由
app.use(settingsRoutes.routes()).use(settingsRoutes.allowedMethods());
app.use(planRoutes.routes()).use(planRoutes.allowedMethods());
app.use(passwordRoutes.routes()).use(passwordRoutes.allowedMethods());
app.use(memoRoutes.routes()).use(memoRoutes.allowedMethods());
app.use(marketRoutes.routes()).use(marketRoutes.allowedMethods());
app.use(boardAnalysisRoutes.routes()).use(boardAnalysisRoutes.allowedMethods());
app.use(aiRoutes.routes()).use(aiRoutes.allowedMethods());

app.on('error', (err, ctx) => {
  if (err.code === 'ECONNABORTED' || err.code === 'ECONNRESET') {
    // 忽略客户端断开连接的报错，避免刷屏
    return;
  }
  console.error('Server error', err, ctx);
});

const PORT = process.env.PORT || 5888;
app.listen(PORT, () => {
  // console.log(`Forge Server is running on port ${PORT}`);
  
});
