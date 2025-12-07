from fastapi import APIRouter, HTTPException, Request
from auth_utils import get_current_user
from database import cases_collection
import os
import httpx
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

# .env dosyasını yükle
ROOT_DIR = Path(__file__).parent.parent.resolve()
load_dotenv(ROOT_DIR / '.env', override=True)

router = APIRouter()

# Daily.co API configuration
DAILY_API_KEY = os.environ.get("DAILY_API_KEY", "")
DAILY_DOMAIN = os.environ.get("DAILY_DOMAIN", "")
DAILY_API_URL = "https://api.daily.co/v1"

# Debug için log
import logging
logger = logging.getLogger(__name__)
logger.info(f"Daily.co API Key loaded: {'Yes' if DAILY_API_KEY else 'No'}")
logger.info(f"Daily.co Domain: {DAILY_DOMAIN}")

@router.post("/{case_id}/create-room")
async def create_video_room(case_id: str, request: Request):
    """
    Daily.co ile görüntülü görüşme odası oluştur.
    
    Daily.co ücretsiz hesap için: https://dashboard.daily.co/signup
    API Key'i .env dosyasına ekleyin: DAILY_API_KEY=your_api_key
    """
    user = await get_current_user(request)
    
    # Vaka kontrolü
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    case_number = case_doc.get("case_number", case_id[:8])
    room_name = f"healmedy-{case_number}".lower().replace(" ", "-")
    
    # Daily.co API key kontrolü
    if not DAILY_API_KEY:
        # API key yoksa fallback olarak Jitsi kullan
        jitsi_domain = os.environ.get("JITSI_DOMAIN", "meet.jit.si")
        video_room_id = f"HealMedy{case_number}".replace("-", "").replace(" ", "")
        
        await cases_collection.update_one(
            {"_id": case_id},
            {"$set": {
                "video_room_id": video_room_id,
                "video_room_url": f"https://{jitsi_domain}/{video_room_id}",
                "video_provider": "jitsi",
                "video_call_active": True
            }}
        )
        
        return {
            "provider": "jitsi",
            "room_name": video_room_id,
            "room_url": f"https://{jitsi_domain}/{video_room_id}",
            "message": "Daily.co API key bulunamadı. Jitsi kullanılıyor."
        }
    
    # Daily.co ile oda oluştur
    try:
        async with httpx.AsyncClient() as client:
            # Önce mevcut odayı kontrol et
            check_response = await client.get(
                f"{DAILY_API_URL}/rooms/{room_name}",
                headers={"Authorization": f"Bearer {DAILY_API_KEY}"}
            )
            
            if check_response.status_code == 200:
                # Oda zaten var
                room_data = check_response.json()
                room_url = room_data.get("url")
            else:
                # Yeni oda oluştur
                room_config = {
                    "name": room_name,
                    "privacy": "public",  # Herkes katılabilir
                    "properties": {
                        "start_video_off": False,
                        "start_audio_off": False,
                        "enable_screenshare": True,
                        "enable_chat": True,
                        "enable_knocking": False,  # Lobby yok
                        "enable_prejoin_ui": False,  # Ön katılım ekranı yok
                        "lang": "tr",
                        "exp": int((datetime.utcnow() + timedelta(hours=24)).timestamp()),  # 24 saat geçerli
                        "eject_at_room_exp": True
                    }
                }
                
                create_response = await client.post(
                    f"{DAILY_API_URL}/rooms",
                    json=room_config,
                    headers={
                        "Authorization": f"Bearer {DAILY_API_KEY}",
                        "Content-Type": "application/json"
                    }
                )
                
                if create_response.status_code not in [200, 201]:
                    raise HTTPException(
                        status_code=500, 
                        detail=f"Daily.co oda oluşturulamadı: {create_response.text}"
                    )
                
                room_data = create_response.json()
                room_url = room_data.get("url")
        
        # Veritabanını güncelle
        await cases_collection.update_one(
            {"_id": case_id},
            {"$set": {
                "video_room_id": room_name,
                "video_room_url": room_url,
                "video_provider": "daily",
                "video_call_active": True,
                "video_call_started_at": datetime.utcnow().isoformat(),
                "video_call_started_by": user.id
            }}
        )
        
        return {
            "provider": "daily",
            "room_name": room_name,
            "room_url": room_url,
            "message": "Görüntülü görüşme odası hazır!"
        }
        
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Daily.co bağlantı hatası: {str(e)}")


@router.post("/{case_id}/end-room")
async def end_video_room(case_id: str, request: Request):
    """Görüntülü görüşmeyi sonlandır"""
    user = await get_current_user(request)
    
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    # Veritabanını güncelle
    await cases_collection.update_one(
        {"_id": case_id},
        {"$set": {
            "video_call_active": False,
            "video_call_ended_at": datetime.utcnow().isoformat(),
            "video_call_ended_by": user.id
        }}
    )
    
    return {"message": "Görüntülü görüşme sonlandırıldı"}


@router.get("/{case_id}/room-status")
async def get_room_status(case_id: str, request: Request):
    """Görüntülü görüşme durumunu kontrol et"""
    await get_current_user(request)
    
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    return {
        "active": case_doc.get("video_call_active", False),
        "provider": case_doc.get("video_provider"),
        "room_url": case_doc.get("video_room_url"),
        "room_name": case_doc.get("video_room_id"),
        "started_at": case_doc.get("video_call_started_at")
    }

