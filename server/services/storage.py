from __future__ import annotations

from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Union
import os
import uuid
from dataclasses import dataclass
import mimetypes
from typing import Tuple
try:
    import boto3
    from botocore.exceptions import ClientError
except Exception:
    boto3 = None
    ClientError = Exception

from ..config import settings


ARTIFACTS_DIR = Path(settings.artifacts_dir)
ORIGINALS_DIR = Path(settings.originals_dir)


def ensure_dir_exists(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _filename_for(job_id: int, filename: str) -> str:
    # prefix to help deletion and identification; uuid to avoid collisions
    return f"{job_id}_{uuid.uuid4().hex}_{Path(filename).name}"


def save_artifact(job_id: int, content: bytes, filename: str, mime_type: str) -> Union[Path, str]:
    """Save artifact content to disk and return the path.

    The artifact filename will be '{job_id}_{safe_filename}'.
    """
    if not settings.artifacts_enabled:
        raise RuntimeError("Artifacts are disabled")
    # S3 option
    if settings.artifacts_storage == 's3':
        # upload to S3
        if boto3 is None:
            raise RuntimeError('boto3 is required for S3 storage but not installed')
        key = f"artifacts/{job_id}/{uuid.uuid4().hex}/{Path(filename).name}"
        client = _s3_client()
        bucket = settings.s3_bucket
        if not bucket:
            raise RuntimeError('S3 bucket not configured')
        client.put_object(Bucket=bucket, Key=key, Body=content, ContentType=mime_type)
        return f"s3://{bucket}/{key}"
    ensure_dir_exists(ARTIFACTS_DIR)
    safe_name = _filename_for(job_id, filename)
    dest = ARTIFACTS_DIR / safe_name
    with open(dest, "wb") as fh:
        fh.write(content)
    # set the file mtime to now
    os.utime(dest, None)
    return dest


def get_artifact_path(job_id: int) -> Optional[Path]:
    if not settings.artifacts_enabled:
        return None
    # find file starting with job_id_
    if not ARTIFACTS_DIR.exists():
        return None
    prefix = f"{job_id}_"
    for p in ARTIFACTS_DIR.iterdir():
        if p.name.startswith(prefix) and p.is_file():
            return p
    return None


def get_s3_presigned_url(s3_uri: str, expires_in: int = 3600) -> Optional[str]:
    if not s3_uri.startswith('s3://'):
        return None
    if boto3 is None:
        return None
    client = _s3_client()
    bucket_key = s3_uri[len('s3://'):]
    bucket, key = bucket_key.split('/', 1)
    try:
        url = client.generate_presigned_url('get_object', Params={'Bucket': bucket, 'Key': key}, ExpiresIn=expires_in)
        return url
    except Exception:
        return None


def delete_artifact(path: Union[Path, str]) -> None:
    try:
        if isinstance(path, str) and path.startswith('s3://'):
            if boto3 is None:
                return
            client = _s3_client()
            bucket_key = path[len('s3://'):]
            bucket, key = bucket_key.split('/', 1)
            try:
                client.delete_object(Bucket=bucket, Key=key)
            except ClientError:
                pass
            return
        path.unlink()
    except Exception:
        # best-effort
        pass


def cleanup_old_artifacts(days: int | None = None) -> int:
    """Delete artifacts older than `days`. Returns number deleted."""
    if not settings.artifacts_enabled:
        return 0
    if days is None:
        days = settings.artifacts_retention_days
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)
    deleted = 0
    if not ARTIFACTS_DIR.exists():
        return 0
    for p in ARTIFACTS_DIR.iterdir():
        try:
            stat = p.stat()
            mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
            if mtime < cutoff:
                delete_artifact(p)
                deleted += 1
        except Exception:
            continue
    return deleted


def save_original(job_id: int, content: bytes, filename: str, mime_type: str) -> Path:
    if not settings.store_originals:
        raise RuntimeError("Originals storage disabled")
    # S3 support
    if settings.artifacts_storage == 's3':
        # upload to s3
        if boto3 is None:
            raise RuntimeError('boto3 is required for S3 originals storage but not installed')
        key = f"originals/{job_id}/{uuid.uuid4().hex}/{Path(filename).name}"
        client = _s3_client()
        bucket = settings.s3_bucket
        if not bucket:
            raise RuntimeError('S3 bucket not configured')
        client.put_object(Bucket=bucket, Key=key, Body=content, ContentType=mime_type)
        return f"s3://{bucket}/{key}"
    ensure_dir_exists(ORIGINALS_DIR)
    safe_name = _filename_for(job_id, filename)
    dest = ORIGINALS_DIR / safe_name
    with open(dest, 'wb') as fh:
        fh.write(content)
    os.utime(dest, None)
    return dest


def get_original_path(job_id: int) -> Optional[Path]:
    if not ORIGINALS_DIR.exists():
        return None
    prefix = f"{job_id}_"
    for p in ORIGINALS_DIR.iterdir():
        if p.name.startswith(prefix) and p.is_file():
            return p
    return None


def get_s3_object(s3_uri: str) -> Optional[bytes]:
    if not s3_uri.startswith('s3://'):
        return None
    if boto3 is None:
        return None
    client = _s3_client()
    bucket_key = s3_uri[len('s3://'):]
    bucket, key = bucket_key.split('/', 1)
    try:
        obj = client.get_object(Bucket=bucket, Key=key)
        return obj['Body'].read()
    except Exception:
        return None


def cleanup_old_originals(days: int | None = None) -> int:
    if days is None:
        days = settings.originals_retention_days
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)
    deleted = 0
    if not ORIGINALS_DIR.exists():
        return 0
    for p in ORIGINALS_DIR.iterdir():
        try:
            stat = p.stat()
            mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
            if mtime < cutoff:
                delete_artifact(p)
                deleted += 1
        except Exception:
            continue
    return deleted


@dataclass
class StorageBackend:
    name: str
    # for S3 we can add methods but for now we use local-only; S3 placeholder added later


def storage_backend() -> StorageBackend:
    return StorageBackend(name=settings.artifacts_storage)
