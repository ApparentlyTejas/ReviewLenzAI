from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    pat_encryption_key: str
    groq_api_key: str

    cors_origins: str = "http://localhost:5173"
    cookie_secure: bool = False  # Set to True in production (HTTPS only)

    google_client_id: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    brevo_api_key: str = ""
    brevo_from_email: str = "reviewlenzai@gmail.com"
    app_url: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


# Required fields are supplied via environment variables / .env at runtime
# (pydantic-settings' BaseSettings), which mypy can't see from this call site.
settings = Settings()  # type: ignore[call-arg]
