import logging
import os
import shutil
import sys
from pathlib import Path

try:
    from videocaptioner._version import __version__ as _raw_version
    VERSION = _raw_version.split(".dev")[0]
except Exception:
    VERSION = "0.1.0"

YEAR = 2026
APP_NAME = "CedricVideoCaptioner"
AUTHOR = "Cedric"
HELP_URL = ""
GITHUB_REPO_URL = ""
RELEASE_URL = ""
FEEDBACK_URL = ""

_PACKAGE_DIR = Path(__file__).parent
_PROJECT_ROOT = _PACKAGE_DIR.parent
_IS_FROZEN = getattr(sys, "frozen", False)
_PACKAGE_RESOURCE_PATH = _PACKAGE_DIR / "resources"
_IS_DEV = (_PROJECT_ROOT / "resource").is_dir() and not _IS_FROZEN

if _IS_FROZEN:
    from platformdirs import user_data_path
    ROOT_PATH = Path(sys.executable).resolve().parent
    RESOURCE_PATH = Path(getattr(sys, "_MEIPASS")) / "resource"
    APPDATA_PATH = user_data_path(APP_NAME)
    WORK_PATH = Path.home() / APP_NAME
elif _IS_DEV:
    ROOT_PATH = _PROJECT_ROOT
    RESOURCE_PATH = ROOT_PATH / "resource"
    APPDATA_PATH = ROOT_PATH / "AppData"
    WORK_PATH = ROOT_PATH / "work-dir"
else:
    from platformdirs import user_data_path
    ROOT_PATH = user_data_path(APP_NAME)
    RESOURCE_PATH = _PACKAGE_RESOURCE_PATH if _PACKAGE_RESOURCE_PATH.exists() else ROOT_PATH / "resource"
    APPDATA_PATH = ROOT_PATH
    WORK_PATH = Path.home() / APP_NAME

CACHE_PATH = APPDATA_PATH / "cache"
MODEL_PATH = APPDATA_PATH / "models"
BIN_PATH = APPDATA_PATH / "bin" if not _IS_DEV else RESOURCE_PATH / "bin"
FASTER_WHISPER_PATH = BIN_PATH / "Faster-Whisper-XXL"
LOG_PATH = APPDATA_PATH / "logs"
SETTINGS_PATH = APPDATA_PATH / "settings.json"
LOG_LEVEL = logging.INFO
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

for path in (APPDATA_PATH, CACHE_PATH, LOG_PATH, WORK_PATH, MODEL_PATH, BIN_PATH):
    path.mkdir(parents=True, exist_ok=True)

for path in (FASTER_WHISPER_PATH, BIN_PATH):
    if path.exists():
        os.environ["PATH"] = str(path) + os.pathsep + os.environ["PATH"]
