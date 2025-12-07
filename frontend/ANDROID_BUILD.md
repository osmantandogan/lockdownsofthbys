# HealMedy HBYS - Android Build Rehberi

## Gereksinimler

1. **Android Studio** (en son sürüm)
   - Download: https://developer.android.com/studio

2. **Java Development Kit (JDK 17+)**

3. **Android SDK** (Android Studio ile birlikte gelir)

## Kurulum

### 1. Bağımlılıkları Yükle
```bash
cd frontend
npm install --legacy-peer-deps
```

### 2. Web Uygulamasını Build Et
```bash
npm run build
```

### 3. Android Projesini Sync Et
```bash
npm run cap:sync
# veya
npx cap sync android
```

## Android Studio ile Build

### 1. Android Projesini Aç
```bash
npm run android:open
# veya
npx cap open android
```

### 2. Android Studio'da:
- **Build > Build Bundle(s) / APK(s) > Build APK(s)** seçin
- APK dosyası: `android/app/build/outputs/apk/debug/app-debug.apk`

### 3. Release APK için:
- **Build > Generate Signed Bundle / APK** seçin
- Keystore oluşturun veya mevcut olanı kullanın

## Komut Satırından Build

### Debug APK
```bash
npm run android:build
```

APK Konumu: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

### Release APK
```bash
npm run android:build:release
```

APK Konumu: `frontend/android/app/build/outputs/apk/release/app-release-unsigned.apk`

## OneSignal Push Bildirimleri

OneSignal otomatik olarak yapılandırılmıştır:
- **App ID:** `207f0010-c2d6-4903-9e9d-1e72dfbc3ae2`
- Android 13+ için uygulama başlatıldığında otomatik izin istenir

## Uygulama İkonu Değiştirme

İkon dosyalarını aşağıdaki konumlara yerleştirin:

```
android/app/src/main/res/
├── mipmap-hdpi/
│   ├── ic_launcher.png (72x72)
│   └── ic_launcher_round.png (72x72)
├── mipmap-mdpi/
│   ├── ic_launcher.png (48x48)
│   └── ic_launcher_round.png (48x48)
├── mipmap-xhdpi/
│   ├── ic_launcher.png (96x96)
│   └── ic_launcher_round.png (96x96)
├── mipmap-xxhdpi/
│   ├── ic_launcher.png (144x144)
│   └── ic_launcher_round.png (144x144)
└── mipmap-xxxhdpi/
    ├── ic_launcher.png (192x192)
    └── ic_launcher_round.png (192x192)
```

💡 **Tip:** Android Studio'da **Resource Manager > Image Asset** ile otomatik ikon oluşturabilirsiniz.

## Splash Screen Değiştirme

Splash screen resimlerini aşağıdaki konumlara yerleştirin:

```
android/app/src/main/res/
├── drawable/splash.png
├── drawable-land-hdpi/splash.png
├── drawable-land-mdpi/splash.png
├── drawable-land-xhdpi/splash.png
├── drawable-land-xxhdpi/splash.png
├── drawable-land-xxxhdpi/splash.png
├── drawable-port-hdpi/splash.png
├── drawable-port-mdpi/splash.png
├── drawable-port-xhdpi/splash.png
├── drawable-port-xxhdpi/splash.png
└── drawable-port-xxxhdpi/splash.png
```

## Google Play Store İçin AAB (Android App Bundle)

```bash
cd frontend/android
./gradlew bundleRelease
```

AAB Konumu: `frontend/android/app/build/outputs/bundle/release/app-release.aab`

## Sorun Giderme

### Gradle Sync Hatası
```bash
cd frontend/android
./gradlew clean
./gradlew build
```

### Capacitor Sync Hatası
```bash
npx cap sync android --inline
```

### OneSignal Çalışmıyor
1. AndroidManifest.xml'de `onesignal_app_id` meta-data'yı kontrol edin
2. `POST_NOTIFICATIONS` permission'ı olduğundan emin olun
3. OneSignal Dashboard'da Android platform'un aktif olduğunu kontrol edin

