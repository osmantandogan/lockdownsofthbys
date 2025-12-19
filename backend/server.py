from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import os
import logging
from pathlib import Path

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import routers
try:
    from routes import auth, users, cases, vehicles, stock, shifts, settings, forms, documents, reference_data, video_call, notifications, medications, otp, its, approvals, patients, pdf, stock_barcode, material_requests, locations, pdf_templates, pdf_template, tickets, form_templates, excel_templates, firms, form_config, stock_v2, stock_new, warehouse
    logger.info("Tüm router'lar başarıyla yüklendi")
except ImportError as e:
    logger.error(f"Router import hatası: {e}")
    raise

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
    "https://abro.ldserp.com",
    "https://courteous-renewal-production-5ab5.up.railway.app",  # Backend URL (Railway)
    # Capacitor Android/iOS origins
    "https://localhost",
    "capacitor://localhost",
    "http://localhost",
    "ionic://localhost",
    "https://app.healmedy.com",
    "capacitor://app.healmedy.com"
])
# Remove empty strings
allowed_origins = [o.strip() for o in allowed_origins if o.strip()]

logger.info(f"CORS allowed origins: {allowed_origins}")

# CORS middleware - .ldserp.com ve .railway.app domain'lerine ve tüm allowed origins'e izin ver
# Railway reverse proxy için özel CORS ayarları
# allow_origin_regex ve allow_origins birlikte kullanıldığında OR mantığıyla çalışır
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,  # Explicit origin list
    allow_origin_regex=r"https?://.*\.(ldserp\.com|railway\.app)",  # .ldserp.com ve .railway.app ile biten tüm origin'lere izin ver
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],  # Tüm metodlara izin ver
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,  # 24 saat cache
)

# HTTP middleware to add CORS headers as backup (AFTER CORS middleware)
# This ensures CORS headers are always present even if middleware fails
@app.middleware("http")
async def add_cors_headers_backup(request: Request, call_next):
    """Add CORS headers to all responses as backup for Railway reverse proxy"""
    origin = request.headers.get("origin", "")
    
    response = await call_next(request)
    
    # Eğer origin .ldserp.com, .railway.app ile bitiyorsa veya allowed_origins'de varsa CORS header'ları ekle
    # Sadece eğer CORS middleware header eklememişse ekle (backup)
    if origin and (origin in allowed_origins or origin.endswith('.ldserp.com') or origin.endswith('.railway.app')):
        if "Access-Control-Allow-Origin" not in response.headers:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Expose-Headers"] = "*"
            response.headers["Access-Control-Max-Age"] = "86400"
    
    return response

# Global exception handler to ensure CORS headers on errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions and ensure CORS headers are present"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    # Get origin from request
    origin = request.headers.get("origin", "")
    
    response = JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )
    
    # Add CORS headers if origin is allowed
    if origin in allowed_origins or origin.endswith('.ldserp.com'):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

