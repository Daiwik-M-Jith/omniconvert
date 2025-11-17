from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "OmniConvert"
    database_url: str = "sqlite:///./data/conversions.db"
    max_upload_size_mb: int = 25
    allowed_origins: list[str] = ["*"]
    # Artifact persistence
    artifacts_enabled: bool = True
    artifacts_dir: str = "./data/artifacts"
    artifacts_retention_days: int = 7
    # Originals
    store_originals: bool = True
    originals_dir: str = "./data/originals"
    originals_retention_days: int = 7
    # Storage backend: 'local' or 's3'
    artifacts_storage: str = 'local'
    s3_bucket: str | None = None
    s3_region: str | None = None
    s3_access_key: str | None = None
    s3_secret_key: str | None = None
    # Default share token TTL (seconds)
    share_token_ttl_s: int = 86400


settings = Settings()
