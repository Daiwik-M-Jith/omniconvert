from __future__ import annotations

import time
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select

from .config import settings
from .database import init_db, get_session
from .models import ConversionJob
from .schemas import ConversionJobRead, FormatDescriptor
from .services.registry import registry
from .services import storage
import asyncio
from . import converters  # noqa: F401 - ensures converter registration


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: D401 - FastAPI lifespan hook
    init_db()
    # Run a quick cleanup of old artifacts on startup (best-effort)
    try:
        deleted = storage.cleanup_old_artifacts()
        deleted2 = storage.cleanup_old_originals()
        if deleted or deleted2:
            print(f"Cleaned up {deleted} old artifacts and {deleted2} originals")
    except Exception:
        pass

    # Start background cleanup loop
    stop_event = asyncio.Event()

    async def _cleanup_loop():
        # runs daily
        while not stop_event.is_set():
            try:
                storage.cleanup_old_artifacts()
                storage.cleanup_old_originals()
            except Exception:
                pass
            # sleep for 24 hours
            await asyncio.sleep(24 * 60 * 60)

    task = asyncio.create_task(_cleanup_loop())
    try:
        yield
    finally:
        stop_event.set()
        task.cancel()
    # lifespan finished


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/static", StaticFiles(directory=static_dir), name="frontend")


@app.get("/")
def read_index() -> FileResponse:
    return FileResponse(static_dir / "index.html")


@app.get("/api/formats", response_model=list[FormatDescriptor])
def list_formats():
    return registry.describe()


@app.get('/api/formats/expanded')
def list_expanded_formats():
    return registry.describe_reachable()


@app.get("/api/history", response_model=list[ConversionJobRead])
def get_history(limit: int = 25, session: Session = Depends(get_session)):
    statement = select(ConversionJob).order_by(ConversionJob.created_at.desc()).limit(limit)
    results = session.exec(statement).all()
    return results