# Handle 404 errors with CORS headers
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions (including 404) with CORS headers"""
    origin = request.headers.get("origin", "")
    
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )
    
    # Add CORS headers
    if origin in allowed_origins or origin.endswith('.ldserp.com'):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Include all routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(cases.router, prefix="/cases", tags=["Cases"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["Vehicles"])
api_router.include_router(stock_new.router, prefix="/stock-new", tags=["Stock - Yeni Sistem"])
api_router.include_router(stock_new.router, prefix="/stock", tags=["Stock - Alias (Eski API Uyumluluğu)"])
api_router.include_router(warehouse.router, prefix="/warehouse", tags=["Warehouse - Merkez Depo"])
api_router.include_router(shifts.router, prefix="/shifts", tags=["Shifts"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])
api_router.include_router(forms.router, prefix="/forms", tags=["Forms"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(reference_data.router, prefix="/reference-data", tags=["Reference Data"])
api_router.include_router(reference_data.router, prefix="/reference", tags=["Reference Data"])  # Alias for frontend compatibility
api_router.include_router(video_call.router, prefix="/video", tags=["Video Call"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(medications.router, prefix="/medications", tags=["Medications"])
api_router.include_router(otp.router, prefix="/otp", tags=["OTP"])
api_router.include_router(its.router, prefix="/its", tags=["İTS - İlaç Takip Sistemi"])
api_router.include_router(approvals.router, prefix="/approvals", tags=["Approvals - Onay Sistemi"])
api_router.include_router(patients.router, prefix="/patients", tags=["Patients - Hasta Kartı"])
api_router.include_router(pdf.router, prefix="/pdf", tags=["PDF - PDF Generation"])
api_router.include_router(stock_barcode.router, prefix="/stock-barcode", tags=["Stock Barcode - Karekod Bazlı Stok"])
api_router.include_router(stock_v2.router, prefix="/stock-v2", tags=["Stock V2 - Yeni Stok Sistemi"])
api_router.include_router(material_requests.router, prefix="/material-requests", tags=["Material Requests - Malzeme Talepleri"])
api_router.include_router(locations.router, prefix="/locations", tags=["Locations - Lokasyon Yönetimi"])
api_router.include_router(pdf_templates.router, prefix="/pdf-templates", tags=["PDF Templates - PDF Şablon Yönetimi"])
api_router.include_router(pdf_template.router, prefix="/pdf-template", tags=["PDF Template Generation - Şablonlu PDF Oluşturma"])
api_router.include_router(tickets.router, prefix="/tickets", tags=["Tickets - Bildirim ve Talepler"])
api_router.include_router(form_templates.router, prefix="/form-templates", tags=["Form Templates - Form Şablonları (PDF + Tablo)"])
api_router.include_router(excel_templates.router, prefix="/excel-templates", tags=["Excel Templates - Excel Form Şablonları"])
api_router.include_router(firms.router, prefix="/firms", tags=["Firms - Firma Yönetimi"])
api_router.include_router(form_config.router, prefix="/form-config", tags=["Form Config - Vaka Formu Yapılandırması"])

# Health check endpoint
@api_router.get("/")
async def root():
    return {"message": "HealMedy HBYS API v1.0", "status": "healthy"}

# Railway health check (root level)
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "healmedy-backend"}

# OPTIONS handler for all routes (CORS preflight) - MUST be before router inclusion
@app.options("/{full_path:path}")
async def options_handler(request: Request, full_path: str):
    """Handle OPTIONS requests for CORS preflight"""
    origin = request.headers.get("origin", "")
    
    response = Response(status_code=200)
    
    # Eğer origin .ldserp.com ile bitiyorsa, .railway.app ile bitiyorsa veya allowed_origins'de varsa CORS header'ları ekle
    if origin and (origin in allowed_origins or origin.endswith('.ldserp.com') or origin.endswith('.railway.app')):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Expose-Headers"] = "*"
        response.headers["Access-Control-Max-Age"] = "86400"
    
    return response

# Include the router in the main app
app.include_router(api_router)

# Scheduler instance
scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Server başlatılıyor...")
    logger.info(f"Excel templates router yüklendi: {hasattr(excel_templates, 'router')}")
    if hasattr(excel_templates, 'router'):
        logger.info(f"Excel templates router routes: {[r.path for r in excel_templates.router.routes]}")
    
    # Initialize notification service to load config
    from services.notification_service import notification_service
    logger.info("Notification service initialized")
    
    # Initialize Firebase Cloud Messaging
    from services.firebase_service import firebase_service
    firebase_initialized = firebase_service.initialize()
    if firebase_initialized:
        logger.info("Firebase Cloud Messaging initialized successfully")
    else:
        logger.warning("Firebase Cloud Messaging not initialized (credentials missing or invalid)")
    
    # Initialize ITS (İlaç Takip Sistemi) service with credentials
    from services.its_service import configure_its_service, get_its_service
    
    # HARDCODED İTS Credentials (Geçici)
    its_username = "86836847871710000"
    its_password = "Ntpf405"
    its_use_test = True
    
    configure_its_service(
        username=its_username,
        password=its_password,
        use_test=its_use_test
    )
    logger.info(f"İTS service configured (HARDCODED, test_mode={its_use_test})")
    
    # İlaç listesini çek ve cache'le
    try:
        its_service = get_its_service()
        drugs = await its_service.fetch_drug_list(get_all=True)
        logger.info(f"İTS ilaç listesi yüklendi: {len(drugs)} ilaç")
    except Exception as e:
        logger.error(f"İTS ilaç listesi yüklenemedi: {e}")
    
    # Eski stok verilerini temizle ve yeni sistemi başlat
    try:
        from routes.stock_new import cleanup_old_stock_data, seed_all_locations
        
        # Eski verileri temizle
        await cleanup_old_stock_data()
        logger.info("Eski stok verileri temizlendi")
        
        # Yeni stok sistemini başlat
        seed_result = await seed_all_locations()
        vehicles_created = len([r for r in seed_result["vehicles"] if r.get("action") == "created"])
        wp_created = len([r for r in seed_result["waiting_points"] if r.get("action") == "created"])
        if vehicles_created > 0 or wp_created > 0:
            logger.info(f"Otomatik stok seed: {vehicles_created} araç, {wp_created} bekleme noktası")
        else:
            logger.info("Stok seed: Tüm lokasyonlar zaten mevcut")
    except Exception as e:
        logger.warning(f"Stok sistemi başlatma hatası: {e}")
    
    # Otomatik vardiya başlatma scheduler'ını başlat
    try:
        from routes.shifts import auto_start_health_center_shifts
        
        # Her dakika çalışacak şekilde ayarla
        scheduler.add_job(
            auto_start_health_center_shifts,
            trigger=IntervalTrigger(minutes=1),
            id="auto_start_health_center_shifts",
            name="Sağlık Merkezi Otomatik Vardiya Başlatma",
            replace_existing=True
        )
        scheduler.start()
        logger.info("Otomatik vardiya başlatma scheduler'ı başlatıldı (her 1 dakikada bir)")
    except Exception as e:
        logger.error(f"Otomatik vardiya başlatma scheduler'ı başlatılamadı: {e}", exc_info=True)

@app.on_event("shutdown")
async def shutdown_db_client():
    # Scheduler'ı durdur
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler durduruldu")
    client.close()
