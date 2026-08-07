"""Cedric Video Captioner command line interface."""

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional

from videocaptioner.cli import exit_codes as EXIT
from videocaptioner.cli.config import build_config, format_config, save_config_value


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="cedric-captioner")
    sub = parser.add_subparsers(dest="command")

    for name, help_text in (("info", "Parse online video information"), ("download", "Download online video")):
        command = sub.add_parser(name, help=help_text)
        command.add_argument("url")
        command.add_argument("-o", "--output", default=".", help="Output directory")
        command.add_argument("--cookies", help="Optional Netscape cookie file")
        command.set_defaults(func=_run_download if name == "download" else _run_info)

    transcribe = sub.add_parser("transcribe", help="Transcribe a local video/audio file to SRT")
    transcribe.add_argument("input")
    transcribe.add_argument("-o", "--output")
    transcribe.add_argument("--asr", choices=["faster-whisper"], default=None)
    transcribe.add_argument("--language", default=None)
    transcribe.add_argument("--model", dest="fw_model", default=None)
    transcribe.add_argument("--device", dest="fw_device", choices=["cpu", "cuda", "auto"], default=None)
    transcribe.add_argument("--word-timestamps", action="store_true")
    transcribe.set_defaults(func=_run_transcribe)

    summarize = sub.add_parser("summarize", help="Summarize SRT or text into a Markdown note")
    summarize.add_argument("input")
    summarize.add_argument("-o", "--output")
    summarize.add_argument("--title", default="视频笔记")
    summarize.add_argument("--api-base", default=None)
    summarize.add_argument("--api-method", choices=["responses", "chat-completions"], default="responses")
    summarize.add_argument("--api-key", default=None)
    summarize.add_argument("--model", default=None)
    summarize.add_argument("--prompt", default=None)
    summarize.set_defaults(func=_run_summarize)

    config = sub.add_parser("config", help="Manage local configuration")
    config.add_argument("action", choices=["path", "show", "init", "set"])
    config.add_argument("key", nargs="?")
    config.add_argument("value", nargs="?")
    config.set_defaults(func=_run_config)
    return parser


def _load(args: argparse.Namespace) -> dict:
    overrides = {}
    for key, attr in (("transcribe.asr", "asr"), ("transcribe.language", "language"),
                      ("transcribe.faster_whisper.model", "fw_model"),
                      ("transcribe.faster_whisper.device", "fw_device")):
        value = getattr(args, attr, None)
        if value is not None:
            target = overrides
            parts = key.split(".")
            for part in parts[:-1]:
                target = target.setdefault(part, {})
            target[parts[-1]] = value
    return build_config(overrides)


