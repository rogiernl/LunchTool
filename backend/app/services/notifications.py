import logging

import httpx

from ..config import load_settings


async def notify_teams(message: str):
    url = load_settings().get("teams_webhook_url")
    if not url:
        return
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(url, json={"text": message})
    except Exception as exc:
        logging.warning("Teams notification failed: %s", exc)
