"""How well does an open marketplace project fit a given freelancer?

Four weighted axes, 100 points:

    Skill match       50   does the project need what they can actually do
    Experience fit    20   is the project's level in their range
    Content overlap   20   do their headline/bio/portfolio speak to this brief
    Freshness         10   is this still a live opportunity, not a stale one

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
