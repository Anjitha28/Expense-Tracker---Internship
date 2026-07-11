from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

DATABASE_URL = settings.get_database_url()

# PostgreSQL doesn't need check_same_thread
connect_args = {}

# Enable pool pre-ping to handle disconnected DB sessions gracefully
engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
