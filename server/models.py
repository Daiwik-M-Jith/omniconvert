from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field


class ConversionJob(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    source_name: str
    source_format: str
    target_format: str
    status: str = "pending"
    duration_ms: Optional[int] = None
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Stored artifact
    artifact_path: Optional[str] = None
    artifact_mime_type: Optional[str] = None
    stored_at: Optional[datetime] = None
    # persisted original upload path
    original_path: Optional[str] = None
    original_mime_type: Optional[str] = None
    # optional share token and expiry
    share_token: Optional[str] = None
    share_token_expires_at: Optional[datetime] = None

    @property
    def artifact_stored(self) -> bool:
        return bool(self.artifact_path)

    @property
    def original_stored(self) -> bool:
        return bool(self.original_path)
