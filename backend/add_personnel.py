"""
Personel Ekleme Scripti
Kullanım: python add_personnel.py
"""
import asyncio
import bcrypt
import secrets
import string
from database import users_collection
from models import User

# Türkçe karakter dönüşümü
def turkce_to_ascii(text):
    import unicodedata
    # Önce normalize et
    text = unicodedata.normalize('NFC', text)
    
    # Türkçe karakter haritası
    tr_map = {
        'ş': 's', 'Ş': 's',
        'ğ': 'g', 'Ğ': 'g',
        'ü': 'u', 'Ü': 'u',
        'ö': 'o', 'Ö': 'o',
        'ç': 'c', 'Ç': 'c',
        'ı': 'i', 'İ': 'i',
        'ş': 's', 'Ş': 's',  # Alternatif unicode
        'I': 'i',  # Büyük I
        'i̇': 'i',  # Küçük dotted i
    }
    
    result = ""
    for char in text:
        if char in tr_map:
            result += tr_map[char]
        elif char.isascii():
            result += char
        else:
            # Bilinmeyen karakter, ASCII'ye çevir
            normalized = unicodedata.normalize('NFKD', char)
            ascii_char = normalized.encode('ascii', 'ignore').decode('ascii')
            result += ascii_char if ascii_char else ''
    
    return result

# Güvenli şifre oluşturma
def generate_password(length=12):
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

# Email oluşturma
def create_email(name):
    name = turkce_to_ascii(name.lower().strip())
    parts = name.split()
    if len(parts) >= 2:
        email = f"{parts[0]}.{parts[-1]}@healmedy.tech"
    else:
        email = f"{parts[0]}@healmedy.tech"
    return email

# Rol dönüşümü
def normalize_role(role):
    role = role.lower().strip()
    role_map = {
        'paramedik': 'paramedik',
        'att': 'att',
        'doktor': 'doktor',
        'şoför': 'sofor',
        'şöfor': 'sofor',
        'soför': 'sofor',
        'hemşire': 'hemsire',
        'operasyon müdürü': 'operasyon_muduru',
        'baş şöfor': 'bas_sofor',
        'baş şoför': 'bas_sofor',
        'çağrı merkezi': 'cagri_merkezi',
        'personel': 'att',  # Varsayılan olarak ATT
    }
    return role_map.get(role, 'att')

# Personel listesi
personnel = [
    ("ALEYNA ÖZDEMİR", "paramedik"),
    ("ALİCAN TÜLÜBAŞ", "paramedik"),
    ("ANIL BALCI", "att"),
    ("ASLI KOÇOĞLU", "att"),
    ("AYŞEGÜL BEYZA YILMAZ", "paramedik"),
    ("AYŞEGÜL ORAL", "att"),
    ("BARIŞ VATANSEVER", "doktor"),
    ("BERKECAN TURPÇU", "att"),
    ("BURAK İLİK", "paramedik"),
    ("BURAK TİRYAKİOĞLU", "şoför"),
    ("BURAKCAN ŞAHİNTÜRK", "paramedik"),
    ("BUSE TOPCU", "paramedik"),
    ("BÜŞRA AYDEMİR", "att"),
    ("BÜŞRA BAHTİYAR GÜZEL", "paramedik"),
    ("CAN ÇETİNKAYA", "hemşire"),
    ("CANSEL PETEK ŞAHİN", "doktor"),
    ("CEM BALAT", "att"),
    ("CEREN YİĞİT", "att"),
    ("DERYA GÖMLEKSİZOĞLU", "att"),
    ("EFE TALHA AKKAŞ", "att"),
    ("ELİF KURBAN", "paramedik"),
    ("ELİF YILDIRIM", "hemşire"),
    ("EMİNE KAÇAR", "hemşire"),
    ("EMİRHAN DOĞAN", "şoför"),
    ("FATİH MEKİKCİ", "att"),
    ("FEYZİ FİDAN", "şoför"),
    ("GAMZE HANDE BOZ", "paramedik"),
    ("GÖRKEM GÜRPÜZER", "şoför"),
    ("HACI MEHMET GÜLEÇ", "operasyon müdürü"),
    ("HAMZA TARIK ERMİŞ", "paramedik"),
    ("HASAN GÜNEY", "paramedik"),
    ("HATİCE ACAR CANBAZ", "paramedik"),
    ("HAYRULLAH İNCE", "baş şoför"),
    ("İREM HODULLAR", "doktor"),
    ("İREM ÖZDEDE", "hemşire"),
    ("KADİR ARTAR", "paramedik"),
    ("KADİRHAN ALKAN", "şoför"),
    ("KUBİLAY ELİÇORA", "şoför"),
    ("MEHMETCAN ŞAVLI", "şoför"),
    ("MELİH CAN DOĞAN", "att"),
    ("MELİKE KARATEPE", "paramedik"),
    ("MERT ÇINAR", "şoför"),
    ("MERVE GİRGİN", "çağrı merkezi"),
    ("MERVE NUR SAYGILI", "paramedik"),
    ("MESUT CİNKAVUK", "şoför"),
    ("MUHAMMET BİLİCİ", "att"),
    ("MURAT GÜLŞEN", "şoför"),
    ("MURAT KESER", "paramedik"),
    ("MUSTAFA KARAGÖL", "att"),
    ("MUZAFFER ÖZCAN", "att"),
    ("MÜGENUR SOYKAN", "att"),
    ("NESRİN TÜYSÜZ", "paramedik"),
    ("NEŞE VERİMCİK", "hemşire"),
    ("NURİ IŞIK", "personel"),
    ("OKTAY TÜTÜNCÜOĞLU", "şoför"),
    ("ONUR YALIN", "şoför"),
    ("RÜMEYSA UZUNAY", "att"),
    ("SAMET KOCAPINAR", "şoför"),
    ("SERKAN BİLAL BATTAL", "şoför"),
    ("SERKAN KAMİT", "att"),
    ("ŞENİZ KANDEMİR", "personel"),
    ("ŞULE KARAMAN", "att"),
    ("TALHA DOĞUKAN KARTAL", "şoför"),
    ("TAYFUN KOCAMAN", "att"),
    ("TURGAY KÖSE", "şoför"),
    ("UĞUR VAR", "paramedik"),
    ("UMUTCAN ÖZDAL", "hemşire"),
    ("YASEMİN BAŞTÜRK", "çağrı merkezi"),
]

