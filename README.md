# Forge 项目文档与二次开发说明

> 本文档面向维护者、二次开发人员以及需要借助 AI 理解和修改 Forge 的开发者。
>
> 文档以当前代码为准。修改接口、数据库键名或页面流程后，应同步更新本文档。

## 1. 项目概览

Forge 是一个基于 Electron 的桌面工作台，前端使用 Vue 3，后端使用 Node.js + Koa，数据保存于 MySQL。当前主要功能包括：

- 日常规划：计划、任务、日历事件、归档与恢复；
- 视频笔记：视频解析、下载、转录、AI 总结、历史记录；
- 盘面分析：通过 MetaTrader 5 获取行情，绘制 K 线，配置指标，录入和扫描 K 线结构，调用 AI 分析行情；
- 备忘录：富文本/Markdown 内容、附件、随机展示；
- 资源、配方、流程管理；
- 系统设置：用户信息、头像、背景、锁屏、AI 配置等；
- Electron 文件能力：目录读取、批量重命名、系统通知、确认框、打开文件位置。

Forge 不直接在前端连接数据库。浏览器端通过 HTTP 调用 Koa API；Koa 后端负责数据库、文件系统、Python 子进程和第三方服务调用。

## 2. 技术栈与目录

### 2.1 技术栈

| 层级 | 技术 |
|---|---|
| 桌面容器 | Electron |
| 前端 | Vue 3、Vue Router、Pinia、Element Plus、Vite、Axios |
| 后端 | Node.js、Koa、koa-router、MySQL、Multer |
| 行情 | Python `video-captioner/videocaptioner/cli/mt5_bridge.py`，通过 MetaTrader 5 获取数据 |
| 视频处理 | Python `video-captioner`、yt-dlp、转录/总结依赖 |
| 配置 | `.env`、数据库 `settings` 表、前端配置文件 |

### 2.2 目录结构

```text
Forge/
├─ forge-client/                 Vue + Electron 前端
│  ├─ src/
│  │  ├─ views/                  业务页面
│  │  ├─ layout/                 主布局
│  │  ├─ store/                  Pinia 状态
│  │  ├─ router/                 路由
│  │  └─ main.js                 前端入口
│  ├─ electron/
│  │  ├─ main.js                 Electron 主进程
│  │  └─ preload.js              安全暴露 IPC API
│  └─ package.json
├─ forge-server/                 Koa 后端
│  ├─ src/
│  │  ├─ app.js                  服务入口与路由挂载
│  │  ├─ config/db.js            MySQL 连接池
│  │  └─ routes/                 API 路由
│  ├─ public/                    上传文件和静态资源
│  └─ package.json
├─ video-captioner/              Python 视频笔记与 MT5 桥接
│  ├─ videocaptioner/cli/
│  │  ├─ main.py                 视频 CLI
│  │  └─ mt5_bridge.py           MT5 行情 CLI
│  ├─ cookies_bilbil.txt         Bilibili cookie
│  └─ cookies_ytb.txt            YouTube cookie
├─ setup-python.ps1              Python 依赖安装脚本
├─ package.json                  根目录脚本
└─ FORGE_PROJECT_GUIDE.md        本文档
```

## 3. 启动、构建与环境配置

### 3.1 环境要求

- Windows 环境优先；
- Node.js 与 npm；
- Python；
- MySQL 8.x 或兼容版本；
- MetaTrader 5 客户端及可用行情连接（盘面分析需要）；
- 视频笔记需要对应 Python 依赖，下载多媒体格式时通常还需要 ffmpeg；
- 如果使用 Bilibili 或 YouTube 视频，需要有效的 Netscape 格式 cookie 文件。

### 3.2 后端环境变量

在 `forge-server/.env` 中配置，模板见 `forge-server/.env.example`：

```env
PORT=5888
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=forge_db
JWT_SECRET=forge_secret_key_2026
```

不要把真实密码、API Key、cookie 或 Token 提交到 Git。

### 3.3 常用命令

