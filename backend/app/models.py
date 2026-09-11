from sqlalchemy import Column, Integer, String, Text, Float, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from .database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String, index=True)
    title = Column(String, index=True)
    company = Column(String, index=True)
    location = Column(String)
    url = Column(String)
    description = Column(Text)
    salary_min = Column(Float, nullable=True)
    salary_max = Column(Float, nullable=True)
    posted_at = Column(String)          # raw ISO string from source
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())

    fit_score = Column(Integer, nullable=True)
    fit_reason = Column(String, nullable=True)

    # Applied / Saved / Interview / Rejected / Offer
    status = Column(String, default="New", index=True)

    # User notes
    notes = Column(Text, nullable=True)

    # Follow-up reminder date (ISO date string: YYYY-MM-DD)
    follow_up_date = Column(String, nullable=True)

    __table_args__ = (
        UniqueConstraint("title", "company", name="uq_title_company"),
    )
