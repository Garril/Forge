const Router = require('koa-router');
const path = require('path');
const { spawn } = require('child_process');

const router = new Router({ prefix: '/api/market' });
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const CAPTIONER_ROOT = path.join(PROJECT_ROOT, 'video-captioner');
const pythonCommand = process.env.PYTHON_COMMAND || (process.platform === 'win32' ? 'python' : 'python3');
const bridge = path.join(CAPTIONER_ROOT, 'videocaptioner', 'cli', 'mt5_bridge.py');

const runBridge = args => new Promise((resolve, reject) => {
  const child = spawn(pythonCommand, ['-X', 'utf8', bridge, ...args], {
    cwd: CAPTIONER_ROOT,
    windowsHide: true,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', data => { stdout += data.toString(); });
  child.stderr.on('data', data => { stderr += data.toString(); });
  child.on('error', error => reject(new Error(`Python bridge failed (${pythonCommand}): ${error.message}`)));
  child.on('close', code => {
    let result;
    try { result = JSON.parse(stdout.trim()); } catch { reject(new Error(stderr.trim() || `MT5 bridge returned invalid data (exit ${code})`)); return; }
    if (code !== 0 || !result.success) {
      const detail = result.detail ? ` (${result.detail})` : '';
      reject(new Error(`${result.message || stderr.trim() || `MT5 request failed (exit ${code})`}${detail}`));
    }
    else resolve(result);
  });
});

router.get('/status', async ctx => {
  try { ctx.body = await runBridge(['status']); }
  catch (error) { ctx.status = 503; ctx.body = { success: false, message: error.message }; }
});

router.get('/symbols', async ctx => {
  try { ctx.body = await runBridge(['symbols', '--limit', '500']); }
  catch (error) { ctx.status = 503; ctx.body = { success: false, message: error.message }; }
});

router.get('/bars', async ctx => {
  const symbol = String(ctx.query.symbol || '').trim();
  const timeframe = String(ctx.query.timeframe || 'M15').toUpperCase();
  const count = String(Math.min(Number(ctx.query.count) || 500, 5000));
  const start = String(Math.max(Number(ctx.query.start) || 0, 0));
  if (!symbol || !['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'].includes(timeframe)) {
    ctx.status = 400; ctx.body = { success: false, message: '参数错误：symbol 或 timeframe 无效' }; return;
  }
  try { ctx.body = await runBridge(['bars', symbol, timeframe, '--count', count, '--start', start]); }
  catch (error) { ctx.status = 503; ctx.body = { success: false, message: error.message }; }
});

router.get('/tick', async ctx => {
  const symbol = String(ctx.query.symbol || '').trim();
  if (!symbol) { ctx.status = 400; ctx.body = { success: false, message: '缺少 symbol 参数' }; return; }
  try { ctx.body = await runBridge(['tick', symbol]); }
  catch (error) { ctx.status = 503; ctx.body = { success: false, message: error.message }; }
});

router.post('/scan-patterns', async ctx => {
  const body = ctx.request.body || {};
  const currentSymbol = String(body.currentSymbol || '').trim();
  const excludeCurrent = body.excludeCurrent !== false;
  const requestedSymbols = Array.isArray(body.symbols) ? body.symbols.map(item => String(item).trim()).filter(Boolean) : [];
  const timeframes = Array.isArray(body.timeframes) ? body.timeframes.map(item => String(item).toUpperCase()).filter(item => ['M1', 'M5', 'M15', 'H1'].includes(item)) : ['M1', 'M5', 'M15', 'H1'];
  const scanCount = Math.max(120, Math.round(Number(body.scanCount) || 200));
  const symbols = [...new Set(requestedSymbols)].filter(item => !excludeCurrent || item !== currentSymbol);
  if (!symbols.length) { ctx.body = { success: true, datasets: [], scanned: 0 }; return; }
  const tasks = symbols.flatMap(symbol => timeframes.map(timeframe => ({ symbol, timeframe })));
  const datasets = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      try {
        const result = await runBridge(['bars', task.symbol, task.timeframe, '--count', String(scanCount), '--start', '0']);
        if (Array.isArray(result.bars) && result.bars.length) datasets.push({ symbol: task.symbol, timeframe: task.timeframe, bars: result.bars });
      } catch {}
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, tasks.length) }, worker));
  ctx.body = { success: true, datasets, scanned: tasks.length };
});

module.exports = router;
