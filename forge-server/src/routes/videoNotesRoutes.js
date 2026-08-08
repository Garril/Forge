const Router = require('koa-router');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');
const crypto = require('crypto');
const db = require('../config/db');

const router = new Router({ prefix: '/api/video-notes' });
const API_PRESETS_KEY = 'video_notes_api_presets';
const defaultApiPresets = [
  { id: 'deepseek-official', name: 'DeepSeek 官方 API', apiBase: 'https://api.deepseek.com', apiMethod: 'responses', apiKey: '', model: 'deepseek-chat', prompt: '' },
  { id: 'sensenova', name: 'SenseNova API', apiBase: 'https://token.sensenova.cn/v1', apiMethod: 'chat-completions', apiKey: '', model: 'SenseChat-5', prompt: '' }
];
const normalizeApiPresets = presets => {
  const filtered = (Array.isArray(presets) ? presets : []).filter(item => item.id !== 'custom-openai-compatible' && item.name !== '其他 OpenAI 兼容服务');
  if (!filtered.some(item => item.id === 'sensenova')) {
    filtered.push({ ...defaultApiPresets[1], updatedAt: Date.now() });
  }
  return filtered.map(item => ({ ...item, apiMethod: item.apiMethod || 'responses' }));
};
const parseApiPresets = value => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};
const validApiPreset = preset => preset && String(preset.name || '').trim() && ['responses', 'chat-completions'].includes(preset.apiMethod || 'responses') && typeof preset.apiBase === 'string' && typeof preset.apiKey === 'string' && typeof preset.model === 'string' && typeof preset.prompt === 'string';
const readApiPresets = async () => {
  const [rows] = await db.query('SELECT setting_value FROM settings WHERE setting_key = ?', [API_PRESETS_KEY]);
  return rows.length ? parseApiPresets(rows[0].setting_value) : null;
};
const writeApiPresets = async presets => {
  const value = JSON.stringify(presets);
  await db.query('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [API_PRESETS_KEY, value, value]);
};

router.get('/api-presets', async ctx => {
  try {
    const storedPresets = await readApiPresets();
    let presets = storedPresets
      ? normalizeApiPresets(storedPresets)
      : defaultApiPresets.map(item => ({ ...item, updatedAt: Date.now() }));
    await writeApiPresets(presets);
    ctx.body = { success: true, data: presets };
  } catch (error) { ctx.status = 500; ctx.body = { success: false, message: error.message }; }
});
router.post('/api-presets', async ctx => {
  const body = ctx.request.body || {};
  if (!validApiPreset(body)) { ctx.status = 400; ctx.body = { success: false, message: '预设名称、Base URL、API Key、模型和提示词不能为空或类型不正确' }; return; }
  try {
    const presets = (await readApiPresets()) || [];
    const created = { id: body.id || `api-preset-${crypto.randomUUID()}`, name: String(body.name).trim(), apiBase: body.apiBase.trim(), apiMethod: body.apiMethod || 'responses', apiKey: body.apiKey, model: body.model.trim(), prompt: body.prompt, updatedAt: Date.now() };
    presets.push(created);
    await writeApiPresets(presets);
    ctx.status = 201; ctx.body = { success: true, data: created };
  } catch (error) { ctx.status = 500; ctx.body = { success: false, message: error.message }; }
});
router.put('/api-presets/:id', async ctx => {
  const body = ctx.request.body || {};
  if (!validApiPreset(body)) { ctx.status = 400; ctx.body = { success: false, message: '预设名称、Base URL、API Key、模型和提示词不能为空或类型不正确' }; return; }
  try {
    const presets = (await readApiPresets()) || [];
    const index = presets.findIndex(item => String(item.id) === String(ctx.params.id));
    if (index < 0) { ctx.status = 404; ctx.body = { success: false, message: '预设不存在' }; return; }
    const updated = { ...presets[index], ...body, id: presets[index].id, name: String(body.name).trim(), apiBase: body.apiBase.trim(), apiMethod: body.apiMethod || presets[index].apiMethod || 'responses', model: body.model.trim(), updatedAt: Date.now() };
    presets[index] = updated;
    await writeApiPresets(presets);
    ctx.body = { success: true, data: updated };
  } catch (error) { ctx.status = 500; ctx.body = { success: false, message: error.message }; }
});
router.delete('/api-presets/:id', async ctx => {
  try {
    const presets = (await readApiPresets()) || [];
    const next = presets.filter(item => String(item.id) !== String(ctx.params.id));
    if (next.length === presets.length) { ctx.status = 404; ctx.body = { success: false, message: '预设不存在' }; return; }
    await writeApiPresets(next);
    ctx.body = { success: true };
  } catch (error) { ctx.status = 500; ctx.body = { success: false, message: error.message }; }
});

const requestJson = (url, options = {}, body) => new Promise((resolve, reject) => {
  const request = https.request(url, { method: options.method || 'GET', headers: options.headers || {} }, response => {
    let data = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { data += chunk; });
    response.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(data); } catch { reject(new Error(`DeepSeek 返回了无效 JSON（${response.statusCode}）`)); return; }
      if (response.statusCode < 200 || response.statusCode >= 300) reject(new Error(parsed.error?.message || `DeepSeek 请求失败（${response.statusCode}）`));
      else resolve(parsed);
    });
  });
  request.setTimeout(30000, () => request.destroy(new Error('DeepSeek 请求超时')));
  request.on('error', reject);
  if (body) request.write(JSON.stringify(body));
  request.end();
});
const providerRequest = (baseUrl, apiMethod, apiKey, pathname, method = 'GET', body) => {
  const rawBase = String(baseUrl || 'https://api.deepseek.com').replace(/\/$/, '');
  const normalizedBase = apiMethod === 'chat-completions' ? rawBase : rawBase.replace(/\/v1$/, '');
  const url = `${normalizedBase}${pathname}`;
  return requestJson(url, { method, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }, body);
};
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const CAPTIONER_ROOT = path.join(PROJECT_ROOT, 'video-captioner');