```powershell
# 安装根目录依赖
npm install

# 安装前端依赖
Set-Location forge-client
npm install

# 安装后端依赖
Set-Location ../forge-server
npm install

# 启动后端
npm run dev

# 启动前端开发环境
Set-Location ../forge-client
npm run dev

# 前端构建
npm run build
```

实际可用脚本以各目录 `package.json` 为准。开发时通常需要同时启动 Koa 后端和 Vite 前端；Electron 开发入口由 `forge-client/electron/main.js` 加载 Vite 地址，生产环境加载 `forge-client/dist/index.html`。

后端默认地址：`http://127.0.0.1:5888`。前端的 API 基地址应与该地址一致。

### 3.4 数据库

数据库连接由 `forge-server/src/config/db.js` 创建。`settings` 表用于保存大量 JSON 配置；部分业务表会在路由首次使用时通过 `CREATE TABLE IF NOT EXISTS` 初始化，例如 `memos`。

部署新环境时应：

1. 创建数据库 `forge_db`；
2. 配置 `.env`；
3. 执行项目提供的初始化 SQL（若当前分支有 `sql/init.sql`）；
4. 启动后端，让运行时迁移补齐必要表和设置；
5. 登录页面后检查系统设置、AI 配置和盘面分析配置。

## 4. 前端页面与路由

前端路由定义在 `forge-client/src/router/index.js`：

| 路径 | 页面 | 用途 |
|---|---|---|
| `/` | `views/Settings/LockScreen.vue` | 锁屏页；根据 `lock_enabled` 决定启动时是否进入 |
| `/dashboard/plan` | `views/Plan/index.vue` | 日常规划、任务和日历 |
| `/dashboard/video-notes` | `views/VideoNotes/index.vue` | 视频笔记流水线 |
| `/dashboard/board-analysis` | `views/BoardAnalysis/index.vue` | 行情、指标、K 线结构与 AI 分析 |
| `/dashboard/settings` | `views/Settings/index.vue` | 系统设置 |

主布局为 `forge-client/src/layout/index.vue`。全局设置状态主要在 `forge-client/src/store/settings.js`。应用入口 `src/main.js` 会先加载设置，再挂载 Vue；锁屏关闭时将根路径导向 `/dashboard`。

## 5. HTTP API 总览

所有业务接口默认前缀为 `http://127.0.0.1:5888`。响应通常采用以下格式：

```json
{ "success": true, "data": {} }
```

失败通常返回：

```json
{ "success": false, "message": "错误说明" }
```

### 5.1 盘面分析 API

实现文件：`forge-server/src/routes/boardAnalysisRoutes.js`。

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/board-analysis/config` | 获取盘面偏好、自定义指标、K 线结构模板 |
| `PUT` | `/api/board-analysis/config` | 整体保存盘面配置 |
| `GET` | `/api/board-analysis/patterns` | 获取 K 线结构模板 |
| `POST` | `/api/board-analysis/patterns` | 新增 K 线结构模板 |
| `PUT` | `/api/board-analysis/patterns/:id` | 修改结构模板 |
| `DELETE` | `/api/board-analysis/patterns/:id` | 删除结构模板 |

K 线结构模板至少需要 `name` 和非空 `bars`。模板通常还包含：

```json
{
  "name": "结构名称",
  "inverseName": "镜像结构名称",
  "beforeTrend": "any|up|down",
  "afterTrend": "any|up|down",
  "trendBars": 8,
  "bars": [],
  "editorBars": [],
  "relationships": [],
  "enabled": true
}
```

数据最终保存在 `settings` 表的 `board_analysis_pattern_templates` 键中。

### 5.2 行情与扫描 API

实现文件：`forge-server/src/routes/marketRoutes.js`。

| 方法 | 路径 | 关键参数 | 用途 |
|---|---|---|---|
| `GET` | `/api/market/status` | 无 | 检查 Python/MT5 桥接状态 |
| `GET` | `/api/market/symbols` | 无 | 获取可用品种 |
| `GET` | `/api/market/bars` | `symbol`、`timeframe`、`count`、`start` | 获取历史 K 线 |
| `GET` | `/api/market/tick` | `symbol` | 获取实时 Tick/Bid/Ask |
| `POST` | `/api/market/scan-patterns` | `symbols`、`currentSymbol`、`excludeCurrent`、`timeframes`、`scanCount` | 批量获取多个品种和周期的数据，供前端扫描 K 线结构 |

允许的行情周期包括：`M1`、`M5`、`M15`、`M30`、`H1`、`H4`、`D1`、`W1`、`MN1`。

K 线结构批量扫描默认周期为：`M1`、`M5`、`M15`、`H1`；默认数量为 200，最少 120。扫描接口只负责获取数据集，实际结构匹配在前端盘面分析逻辑中完成。

### 5.3 AI API

实现文件：`forge-server/src/routes/aiRoutes.js`。

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/ai/chat` | 使用系统 AI 配置向模型发送聊天/分析请求 |
| `GET` | `/api/ai/config` | 获取 AI 配置状态或配置摘要 |
| `PUT` | `/api/ai/config` | 保存 AI 配置 |

