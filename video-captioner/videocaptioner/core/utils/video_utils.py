import os
import subprocess
from pathlib import Path


def video2audio(input_file: str, output: str = "", audio_track_index: int = 0) -> bool:
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        "ffmpeg", "-i", input_file, "-map", f"0:a:{audio_track_index}",
        "-vn", "-ac", "1", "-ar", "16000", "-y", str(output_path),
    ]
    try:
        subprocess.run(
            command,
            capture_output=True,
            check=True,
            encoding="utf-8",
            errors="replace",
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0,
        )
        return output_path.is_file() and output_path.stat().st_size > 0
    except (OSError, subprocess.CalledProcessError):
        return False
