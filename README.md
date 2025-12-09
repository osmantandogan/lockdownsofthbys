# 🏥 HealMedy HBYS - Saha Sağlık Yönetim Sistemi

<div align="center">
  
  **Kapsamlı Saha Sağlık Hizmetleri Yönetim Platformu**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://reactjs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688.svg)](https://fastapi.tiangolo.com/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Latest-47A248.svg)](https://www.mongodb.com/)
</div>

---

## 📋 İçindekiler

- [Genel Bakış](#-genel-bakış)
- [Özellikler](#-özellikler)
- [Teknoloji Stack](#-teknoloji-stack)
- [Kurulum](#-kurulum)
- [Kullanıcı Rolleri](#-kullanıcı-rolleri)
- [Modüller](#-modüller)
- [API Dokümantasyonu](#-api-dokümantasyonu)
- [Test Kullanıcıları](#-test-kullanıcıları)
- [Gelecek Özellikler](#-gelecek-özellikler)

---

## 🎯 Genel Bakış

HealMedy HBYS, saha sağlık hizmetlerini yöneten ekipler için tasarlanmış **kapsamlı bir dijital yönetim platformudur**. Sistem, acil sağlık müdahalelerinden stok takibine, vardiya yönetiminden raporlamaya kadar tüm operasyonel süreçleri tek bir platformda toplar.

### Temel Amaçlar:
- ✅ **Operasyonel Verimlilik** - Kağıt formların kalkması, anlık vaka takibi
- ✅ **Hasta Güvenliği** - Tüm müdahalelerin kayıt altında olması
- ✅ **Maliyet Tasarrufu** - Stok optimizasyonu, araç bakım planlaması
- ✅ **Uyumluluk** - KVKK uyumluluğu, Sağlık Bakanlığı standartları

---

## ✨ Özellikler

### ✅ Tamamlanmış Özellikler (v1.0)

#### 🔐 Authentication & Authorization
- Dual authentication (Emergent Google Auth + JWT)
- 9 farklı kullanıcı rolü
- Session yönetimi
- Rol bazlı erişim kontrolü

#### 📞 Çağrı Merkezi
- 45+ alan, 8 kategori form
- Triaj sistemi (1/2/3)
- Otomatik vaka numarası
- Araç seçimi
- Email bildirimleri

#### 📂 Vaka Yönetimi
- 10 vaka durumu takibi
- Timeline/geçmiş
- Ekip atama
- Durum güncelleme
- Rol bazlı filtreleme

#### 🚗 Araç Yönetimi
- Filo takibi
- 5 durum tipi
- QR kod sistemi
- İstatistikler

#### 📦 Stok Yönetimi
- 4 lokasyon takibi
- Kritik stok uyarıları
- SKT takibi
- QR kod sistemi

#### ⏰ Vardiya Yönetimi
- Vardiya atama (admin)
- QR tabanlı başlatma
- 6 fotoğraf çekimi
- Günlük kontrol formu
- Base64 storage

---

### 🔄 Planlanan Özellikler

**Faz 2:**
- 15 form şablonu
- 6 rapor tipi
- SMS entegrasyonu
- Push notifications

**Faz 3:**
- GPS entegrasyonu
- Offline mod
- PWA desteği

**Faz 4:**
- Native mobil app
- Video konsültasyon
- Hastane entegrasyonu

---

## 🛠 Teknoloji Stack

### Backend
- FastAPI 0.110.1
- MongoDB (Motor)
- Python 3.11+
- JWT + BCrypt
- SMTP (aiosmtplib)

### Frontend
- React 19
- React Router v7
- Shadcn/UI
- Tailwind CSS
- Axios
- html5-qrcode

---

## 🚀 Kurulum

### Backend

```bash
cd backend
pip install -r requirements.txt

# .env dosyasını yapılandır
cp .env.example .env

# Sunucuyu başlat
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

### Frontend

```bash
cd frontend
yarn install

# .env dosyasını yapılandır
cp .env.example .env

# Development başlat
yarn start
```

---

## 👥 Kullanıcı Rolleri

| Rol | Yetki |
|-----|-------|
| Merkez Ofis | Tam erişim |
| Operasyon Müdürü | Ekip/vardiya atama |
| Doktor | Konsültasyon |
| Hemşire | Stok yönetimi |
| Paramedik | Atanan vakalar |
| ATT | Atanan vakalar |
| Baş Şoför | Araç/vardiya yönetimi |
| Şoför | Vardiya |
| Çağrı Merkezi | Vaka oluşturma |

---

## 🧪 Test Kullanıcıları

**Şifre:** test123

| Email | İsim | Rol |
|-------|------|-----|
| merkez@healmedy.com | Ahmet Yılmaz | Merkez Ofis |
| operasyon@healmedy.com | Mehmet Demir | Operasyon Müdürü |
| doktor@healmedy.com | Dr. Ayşe Kaya | Doktor |
| hemsire@healmedy.com | Fatma Şahin | Hemşire |
| paramedik@healmedy.com | Can Öztürk | Paramedik |
| att@healmedy.com | Emre Yıldız | ATT |
| bassofor@healmedy.com | Ali Çelik | Baş Şoför |
| sofor@healmedy.com | Hasan Aydın | Şoför |
| cagri@healmedy.com | Zeynep Arslan | Çağrı Merkezi |

---

## 📡 API Endpoints

### Authentication
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/session
GET  /api/auth/me
POST /api/auth/logout
```

### Cases
```
POST   /api/cases
GET    /api/cases
GET    /api/cases/{id}
POST   /api/cases/{id}/assign-team
PATCH  /api/cases/{id}/status
POST   /api/cases/{id}/send-notification
```

### Vehicles
```
POST   /api/vehicles
GET    /api/vehicles
GET    /api/vehicles/qr/{code}
PATCH  /api/vehicles/{id}
```

### Shifts
```
POST /api/shifts/assignments
GET  /api/shifts/assignments/my
POST /api/shifts/start
POST /api/shifts/end
```

Detaylı API dokümantasyonu: `/api/docs`

---

## 🔐 Güvenlik

- BCrypt password hashing
- JWT tokens (7 gün)
- HTTPOnly cookies
- CORS yapılandırması
- Rol bazlı endpoint guards
- Audit logging

---

## 📊 Önemli İş Akışları

### Vaka Oluşturma
```
Çağrı Merkezi → Form → Vaka Oluştur → Bildirim Gönder → Email (4+ kişi)
```

### Vardiya Başlatma
```
Admin Ata → Şoför QR Okut → 6 Fotoğraf → Form → Başlat
```

---

## 🙏 Teşekkürler

- Emergent Platform
- Shadcn/UI
- FastAPI
- React

---

<div align="center">
  
**Made with ❤️ for Emergency Medical Services**

</div>
