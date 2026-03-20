import logging
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException

from ..auth import get_current_user
from ..config import OFFICE_LAT, OFFICE_LNG
from ..models import User

router = APIRouter()


@router.get("/config")
def get_config():
    return {
        "google_maps_api_key": os.getenv("GOOGLE_MAPS_API_KEY", ""),
        "office_lat": OFFICE_LAT,
        "office_lng": OFFICE_LNG,
        "office_name": "VodafoneZiggo Utrecht",
    }


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
