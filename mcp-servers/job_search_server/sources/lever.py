"""
Lever public job board API.
No key required. Companies using Lever expose public postings at:
  https://api.lever.co/v0/postings/{company-slug}?mode=json

Popular Indian tech companies and global teams on Lever:
  - meesho (Bangalore)
  - cred (Bangalore)
  - paytm (Noida/Bangalore/Mumbai)
  - mindtickle (Pune)
  - pocketfm (Bangalore)
  - chargebee, hasura, whatfix, clevertap, atlan
"""
import httpx
from datetime import datetime, timezone, timedelta
from typing import List, Dict

DEFAULT_LEVER_COMPANIES = [
    "meesho",
    "cred",
    "paytm",
    "mindtickle",
    "pocketfm",
    "chargebee",
    "hasura",
    "whatfix",
    "clevertap",
    "atlan",
    "innovaccer",
    "yellowai"
]


async def search_lever(companies: List[str] = None, hours_old: int = 168) -> List[Dict]:
    """
    Search public Lever postings for specified companies.
    hours_old: lookback window (default 7 days / 168 hours).
    """
    companies = companies or DEFAULT_LEVER_COMPANIES
    cutoff_ms = (datetime.now(timezone.utc) - timedelta(hours=hours_old)).timestamp() * 1000
    all_jobs = []

    async with httpx.AsyncClient(timeout=15) as client:
        for slug in companies:
            url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
            try:
                resp = await client.get(url)
                if resp.status_code != 200:
                    continue
                data = resp.json()
            except Exception:
                continue

            for item in data:
                created_at = item.get("createdAt")  # epoch milliseconds
                if created_at and created_at < cutoff_ms:
                    continue

                categories = item.get("categories") or {}
                location = categories.get("location") or ""
                team = categories.get("team") or ""
                commitment = categories.get("commitment") or ""

                loc_str = location
                if commitment and commitment.lower() != "full-time":
                    loc_str = f"{loc_str} ({commitment})" if loc_str else commitment

                posted_dt = (
                    datetime.fromtimestamp(created_at / 1000, tz=timezone.utc).isoformat()
                    if created_at
                    else ""
                )

                all_jobs.append({
                    "source": f"lever:{slug}",
                    "title": item.get("text", "").strip(),
                    "company": slug.capitalize(),
                    "location": loc_str,
                    "url": item.get("hostedUrl", ""),
                    "description": item.get("descriptionPlain", "")[:600],
                    "salary_min": None,
                    "salary_max": None,
                    "posted_at": posted_dt,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                })

    return all_jobs
