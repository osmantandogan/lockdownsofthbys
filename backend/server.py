from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path

# Import routers
from routes import auth, users, cases, vehicles, stock, shifts, settings, forms, documents, reference_data, video_call, notifications, medications, otp, its, approvals, patients, pdf, stock_barcode, material_requests

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
# Get allowed origins from env or use defaults
allowed_origins = os.environ.get('ALLOWED_ORIGINS', '').split(',') if os.environ.get('ALLOWED_ORIGINS') else []
allowed_origins.extend([
    "http://localhost:3001", 
    "http://localhost:3000", 
    "http://127.0.0.1:3001",
    "https://frontend-production-cd55.up.railway.app",
    "https://abro.ldserp.com"
])
# Remove empty strings
allowed_origins = [o.strip() for o in allowed_origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
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
api_router.include_router(otp.router, prefix="/otp", tags=["OTP"])
api_router.include_router(its.router, prefix="/its", tags=["İTS - İlaç Takip Sistemi"])
api_router.include_router(approvals.router, prefix="/approvals", tags=["Approvals - Onay Sistemi"])
api_router.include_router(patients.router, prefix="/patients", tags=["Patients - Hasta Kartı"])
api_router.include_router(pdf.router, tags=["PDF - PDF Generation"])
api_router.include_router(stock_barcode.router, prefix="/stock-barcode", tags=["Stock Barcode - Karekod Bazlı Stok"])
api_router.include_router(material_requests.router, prefix="/material-requests", tags=["Material Requests - Malzeme Talepleri"])

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
    
    # Initialize ITS (İlaç Takip Sistemi) service with credentials
    from services.its_service import configure_its_service
    its_username = os.environ.get('ITS_USERNAME', '86836847871710000')
    its_password = os.environ.get('ITS_PASSWORD', 'Ntpf405')
    its_use_test = os.environ.get('ITS_USE_TEST', 'true').lower() == 'true'
    
    if its_username and its_password:
        configure_its_service(
            username=its_username,
            password=its_password,
            use_test=its_use_test
        )
        logger.info(f"ITS service configured (test_mode={its_use_test})")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
