"""
Parses a raw CV (plain text, extracted from PDF beforehand) into a structured
JSON profile used for job matching. Run once, cache the result.

Usage:
    python cv_parser.py path/to/cv.txt > cv_profile.json
"""
import os
import sys
import json
import asyncio
import httpx

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = "claude-sonnet-4-6"

PARSE_PROMPT = """Extract a structured profile from this CV. Respond ONLY with valid JSON, \
no markdown, no preamble, matching this exact shape:

{{
  "name": "",
  "titles": ["most recent / most relevant job titles"],
  "years_experience": <number>,
  "skills": ["key technical and soft skills"],
  "preferred_locations": ["cities or 'Remote' if mentioned/inferable"],
  "summary": "2-3 sentence summary of the candidate for matching purposes"
}}

CV TEXT:
{cv_text}
"""


async def parse_cv(cv_text: str) -> dict:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not configured")

    prompt = PARSE_PROMPT.format(cv_text=cv_text)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": MODEL,
                "max_tokens": 500,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        resp.raise_for_status()
        data = resp.json()

    text = "".join(block["text"] for block in data.get("content", []) if block.get("type") == "text")
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(text)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python cv_parser.py path/to/cv.txt", file=sys.stderr)
        sys.exit(1)

    with open(sys.argv[1], "r", encoding="utf-8") as f:
        cv_text = f.read()

    profile = asyncio.run(parse_cv(cv_text))
    print(json.dumps(profile, indent=2))
