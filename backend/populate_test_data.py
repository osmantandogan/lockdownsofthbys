import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import random
import uuid

async def populate_test_data():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["healmedy_hbys"]
    
    print("🚀 Test verileri ekleniyor...")
    
    # 1. 10 ARAÇ
    vehicles = []
    for i in range(1, 11):
        vehicle = {
            "_id": f"vehicle-{i}",
            "plate": f"34 ABC {100 + i}",
            "type": "ambulans",
            "status": random.choice(["musait", "musait", "musait", "gorevde", "bakimda"]),
            "km": random.randint(20000, 90000),
            "fuel_level": random.randint(30, 100),
            "qr_code": f"QR-VEHICLE-{str(i).zfill(3)}",
            "last_inspection_date": datetime.utcnow() - timedelta(days=random.randint(30, 350)),
            "next_maintenance_km": (random.randint(20, 100) // 20) * 20000,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        vehicles.append(vehicle)
    
    await db.vehicles.delete_many({})
    await db.vehicles.insert_many(vehicles)
    print(f"✅ {len(vehicles)} araç eklendi")
    
    # 2. 10 STOK (İLAÇ) - Farklı durumlar
    stock_items = []
    medicine_names = [
        ("Parasetamol 500mg", "MED-001"),
        ("Aspirin 100mg", "MED-002"),
        ("İbuprofen 400mg", "MED-003"),
        ("Serum Fizyolojik 500ml", "MED-004"),
        ("Ringer Laktat 500ml", "MED-005"),
        ("Adrenalin 1mg", "MED-006"),
        ("Atropin 0.5mg", "MED-007"),
        ("Diazepam 10mg", "MED-008"),
        ("Lidokain 2%", "MED-009"),
        ("Kortikosteroid", "MED-010")
    ]
    
    for i, (name, code) in enumerate(medicine_names, 1):
        # Farklı durumlar oluştur
        if i <= 3:  # Kritik stok
            quantity = random.randint(5, 20)
            min_quantity = random.randint(50, 100)
        elif i <= 6:  # Normal stok
            quantity = random.randint(100, 200)
            min_quantity = 50
        else:  # Fazla stok
            quantity = random.randint(150, 300)
            min_quantity = 50
        
        # Son kullanma tarihleri
        if i <= 2:  # Süresi dolmuş
            expiry = datetime.utcnow() - timedelta(days=random.randint(10, 60))
        elif i <= 5:  # Dolmak üzere (30 gün içinde)
            expiry = datetime.utcnow() + timedelta(days=random.randint(5, 25))
        else:  # Normal
            expiry = datetime.utcnow() + timedelta(days=random.randint(100, 365))
        
        stock = {
            "_id": f"stock-{i}",
            "name": name,
            "code": code,
            "quantity": quantity,
            "min_quantity": min_quantity,
            "location": random.choice(["merkez_depo", "ambulans", "saha_ofis", "acil_canta"]),
            "location_detail": f"Raf {chr(65+i)}-{random.randint(1,5)}",
            "lot_number": f"LOT2024{str(i).zfill(3)}",
            "expiry_date": expiry,
            "qr_code": f"QR-STOCK-{str(i).zfill(3)}",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        stock_items.append(stock)
    
    await db.stock.delete_many({})
    await db.stock.insert_many(stock_items)
    print(f"✅ {len(stock_items)} stok ürünü eklendi (kritik, dolmuş, dolacak)")
    
    # 3. 10 VAKA
    cases = []
    for i in range(1, 11):
        case_date = datetime.utcnow() - timedelta(days=random.randint(0, 30))
        case = {
            "_id": f"case-{i}",
            "case_number": case_date.strftime("%Y%m%d") + f"-{str(i).zfill(4)}",
            "caller": {
                "name": f"Arayan {i}",
                "phone": f"0555 {random.randint(100,999)} {random.randint(1000,9999)}",
                "relationship": random.choice(["Eşi", "Çocuğu", "Komşusu", "Arkadaşı"])
            },
            "patient": {
                "name": f"Hasta{i}",
                "surname": f"Soyad{i}",
                "age": random.randint(20, 80),
                "gender": random.choice(["erkek", "kadin"]),
                "complaint": random.choice(["Göğüs ağrısı", "Nefes darlığı", "Baş ağrısı", "Karın ağrısı", "Düşme/Kaza"])
            },
            "location": {
                "address": f"Test Mahallesi {i}. Sokak No:{random.randint(1,50)}"
            },
            "priority": random.choice(["yuksek", "yuksek", "orta", "orta", "orta", "dusuk"]),
            "status": random.choice(["acildi", "ekip_bilgilendirildi", "ekip_yola_cikti", "sahada", "hasta_alindi", "tamamlandi"]),
            "status_history": [
                {
                    "status": "acildi",
                    "note": "Vaka oluşturuldu",
                    "updated_by": "test-cagri-merkezi",
                    "updated_at": case_date
                }
            ],
            "created_by": "test-cagri-merkezi",
            "created_at": case_date,
            "updated_at": case_date
        }
        cases.append(case)
    
    await db.cases.delete_many({})
    await db.cases.insert_many(cases)
    print(f"✅ {len(cases)} vaka eklendi")
    
    # 4. 10 VARIDI ATAMASI (farklı kullanıcılar)
    shift_users = [
        "ozcan.tolubas", "alican.tolubas", "mehmetcan.savli", "talha.akgul",
        "test-sofor", "murat.keser", "busra.bahtiyar", "nesrin.tuysozyurt",
        "test-paramedik", "test-att"
    ]
    
    shift_assignments = []
    for i in range(10):
        assignment = {
            "_id": f"assignment-{i+1}",
            "user_id": shift_users[i],
            "vehicle_id": f"vehicle-{(i % 10) + 1}",
            "assigned_by": "test-operasyon-muduru",
            "shift_date": datetime.utcnow() + timedelta(days=i),
            "status": "pending" if i < 5 else random.choice(["started", "completed"]),
            "created_at": datetime.utcnow()
        }
        shift_assignments.append(assignment)
    
    await db.shift_assignments.delete_many({})
    await db.shift_assignments.insert_many(shift_assignments)
    print(f"✅ {len(shift_assignments)} vardiya ataması eklendi")
    
    # 5. 10'AR FORM (Her tipten)
    forms = []
    form_types = [
        "kvkk", "injection", "puncture", "minor_surgery", "general_consent",
        "medicine_request", "material_request", "medical_gas_request",
        "ambulance_equipment", "pre_case_check", "ambulance_case",
        "daily_control", "handover", "order_form", "asset_form", "leave_form"
    ]
    
    for form_type in form_types[:10]:  # 10 farklı form tipi
        for j in range(1, 11):  # Her tipten 10'ar
            form = {
                "_id": f"form-{form_type}-{j}",
                "form_type": form_type,
                "form_data": {
                    "sample_field": f"Test data {j}",
                    "date": (datetime.utcnow() - timedelta(days=random.randint(0, 30))).isoformat()
                },
                "patient_name": f"Test Hasta {j}" if "consent" in form_type or "case" in form_type else None,
                "vehicle_plate": f"34 ABC {100+j}" if "ambulance" in form_type or "daily" in form_type else None,
                "submitted_by": random.choice(["test-doktor", "test-hemsire", "test-paramedik", "test-att"]),
                "status": random.choice(["submitted", "submitted", "submitted", "approved", "rejected"]),
                "created_at": datetime.utcnow() - timedelta(days=random.randint(0, 30)),
                "updated_at": datetime.utcnow()
            }
            forms.append(form)
    
    await db.forms.delete_many({})
    await db.forms.insert_many(forms)
    print(f"✅ {len(forms)} form kaydı eklendi (10 tip x 10 = 100 form)")
    
    # 6. Stok Hareketleri
    stock_movements = []
    for i in range(30):
        movement = {
            "_id": str(uuid.uuid4()),
            "stock_item_id": f"stock-{random.randint(1,10)}",
            "movement_type": random.choice(["in", "in", "out", "out", "out", "transfer"]),
            "quantity": random.randint(5, 50),
            "reason": random.choice(["Yeni alım", "Kullanım", "Transfer", "İade", "Sayım düzeltme"]),
            "performed_by": random.choice(["test-hemsire", "test-doktor", "test-paramedik"]),
            "created_at": datetime.utcnow() - timedelta(days=random.randint(0, 30))
        }
        stock_movements.append(movement)
    
    await db.stock_movements.delete_many({})
    await db.stock_movements.insert_many(stock_movements)
    print(f"✅ {len(stock_movements)} stok hareketi eklendi")
    
    # 7. Vardiyalar (Tamamlanmış)
    shifts = []
    for i in range(20):
        shift = {
            "_id": str(uuid.uuid4()),
            "user_id": random.choice(shift_users),
            "vehicle_id": f"vehicle-{random.randint(1,10)}",
            "start_time": datetime.utcnow() - timedelta(days=random.randint(1, 30), hours=8),
            "end_time": datetime.utcnow() - timedelta(days=random.randint(1, 30)),
            "duration_minutes": random.randint(360, 600),
            "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 30))
        }
        shifts.append(shift)
    
    await db.shifts.delete_many({})
    await db.shifts.insert_many(shifts)
    print(f"✅ {len(shifts)} vardiya eklendi")
    
    print("\n🎊 TÜM TEST VERİLERİ EKLENDİ!")
    print("\n📊 ÖZET:")
    print(f"   - Araçlar: {len(vehicles)}")
    print(f"   - Stok Ürünleri: {len(stock_items)}")
    print(f"   - Vakalar: {len(cases)}")
    print(f"   - Vardiya Atamaları: {len(shift_assignments)}")
    print(f"   - Formlar: {len(forms)}")
    print(f"   - Stok Hareketleri: {len(stock_movements)}")
    print(f"   - Vardiyalar: {len(shifts)}")
    
    client.close()

asyncio.run(populate_test_data())
