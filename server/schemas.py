from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ConversionRequest(BaseModel):
    target_format: str


class ConversionResponse(BaseModel):
    job_id: int
    filename: str
    target_format: str
    mime_type: str


class TargetDescriptor(BaseModel):
    ext: str
    note: Optional[str] = None


class FormatDescriptor(BaseModel):
    source: str
    targets: list[TargetDescriptor]


class ConversionJobRead(BaseModel):
    id: int
    source_name: str
    source_format: str
    target_format: str
    status: str
    duration_ms: Optional[int]
    error: Optional[str]
    created_at: datetime
    artifact_stored: Optional[bool] = False
    artifact_mime_type: Optional[str] = None
    stored_at: Optional[datetime] = None
    original_stored: Optional[bool] = False
    original_mime_type: Optional[str] = None
    share_token_expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
