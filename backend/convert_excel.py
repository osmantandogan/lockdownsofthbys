import pandas as pd
import json
import os

# ICD Kodları
print("ICD kodlarını okuyorum...")
icd_codes = []
try:
    icd_df = pd.read_excel('../icd kodları.xls', header=None)
    
    # Satır 2'den itibaren (0-indexed satır 2 = Excel satır 3)
    for idx, row in icd_df.iterrows():
        if idx < 2:  # İlk 2 satırı atla (header)
            continue
        code = str(row[0]).strip() if pd.notna(row[0]) else ""
        name = str(row[1]).strip() if pd.notna(row[1]) else ""
        
        if code and code != "nan" and name and name != "nan":
            icd_codes.append({
                "code": code,
                "name": name
            })
    
    print(f"Toplam ICD kodu: {len(icd_codes)}")
    print(f"Örnek: {icd_codes[:5]}")
    
    # JSON olarak kaydet
    with open('data/icd_codes.json', 'w', encoding='utf-8') as f:
        json.dump(icd_codes, f, ensure_ascii=False, indent=2)
    print("ICD kodları kaydedildi: data/icd_codes.json")
    
except Exception as e:
    print(f"ICD hatası: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*50 + "\n")

# Sağlık Tesisleri
print("Sağlık tesislerini okuyorum...")
hospitals = []
try:
    hospital_df = pd.read_excel('../saglik-tesisleri-listesi-02022023xls.xls')
    
    # Kolon isimlerini düzelt (encoding sorunu)
    cols = hospital_df.columns.tolist()
    print(f"Kolonlar: {cols}")
    
    # Zonguldak hastanelerini bul
    il_col = None
    for col in cols:
        if 'L' in col.upper() and len(col) < 5:
            il_col = col
            break
    
    if il_col is None:
        il_col = cols[2]  # 3. kolon genelde İL
    
    kurum_adi_col = None
    for col in cols:
        if 'KURUM' in col.upper() and 'ADI' in col.upper():
            kurum_adi_col = col
            break
    if kurum_adi_col is None:
        kurum_adi_col = cols[4]  # 5. kolon genelde KURUM ADI
    
    kurum_turu_col = None
    for col in cols:
        if 'T' in col.upper() and 'R' in col.upper():
            kurum_turu_col = col
            break
    if kurum_turu_col is None:
        kurum_turu_col = cols[6]  # 7. kolon
    
    ilce_col = cols[3]  # İLÇE
    
    print(f"İL kolonu: {il_col}")
    print(f"Kurum Adı kolonu: {kurum_adi_col}")
    print(f"Kurum Türü kolonu: {kurum_turu_col}")
    
    for idx, row in hospital_df.iterrows():
        il = str(row[il_col]).strip() if pd.notna(row[il_col]) else ""
        ilce = str(row[ilce_col]).strip() if pd.notna(row[ilce_col]) else ""
        kurum_adi = str(row[kurum_adi_col]).strip() if pd.notna(row[kurum_adi_col]) else ""
        kurum_turu = str(row[kurum_turu_col]).strip() if pd.notna(row[kurum_turu_col]) else ""
        
        if kurum_adi and kurum_adi != "nan":
            hospitals.append({
                "il": il,
                "ilce": ilce,
                "name": kurum_adi,
                "type": kurum_turu
            })
    
    print(f"Toplam hastane: {len(hospitals)}")
    
    # Zonguldak hastanelerini filtrele
    zonguldak_hospitals = [h for h in hospitals if 'ZONGULDAK' in h['il'].upper()]
    print(f"Zonguldak hastane sayısı: {len(zonguldak_hospitals)}")
    for h in zonguldak_hospitals:
        print(f"  - {h['name']} ({h['type']})")
    
    # Özel hastaneler ekle (kullanıcının istediği)
    custom_hospitals = [
        {"il": "ZONGULDAK", "ilce": "MERKEZ", "name": "HEALMEDY Filyos Sağlık Merkezi", "type": "ÖZEL SAĞLIK MERKEZİ", "priority": 1},
        {"il": "ZONGULDAK", "ilce": "ÇAYCUMA", "name": "Filyos Sağlık Merkezi Saha Ambulans Bekleme Noktaları", "type": "AMBULANS NOKTASI", "priority": 2},
        {"il": "ZONGULDAK", "ilce": "MERKEZ", "name": "Özel Level Hospital", "type": "ÖZEL HASTANE", "priority": 3},
        {"il": "ZONGULDAK", "ilce": "EREĞLİ", "name": "Özel Ereğli Echomar Hastanesi", "type": "ÖZEL HASTANE", "priority": 4},
        {"il": "ZONGULDAK", "ilce": "EREĞLİ", "name": "Özel Ereğli Anadolu Hastanesi", "type": "ÖZEL HASTANE", "priority": 5},
    ]
    
    # Zonguldak devlet hastanelerini ayır
    zonguldak_devlet = [h for h in zonguldak_hospitals if 'DEVLET' in h['type'].upper() or 'EĞİTİM' in h['type'].upper()]
    
    # Tüm hastaneleri birleştir
    all_hospitals = {
        "custom": custom_hospitals,
        "zonguldak_devlet": zonguldak_devlet,
        "zonguldak_all": zonguldak_hospitals,
        "all": hospitals
    }
    
    # JSON olarak kaydet
    with open('data/hospitals.json', 'w', encoding='utf-8') as f:
        json.dump(all_hospitals, f, ensure_ascii=False, indent=2)
    print("Hastaneler kaydedildi: data/hospitals.json")
    
except Exception as e:
    print(f"Hastane hatası: {e}")
    import traceback
    traceback.print_exc()

print("\nTamamlandı!")