const DATA_ROOT = path.join(__dirname, '../../public/video-notes');
const jobs = new Map();

fs.ensureDirSync(DATA_ROOT);

const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

const run = (command, args, options = {}) => new Promise((resolve, reject) => {
  const commandArgs = command === pythonCommand ? ['-X', 'utf8', ...args] : args;
  const child = spawn(command, commandArgs, {
    cwd: options.cwd || CAPTIONER_ROOT,
    windowsHide: true,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', data => {
    const text = data.toString();
    stdout += text;
    if (options.onStdout) options.onStdout(text);
  });
  child.stderr.on('data', data => {
    const text = data.toString();
    stderr += text;
    if (options.onStderr) options.onStderr(text);
  });
  child.on('error', reject);
  child.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr.trim() || stdout.trim() || `命令退出码 ${code}`)));
});

const COOKIE_ROOTS = [path.join(CAPTIONER_ROOT, 'AppData'), CAPTIONER_ROOT];
const isNetscapeCookieFile = file => {
  try {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'));
    return lines.length > 0 && lines.every(line => line.split('\t').length >= 7);
  } catch {
    return false;
  }
};
const resolveCookieFile = url => {
  let kind = '';
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('bilibili.com')) kind = 'cookies_bilbil.txt';
    if (hostname === 'youtu.be' || hostname.includes('youtube.com')) kind = 'cookies_ytb.txt';
  } catch {}
  if (!kind) return null;
  return COOKIE_ROOTS
    .map(root => path.join(root, kind))
    .find(file => fs.existsSync(file) && fs.statSync(file).size > 0 && isNetscapeCookieFile(file))
    || null;
};
const safeName = value => String(value || '').replace(/[^\w\-.\u4e00-\u9fa5 ]/g, '_').slice(0, 100) || 'video';
const job = (type, input = {}) => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  jobs.set(id, { id, type, status: 'running', progress: 0, message: '任务已开始', input, createdAt: new Date().toISOString() });
  return id;
};
const update = (id, patch) => jobs.set(id, { ...jobs.get(id), ...patch });
const executeJob = async (id, action) => {
  try { await action(); } catch (error) { update(id, { status: 'failed', message: error.message }); }
};

router.get('/status', async ctx => {
  const result = { python: false, package: false, ytDlp: false, ffmpeg: false, initialized: false, projectPath: CAPTIONER_ROOT };
  try { await run(pythonCommand, ['--version'], { cwd: PROJECT_ROOT }); result.python = true; } catch {}
  if (result.python) {
    try { await run(pythonCommand, ['-c', 'import videocaptioner'], { cwd: CAPTIONER_ROOT }); result.package = true; } catch {}
    try { await run(pythonCommand, ['-c', 'import yt_dlp'], { cwd: CAPTIONER_ROOT }); result.ytDlp = true; } catch {}
  }
  try { await run('ffmpeg', ['-version'], { cwd: PROJECT_ROOT }); result.ffmpeg = true; } catch {}
  result.initialized = result.python && result.package && result.ytDlp && result.ffmpeg;
  ctx.body = { success: true, data: result };
});

