"""First shared pagination helper in the codebase — every other list endpoint
so far just does `.all()`. Kept deliberately generic so later feed-like
endpoints (comments, activity logs, ...) can reuse it instead of hand-rolling
limit/offset again."""
from sqlalchemy.orm import Query


def paginate(query: Query, limit: int = 20, offset: int = 0) -> dict:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    items = query.offset(offset).limit(limit + 1).all()
    has_more = len(items) > limit
    items = items[:limit]
    return {
        "items": items,
        "next_offset": offset + limit if has_more else None,
        "has_more": has_more,
    }
