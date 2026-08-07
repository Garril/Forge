"""Configuration for local download and transcription."""

import os
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any, Optional

from platformdirs import user_config_dir

if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib

APP_NAME = "cedric-video-captioner"
CONFIG_DIR = Path(user_config_dir(APP_NAME))
CONFIG_FILE = CONFIG_DIR / "config.toml"

ENV_MAP = {
    "CEDRIC_ASR": "transcribe.asr",
    "CEDRIC_LANGUAGE": "transcribe.language",
    "CEDRIC_FW_MODEL": "transcribe.faster_whisper.model",
    "CEDRIC_FW_DEVICE": "transcribe.faster_whisper.device",
    "CEDRIC_FW_VAD": "transcribe.faster_whisper.vad_filter",
    "CEDRIC_FW_VAD_THRESHOLD": "transcribe.faster_whisper.vad_threshold",
    "CEDRIC_FW_PROMPT": "transcribe.faster_whisper.prompt",
    "CEDRIC_OUTPUT_FORMAT": "output.format",
}

DEFAULTS: dict[str, Any] = {
    "transcribe": {
        "asr": "faster-whisper",
        "language": "auto",
        "faster_whisper": {
            "model": "large-v3",
            "device": "cpu",
            "vad_filter": True,
            "vad_threshold": 0.5,
            "prompt": "",
        },
    },
    "output": {"format": "srt"},
}


def _deep_merge(base: dict, override: dict) -> dict:
    result = deepcopy(base)
    for key, value in override.items():
        if isinstance(result.get(key), dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _set_nested(data: dict, key: str, value: Any) -> None:
    parts = key.split(".")
    target = data
    for part in parts[:-1]:
        target = target.setdefault(part, {})
    target[parts[-1]] = value


def _get_nested(data: dict, key: str, default: Any = None) -> Any:
    value: Any = data
    for part in key.split("."):
        if not isinstance(value, dict) or part not in value:
            return default
        value = value[part]
    return value


def _parse_value(raw: str, key: str) -> Any:
    default = _get_nested(DEFAULTS, key)
    if isinstance(default, bool):
        if raw.lower() in {"true", "1", "yes"}:
            return True
        if raw.lower() in {"false", "0", "no"}:
            return False
        raise ValueError(f"Expected boolean for {key}")
    if isinstance(default, int):
        return int(raw)
    if isinstance(default, float):
        return float(raw)
    return raw


def load_config_file(path: Optional[Path] = None) -> dict:
    path = path or CONFIG_FILE
    if not path.exists():
        return {}
    with path.open("rb") as file:
        return tomllib.load(file)


def load_env_overrides() -> dict:
    result: dict = {}
    for env_name, key in ENV_MAP.items():
        if env_name in os.environ:
            _set_nested(result, key, _parse_value(os.environ[env_name], key))
    return result


def build_config(cli_overrides: Optional[dict] = None, config_path: Optional[Path] = None) -> dict:
    result = _deep_merge(DEFAULTS, load_config_file(config_path))
    result = _deep_merge(result, load_env_overrides())
    return _deep_merge(result, cli_overrides or {})


def get(config: dict, key: str, default: Any = None) -> Any:
    return _get_nested(config, key, default)


def ensure_config_dir() -> Path:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    return CONFIG_DIR


def save_config_value(key: str, value: str, config_path: Optional[Path] = None) -> None:
    path = config_path or CONFIG_FILE
    ensure_config_dir()
    data = load_config_file(path)
    _set_nested(data, key, _parse_value(value, key))
    with path.open("w", encoding="utf-8") as file:
        _write_toml(file, data)


def _write_toml(file, data: dict, parent: str = "") -> None:
    for key, value in data.items():
        if not isinstance(value, dict):
            file.write(f"{key} = {_toml_value(value)}\n")
    for key, value in data.items():
        if isinstance(value, dict):
            section = f"{parent}.{key}" if parent else key
            file.write(f"\n[{section}]\n")
            _write_toml(file, value, section)


def _toml_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'


def format_config(config: dict, indent: int = 0) -> str:
    lines = []
    prefix = "  " * indent
    for key, value in config.items():
        if isinstance(value, dict):
            lines.append(f"{prefix}{key}:")
            lines.append(format_config(value, indent + 1))
        else:
            lines.append(f"{prefix}{key} = {value}")
    return "\n".join(lines)
