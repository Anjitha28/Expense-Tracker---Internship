import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # Try loading directly from DATABASE_URL first
    database_url: str = Field(default="", alias="DATABASE_URL")
    
    # Or build from individual fields if DATABASE_URL is not set
    db_user: str = Field(default="postgres", alias="DB_USER")
    db_password: str = Field(default="postgres", alias="DB_PASSWORD")
    db_host: str = Field(default="localhost", alias="DB_HOST")
    db_port: int = Field(default=5432, alias="DB_PORT")
    db_database: str = Field(default="expense_tracker", alias="DB_DATABASE")
    
    jwt_secret: str = Field(default="super_secret_fintech_key_123456", alias="JWT_SECRET")
    api_base_url: str = Field(default="http://localhost:5000", alias="API_BASE_URL")
    port: int = Field(default=5000, alias="PORT")
    upload_dir: str = Field(default="uploads", alias="UPLOAD_FOLDER_PATH")

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def get_database_url(self) -> str:
        """Return the PostgreSQL database URL.

        The environment may provide a full ``DATABASE_URL``. If not, we
        construct one from the individual credentials. SQLite fallback
        has been removed – the application now requires PostgreSQL.
        """
        if self.database_url:
            url = self.database_url
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql://", 1)
            return url

        # Construct PostgreSQL URL from individual fields
        return f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_database}"

settings = Settings()