AI 配置通常包括 API Key、Base URL、模型名称等。敏感 Key 不应写入日志、文档或提交记录。盘面分析页面会先整理行情上下文，再调用 AI 接口；AI 不直接访问 MT5。

### 5.4 系统设置 API

实现文件：`forge-server/src/routes/settingsRoutes.js`。

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/settings` | 读取全部系统设置 |
| `POST` | `/api/settings` | 保存一个或多个设置 |
| `PUT` | `/api/settings` | 更新设置 |
| `POST` | `/api/settings/unlock` | 解锁/处理锁屏密码 |
| `POST` | `/api/settings/verify-password` | 校验锁屏密码 |
| `POST` | `/api/settings/upload-avatar` | 上传头像 |
| `POST` | `/api/settings/upload-bg` | 上传背景 |
| `POST` | `/api/settings/upload-bg-multi` | 批量上传背景 |
| `GET` | `/api/settings/bgs` | 获取背景列表 |
| `DELETE` | `/api/settings/bgs/:filename` | 删除背景 |

锁屏开关使用：

```text
setting_key   = lock_enabled
setting_value = true 或 false
```

默认值为 `false`，即默认直接进入主页面。关闭时，主布局隐藏手动锁屏入口，前端也忽略快捷键锁屏事件。

### 5.5 备忘录 API

实现文件：`forge-server/src/routes/memoRoutes.js`。

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/memos` | 获取备忘录列表 |
| `GET` | `/api/memos/:id` | 获取单条备忘录 |
| `POST` | `/api/memos` | 创建备忘录 |
| `PUT` | `/api/memos/:id` | 更新备忘录 |
| `DELETE` | `/api/memos/:id` | 删除备忘录及附件 |
| `POST` | `/api/memos/upload` | 上传附件 |
| `DELETE` | `/api/memos/attachments/:filename` | 删除附件 |
| `GET` | `/api/memos/random/:count` | 获取随机展示的备忘录 |
| `GET` | `/api/memos/settings/random-count` | 获取随机展示数量 |
| `PUT` | `/api/memos/settings/random-count` | 保存随机展示数量 |

备忘录表会在路由初始化时自动创建，主要字段为：`title`、`content`、`attachments`、`display_type`、`random_count`、创建时间和更新时间。

### 5.6 计划、流程、资源和配方 API

对应实现文件：`planRoutes.js`、`processRoutes.js`、`resourceRoutes.js`、`recipeRoutes.js`。

