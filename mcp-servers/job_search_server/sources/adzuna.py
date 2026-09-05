"""
Adzuna job source.
Free tier: 1,000 calls/month. Sign up at https://developer.adzuna.com/
Requires ADZUNA_APP_ID and ADZUNA_APP_KEY env vars.
"""
import os
import httpx
from datetime import datetime, timezone
from typing import List, Dict

ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID", "")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY", "")

# Adzuna country codes: in, us, gb, au, ca, de, fr, etc.
DEFAULT_COUNTRY = os.getenv("ADZUNA_COUNTRY", "in")


async def search_adzuna(keywords: str, location: str = "", max_days_old: int = 1) -> List[Dict]:
    """
    Search Adzuna for jobs. Returns normalized job dicts.
    max_days_old=1 approximates "posted in last 24h" (Adzuna doesn't support hour granularity).
    """
    if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
        return [{"error": "Adzuna credentials not configured. Set ADZUNA_APP_ID / ADZUNA_APP_KEY."}]

    url = f"https://api.adzuna.com/v1/api/jobs/{DEFAULT_COUNTRY}/search/1"
    params = {
        "app_id": ADZUNA_APP_ID,
        "app_key": ADZUNA_APP_KEY,
        "what": keywords,
        "where": location,
        "max_days_old": max_days_old,
        "results_per_page": 30,
        "sort_by": "date",
        "content-type": "application/json",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    jobs = []
    for item in data.get("results", []):
        jobs.append({
            "source": "adzuna",
            "title": item.get("title", "").strip(),
            "company": (item.get("company") or {}).get("display_name", "Unknown"),
            "location": (item.get("location") or {}).get("display_name", ""),
            "url": item.get("redirect_url", ""),
            "description": (item.get("description") or "")[:500],
            "salary_min": item.get("salary_min"),
            "salary_max": item.get("salary_max"),
            "posted_at": item.get("created", ""),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        })
    return jobs