async def cleanup_bad_emails():
    """Hatalı email adreslerini sil"""
    # healmedy.tech emaillerini bul ve sil (test amaçlı)
    deleted = await users_collection.delete_many({
        "email": {"$regex": "@healmedy\\.tech$"}
    })
    print(f"Temizlendi: {deleted.deleted_count} kullanici silindi")

async def add_personnel():
    # Önce hatalı kayıtları temizle
    await cleanup_bad_emails()
    
    results = []
    
    for name, role in personnel:
        email = create_email(name)
        password = generate_password()
        normalized_role = normalize_role(role)
        
        # Kullanıcı zaten var mı kontrol et
        existing = await users_collection.find_one({"email": email})
        if existing:
            results.append({
                "name": name,
                "email": email,
                "password": "ZATEN MEVCUT",
                "role": normalized_role,
                "status": "SKIP"
            })
            continue
        
        # Şifreyi hashle
        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
        
        # Kullanıcı oluştur
        new_user = User(
            email=email,
            name=name.title(),  # İlk harfler büyük
            role=normalized_role
        )
        user_dict = new_user.model_dump(by_alias=True)
        user_dict["password_hash"] = password_hash.decode()
        
        await users_collection.insert_one(user_dict)
        
        results.append({
            "name": name.title(),
            "email": email,
            "password": password,
            "role": normalized_role,
            "status": "OK"
        })
        
        # Sessiz çalış, sonuçlar dosyaya yazılacak
        pass
    
    return results

async def main():
    results = await add_personnel()
    
    # Sonuçları dosyaya yaz
    with open("personnel_results.txt", "w", encoding="utf-8") as f:
        f.write("=" * 100 + "\n")
        f.write("HEALMEDY PERSONEL LISTESI\n")
        f.write("=" * 100 + "\n\n")
        
        f.write(f"{'ISIM':<35} {'EMAIL':<45} {'SIFRE':<15} {'ROL':<20}\n")
        f.write("-" * 115 + "\n")
        
        for r in results:
            if r["status"] == "OK":
                f.write(f"{r['name']:<35} {r['email']:<45} {r['password']:<15} {r['role']:<20}\n")
        
        f.write("\n" + "=" * 100 + "\n")
        f.write(f"Toplam: {len([r for r in results if r['status'] == 'OK'])} personel eklendi\n")
        f.write(f"Atlanan: {len([r for r in results if r['status'] == 'SKIP'])} (zaten mevcut)\n")
        f.write("=" * 100 + "\n")
    
    print(f"Tamamlandi! Sonuclar personnel_results.txt dosyasina yazildi.")
    print(f"Eklenen: {len([r for r in results if r['status'] == 'OK'])}")
    print(f"Atlanan: {len([r for r in results if r['status'] == 'SKIP'])}")
    
    return results

if __name__ == "__main__":
    asyncio.run(main())

