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
OUTSOURCING_BY_SIZE = {
    "small": 20,    # 3–20 people: almost never has in-house 3D
    "medium": 16,   # 21–100: one or two in-house, overflows constantly
    "solo": 13,     # outsources, but the budget is thin
    "large": 9,     # in-house team plus a procurement process
}
OUTSOURCING_DEFAULT = 11

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


def _outsourcing_score(size: str | None, signals: set[str]) -> int:
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
    matches what Armila actually renders well.
    """
    sigs = {_norm(s) for s in (signals or [])}

    need = _need_score(segment, industry)
    outsourcing = _outsourcing_score(company_size, sigs)
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
        "breakdown": [
            {"axis": "Need", "points": need, "max": MAX_NEED,
             "note": (segment or industry or "unknown segment")},
            {"axis": "Outsourcing", "points": outsourcing, "max": MAX_OUTSOURCING,
             "note": f"{company_size or 'unknown'} size"
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
    return score_lead(
        industry=getattr(company, "industry", None),
        company_size=getattr(company, "company_size", None),
        country=getattr(company, "country", None),
        email=getattr(company, "email", None),
        website=getattr(company, "website", None),
        linkedin=getattr(company, "linkedin", None),
        instagram=getattr(company, "instagram", None),
        signals=signals,
        style_fit=style_fit,
    )
