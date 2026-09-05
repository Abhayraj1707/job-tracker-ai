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
KEYWORDS = os.getenv("SEARCH_KEYWORDS", "software engineer, data engineer, python, ai, backend")
LOCATION = os.getenv("SEARCH_LOCATION", "")
MIN_FIT_SCORE_TO_KEEP = int(os.getenv("MIN_FIT_SCORE_TO_KEEP", "50"))  # Only keep relevant jobs (>= 50)
MAX_JOBS_TO_PROCESS = int(os.getenv("MAX_JOBS_TO_PROCESS", "50"))      # Cap to avoid rate limits
HOURS_OLD = int(os.getenv("HOURS_OLD", "72"))

CV_PROFILE_PATH = os.getenv("CV_PROFILE_PATH", "cv_profile.json")


def is_title_relevant(title: str, keywords_list: list[str]) -> bool:
    """Pre-filter non-engineering jobs (like sales, legal, marketing, etc.) before calling LLM."""
    t = title.lower()
    # If explicitly non-technical, skip immediately
    non_tech_skip = ["recruiter", "sales", "account executive", "marketing", "controller", "legal", "investigator", "finance", "hr ", "tax", "communications"]
    if any(k in t for k in non_tech_skip):
        return False
    # Technical keywords
    tech_match = ["engineer", "developer", "data", "software", "backend", "full stack", "ai", "ml", "python", "platform", "infrastructure", "systems"]
    return any(k in t for k in tech_match)


async def gather_jobs(target_titles: list[str] = None):
    results = await asyncio.gather(
        search_adzuna(KEYWORDS, LOCATION, max_days_old=1),
        search_jsearch(KEYWORDS, LOCATION, hours_old=24),
        search_greenhouse(hours_old=HOURS_OLD),
        return_exceptions=True,
    )
    all_raw = []
    for r in results:
        if isinstance(r, Exception):
            print(f"[warn] source failed: {r}", file=sys.stderr)
        else:
            all_raw.extend(j for j in r if "error" not in j)

    # Filter for tech/engineering relevance
    relevant = [j for j in all_raw if is_title_relevant(j.get("title", ""), target_titles or [])]
    return relevant[:MAX_JOBS_TO_PROCESS]


async def main():
    if not os.path.exists(CV_PROFILE_PATH):
        print(f"[error] {CV_PROFILE_PATH} not found. Run cv_parser.py first.", file=sys.stderr)
        sys.exit(1)

    with open(CV_PROFILE_PATH) as f:
        cv_profile = json.load(f)
    cv_profile_text = json.dumps(cv_profile)

    target_titles = cv_profile.get("titles", [])
    jobs = await gather_jobs(target_titles)
    print(f"[info] pre-filtered {len(jobs)} relevant engineering jobs for scoring")

    async with httpx.AsyncClient(timeout=30) as client:
        kept = 0
        for idx, job in enumerate(jobs, 1):
            fit = await score_fit(f"Title: {job.get('title')}\nCompany: {job.get('company')}\nLocation: {job.get('location')}\n{job.get('description', '')}", cv_profile_text)
            score = fit.get("score")
            print(f"[{idx}/{len(jobs)}] {job.get('title')} @ {job.get('company')} -> Score: {score} ({fit.get('reason')})")

            # Only ingest jobs that pass the minimum fit threshold
            if score is not None and score >= MIN_FIT_SCORE_TO_KEEP:
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
