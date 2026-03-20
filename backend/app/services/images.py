import io
import pathlib

from PIL import Image
import pillow_heif

from ..config import IMAGES_DIR

pillow_heif.register_heif_opener()


def save_session_image(session_id: int, filename: str, data: bytes) -> str:
    ext = pathlib.Path(filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"}:
        raise ValueError("Unsupported image type")

    try:
        image = Image.open(io.BytesIO(data))
        image = image.convert("RGB")
        if max(image.size) > 2400:
            image.thumbnail((2400, 2400), Image.LANCZOS)
        out = io.BytesIO()
        image.save(out, format="JPEG", quality=85)
        out.seek(0)
    except Exception as exc:
        raise ValueError("Could not process image") from exc

    saved_name = f"session_{session_id}.jpg"
    dest = IMAGES_DIR / saved_name
    dest.write_bytes(out.read())
    return saved_name
