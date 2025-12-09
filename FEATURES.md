# 📋 HealMedy HBYS - Detaylı Özellik Listesi

## ✅ Tamamlanmış Özellikler (v1.0 - Faz 1)

### 1. 🔐 Authentication & User Management

#### Dual Authentication Sistemi
- **Emergent Google OAuth**
  - Tek tıkla Google ile giriş
  - Otomatik kullanıcı kaydı
  - Session token yönetimi (7 gün)
  - HTTPOnly cookie storage
  
- **JWT Email/Password Auth**
  - Email ve şifre ile kayıt
  - BCrypt password hashing
  - JWT token (7 gün geçerli)
  - Rol bazlı kayıt

#### Kullanıcı Yönetimi
- 9 kullanıcı rolü desteği
- Kullanıcı profil yönetimi
- Geçici rol atama (Operasyon Müdürü)
- TC kimlik no kayıt
- Telefon bilgisi
- Profil fotoğrafı (Google auth)

---

### 2. 📞 Çağrı Merkezi & Vaka Oluşturma

#### Kapsamlı Vaka Formu (45+ Alan)

**Çağrıyı Yapan (4 alan)**
- Kurum adı
- Ad soyad
- Yakınlık derecesi
- Telefon numarası (pattern validation)

**Hasta Bilgileri (6 alan)**
- Ad soyad
- Yaş (0-150 validasyonu)
- Cinsiyet* (Erkek/Kadın) - ZORUNLU
- Telefon numarası
- Adres (textarea)
- Adres tarifi (textarea)

**Vaka Bilgileri (8 alan)**
- Vaka no (otomatik: YYYYMMDD-HHMMSS)
- Tarih (otomatik)
- Taşıt bilgisi (müsait araçlar)
- Çağrı alış saati (otomatik)
- Alarm saati
- Randevu* (Evet/Hayır) - ZORUNLU
- Randevu saati (conditional)
- Randevu tarihi (conditional)

**Klinik Bilgiler (6 alan)**
- Hastanın şikayeti (textarea)
- Hastanın kliniği
- Ön tanı
- Onay alınan kişi
- Triaj kodu* (1/2/3) - ZORUNLU
  - 🔴 1 (Kırmızı - Acil)
  - 🟡 2 (Sarı - Öncelikli)
  - 🟢 3 (Yeşil - Acil Değil)
- Çıkış şekli* (Acil/Kontrollü/Randevulu) - ZORUNLU

**Zaman Bilgileri (6 alan)**
- Çıkış saati
- Ulaşım saati
- Vakadan çıkış saati
- Hastaneye varış saati
- Hastaneden çıkış saati
- Noktaya dönüş saati

**Lokasyon Bilgileri (4 alan)**
- Hastanın alındığı yer
- Hastanın ilk bırakıldığı yer
- Hastanın son bırakıldığı yer
- Ambulans tipi* (Kara/Hava) - ZORUNLU

**Hastanın Güvencesi (2 alan)**
- Anlaşmalı kurum (Evet/Hayır)
- K.K onay kodu (conditional)

**Çağrı Bilgileri (4 alan)**
- Çağrıyı alan ad soyad
- 112 protokol numarası
- Müdahale (textarea)
- Açıklama (textarea)

#### Özellikler
- ✅ Otomatik alan doldurma (vaka no, tarih, saat)
- ✅ Conditional fields (randevu, güvence)
- ✅ Form validasyonu (5 zorunlu alan)
- ✅ 2 aşamalı süreç (oluştur → bildir)
- ✅ Araç seçimi entegrasyonu

---

### 3. 📧 Email Bildirim Sistemi

#### SMTP Entegrasyonu
- **Provider:** Hostinger SMTP
- **Port:** 465 (SSL/TLS)
- **Format:** HTML email

#### Bildirim Hedefleri
**Her vaka için otomatik:**
- Merkez Ofis
- Operasyon Müdürü
- Doktor
- Hemşire

