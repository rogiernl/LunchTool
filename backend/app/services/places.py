import os

import httpx

from ..config import OFFICE_ADDRESS, load_settings


async def enrich_geo(place):
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key or not place.address:
        return

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            if place.lat is None or place.lng is None:
                geo = await client.get(
                    "https://maps.googleapis.com/maps/api/geocode/json",
                    params={"address": place.address, "key": api_key},
                )
                geo_data = geo.json()
                if geo_data.get("status") == "OK" and geo_data.get("results"):
                    loc = geo_data["results"][0]["geometry"]["location"]
                    place.lat = loc["lat"]
                    place.lng = loc["lng"]

            settings = load_settings()
            origin = settings.get("office_address", OFFICE_ADDRESS)
            if settings.get("office_lat") and settings.get("office_lng"):
                origin = f"{settings['office_lat']},{settings['office_lng']}"
            destination = f"{place.lat},{place.lng}" if place.lat and place.lng else place.address
            dm = await client.get(
                "https://maps.googleapis.com/maps/api/distancematrix/json",
                params={
                    "origins": origin,
                    "destinations": destination,
                    "mode": "walking",
                    "key": api_key,
                },
            )
            dm_data = dm.json()
            rows = dm_data.get("rows", [])
            if rows and rows[0].get("elements"):
                element = rows[0]["elements"][0]
                if element.get("status") == "OK":
                    place.walking_minutes = round(element["duration"]["value"] / 60)
    except Exception:
        pass
