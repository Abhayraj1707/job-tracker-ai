"""
Daily pipeline: search jobs from the last 24h, score fit against your CV profile,
and push new results into the tracker backend.

This calls the job-search logic directly (not over MCP stdio) since it's easier
to schedule as a plain script. The MCP server wraps the same underlying functions,
so an MCP client (Claude Desktop/Code) gets identical behavior interactively.

Run: python run_daily_pipeline.py
Schedule: see ../.github/workflows/daily-job-fetch.yml for a free GitHub Actions cron.
"""
import os
import sys
import json
import asyncio
import httpx

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "mcp-servers", "job_search_server"))

from sources.adzuna import search_adzuna       # noqa: E402
from sources.jsearch import search_jsearch     # noqa: E402
from sources.greenhouse import search_greenhouse  # noqa: E402
from ai_scoring import score_fit               # noqa: E402

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
KEYWORDS = os.getenv("SEARCH_KEYWORDS", "software engineer")
LOCATION = os.getenv("SEARCH_LOCATION", "")
MIN_FIT_SCORE_TO_KEEP = int(os.getenv("MIN_FIT_SCORE_TO_KEEP", "0"))  # 0 = keep everything, scored

CV_PROFILE_PATH = os.getenv("CV_PROFILE_PATH", "cv_profile.json")


async def gather_jobs():
    results = await asyncio.gather(
        search_adzuna(KEYWORDS, LOCATION, max_days_old=1),
        search_jsearch(KEYWORDS, LOCATION, hours_old=24),
        search_greenhouse(hours_old=24),
        return_exceptions=True,
    )
    jobs = []
    for r in results:
        if isinstance(r, Exception):
            print(f"[warn] source failed: {r}", file=sys.stderr)
        else:
            jobs.extend(j for j in r if "error" not in j)
    return jobs


async def main():
    if not os.path.exists(CV_PROFILE_PATH):
        print(f"[error] {CV_PROFILE_PATH} not found. Run cv_parser.py first.", file=sys.stderr)
        sys.exit(1)

    with open(CV_PROFILE_PATH) as f:
        cv_profile = json.load(f)
    cv_profile_text = json.dumps(cv_profile)

    jobs = await gather_jobs()
    print(f"[info] fetched {len(jobs)} raw jobs")

    async with httpx.AsyncClient(timeout=30) as client:
        kept = 0
        for job in jobs:
            fit = await score_fit(job.get("description", job.get("title", "")), cv_profile_text)
            score = fit.get("score")
            if score is not None and score < MIN_FIT_SCORE_TO_KEEP:
                continue

            payload = {
                "source": job.get("source"),
                "title": job.get("title"),
                "company": job.get("company"),
                "location": job.get("location"),
                "url": job.get("url"),
                "description": job.get("description"),
                "salary_min": job.get("salary_min"),
                "salary_max": job.get("salary_max"),
                "posted_at": job.get("posted_at"),
                "fit_score": score,
                "fit_reason": fit.get("reason"),
            }
            resp = await client.post(f"{BACKEND_URL}/jobs/", json=payload)
            if resp.status_code == 200:
                kept += 1

    print(f"[info] ingested {kept} jobs into tracker")


if __name__ == "__main__":
    asyncio.run(main())
