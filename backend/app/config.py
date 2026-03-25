import json
import os
import pathlib

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////data/lunchtool.db")

OFFICE_ADDRESS = "Boven Vredenburgpassage 128, Utrecht, Netherlands"
OFFICE_LAT = 52.0919
OFFICE_LNG = 5.1183
OFFICE_NAME = "VodafoneZiggo Utrecht"

IMAGES_DIR = pathlib.Path("/data/images")
_SETTINGS_FILE = pathlib.Path("/data/settings.json")


def load_settings() -> dict:
    if _SETTINGS_FILE.exists():
        try:
            return json.loads(_SETTINGS_FILE.read_text())
        except Exception:
            pass
    return {}


def save_settings(data: dict):
    current = load_settings()
    current.update(data)
    _SETTINGS_FILE.write_text(json.dumps(current))
