from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session as DbSession

from ..auth import get_current_user
from ..database import get_db
from ..models import LunchPlace, LunchSession, SessionOrder, SessionVote, User
from ..schemas import (
    FarewellBody,
    HostCreate,
    OrderCreate,
    PaymentCreate,
    PickupCreate,
    RetroactiveCreate,
    SessionPaymentBody,
    SessionTotalBody,
    VoteCreate,
)
from ..serializers import s_order, s_place, s_session, s_user, s_vote
from ..services.images import save_session_image
from ..services.notifications import notify_teams
from ..services.sessions import get_today, voting_open

router = APIRouter()


@router.get("/session/today")
def get_session(background_tasks: BackgroundTasks, db: DbSession = Depends(get_db), _: User = Depends(get_current_user)):
    is_new = not db.query(LunchSession).filter(LunchSession.date == date.today()).first()
    session = get_today(db)
    if is_new:
        background_tasks.add_task(notify_teams, "🗳️ Vote is open for today's lunch! Cast your vote now.")
    votes = db.query(SessionVote).filter(SessionVote.session_id == session.id).all()
    orders = db.query(SessionOrder).filter(SessionOrder.session_id == session.id).all()
    return {
        "id": session.id,
        "date": session.date.isoformat(),
        "status": session.status,
        "host": s_user(session.host),
        "selected_place": s_place(session.selected_place),
        "payment_url": session.payment_url,
        "pickup_location": session.pickup_location,
        "pickup_time": session.pickup_time,
        "votes": [s_vote(vote) for vote in votes],
        "orders": [s_order(order) for order in orders],
        "vote_deadline": session.vote_deadline.isoformat() if session.vote_deadline else None,
        "can_vote": voting_open(session) and session.status == "voting",
        "server_time": datetime.now().isoformat(),
    }


