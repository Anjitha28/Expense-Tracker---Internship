import os
from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.database import engine, Base, get_db
from app.config import settings
import app.crud as crud

# Import routers
from app.routers import auth, transactions, categories, payment_modes, recurring, dashboard, reports, settings as settings_router

# Initialize FastAPI App
app = FastAPI(
    title="Smart Personal Expense Tracker API",
    description="Backend REST API for fintech-style Personal Expense Tracker",
    version="1.0.0"
)

# Enable CORS for frontend communication
# Allow localhost development ports (Vite standard: 5173, 3000, etc.)
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production customize this, for development allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup Event: Create DB tables and run scheduler
@app.on_event("startup")
def startup_event():
    # 1. Test database connection
    try:
        print("Testing connection to PostgreSQL database...")
        with engine.connect() as conn:
            print("Successfully connected to PostgreSQL database.")
    except Exception as e:
        import sys
        print("\n" + "="*80)
        print("FATAL ERROR: Could not connect to PostgreSQL database!")
        print(f"DATABASE_URL configured: {settings.get_database_url()}")
        print(f"Error Details: {e}")
        print("="*80 + "\n")
        sys.exit(1)

    # 2. Initialize tables if they do not exist
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables initialized successfully.")
    except Exception as e:
        print(f"Error creating database tables: {e}")
        raise e
    
    # 2. Setup upload folder
    os.makedirs(settings.upload_dir, exist_ok=True)
    
    # 3. Process recurring payments
    db = next(get_db())
    try:
        crud.process_recurring_transactions(db)
        print("Recurring transactions checked on startup.")
    except Exception as e:
        print(f"Error checking recurring transactions on startup: {e}")
    finally:
        db.close()

# Mount Static Files for Uploads
os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# Include Routers with '/api' prefix
app.include_router(auth.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(payment_modes.router, prefix="/api")
app.include_router(recurring.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to Smart Personal Expense Tracker REST API. Use /docs for API documentation."
    }
