from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: Optional[str] = Field(None, max_length=8000)
    category: Optional[str] = Field(None, max_length=100)
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    currency: str = Field("USD", max_length=10)
    deadline: Optional[datetime] = None
    skills: Optional[List[str]] = Field(None, max_length=50)
    experience_level: Optional[str] = Field(None, max_length=20)  # entry | intermediate | expert
    location: Optional[str] = Field(None, max_length=200)


class MatchInsightsRequest(BaseModel):
    project_ids: List[int] = Field(..., max_length=50)


class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=8000)
    category: Optional[str] = Field(None, max_length=100)
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    currency: Optional[str] = Field(None, max_length=10)
    deadline: Optional[datetime] = None
    status: Optional[str] = Field(None, max_length=20)  # open | in_progress | completed | cancelled
    skills: Optional[List[str]] = Field(None, max_length=50)
    experience_level: Optional[str] = Field(None, max_length=20)
    location: Optional[str] = Field(None, max_length=200)


class PortfolioHighlight(BaseModel):
    id: str = Field(..., max_length=64)
    title: str = Field(..., max_length=200)
    image: Optional[str] = Field(None, max_length=500)


class ProposalCreate(BaseModel):
    cover_letter: Optional[str] = Field(None, max_length=8000)
    proposed_amount: float
    proposed_days: Optional[int] = None
    # Up to 10 attachments, enforced again server-side.
    attachment_urls: Optional[List[str]] = Field(None, max_length=10)
    # Up to 4 portfolio pieces the freelancer chose to show the client with
    # this specific proposal — enforced client-side, snapshotted here so the
    # proposal still reads the same even if the portfolio changes later.
    highlighted_portfolio: Optional[List[PortfolioHighlight]] = Field(None, max_length=4)


class ProposalUpdate(BaseModel):
    """A freelancer revising a proposal that's still pending — same shape as
    creation, everything optional so only what changed needs to be sent."""
    cover_letter: Optional[str] = Field(None, max_length=8000)
    proposed_amount: Optional[float] = None
    proposed_days: Optional[int] = None
    attachment_urls: Optional[List[str]] = Field(None, max_length=10)
    highlighted_portfolio: Optional[List[PortfolioHighlight]] = Field(None, max_length=4)


class MilestoneInput(BaseModel):
    title: str = Field(..., max_length=200)
    description: Optional[str] = Field(None, max_length=4000)
    amount: float
    due_date: Optional[datetime] = None


class ProposalAccept(BaseModel):
    # If omitted, one milestone covering the full proposed amount is created.
    milestones: Optional[list[MilestoneInput]] = None


class MilestoneFundRequest(BaseModel):
    """The client's claim of having paid a milestone — same shape as
    PaymentRequest (see country_normalize.py's sibling comment on payments),
    reviewed by an admin before the milestone counts as funded."""
    amount: float
    currency: str = Field("USD", max_length=10)
    method: Optional[str] = Field(None, max_length=40)
    reference: Optional[str] = Field(None, max_length=300)
    receipt_url: Optional[str] = Field(None, max_length=500)
    note: Optional[str] = Field(None, max_length=2000)


class MilestoneDeliverRequest(BaseModel):
    deliverable_url: Optional[str] = Field(None, max_length=500)


class MilestonePaymentReview(BaseModel):
    admin_note: Optional[str] = Field(None, max_length=2000)


class MilestonePayoutRequest(BaseModel):
    milestone_id: int
    amount: float
    method: Optional[str] = Field(None, max_length=40)
    reference: Optional[str] = Field(None, max_length=300)
    admin_note: Optional[str] = Field(None, max_length=2000)


class PostCreate(BaseModel):
    text: str = Field(..., max_length=5000)
    image_url: Optional[str] = Field(None, max_length=500)


class PostUpdate(BaseModel):
    text: Optional[str] = Field(None, max_length=5000)
    image_url: Optional[str] = Field(None, max_length=500)


class CommentCreate(BaseModel):
    text: str = Field(..., max_length=2000)


class PostReportCreate(BaseModel):
    reason: Optional[str] = Field(None, max_length=1000)
