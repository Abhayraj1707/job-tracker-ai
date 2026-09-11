from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional

from .. import models, schemas
from ..database import get_db
from ..schemas import NotesUpdate, FollowUpUpdate

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/", response_model=List[schemas.JobOut])
def list_jobs(
    status: Optional[str] = None,
    min_fit_score: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Job)
    if status:
        query = query.filter(models.Job.status == status)
    if min_fit_score is not None:
        query = query.filter(models.Job.fit_score >= min_fit_score)
    return query.order_by(desc(models.Job.fetched_at)).all()


@router.post("/", response_model=schemas.JobOut)
def ingest_job(job: schemas.JobCreate, db: Session = Depends(get_db)):
    """
    Called by the scheduler pipeline after search_jobs + score_job_fit.
    Deduplication strategy (in order):
      1. Same URL (different title wordings, same actual posting)
      2. Same normalised title + company (catches title case/punctuation variance)
    """
    # 1. URL-based dedup (most reliable — same link = same job)
    if job.url:
        existing = db.query(models.Job).filter(models.Job.url == job.url).first()
        if existing:
            return existing

    # 2. Normalised title + company dedup
    def normalise(s: str) -> str:
        import re
        return re.sub(r"[^a-z0-9]", "", (s or "").lower())

    norm_title = normalise(job.title)
    norm_company = normalise(job.company)

    for candidate in (
        db.query(models.Job)
        .filter(models.Job.company == job.company)
        .all()
    ):
        if normalise(candidate.title) == norm_title and normalise(candidate.company) == norm_company:
            return candidate

    db_job = models.Job(**job.model_dump(), status="New")
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    return db_job


@router.get("/dedupe", response_model=dict)
def find_duplicates(db: Session = Depends(get_db)):
    """Returns groups of likely duplicate jobs still in the DB."""
    import re
    def normalise(s: str) -> str:
        return re.sub(r"[^a-z0-9]", "", (s or "").lower())

    all_jobs = db.query(models.Job).all()
    seen: dict = {}
    duplicates = []

    for job in all_jobs:
        key = f"{normalise(job.title)}::{normalise(job.company)}"
        if key in seen:
            duplicates.append({"kept": seen[key], "duplicate_id": job.id, "title": job.title, "company": job.company})
        else:
            seen[key] = job.id

    return {"duplicate_count": len(duplicates), "duplicates": duplicates}


@router.patch("/{job_id}/status", response_model=schemas.JobOut)
def update_status(job_id: int, update: schemas.StatusUpdate, db: Session = Depends(get_db)):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    db_job.status = update.status
    db.commit()
    db.refresh(db_job)
    return db_job


@router.patch("/{job_id}/notes", response_model=schemas.JobOut)
def update_notes(job_id: int, update: NotesUpdate, db: Session = Depends(get_db)):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    db_job.notes = update.notes
    db.commit()
    db.refresh(db_job)
    return db_job


@router.patch("/{job_id}/follow-up", response_model=schemas.JobOut)
def update_follow_up(job_id: int, update: FollowUpUpdate, db: Session = Depends(get_db)):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    db_job.follow_up_date = update.follow_up_date
    db.commit()
    db.refresh(db_job)
    return db_job


@router.delete("/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(db_job)
    db.commit()
    return {"ok": True}