@router.post("/session/today/vote")
def cast_vote(body: VoteCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    session = get_today(db)
    if not voting_open(session):
        raise HTTPException(400, "Voting is closed")
    if session.status != "voting":
        raise HTTPException(400, "Session is not in voting phase")

    place = db.query(LunchPlace).filter(LunchPlace.id == body.lunch_place_id).first()
    if not place:
        raise HTTPException(404, "Place not found")

    vote = db.query(SessionVote).filter(SessionVote.session_id == session.id, SessionVote.user_id == user.id).first()
    if vote:
        vote.lunch_place_id = body.lunch_place_id
        vote.is_joining = body.is_joining
        vote.note = body.note
    else:
        vote = SessionVote(session_id=session.id, user_id=user.id, **body.model_dump())
        db.add(vote)
    db.commit()
    db.refresh(vote)
    return s_vote(vote)


@router.post("/session/today/extend-vote")
def extend_vote(db: DbSession = Depends(get_db), _: User = Depends(get_current_user)):
    session = get_today(db)
    if session.status != "voting":
        raise HTTPException(400, "Session is not in voting phase")
    session.vote_deadline = (session.vote_deadline or datetime.combine(session.date, time(11, 0))) + timedelta(minutes=20)
    db.commit()
    return {"vote_deadline": session.vote_deadline.isoformat()}


@router.post("/session/today/host")
def take_host(body: HostCreate, background_tasks: BackgroundTasks, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    session = get_today(db)
    if session.host_id and session.host_id != user.id:
        raise HTTPException(400, "Session already has a host")

    place = db.query(LunchPlace).filter(LunchPlace.id == body.selected_place_id).first()
    if not place:
        raise HTTPException(404, "Place not found")

    session.host_id = user.id
    session.selected_place_id = body.selected_place_id
    session.status = "ordering"
    db.commit()

    joining = db.query(SessionVote).filter(SessionVote.session_id == session.id, SessionVote.is_joining == True).count()
    background_tasks.add_task(notify_teams, f"🏆 Today we're going to **{place.name}**! {joining} people joining.")
    return {"ok": True}


@router.put("/session/today/payment")
def set_payment(body: PaymentCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    session = get_today(db)
    if session.host_id != user.id:
        raise HTTPException(403, "Only the host can set payment URL")
    session.payment_url = body.payment_url
    db.commit()
    return {"ok": True}


@router.put("/session/today/pickup")
def set_pickup(body: PickupCreate, background_tasks: BackgroundTasks, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    session = get_today(db)
    if session.host_id != user.id:
        raise HTTPException(403, "Only the host can set pickup info")
    session.pickup_location = body.pickup_location
    session.pickup_time = body.pickup_time
    session.status = "pickup"
    db.commit()
    background_tasks.add_task(notify_teams, f"📦 Pickup at **{body.pickup_location}** at {body.pickup_time} — go collect your order!")
    return {"ok": True}


@router.post("/session/today/orders")
def add_order(body: OrderCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    session = get_today(db)
    if session.status not in ("ordering", "pickup"):
        raise HTTPException(400, "Session is not in ordering phase")

    order = db.query(SessionOrder).filter(SessionOrder.session_id == session.id, SessionOrder.user_id == user.id).first()
    if order:
        order.item_description = body.item_description
        order.amount = body.amount
    else:
        order = SessionOrder(session_id=session.id, user_id=user.id, **body.model_dump())
        db.add(order)
    db.commit()
    db.refresh(order)
    return s_order(order)


@router.put("/session/today/orders/{oid}/paid")
def mark_paid(oid: int, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    session = get_today(db)
    order = db.query(SessionOrder).filter(
        SessionOrder.id == oid,
        SessionOrder.session_id == session.id,
        SessionOrder.user_id == user.id,
    ).first()
    if not order:
        raise HTTPException(404, "Order not found")
    order.is_paid = True
    db.commit()
    return {"ok": True}


@router.get("/sessions")
def list_sessions(db: DbSession = Depends(get_db), _: User = Depends(get_current_user)):
    sessions = db.query(LunchSession).order_by(LunchSession.date.desc()).limit(60).all()
    return [s_session(session, db) for session in sessions]


@router.post("/sessions/retroactive")
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

    session = LunchSession(
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
    db.add(session)
    db.commit()
    db.refresh(session)
    return s_session(session, db)


@router.post("/sessions/{sid}/image")
async def upload_session_image(
    sid: int,
    file: UploadFile = File(...),
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = db.query(LunchSession).filter(LunchSession.id == sid).first()
    if not session:
        raise HTTPException(404, "Session not found")

    try:
        saved_name = save_session_image(sid, file.filename, await file.read())
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    session.image_path = saved_name
    db.commit()
    return {"image_url": f"/api/images/{saved_name}"}


@router.post("/sessions/{sid}/orders")
def add_order_to_session(sid: int, body: OrderCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(LunchSession).filter(LunchSession.id == sid).first()
    if not session:
        raise HTTPException(404, "Session not found")

    order = db.query(SessionOrder).filter(SessionOrder.session_id == session.id, SessionOrder.user_id == user.id).first()
    if order:
        order.item_description = body.item_description
        order.amount = body.amount
    else:
        order = SessionOrder(session_id=session.id, user_id=user.id, **body.model_dump())
        db.add(order)
    db.commit()
    db.refresh(order)
    return s_order(order)


@router.put("/sessions/{sid}/total")
def set_session_total(sid: int, body: SessionTotalBody, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(LunchSession).filter(LunchSession.id == sid).first()
    if not session:
        raise HTTPException(404, "Session not found")
    if session.host_id != user.id:
        raise HTTPException(403, "Only the host can edit the total")
    session.total_amount = body.total_amount
    db.commit()
    return {"ok": True}


@router.put("/sessions/{sid}/settle")
def settle_session(sid: int, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(LunchSession).filter(LunchSession.id == sid).first()
    if not session:
        raise HTTPException(404, "Session not found")
    if session.host_id != user.id:
        raise HTTPException(403, "Only the host can settle")
    session.status = "done"
    db.commit()
    return {"ok": True}


@router.put("/sessions/{sid}/payment")
def set_session_payment(sid: int, body: SessionPaymentBody, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(LunchSession).filter(LunchSession.id == sid).first()
    if not session:
        raise HTTPException(404, "Session not found")
    session.payment_url = body.payment_url.strip() or None
    db.commit()
    return {"ok": True}


@router.post("/sessions/{sid}/host")
def take_session_host(sid: int, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(LunchSession).filter(LunchSession.id == sid).first()
    if not session:
        raise HTTPException(404, "Session not found")
    session.host_id = user.id
    db.commit()
    db.refresh(session)
    return s_session(session, db)


@router.put("/sessions/{sid}/orders/{oid}/paid")
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

    session = db.query(LunchSession).filter(LunchSession.id == sid).first()
    if session and session.status == "settling" and session.total_amount is not None:
        all_orders = db.query(SessionOrder).filter(SessionOrder.session_id == sid).all()
        paid_sum = sum(existing_order.amount or 0 for existing_order in all_orders if existing_order.is_paid)
        if paid_sum >= session.total_amount:
            session.status = "done"
            db.commit()
    return {"ok": True}


@router.put("/sessions/{sid}/farewell")
def set_farewell(sid: int, body: FarewellBody, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(LunchSession).filter(LunchSession.id == sid).first()
    if not session:
        raise HTTPException(404, "Session not found")
    if session.host_id == user.id:
        raise HTTPException(403, "The host cannot set a farewell gift link")
    session.farewell_payment_url = body.farewell_payment_url.strip() or None
    db.commit()
    return {"ok": True}
