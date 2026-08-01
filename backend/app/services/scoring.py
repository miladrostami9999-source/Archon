"""How likely is this company to become a paying Armila client?

The old score added points for every field we had filled in, which measured how
complete our record was rather than how good the lead was. A 500-person firm
with an `info@` address outscored a 20-person studio that had just won an award
and was hiring a visualiser.

This model scores the one thing that matters: send this company a cold email —
how likely is it to turn into a paid project? Five weighted axes, 100 points:

    Need          22   do they commission renders at all
    Outsourcing   26   would they hand the work to a studio like us
    Timing        20   is there a reason to reply *this month*
    Market        17   does the region pay what the work is worth
    Reach         15   can we actually run the play

`Outsourcing` carries the most weight on purpose. A large practice with an
in-house 3D team is a hard, slow sale no matter how prestigious it is; a
15-person studio with no visualiser is the bread and butter.

Every score comes with a breakdown so the number is arguable rather than
magic — if a company scores 82 you can see which axis carried it, and tune the
constants below rather than guessing.

Scores are computed **here**, never by the model. Claude supplies facts (size,
segment, signals, style fit); the arithmetic is deterministic, so the same
company always scores the same and re-tuning a weight re-scores the catalog
consistently.
"""
from __future__ import annotations

MAX_NEED, MAX_OUTSOURCING, MAX_TIMING, MAX_MARKET, MAX_REACH = 22, 26, 20, 17, 15

# ── A. Need — do they put buildings and interiors in front of clients? ──────
# Developers top the list: every launch needs marketing imagery and the budget
# sits in the marketing line, not a project fee.
NEED_BY_SEGMENT = {
    "real estate developer": 22,
    "real estate": 22,
    "hospitality group": 18,
    "architecture studio": 20,
    "architecture": 20,
    "interior design studio": 19,
    "interior design": 19,
    "retail brand rollout": 17,
    "landscape architecture": 15,
    "urban planning / masterplanning": 16,
    "construction contractor": 13,
    "construction": 13,
    "property marketing agency": 16,
    "furniture / product brand": 12,
    "facade & engineering consultant": 11,
    "exhibition & set design": 12,
    # A visualisation studio is a competitor first and an overflow partner
    # second — real work comes from them, but rarely and at a lower rate.
    "arch-viz studio (overflow partner)": 9,
    "visualization": 9,
    "cgi": 9,
    "animation": 10,
}
NEED_DEFAULT = 8

# ── B. Outsourcing likelihood — the axis that decides the sale ─────────────
# Big firms stay in the catalog — they're real prospects with real budgets —
# they just score lower, because an in-house 3D team and a procurement process
# make them a slow, uncertain sale. The curve slopes down rather than falling
# off a cliff, so a 250-person practice still outranks an unknown.
OUTSOURCING_BY_SIZE = {
    "small": 20,    # 3–20 people: almost never has in-house 3D
    "medium": 16,   # 21–100: one or two in-house, overflows constantly
    "solo": 13,     # outsources, but the budget is thin
    "large": 8,     # in-house team plus a procurement process
}
OUTSOURCING_DEFAULT = 11

# Headcount is used in preference to the band when we have it: the four bands
# are too coarse to score with, since a 25-person studio and a 95-person
# practice are a completely different sale.
OUTSOURCING_BY_HEADCOUNT = [
    (2,    13),   # solo / duo — outsources, but the budget is thin
    (20,   20),   # the sweet spot: no in-house 3D, real projects
    (50,   18),   # maybe one generalist who also does renders
    (100,  14),   # a small internal team, overflows at peak
    (250,  11),   # in-house capability, occasional overflow
    (500,   9),   # established team, needs a reason to look outside
    (10**9, 6),   # enterprise: procurement, panels, framework agreements
]

# Bands derived from headcount, so the label and the score never disagree.
SIZE_BANDS = [(2, "solo"), (20, "small"), (100, "medium"), (10**9, "large")]


def band_for_headcount(count: int | None) -> str | None:
    if not count or count < 1:
        return None
    for ceiling, name in SIZE_BANDS:
        if count <= ceiling:
            return name
    return "large"

# Signals that change the outsourcing picture specifically.
OUTSOURCING_SIGNAL_BONUS = {
    "hiring_viz": 6,      # they are short of capacity right now
    "no_inhouse": 5,      # confirmed no internal 3D team
    "dated_visuals": 3,   # what they produce isn't working
}

# ── C. Timing — is there a reason to reply this month rather than someday ──
TIMING_SIGNAL_POINTS = {
    "hiring_viz": 9,      # strongest signal there is
    "new_project": 6,
    "recent_award": 6,    # they need press images now
    "exhibiting": 5,      # a booth needs visuals, with a deadline attached
    "funding": 4,
    "dated_visuals": 3,
    "active_social": 3,
}

