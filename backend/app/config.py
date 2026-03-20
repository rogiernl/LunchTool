import os
import pathlib

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////data/lunchtool.db")

OFFICE_ADDRESS = "Boven Vredenburgpassage 128, Utrecht, Netherlands"
OFFICE_LAT = 52.0919
OFFICE_LNG = 5.1183

IMAGES_DIR = pathlib.Path("/data/images")
