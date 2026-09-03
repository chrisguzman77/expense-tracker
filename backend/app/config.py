from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_expire_minutes: int = 60
    environment: str = "development"

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()