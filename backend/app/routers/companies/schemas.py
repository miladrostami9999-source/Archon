from typing import Optional
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
