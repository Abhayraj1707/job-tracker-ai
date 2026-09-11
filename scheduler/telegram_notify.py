"""
Telegram notification for daily job digest.
Sends top high-match jobs to a Telegram chat after the pipeline runs.

Required env vars:
  TELEGRAM_BOT_TOKEN  — from @BotFather
  TELEGRAM_CHAT_ID    — your personal chat ID
  TELEGRAM_MIN_SCORE  — minimum fit score to include (default: 75)
  TELEGRAM_MAX_JOBS   — max jobs to send in one message (default: 5)
"""
import os
import httpx

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
TELEGRAM_MIN_SCORE = int(os.getenv("TELEGRAM_MIN_SCORE", "75"))
TELEGRAM_MAX_JOBS = int(os.getenv("TELEGRAM_MAX_JOBS", "5"))


def _escape(text: str) -> str:
    """Escape special chars for Telegram MarkdownV2."""
    for ch in r"\_*[]()~`>#+-=|{}.!":
        text = text.replace(ch, f"\\{ch}")
    return text


async def send_daily_digest(ingested_jobs: list[dict]) -> bool:
    """
    Send a Telegram message with top high-match jobs from today's pipeline run.
    ingested_jobs: list of dicts with keys title, company, location, url, fit_score, fit_reason
    Returns True if message was sent successfully.
    """
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("[telegram] Skipping — TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set.")
        return False

    # Filter and sort by score
    top_jobs = sorted(
        [j for j in ingested_jobs if (j.get("fit_score") or 0) >= TELEGRAM_MIN_SCORE],
        key=lambda j: j.get("fit_score", 0),
        reverse=True,
    )[:TELEGRAM_MAX_JOBS]

    if not top_jobs:
        print(f"[telegram] No jobs scored >= {TELEGRAM_MIN_SCORE}% today — skipping notification.")
        return False

    # Build message
    lines = [f"🎯 *{len(top_jobs)} High\\-Match Job{'s' if len(top_jobs) > 1 else ''} Today\\!*\n"]

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
