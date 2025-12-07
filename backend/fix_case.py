# -*- coding: utf-8 -*-
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.resolve()
load_dotenv(ROOT_DIR / '.env', override=True)

mongo_url = os.environ.get('MONGO_URL', 'mongodb+srv://healmedy_user:H3alm3dy2024!@abro.lwzasyg.mongodb.net/')
db_name = os.environ.get('DB_NAME', 'healmedy_hbys')

async def fix_cases():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    case = await db.cases.find_one({"case_number": "20251127-123130"})
    if not case:
        print("Vaka bulunamadi")
        return
    
    vehicle_id = case.get("assigned_team", {}).get("vehicle_id")
    case_id = case.get("_id")
    print("Vaka:", case.get("case_number"), "Arac:", vehicle_id)
    
    assignments = await db.shift_assignments.find({
        "vehicle_id": vehicle_id,
        "status": {"$in": ["pending", "started"]}
    }).to_list(100)
    
    print("Bulunan", len(assignments), "atama")
    
    driver_id = None
    paramedic_id = None
    att_id = None
    nurse_id = None
    
    for a in assignments:
        user_id = a.get("user_id")
        user = await db.users.find_one({"_id": user_id})
        if user:
            role = user.get("role")
            name = user.get("name")
            print("  User:", name, "- Role:", role)
            if role in ["sofor", "bas_sofor"]:
                driver_id = user_id
            elif role == "paramedik":
                paramedic_id = user_id
            elif role == "att":
                att_id = user_id
            elif role == "hemsire":
                nurse_id = user_id
    
    result = await db.cases.update_one(
        {"_id": case_id},
        {"$set": {
            "assigned_team.driver_id": driver_id,
            "assigned_team.paramedic_id": paramedic_id,
            "assigned_team.att_id": att_id,
            "assigned_team.nurse_id": nurse_id
        }}
    )
    
    print("Vaka guncellendi:", result.modified_count)
    
    updated_case = await db.cases.find_one({"_id": case_id})
    print("Guncel assigned_team:", updated_case.get("assigned_team"))
    
    client.close()

asyncio.run(fix_cases())

