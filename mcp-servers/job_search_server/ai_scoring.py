"""
AI job-fit scoring using the Anthropic API.
Requires ANTHROPIC_API_KEY env var.
"""
import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

SCORING_PROMPT = """You are a job-matching assistant. Given a candidate's CV profile and a job \
description, score how well they match from 0-100 and give exactly one short reason (max 20 words).

Respond ONLY with valid JSON, no markdown, no preamble:
{{"score": <int 0-100>, "reason": "<short reason>"}}

CV PROFILE:
{cv_profile}

JOB DESCRIPTION:
{job_description}
"""


async def score_with_groq(prompt: str) -> str:
    """Free tier with Groq."""
    models_to_try = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
    last_err = None

    async with httpx.AsyncClient(timeout=30) as client:
        for model in models_to_try:
            try:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.1,
                        "response_format": {"type": "json_object"},
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    last_err = resp.text
            except Exception as e:
                last_err = str(e)
                continue

    raise RuntimeError(f"Groq error: {last_err}")


async def score_with_gemini(prompt: str) -> str:
    """Free tier with Google Gemini 1.5 Flash."""
    async with httpx.AsyncClient(timeout=30) as client:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        resp = await client.post(
            url,
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"response_mime_type": "application/json"},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def score_with_anthropic(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 200,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return "".join(block["text"] for block in data.get("content", []) if block.get("type") == "text")


async def score_fit(job_description: str, cv_profile: str) -> dict:
    prompt = SCORING_PROMPT.format(cv_profile=cv_profile, job_description=job_description)

    try:
        if GROQ_API_KEY:
            text = await score_with_groq(prompt)
        elif GEMINI_API_KEY:
            text = await score_with_gemini(prompt)
        elif ANTHROPIC_API_KEY:
            text = await score_with_anthropic(prompt)
        else:
            return {"score": None, "reason": "No LLM API key configured (set GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY)"}

        text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(text)
    except Exception as e:
        return {"score": None, "reason": f"Scoring error: {str(e)[:100]}"}
