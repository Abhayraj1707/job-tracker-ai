import io
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends
from sqlalchemy.orm import Session
from pypdf import PdfReader
from typing import Optional
import json

from ..database import get_db
from .. import models, schemas
import os
import sys

# Add mcp-servers/job_search_server to python path so imports resolve reliably across working directories
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
candidates = [
    os.path.join(base_dir, "mcp-servers", "job_search_server"),
    os.path.join(os.path.dirname(base_dir), "mcp-servers", "job_search_server"),
    os.path.abspath(os.path.join(os.getcwd(), "..", "mcp-servers", "job_search_server")),
    os.path.abspath(os.path.join(os.getcwd(), "mcp-servers", "job_search_server")),
]
for p in candidates:
    if os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)

try:
    from cv_parser import parse_cv
    from ai_scoring import score_fit
    from sources.greenhouse import search_greenhouse
    from sources.adzuna import search_adzuna
    from sources.jsearch import search_jsearch
except ImportError:
    # Fallback if mcp-servers directory is outside backend root on deployed server
    import httpx

    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

    async def parse_cv(cv_text: str) -> dict:
        prompt = f"""Extract a structured profile from this CV. Respond ONLY with valid JSON, matching this shape:
{{"name": "", "titles": [], "years_experience": 2, "skills": [], "preferred_locations": ["Remote"], "summary": ""}}
CV TEXT:
{cv_text}"""
        async with httpx.AsyncClient(timeout=30) as client:
            if GROQ_API_KEY:
                models_to_try = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
                for model in models_to_try:
                    try:
                        resp = await client.post(
                            "https://api.groq.com/openai/v1/chat/completions",
                            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                            json={"model": model, "messages": [{"role": "user", "content": prompt}], "response_format": {"type": "json_object"}},
                        )
                        if resp.status_code == 200:
                            text = resp.json()["choices"][0]["message"]["content"]
                            return json.loads(text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip())
                    except Exception:
                        continue
            raise RuntimeError("Could not parse with LLM")

    async def score_fit(job_description: str, cv_profile: str) -> dict:
        prompt = f"""Score how well this job matches the CV profile (0-100) and give 1 short reason (max 20 words).
JSON shape: {{"score": 0, "reason": ""}}
CV: {cv_profile}
JOB: {job_description}"""
        async with httpx.AsyncClient(timeout=30) as client:
            if GROQ_API_KEY:
                models_to_try = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
                for model in models_to_try:
                    try:
                        resp = await client.post(
                            "https://api.groq.com/openai/v1/chat/completions",
                            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                            json={"model": model, "messages": [{"role": "user", "content": prompt}], "response_format": {"type": "json_object"}},
                        )
                        if resp.status_code == 200:
                            text = resp.json()["choices"][0]["message"]["content"]
                            return json.loads(text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip())
                    except Exception:
                        continue
        return {"score": None, "reason": "Scoring unavailable"}

    from datetime import datetime, timezone, timedelta
    async def search_greenhouse(companies=None, hours_old=72):
        companies = companies or ["stripe", "airbnb", "figma", "databricks", "coinbase", "uber", "pinterest", "gitlab", "instacart", "scale", "cloudflare", "discord", "reddit"]
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_old)
        all_jobs = []
        async with httpx.AsyncClient(timeout=15) as client:
            for slug in companies:
                try:
                    resp = await client.get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs", params={"content": "true"})
                    if resp.status_code != 200:
                        continue
                    data = resp.json()
                    for item in data.get("jobs", []):
                        all_jobs.append({
                            "source": f"greenhouse:{slug}",
                            "title": item.get("title", ""),
                            "company": slug,
                            "location": (item.get("location") or {}).get("name", ""),
                            "url": item.get("absolute_url", ""),
                            "description": "",
                            "posted_at": item.get("updated_at", ""),
                        })
                except Exception:
                    continue
        return all_jobs

    async def search_adzuna(*args, **kwargs): return []
    async def search_jsearch(*args, **kwargs): return []

router = APIRouter(prefix="/resume", tags=["resume"])

# Safe path that works across local, Docker, and Render root directories
CV_FILE_PATH = os.path.join(os.getcwd(), "cv_profile.json")
if not os.path.exists(CV_FILE_PATH):
    # Check alternate locations
    alt_paths = [
        os.path.join(base_dir, "scheduler", "cv_profile.json"),
        os.path.join(os.getcwd(), "scheduler", "cv_profile.json"),
    ]
    for alt in alt_paths:
        if os.path.exists(alt):
            CV_FILE_PATH = alt
            break

