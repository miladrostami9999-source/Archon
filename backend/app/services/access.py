"""Who is allowed to see what.

The company catalog is the product, so "can this account read this row" is a
billing question, not just an authentication one. Everything that decides it
lives here so the rules can't drift apart between endpoints.

Three ideas:

* **unlocked** — a company the user has spent a company credit on. Having a
  `user_company_state` row *is* the unlock; the quota counts those rows, so a
  Pro account on a 500-company plan can read 500 companies out of a 3000-company
  catalog and only sees teasers for the rest.
* **locked account** — the whole account is cut off (payment not confirmed,
  plan expired, or quota fully consumed). Even already-unlocked rows are masked;
  the only way out is the upgrade page.
* **country lock** — a plan may be restricted to a subset of countries, which is
  how the trial is limited to a sample of the catalog.
"""
from datetime import datetime

from app.models.database import PlanLimit, UserCompanyState, DEFAULT_PLAN_LIMITS

# Fields that make a company actionable — the part a subscription buys.
SENSITIVE_FIELDS = (
    "email", "phone", "website", "domain", "linkedin", "instagram", "ai_summary",
)

# Reasons an account is cut off, and the message the UI shows for each.
LOCK_MESSAGES = {
    "pending_payment": "Your plan is awaiting confirmation. Company details unlock as soon as we confirm your payment.",
    "expired": "Your plan has expired. Renew to get your companies back.",
    "quota_exhausted": "You've used your whole plan — every company and every email. Upgrade to keep going.",
}


def _plan_row(db, plan: str):
    return db.query(PlanLimit).filter(PlanLimit.plan == plan).first()


def allowed_countries(db, user) -> list[str] | None:
    """Countries this user's plan may see, or None for no restriction.

    Stored as a comma-separated string on `plan_limits` so the admin edits it
    from the Admin Panel rather than us shipping a new deploy for it.
    """
    if user.role == "admin":
        return None
    row = _plan_row(db, user.plan)
    raw = (row.allowed_countries if row else None) or ""
    names = [c.strip() for c in raw.split(",") if c.strip()]
    return names or None


def access_state(db, user) -> dict:
    """Everything an endpoint needs to decide what to show this user."""
    from app.services.limits import get_usage

    if user.role == "admin":
        return {
            "locked": False, "reason": None, "message": None,
            "countries": None, "unlimited": True,
        }

    reason = None
    if (user.plan_status or "active") == "pending":
        reason = "pending_payment"
    elif user.plan_expires_at and user.plan_expires_at < datetime.utcnow():
        reason = "expired"
    else:
        usage = get_usage(db, user)
        # Only a fully-spent plan locks the account. Running out of one of the
        # two budgets still leaves the other usable.
        spent_companies = usage["companies_remaining"] == 0
        spent_emails = usage["emails_remaining"] == 0
        if spent_companies and spent_emails:
            reason = "quota_exhausted"

    return {
        "locked": reason is not None,
        "reason": reason,
        "message": LOCK_MESSAGES.get(reason),
        "countries": allowed_countries(db, user),
        "unlimited": False,
    }


def unlocked_company_ids(db, user_id: int) -> set[int]:
    rows = db.query(UserCompanyState.company_id).filter(
        UserCompanyState.user_id == user_id
    ).all()
    return {r[0] for r in rows}


def mask_name(name: str | None) -> str:
    """A teaser that proves a real company is there without naming it.

    Keeps the first letter of each word so "Foster + Partners" reads as
    "F••••• + P•••••" — enough to feel concrete, useless for outreach.
    """
    if not name:
        return "•••••"
    parts = []
    for word in str(name).split():
        if len(word) <= 1:
            parts.append(word)
        else:
            parts.append(word[0] + "•" * min(len(word) - 1, 7))
    return " ".join(parts)


def apply_mask(payload: dict, *, hide_name: bool, reason: str | None) -> dict:
    """Blank out the fields a subscription pays for.

    The row still carries country, city, industry, size and score, so a user
    browsing the catalog can tell what they'd be spending a credit on.
    """
    payload = dict(payload)
    for field in SENSITIVE_FIELDS:
        if field in payload:
            payload[field] = None
    if hide_name:
        payload["name"] = mask_name(payload.get("name"))
    payload["locked"] = True
    payload["lock_reason"] = reason
    return payload
