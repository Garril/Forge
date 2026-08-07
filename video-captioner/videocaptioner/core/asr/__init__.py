from typing import TYPE_CHECKING

from .asr_data import ASRData, ASRDataSeg
from .transcribe import transcribe_file

if TYPE_CHECKING:
    from .faster_whisper import FasterWhisperASR


def __getattr__(name: str):
    if name == "FasterWhisperASR":
        from .faster_whisper import FasterWhisperASR
        return FasterWhisperASR
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = ["ASRData", "ASRDataSeg", "FasterWhisperASR", "transcribe_file"]