# ── D. Market — what the region will pay ───────────────────────────────────
# Ordered from the roadmap's priority markets outward. Spain sits mid-tier:
# it's home turf and easy to serve, but not where the budgets are.
MARKET_TIERS = [
    (17, {"united arab emirates", "uae", "saudi arabia", "qatar"}),
    (15, {"switzerland", "norway", "denmark", "sweden", "united kingdom", "uk", "kuwait"}),
    (13, {"germany", "netherlands", "finland", "ireland", "austria", "belgium",
          "luxembourg", "iceland", "united states", "usa", "canada", "australia"}),
    (11, {"spain", "france", "italy", "portugal", "bahrain", "oman", "singapore",
          "new zealand", "japan", "south korea"}),
    (8,  {"poland", "czechia", "czech republic", "greece", "turkey", "türkiye", "israel",
          "mexico", "brazil", "chile", "malaysia", "thailand", "china", "hong kong",
          "romania", "hungary", "croatia", "estonia", "lithuania", "latvia"}),
]
MARKET_UNKNOWN = 6
MARKET_OTHER = 5

# ── E. Reach — can we actually send the email ──────────────────────────────
# A named inbox beats a shared one: `info@` competes with every other pitch in
# the queue, a person's address gets read.
GENERIC_INBOXES = {
    "info", "hello", "contact", "office", "studio", "mail", "enquiries",
    "enquiry", "inquiries", "admin", "general", "reception", "post", "team",
}

GRADES = [
    (80, "A", "Priority — worth a tailored email today"),
    (65, "B", "Strong — send in this week's batch"),
    (48, "C", "Worth a try — use a template"),
    (0,  "D", "Low priority — enrich or skip"),
]


def _norm(v) -> str:
    return (v or "").strip().lower()


def _need_score(segment: str | None, industry: str | None) -> int:
    for value in (_norm(segment), _norm(industry)):
        if value in NEED_BY_SEGMENT:
            return NEED_BY_SEGMENT[value]
    # Fall back to a keyword match so free-text industries still land somewhere
    # sensible instead of all collapsing to the default.
    haystack = f"{_norm(segment)} {_norm(industry)}"
    for key, points in sorted(NEED_BY_SEGMENT.items(), key=lambda kv: -len(kv[0])):
        if key in haystack:
            return points
    return NEED_DEFAULT


def _outsourcing_score(size: str | None, signals: set[str], headcount: int | None = None) -> int:
    if headcount and headcount > 0:
        base = next(pts for ceiling, pts in OUTSOURCING_BY_HEADCOUNT if headcount <= ceiling)
    else:
        base = OUTSOURCING_BY_SIZE.get(_norm(size), OUTSOURCING_DEFAULT)
    bonus = sum(pts for sig, pts in OUTSOURCING_SIGNAL_BONUS.items() if sig in signals)
    return min(MAX_OUTSOURCING, base + bonus)


def _timing_score(signals: set[str]) -> int:
    return min(MAX_TIMING, sum(TIMING_SIGNAL_POINTS.get(s, 0) for s in signals))


def _market_score(country: str | None) -> int:
    name = _norm(country)
    if not name:
        return MARKET_UNKNOWN
    for points, countries in MARKET_TIERS:
        if name in countries:
            return points
    return MARKET_OTHER


def _reach_score(email: str | None, website: str | None,
                 linkedin: str | None, instagram: str | None) -> tuple[int, str]:
    points, note = 0, "no email — can't run outreach yet"
    addr = _norm(email)
    if addr and "@" in addr:
        local = addr.split("@", 1)[0]
        if local in GENERIC_INBOXES:
            points, note = 7, "shared inbox"
        else:
            points, note = 9, "named contact"
    if website:
        points += 3
    if linkedin:
        points += 2
    if instagram:
        points += 1
    return min(MAX_REACH, points), note


