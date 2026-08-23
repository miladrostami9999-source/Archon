import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db, Post, PostLike, PostComment, PostReport, User
from app.routers.auth import require_marketplace_beta, require_admin
from app.services.pagination import paginate
from app.services import notifications as notif
from .schemas import PostCreate, PostUpdate, CommentCreate, PostReportCreate

router = APIRouter(prefix="/feed", tags=["marketplace-feed"])


def _avatar_for(user: User) -> str:
    if not user or not user.profile_json:
        return ""
    try:
        return json.loads(user.profile_json).get("avatar", "") or ""
    except Exception:
        return ""


def _post_to_dict(p: Post, db: Session, viewer_id: int) -> dict:
    author = db.query(User).filter(User.id == p.user_id).first()
    like_count = db.query(PostLike).filter(PostLike.post_id == p.id).count()
    comment_count = db.query(PostComment).filter(PostComment.post_id == p.id).count()
    liked = db.query(PostLike).filter(PostLike.post_id == p.id, PostLike.user_id == viewer_id).first() is not None
    return {
        "id": p.id,
        "user_id": p.user_id,
        "author_name": author.name if author else None,
        "author_avatar": _avatar_for(author),
        "text": p.text,
        "image_url": p.image_url,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        "is_owner": p.user_id == viewer_id,
        "like_count": like_count,
        "comment_count": comment_count,
        "liked_by_me": liked,
    }


def _comment_to_dict(c: PostComment, db: Session) -> dict:
    author = db.query(User).filter(User.id == c.user_id).first()
    return {
        "id": c.id,
        "post_id": c.post_id,
        "user_id": c.user_id,
        "author_name": author.name if author else None,
        "author_avatar": _avatar_for(author),
        "text": c.text,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _get_post_or_404(db: Session, post_id: int) -> Post:
    p = db.query(Post).filter(Post.id == post_id, Post.is_deleted.is_(False)).first()
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    return p


@router.post("/posts")
def create_post(data: PostCreate, current_user: User = Depends(require_marketplace_beta), db: Session = Depends(get_db)):
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="A post needs some text")
    post = Post(user_id=current_user.id, text=data.text.strip(), image_url=data.image_url)
    db.add(post)
    db.commit()
    db.refresh(post)
    return _post_to_dict(post, db, current_user.id)


@router.get("/posts")
def list_posts(limit: int = 20, offset: int = 0, current_user: User = Depends(require_marketplace_beta), db: Session = Depends(get_db)):
    query = db.query(Post).filter(Post.is_deleted.is_(False)).order_by(Post.created_at.desc())
    page = paginate(query, limit, offset)
    return {
        "items": [_post_to_dict(p, db, current_user.id) for p in page["items"]],
        "next_offset": page["next_offset"],
        "has_more": page["has_more"],
    }


@router.get("/users/{user_id}/posts")
def list_user_posts(user_id: int, limit: int = 20, offset: int = 0, current_user: User = Depends(require_marketplace_beta), db: Session = Depends(get_db)):
    query = db.query(Post).filter(Post.user_id == user_id, Post.is_deleted.is_(False)).order_by(Post.created_at.desc())
    page = paginate(query, limit, offset)
    return {
        "items": [_post_to_dict(p, db, current_user.id) for p in page["items"]],
        "next_offset": page["next_offset"],
        "has_more": page["has_more"],
    }


@router.patch("/posts/{post_id}")
def update_post(post_id: int, data: PostUpdate, current_user: User = Depends(require_marketplace_beta), db: Session = Depends(get_db)):
    post = _get_post_or_404(db, post_id)
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the author can edit this post")
    if data.text is not None:
        if not data.text.strip():
            raise HTTPException(status_code=400, detail="A post needs some text")
        post.text = data.text.strip()
    if data.image_url is not None:
        post.image_url = data.image_url or None
    from datetime import datetime
    post.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(post)
    return _post_to_dict(post, db, current_user.id)


@router.delete("/posts/{post_id}")
def delete_post(post_id: int, current_user: User = Depends(require_marketplace_beta), db: Session = Depends(get_db)):
    post = _get_post_or_404(db, post_id)
    if post.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the author or an admin can delete this post")
    post.is_deleted = True
    db.commit()
    return {"message": "Post deleted"}


@router.post("/posts/{post_id}/like")
def like_post(post_id: int, current_user: User = Depends(require_marketplace_beta), db: Session = Depends(get_db)):
    post = _get_post_or_404(db, post_id)
    existing = db.query(PostLike).filter(PostLike.post_id == post_id, PostLike.user_id == current_user.id).first()
    if existing:
        return _post_to_dict(post, db, current_user.id)
    db.add(PostLike(post_id=post_id, user_id=current_user.id))
    db.commit()
    if post.user_id != current_user.id:
        notif.notify(db, post.user_id, notif.POST_LIKED, "Someone liked your post",
                     f"{current_user.name} liked your post.", "/feed")
        db.commit()
    return _post_to_dict(post, db, current_user.id)


@router.delete("/posts/{post_id}/like")
def unlike_post(post_id: int, current_user: User = Depends(require_marketplace_beta), db: Session = Depends(get_db)):
    post = _get_post_or_404(db, post_id)
    db.query(PostLike).filter(PostLike.post_id == post_id, PostLike.user_id == current_user.id).delete()
    db.commit()
    return _post_to_dict(post, db, current_user.id)


@router.post("/posts/{post_id}/comments")
def create_comment(post_id: int, data: CommentCreate, current_user: User = Depends(require_marketplace_beta), db: Session = Depends(get_db)):
    post = _get_post_or_404(db, post_id)
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="A comment needs some text")
    comment = PostComment(post_id=post_id, user_id=current_user.id, text=data.text.strip())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    if post.user_id != current_user.id:
        notif.notify(db, post.user_id, notif.POST_COMMENTED, "New comment on your post",
                     f"{current_user.name}: {data.text.strip()[:80]}", "/feed")
        db.commit()
    return _comment_to_dict(comment, db)


@router.get("/posts/{post_id}/comments")
def list_comments(post_id: int, current_user: User = Depends(require_marketplace_beta), db: Session = Depends(get_db)):
    _get_post_or_404(db, post_id)
    comments = db.query(PostComment).filter(PostComment.post_id == post_id).order_by(PostComment.created_at.asc()).all()
    return [_comment_to_dict(c, db) for c in comments]


@router.post("/posts/{post_id}/report")
def report_post(post_id: int, data: PostReportCreate, current_user: User = Depends(require_marketplace_beta), db: Session = Depends(get_db)):
    _get_post_or_404(db, post_id)
    existing = db.query(PostReport).filter(PostReport.post_id == post_id, PostReport.reporter_id == current_user.id).first()
    if existing:
        return {"message": "Already reported"}
    db.add(PostReport(post_id=post_id, reporter_id=current_user.id, reason=data.reason))
    db.commit()
    return {"message": "Reported — an admin will review it"}


@router.get("/admin/reports")
def list_reports(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    reports = db.query(PostReport).order_by(PostReport.created_at.desc()).all()
    out = []
    for r in reports:
        post = db.query(Post).filter(Post.id == r.post_id).first()
        reporter = db.query(User).filter(User.id == r.reporter_id).first()
        out.append({
            "id": r.id,
            "post_id": r.post_id,
            "post_text": post.text if post else None,
            "post_deleted": (post.is_deleted if post else True),
            "reporter_id": r.reporter_id,
            "reporter_name": reporter.name if reporter else None,
            "reason": r.reason,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return out
