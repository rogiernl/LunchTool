from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DbSession

from ..auth import get_current_user
from ..database import get_db
from ..models import LunchPlace, PlaceLike, User
from ..schemas import PlaceCreate
from ..serializers import s_place
from ..services.places import enrich_geo

router = APIRouter()


@router.get("/places")
def list_places(db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    places = db.query(LunchPlace).all()
    serialized = [s_place(place, db=db, user_id=user.id) for place in places]
    serialized.sort(key=lambda place: (-place["like_count"], place["name"].lower()))
    return serialized


@router.post("/places")
async def create_place(body: PlaceCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    place = LunchPlace(**body.model_dump(), added_by_id=user.id)
    db.add(place)
    db.commit()
    db.refresh(place)
    await enrich_geo(place)
    db.commit()
    db.refresh(place)
    return s_place(place)


@router.put("/places/{pid}")
async def update_place(pid: int, body: PlaceCreate, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    place = db.query(LunchPlace).filter(LunchPlace.id == pid).first()
    if not place:
        raise HTTPException(404, "Not found")
    for key, value in body.model_dump().items():
        setattr(place, key, value)
    db.commit()
    db.refresh(place)
    await enrich_geo(place)
    db.commit()
    db.refresh(place)
    return s_place(place)


@router.delete("/places/{pid}")
def delete_place(pid: int, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    place = db.query(LunchPlace).filter(LunchPlace.id == pid).first()
    if not place:
        raise HTTPException(404, "Not found")
    if place.added_by_id != user.id:
        raise HTTPException(403, "Not your place")
    db.delete(place)
    db.commit()
    return {"ok": True}


@router.post("/places/{pid}/like")
def toggle_like(pid: int, db: DbSession = Depends(get_db), user: User = Depends(get_current_user)):
    place = db.query(LunchPlace).filter(LunchPlace.id == pid).first()
    if not place:
        raise HTTPException(404, "Not found")

    existing = db.query(PlaceLike).filter(PlaceLike.place_id == pid, PlaceLike.user_id == user.id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"liked": False}

    db.add(PlaceLike(place_id=pid, user_id=user.id))
    db.commit()
    return {"liked": True}