**Araç seçilmişse ek:**
- Seçilen araçtaki şoför
- Seçilen araçtaki paramedik
- Seçilen araçtaki ATT
- Seçilen araçtaki hemşire

#### Email İçeriği
- 🚑 Vaka numarası (konu satırında)
- Öncelik badge'i (renk kodlu)
- Hasta kartı (tüm bilgiler)
- Arayan kartı (tüm bilgiler)
- Konum kartı (adres detayları)
- Atanan araç (eğer varsa)
- Uyarı mesajı
- Professional footer

---

### 4. 📂 Vaka Yönetimi

#### Vaka Durumları (10 Aşama)
1. **Açıldı** - Yeni oluşturulmuş vaka
2. **Ekip Bilgilendirildi** - Ekip görevlendirildi
3. **Ekip Yola Çıktı** - Ambulans hareket etti
4. **Sahada** - Olay yerine ulaşıldı
5. **Hasta Alındı** - Hasta ambulansa alındı
6. **Doktor Konsültasyonu** - Teletıp desteği
7. **Merkeze Dönüş** - Müdahale tamamlandı
8. **Hastane Sevki** - Hastane transferi
9. **Tamamlandı** - Vaka kapatıldı
10. **İptal** - Vaka iptal edildi

#### Öncelik Seviyeleri
- 🔴 **Yüksek (Kırmızı)** - Acil müdahale
- 🟡 **Orta (Sarı)** - Öncelikli
- 🟢 **Düşük (Yeşil)** - Rutin

#### Filtreleme & Arama
- Durum bazlı filtreleme
- Öncelik bazlı filtreleme
- Kelime arama (vaka no, hasta adı)
- Tarih aralığı

#### Vaka Detay Sayfası
- Hasta kartı
- Arayan kartı
- Konum kartı
- Atanan ekip bilgisi
- Durum timeline (her değişiklik kaydedilir)
- Hızlı aksiyonlar

#### Rol Bazlı Erişim
- **Admin/Doktor:** Tüm vakalar
- **Saha Personeli:** Sadece atanan vakalar

---

### 5. 🚗 Araç Yönetimi

#### Araç Durumları
- **Müsait** - Görev bekliyor
- **Görevde** - Aktif vakada
- **Bakımda** - Servis/bakım
- **Arızalı** - Kullanılamaz
- **Kullanım Dışı** - Devre dışı

#### Araç Bilgileri
- Plaka numarası
- Araç tipi (Ambulans/Araç)
- Kilometre
- Yakıt seviyesi (0-100%)
- QR kod (unique UUID)
- Mevcut vaka (eğer görevdeyse)

#### QR Kod Sistemi
- Her araçta unique QR kod
- Vardiya başlatma için kullanılır
- QR ile araç sorgulama

#### İstatistikler
- Toplam araç
- Müsait araçlar
- Görevdeki araçlar
- Bakımdaki araçlar
- Arızalı araçlar

---

### 6. 📦 Stok Yönetimi

#### Lokasyonlar
1. **Ambulans** - Araç içi ilaç dolabı
2. **Saha Ofis** - Saha sağlık merkezi
3. **Acil Çanta** - Portatif çantalar
4. **Merkez Depo** - Ana depo

#### Stok Bilgileri
- Ürün adı
- Ürün kodu
- Mevcut miktar
- Minimum stok seviyesi
- Lokasyon + detay (araç plakası, raf no vb.)
- Lot/parti numarası
- Son kullanma tarihi
- QR kod

#### Uyarı Sistemi
**Kritik Stok (Kırmızı)**
- Miktar < Minimum seviye
- Dashboard'da öne çıkarılır

**Süresi Dolmuş (Turuncu)**
- SKT < Bugün
- Kritik uyarı

**Süresi Dolacak (Sarı)**
- SKT < 30 gün
- Erken uyarı

