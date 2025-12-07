from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path

# Import routers
from routes import auth, users, cases, vehicles, stock, shifts, settings, forms, documents, reference_data, video_call, notifications, medications

ROOT_DIR = Path(__file__).parent.resolve()
load_dotenv(ROOT_DIR / '.env', override=True)

# MongoDB connection - fallback to hardcoded values
mongo_url = os.environ.get('MONGO_URL', 'mongodb+srv://healmedy_user:H3alm3dy2024!@abro.lwzasyg.mongodb.net/')
db_name = os.environ.get('DB_NAME', 'healmedy_hbys')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Create the main app
app = FastAPI(title="HealMedy HBYS API")

# CORS middleware - MUST be added BEFORE routes
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["http://localhost:3001", "http://localhost:3000", "http://127.0.0.1:3001", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Include all routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(cases.router, prefix="/cases", tags=["Cases"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["Vehicles"])
api_router.include_router(stock.router, prefix="/stock", tags=["Stock"])
api_router.include_router(shifts.router, prefix="/shifts", tags=["Shifts"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])
api_router.include_router(forms.router, prefix="/forms", tags=["Forms"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(reference_data.router, prefix="/reference", tags=["Reference Data"])
api_router.include_router(video_call.router, prefix="/video", tags=["Video Call"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(medications.router, prefix="/medications", tags=["Medications"])

# Health check endpoint
@api_router.get("/")
async def root():
    return {"message": "HealMedy HBYS API v1.0", "status": "healthy"}

# Railway health check (root level)
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "healmedy-backend"}

# Include the router in the main app
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    # Initialize notification service to load config
    from services.notification_service import notification_service
    logger.info("Notification service initialized")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
