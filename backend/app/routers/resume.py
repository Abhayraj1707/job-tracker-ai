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

from cv_parser import parse_cv
from ai_scoring import score_fit
from sources.greenhouse import search_greenhouse
from sources.adzuna import search_adzuna
from sources.jsearch import search_jsearch

router = APIRouter(prefix="/resume", tags=["resume"])

CV_FILE_PATH = os.path.join(base_dir, "scheduler", "cv_profile.json")

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
            "name": file.filename.rsplit(".", 1)[0],
            "titles": ["Software Engineer", "Developer"],
            "years_experience": 2,
            "skills": [w for w in ["Python", "React", "Data", "Backend", "AI", "SQL"] if w.lower() in text.lower()],
            "preferred_locations": ["Remote", "India"],
            "summary": text[:250] + "..."
        }

    # Save to cv_profile.json
    os.makedirs(os.path.dirname(CV_FILE_PATH), exist_ok=True)
    with open(CV_FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(profile, f, indent=2)

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