#### Dashboard Entegrasyonu
- Kritik stok sayısı
- Dolmuş ürün sayısı
- Dolacak ürün sayısı
- Detaylı uyarı kartları

---

### 7. ⏰ Vardiya Yönetimi

#### A) Vardiya Atama Sistemi

**Yetkili Roller:**
- Merkez Ofis
- Operasyon Müdürü
- Baş Şoför

**Özellikler:**
- Kullanıcı seçimi (Şoför/Paramedik/ATT/Baş Şoför)
- Araç seçimi
- Tarih bazlı atama
- Atama listesi görüntüleme
- Durum takibi:
  - **Pending** - Bekliyor
  - **Started** - Başladı
  - **Completed** - Tamamlandı
  - **Cancelled** - İptal
- Pending atamaları silme

**İş Akışı:**
```
Admin → Kullanıcı Seç → Araç Seç → Tarih Seç → Ata
    ↓
ShiftAssignment (status: pending)
    ↓
Şoför "Bekleyen Vardiyalarınız" görür
```

#### B) Vardiya Başlatma (4 Adımlı Süreç)

**Adım 1: QR Kod Okutma**
- html5-qrcode entegrasyonu
- Kamera ile QR tarama
- Otomatik araç tanıma
- Atama doğrulama:
  - ✅ QR geçerli mi?
  - ✅ Kullanıcının ataması var mı?
  - ✅ Atama pending durumunda mı?
  - ❌ Yoksa hata: "Bu araç için vardiya atamanız yok"

**Adım 2: Araç Fotoğrafları**

*6 Zorunlu Fotoğraf:*
1. **Ön Taraf** - Araç önü
2. **Arka Taraf** - Araç arkası
3. **Sol Taraf** - Sol görünüm
4. **Sağ Taraf** - Sağ görünüm
5. **Arka Bagaj** - Bagaj içi
6. **İç Kabin** - Hasta kabini

*Opsiyonel:*
- **Hasar Fotoğrafları** - Sınırsız
- Vuruk, kırık, hasar detayları

*Teknik:*
- Live kamera preview
- MediaDevices API
- Canvas capture
- Base64 encoding
- JPEG format (70% kalite)
- MongoDB storage

**Adım 3: Günlük Kontrol Formu**

*Kategoriler:*
1. **Genel Durum** (4 kontrol)
   - Ruhsat (Var/Yok)
   - Dış görünüş (Temiz/Kirli)
   - Kaporta (Sağlam/Hasarlı)
   - Lastikler (Sağlam/Sorunlu)

2. **Yakıt Durumu**
   - Yakıt seviyesi (%0, %25, %50, %75, %100)

3. **Sistem Kontrolleri** (8 kontrol)
   - Motor (Sağlam/Arızalı)
   - Fren (Sağlam/Arızalı)
   - GPS (Sağlam/Arızalı)
   - Siren (Sağlam/Arızalı)
   - Farlar (Sağlam/Arızalı)
   - Stepne (Var/Yok)
   - Yangın Tüpü (Var/Yok)
   - Kriko (Var/Yok)

4. **Kabin Kontrolü** (2 kontrol)
   - Temizlik (Temiz/Kirli)
   - Aydınlatma (Sağlam/Arızalı)

5. **Notlar**
   - Serbest metin alanı
   - Ekstra açıklamalar

**Adım 4: Onay ve Başlatma**
- Tüm kontrollerin özeti
- ✓ QR kod okundu
- ✓ 6 fotoğraf çekildi + X hasar fotoğrafı
- ✓ Günlük kontrol tamamlandı
- "Vardiyayı Başlat" butonu
- Assignment status: pending → started
- Shift created (with photos + form)

#### C) Aktif Vardiya Takibi
- Başlangıç zamanı
- Geçen süre (real-time)
- Araç bilgisi
- Çekilen fotoğraflar (3x2 grid preview)
- "Vardiyayı Bitir" butonu

