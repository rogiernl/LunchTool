from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DbSession

from ..auth import get_current_user
from ..database import get_db
from ..models import ActivityPoll, ActivityPollOption, ActivityPollResponse, User
from ..schemas import PollConfirmBody, PollCreate, PollFarewellBody, PollRespondBody
from ..serializers import s_poll

router = APIRouter()


@router.get("/polls")
def list_polls(db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    polls = (
        db.query(ActivityPoll)
        .filter(ActivityPoll.status.in_(["open", "confirmed"]))
        .order_by(ActivityPoll.created_at.desc())
        .all()
    )
    return [s_poll(poll, db, user.id) for poll in polls]


@router.post("/polls")
def create_poll(body: PollCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    poll = ActivityPoll(
        title=body.title,
        poll_type=body.poll_type,
        description=body.description,
        created_by_id=user.id,
    )
    db.add(poll)
    db.commit()
    db.refresh(poll)
    for option in body.options:
        db.add(ActivityPollOption(poll_id=poll.id, date=option.date, time_label=option.time_label))
    db.commit()
    return s_poll(poll, db, user.id)


@router.post("/polls/{pid}/respond")
def respond_to_poll(pid: int, body: PollRespondBody, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    poll = db.query(ActivityPoll).filter(ActivityPoll.id == pid, ActivityPoll.status == "open").first()
    if not poll:
        raise HTTPException(404, "Poll not found or not open")

    for response in body.responses:
        existing = db.query(ActivityPollResponse).filter(
            ActivityPollResponse.poll_id == pid,
            ActivityPollResponse.option_id == response.option_id,
            ActivityPollResponse.user_id == user.id,
        ).first()
        if existing:
            existing.status = response.status
        else:
            db.add(
                ActivityPollResponse(
                    poll_id=pid,
                    option_id=response.option_id,
                    user_id=user.id,
                    status=response.status,
                )
            )
    db.commit()
    return s_poll(poll, db, user.id)


@router.put("/polls/{pid}/confirm")
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


@router.delete("/polls/{pid}")
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


@router.put("/polls/{pid}/farewell")
def set_poll_farewell(pid: int, body: PollFarewellBody, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    poll = db.query(ActivityPoll).filter(ActivityPoll.id == pid).first()
    if not poll:
        raise HTTPException(404, "Poll not found")
    if poll.created_by_id == user.id:
        raise HTTPException(403, "The organizer cannot set a farewell gift link")
    poll.farewell_payment_url = body.farewell_payment_url.strip() or None
    db.commit()
    return {"ok": True}
