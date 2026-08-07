import json
import time
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Optional

import requests

from videocaptioner.core.asr.asr_data import ASRData, ASRDataSeg
from videocaptioner.core.utils.video_utils import video2audio

API_BASE_URL = "https://member.bilibili.com/x/bcut/rubick-interface"
API_REQ_UPLOAD = f"{API_BASE_URL}/resource/create"
API_COMMIT_UPLOAD = f"{API_BASE_URL}/resource/create/complete"
API_CREATE_TASK = f"{API_BASE_URL}/task"
API_QUERY_RESULT = f"{API_BASE_URL}/task/result"
HEADERS = {
    "User-Agent": "Bilibili/1.0.0 (https://www.bilibili.com)",
    "Content-Type": "application/json",
}


def _srt_timestamp(milliseconds: int) -> str:
    total_seconds, millis = divmod(max(0, int(milliseconds)), 1000)
    minutes, seconds = divmod(total_seconds, 60)
    hours, minutes = divmod(minutes, 60)
    return f"{hours:02}:{minutes:02}:{seconds:02},{millis:03}"


def _write_srt(result: dict, output_path: str) -> None:
    lines = []
    for index, utterance in enumerate(result.get("utterances", []), 1):
        text = str(utterance.get("transcript", "")).strip()
        if not text:
            continue
        start = utterance.get("start_time", 0)
        end = utterance.get("end_time", start)
        lines.extend([
            str(index),
            f"{_srt_timestamp(start)} --> {_srt_timestamp(end)}",
            text,
            "",
        ])
    if not lines:
        raise RuntimeError("B 接口没有返回可用字幕")
    Path(output_path).write_text("\n".join(lines), encoding="utf-8")


def _bcut_transcribe(audio_path: str) -> dict:
    audio_data = Path(audio_path).read_bytes()
    if not audio_data:
        raise RuntimeError("音频文件为空")
    session = requests.Session()
    session.headers.update(HEADERS)
    response = session.post(
        API_REQ_UPLOAD,
        data=json.dumps({
            "type": 2,
            "name": "audio.mp3",
            "size": len(audio_data),
            "ResourceFileType": "mp3",
            "model_id": "8",
        }),
        timeout=30,
    )
    response.raise_for_status()
    upload = response.json()["data"]
    etags = []
    part_size = upload["per_size"]
    for index, upload_url in enumerate(upload["upload_urls"]):
        start = index * part_size
        part = audio_data[start:start + part_size]
        part_response = session.put(upload_url, data=part, timeout=60)
        part_response.raise_for_status()
        etag = part_response.headers.get("ETag")
        if etag:
            etags.append(etag)
    response = session.post(
        API_COMMIT_UPLOAD,
        data=json.dumps({
            "InBossKey": upload["in_boss_key"],
            "ResourceId": upload["resource_id"],
            "ETags": ",".join(etags),
            "UploadId": upload["upload_id"],
            "model_id": "8",
        }),
        timeout=30,
    )
    response.raise_for_status()
    download_url = response.json()["data"]["download_url"]
    response = session.post(
        API_CREATE_TASK,
        json={"resource": download_url, "model_id": "8"},
        timeout=30,
    )
    response.raise_for_status()
    task_id = response.json()["data"]["task_id"]
    for _ in range(500):
        response = session.get(
            API_QUERY_RESULT,
            params={"model_id": 7, "task_id": task_id},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()["data"]
        if data.get("state") == 4:
            result = data.get("result")
            return json.loads(result) if isinstance(result, str) else result
        time.sleep(1)
    raise TimeoutError("B 接口转录超过 500 秒仍未完成")


def transcribe_file(input_path: str, output_path: str, config: dict, word_timestamps: bool = False) -> None:
    del config, word_timestamps
    source = Path(input_path)
    temp_audio = NamedTemporaryFile(suffix=".mp3", delete=False)
    temp_audio.close()
    try:
        if source.suffix.lower() in {".mp3", ".m4a", ".wav", ".flac", ".ogg", ".opus", ".aac"}:
            audio_path = str(source)
        else:
            if not video2audio(str(source), temp_audio.name):
                raise RuntimeError("无法使用 FFmpeg 提取音频")
            audio_path = temp_audio.name
        _write_srt(_bcut_transcribe(audio_path), output_path)
    except requests.RequestException as error:
        raise RuntimeError(f"B 接口请求失败：{error}") from error
    finally:
        Path(temp_audio.name).unlink(missing_ok=True)