| 模块 | 主要接口 |
|---|---|
| 计划 | `GET/POST /api/plans`、`PUT/DELETE /api/plans/:id`、`GET/POST/DELETE /api/plans/events` |
| 流程 | `GET/POST /api/processes`、`PUT/DELETE /api/processes/:id`、`PUT /api/processes/:id/archive`、`PUT /api/processes/:id/unarchive` |
| 流程任务 | `POST /api/processes/:processId/tasks`、`PUT/DELETE /api/processes/tasks/:taskId`、`PUT /api/processes/:processId/tasks/sort` |
| 资源 | `GET/POST /api/resources`、`PUT/DELETE /api/resources/:id`、`POST /api/resources/migrate-paths` |
| 配方 | `GET/POST /api/recipes`、`PUT/DELETE /api/recipes/:id`、`POST /api/recipes/upload-image` |

完整参数以对应路由文件和调用页面为准。新增接口时应保持统一的 `success/data/message` 响应格式。

### 5.7 文件、Markdown、账本和其他 API

| 路由文件 | 前缀/用途 |
|---|---|
| `fileRoutes.js` | 文件路径或文件访问相关接口 |
| `markdownRoutes.js` | Markdown 内容处理和渲染 |
| `ledgerRoutes.js` | 账本/收支数据 |
| `passwordRoutes.js` | 密码相关接口 |
| `apiKeyRoutes.js` | API Key 管理 |
| `alarmWaterRoutes.js` | 提醒/饮水等相关功能 |
| `uploadRoutes.js` | Markdown 图片、习惯图标、画布图片上传 |
| `videoNotesRoutes.js` | 视频笔记初始化、解析、下载、转录、总结和历史 |

这些路由的精确方法、参数和响应请直接查看 `forge-server/src/routes/` 下的同名文件；路由文件顶部的 `prefix` 是接口前缀，`router.get/post/put/delete` 是完整接口定义。

## 6. 视频笔记流程

页面：`forge-client/src/views/VideoNotes/index.vue`。

后端：`forge-server/src/routes/videoNotesRoutes.js`。

典型流程：

1. 调用 `/status` 检查 Python、依赖和视频处理环境；
2. 调用 `/initialize` 初始化/检查视频笔记环境；
3. 调用 `/parse` 获取视频标题、时长和可用格式；
4. 调用 `/download` 下载视频或音频；
5. 调用 `/transcribe` 生成字幕/SRT；
6. 调用 `/summarize` 使用 AI 生成 Markdown 笔记；
7. 通过 `/jobs/:id` 查询异步任务；
8. 通过 `/history` 获取或删除历史记录。

Bilibili cookie 文件名为 `cookies_bilbil.txt`，YouTube cookie 文件名为 `cookies_ytb.txt`。后端会根据视频地址选择 cookie 文件。文件必须是有效的 Netscape cookie 格式，空文件不能完成鉴权。

Python CLI 定义见 `video-captioner/videocaptioner/cli/main.py`。后端通过 `child_process.spawn` 启动 Python，工作目录通常为 `video-captioner`，并设置 UTF-8 环境变量。

## 7. 盘面分析详细规则

页面核心文件：`forge-client/src/views/BoardAnalysis/index.vue`。

### 7.1 行情获取

前端通过 `/api/market/symbols` 获取品种，通过 `/api/market/bars` 获取 K 线，通过 `/api/market/tick` 获取当前报价。行情由 Python MT5 桥接程序提供，桥接入口为 `mt5_bridge.py`。

### 7.2 自定义指标

自定义指标保存在 `settings` 表：

```text
board_analysis_custom_indicators
```

项目会保留内置 `Bar Count` 指标。指标设置可包括 EMA、MACD、RSI、布林带及其他页面支持的参数。新增指标时应同时更新：

- 前端配置编辑 UI；
- 指标计算逻辑；
- AI 分析上下文构造；
- 配置迁移和默认值。

### 7.3 K 线结构录入

录入结构保存每根 K 线的 OHLC，并生成相对形态特征：

- 阳线/阴线方向；
- 实体占整根振幅比例；
- 上影线比例；
- 下影线比例；
- 收盘价在整根 K 线中的位置。

匹配时不会比较绝对价格，而是比较相对形状。多根 K 线还会比较实体大小关系、吞没关系和高低点顺序。

