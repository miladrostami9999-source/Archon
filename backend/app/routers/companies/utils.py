from sqlalchemy.orm import class_mapper
from datetime import datetime


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
