"""
AI job-fit scoring using the Anthropic API.
Requires ANTHROPIC_API_KEY env var.
"""
import os
import json
import httpx

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = "claude-sonnet-4-6"

SCORING_PROMPT = """You are a job-matching assistant. Given a candidate's CV profile and a job \
description, score how well they match from 0-100 and give exactly one short reason (max 20 words).

Respond ONLY with valid JSON, no markdown, no preamble:
{{"score": <int 0-100>, "reason": "<short reason>"}}

CV PROFILE:
{cv_profile}

JOB DESCRIPTION:
{job_description}
"""


async def score_fit(job_description: str, cv_profile: str) -> dict:
    if not ANTHROPIC_API_KEY:
        return {"score": None, "reason": "ANTHROPIC_API_KEY not configured"}

    prompt = SCORING_PROMPT.format(cv_profile=cv_profile, job_description=job_description)

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
                "max_tokens": 200,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        resp.raise_for_status()
        data = resp.json()

    text = "".join(block["text"] for block in data.get("content", []) if block.get("type") == "text")
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"score": None, "reason": f"Could not parse model output: {text[:100]}"}
