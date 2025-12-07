# 🚀 HealMedy HBYS - Railway Deploy Kılavuzu

## Hızlı Başlangıç

### 1. GitHub'a Push

```bash
git init
git add .
git commit -m "Initial commit - HealMedy HBYS"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADI/healmedy-hbys.git
git push -u origin main
```

### 2. Railway'de Deploy

1. [Railway.app](https://railway.app) adresine git
2. GitHub ile giriş yap
3. "New Project" → "Deploy from GitHub repo" seç
4. Repository'yi seç

---

## 🔧 Servis Yapılandırması

Railway'de **2 ayrı servis** oluşturman gerekiyor:

### Backend Servisi

1. "New Service" → "GitHub Repo" → `backend` klasörünü seç
2. Root Directory: `backend`
3. Environment Variables ekle (aşağıda)

### Frontend Servisi

1. "New Service" → "GitHub Repo" → `frontend` klasörünü seç
2. Root Directory: `frontend`
3. Environment Variables ekle (aşağıda)

---

## 🔐 Environment Variables

### Backend (.env)

```env
# MongoDB - Mevcut Atlas bağlantını kullan
MONGO_URL=mongodb+srv://healmedy_user:H3alm3dy2024!@abro.lwzasyg.mongodb.net/
DB_NAME=healmedy_hbys

# JWT Secret - Güvenli bir değer oluştur
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Firebase - Firebase Console'dan al
FIREBASE_CREDENTIALS={"type":"service_account","project_id":"..."}

# Infobip SMS/WhatsApp
INFOBIP_API_KEY=your-infobip-api-key
INFOBIP_BASE_URL=https://api.infobip.com
INFOBIP_SENDER=HealMedy

# Web Push VAPID Keys
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@healmedy.com

# CORS - Frontend URL'ini ekle
ALLOWED_ORIGINS=https://your-frontend.railway.app,http://localhost:3001

# Port - Railway otomatik ayarlar
PORT=8001
```

### Frontend (.env)

```env
# Backend API URL - Railway'den aldığın backend URL
REACT_APP_BACKEND_URL=https://your-backend.railway.app

# Firebase Config - Firebase Console'dan al
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc123

# VAPID Key - Web Push için
REACT_APP_VAPID_PUBLIC_KEY=your-vapid-public-key
```

---

## 📋 Deploy Adımları (Detaylı)

### Adım 1: Railway Hesabı
- https://railway.app adresine git
- GitHub hesabınla giriş yap

### Adım 2: Yeni Proje Oluştur
- Dashboard'da "New Project" butonuna tıkla
- "Deploy from GitHub repo" seç
- Projeyi seç (healmedy-hbys)

### Adım 3: Backend Servisi
1. "Add Service" → "GitHub Repo"
2. Aynı repo'yu seç
3. Settings → Root Directory: `backend` yaz
4. Variables sekmesine git
5. Yukarıdaki Backend env değişkenlerini ekle
6. Deploy otomatik başlayacak

### Adım 4: Frontend Servisi
1. "Add Service" → "GitHub Repo"
2. Aynı repo'yu seç
3. Settings → Root Directory: `frontend` yaz
4. Variables sekmesine git
5. `REACT_APP_BACKEND_URL` için backend URL'ini kullan
6. Deploy otomatik başlayacak

### Adım 5: Domain Ayarları
- Her servis için "Settings" → "Domains"
- "Generate Domain" ile otomatik domain al
- Veya kendi domain'ini bağla

---

## 🔗 Servis Bağlantıları

Deploy sonrası backend URL'ini frontend'e eklemen gerekiyor:

1. Backend servisinin URL'ini kopyala (örn: `https://healmedy-backend.railway.app`)
2. Frontend servisinin Variables'ına git
3. `REACT_APP_BACKEND_URL` değerini güncelle
4. Frontend yeniden deploy edilecek

---

## ✅ Kontrol Listesi

- [ ] GitHub'a push edildi
- [ ] Railway hesabı açıldı
- [ ] Backend servisi oluşturuldu
- [ ] Backend env değişkenleri eklendi
- [ ] Frontend servisi oluşturuldu
- [ ] Frontend env değişkenleri eklendi
- [ ] Backend URL frontend'e eklendi
- [ ] Her iki servis de "Active" durumunda
- [ ] Siteye erişim test edildi

---

## 🆘 Sorun Giderme

### Build Hatası
- Logs sekmesinden hata mesajını kontrol et
- `requirements.txt` veya `package.json` eksik olabilir

### CORS Hatası
- Backend'de `ALLOWED_ORIGINS` env değişkenini kontrol et
- Frontend URL'ini eklediğinden emin ol

### Database Bağlantı Hatası
- `MONGO_URL` doğru mu kontrol et
- MongoDB Atlas'ta IP whitelist'e `0.0.0.0/0` ekle

### 502 Bad Gateway
- Backend loglarını kontrol et
- Port ayarını kontrol et (Railway `PORT` env var kullanır)

---

## 💰 Maliyet

Railway ücretsiz plan:
- Aylık $5 kredi (yeterli!)
- 512 MB RAM
- Paylaşımlı CPU

Ücretli plan ($20/ay):
- 8 GB RAM
- Dedicated CPU
- Daha fazla kaynak

---

## 📞 Destek

Sorun yaşarsan:
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

İyi deploy'lar! 🎉

