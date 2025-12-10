import json
import os

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

med_file = 'data/medications_barcode.json'
with open(med_file, 'r', encoding='utf-8') as f:
    meds = json.load(f)

print(f'Veritabani: {len(meds)} ilac')

# Test GTIN'leri
test_gtins = [
    '08699788750027',  # QR kodlardan
    '8699788750027',   # 13 haneli
    '8699546010028',   # Aspirin Protect 
    '08699546010028',
    '8699956000404',   # Basit barkod
]

for gtin in test_gtins:
    name = meds.get(gtin, 'BULUNAMADI')
    if name != 'BULUNAMADI':
        print(f'  BULUNDU - {gtin}: {name[:70]}')
    else:
        # 13 hane olarak dene
        gtin13 = gtin[-13:] if len(gtin) > 13 else gtin
        name = meds.get(gtin13, 'BULUNAMADI')
        if name != 'BULUNAMADI':
            print(f'  BULUNDU (13h) - {gtin13}: {name[:70]}')
        else:
            print(f'  BULUNAMADI - {gtin}')

