# Android Studio Kurulum ve APK Oluşturma Rehberi

## ⚠️ ÖNEMLİ: Java 21 Gerekli!

Capacitor eklentileri Java 21 gerektiriyor. **Önce Java 21'i kurmalısınız!**

### Java 21 Kurulumu

PowerShell'de çalıştır:
```powershell
winget install --id "Microsoft.OpenJDK.21" --accept-source-agreements
```

Kurulumu doğrula:
```powershell
& "C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot\bin\java.exe" -version
```

---

## 🔧 Android Studio JDK Ayarı (ÖNEMLİ!)

Android Studio varsayılan olarak kendi JDK'sını kullanır. Java 21'i kullanması için:

### Yöntem 1: Gradle JDK Ayarı (Önerilen)

1. Android Studio'da projeyi aç
2. **File > Settings** (Windows) veya **Android Studio > Preferences** (Mac)
3. **Build, Execution, Deployment > Build Tools > Gradle**
4. **Gradle JDK** alanını `C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot` olarak değiştir
5. **Apply** ve **OK**

### Yöntem 2: Terminal'den Build (En Güvenilir)

Android Studio yerine PowerShell'den build al:

```powershell
cd C:\Users\Osman\Desktop\HEALMEDY\ABROV2\lockdownsofthbys\frontend\android
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot"
.\gradlew.bat clean assembleDebug
```

APK çıktısı: `app\build\outputs\apk\debug\app-debug.apk`

---

## 📱 Mevcut APK

Debug APK hazır:
```
📍 C:\Users\Osman\Desktop\HEALMEDY\ABROV2\lockdownsofthbys\frontend\HealMedy-Ambulans-Debug.apk
```

### Telefona Kurulum

1. APK dosyasını telefona kopyala (USB veya dosya paylaşımı)
2. Telefonda **Ayarlar > Güvenlik > Bilinmeyen kaynaklar** seçeneğini aç
3. Dosya yöneticisinden APK'yı aç
4. **Kur** butonuna bas

---

## 🔨 Build Komutları (Terminal)

### Debug APK
```powershell
cd C:\Users\Osman\Desktop\HEALMEDY\ABROV2\lockdownsofthbys\frontend\android
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot"
.\gradlew.bat assembleDebug
```

### Release APK (İmzalı)
```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot"
.\gradlew.bat assembleRelease
```

### Temizleme
```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot"
.\gradlew.bat clean
```

---

## 🏷️ Release APK (İmzalı) Oluşturma

### 1. Keystore Oluştur (İlk seferlik)
```powershell
& "C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot\bin\keytool.exe" -genkey -v -keystore healmedy-release.keystore -alias healmedy -keyalg RSA -keysize 2048 -validity 10000
```

### 2. app/build.gradle Düzenle
```gradle
android {
    signingConfigs {
        release {
            storeFile file("healmedy-release.keystore")
            storePassword "YOUR_STORE_PASSWORD"
            keyAlias "healmedy"
            keyPassword "YOUR_KEY_PASSWORD"
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 3. Release APK Oluştur
```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot"
.\gradlew.bat assembleRelease
```

---

## ⚠️ Sık Karşılaşılan Hatalar

### "invalid source release: 21"
**Neden:** Android Studio Java 21 kullanmıyor
**Çözüm:** 
1. Android Studio > Settings > Build Tools > Gradle > Gradle JDK
2. `C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot` seç
3. VEYA Terminal'den build al (yukarıdaki komutlar)

### "Uygulama durmadan kapandı"
**Neden:** APK düzgün imzalanmamış veya hatalı
**Çözüm:** 
1. `.\gradlew.bat clean` çalıştır
2. Yeniden build al
3. Yeni APK'yı kur

### SDK hatası
**Çözüm:** Android Studio'da SDK Manager'dan Android 14 (API 34) ve Android 15 (API 35) kur

---

## 📱 Uygulama Özellikleri

| Özellik | Değer |
|---------|-------|
| **Uygulama Adı** | HealMedy Ambulans |
| **Paket Adı** | com.healmedy.ambulans |
| **Min Android** | 11 (API 30) |
| **Hedef Android** | 14 (API 34) |
| **WebView URL** | https://abro.ldserp.com |

---

## 🔄 Güncelleme

Web sitesi güncellendiğinde uygulama otomatik olarak yeni içeriği yükler.
**Uygulama güncellemesi gerekmez!**

Sadece şu durumlarda yeni APK gerekir:
- Native özellik ekleme/değiştirme
- Android izin değişiklikleri
- Capacitor versiyon güncellemesi
