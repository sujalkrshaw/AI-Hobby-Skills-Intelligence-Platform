from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "sqlite:///./local.db"
    secret_key: str = "dev-only-change-me"
    access_token_expire_minutes: int = 120
    cors_origins: str = "http://localhost:5173"
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "hobby-media"
    minio_secure: bool = False
    stackexchange_api_url: str = "https://api.stackexchange.com/2.3/tags"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
