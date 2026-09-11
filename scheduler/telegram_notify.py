"""
Telegram notification for daily job digest.
Sends top high-match jobs to a Telegram chat after the pipeline runs.

Required env vars:
  TELEGRAM_BOT_TOKEN  — from @BotFather
  TELEGRAM_CHAT_ID    — your personal chat ID
  TELEGRAM_MIN_FLOOR  — minimum score floor; jobs below this are excluded even from top-5 (default: 50)
  TELEGRAM_MAX_JOBS   — max jobs to send in one message (default: 5)
"""
import os
import httpx
from datetime import date

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
TELEGRAM_MIN_FLOOR = int(os.getenv("TELEGRAM_MIN_FLOOR", "50"))
TELEGRAM_MAX_JOBS = int(os.getenv("TELEGRAM_MAX_JOBS", "5"))


def _escape(text: str) -> str:
    """Escape special chars for Telegram MarkdownV2."""
    for ch in r"\_*[]()~`>#+-=|{}.!":
        text = text.replace(ch, f"\\{ch}")
    return text


async def _count_overdue_followups(backend_url: str) -> int:
    """
    Calls the tracker backend to count Applied/Interview jobs with a
    follow_up_date that has already passed today.
    Returns 0 on any error so the digest still sends.
    """
    today = date.today().isoformat()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{backend_url}/jobs/")
            if resp.status_code != 200:
                return 0
            jobs = resp.json()
            return sum(
                1 for j in jobs
                if j.get("follow_up_date")
                and j.get("status") in ("Applied", "Interview")
                and j["follow_up_date"] < today
            )
    except Exception as e:
        print(f"[telegram] Could not fetch follow-up count: {e}")
        return 0


async def send_daily_digest(ingested_jobs: list[dict], backend_url: str = "") -> bool:
    """
    Send a Telegram message with top high-match jobs from today's pipeline run.

    Selection logic:
      - Sort all ingested jobs by fit_score descending.
      - Take the top TELEGRAM_MAX_JOBS that score >= TELEGRAM_MIN_FLOOR (default 50).
      - If the best job is below the floor, skip the message entirely.

    ingested_jobs: list of dicts with keys title, company, location, url, fit_score, fit_reason
    backend_url:   base URL of the tracker API, used to count overdue follow-ups.
    Returns True if message was sent successfully.
    """
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("[telegram] Skipping — TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set.")
        return False

    # Sort all candidates and apply floor — always top 5, but nothing below 50%
    candidates = sorted(
        ingested_jobs,
        key=lambda j: j.get("fit_score", 0),
        reverse=True,
    )
    top_jobs = [j for j in candidates if (j.get("fit_score") or 0) >= TELEGRAM_MIN_FLOOR][:TELEGRAM_MAX_JOBS]

    if not top_jobs:
        print(f"[telegram] Best job scored below floor ({TELEGRAM_MIN_FLOOR}%) — skipping notification.")
        return False

    # Count overdue follow-ups from the tracker DB (via API)
    overdue_count = await _count_overdue_followups(backend_url) if backend_url else 0

    # Build message header
    lines = [f"🎯 *Top {len(top_jobs)} Match{'es' if len(top_jobs) > 1 else ''} Today\\!*\n"]

    for job in top_jobs:
        score = job.get("fit_score", "?")
        title = _escape(job.get("title", "Unknown Role"))
        company = _escape(job.get("company", "Unknown Company"))
        location = _escape(job.get("location", ""))
        reason = _escape((job.get("fit_reason") or "")[:120])
        url = job.get("url", "")

        # Score emoji
        if score >= 90:
            score_emoji = "🟢"
        elif score >= 80:
            score_emoji = "🟡"
        else:
            score_emoji = "🔵"

        lines.append(f"{score_emoji} *{score}% Match* — {title}")
        lines.append(f"🏢 {company}")
        if location:
            lines.append(f"📍 {location}")
        if reason:
            lines.append(f"💡 _{reason}_")
        if url:
            lines.append(f"[Apply Now ↗]({url})")
        lines.append("")  # blank line between jobs

    # Overdue follow-up reminder
    if overdue_count > 0:
        nudge = _escape(f"You have {overdue_count} overdue follow-up{'s' if overdue_count > 1 else ''}  — don't miss your window!")
        lines.append(f"🔔 _{nudge}_\n")

    lines.append("_Powered by AI Job Tracker_")
    message = "\n".join(lines)

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "MarkdownV2",
        "disable_web_page_preview": True,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                print(f"[telegram] Sent digest with {len(top_jobs)} jobs.")
                return True
            else:
                print(f"[telegram] Failed: {resp.status_code} — {resp.text[:200]}")
                return False
        except Exception as e:
            print(f"[telegram] Error: {e}")
            return False
