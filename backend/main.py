from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Date, Float, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session as DbSession, relationship
from pydantic import BaseModel
from datetime import datetime, date, time, timedelta
from typing import Optional, List
import os
import asyncio
import httpx
import shutil
import pathlib
import io
from PIL import Image
import pillow_heif
pillow_heif.register_heif_opener()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////data/lunchtool.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─── Models ──────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    friendly_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class LunchPlace(Base):
    __tablename__ = "lunch_places"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    address = Column(String, nullable=True)
    google_rating = Column(Float, nullable=True)
    has_order_ahead = Column(Boolean, default=False)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    walking_minutes = Column(Integer, nullable=True)
    added_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    added_by = relationship("User")


class LunchSession(Base):
    __tablename__ = "lunch_sessions"
    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False)
    # voting | ordering | pickup | done
    status = Column(String, default="voting")
    host_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    selected_place_id = Column(Integer, ForeignKey("lunch_places.id"), nullable=True)
    vote_deadline = Column(DateTime, nullable=True)
    total_amount = Column(Float, nullable=True)
    gratuity = Column(Float, nullable=True)
    attendee_count = Column(Integer, nullable=True)
    payment_url = Column(String, nullable=True)
    pickup_location = Column(String, nullable=True)
    pickup_time = Column(String, nullable=True)
    meal_type = Column(String, default="lunch")
    image_path = Column(String, nullable=True)
    place_name = Column(String, nullable=True)
    farewell_payment_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    host = relationship("User", foreign_keys=[host_id])
    selected_place = relationship("LunchPlace", foreign_keys=[selected_place_id])


