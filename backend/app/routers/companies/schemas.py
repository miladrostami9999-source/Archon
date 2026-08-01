from typing import Optional, List
from pydantic import BaseModel


class CompanyCreate(BaseModel):
    name: str
    domain: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    instagram: Optional[str] = None
    linkedin: Optional[str] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    instagram: Optional[str] = None
    linkedin: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[str] = None
    is_favorite: Optional[bool] = None
    heat_level: Optional[str] = None
    ai_summary: Optional[str] = None
    opportunity_score: Optional[float] = None


class NoteCreate(BaseModel):
    content: str
    language: str = "en"
    pinned: bool = False


class NoteUpdate(BaseModel):
    pinned: bool


class EmailRequest(BaseModel):
    tone: str = "friendly"


class ContactCreate(BaseModel):
    full_name: str
    role: Optional[str] = None
    email: Optional[str] = None
    linkedin: Optional[str] = None
    is_primary: bool = False


class SearchRequest(BaseModel):
    query: str


class TaskGenerateRequest(BaseModel):
    lang: str = "en"


class PersonalTaskCreate(BaseModel):
    title: str
    description: str = ""


class ReportRequest(BaseModel):
    lang: str = "en"


class EmailAttachment(BaseModel):
    filename: str
    content_base64: str  # base64-encoded file content
    mime_type: str = "application/octet-stream"


class SendEmailRequest(BaseModel):
    to_email: str
    subject: str
    body: str
    campaign_id: Optional[int] = None
    attachments: Optional[list[EmailAttachment]] = None


class DiscoverRequest(BaseModel):
    country: Optional[str] = None
    industry: Optional[str] = None
    count: int = 5


class DiscoveredCompany(BaseModel):
    name: str
    website: Optional[str] = None
    email: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    linkedin: Optional[str] = None
    instagram: Optional[str] = None


class DiscoverSaveRequest(BaseModel):
    companies: List[DiscoveredCompany] = []


# ── Lead Hunter ────────────────────────────────────────────────────────────
class HuntRequest(BaseModel):
    """Criteria for one lead hunt. Every field is optional — an empty hunt is
    a broad search, and each field narrows it."""
    sources: List[str] = []            # keys from services/discovery_sources.py
    countries: Optional[str] = None    # free text, comma separated
    cities: Optional[str] = None
    segments: List[str] = []           # business type
    project_types: List[str] = []
    company_sizes: List[str] = []
    signals: List[str] = []            # buying-intent signals to prioritise
    languages: Optional[str] = None
    require_website: bool = True
    require_email: bool = False
    min_score: int = 0
    count: int = 10
    brief: Optional[str] = None        # free-text extra instruction
    hunt_id: Optional[int] = None      # set when re-running a saved hunt
    # Which search backend to use: serper | brave | anthropic. Null picks the
    # cheapest configured one. Different indexes surface different firms, so
    # this is a quality lever as much as a cost one.
    search_provider: Optional[str] = None


class ScoutedCompany(BaseModel):
    """What stage 1 knows: enough to decide whether to research further."""
    name: str
    website: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    segment: Optional[str] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    note: Optional[str] = None


class EnrichRequest(BaseModel):
    """Stage 2 — research and score only the candidates the admin kept."""
    companies: List[ScoutedCompany] = []
    criteria: dict = {}
    hunt_id: Optional[int] = None


class HuntedCompany(DiscoveredCompany):
    phone: Optional[str] = None
    segment: Optional[str] = None
    employee_count: Optional[int] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    evidence: Optional[str] = None
    confidence: Optional[str] = None
    why: Optional[str] = None
    # Facts that feed the score. The score itself is recomputed server-side —
    # whatever the client sends for it is ignored.
    signals: List[str] = []
    style_fit: Optional[int] = 0
    score: Optional[float] = None


class HuntSaveRequest(BaseModel):
    companies: List[HuntedCompany] = []
    run_id: Optional[int] = None


class SavedHuntCreate(BaseModel):
    name: str
    criteria: dict = {}
