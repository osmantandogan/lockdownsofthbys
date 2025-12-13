"""Clear FCM tokens from database"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def clear_fcm_tokens():
    client = AsyncIOMotorClient(os.getenv('MONGO_URL'))
    db = client[os.getenv('DB_NAME', 'healmedy_hbys')]
    
    # Tum FCM tokenlarini temizle
    result = await db.users.update_many(
        {'fcm_tokens': {'$exists': True}},
        {'$set': {'fcm_tokens': []}}
    )
    
    print(f'Temizlenen kullanici sayisi: {result.modified_count}')
    client.close()

if __name__ == "__main__":
    asyncio.run(clear_fcm_tokens())