@app.post("/api/convert")
async def convert_file(
    target_format: str = Form(...),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    filename = Path(file.filename or "uploaded")
    source_format = filename.suffix.lstrip(".").lower()
    target_format = target_format.lstrip(".").lower()

    if not source_format:
        raise HTTPException(status_code=400, detail="Source file must have an extension")

    content = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File limit is {settings.max_upload_size_mb} MB")

    job = ConversionJob(
        source_name=filename.name,
        source_format=source_format,
        target_format=target_format,
    )
    session.add(job)
    session.commit()
    session.refresh(job)

    # Save original if enabled
    try:
        if settings.store_originals:
            og_path = storage.save_original(job.id, content, filename.name, file.content_type or 'application/octet-stream')
            job.original_path = str(og_path)
            job.original_mime_type = file.content_type or 'application/octet-stream'
            session.add(job)
            session.commit()
    except Exception as exc:
        job.error = (job.error or '') + f"; original save failed: {exc}"
        session.add(job)
        session.commit()

    # Attempt a direct resolution, if not found or the direct converter fails, try chaining via intermediate converters
    chain = None
    try:
        converter = registry.resolve(source_format, target_format)
        chain = [(converter, target_format)]
    except KeyError:
        try:
            chain = registry.find_chain(source_format, target_format)
        except KeyError:
            job.status = "failed"
            job.error = "Conversion not supported yet"
            session.add(job)
            session.commit()
            raise HTTPException(status_code=422, detail="Conversion path not available yet")

    start = time.perf_counter()
    # Try to apply the selected chain; if the direct converter exists but fails (e.g., return RuntimeError because \n+    # of missing host binary), attempt to find an alternate chain and apply it.
    last_exc = None
    tried_chains = []
    while True:
        attempt = chain
        try:
            current = content
            mime_type = "application/octet-stream"
            for converter_func, next_ext in attempt:
                current, mime_type = converter_func(current, next_ext)
            output_bytes = current
            last_exc = None
            break
        except Exception as exc:  # pylint: disable=broad-except
            last_exc = exc
            tried_chains.append(attempt)
            try:
                # Exclude the failing direct edge (if present) and attempt to find an alternate chain
                exclude_edges = set()
                if len(attempt) == 1:
                    # direct converter failed, exclude that direct source->target edge
                    first_ext_pair = (source_format, target_format)
                    exclude_edges.add(first_ext_pair)
                alt_chain = registry.find_chain(source_format, target_format, exclude=exclude_edges)
                # only switch if we haven't tried this alternative chain yet
                if all(alt_chain != t for t in tried_chains):
                    chain = alt_chain
                    continue
            except KeyError:
                pass
            break
            # No alternative chain found or alternative chain also failed - re-raise below
    if last_exc is not None:
        job.status = "failed"
        job.error = str(last_exc)
        session.add(job)
        session.commit()
        raise HTTPException(status_code=500, detail=str(last_exc))

    duration = int((time.perf_counter() - start) * 1000)
    job.status = "success"
    job.duration_ms = duration
    # Save artifact if enabled
    try:
        if settings.artifacts_enabled:
            output_filename = f"{filename.stem}.{target_format}"
            path = storage.save_artifact(job.id, output_bytes, output_filename, mime_type)
            job.artifact_path = str(path)
            job.artifact_mime_type = mime_type
            from datetime import datetime, timezone
            job.stored_at = datetime.now(timezone.utc)
    except Exception as exc:
        job.error = (job.error or "") + f"; artifact save failed: {exc}"
    session.add(job)
    session.commit()

    output_filename = f"{filename.stem}.{target_format}"
    return StreamingResponse(
        BytesIO(output_bytes),
        media_type=mime_type,
        headers={
            "Content-Disposition": f"attachment; filename={output_filename}",
            "X-Conversion-Job": str(job.id),
        },
    )


@app.post('/api/jobs/{job_id}/reconvert')
def reconvert_job(job_id: int, session: Session = Depends(get_session)):
    job = session.get(ConversionJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')
    if not job.original_path:
        raise HTTPException(status_code=400, detail='No original stored for this job')
    # load original
    path = Path(job.original_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail='Stored original not found on disk')
    with open(path, 'rb') as fh:
        original_bytes = fh.read()
    # support S3 stored originals
    if job.original_path and isinstance(job.original_path, str) and job.original_path.startswith('s3://'):
        original_bytes = storage.get_s3_object(job.original_path)
        if original_bytes is None:
            raise HTTPException(status_code=404, detail='Stored original missing')
    # run conversion same as convert_file but using original_bytes
    try:
        converter = registry.resolve(job.source_format, job.target_format)
        chain = [(converter, job.target_format)]
    except KeyError:
        try:
            chain = registry.find_chain(job.source_format, job.target_format)
        except KeyError:
            raise HTTPException(status_code=422, detail='Conversion path not available yet')
    # run conversion chain
    current = original_bytes
    mime_type = 'application/octet-stream'
    try:
        for converter_func, next_ext in chain:
            current, mime_type = converter_func(current, next_ext)
    except Exception as exc:
        job.status = 'failed'
        job.error = str(exc)
        session.add(job)
        session.commit()
        raise HTTPException(status_code=500, detail=str(exc))
    # store artifact
    try:
        if settings.artifacts_enabled:
            output_filename = f"{Path(job.source_name).stem}.{job.target_format}"
            p = storage.save_artifact(job.id, current, output_filename, mime_type)
            job.artifact_path = str(p)
            job.artifact_mime_type = mime_type
            from datetime import datetime, timezone
            job.stored_at = datetime.now(timezone.utc)
    except Exception as exc:
        job.error = (job.error or '') + f"; artifact save failed: {exc}"
    job.status = 'success'
    session.add(job)
    session.commit()
    return {'job_id': job.id, 'artifact': job.artifact_path}


@app.post('/api/jobs/{job_id}/share')
def create_share_token(job_id: int, ttl_s: int | None = None, session: Session = Depends(get_session)):
    job = session.get(ConversionJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')
    if not job.artifact_path:
        raise HTTPException(status_code=404, detail='No stored artifact for this job')
    import secrets
    ttl = ttl_s or settings.share_token_ttl_s
    token = secrets.token_urlsafe(16)
    from datetime import datetime, timezone, timedelta
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl)
    job.share_token = token
    job.share_token_expires_at = expires_at
    session.add(job)
    session.commit()
    return {'job_id': job.id, 'share_url': f"/api/jobs/{job.id}/artifact?token={token}", 'expires_at': expires_at.isoformat()}


@app.get('/api/jobs/{job_id}/artifact')
def get_artifact(job_id: int, request: Request, session: Session = Depends(get_session)):
    job = session.get(ConversionJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    token = None
    # Allow token as query param for public sharing
    # FastAPI injects query params if declared; fallback to request query inspection
    from fastapi import Request
    # This function can't directly access Request param unless added; handle token via job parameter
    # For simplicity: accept token as a query param via request scope
    # We will use job.share_token verification below instead.
    if not job.artifact_path:
        raise HTTPException(status_code=404, detail="No stored artifact for this job")
    # If share_token exists, allow access only with token or if token not required
    if job.artifact_path.startswith('s3://'):
        # generate presigned url & redirect
        url = storage.get_s3_presigned_url(job.artifact_path)
        if not url:
            raise HTTPException(status_code=500, detail='Failed to generate signed url')
        return RedirectResponse(url)
    path = Path(job.artifact_path)
    # token validation: query param token (optional)
    token = request.query_params.get('token') if request is not None else None
    if job.share_token:
        # token must match and not be expired
        if not token or token != job.share_token:
            raise HTTPException(status_code=403, detail='Token required or invalid')
        if job.share_token_expires_at:
            expires = job.share_token_expires_at
            if expires.tzinfo is None:
                from datetime import timezone as _tz
                expires = expires.replace(tzinfo=_tz.utc)
            if expires < datetime.now(timezone.utc):
                raise HTTPException(status_code=403, detail='Share token expired')
    if not path.exists():
        raise HTTPException(status_code=404, detail="Stored artifact missing")
    return FileResponse(path, media_type=job.artifact_mime_type or 'application/octet-stream', filename=path.name)
