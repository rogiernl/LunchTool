from datetime import date, datetime, time

from ..models import LunchSession


def voting_open(session: LunchSession) -> bool:
    deadline = session.vote_deadline or datetime.combine(session.date, time(11, 0))
    return datetime.now() < deadline


def get_today(db):
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
