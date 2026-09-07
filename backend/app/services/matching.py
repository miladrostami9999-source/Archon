"""How well does a freelancer and an open marketplace project fit each other?

The same question, asked from both directions — `score_project_for_freelancer`
ranks projects for a freelancer browsing the open board, and
`score_freelancer_for_proposal` ranks the proposals a client received on one
of their projects. They used to be two unrelated implementations (this one,
and a much cruder rating-only heuristic that lived directly in
`proposals.py`); that heuristic is gone now and both directions share the
skill/experience/content axes below, so tuning a weight here — or fixing a
bug in `_skill_score`/`_content_score` — updates both sides of the
marketplace at once instead of only the half whoever's editing remembers to.

Four weighted axes, 100 points:

    Skill match       50   does the project need what they can actually do
    Experience fit    20   is the project's level in their range
    Content overlap   20   do their headline/bio/portfolio speak to this brief
    Freshness/track    10   project→freelancer: is this a live opportunity;
                            freelancer→project: does this bidder have a track
                            record worth trusting (every proposal on one
                            project shares the same posting date, so
                            freshness can't discriminate between them there)

Skill match carries the most weight on purpose — a freelancer with the exact
tools a project asks for is a far better match than one who merely writes
similar words in their bio.

Every score comes with a breakdown so the number is arguable rather than
magic — the same principle as `scoring.py`'s lead score. Scores are computed
**here**, never by the model — Claude (when used at all, in the optional
"why this fits" endpoint) only writes a sentence about a match that has
already been decided by this deterministic arithmetic, never the ranking
itself. Re-tuning a weight re-scores the board consistently for everyone.
"""
from __future__ import annotations

from datetime import datetime, timedelta

MAX_SKILL, MAX_EXPERIENCE, MAX_CONTENT, MAX_FRESHNESS = 50, 20, 20, 10

# Words too common to count as a real content match.
_STOPWORDS = {
    "the", "a", "an", "and", "or", "for", "of", "to", "in", "on", "with",
    "we", "need", "is", "are", "our", "your", "this", "that", "it", "be",
    "by", "at", "as", "from", "will", "can", "you", "us", "-", "–", "·",
}


def _tokenize(text: str) -> set[str]:
    if not text:
        return set()
    words = "".join(c.lower() if c.isalnum() else " " for c in text).split()
    return {w for w in words if len(w) > 2 and w not in _STOPWORDS}


def _skill_score(project_skills: list[str], freelancer_skills: set[str]) -> tuple[int, str]:
    if not project_skills:
        # Nothing specific was asked for — this axis can't penalize a
        # freelancer for not matching a requirement that doesn't exist.
        return MAX_SKILL // 2, "No specific skills listed on the project"
    wanted = {s.strip().lower() for s in project_skills if s.strip()}
    overlap = wanted & freelancer_skills
    pct = len(overlap) / len(wanted) if wanted else 0
    points = round(MAX_SKILL * pct)
    label = f"{len(overlap)}/{len(wanted)} required skills matched" if wanted else "No skills to match"
    return points, label


