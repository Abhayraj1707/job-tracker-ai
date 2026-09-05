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
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

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
    prompt = PARSE_PROMPT.format(cv_text=cv_text)

    async with httpx.AsyncClient(timeout=30) as client:
        if GROQ_API_KEY:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"]
        elif GEMINI_API_KEY:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            resp = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json={"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"response_mime_type": "application/json"}},
            )
            resp.raise_for_status()
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        elif ANTHROPIC_API_KEY:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={"model": "claude-sonnet-4-6", "max_tokens": 500, "messages": [{"role": "user", "content": prompt}]},
            )
            resp.raise_for_status()
            text = "".join(block["text"] for block in resp.json().get("content", []) if block.get("type") == "text")
        else:
            raise RuntimeError("No LLM API key configured. Set GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY in .env")

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
