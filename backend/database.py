from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
