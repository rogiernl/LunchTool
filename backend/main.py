from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Date
from sqlalchemy.orm import declarative_base, sessionmaker, Session as DbSession, relationship
from pydantic import BaseModel
from datetime import datetime, date, time
from typing import Optional, List
import os

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
    has_order_ahead = Column(Boolean, default=False)
    added_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    added_by = relationship("User")


class LunchSession(Base):
    __tablename__ = "lunch_sessions"
    id = Column(Integer, primary_key=True)
    date = Column(Date, unique=True, nullable=False)
    # voting | ordering | pickup | done
    status = Column(String, default="voting")
    host_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    selected_place_id = Column(Integer, ForeignKey("lunch_places.id"), nullable=True)
    payment_url = Column(String, nullable=True)
    pickup_location = Column(String, nullable=True)
    pickup_time = Column(String, nullable=True)
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
    is_paid = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")


Base.metadata.create_all(bind=engine)


# ─── App & middleware ─────────────────────────────────────────────────────────

app = FastAPI(title="LunchTool")

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
    email = request.headers.get("Cf-Access-Authenticated-User-Email")
    if not email:
        email = os.getenv("DEV_EMAIL")
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated via Cloudflare Zero Trust")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def voting_open() -> bool:
    return datetime.now().time() < time(11, 0)


def get_today(db: DbSession) -> LunchSession:
    today = date.today()
    session = db.query(LunchSession).filter(LunchSession.date == today).first()
    if not session:
        session = LunchSession(date=today)
        db.add(session)
        db.commit()
        db.refresh(session)
    return session


# ─── Serializers ─────────────────────────────────────────────────────────────

def s_user(u):
    if not u:
        return None
    return {"id": u.id, "email": u.email, "friendly_name": u.friendly_name}


def s_place(p):
    if not p:
        return None
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "has_order_ahead": p.has_order_ahead,
        "added_by": s_user(p.added_by),
    }


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
        "is_paid": o.is_paid,
    }


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class UpdateName(BaseModel):
    friendly_name: str


class PlaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    has_order_ahead: bool = False


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


# ─── Routes ──────────────────────────────────────────────────────────────────

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
def list_places(db: DbSession = Depends(get_db), _: User = Depends(get_current_user)):
    places = db.query(LunchPlace).order_by(LunchPlace.name).all()
    return [s_place(p) for p in places]


@app.post("/places")
def create_place(body: PlaceCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    p = LunchPlace(**body.model_dump(), added_by_id=user.id)
    db.add(p)
    db.commit()
    db.refresh(p)
    return s_place(p)


@app.put("/places/{pid}")
def update_place(pid: int, body: PlaceCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.query(LunchPlace).filter(LunchPlace.id == pid).first()
    if not p:
        raise HTTPException(404, "Not found")
    if p.added_by_id != user.id:
        raise HTTPException(403, "Not your place")
    for k, v in body.model_dump().items():
        setattr(p, k, v)
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
        "can_vote": voting_open() and s.status == "voting",
        "server_time": datetime.now().isoformat(),
    }


@app.post("/session/today/vote")
def cast_vote(body: VoteCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    if not voting_open():
        raise HTTPException(400, "Voting closed after 11:00")
    s = get_today(db)
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