系统使用滑动窗口扫描行情。例如模板有 3 根 K 线，就检查第 1~3 根、第 2~4 根、第 3~5 根等连续窗口。默认允许偏差值约为 `0.18`；偏差越小越严格，偏差越大越宽松。

### 7.4 镜像结构

自动生成结构以整组价格区间的水平中线进行上下镜像：

- K 线左右顺序不变；
- `high` 和 `low` 上下镜像；
- `open` 和 `close` 分别镜像，因此阳线变阴线、阴线变阳线；
- 镜像结构只读显示，但参与扫描匹配；
- 镜像画布与录入画布应使用一致的显示边界，避免视觉比例不一致。

### 7.5 扫描品种与周期

批量扫描接口默认为：

- 周期：`M1`、`M5`、`M15`、`H1`；
- 每个品种/周期：200 根 K 线；
- 最少扫描数量：120 根；
- 批量并发上限：最多 8 个 worker。

“扫描自选品种”和“扫描其他品种”的周期相同，区别是传入的品种集合不同，以及是否排除当前品种。

### 7.6 AI 行情分析输入

底部 AI 分析由前端整理上下文后调用 `/api/ai/chat`。通常包括：

- 当前品种、当前周期和最新报价；
- 当前周期及多周期历史 K 线摘要；
- 已启用指标的最新值；
- ICT/SMC 结构摘要（若页面已计算）；
- K 线结构匹配结果；
- 批量扫描结果摘要（若已执行扫描）。

AI 只分析传入的行情上下文，不直接访问 MT5，不读取未发送的新闻或账户信息，也不会自动执行交易。若要变更 AI 输入，搜索页面中的 AI 请求函数和上下文构造对象，同时检查后端 `aiRoutes.js`。

## 8. Electron IPC

安全桥接定义在 `forge-client/electron/preload.js`，实现定义在 `forge-client/electron/main.js`。渲染进程不能直接使用 Node.js API，应通过 `window.electronAPI`。

### 8.1 已暴露方法

| 方法 | 用途 |
|---|---|
| `getDirname()` | 获取 preload 所在目录 |
| `joinPath(...args)` | 拼接路径 |
| `sendMessage(channel, data)` | 发送 IPC 消息 |
| `invokeAction(channel, args)` | 通用 IPC 调用 |
| `onReply(channel, callback)` | 监听 IPC 回复 |
| `readDirectory(path, options)` | 读取目录并统计图片大小 |
| `batchRename(data)` | 批量重命名 |
| `renameFile(data)` | 单文件重命名 |
| `batchRenameV2(data)` | 按指定顺序批量重命名 |
| `showConfirmDialog(options)` | 显示确认框 |
| `showSystemNotification(options)` | 显示系统通知 |
| `updateLockShortcut(old, new)` | 更新锁屏快捷键 |
| `onLockScreen(callback)` | 监听锁屏事件 |

Electron 主进程还提供 `show-in-folder` 等 IPC handler，可通过 `invokeAction` 调用。

### 8.2 IPC 注意事项

- 渲染进程通过 preload 暴露的白名单方法访问系统能力；
- 不要在 Vue 页面中直接引入 `fs`、`path` 或 `electron`；
- IPC 传递 Pinia/Vue Proxy 数据前，使用 `JSON.parse(JSON.stringify(value))` 转成普通对象；
- 文件操作必须处理路径不存在、权限不足和目标文件已存在；
- 新增 IPC 时，同时修改 `preload.js` 和 `main.js`，并在页面中补充失败提示。

## 9. 数据持久化与设置键

### 9.1 settings 表

`settings` 是键值表，适合保存页面配置和 JSON 数组。当前重要键包括：

