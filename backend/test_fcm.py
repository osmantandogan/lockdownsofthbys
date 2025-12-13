"""Test FCM notification script"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def find_users_with_fcm():
    client = AsyncIOMotorClient(os.getenv('MONGO_URL'))
    db = client[os.getenv('DB_NAME', 'healmedy_hbys')]
    
    # FCM token'ı olan kullanıcıları bul
    users = await db.users.find({'fcm_tokens': {'$exists': True, '$ne': []}}).to_list(50)
    
    print(f"\n{'='*60}")
    print(f"FCM Token'ı Olan Kullanıcılar: {len(users)}")
    print(f"{'='*60}\n")
    
    for user in users:
        print(f"Kullanıcı: {user.get('name')}")
        print(f"  Rol: {user.get('role')}")
        print(f"  ID: {user.get('_id')}")
        fcm_tokens = user.get('fcm_tokens', [])
        print(f"  Token Sayısı: {len(fcm_tokens)}")
        for i, t in enumerate(fcm_tokens):
            token = t.get('token', '')
            print(f"  Token {i+1}: {token[:40]}..." if len(token) > 40 else f"  Token {i+1}: {token}")
        print()
    
    client.close()
    return users

async def send_test_notification():
    """Test bildirimi gönder"""
    from services.firebase_service import firebase_service
    
    client = AsyncIOMotorClient(os.getenv('MONGO_URL'))
    db = client[os.getenv('DB_NAME', 'healmedy_hbys')]
    
    # FCM token'ı olan hemşire kullanıcısını bul
    user = await db.users.find_one({
        'role': 'hemsire',
        'fcm_tokens': {'$exists': True, '$ne': []}
    })
    
    if not user:
        print("Hemşire kullanıcısı veya FCM token bulunamadı!")
        client.close()
        return
    
    print(f"\n{'='*60}")
    print(f"Bildirim Gönderiliyor...")
    print(f"Kullanıcı: {user.get('name')}")
    print(f"{'='*60}\n")
    
    # Token'ları al
    tokens = [t.get('token') for t in user.get('fcm_tokens', []) if t.get('token')]
    
    if not tokens:
        print("FCM token bulunamadı!")
        client.close()
        return
    
    # Firebase'i başlat
    firebase_service.initialize()
    
    # Bildirim gönder
    result = await firebase_service.send_to_multiple(
        tokens=tokens,
        title="🔔 Test Bildirimi",
        body=f"Merhaba {user.get('name')}! Bu bir test bildirimidir.",
        notification_type="case",
        data={
            "type": "test",
            "timestamp": "2025-12-13T16:30:00"
        }
    )
    
    print(f"Sonuç: {result}")
    client.close()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "send":
        asyncio.run(send_test_notification())
    else:
        asyncio.run(find_users_with_fcm())


