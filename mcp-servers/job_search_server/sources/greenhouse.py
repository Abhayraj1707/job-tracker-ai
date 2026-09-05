"""
Greenhouse public job board API.
No key required. Every company that uses Greenhouse exposes:
  https://boards-api.greenhouse.io/v1/boards/{company-slug}/jobs?content=true
Find a company's slug from its careers page URL, e.g. boards.greenhouse.io/stripe -> "stripe".
This is the most reliable "last 24h" source since it's the primary system of record.
"""
import httpx
from datetime import datetime, timezone, timedelta
from typing import List, Dict

# Add company slugs you care about here, or pass them in dynamically from the API layer.
DEFAULT_COMPANIES = ["stripe", "airbnb", "figma"]


async def search_greenhouse(companies: List[str] = None, hours_old: int = 24) -> List[Dict]:
    companies = companies or DEFAULT_COMPANIES
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_old)
    all_jobs = []

    async with httpx.AsyncClient(timeout=15) as client:
        for slug in companies:
            url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"
            try:
                resp = await client.get(url, params={"content": "true"})
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPStatusError:
                continue  # unknown slug or board not public, skip

            for item in data.get("jobs", []):
                updated_at = item.get("updated_at", "")
                try:
                    posted_dt = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
                except ValueError:
                    posted_dt = None

                if posted_dt and posted_dt < cutoff:
                    continue  # older than our window, skip

                all_jobs.append({
                    "source": f"greenhouse:{slug}",
                    "title": item.get("title", ""),
                    "company": slug,
                    "location": (item.get("location") or {}).get("name", ""),
                    "url": item.get("absolute_url", ""),
                    "description": "",  # full HTML in item["content"] if needed
                    "salary_min": None,
                    "salary_max": None,
                    "posted_at": updated_at,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                })
    return all_jobs