| 键 | 内容 |
|---|---|
| `lock_enabled` | 是否启用启动锁屏，`true/false` |
| `lock_shortcut` | 锁屏快捷键 |
| `user_name` | 用户名 |
| `user_avatar` | 用户头像路径 |
| `is_dark` | 深色主题开关 |
| `board_analysis_preferences` | 盘面分析偏好 |
| `board_analysis_custom_indicators` | 自定义指标数组 |
| `board_analysis_pattern_templates` | K 线结构模板数组 |
| `memo_random_count` | 随机备忘录展示数量 |
| AI 配置相关键 | API Key、Base URL、模型等，具体以 `settingsRoutes.js` 为准 |

不要把复杂页面状态随意拆成多个不兼容键。新增键时应提供默认值、读取逻辑、保存逻辑和旧版本迁移逻辑。

### 9.2 文件存储

上传文件主要位于 `forge-server/public/` 下的对应目录。API 返回的文件 URL 通常以后端地址为前缀。修改上传目录时要同步修改：

- Multer storage destination；
- 静态目录挂载；
- 删除旧文件逻辑；
- 前端显示 URL；
- 迁移脚本或路径迁移接口。

## 10. 二次开发指南

### 10.1 推荐修改顺序

1. 先定位页面组件和对应 API 路由；
2. 确认数据来源：数据库、MT5、Python、文件系统还是外部 API；
3. 先设计响应数据结构和错误格式；
4. 修改后端接口；
5. 再修改前端请求、状态和 UI；
6. 为旧数据补充默认值或迁移；
7. 执行语法检查、lint 和构建；
8. 手动验证首次启动、空数据、错误请求和已有数据升级。

### 10.2 新增页面

- 在 `forge-client/src/views/` 新建页面；
- 在 `src/router/index.js` 添加路由；
- 如需侧边栏入口，修改 `src/layout/index.vue`；
- API 请求放在页面或公共 API 模块中，统一处理错误；
- 需要持久化的配置优先使用后端 `settings` 表，不要只存 localStorage。

### 10.3 新增后端接口

- 在 `forge-server/src/routes/` 增加路由文件或扩展现有模块；
- 在 `forge-server/src/app.js` 挂载路由；
- 使用参数校验和明确的 HTTP 状态码；
- 统一返回 `{ success, data, message }`；
- 数据库写入使用参数化 SQL；
- 涉及文件时校验路径和文件名，避免路径穿越；
- 涉及异步进程时监听 `error` 和 `close`，并处理超时/非零退出码。

### 10.4 修改 K 线扫描

不要只修改画布绘制。K 线结构通常同时涉及：

- 录入数据；
- OHLC 归一化；
- 镜像结构生成；
- 关系特征；
- 滑动窗口匹配；
- 趋势过滤；
- 当前图表标记；
- 批量扫描结果；
- AI 上下文。

修改镜像规则后，必须同时检查画布显示、保存模板、当前图表扫描和批量扫描四条链路。

## 11. 调试与常见问题

### 11.1 页面白屏或 API 失败

- 确认后端是否监听 `5888`；
- 确认前端 API 基地址不是错误的 `localhost`/端口；
- 检查浏览器开发者工具 Network 和 Console；
- 检查 Koa 路由是否已在 `app.js` 挂载；
- 检查 MySQL 连接和数据库名称。

### 11. K 线结构保存失败

- 结构名称不能为空；
- 至少需要一根 K 线；
- 每根 K 线的 `high >= max(open, close)`；
- 每根 K 线的 `low <= min(open, close)`；
- `high > low`；
- 检查 `POST/PUT /api/board-analysis/patterns` 的响应；
- 检查 `settings` 表中的 `board_analysis_pattern_templates` 是否可写。

### 11. 批量扫描没有结果

- MT5 桥接状态必须正常；
- 品种名称必须是 MT5 返回的真实名称；
- 所选周期必须属于 `M1/M5/M15/H1`；
- 数据数量不足时，趋势过滤可能无法通过；
- 结构模板必须启用且长度不超过行情数据量；
- 批量接口会忽略单个品种获取失败的任务，需要查看前端汇总和后端日志。

### 11. 视频下载/转录失败

