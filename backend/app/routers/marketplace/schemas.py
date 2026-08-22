from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    currency: str = "USD"
    deadline: Optional[datetime] = None


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    currency: Optional[str] = None
    deadline: Optional[datetime] = None
    status: Optional[str] = None  # open | in_progress | completed | cancelled


class ProposalCreate(BaseModel):
    cover_letter: Optional[str] = None
    proposed_amount: float
    proposed_days: Optional[int] = None


class MilestoneInput(BaseModel):
    title: str
    description: Optional[str] = None
    amount: float
    due_date: Optional[datetime] = None


class ProposalAccept(BaseModel):
    # If omitted, one milestone covering the full proposed amount is created.
    milestones: Optional[list[MilestoneInput]] = None
