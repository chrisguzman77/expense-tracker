from app.config import settings
from app.databse import Base

config.set_main_option("sqlalchemy.url", settings.database_url)
target_metadata = Base.metadata
