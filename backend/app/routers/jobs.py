from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional

from .. import models, schemas
from ..database import get_db
from ..schemas import NotesUpdate

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
    Skips insert if (title, company) already exists — keeps the feed deduplicated.
    """
    existing = (
        db.query(models.Job)
        .filter(models.Job.title == job.title, models.Job.company == job.company)
        .first()
    )
    if existing:
        return existing

    db_job = models.Job(**job.model_dump(), status="New")
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    return db_job


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


@router.delete("/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(db_job)
    db.commit()
    return {"ok": True}
