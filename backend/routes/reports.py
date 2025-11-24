from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from database import cases_collection, users_collection, vehicles_collection, stock_collection, shifts_collection
from auth_utils import get_current_user
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/case-statistics")
async def get_case_statistics(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Vaka İstatistikleri Raporu"""
    await get_current_user(request)
    
    # Date range
    query = {}
    if start_date and end_date:
        query["created_at"] = {
            "$gte": datetime.fromisoformat(start_date),
            "$lte": datetime.fromisoformat(end_date)
        }
    
    # Total cases
    total_cases = await cases_collection.count_documents(query)
    
    # By priority
    high_priority = await cases_collection.count_documents({**query, "priority": "yuksek"})
    medium_priority = await cases_collection.count_documents({**query, "priority": "orta"})
    low_priority = await cases_collection.count_documents({**query, "priority": "dusuk"})
    
    # By status
    status_counts = {}
    statuses = ["acildi", "ekip_bilgilendirildi", "ekip_yola_cikti", "sahada", 
                "hasta_alindi", "doktor_konsultasyonu", "merkeze_donus", 
                "hastane_sevki", "tamamlandi", "iptal"]
    
    for status in statuses:
        count = await cases_collection.count_documents({**query, "status": status})
        status_counts[status] = count
    
    # Daily breakdown (last 30 days)
    daily_cases = []
    if not start_date:
        for i in range(30):
            day = datetime.utcnow() - timedelta(days=i)
            day_start = datetime(day.year, day.month, day.day)
            day_end = day_start + timedelta(days=1)
            
            count = await cases_collection.count_documents({
                "created_at": {"$gte": day_start, "$lt": day_end}
            })
            
            daily_cases.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "count": count
            })
    
    daily_cases.reverse()
    
    return {
        "total_cases": total_cases,
        "by_priority": {
            "high": high_priority,
            "medium": medium_priority,
            "low": low_priority
        },
        "by_status": status_counts,
        "daily_breakdown": daily_cases
    }

@router.get("/personnel-performance")
async def get_personnel_performance(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Personel Performans Raporu"""
    await get_current_user(request)
    
    query = {}
    if start_date and end_date:
        query["created_at"] = {
            "$gte": datetime.fromisoformat(start_date),
            "$lte": datetime.fromisoformat(end_date)
        }
    
    # Get all field users
    users = await users_collection.find({
        "role": {"$in": ["paramedik", "att", "sofor", "bas_sofor", "doktor", "hemsire"]}
    }).to_list(1000)
    
    performance_data = []
    for user in users:
        # Cases created
        cases_created = await cases_collection.count_documents({
            **query,
            "created_by": user["_id"]
        })
        
        # Shifts completed
        shifts_completed = await shifts_collection.count_documents({
            "user_id": user["_id"],
            "end_time": {"$exists": True}
        })
        
        # Total shift hours
        shifts = await shifts_collection.find({
            "user_id": user["_id"],
            "duration_minutes": {"$exists": True}
        }).to_list(1000)
        
        total_minutes = sum(s.get("duration_minutes", 0) for s in shifts)
        
        performance_data.append({
            "user_id": user["_id"],
            "user_name": user["name"],
            "role": user["role"],
            "cases_created": cases_created,
            "shifts_completed": shifts_completed,
            "total_hours": round(total_minutes / 60, 2)
        })
    
    return {"personnel": performance_data}

@router.get("/vehicle-usage")
async def get_vehicle_usage(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Araç Kullanım Raporu"""
    await get_current_user(request)
    
    vehicles = await vehicles_collection.find({}).to_list(1000)
    
    usage_data = []
    for vehicle in vehicles:
        # Cases with this vehicle
        cases_count = await cases_collection.count_documents({
            "assigned_team.vehicle_id": vehicle["_id"]
        })
        
        # Shifts with this vehicle
        shifts_count = await shifts_collection.count_documents({
            "vehicle_id": vehicle["_id"],
            "end_time": {"$exists": True}
        })
        
        usage_data.append({
            "vehicle_id": vehicle["_id"],
            "plate": vehicle["plate"],
            "type": vehicle["type"],
            "status": vehicle["status"],
            "km": vehicle["km"],
            "cases_count": cases_count,
            "shifts_count": shifts_count
        })
    
    return {"vehicles": usage_data}

@router.get("/stock-movement")
async def get_stock_movement(request: Request):
    """Stok Hareket Raporu"""
    await get_current_user(request)
    
    stock_items = await stock_collection.find({}).to_list(1000)
    
    movement_data = []
    for item in stock_items:
        # Calculate usage rate
        usage_rate = 0
        if item["quantity"] < item["min_quantity"]:
            usage_rate = ((item["min_quantity"] - item["quantity"]) / item["min_quantity"]) * 100
        
        movement_data.append({
            "item_id": item["_id"],
            "name": item["name"],
            "code": item["code"],
            "location": item["location"],
            "quantity": item["quantity"],
            "min_quantity": item["min_quantity"],
            "usage_rate": round(usage_rate, 2),
            "status": "critical" if item["quantity"] < item["min_quantity"] else "normal"
        })
    
    return {"stock_items": movement_data}

@router.get("/intervention-time")
async def get_intervention_time(request: Request):
    """Müdahale Süre Analizi"""
    await get_current_user(request)
    
    # Get cases with timeline
    cases = await cases_collection.find({
        "status_history": {"$exists": True}
    }).to_list(1000)
    
    time_analysis = []
    for case in cases:
        if len(case.get("status_history", [])) < 2:
            continue
        
        first_status = case["status_history"][0]
        last_status = case["status_history"][-1]
        
        start_time = first_status["updated_at"]
        end_time = last_status["updated_at"]
        
        if isinstance(start_time, str):
            start_time = datetime.fromisoformat(start_time)
        if isinstance(end_time, str):
            end_time = datetime.fromisoformat(end_time)
        
        duration_minutes = (end_time - start_time).total_seconds() / 60
        
        time_analysis.append({
            "case_number": case["case_number"],
            "priority": case["priority"],
            "status": case["status"],
            "duration_minutes": round(duration_minutes, 2),
            "status_count": len(case["status_history"])
        })
    
    # Calculate averages
    if time_analysis:
        avg_duration = sum(c["duration_minutes"] for c in time_analysis) / len(time_analysis)
    else:
        avg_duration = 0
    
    return {
        "cases": time_analysis,
        "average_duration_minutes": round(avg_duration, 2)
    }

@router.get("/critical-stock-alert")
async def get_critical_stock_alert(request: Request):
    """Kritik Stok Uyarı Raporu"""
    await get_current_user(request)
    
    # Critical items
    critical = await stock_collection.find({
        "$expr": {"$lt": ["$quantity", "$min_quantity"]}
    }).to_list(1000)
    
    # Expired items
    expired = await stock_collection.find({
        "expiry_date": {"$lte": datetime.utcnow()}
    }).to_list(1000)
    
    # Expiring soon
    expiring_soon = await stock_collection.find({
        "expiry_date": {
            "$gt": datetime.utcnow(),
            "$lte": datetime.utcnow() + timedelta(days=30)
        }
    }).to_list(1000)
    
    return {
        "critical_stock": [
            {
                "name": item["name"],
                "code": item["code"],
                "quantity": item["quantity"],
                "min_quantity": item["min_quantity"],
                "location": item["location"]
            } for item in critical
        ],
        "expired_items": [
            {
                "name": item["name"],
                "code": item["code"],
                "expiry_date": item["expiry_date"].isoformat() if item.get("expiry_date") else None,
                "location": item["location"]
            } for item in expired
        ],
        "expiring_soon": [
            {
                "name": item["name"],
                "code": item["code"],
                "expiry_date": item["expiry_date"].isoformat() if item.get("expiry_date") else None,
                "days_remaining": (item["expiry_date"] - datetime.utcnow()).days if item.get("expiry_date") else 0,
                "location": item["location"]
            } for item in expiring_soon
        ]
    }
