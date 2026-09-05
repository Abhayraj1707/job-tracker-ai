from pydantic import BaseModel
from typing import Optional


class JobOut(BaseModel):
    id: int
    source: Optional[str] = None
    title: str
    company: str
    location: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    posted_at: Optional[str] = None
    fit_score: Optional[int] = None
    fit_reason: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class JobCreate(BaseModel):
    source: Optional[str] = None
    title: str
    company: str
    location: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    posted_at: Optional[str] = None
    fit_score: Optional[int] = None
    fit_reason: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str
