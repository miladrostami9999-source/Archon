import os
import uuid

import boto3
from botocore.config import Config

# Allowed image types and per-file size cap (kept generous but sane)
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024  # 8 MB per image


def is_configured() -> bool:
    return all(
        os.getenv(k)
        for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL")
    )


def _client():
    account_id = os.getenv("R2_ACCOUNT_ID")
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def upload_image(file_bytes: bytes, content_type: str, prefix: str = "uploads") -> str:
    """Upload an image to R2 and return its public URL.

    Raises ValueError for validation problems (unsupported type / too big)
    so the caller can turn them into a 400.
    """
    if not is_configured():
        raise RuntimeError("R2 storage is not configured on the server")

    ext = ALLOWED_CONTENT_TYPES.get(content_type)
    if not ext:
        raise ValueError(f"Unsupported image type: {content_type}")

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise ValueError(
            f"Image too large: {round(len(file_bytes) / 1024 / 1024, 1)}MB "
            f"(limit is {MAX_FILE_SIZE_BYTES // 1024 // 1024}MB)"
        )

    key = f"{prefix}/{uuid.uuid4().hex}.{ext}"
    _client().put_object(
        Bucket=os.getenv("R2_BUCKET"),
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )

    public_base = os.getenv("R2_PUBLIC_URL", "").rstrip("/")
    return f"{public_base}/{key}"
