import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_users():
    mongo_url = os.getenv("MONGO_URL")
    db_name = os.getenv("DB_NAME")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    users = await db.users.find({}).to_list(100)
    
    print(f"\nTotal users in database: {len(users)}\n")
    print("=" * 70)
    
    for user in users:
        email = user.get('email', 'N/A')
        role = user.get('role', 'N/A')
        has_password = 'YES' if user.get('password_hash') else 'NO'
        
        print(f"Email: {email}")
        print(f"  Role: {role}")
        print(f"  Has Password: {has_password}")
        print(f"  ID: {user.get('_id', 'N/A')}")
        print("-" * 70)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_users())