- 检查 Python 和依赖；
- 检查 cookie 文件是否存在且不是空文件；
- cookie 必须为 Netscape 格式；
- 检查视频 URL 对应的 cookie 文件选择；
- 需要合并多格式时检查 ffmpeg 是否已安装并在运行进程可见的 PATH 中；
- 检查 `videoNotesRoutes.js` 启动 Python 的命令和工作目录。

### 11. 锁屏行为异常

- 检查 `settings.lock_enabled` 是否为字符串 `true` 或 `false`；
- 前端启动必须先执行 `settingsStore.loadSettings()`；
- 检查 `App.vue` 的锁屏事件守卫；
- 检查 `layout/index.vue` 是否根据开关隐藏手动锁屏入口；
- 修改快捷键时同时检查 Electron 主进程注册和 preload 暴露。

## 12. 给 AI 二次开发时的推荐提示词

将本文件连同要修改的文件一起提供给 AI，并明确以下内容：

```text
这是 Forge 项目。请先阅读 FORGE_PROJECT_GUIDE.md，再阅读我指定的页面、路由和数据文件。
不要猜测接口；以当前代码为准。
先说明影响范围和数据流，再进行最小范围修改。
保留现有接口兼容性、数据库旧数据和错误处理。
修改后执行相关文件的 lint、语法检查和构建。
不要修改与需求无关的文件，不要提交密钥、cookie 或生成文件。
```

如果任务与盘面分析有关，额外提供：

```text
重点检查 BoardAnalysis 页面、marketRoutes.js、boardAnalysisRoutes.js、aiRoutes.js 和 mt5_bridge.py。
K 线结构的录入、镜像生成、归一化、匹配、扫描和 AI 上下文必须保持一致。
```

如果任务与视频笔记有关，额外提供：

```text
重点检查 VideoNotes 页面、videoNotesRoutes.js、video-captioner/videocaptioner/cli/main.py。
不要读取或输出 cookie 内容、API Key 或 Token。
```

## 13. 关键文件索引

| 文件 | 职责 |
|---|---|
| `forge-client/src/views/BoardAnalysis/index.vue` | 行情、指标、K 线结构、扫描和 AI 分析主页面 |
| `forge-client/src/views/VideoNotes/index.vue` | 视频笔记主页面 |
| `forge-client/src/views/Settings/index.vue` | 系统设置页面 |
| `forge-client/src/store/settings.js` | 全局设置状态和持久化 |
| `forge-client/src/router/index.js` | 页面路由 |
| `forge-client/src/layout/index.vue` | 主布局和侧边栏 |
| `forge-client/src/main.js` | Vue 启动、设置加载和启动跳转 |
| `forge-client/src/App.vue` | 全局锁屏事件 |
| `forge-client/electron/main.js` | Electron 窗口、IPC 和快捷键 |
| `forge-client/electron/preload.js` | IPC 安全桥接 |
| `forge-server/src/app.js` | Koa 启动和路由挂载 |
| `forge-server/src/config/db.js` | MySQL 连接池 |
| `forge-server/src/routes/marketRoutes.js` | MT5 行情、K 线和批量扫描数据 |
| `forge-server/src/routes/boardAnalysisRoutes.js` | 盘面配置和结构模板 CRUD |
| `forge-server/src/routes/aiRoutes.js` | AI 请求和 AI 配置 |
| `forge-server/src/routes/settingsRoutes.js` | 系统设置、锁屏和文件上传 |
| `forge-server/src/routes/videoNotesRoutes.js` | 视频笔记后端流程 |
| `forge-server/src/routes/memoRoutes.js` | 备忘录及附件 |
| `video-captioner/videocaptioner/cli/mt5_bridge.py` | Python MT5 数据桥接 |
| `video-captioner/videocaptioner/cli/main.py` | 视频笔记 Python CLI |

---

**文档维护规则：** 新增页面、API、数据库键、IPC 方法或 Python 子命令时，应在本文档对应章节补充说明；删除接口时也应同步删除文档中的旧描述。