router.post('/initialize', async ctx => {
  try {
    await run(pythonCommand, ['-m', 'pip', 'install', '-e', CAPTIONER_ROOT], { cwd: PROJECT_ROOT });
    const status = { python: false, package: false, ytDlp: false, ffmpeg: false };
    await run(pythonCommand, ['--version'], { cwd: PROJECT_ROOT }); status.python = true;
    await run(pythonCommand, ['-c', 'import videocaptioner'], { cwd: CAPTIONER_ROOT }); status.package = true;
    await run(pythonCommand, ['-c', 'import yt_dlp'], { cwd: CAPTIONER_ROOT }); status.ytDlp = true;
    try {
      await run('ffmpeg', ['-version'], { cwd: PROJECT_ROOT });
      status.ffmpeg = true;
    } catch (err) {
      status.ffmpegError = err.message;
    }
    status.initialized = status.python && status.package && status.ytDlp && status.ffmpeg;
    ctx.body = { success: true, data: status, message: status.initialized ? '视频笔记命令行已初始化' : 'Python 依赖已安装，但 ffmpeg 尚未配置' };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { success: false, message: `初始化失败：${error.message}` };
  }
});

router.post('/parse', async ctx => {
  const { url } = ctx.request.body || {};
  if (!url) { ctx.status = 400; ctx.body = { success: false, message: '请输入视频链接' }; return; }
  const cookies = resolveCookieFile(url);
  const id = job('parse', { url, cookies: Boolean(cookies) });
  executeJob(id, async () => {
    update(id, { progress: 20, message: '正在解析视频信息' });
    const args = ['-m', 'videocaptioner', 'info', url];
    if (cookies) args.push('--cookies', cookies);
    const { stdout } = await run(pythonCommand, args);
    const info = Object.fromEntries(stdout.split(/\r?\n/).filter(Boolean).map(line => {
      const index = line.indexOf(':'); return index > -1 ? [line.slice(0, index).trim(), line.slice(index + 1).trim()] : [line, ''];
    }));
    update(id, { status: 'completed', progress: 100, message: '解析完成', result: info });
  });
  ctx.body = { success: true, data: { jobId: id } };
});

router.post('/download', async ctx => {
  const { url, title } = ctx.request.body || {};
  if (!url) { ctx.status = 400; ctx.body = { success: false, message: '请输入视频链接' }; return; }
  const cookies = resolveCookieFile(url);
  const folder = path.join(DATA_ROOT, `${Date.now()}-${safeName(title || 'video')}`);
  await fs.ensureDir(folder);
  const id = job('download', { url });
  executeJob(id, async () => {
    update(id, { progress: 1, message: '正在准备下载' });
    const args = ['-m', 'videocaptioner', 'download', url, '-o', folder];
    if (cookies) args.push('--cookies', cookies);
    await run(pythonCommand, args, {
      onStdout: text => {
        const match = text.match(/__DOWNLOAD_PROGRESS__:(\d+(?:\.\d+)?)/);
        if (match) update(id, { progress: Math.min(99, Math.round(Number(match[1]))), message: '正在下载视频' });
      },
    });
    const files = await fs.readdir(folder);
    const video = files.find(file => /\.(mp4|mkv|webm|mov)$/i.test(file));
    if (!video) throw new Error('下载完成但未找到视频文件');
    update(id, { status: 'completed', progress: 100, message: '下载完成', result: { folder, video: path.join(folder, video) } });
  });
  ctx.body = { success: true, data: { jobId: id } };
});

router.post('/transcribe', async ctx => {
  const { videoPath, language, model, device } = ctx.request.body || {};
  if (!videoPath) { ctx.status = 400; ctx.body = { success: false, message: '缺少视频路径' }; return; }
  const id = job('transcribe', { videoPath });
  executeJob(id, async () => {
    const output = videoPath.replace(/\.[^.]+$/, '.srt');
    update(id, { progress: 20, message: '正在提取音频并生成字幕' });
    const args = ['-m', 'videocaptioner', 'transcribe', videoPath, '-o', output];
    if (language) args.push('--language', language);
    if (model) args.push('--model', model);
    if (device) args.push('--device', device);
    await run(pythonCommand, args);
    update(id, { status: 'completed', progress: 100, message: 'SRT 字幕生成完成', result: { srtPath: output } });
  });
  ctx.body = { success: true, data: { jobId: id } };
});

