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


def company_to_dict(company, state=None, access=None, unlocked=None):
    """Serialize a company, overlaying this user's own pipeline state.

    Users with no state row yet see the defaults, so the catalog looks
    untouched to them regardless of what anyone else has done with it.

    `access` (from `app.services.access.access_state`) decides how much of the
    row the caller may actually read. Pass it on every user-facing endpoint;
    omitting it returns the unmasked record and is only correct for admin or
    internal callers.

    Three outcomes:
      * no access given, or an unlimited account → the full record
      * account locked (unpaid / expired / quota spent) → everything masked,
        company name included
      * account fine but this company not unlocked → a teaser: name, country,
        city, industry, size and score stay, contact details are stripped
    """
    from app.services.access import apply_mask

    result = to_dict(company)
    result["status"] = (state.status if state else None) or "new"
    result["heat_level"] = (state.heat_level if state else None) or "cold"
    result["is_favorite"] = bool(state.is_favorite) if state else False
    result["tags"] = state.tags if state else None
    result["locked"] = False
    result["lock_reason"] = None
    result["unlocked"] = True

    if not access or access.get("unlimited"):
        return result

    is_unlocked = state is not None if unlocked is None else unlocked

    if access.get("locked"):
        result = apply_mask(result, hide_name=True, reason=access.get("reason"))
        result["unlocked"] = is_unlocked
        return result

    if not is_unlocked:
        result = apply_mask(result, hide_name=False, reason="not_unlocked")
        result["unlocked"] = False
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


def calculate_score(company, signals=None, style_fit: int = 0) -> float:
    """Opportunity score for a company. See `app.services.scoring` for the model.

    Also writes the per-axis breakdown onto the row so the number is explainable
    in the UI rather than an unarguable magic figure.
    """
    import json as _json
    from app.services.scoring import score_company

    result = score_company(company, signals=signals, style_fit=style_fit)
    try:
        company.score_breakdown = _json.dumps({
            "grade": result["grade"],
            "verdict": result["verdict"],
            "breakdown": result["breakdown"],
        })
    except Exception:
        pass  # scoring must never be the reason a save fails
    return result["score"]


def row_to_dict(row):
    result = {}
    for col in row.__table__.columns:
        value = getattr(row, col.name)
        if isinstance(value, datetime):
            value = value.isoformat()
        result[col.name] = value
    return result
