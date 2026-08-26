from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    currency: str = "USD"
    deadline: Optional[datetime] = None
    skills: Optional[List[str]] = None
    experience_level: Optional[str] = None  # entry | intermediate | expert
    location: Optional[str] = None


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    currency: Optional[str] = None
    deadline: Optional[datetime] = None
    status: Optional[str] = None  # open | in_progress | completed | cancelled
    skills: Optional[List[str]] = None
    experience_level: Optional[str] = None
    location: Optional[str] = None


class PortfolioHighlight(BaseModel):
    id: str
    title: str
    image: Optional[str] = None


class ProposalCreate(BaseModel):
    cover_letter: Optional[str] = None
    proposed_amount: float
    proposed_days: Optional[int] = None
    # Up to 10 attachments, enforced again server-side.
    attachment_urls: Optional[List[str]] = None
    # Up to 4 portfolio pieces the freelancer chose to show the client with
    # this specific proposal — enforced client-side, snapshotted here so the
    # proposal still reads the same even if the portfolio changes later.
    highlighted_portfolio: Optional[List[PortfolioHighlight]] = None


class ProposalUpdate(BaseModel):
    """A freelancer revising a proposal that's still pending — same shape as
    creation, everything optional so only what changed needs to be sent."""
    cover_letter: Optional[str] = None
    proposed_amount: Optional[float] = None
    proposed_days: Optional[int] = None
    attachment_urls: Optional[List[str]] = None
    highlighted_portfolio: Optional[List[PortfolioHighlight]] = None


class MilestoneInput(BaseModel):
    title: str
    description: Optional[str] = None
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
    currency: str = "USD"
    method: Optional[str] = None
    reference: Optional[str] = None
    receipt_url: Optional[str] = None
    note: Optional[str] = None


class MilestoneDeliverRequest(BaseModel):
    deliverable_url: Optional[str] = None


class MilestonePaymentReview(BaseModel):
    admin_note: Optional[str] = None


class MilestonePayoutRequest(BaseModel):
    milestone_id: int
    amount: float
    method: Optional[str] = None
    reference: Optional[str] = None
    admin_note: Optional[str] = None


class PostCreate(BaseModel):
    text: str
    image_url: Optional[str] = None


class PostUpdate(BaseModel):
    text: Optional[str] = None
    image_url: Optional[str] = None


class CommentCreate(BaseModel):
    text: str


class PostReportCreate(BaseModel):
    reason: Optional[str] = None