def score_lead(
    *,
    segment: str | None = None,
    industry: str | None = None,
    company_size: str | None = None,
    employee_count: int | None = None,
    country: str | None = None,
    email: str | None = None,
    website: str | None = None,
    linkedin: str | None = None,
    instagram: str | None = None,
    signals: list[str] | None = None,
    style_fit: int = 0,
) -> dict:
    """Score one lead and explain the number.

    `signals` are the keys from `discovery_sources.SIGNALS`. `style_fit` is an
    optional -8..+8 nudge from the enrichment pass for how closely their work
    matches what Armila actually renders well. `employee_count`, when known,
    replaces the coarse size band on the Outsourcing axis.
    """
    sigs = {_norm(s) for s in (signals or [])}
    band = band_for_headcount(employee_count) or (_norm(company_size) or None)

    need = _need_score(segment, industry)
    outsourcing = _outsourcing_score(company_size, sigs, employee_count)
    timing = _timing_score(sigs)
    market = _market_score(country)
    reach, reach_note = _reach_score(email, website, linkedin, instagram)

    style = max(-8, min(8, int(style_fit or 0)))
    total = max(0, min(100, need + outsourcing + timing + market + reach + style))

    grade, verdict = next((g, v) for cut, g, v in GRADES if total >= cut)

    return {
        "score": float(total),
        "grade": grade,
        "verdict": verdict,
        "size_band": band,
        "employee_count": employee_count or None,
        "breakdown": [
            {"axis": "Need", "points": need, "max": MAX_NEED,
             "note": (segment or industry or "unknown segment")},
            {"axis": "Outsourcing", "points": outsourcing, "max": MAX_OUTSOURCING,
             "note": (f"{employee_count} people" if employee_count else f"{band or 'unknown'} size")
                     + (f" · {', '.join(s for s in OUTSOURCING_SIGNAL_BONUS if s in sigs)}"
                        if sigs & set(OUTSOURCING_SIGNAL_BONUS) else "")},
            {"axis": "Timing", "points": timing, "max": MAX_TIMING,
             "note": ", ".join(s for s in TIMING_SIGNAL_POINTS if s in sigs) or "no active signals"},
            {"axis": "Market", "points": market, "max": MAX_MARKET,
             "note": country or "unknown country"},
            {"axis": "Reach", "points": reach, "max": MAX_REACH, "note": reach_note},
        ] + ([{"axis": "Style fit", "points": style, "max": 8,
               "note": "how close their work is to what we render well"}] if style else []),
    }


def score_company(company, signals: list[str] | None = None, style_fit: int = 0) -> dict:
    """Score a Company row. Used on import, manual add, and re-scoring."""
    if signals is None:
        signals = parse_signals(getattr(company, "signals", None))
    return score_lead(
        industry=getattr(company, "industry", None),
        company_size=getattr(company, "company_size", None),
        employee_count=getattr(company, "employee_count", None),
        country=getattr(company, "country", None),
        email=getattr(company, "email", None),
        website=getattr(company, "website", None),
        linkedin=getattr(company, "linkedin", None),
        instagram=getattr(company, "instagram", None),
        signals=signals,
        style_fit=style_fit,
    )


def parse_signals(raw) -> list[str]:
    """Signals are stored comma-separated on the company row."""
    if not raw:
        return []
    if isinstance(raw, (list, tuple, set)):
        return [str(s).strip() for s in raw if str(s).strip()]
    return [s.strip() for s in str(raw).replace(";", ",").split(",") if s.strip()]


# ── Heat ───────────────────────────────────────────────────────────────────
# Heat and score answer different questions. The score asks "should we ever
# email these people"; heat asks "is there anything happening right now".
#
# Nothing computed it before this — `heat_level` was a column with a default of
# "cold" and a manual override, so every company ever imported sat at cold
# forever and the filter was decorative.

# They've engaged with us — nothing outranks that.
HOT_STATUSES = {"replied", "meeting", "client"}
# The ball is in their court.
WARM_STATUSES = {"sent", "waiting"}

# Signals that mean something is happening at their end *now*.
URGENT_SIGNALS = {"hiring_viz", "new_project", "recent_award", "exhibiting"}

# A send goes cold if it's been ignored this long. Without this, everything
# ever contacted would stay warm forever and the filter would rot.
STALE_AFTER_DAYS = 30


def heat_for(status: str | None, score: float | None, signals=None,
             last_activity=None, now=None) -> str:
    """Where this lead sits right now: hot, warm or cold.

    Deliberately derived rather than stored-only, so a company nobody has
    touched still reflects its signals instead of defaulting to cold.
    """
    from datetime import datetime as _dt

    status = _norm(status) or "new"
    sigs = {_norm(s) for s in parse_signals(signals)}
    score = float(score or 0)

    if status == "archive":
        return "cold"
    if status in HOT_STATUSES:
        return "hot"

    if status in WARM_STATUSES:
        # Chased and ignored for a month — it's not warm any more.
        if last_activity:
            now = now or _dt.utcnow()
            try:
                if (now - last_activity).days > STALE_AFTER_DAYS:
                    return "cold"
            except TypeError:
                pass  # tz-aware/naive mismatch — treat as still warm
        return "warm"

    # Not contacted yet: heat comes from what's happening at their end.
    urgent = bool(sigs & URGENT_SIGNALS)
    if urgent and score >= 70:
        return "hot"
    if urgent or score >= 65:
        return "warm"
    return "cold"