#### D) Vardiya Geçmişi
- Son 10 vardiya
- Başlangıç/bitiş zamanları
- Toplam süre
- Araç bilgisi

---

### 8. 📊 Dashboard & İstatistikler

#### Ana Dashboard
**İstatistik Kartları:**
- Aktif Vakalar (mavi)
- Müsait Araçlar (yeşil)
- Yüksek Öncelikli (kırmızı)
- Kritik Stok (turuncu)

**Stok Uyarıları:**
- Kritik seviyede stok (kırmızı kart)
- Süresi dolmuş ürünler (turuncu kart)
- Süresi dolacak ürünler (sarı kart)

**Hızlı Aksiyonlar:**
- Yeni Vaka
- Vakalar
- Stok
- Vardiya

#### Real-time Updates
- Dashboard istatistikleri canlı
- API polling (her sayfa yüklendiğinde)

---

### 9. 🎨 UI/UX Özellikleri

#### Design System
- **Shadcn/UI** - Modern component library
- **Radix UI** - Accessible primitives
- **Tailwind CSS** - Utility-first styling
- **Lucide Icons** - Consistent iconography

#### Responsive Design
- **Mobile:** Drawer sidebar
- **Tablet:** Optimized grid
- **Desktop:** Full sidebar
- Breakpoints: sm(640), md(768), lg(1024), xl(1280)

#### Component Library
- Button (6 variants)
- Input & Textarea
- Select (dropdown)
- Radio Group
- Checkbox
- Dialog (modal)
- Card
- Badge
- Progress Bar
- Toast (Sonner)
- Separator
- Label

