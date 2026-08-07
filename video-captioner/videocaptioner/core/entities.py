from enum import Enum


class SubtitleLayoutEnum(Enum):
    ORIGINAL_ON_TOP = "原文在上"
    TRANSLATE_ON_TOP = "译文在上"
    ONLY_ORIGINAL = "仅原文"
    ONLY_TRANSLATE = "仅译文"


class VadMethodEnum(Enum):
    SILERO_V3 = "silero_v3"
    SILERO_V4 = "silero_v4"
    SILERO_V5 = "silero_v5"
    SILERO_V4_FW = "silero_v4_fw"
    PYANNOTE_V3 = "pyannote_v3"
    PYANNOTE_ONNX_V3 = "pyannote_onnx_v3"
    WEBRTC = "webrtc"
    AUDITOK = "auditok"


class FasterWhisperModelEnum(Enum):
    TINY = "tiny"
    BASE = "base"
    SMALL = "small"
    MEDIUM = "medium"
    LARGE_V1 = "large-v1"
    LARGE_V2 = "large-v2"
    LARGE_V3 = "large-v3"
    LARGE_V3_TURBO = "large-v3-turbo"