class SessionVote(Base):
    __tablename__ = "session_votes"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("lunch_sessions.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    lunch_place_id = Column(Integer, ForeignKey("lunch_places.id"))
    is_joining = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")
    lunch_place = relationship("LunchPlace")


class SessionOrder(Base):
    __tablename__ = "session_orders"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("lunch_sessions.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    item_description = Column(String, nullable=False)
    amount = Column(Float, nullable=True)
    is_paid = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")


class PlaceLike(Base):
    __tablename__ = "place_likes"
    id = Column(Integer, primary_key=True)
    place_id = Column(Integer, ForeignKey("lunch_places.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    place = relationship("LunchPlace")
    user = relationship("User")


class ActivityPoll(Base):
    __tablename__ = "activity_polls"
    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    poll_type = Column(String, default="dinner")  # dinner | drinks
    description = Column(String, nullable=True)
    status = Column(String, default="open")  # open | confirmed | cancelled
    created_by_id = Column(Integer, ForeignKey("users.id"))
    confirmed_option_id = Column(Integer, nullable=True)
    farewell_payment_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = relationship("User", foreign_keys=[created_by_id])


class ActivityPollOption(Base):
    __tablename__ = "activity_poll_options"
    id = Column(Integer, primary_key=True)
    poll_id = Column(Integer, ForeignKey("activity_polls.id"))
    date = Column(Date, nullable=False)
    time_label = Column(String, nullable=True)


class ActivityPollResponse(Base):
    __tablename__ = "activity_poll_responses"
    id = Column(Integer, primary_key=True)
    poll_id = Column(Integer, ForeignKey("activity_polls.id"))
    option_id = Column(Integer, ForeignKey("activity_poll_options.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String)  # yes | no | maybe
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")


Base.metadata.create_all(bind=engine)

# Migrate existing DBs — add new columns if they don't exist yet
def _add_column_if_missing(table, column, col_type):
    with engine.connect() as conn:
        cols = [r[1] for r in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()]
        if column not in cols:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
            conn.commit()

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

def _remove_lunch_sessions_date_unique():
    with engine.connect() as conn:
        indexes = conn.execute(text("PRAGMA index_list(lunch_sessions)")).fetchall()
        for idx in indexes:
            if idx[2]:  # unique flag
                cols = conn.execute(text(f"PRAGMA index_info({idx[1]})")).fetchall()
                if any(c[2] == 'date' for c in cols):
                    break
        else:
            return  # no unique index on date found
        conn.execute(text("""
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
                created_at DATETIME
            )
        """))
        conn.execute(text("INSERT OR IGNORE INTO lunch_sessions_new SELECT id,date,status,host_id,selected_place_id,vote_deadline,total_amount,gratuity,attendee_count,payment_url,pickup_location,pickup_time,meal_type,image_path,place_name,created_at FROM lunch_sessions"))
        conn.execute(text("DROP TABLE lunch_sessions"))
        conn.execute(text("ALTER TABLE lunch_sessions_new RENAME TO lunch_sessions"))
        conn.commit()

_remove_lunch_sessions_date_unique()


# ─── App & middleware ─────────────────────────────────────────────────────────

OFFICE_ADDRESS = "Boven Vredenburgpassage 128, Utrecht, Netherlands"
OFFICE_LAT = 52.0919
OFFICE_LNG = 5.1183

IMAGES_DIR = pathlib.Path("/data/images")
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="LunchTool")
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(request: Request, db: DbSession = Depends(get_db)) -> User:
    from sqlalchemy.exc import IntegrityError
    email = request.headers.get("Cf-Access-Authenticated-User-Email")
    if not email:
        email = os.getenv("DEV_EMAIL")
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated via Cloudflare Zero Trust")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        try:
            user = User(email=email)
            db.add(user)
            db.commit()
            db.refresh(user)
        except IntegrityError:
            db.rollback()
            user = db.query(User).filter(User.email == email).first()
    return user


def voting_open(session: LunchSession) -> bool:
    deadline = session.vote_deadline or datetime.combine(session.date, time(11, 0))
    return datetime.now() < deadline


def get_today(db: DbSession) -> LunchSession:
    today = date.today()
    session = db.query(LunchSession).filter(LunchSession.date == today).first()
    if not session:
        session = LunchSession(
            date=today,
            vote_deadline=datetime.combine(today, time(11, 0)),
        )
        db.add(session)
        db.commit()
        db.refresh(session)
    elif session.vote_deadline is None:
        session.vote_deadline = datetime.combine(session.date, time(11, 0))
        db.commit()
    return session


# ─── Serializers ─────────────────────────────────────────────────────────────

def s_user(u):
    if not u:
        return None
    return {"id": u.id, "email": u.email, "friendly_name": u.friendly_name}


def s_place(p, db=None, user_id=None):
    if not p:
        return None
    result = {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "address": p.address,
        "google_rating": p.google_rating,
        "has_order_ahead": p.has_order_ahead,
        "lat": p.lat,
        "lng": p.lng,
        "walking_minutes": p.walking_minutes,
        "added_by": s_user(p.added_by),
        "like_count": 0,
        "liked_by_me": False,
        "last_visit": None,
        "visit_count": 0,
    }
    if db is not None:
        likes = db.query(PlaceLike).filter(PlaceLike.place_id == p.id).all()
        result["like_count"] = len(likes)
        result["liked_by_me"] = any(l.user_id == user_id for l in likes)
        visits = (
            db.query(LunchSession)
            .filter(
                LunchSession.selected_place_id == p.id,
                LunchSession.status.in_(["done", "pickup", "ordering", "settling"]),
            )
            .order_by(LunchSession.date.desc())
            .all()
        )
        result["last_visit"] = visits[0].date.isoformat() if visits else None
        result["visit_count"] = len(visits)
    return result


def s_vote(v):
    return {
        "id": v.id,
        "user": s_user(v.user),
        "lunch_place": s_place(v.lunch_place),
        "is_joining": v.is_joining,
    }


def s_order(o):
    return {
        "id": o.id,
        "user": s_user(o.user),
        "item_description": o.item_description,
        "amount": o.amount,
        "is_paid": o.is_paid,
    }


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class UpdateName(BaseModel):
    friendly_name: str


class PlaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    address: Optional[str] = None
    google_rating: Optional[float] = None
    has_order_ahead: bool = False
    lat: Optional[float] = None
    lng: Optional[float] = None


class VoteCreate(BaseModel):
    lunch_place_id: int
    is_joining: bool = True


class HostCreate(BaseModel):
    selected_place_id: int


class PaymentCreate(BaseModel):
    payment_url: str


class PickupCreate(BaseModel):
    pickup_location: str
    pickup_time: str


class OrderCreate(BaseModel):
    item_description: str
    amount: Optional[float] = None


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/config")
def get_config():
    return {
        "google_maps_api_key": os.getenv("GOOGLE_MAPS_API_KEY", ""),
        "office_lat": OFFICE_LAT,
        "office_lng": OFFICE_LNG,
        "office_name": "VodafoneZiggo Utrecht",
    }


@app.get("/weather")
async def get_weather(_: User = Depends(get_current_user)):
    key = os.getenv("WEERLIVE_KEY")
    if not key:
        raise HTTPException(503, "Weather API key not configured")
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                "https://weerlive.nl/api/weerlive_api_v2.php",
                params={"key": key, "locatie": "Utrecht"},
            )
        data = resp.json()
        lw = data.get("liveweer", [{}])[0]
        if lw.get("fout"):
            raise HTTPException(502, lw["fout"])
        # Use 13:00 forecast for lunch — further from now so more stable/reliable
        h13 = None
        for h in data.get("uur_verw", []):
            if "13:00" in h.get("uur", ""):
                h13 = h
                break
        lunch = {
            "temp": h13["temp"],
            "image": h13["image"],
            "rain_mm": round(float(h13.get("neersl") or 0), 1),
        } if h13 else None
        return {
            "temp": lw.get("temp"),
            "description": lw.get("samenv"),
            "image": lw.get("image"),
            "wind_bft": lw.get("windbft"),
            "wind_dir": lw.get("windr"),
            "lunch": lunch,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Weather fetch failed: {e}")


@app.get("/places-autocomplete")
async def places_autocomplete(q: str, _: User = Depends(get_current_user)):
    import logging
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key or len(q.strip()) < 2:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://places.googleapis.com/v1/places:autocomplete",
            headers={"X-Goog-Api-Key": api_key, "Content-Type": "application/json"},
            json={
                "input": q,
                "locationBias": {
                    "circle": {
                        "center": {"latitude": 52.0907, "longitude": 5.1214},
                        "radius": 8000.0,
                    }
                },
            },
        )
    if not resp.is_success:
        logging.warning("Places autocomplete error %s: %s", resp.status_code, resp.text)
        return []
    data = resp.json()
    suggestions = []
    for s in data.get("suggestions", []):
        p = s.get("placePrediction", {})
        if not p:
            continue
        fmt = p.get("structuredFormat", {})
        suggestions.append({
            "place_id": p.get("placeId", ""),
            "main_text": fmt.get("mainText", {}).get("text", p.get("text", {}).get("text", "")),
            "secondary_text": fmt.get("secondaryText", {}).get("text", ""),
        })
    return suggestions


@app.get("/place-details/{place_id}")
async def get_place_details(place_id: str, _: User = Depends(get_current_user)):
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        raise HTTPException(400, "Google Maps API key not configured")
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://places.googleapis.com/v1/places/{place_id}",
            headers={
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": "displayName,formattedAddress,rating",
            },
        )
    if not resp.is_success:
        raise HTTPException(502, f"Places API error: {resp.text}")
    data = resp.json()
    return {
        "name": data.get("displayName", {}).get("text", ""),
        "address": data.get("formattedAddress", ""),
        "rating": data.get("rating"),
    }


@app.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return s_user(user)


@app.put("/me")
def update_me(body: UpdateName, user: User = Depends(get_current_user), db: DbSession = Depends(get_db)):
    user.friendly_name = body.friendly_name
    db.commit()
    db.refresh(user)
    return s_user(user)


@app.get("/places")
def list_places(db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    places = db.query(LunchPlace).all()
    serialized = [s_place(p, db=db, user_id=user.id) for p in places]
    serialized.sort(key=lambda p: (-p["like_count"], p["name"].lower()))
    return serialized


async def _enrich_geo(p: LunchPlace):
    """Geocode address (if no manual coords) and fetch walking time. Silently skips on error."""
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key or not p.address:
        return
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            # Only geocode when coordinates haven't been manually set
            if p.lat is None or p.lng is None:
                geo = await client.get(
                    "https://maps.googleapis.com/maps/api/geocode/json",
                    params={"address": p.address, "key": api_key},
                )
                geo_data = geo.json()
                if geo_data.get("status") == "OK" and geo_data.get("results"):
                    loc = geo_data["results"][0]["geometry"]["location"]
                    p.lat = loc["lat"]
                    p.lng = loc["lng"]

            # Always recalculate walking distance from office (use coords if available, else address)
            destination = f"{p.lat},{p.lng}" if p.lat and p.lng else p.address
            dm = await client.get(
                "https://maps.googleapis.com/maps/api/distancematrix/json",
                params={
                    "origins": OFFICE_ADDRESS,
                    "destinations": destination,
                    "mode": "walking",
                    "key": api_key,
                },
            )
            dm_data = dm.json()
            rows = dm_data.get("rows", [])
            if rows and rows[0].get("elements"):
                el = rows[0]["elements"][0]
                if el.get("status") == "OK":
                    p.walking_minutes = round(el["duration"]["value"] / 60)
    except Exception:
        pass


@app.post("/places")
async def create_place(body: PlaceCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    p = LunchPlace(**body.model_dump(), added_by_id=user.id)
    db.add(p)
    db.commit()
    db.refresh(p)
    await _enrich_geo(p)
    db.commit()
    db.refresh(p)
    return s_place(p)


@app.put("/places/{pid}")
async def update_place(pid: int, body: PlaceCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.query(LunchPlace).filter(LunchPlace.id == pid).first()
    if not p:
        raise HTTPException(404, "Not found")
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    await _enrich_geo(p)
    db.commit()
    db.refresh(p)
    return s_place(p)


@app.delete("/places/{pid}")
def delete_place(pid: int, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.query(LunchPlace).filter(LunchPlace.id == pid).first()
    if not p:
        raise HTTPException(404, "Not found")
    if p.added_by_id != user.id:
        raise HTTPException(403, "Not your place")
    db.delete(p)
    db.commit()
    return {"ok": True}


@app.post("/places/{pid}/like")
def toggle_like(pid: int, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.query(LunchPlace).filter(LunchPlace.id == pid).first()
    if not p:
        raise HTTPException(404, "Not found")
    existing = db.query(PlaceLike).filter(PlaceLike.place_id == pid, PlaceLike.user_id == user.id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"liked": False}
    db.add(PlaceLike(place_id=pid, user_id=user.id))
    db.commit()
    return {"liked": True}


@app.get("/session/today")
def get_session(db: DbSession = Depends(get_db), _: User = Depends(get_current_user)):
    s = get_today(db)
    votes = db.query(SessionVote).filter(SessionVote.session_id == s.id).all()
    orders = db.query(SessionOrder).filter(SessionOrder.session_id == s.id).all()
    return {
        "id": s.id,
        "date": s.date.isoformat(),
        "status": s.status,
        "host": s_user(s.host),
        "selected_place": s_place(s.selected_place),
        "payment_url": s.payment_url,
        "pickup_location": s.pickup_location,
        "pickup_time": s.pickup_time,
        "votes": [s_vote(v) for v in votes],
        "orders": [s_order(o) for o in orders],
        "vote_deadline": s.vote_deadline.isoformat() if s.vote_deadline else None,
        "can_vote": voting_open(s) and s.status == "voting",
        "server_time": datetime.now().isoformat(),
    }


@app.post("/session/today/vote")
def cast_vote(body: VoteCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = get_today(db)
    if not voting_open(s):
        raise HTTPException(400, "Voting is closed")
    if s.status != "voting":
        raise HTTPException(400, "Session is not in voting phase")
    place = db.query(LunchPlace).filter(LunchPlace.id == body.lunch_place_id).first()
    if not place:
        raise HTTPException(404, "Place not found")
    vote = db.query(SessionVote).filter(
        SessionVote.session_id == s.id, SessionVote.user_id == user.id
    ).first()
    if vote:
        vote.lunch_place_id = body.lunch_place_id
        vote.is_joining = body.is_joining
    else:
        vote = SessionVote(session_id=s.id, user_id=user.id, **body.model_dump())
        db.add(vote)
    db.commit()
    db.refresh(vote)
    return s_vote(vote)


@app.post("/session/today/extend-vote")
def extend_vote(db: DbSession = Depends(get_db), _: User = Depends(get_current_user)):
    s = get_today(db)
    if s.status != "voting":
        raise HTTPException(400, "Session is not in voting phase")
    s.vote_deadline = (s.vote_deadline or datetime.combine(s.date, time(11, 0))) + timedelta(minutes=20)
    db.commit()
    return {"vote_deadline": s.vote_deadline.isoformat()}


@app.post("/session/today/host")
def take_host(body: HostCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = get_today(db)
    if s.host_id and s.host_id != user.id:
        raise HTTPException(400, "Session already has a host")
    place = db.query(LunchPlace).filter(LunchPlace.id == body.selected_place_id).first()
    if not place:
        raise HTTPException(404, "Place not found")
    s.host_id = user.id
    s.selected_place_id = body.selected_place_id
    s.status = "ordering"
    db.commit()
    return {"ok": True}


@app.put("/session/today/payment")
def set_payment(body: PaymentCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = get_today(db)
    if s.host_id != user.id:
        raise HTTPException(403, "Only the host can set payment URL")
    s.payment_url = body.payment_url
    db.commit()
    return {"ok": True}


@app.put("/session/today/pickup")
def set_pickup(body: PickupCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = get_today(db)
    if s.host_id != user.id:
        raise HTTPException(403, "Only the host can set pickup info")
    s.pickup_location = body.pickup_location
    s.pickup_time = body.pickup_time
    s.status = "pickup"
    db.commit()
    return {"ok": True}


@app.post("/session/today/orders")
def add_order(body: OrderCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = get_today(db)
    if s.status not in ("ordering", "pickup"):
        raise HTTPException(400, "Session is not in ordering phase")
    order = db.query(SessionOrder).filter(
        SessionOrder.session_id == s.id, SessionOrder.user_id == user.id
    ).first()
    if order:
        order.item_description = body.item_description
        order.amount = body.amount
    else:
        order = SessionOrder(session_id=s.id, user_id=user.id, **body.model_dump())
        db.add(order)
    db.commit()
    db.refresh(order)
    return s_order(order)


@app.put("/session/today/orders/{oid}/paid")
def mark_paid(oid: int, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = get_today(db)
    order = db.query(SessionOrder).filter(
        SessionOrder.id == oid,
        SessionOrder.session_id == s.id,
        SessionOrder.user_id == user.id,
    ).first()
    if not order:
        raise HTTPException(404, "Order not found")
    order.is_paid = True
    db.commit()
    return {"ok": True}


# ─── History / retroactive sessions ──────────────────────────────────────────

def s_session(s, db):
    votes = db.query(SessionVote).filter(SessionVote.session_id == s.id).all()
    orders = db.query(SessionOrder).filter(SessionOrder.session_id == s.id).all()
    return {
        "id": s.id,
        "date": s.date.isoformat(),
        "status": s.status,
        "host": s_user(s.host),
        "selected_place": s_place(s.selected_place) if s.selected_place else ({"id": None, "name": s.place_name} if s.place_name else None),
        "pickup_location": s.pickup_location,
        "pickup_time": s.pickup_time,
        "payment_url": s.payment_url,
        "total_amount": s.total_amount,
        "gratuity": s.gratuity,
        "attendee_count": s.attendee_count,
        "meal_type": s.meal_type or "lunch",
        "image_url": f"/api/images/{s.image_path}" if s.image_path else None,
        "farewell_payment_url": s.farewell_payment_url,
        "votes": [s_vote(v) for v in votes],
        "orders": [s_order(o) for o in orders],
    }


@app.get("/sessions")
def list_sessions(db: DbSession = Depends(get_db), _: User = Depends(get_current_user)):
    sessions = db.query(LunchSession).order_by(LunchSession.date.desc()).limit(60).all()
    return [s_session(s, db) for s in sessions]


class RetroactiveCreate(BaseModel):
    date: date
    place_id: Optional[int] = None
    place_name: Optional[str] = None
    total_amount: float
    meal_type: str = "lunch"
    gratuity: Optional[float] = None
    attendee_count: Optional[int] = None
    pickup_location: Optional[str] = None
    pickup_time: Optional[str] = None


@app.post("/sessions/retroactive")
def create_retroactive(body: RetroactiveCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    if not body.place_id and not body.place_name:
        raise HTTPException(400, "Provide either a place_id or a place_name")
    if body.date > date.today():
        raise HTTPException(400, "Cannot create a session for a future date")
    place_id = None
    if body.place_id:
        place = db.query(LunchPlace).filter(LunchPlace.id == body.place_id).first()
        if not place:
            raise HTTPException(404, "Place not found")
        place_id = body.place_id
    s = LunchSession(
        date=body.date,
        status="settling",
        host_id=user.id,
        selected_place_id=place_id,
        place_name=body.place_name if not place_id else None,
        total_amount=body.total_amount,
        meal_type=body.meal_type,
        gratuity=body.gratuity,
        attendee_count=body.attendee_count,
        pickup_location=body.pickup_location,
        pickup_time=body.pickup_time,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s_session(s, db)


@app.post("/sessions/{sid}/image")
async def upload_session_image(sid: int, file: UploadFile = File(...), db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.query(LunchSession).filter(LunchSession.id == sid).first()
    if not s:
        raise HTTPException(404, "Session not found")
    ext = pathlib.Path(file.filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"}:
        raise HTTPException(400, "Unsupported image type")
    data = await file.read()
    # Convert to JPEG for universal browser support; downscale if very large
    try:
        img = Image.open(io.BytesIO(data))
        img = img.convert("RGB")
        if max(img.size) > 2400:
            img.thumbnail((2400, 2400), Image.LANCZOS)
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=85)
        out.seek(0)
        filename = f"session_{sid}.jpg"
        dest = IMAGES_DIR / filename
        dest.write_bytes(out.read())
    except Exception:
        raise HTTPException(400, "Could not process image")
    s.image_path = filename
    db.commit()
    return {"image_url": f"/api/images/{filename}"}


@app.post("/sessions/{sid}/orders")
def add_order_to_session(sid: int, body: OrderCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.query(LunchSession).filter(LunchSession.id == sid).first()
    if not s:
        raise HTTPException(404, "Session not found")
    order = db.query(SessionOrder).filter(
        SessionOrder.session_id == s.id, SessionOrder.user_id == user.id
    ).first()
    if order:
        order.item_description = body.item_description
        order.amount = body.amount
    else:
        order = SessionOrder(session_id=s.id, user_id=user.id, **body.model_dump())
        db.add(order)
    db.commit()
    db.refresh(order)
    return s_order(order)


class SessionTotalBody(BaseModel):
    total_amount: float


@app.put("/sessions/{sid}/total")
def set_session_total(sid: int, body: SessionTotalBody, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.query(LunchSession).filter(LunchSession.id == sid).first()
    if not s:
        raise HTTPException(404, "Session not found")
    if s.host_id != user.id:
        raise HTTPException(403, "Only the host can edit the total")
    s.total_amount = body.total_amount
    db.commit()
    return {"ok": True}


@app.put("/sessions/{sid}/settle")
def settle_session(sid: int, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.query(LunchSession).filter(LunchSession.id == sid).first()
    if not s:
        raise HTTPException(404, "Session not found")
    if s.host_id != user.id:
        raise HTTPException(403, "Only the host can settle")
    s.status = "done"
    db.commit()
    return {"ok": True}


class SessionPaymentBody(BaseModel):
    payment_url: str


@app.put("/sessions/{sid}/payment")
def set_session_payment(sid: int, body: SessionPaymentBody, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.query(LunchSession).filter(LunchSession.id == sid).first()
    if not s:
        raise HTTPException(404, "Session not found")
    s.payment_url = body.payment_url.strip() or None
    db.commit()
    return {"ok": True}


@app.post("/sessions/{sid}/host")
def take_session_host(sid: int, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.query(LunchSession).filter(LunchSession.id == sid).first()
    if not s:
        raise HTTPException(404, "Session not found")
    s.host_id = user.id
    db.commit()
    db.refresh(s)
    return s_session(s, db)


@app.put("/sessions/{sid}/orders/{oid}/paid")
def mark_paid_in_session(sid: int, oid: int, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    order = db.query(SessionOrder).filter(
        SessionOrder.id == oid,
        SessionOrder.session_id == sid,
        SessionOrder.user_id == user.id,
    ).first()
    if not order:
        raise HTTPException(404, "Order not found")
    order.is_paid = True
    db.commit()
    # Auto-close settling session when paid amounts cover the total
    s = db.query(LunchSession).filter(LunchSession.id == sid).first()
    if s and s.status == "settling" and s.total_amount is not None:
        all_orders = db.query(SessionOrder).filter(SessionOrder.session_id == sid).all()
        paid_sum = sum(o.amount or 0 for o in all_orders if o.is_paid)
        if paid_sum >= s.total_amount:
            s.status = "done"
            db.commit()
    return {"ok": True}


# ─── Farewell gift ────────────────────────────────────────────────────────────

class FarewellBody(BaseModel):
    farewell_payment_url: str

@app.put("/sessions/{sid}/farewell")
def set_farewell(sid: int, body: FarewellBody, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.query(LunchSession).filter(LunchSession.id == sid).first()
    if not s:
        raise HTTPException(404, "Session not found")
    if s.host_id == user.id:
        raise HTTPException(403, "The host cannot set a farewell gift link")
    s.farewell_payment_url = body.farewell_payment_url.strip() or None
    db.commit()
    return {"ok": True}


# ─── Activity polls (datumprikker) ────────────────────────────────────────────

def s_poll_option(opt, responses):
    opt_resp = [r for r in responses if r.option_id == opt.id]
    return {
        "id": opt.id,
        "date": opt.date.isoformat(),
        "time_label": opt.time_label,
        "yes_count": sum(1 for r in opt_resp if r.status == "yes"),
        "maybe_count": sum(1 for r in opt_resp if r.status == "maybe"),
        "responses": [{"user": s_user(r.user), "status": r.status} for r in opt_resp],
    }

def s_poll(poll, db, user_id=None):
    options = db.query(ActivityPollOption).filter(ActivityPollOption.poll_id == poll.id).order_by(ActivityPollOption.date).all()
    responses = db.query(ActivityPollResponse).filter(ActivityPollResponse.poll_id == poll.id).all()
    my_responses = {r.option_id: r.status for r in responses if r.user_id == user_id} if user_id else {}
    conf = db.query(ActivityPollOption).filter(ActivityPollOption.id == poll.confirmed_option_id).first() if poll.confirmed_option_id else None
    return {
        "id": poll.id,
        "title": poll.title,
        "poll_type": poll.poll_type,
        "description": poll.description,
        "status": poll.status,
        "created_by": s_user(poll.created_by),
        "confirmed_option_id": poll.confirmed_option_id,
        "confirmed_option": {"id": conf.id, "date": conf.date.isoformat(), "time_label": conf.time_label} if conf else None,
        "options": [s_poll_option(opt, responses) for opt in options],
        "my_responses": my_responses,
        "has_responded": bool(my_responses),
        "farewell_payment_url": poll.farewell_payment_url,
    }

@app.get("/polls")
def list_polls(db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    polls = db.query(ActivityPoll).filter(ActivityPoll.status.in_(["open", "confirmed"])).order_by(ActivityPoll.created_at.desc()).all()
    return [s_poll(p, db, user.id) for p in polls]

class PollOptionIn(BaseModel):
    date: date
    time_label: Optional[str] = None

class PollCreate(BaseModel):
    title: str
    poll_type: str = "dinner"
    description: Optional[str] = None
    options: List[PollOptionIn]

@app.post("/polls")
def create_poll(body: PollCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    poll = ActivityPoll(title=body.title, poll_type=body.poll_type, description=body.description, created_by_id=user.id)
    db.add(poll)
    db.commit()
    db.refresh(poll)
    for opt in body.options:
        db.add(ActivityPollOption(poll_id=poll.id, date=opt.date, time_label=opt.time_label))
    db.commit()
    return s_poll(poll, db, user.id)

class PollResponseItem(BaseModel):
    option_id: int
    status: str  # yes | no | maybe

class PollRespondBody(BaseModel):
    responses: List[PollResponseItem]

@app.post("/polls/{pid}/respond")
def respond_to_poll(pid: int, body: PollRespondBody, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    poll = db.query(ActivityPoll).filter(ActivityPoll.id == pid, ActivityPoll.status == "open").first()
    if not poll:
        raise HTTPException(404, "Poll not found or not open")
    for r in body.responses:
        existing = db.query(ActivityPollResponse).filter(
            ActivityPollResponse.poll_id == pid,
            ActivityPollResponse.option_id == r.option_id,
            ActivityPollResponse.user_id == user.id,
        ).first()
        if existing:
            existing.status = r.status
        else:
            db.add(ActivityPollResponse(poll_id=pid, option_id=r.option_id, user_id=user.id, status=r.status))
    db.commit()
    return s_poll(poll, db, user.id)

class PollConfirmBody(BaseModel):
    option_id: int

@app.put("/polls/{pid}/confirm")
def confirm_poll(pid: int, body: PollConfirmBody, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    poll = db.query(ActivityPoll).filter(ActivityPoll.id == pid).first()
    if not poll:
        raise HTTPException(404, "Poll not found")
    if poll.created_by_id != user.id:
        raise HTTPException(403, "Only the organizer can confirm")
    poll.confirmed_option_id = body.option_id
    poll.status = "confirmed"
    db.commit()
    return s_poll(poll, db, user.id)

@app.delete("/polls/{pid}")
def delete_poll(pid: int, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    poll = db.query(ActivityPoll).filter(ActivityPoll.id == pid).first()
    if not poll:
        raise HTTPException(404, "Poll not found")
    if poll.created_by_id != user.id:
        raise HTTPException(403, "Only the organizer can delete")
    db.query(ActivityPollResponse).filter(ActivityPollResponse.poll_id == pid).delete()
    db.query(ActivityPollOption).filter(ActivityPollOption.poll_id == pid).delete()
    db.delete(poll)
    db.commit()
    return {"ok": True}

class PollFarewellBody(BaseModel):
    farewell_payment_url: str

@app.put("/polls/{pid}/farewell")
def set_poll_farewell(pid: int, body: PollFarewellBody, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    poll = db.query(ActivityPoll).filter(ActivityPoll.id == pid).first()
    if not poll:
        raise HTTPException(404, "Poll not found")
    if poll.created_by_id == user.id:
        raise HTTPException(403, "The organizer cannot set a farewell gift link")
    poll.farewell_payment_url = body.farewell_payment_url.strip() or None
    db.commit()
    return {"ok": True}