def _run_info(args: argparse.Namespace) -> int:
    try:
        import yt_dlp
        options = {"quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True}
        hostname = (urllib.parse.urlparse(args.url).hostname or "").lower()
        if hostname == "youtu.be" or hostname.endswith("youtube.com"):
            options["js_runtimes"] = {"node": {}}
        if args.cookies:
            options["cookiefile"] = args.cookies
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(args.url, download=False)
        print(f"title: {info.get('title', '')}")
        print(f"id: {info.get('id', '')}")
        print(f"duration: {info.get('duration', 0)}")
        print(f"uploader: {info.get('uploader', '')}")
        print(f"thumbnail: {info.get('thumbnail', '')}")
        return EXIT.SUCCESS
    except Exception as exc:
        print(f"解析失败: {exc}", file=sys.stderr)
        return EXIT.RUNTIME_ERROR


def _run_download(args: argparse.Namespace) -> int:
    try:
        import yt_dlp
        Path(args.output).mkdir(parents=True, exist_ok=True)
        def progress_hook(data):
            if data.get("status") == "downloading":
                percent_text = str(data.get("_percent_str", "")).replace("%", "").strip()
                try:
                    percent = float(percent_text)
                except ValueError:
                    total = data.get("total_bytes") or data.get("total_bytes_estimate") or 0
                    downloaded = data.get("downloaded_bytes", 0)
                    percent = downloaded / total * 100 if total else 0
                print(f"__DOWNLOAD_PROGRESS__:{percent:.1f}", flush=True)
            elif data.get("status") == "finished":
                print("__DOWNLOAD_PROGRESS__:100", flush=True)

        parsed_url = urllib.parse.urlparse(args.url)
        hostname = (parsed_url.hostname or "").lower()
        is_youtube = hostname == "youtu.be" or hostname.endswith("youtube.com")

        # YouTube 的可用格式经常不包含固定的 mp4/m4a 组合；Bilibili 保持原有选择策略。
        format_specs = (
            ["bestvideo*+bestaudio/best", "best"]
            if is_youtube
            else ["bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best", "bestvideo+bestaudio/best"]
        )
        options = {
            "outtmpl": {
                "default": str(Path(args.output) / "%(title).200s.%(ext)s"),
            },
            "format": format_specs[0],
            "merge_output_format": "mp4",
            "progress_hooks": [progress_hook],
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            "noplaylist": True,
        }
        if is_youtube:
            options["merge_output_format"] = "mp4"
            options["js_runtimes"] = {"node": {}}
        if args.cookies:
            options["cookiefile"] = args.cookies

        def download_with_format(format_spec):
            current_options = {**options, "format": format_spec}
            with yt_dlp.YoutubeDL(current_options) as ydl:
                ydl.download([args.url])

        first_error = None
        for index, format_spec in enumerate(format_specs):
            try:
                download_with_format(format_spec)
                break
            except Exception as error:
                first_error = error
                if index == 0:
                    print(f"首选视频格式下载失败，正在回退到兼容格式: {error}", file=sys.stderr, flush=True)
        else:
            raise first_error
        return EXIT.SUCCESS
    except Exception as exc:
        print(f"下载失败: {exc}", file=sys.stderr)
        return EXIT.RUNTIME_ERROR


def _run_transcribe(args: argparse.Namespace) -> int:
    input_path = Path(args.input)
    if not input_path.is_file():
        print(f"文件不存在: {input_path}", file=sys.stderr)
        return EXIT.FILE_NOT_FOUND
    config = _load(args)
    output_path = Path(args.output) if args.output else input_path.with_suffix(".srt")
    if output_path.suffix.lower() != ".srt":
        output_path = output_path.with_suffix(".srt")
    try:
        from videocaptioner.core.asr.transcribe import transcribe_file
        transcribe_file(str(input_path), str(output_path), config, args.word_timestamps)
        print(output_path)
        return EXIT.SUCCESS
    except Exception as exc:
        print(f"转录失败: {exc}", file=sys.stderr)
        return EXIT.RUNTIME_ERROR


def _run_summarize(args: argparse.Namespace) -> int:
    input_path = Path(args.input)
    if not input_path.is_file():
        print(f"文件不存在: {input_path}", file=sys.stderr)
        return EXIT.FILE_NOT_FOUND
    output_path = Path(args.output) if args.output else input_path.with_suffix(".md")
    text = input_path.read_text(encoding="utf-8", errors="replace")
    api_base = args.api_base or ""
    api_key = args.api_key or ""
    model = args.model or ""
    if not api_base or not api_key or not model:
        print("AI 总结需要 --api-base、--api-key 和 --model", file=sys.stderr)
        return EXIT.USAGE_ERROR
    user_prompt = args.prompt or (
        "请根据下面的视频字幕生成结构化 Markdown 笔记。必须包含：一句话摘要、核心观点、"
        "详细要点、关键术语、可执行行动和原字幕中的重要时间点。不要编造字幕中不存在的事实。"
    )
    prompt = f"{user_prompt}\n\n视频标题：{args.title}\n字幕：\n{text}"
    if args.api_method == "chat-completions":
        payload_data = {
            "model": model,
            "messages": [
                {"role": "system", "content": "你是严谨的视频笔记整理助手，只输出中文 Markdown。"},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "stream": False,
        }
        endpoint = "/chat/completions"
    else:
        payload_data = {
            "model": model,
            "instructions": "你是严谨的视频笔记整理助手，只输出中文 Markdown。",
            "input": prompt,
            "temperature": 0.2,
            "stream": False,
            "text": {"format": {"type": "text"}},
        }
        endpoint = "/responses"
    payload = json.dumps(payload_data).encode("utf-8")
    request = urllib.request.Request(
        api_base.rstrip("/") + endpoint, data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}, method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            data = json.loads(response.read().decode("utf-8"))
        if args.api_method == "chat-completions":
            content = data["choices"][0]["message"]["content"]
        else:
            content = next(
                item["text"]
                for item in data.get("output", [])
                if item.get("type") == "message"
                for item in item.get("content", [])
                if item.get("type") == "output_text"
            )
        output_path.write_text(content.strip() + "\n", encoding="utf-8")
        print(output_path)
        return EXIT.SUCCESS
    except (urllib.error.URLError, KeyError, StopIteration, json.JSONDecodeError, OSError) as exc:
        print(f"AI 总结失败: {exc}", file=sys.stderr)
        return EXIT.RUNTIME_ERROR


def _run_config(args: argparse.Namespace) -> int:
    if args.action == "path":
        from videocaptioner.cli.config import CONFIG_FILE
        print(CONFIG_FILE)
    elif args.action == "show":
        print(format_config(build_config()))
    elif args.action == "init":
        from videocaptioner.cli.config import DEFAULTS, CONFIG_FILE, ensure_config_dir, _write_toml
        ensure_config_dir()
        with CONFIG_FILE.open("w", encoding="utf-8") as file:
            _write_toml(file, DEFAULTS)
        print(CONFIG_FILE)
    elif args.action == "set":
        if not args.key or args.value is None:
            print("config set 需要 key 和 value", file=sys.stderr)
            return EXIT.USAGE_ERROR
        save_config_value(args.key, args.value)
    return EXIT.SUCCESS


def main(argv: Optional[list[str]] = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    if not args.command:
        parser.print_help()
        return EXIT.USAGE_ERROR
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