#### Color System
- **Primary:** Blue (#2563eb)
- **Success:** Green (#16a34a)
- **Warning:** Yellow (#f59e0b)
- **Error:** Red (#dc2626)
- **Priority:**
  - Yüksek: Red (#dc2626)
  - Orta: Yellow (#f59e0b)
  - Düşük: Green (#16a34a)

#### Navigation
- Sidebar navigation
- Breadcrumbs
- Protected routes
- Auto redirect (authenticated/unauthenticated)
- Rol bazlı menü filtreleme

---

### 10. 🔒 Güvenlik & Uyumluluk

#### Authentication Security
- BCrypt password hashing (12 rounds)
- JWT secret key
- HTTPOnly cookies
- Secure & SameSite=None
- Token expiration (7 gün)

#### Authorization
- Rol bazlı endpoint guards
- Middleware validation
- Request-level user verification
- Cookie + Authorization header support

#### Data Security
- CORS yapılandırması
- Environment variables
- Sensitive data encryption
- KVKK uyumlu storage

#### Audit Logging
- Tüm CRUD işlemleri loglanır
- Kullanıcı aktiviteleri
- IP adresi kayıt
- Timestamp tracking
- Veri değişiklikleri

---

## 🔄 Planlanan Özellikler (Gelecek Fazlar)

### Faz 2: Form & Raporlama

#### 📝 Form Yönetimi (15 Form)
1. Ambulans Vaka Formu (detaylı)
2. İlk Yardım Formu
3. Trafik Kazası Tutanak Formu
4. İş Kazası Bildirimi
5. Hasta Rıza Formu
6. Araç Devir Teslim Formu (imza canvasları)
7. Vardiya Devir Formu
8. Stok Sayım Formu
9. Hasta Sevk Formu
10. Araç Bakım Formu
11. Ekipman Kontrol Formu
12. Tıbbi Atık Formu
13. İlaç İmha Formu
14. Hasta Nakil Formu
15. Olay Tutanak Formu

**Form Özellikleri:**
- PDF export
- Offline doldurma
- Dijital imza (canvas)
- Fotoğraf/dosya ekleme
- Otomatik veri doldurma
- Dinamik form editörü
- Template sistemi

#### 📈 Raporlama Sistemi (6 Rapor)
1. **Vaka İstatistikleri**
   - Toplam vaka sayısı
   - Öncelik dağılımı
   - Durum dağılımı
   - Günlük/haftalık/aylık grafikler

2. **Personel Performans**
   - Tamamlanan vakalar
   - Ortalama müdahale süresi
   - Vardiya istatistikleri
   - Performans skoru

3. **Araç Kullanım**
   - Araç bazlı vaka sayısı
   - Kilometre analizi
   - Yakıt tüketimi
   - Bakım geçmişi

4. **Stok Hareket**
   - Giriş/çıkış raporu
   - Tüketim analizi
   - Kritik stok trendleri
   - Envanter raporu

5. **Müdahale Süre Analizi**
   - Ortalama müdahale süresi
   - Çağrı-ulaşım süresi
   - Sahada geçen süre
   - Toplam vaka süresi

6. **Kritik Stok Uyarı Raporu**
   - Kritik seviye altı ürünler
   - Dolmuş ürünler
   - Dolacak ürünler
   - Önerilen sipariş listesi

**Rapor Özellikleri:**
- Recharts grafikler
- Excel export
- PDF export
- Tarih aralığı filtreleme
- Otomatik periyodik raporlar
- Email ile gönderim

---

### Faz 3: GPS & Offline

#### 📍 GPS Entegrasyonu
- Gerçek zamanlı ambulans takibi
- Harita görünümü (Google Maps / Mapbox)
- En yakın müsait ambulans
- Rota optimizasyonu
- ETA hesaplama
- Geo-fencing (bölge uyarıları)
- GPS log kayıtları

#### 📴 Offline Mod
- PWA (Progressive Web App)
- Service Workers
- Local storage
- IndexedDB
- Offline form doldurma
- Senkronizasyon kuyruğu
- Conflict resolution

---

### Faz 4: Mobil & İleri Özellikler

#### 📱 Native Mobil App
**iOS & Android:**
- React Native / Flutter
- QR scanner entegrasyonu
- GPS konum paylaşımı
- Push notifications
- Kamera entegrasyonu
- Biyometrik giriş (Face ID, Touch ID)
- Offline-first yaklaşım

#### 🎥 Video Konsültasyon
- WebRTC entegrasyonu
- Doktor ile canlı görüşme
- Ekran paylaşımı
- Kayıt özelliği

#### 🏥 Hastane HBYS Entegrasyonu
- HL7 protokolü
- Hasta transfer
- Tıbbi kayıt senkronizasyonu
- Laboratuvar sonuçları

#### 🤖 Yapay Zeka
- Vaka önceliklendirme
- Akıllı ekip önerisi
- Tahminsel bakım
- Anomali tespiti

---

## 🎯 Kullanım Senaryoları

### Senaryo 1: Acil Vaka Müdahalesi

```
1. Çağrı Merkezi: cagri@healmedy.com ile giriş
2. "Çağrı Merkezi" sayfasına git
3. Form doldur:
   - Arayan: Ali Veli, 0555 123 4567, Arkadaş
   - Hasta: Mehmet Yılmaz, 65, Erkek
   - Şikayet: "Göğüs ağrısı, nefes darlığı"
   - Triaj: 1 (Kırmızı - Acil)
   - Çıkış: Acil
   - Ambulans: Kara
4. "Vaka Oluştur" → Başarı
5. "Bildirim Gönder" → 4 kişiye email gitti
6. Vaka detayına yönlendir

Operasyon Müdürü: operasyon@healmedy.com ile giriş
7. Vakalar → Yeni vaka görünür (kırmızı)
8. Vaka detay → "Ekip Ata"
9. Araç: 34 ABC 123 seç
10. Ata → Durum: "Ekip Bilgilendirildi"
11. Araç durumu: "Görevde"

Paramedik: paramedik@healmedy.com ile giriş
12. "Atanan Vakalar" görünür
13. Durum güncelle: "Ekip Yola Çıktı"
14. Durum güncelle: "Sahada"
15. Durum güncelle: "Hasta Alındı"
16. Durum güncelle: "Hastane Sevki"
17. Durum güncelle: "Tamamlandı"
18. Araç otomatik "Müsait" olur
```

### Senaryo 2: Vardiya Başlatma

```
Admin: operasyon@healmedy.com ile giriş
1. Vardiya → "Atama Yönetimi"
2. "Yeni Atama" butonu
3. Kullanıcı: Hasan Aydın (şoför)
4. Araç: 34 ABC 123
5. Tarih: Bugün
6. "Ata" → Başarı

Şoför: sofor@healmedy.com ile giriş
7. Vardiya sayfası
8. "Bekleyen Vardiyalarınız" kartı görünür (yeşil)
9. "Vardiya Başlat (QR)" butonu

Adım 1: QR Okut
10. "QR Okuyucuyu Başlat"
11. Kamera açılır
12. QR-VEHICLE-001 okut
13. Atama doğrulandı ✓
14. Adım 2'ye geç

Adım 2: Fotoğraflar
15. Ön taraf → Kamera → Çek → ✓
16. Arka taraf → Kamera → Çek → ✓
17. Sol taraf → Kamera → Çek → ✓
18. Sağ taraf → Kamera → Çek → ✓
19. Bagaj → Kamera → Çek → ✓
20. İç kabin → Kamera → Çek → ✓
21. (Opsiyonel) Sol arka çamurluk hasarı → Çek
22. "Devam" butonu aktif

Adım 3: Günlük Kontrol
23. Ruhsat: Var
24. Dış Görünüş: Temiz
25. Yakıt: %75
26. Motor: Sağlam
27. GPS: Sağlam
28. Siren: Sağlam
29. Temizlik: Temiz
30. "Devam"

Adım 4: Onay
31. Özet görünür:
    - QR: QR-VEHICLE-001 ✓
    - Fotoğraflar: 6 zorunlu + 1 hasar ✓
    - Form: Dolduruldu ✓
32. "Vardiyayı Başlat" → Başarı!
33. Shifts sayfasına dön
34. Aktif vardiya görünür
35. Fotoğraflar grid'de görünür
```

### Senaryo 3: Kritik Stok Uyarısı

```
Sistem: Stok kontrolü (otomatik)
1. Serum Fizyolojik: Miktar 5, Minimum 50
2. Kritik stok uyarısı oluştur
3. Dashboard'da göster

Hemşire: hemsire@healmedy.com ile giriş
4. Dashboard → "Kritik Stok: 2" görünür
5. Stok sayfasına git
6. Kritik uyarılar:
   - Serum Fizyolojik (5/50) - Kırmızı
   - Parasetamol (50/100) - Kırmızı
7. Sipariş ver (manuel)
```

---

## 💾 Veri Saklama

### MongoDB Collections

**users** - Kullanıcı bilgileri
```javascript
{
  _id: string,
  email: string,
  name: string,
  role: string,
  password_hash: string,
  phone: string,
  tc_no: string,
  temp_roles: [string],
  is_active: boolean,
  created_at: datetime,
  updated_at: datetime
}
```

**cases** - Vaka kayıtları
```javascript
{
  _id: string,
  case_number: string,
  caller: object,
  patient: object,
  location: object,
  priority: string,
  status: string,
  assigned_team: object,
  status_history: [object],
  case_details: object, // Extra form fields
  created_by: string,
  created_at: datetime
}
```

**shifts** - Vardiya kayıtları
```javascript
{
  _id: string,
  assignment_id: string,
  user_id: string,
  vehicle_id: string,
  start_time: datetime,
  end_time: datetime,
  photos: {
    front: base64,
    back: base64,
    left: base64,
    right: base64,
    trunk: base64,
    interior: base64,
    damages: [base64]
  },
  daily_control: object,
  created_at: datetime
}
```

**shift_assignments** - Vardiya atamaları
```javascript
{
  _id: string,
  user_id: string,
  vehicle_id: string,
  assigned_by: string,
  shift_date: datetime,
  status: string,
  created_at: datetime
}
```

---

## 🚦 Durum Yönetimi

### Vaka Durumları
```
Açıldı → Ekip Bilgilendirildi → Ekip Yola Çıktı → Sahada
    ↓                    ↓                    ↓
Hasta Alındı → Doktor Konsültasyonu → Merkeze Dönüş
    ↓                                      ↓
Hastane Sevki ────────────────────→ Tamamlandı
    ↓
  İptal
```

### Araç Durumları
```
Müsait ←→ Görevde
  ↓          ↓
Bakımda    (Vaka atanınca)
  ↓
Arızalı
  ↓
Kullanım Dışı
```

### Vardiya Durumları
```
Assignment: Pending → Started → Completed
                         ↓
                    Cancelled
```

---

## 📱 Kamera & QR Özellikleri

### QR Code Scanner
- **Library:** html5-qrcode
- **Özellikler:**
  - Arka kamera (environment)
  - 10 FPS
  - 250x250 scan box
  - Otomatik algılama
  - Error handling

### Photo Capture
- **API:** MediaDevices.getUserMedia
- **Video:**
  - 1280x720 resolution
  - Environment facing mode
- **Capture:**
  - Canvas API
  - toDataURL (JPEG, 70%)
  - Base64 encoding
- **Preview:**
  - Thumbnail view
  - Full size
  - Grid layout

---

## 🌐 Deployment

### Production Checklist
- [ ] Environment variables set
- [ ] SMTP credentials configured
- [ ] MongoDB production URI
- [ ] JWT secret key (strong)
- [ ] CORS origins configured
- [ ] HTTPS enabled
- [ ] Backup strategy
- [ ] Monitoring setup

### Recommended Stack
- **Backend:** Docker container
- **Frontend:** Vercel / Netlify
- **Database:** MongoDB Atlas
- **Storage:** AWS S3 (future - photos)
- **CDN:** Cloudflare
- **Monitoring:** Sentry

---

## 📊 Performans

### Backend
- Async/await throughout
- MongoDB indexing
- Connection pooling
- Response caching (future)

### Frontend
- Code splitting
- Lazy loading (future)
- Image optimization
- Bundle size optimization

---

## 🧪 Test Stratejisi

### Manual Testing
- Test kullanıcıları (9 rol)
- Test araçları (3 adet)
- Test stok (4 ürün)
- Test vardiya ataması

### Automated Testing (Future)
- Unit tests (Jest)
- Integration tests
- E2E tests (Playwright)
- API tests (pytest)

---

## 📚 Dokümantasyon

### Mevcut
- ✅ README.md (bu dosya)
- ✅ FEATURES.md (detaylı özellikler)
- ✅ auth_testing.md (auth test playbook)
- ✅ API docs (/api/docs - FastAPI auto-generated)

### Gelecek
- ⏳ User manual
- ⏳ Admin guide
- ⏳ Developer guide
- ⏳ API reference
- ⏳ Deployment guide

---

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Lütfen:
1. Issue açın
2. Feature önerin
3. Bug bildirin
4. PR gönderin

---

## 📄 Lisans

MIT License

---

## 🆘 Sorun Giderme

### Frontend başlamıyor
```bash
cd frontend
rm -rf node_modules yarn.lock
yarn install
yarn start
```

### Backend hata veriyor
```bash
cd backend
pip install -r requirements.txt --force-reinstall
```

### MongoDB bağlantı hatası
- MongoDB servisinin çalıştığını kontrol edin
- MONGO_URL'i kontrol edin

---

<div align="center">

**HealMedy HBYS v1.0**

Made with ❤️ for Emergency Medical Services

[Live Demo](https://projem-sistemi.preview.emergentagent.com) • [Report Issue](#)

</div>