# In-memory status for on-demand fetch progress
pipeline_status = {
    "is_running": False,
    "last_run": None,
    "jobs_found": 0,
    "jobs_ingested": 0,
    "message": "Ready"
}


def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    if filename.lower().endswith(".pdf"):
        pdf = PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
        return text.strip()
    else:
        return file_bytes.decode("utf-8", errors="ignore").strip()


@router.get("/profile")
def get_current_profile():
    if os.path.exists(CV_FILE_PATH):
        try:
            with open(CV_FILE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "name": "Guest Candidate",
        "titles": ["Software Engineer"],
        "years_experience": 2,
        "skills": ["Python", "JavaScript", "React"],
        "preferred_locations": ["Remote"],
        "summary": "Upload your resume to get tailored AI job recommendations."
    }


@router.post("/upload")
async def upload_resume(file: UploadFile = File(...)):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    text = extract_text_from_file(contents, file.filename or "resume.txt")
    if not text or len(text) < 20:
        raise HTTPException(status_code=400, detail="Could not extract readable text from resume")

    try:
        profile = await parse_cv(text)
    except Exception as e:
        # Fallback profile if LLM parse fails
        profile = {
            "name": file.filename.rsplit(".", 1)[0].replace("_", " "),
            "titles": ["Software Engineer", "Developer"],
            "years_experience": 2,
            "skills": [w for w in ["Python", "Java", "Spring", "React", "Data", "Backend", "AI", "SQL"] if w.lower() in text.lower()],
            "preferred_locations": ["Remote", "India"],
            "summary": text[:250] + "..."
        }

    # Save to cv_profile.json
    try:
        dir_name = os.path.dirname(CV_FILE_PATH)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        with open(CV_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2)
    except Exception as save_err:
        print(f"[warn] Could not save cv_profile.json to disk: {save_err}")

    return {
        "message": "Resume parsed and profile saved successfully!",
        "profile": profile
    }


def is_title_relevant(title: str) -> bool:
    t = title.lower()
    non_tech = ["recruiter", "sales", "account executive", "marketing", "controller", "legal", "investigator", "finance", "hr ", "tax", "communications"]
    if any(k in t for k in non_tech):
        return False
    tech = ["engineer", "developer", "data", "software", "backend", "full stack", "ai", "ml", "python", "platform", "infrastructure", "systems", "analyst"]
    return any(k in t for k in tech)


async def run_pipeline_task():
    global pipeline_status
    pipeline_status["is_running"] = True
    pipeline_status["message"] = "Fetching fresh jobs from boards..."

    try:
        from ..database import SessionLocal
        db = SessionLocal()

        profile_data = get_current_profile()
        profile_str = json.dumps(profile_data)

        # Gather jobs from Greenhouse and available sources
        results = await search_greenhouse(hours_old=72)
        filtered = [j for j in results if is_title_relevant(j.get("title", ""))][:40]
        pipeline_status["jobs_found"] = len(filtered)
        pipeline_status["message"] = f"Scoring {len(filtered)} matching jobs with AI..."

        ingested = 0
        for job in filtered:
            fit = await score_fit(f"Title: {job.get('title')}\nCompany: {job.get('company')}\nLocation: {job.get('location')}\n{job.get('description', '')}", profile_str)
            score = fit.get("score")
            
            if score is not None and score >= 50:
                existing = db.query(models.Job).filter(
                    models.Job.title == job.get("title"),
                    models.Job.company == job.get("company")
                ).first()
                if not existing:
                    new_job = models.Job(
                        title=job.get("title"),
                        company=job.get("company"),
                        location=job.get("location"),
                        url=job.get("url"),
                        source=job.get("source"),
                        fit_score=score,
                        fit_reason=fit.get("reason"),
                        status="New"
                    )
                    db.add(new_job)
                    db.commit()
                    ingested += 1

        db.close()
        pipeline_status["jobs_ingested"] = ingested
        pipeline_status["message"] = f"Finished! Recommended {ingested} matching jobs."
    except Exception as e:
        pipeline_status["message"] = f"Error: {str(e)[:100]}"
    finally:
        pipeline_status["is_running"] = False


@router.post("/fetch-and-match")
async def trigger_fetch_and_match(background_tasks: BackgroundTasks):
    global pipeline_status
    if pipeline_status["is_running"]:
        return {"status": "already_running", "message": "Pipeline is already in progress"}
    
    background_tasks.add_task(run_pipeline_task)
    return {"status": "started", "message": "Job discovery and AI scoring started in background"}


@router.get("/pipeline-status")
def get_pipeline_status():
    return pipeline_status
