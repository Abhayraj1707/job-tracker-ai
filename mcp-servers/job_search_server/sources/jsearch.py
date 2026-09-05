"""
JSearch (via RapidAPI) job source.
Reads Google for Jobs results, which surfaces LinkedIn, Indeed, Glassdoor, ZipRecruiter
listings without you needing to scrape those sites directly.
Sign up (free tier) at https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
Requires RAPIDAPI_KEY env var.
"""
import os
import httpx
from datetime import datetime, timezone
from typing import List, Dict

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "")
JSEARCH_HOST = "jsearch.p.rapidapi.com"


async def search_jsearch(keywords: str, location: str = "", hours_old: int = 24) -> List[Dict]:
    """
    Search via JSearch. date_posted filter options: all, today, 3days, week, month.
    We map hours_old<=24 -> 'today' since that's the finest granularity JSearch offers.
    """
    if not RAPIDAPI_KEY:
        return [{"error": "RapidAPI key not configured. Set RAPIDAPI_KEY."}]

    date_posted = "today" if hours_old <= 24 else "3days"
    query = f"{keywords} in {location}" if location else keywords

    url = "https://jsearch.p.rapidapi.com/search"
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": JSEARCH_HOST,
    }
    params = {
        "query": query,
        "page": "1",
        "num_pages": "1",
        "date_posted": date_posted,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, headers=headers, params=params)
        resp.raise_for_status()
        data = resp.json()

    jobs = []
    for item in data.get("data", []):
        jobs.append({
            "source": item.get("job_publisher", "jsearch"),
            "title": item.get("job_title", ""),
            "company": item.get("employer_name", "Unknown"),
            "location": item.get("job_city") or item.get("job_country", ""),
            "url": item.get("job_apply_link", ""),
            "description": (item.get("job_description") or "")[:500],
            "salary_min": item.get("job_min_salary"),
            "salary_max": item.get("job_max_salary"),
            "posted_at": item.get("job_posted_at_datetime_utc", ""),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        })
    return jobs
