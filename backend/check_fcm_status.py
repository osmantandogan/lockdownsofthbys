import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_fcm_status():
    client = AsyncIOMotorClient(os.getenv('MONGO_URL'))
    db = client[os.getenv('DB_NAME', 'healmedy_hbys')]
    
    print('=== FCM TOKEN DURUMU ===')
    
    # FCM tokeni olan tum kullanicilari listele
    users_with_fcm = db.users.find({'fcm_tokens': {'$exists': True, '$ne': []}})
    
    count = 0
    async for user in users_with_fcm:
        count += 1
        name = f"{user.get('name', '')} {user.get('surname', '')}".strip()
        role = user.get('role', 'unknown')
        tokens = user.get('fcm_tokens', [])
        token_count = len(tokens)
        print(f'  - {name} ({role}): {token_count} token(s)')
        
        # Token detayi
        for i, token_obj in enumerate(tokens):
            if isinstance(token_obj, dict):
                token = token_obj.get('token', '')[:40] + '...'
                device = token_obj.get('device_id', 'unknown')[:20]
                print(f'      Token {i+1}: {token} (device: {device})')
            else:
                print(f'      Token {i+1}: {str(token_obj)[:40]}...')
    
    if count == 0:
        print('  Hicbir kullanicida FCM token yok!')
    else:
        print(f'\nToplam {count} kullanici FCM token\'a sahip')
    
    client.close()
    print('\n=== KONTROL TAMAMLANDI ===')

if __name__ == "__main__":
    asyncio.run(check_fcm_status())