def _experience_score(project_level: str | None, completed_contracts: int) -> tuple[int, str]:
    # No explicit "experience level" field on a freelancer profile — inferred
    # from their own track record, the same signal a client would look at.
    inferred = "entry" if completed_contracts == 0 else ("intermediate" if completed_contracts < 5 else "expert")
    if not project_level or project_level == "any":
        return MAX_EXPERIENCE, "Project is open to any experience level"
    if project_level == inferred:
        return MAX_EXPERIENCE, f"Your track record ({inferred}) matches what's asked for"
    # Being more experienced than asked for is still a fine fit; only being
    # under-qualified costs points.
    order = ["entry", "intermediate", "expert"]
    if order.index(inferred) > order.index(project_level):
        return MAX_EXPERIENCE, f"You're more experienced ({inferred}) than the {project_level} level asked for"
    gap = order.index(project_level) - order.index(inferred)
    points = max(0, MAX_EXPERIENCE - gap * (MAX_EXPERIENCE // 2))
    return points, f"Project wants {project_level}, your track record reads as {inferred}"


def _content_score(project_text: str, freelancer_text: str) -> tuple[int, str]:
    project_words = _tokenize(project_text)
    freelancer_words = _tokenize(freelancer_text)
    if not project_words or not freelancer_words:
        return 0, "Not enough profile text to compare"
    overlap = project_words & freelancer_words
    pct = min(1.0, len(overlap) / max(3, len(project_words) ** 0.5))
    points = round(MAX_CONTENT * pct)
    label = f"{len(overlap)} shared terms between your profile and this brief" if overlap else "No overlap between your profile and this brief"
    return points, label


def _freshness_score(created_at: datetime | None) -> tuple[int, str]:
    if not created_at:
        return MAX_FRESHNESS // 2, "Unknown post date"
    days_open = (datetime.utcnow() - created_at).days
    if days_open <= 3:
        return MAX_FRESHNESS, "Posted in the last 3 days"
    if days_open >= 21:
        return 0, f"Posted {days_open} days ago — likely already staffed or stale"
    # Linear falloff between day 3 and day 21.
    points = round(MAX_FRESHNESS * (1 - (days_open - 3) / 18))
    return points, f"Posted {days_open} days ago"


def _track_record_score(rating: float | None, review_count: int, completed_contracts: int) -> tuple[int, str]:
    # Freshness (how old the listing is) doesn't mean anything when ranking
    # proposals *on* one project — every proposal there shares the same
    # project, so it can't discriminate between them. A client instead cares
    # whether this bidder has a track record worth trusting, which is the
    # signal `proposals.py` used to score on alone before this module
    # existed — kept here as this direction's fourth axis so unifying the
    # two algorithms doesn't throw it away.
    if not review_count and not completed_contracts:
        return MAX_FRESHNESS // 2, "No completed contracts or reviews yet"
    rating_pts = round((MAX_FRESHNESS * 0.7) * ((rating or 0) / 5)) if review_count else 0
    # A handful of finished contracts matters even before any review lands.
    track_pts = min(MAX_FRESHNESS - rating_pts, round(completed_contracts * 1.5))
    points = rating_pts + track_pts
    if review_count:
        return points, f"{rating:.1f}★ across {review_count} review{'s' if review_count != 1 else ''}, {completed_contracts} completed contract{'s' if completed_contracts != 1 else ''}"
    return points, f"{completed_contracts} completed contract{'s' if completed_contracts != 1 else ''}, no reviews yet"


def score_project_for_freelancer(
    *,
    project_skills: list[str],
    project_experience_level: str | None,
    project_title: str,
    project_description: str,
    project_created_at: datetime | None,
    freelancer_skills: list[str],
    freelancer_custom_skills: list[str],
    freelancer_text: str,
    freelancer_completed_contracts: int,
) -> dict:
    """Pure function — no DB access, no network calls, so it's cheap enough
    to run over every open project in a Python loop (the same pattern
    `proposals.py`'s `best_match` sort already uses for the client side)."""
    fl_skills = {s.strip().lower() for s in (freelancer_skills + freelancer_custom_skills) if s.strip()}

    skill_pts, skill_label = _skill_score(project_skills, fl_skills)
    exp_pts, exp_label = _experience_score(project_experience_level, freelancer_completed_contracts)
    content_pts, content_label = _content_score(f"{project_title} {project_description}", freelancer_text)
    fresh_pts, fresh_label = _freshness_score(project_created_at)

    total = skill_pts + exp_pts + content_pts + fresh_pts
    return {
        "score": total,
        "breakdown": [
            {"label": skill_label, "points": skill_pts, "max": MAX_SKILL},
            {"label": exp_label, "points": exp_pts, "max": MAX_EXPERIENCE},
            {"label": content_label, "points": content_pts, "max": MAX_CONTENT},
            {"label": fresh_label, "points": fresh_pts, "max": MAX_FRESHNESS},
        ],
    }


def score_freelancer_for_proposal(
    *,
    project_skills: list[str],
    project_experience_level: str | None,
    project_title: str,
    project_description: str,
    freelancer_skills: list[str],
    freelancer_custom_skills: list[str],
    freelancer_text: str,
    freelancer_completed_contracts: int,
    freelancer_rating: float | None,
    freelancer_review_count: int,
) -> dict:
    """The other direction of the same question `score_project_for_freelancer`
    answers: given one project, how well does this particular bidder fit it?
    Used to rank a client's incoming proposals on a project — previously its
    own separate, much cruder heuristic (rating + completed contracts only,
    no skill or content matching at all) lived in `proposals.py`. Reuses the
    same skill/experience/content axes so the two directions can't drift
    apart again, only swapping the freshness axis (meaningless here — every
    proposal on a project shares the same posting date) for track record,
    which is what the old heuristic scored on exclusively."""
    fl_skills = {s.strip().lower() for s in (freelancer_skills + freelancer_custom_skills) if s.strip()}

    skill_pts, skill_label = _skill_score(project_skills, fl_skills)
    exp_pts, exp_label = _experience_score(project_experience_level, freelancer_completed_contracts)
    content_pts, content_label = _content_score(f"{project_title} {project_description}", freelancer_text)
    track_pts, track_label = _track_record_score(freelancer_rating, freelancer_review_count, freelancer_completed_contracts)

    total = skill_pts + exp_pts + content_pts + track_pts
    return {
        "score": total,
        "breakdown": [
            {"label": skill_label, "points": skill_pts, "max": MAX_SKILL},
            {"label": exp_label, "points": exp_pts, "max": MAX_EXPERIENCE},
            {"label": content_label, "points": content_pts, "max": MAX_CONTENT},
            {"label": track_label, "points": track_pts, "max": MAX_FRESHNESS},
        ],
    }
