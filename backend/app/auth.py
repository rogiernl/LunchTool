import os

from fastapi import Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DbSession

from .database import get_db
from .models import User


def get_current_user(request: Request, db: DbSession = Depends(get_db)) -> User:
    email = request.headers.get("Cf-Access-Authenticated-User-Email")
    if not email:
        email = os.getenv("DEV_EMAIL")
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated via Cloudflare Zero Trust")

    user = db.query(User).filter(User.email == email).first()
    if user:
        return user

    try:
        user = User(email=email)
        db.add(user)
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        user = db.query(User).filter(User.email == email).first()

    return user
