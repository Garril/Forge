# Cedric Video Captioner

一个面向 Windows 的本地视频处理工具，保留以下功能：

- 使用 `yt-dlp` 解析和下载 Bilibili、YouTube 等支持的平台视频；
- 使用 FFmpeg 从视频提取单声道 16kHz 音频；
- 使用本机 `faster-whisper` 或 `faster-whisper-xxl` 可执行程序转录；
- 输出带时间轴的 `.srt` 字幕文件；
- 通过 TOML 配置文件设置 ASR 模型、语言、设备、VAD 和输出格式。

## 运行要求

- Python 3.10–3.12
- FFmpeg 已加入 `PATH`
- `yt-dlp`（安装 Python 依赖后提供）
- `faster-whisper` 或 `faster-whisper-xxl` 已加入 `PATH`

本项目不再包含 GUI、LLM 润色、翻译、配音、远程 ASR、字幕烧录和在线推广功能，也不内置任何第三方中转 API。

## 安装

```bash
pip install -e .
```

## 使用

下载视频：

```bash
cedric-captioner download "https://www.bilibili.com/video/BV..." -o ./videos
```

解析视频信息但不下载：

```bash
cedric-captioner info "https://www.bilibili.com/video/BV..."
```

生成 SRT：

```bash
cedric-captioner transcribe video.mp4 -o video.srt --asr faster-whisper --language zh
```

查看或初始化配置：

```bash
cedric-captioner config path
cedric-captioner config init
cedric-captioner config show
```

配置文件保存在系统用户配置目录，不保存账号密码或 Cookie。若需要访问受限内容，请通过 `yt-dlp` 支持的本地 Cookie 文件参数自行提供，并注意只处理你有权访问和保存的内容。

## 许可证和来源说明

本项目基于原项目代码进行修改和裁剪，保留原项目要求的 GNU GPL v3 许可证及必要的版权/来源信息。应用品牌和维护者标识已改为 Cedric；原项目的法定版权声明不因品牌修改而删除。
