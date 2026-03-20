from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DbSession

from ..auth import get_current_user
from ..database import get_db
from ..models import User
from ..schemas import UpdateName
from ..serializers import s_user

router = APIRouter()


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return s_user(user)


@router.put("/me")
def update_me(body: UpdateName, user: User = Depends(get_current_user), db: DbSession = Depends(get_db)):
    user.friendly_name = body.friendly_name
    db.commit()
    db.refresh(user)
    return s_user(user)