router.get('/models', async ctx => {
  const { apiBase, apiMethod = 'responses', apiKey } = ctx.query;
  if (!apiKey) { ctx.status = 400; ctx.body = { success: false, message: '缺少 API Key' }; return; }
  try { ctx.body = { success: true, data: await providerRequest(apiBase, apiMethod, apiKey, '/models') }; }
  catch (error) { ctx.status = 502; ctx.body = { success: false, message: error.message }; }
});

router.get('/balance', async ctx => {
  const { apiBase, apiMethod = 'responses', apiKey } = ctx.query;
  if (!apiKey) { ctx.status = 400; ctx.body = { success: false, message: '缺少 API Key' }; return; }
  if (apiMethod === 'chat-completions') { ctx.body = { success: true, data: { balance_infos: [] } }; return; }
  try { ctx.body = { success: true, data: await providerRequest(apiBase, apiMethod, apiKey, '/user/balance') }; }
  catch (error) { ctx.status = 502; ctx.body = { success: false, message: error.message }; }
});

router.post('/summarize', async ctx => {
  const { inputPath, title, apiBase, apiMethod = 'responses', apiKey, model, prompt } = ctx.request.body || {};
  if (!inputPath) { ctx.status = 400; ctx.body = { success: false, message: '缺少字幕或文本路径' }; return; }
  const id = job('summarize', { inputPath });
  executeJob(id, async () => {
    const output = inputPath.replace(/\.[^.]+$/, '.md');
    update(id, { progress: 20, message: '正在调用 AI 生成 Markdown 笔记' });
    const args = ['-m', 'videocaptioner', 'summarize', inputPath, '-o', output, '--title', title || '视频笔记'];
    if (apiBase) args.push('--api-base', apiBase);
    args.push('--api-method', apiMethod === 'chat-completions' ? 'chat-completions' : 'responses');
    if (apiKey) args.push('--api-key', apiKey);
    if (model) args.push('--model', model);
    if (prompt) args.push('--prompt', prompt);
    await run(pythonCommand, args);
    update(id, { status: 'completed', progress: 100, message: 'Markdown 笔记生成完成', result: { markdownPath: output } });
  });
  ctx.body = { success: true, data: { jobId: id } };
});

router.get('/jobs/:id', ctx => {
  const item = jobs.get(ctx.params.id);
  if (!item) { ctx.status = 404; ctx.body = { success: false, message: '任务不存在' }; return; }
  ctx.body = { success: true, data: item };
});

router.get('/history', async ctx => {
  try {
    const folders = await fs.readdir(DATA_ROOT, { withFileTypes: true });
    const data = await Promise.all(folders.filter(item => item.isDirectory()).map(async item => {
      const folderPath = path.join(DATA_ROOT, item.name);
      const files = await fs.readdir(folderPath);
      const findFile = extension => files.find(file => extension.test(file));
      return {
        name: item.name,
        folderPath,
        videoPath: findFile(/\\.(mp4|mkv|webm|mov)$/i) ? path.join(folderPath, findFile(/\\.(mp4|mkv|webm|mov)$/i)) : '',
        srtPath: findFile(/\\.srt$/i) ? path.join(folderPath, findFile(/\\.srt$/i)) : '',
        markdownPath: findFile(/\\.md$/i) ? path.join(folderPath, findFile(/\\.md$/i)) : ''
      };
    }));
    ctx.body = { success: true, data: data.reverse() };
  } catch (error) { ctx.status = 500; ctx.body = { success: false, message: error.message }; }
});

router.delete('/history', async ctx => {
  const folderPath = path.resolve(ctx.request.body?.folderPath || '');
  const root = path.resolve(DATA_ROOT);
  if (!folderPath || !folderPath.startsWith(`${root}${path.sep}`)) { ctx.status = 403; ctx.body = { success: false, message: '非法文件夹路径' }; return; }
  try { await fs.remove(folderPath); ctx.body = { success: true, message: '历史记录已删除' }; }
  catch (error) { ctx.status = 500; ctx.body = { success: false, message: error.message }; }
});

router.get('/file', async ctx => {
  const filePath = ctx.query.path;
  if (!filePath) { ctx.status = 400; ctx.body = { success: false, message: '缺少文件路径' }; return; }
  const resolved = path.resolve(filePath);
  const root = path.resolve(DATA_ROOT);
  if (!resolved.startsWith(`${root}${path.sep}`)) { ctx.status = 403; ctx.body = { success: false, message: '非法文件路径' }; return; }
  ctx.type = path.extname(resolved);
  ctx.body = fs.createReadStream(resolved);
});

module.exports = router;
