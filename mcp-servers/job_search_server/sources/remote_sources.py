"""
RemoteOK and Himalayas free remote job board APIs.
Zero API keys needed. Both provide official public feeds for remote tech jobs.
"""
import httpx
from datetime import datetime, timezone
from typing import List, Dict


async def search_remoteok(hours_old: int = 168) -> List[Dict]:
    """
    Fetch remote tech jobs from RemoteOK public API.
    """
    url = "https://remoteok.com/api"
    headers = {"User-Agent": "Mozilla/5.0 (AI-Job-Tracker)"}
    jobs = []

    async with httpx.AsyncClient(timeout=15, headers=headers) as client:
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                return []
            data = resp.json()
        except Exception:
            return []

        # First element in RemoteOK API is often metadata (legal/terms)
        items = [d for d in data if isinstance(d, dict) and d.get("position") and d.get("company")]

        for item in items:
            title = item.get("position", "").strip()
            company = item.get("company", "").strip()
            location = item.get("location") or "Worldwide Remote"
            apply_url = item.get("url") or item.get("apply_url") or ""
            date_str = item.get("date", "")
            tags = item.get("tags") or []
            desc = item.get("description", "")[:500]

            # Append tags into description for rich AI skill matching
            if tags:
                desc = f"Skills: {', '.join(tags[:8])}. {desc}"

            jobs.append({
                "source": "remoteok",
                "title": title,
                "company": company,
                "location": f"Remote ({location})" if "remote" not in location.lower() else location,
                "url": apply_url,
                "description": desc,
                "salary_min": item.get("salary_min"),
                "salary_max": item.get("salary_max"),
                "posted_at": date_str,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            })

    return jobs


async def search_himalayas(hours_old: int = 168) -> List[Dict]:
    """
    Fetch remote developer jobs from Himalayas public API.
    """
    url = "https://himalayas.app/jobs/api"
    headers = {"User-Agent": "Mozilla/5.0 (AI-Job-Tracker)"}
    jobs = []

    async with httpx.AsyncClient(timeout=15, headers=headers) as client:
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                return []
            data = resp.json()
        except Exception:
            return []

        items = data.get("jobs", []) if isinstance(data, dict) else []

        for item in items:
            title = item.get("title", "").strip()
            company = item.get("companyName", "").strip()
            location = item.get("location") or "Remote (Worldwide)"
            apply_url = item.get("applicationLink") or item.get("url") or ""
            created_at = item.get("publishedAt") or item.get("createdAt") or ""
            excerpt = item.get("excerpt") or item.get("description") or ""

            jobs.append({
                "source": "himalayas",
                "title": title,
                "company": company,
                "location": location,
                "url": apply_url,
                "description": excerpt[:500],
                "salary_min": None,
                "salary_max": None,
                "posted_at": created_at,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            })

    return jobs
