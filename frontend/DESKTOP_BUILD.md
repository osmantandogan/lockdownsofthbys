# 🖥️ Healmedy Ambulans - Masaüstü Uygulama Kurulumu

Bu döküman, Healmedy Ambulans uygulamasını Windows, macOS ve Linux için masaüstü uygulaması olarak derlemeyi açıklar.

## 📋 Gereksinimler

- **Node.js** 18+ 
- **Yarn** veya npm
- **Windows**: Windows 10/11 (x64)
- **macOS**: macOS 10.15+ (isteğe bağlı)
- **Linux**: Ubuntu 20.04+ veya benzeri (isteğe bağlı)

## 🚀 Hızlı Başlangıç

### 1. Bağımlılıkları Yükle

```bash
cd frontend
yarn install
# veya
npm install
```

### 2. Geliştirme Modunda Çalıştır

```bash
yarn electron:dev
# veya
npm run electron:dev
```

Bu komut:
- React uygulamasını localhost:3000'de başlatır
- Electron penceresini açar
- Hot-reload ile değişiklikleri anında gösterir

### 3. Production Build (Windows .exe)

```bash
yarn electron:build
# veya
npm run electron:build
```

Bu komut:
- React uygulamasını optimize eder ve build alır
- Windows için `.exe` installer oluşturur
- Çıktı: `dist-electron/Healmedy-Ambulans-Setup-1.0.0.exe`

## 📦 Build Seçenekleri

### Windows Installer (.exe)
```bash
yarn electron:build
```

### Windows Portable (Kurulum gerektirmez)
```bash
yarn electron:build:portable
```

### Tüm Platformlar (Windows + Mac + Linux)
```bash
yarn electron:build:all
```

> ⚠️ macOS ve Linux build'leri için ilgili işletim sisteminde çalıştırmanız gerekir.

## 🎨 Uygulama İkonu

Özel ikon kullanmak için:

1. `public/favicon.ico` dosyasını güncelleyin
2. Veya `electron/resources/` klasörüne ekleyin:
   - `icon.ico` - Windows için (256x256)
   - `icon.icns` - macOS için
   - `icon.png` - Linux için (256x256+)

## ⚙️ Yapılandırma

### API URL Ayarı

Masaüstü uygulaması için API URL'sini ayarlamak:

```javascript
// src/config/api.js
const API_URL = process.env.REACT_APP_API_URL || 'https://api.healmedy.com';
```

### Otomatik Güncelleme

`package.json` içindeki `publish` ayarını güncelleyin:

```json
{
  "build": {
    "publish": {
      "provider": "generic",
      "url": "https://releases.healmedy.com"
    }
  }
}
```

## 🔧 Özellikler

### Sistem Tepsisi
- Uygulama kapatıldığında sistem tepsisine küçülür
- Arka planda çalışmaya devam eder
- Sağ tık menüsü ile kontrol

### Bildirimler
- Native Windows bildirimleri
- Yeni vaka geldiğinde anında uyarı

### Otomatik Başlatma
- Windows başlangıcında otomatik açılabilir
- Ayarlardan yönetilebilir

### Offline Destek
- İnternet bağlantısı olmadan da çalışır
- Veriler yerel olarak saklanır
- Bağlantı geldiğinde senkronize edilir

## 🐛 Sorun Giderme

### Electron açılmıyor
```bash
# node_modules'i temizle ve tekrar yükle
rm -rf node_modules
yarn install
```

### Build hatası
```bash
# Cache temizle
yarn cache clean
rm -rf dist-electron
yarn electron:build
```

### Beyaz ekran
- DevTools'u açın: `Ctrl+Shift+I`
- Console'da hataları kontrol edin
- API URL'sinin doğru olduğundan emin olun

## 📱 Diğer Platformlar

| Platform | Komut | Çıktı |
|----------|-------|-------|
| Android | `yarn android:build` | `.apk` dosyası |
| Web | `yarn build` | `build/` klasörü |
| Windows | `yarn electron:build` | `.exe` installer |

## 🔐 Güvenlik

- Context isolation aktif
- Node integration kapalı
- Preload script ile güvenli IPC
- Content Security Policy

## 📞 Destek

Sorularınız için: support@healmedy.com

---

**Healmedy Ambulans** © 2024


