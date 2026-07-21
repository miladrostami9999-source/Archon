from sqlalchemy.orm import class_mapper
from datetime import datetime

from app.models.database import UserCompanyState

# Fields that live on the per-user overlay rather than the shared catalog
STATE_FIELDS = ("status", "heat_level", "is_favorite", "tags")

# A large prime used to build a deterministic per-user permutation of the
# catalog, so every account sees a different ordering (see user_shuffle_key).
_SHUFFLE_MODULUS = 1000003


def get_or_create_state(db, user_id: int, company_id: int) -> UserCompanyState:
    """Fetch this user's state for a company, creating it on first write.

    State rows are created lazily — a brand new account doesn't get a row per
    company, which matters once the catalog holds thousands of them.
    """
    state = db.query(UserCompanyState).filter(
        UserCompanyState.user_id == user_id,
        UserCompanyState.company_id == company_id,
    ).first()
    if not state:
        state = UserCompanyState(user_id=user_id, company_id=company_id)
        db.add(state)
        db.flush()
    return state


def company_to_dict(company, state=None):
    """Serialize a company, overlaying this user's own pipeline state.

    Users with no state row yet see the defaults, so the catalog looks
    untouched to them regardless of what anyone else has done with it.
    """
    result = to_dict(company)
    result["status"] = (state.status if state else None) or "new"
    result["heat_level"] = (state.heat_level if state else None) or "cold"
    result["is_favorite"] = bool(state.is_favorite) if state else False
    result["tags"] = state.tags if state else None
    return result


def user_shuffle_key(user_id: int) -> int:
    """Multiplier for a per-user ordering of the catalog.

    With thousands of companies, a single global order means every user works
    the same top rows and the tail is never contacted. Multiplying the company
    id by a per-user constant that is coprime with a prime modulus produces a
    stable pseudo-random permutation — different per account, identical across
    that account's own page loads, and computable in both SQLite and Postgres.
    """
    mult = (user_id * 2654435761) % _SHUFFLE_MODULUS
    return mult or 1  # 0 would collapse the ordering


def to_dict(obj):
    result = {}
    for column in class_mapper(obj.__class__).columns:
        value = getattr(obj, column.key)
        if hasattr(value, 'isoformat'):
            value = value.isoformat()
        result[column.key] = value
    return result


def calculate_score(company) -> float:
    score = 0.0
    if company.email:
        score += 25
    if company.website:
        score += 10
    if company.linkedin:
        score += 10
    size_scores = {"solo": 15, "small": 20, "medium": 15, "large": 10}
    score += size_scores.get(company.company_size or "", 0)
    relevant = ["CGI", "Visualization", "Architecture", "Interior Design", "Real Estate", "Animation"]
    if company.industry in relevant:
        score += 20
    if company.ai_summary:
        score += 5
    return min(score, 100.0)


def row_to_dict(row):
    result = {}
    for col in row.__table__.columns:
        value = getattr(row, col.name)
        if isinstance(value, datetime):
            value = value.isoformat()
        result[col.name] = value
    return result
