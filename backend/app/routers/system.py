import logging
import os
from typing import Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DbSession

from ..auth import get_current_user
from ..config import OFFICE_LAT, OFFICE_LNG, OFFICE_ADDRESS, OFFICE_NAME, load_settings, save_settings
from ..database import get_db
from ..models import LunchPlace, User
from ..services.places import enrich_geo

router = APIRouter()


@router.get("/config")
def get_config():
    settings = load_settings()
    return {
        "google_maps_api_key": os.getenv("GOOGLE_MAPS_API_KEY", ""),
        "office_lat": settings.get("office_lat", OFFICE_LAT),
        "office_lng": settings.get("office_lng", OFFICE_LNG),
        "office_address": settings.get("office_address", OFFICE_ADDRESS),
        "office_name": settings.get("office_name", OFFICE_NAME),
    }


class OfficeConfigUpdate(BaseModel):
    office_lat: float
    office_lng: float
    office_name: Optional[str] = None
    office_address: Optional[str] = None


async def _recalculate_all_walking(db: DbSession):
    places = db.query(LunchPlace).all()
    for place in places:
        await enrich_geo(place)
    db.commit()


@router.put("/config/office")
async def update_office_config(
    body: OfficeConfigUpdate,
    background_tasks: BackgroundTasks,
    db: DbSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    data = {k: v for k, v in body.dict().items() if v is not None}
    data["office_lat"] = body.office_lat
    data["office_lng"] = body.office_lng
    save_settings(data)
    background_tasks.add_task(_recalculate_all_walking, db)
    return {"ok": True}


@router.get("/weather")
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
        live_weather = data.get("liveweer", [{}])[0]
        if live_weather.get("fout"):
            raise HTTPException(502, live_weather["fout"])

        lunch = None
        for hourly in data.get("uur_verw", []):
            if "13:00" in hourly.get("uur", ""):
                lunch = {
                    "temp": hourly["temp"],
                    "image": hourly["image"],
                    "rain_mm": round(float(hourly.get("neersl") or 0), 1),
                }
                break

        return {
            "temp": live_weather.get("temp"),
            "description": live_weather.get("samenv"),
            "image": live_weather.get("image"),
            "wind_bft": live_weather.get("windbft"),
            "wind_dir": live_weather.get("windr"),
            "lunch": lunch,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Weather fetch failed: {exc}")


@router.get("/places-autocomplete")
async def places_autocomplete(q: str, _: User = Depends(get_current_user)):
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

    suggestions = []
    for suggestion in resp.json().get("suggestions", []):
        prediction = suggestion.get("placePrediction", {})
        if not prediction:
            continue
        fmt = prediction.get("structuredFormat", {})
        suggestions.append(
            {
                "place_id": prediction.get("placeId", ""),
                "main_text": fmt.get("mainText", {}).get("text", prediction.get("text", {}).get("text", "")),
                "secondary_text": fmt.get("secondaryText", {}).get("text", ""),
            }
        )
    return suggestions


@router.get("/place-details/{place_id}")
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
