import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def summary():
    client = AsyncIOMotorClient('mongodb+srv://healmedy_user:H3alm3dy2024!@abro.lwzasyg.mongodb.net/')
    db = client['healmedy_hbys']
    
    # Toplam karekod stok
    total = await db.barcode_stock.count_documents({'status': 'available', 'location': 'merkez_depo'})
    
    # Ilac bazinda ozet
    pipeline = [
        {'$match': {'status': 'available', 'location': 'merkez_depo'}},
        {'$group': {'_id': '$name', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}},
        {'$limit': 30}
    ]
    
    results = await db.barcode_stock.aggregate(pipeline).to_list(30)
    
    print('='*60)
    print('ANA DEPO STOK OZETI')
    print('='*60)
    print(f'Toplam karekod: {total} adet')
    print('='*60)
    print('Ilac Bazinda Dagilim (Ilk 30):')
    print('='*60)
    for r in results:
        name = r['_id'][:55] if r['_id'] else 'N/A'
        print(f"  {r['count']:4d}x {name}")
    
    # Toplam benzersiz ilac sayisi
    unique_count = await db.barcode_stock.distinct('name', {'status': 'available', 'location': 'merkez_depo'})
    print('='*60)
    print(f'Toplam benzersiz ilac: {len(unique_count)} cesit')
    print('='*60)
    
    client.close()

asyncio.run(summary())

