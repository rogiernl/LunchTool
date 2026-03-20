import pathlib

from PIL import Image
import pillow_heif
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from .config import IMAGES_DIR
from .database import Base, engine
from .models import LunchSession

pillow_heif.register_heif_opener()


def _add_column_if_missing(table, column, col_type):
    with engine.connect() as conn:
        cols = [row[1] for row in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()]
        if column not in cols:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
            conn.commit()


def _remove_lunch_sessions_date_unique():
    with engine.connect() as conn:
        indexes = conn.execute(text("PRAGMA index_list(lunch_sessions)")).fetchall()
        for idx in indexes:
            if idx[2]:
                cols = conn.execute(text(f"PRAGMA index_info({idx[1]})")).fetchall()
                if any(col[2] == "date" for col in cols):
                    break
        else:
            return

        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS lunch_sessions_new (
                    id INTEGER PRIMARY KEY,
                    date DATE NOT NULL,
                    status VARCHAR DEFAULT 'voting',
                    host_id INTEGER REFERENCES users(id),
                    selected_place_id INTEGER REFERENCES lunch_places(id),
                    vote_deadline DATETIME,
                    total_amount REAL,
                    gratuity REAL,
                    attendee_count INTEGER,
                    payment_url VARCHAR,
                    pickup_location VARCHAR,
                    pickup_time VARCHAR,
                    meal_type VARCHAR,
                    image_path VARCHAR,
                    place_name VARCHAR,
                    farewell_payment_url VARCHAR,
                    created_at DATETIME
                )
                """
            )
        )
        conn.execute(
            text(
                "INSERT OR IGNORE INTO lunch_sessions_new "
                "SELECT id,date,status,host_id,selected_place_id,vote_deadline,total_amount,gratuity,"
                "attendee_count,payment_url,pickup_location,pickup_time,meal_type,image_path,place_name,"
                "farewell_payment_url,created_at FROM lunch_sessions"
            )
        )
        conn.execute(text("DROP TABLE lunch_sessions"))
        conn.execute(text("ALTER TABLE lunch_sessions_new RENAME TO lunch_sessions"))
        conn.commit()


def _convert_heic_images():
    heic_exts = {".heic", ".heif"}
    with sessionmaker(bind=engine)() as db:
        sessions = db.query(LunchSession).filter(LunchSession.image_path.isnot(None)).all()
        for session in sessions:
            path = pathlib.Path(session.image_path)
            if path.suffix.lower() not in heic_exts:
                continue

            src = IMAGES_DIR / session.image_path
            if not src.exists():
                continue

            try:
                image = Image.open(src).convert("RGB")
                new_name = path.stem + ".jpg"
                dest = IMAGES_DIR / new_name
                image.save(dest, format="JPEG", quality=85)
                src.unlink()
                session.image_path = new_name
                db.commit()
            except Exception as exc:
                print(f"HEIC conversion failed for {session.image_path}: {exc}")


def run_migrations():
    Base.metadata.create_all(bind=engine)
    _add_column_if_missing("lunch_places", "address", "TEXT")
    _add_column_if_missing("lunch_places", "lat", "REAL")
    _add_column_if_missing("lunch_places", "lng", "REAL")
    _add_column_if_missing("lunch_places", "walking_minutes", "INTEGER")
    _add_column_if_missing("lunch_sessions", "vote_deadline", "DATETIME")
    _add_column_if_missing("lunch_sessions", "total_amount", "REAL")
    _add_column_if_missing("lunch_places", "google_rating", "REAL")
    _add_column_if_missing("session_orders", "amount", "REAL")
    _add_column_if_missing("lunch_sessions", "meal_type", "TEXT")
    _add_column_if_missing("lunch_sessions", "image_path", "TEXT")
    _add_column_if_missing("lunch_sessions", "gratuity", "REAL")
    _add_column_if_missing("lunch_sessions", "attendee_count", "INTEGER")
    _add_column_if_missing("lunch_sessions", "place_name", "TEXT")
    _add_column_if_missing("lunch_sessions", "farewell_payment_url", "TEXT")
    _add_column_if_missing("activity_polls", "farewell_payment_url", "TEXT")
    _remove_lunch_sessions_date_unique()
    _convert_heic_images()
