from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env from the backend directory
ROOT_DIR = Path(__file__).parent.resolve()
env_path = ROOT_DIR / '.env'
load_dotenv(env_path, override=True)

# Fallback to hardcoded values if env vars not found
mongo_url = os.environ.get('MONGO_URL', 'mongodb+srv://healmedy_user:H3alm3dy2024!@abro.lwzasyg.mongodb.net/')
db_name = os.environ.get('DB_NAME', 'healmedy_hbys')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Collections
users_collection = db.users
user_sessions_collection = db.user_sessions
cases_collection = db.cases
vehicles_collection = db.vehicles
stock_collection = db.stock
shifts_collection = db.shifts
shift_assignments_collection = db.shift_assignments
audit_logs_collection = db.audit_logs
notifications_collection = db.notifications
forms_collection = db.forms  # New: Form submissions
vehicle_km_logs_collection = db.vehicle_km_logs  # New: Vehicle KM tracking
document_metadata_collection = db.document_metadata  # New: Document management
medication_usage_collection = db.medication_usage  # Vakada kullanılan ilaçlar
stock_usage_logs_collection = db.stock_usage_logs  # Stok hareket logları
approvals_collection = db.approvals  # Onay kodları ve workflow
patients_collection = db.patients  # Hasta kartları
patient_access_logs_collection = db.patient_access_logs  # Hasta kartı erişim logları
counters_collection = db.counters  # Atomic counters for sequential numbers
handover_sessions_collection = db.handover_sessions  # Devir teslim oturumları
material_requests_collection = db.material_requests  # Malzeme talepleri

# YENİ: Lokasyon ve Transfer Sistemi
field_locations_collection = db.field_locations  # Saha lokasyonları (araç, carter, depo)
stock_transfers_collection = db.stock_transfers  # Stok transferleri
location_change_requests_collection = db.location_change_requests  # Lokasyon değişikliği istekleri
vehicle_current_locations_collection = db.vehicle_current_locations  # Araçların güncel lokasyonları
