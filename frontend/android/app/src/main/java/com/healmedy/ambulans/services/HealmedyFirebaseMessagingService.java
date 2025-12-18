package com.healmedy.ambulans.services;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.healmedy.ambulans.MainActivity;
import com.healmedy.ambulans.R;

import java.util.Map;

public class HealmedyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "HealmedyFCM";
    
    // Notification Channels
    public static final String CHANNEL_EMERGENCY = "emergency_channel";
    public static final String CHANNEL_CASE = "case_channel";
    public static final String CHANNEL_GENERAL = "general_channel";
    
    // Emergency alarm - static for stopping from receiver
    private static MediaPlayer emergencyMediaPlayer;
    private static Vibrator emergencyVibrator;
    private static int emergencyNotificationId = -1;
    private static Handler alarmHandler;
    private static PowerManager.WakeLock wakeLock;
    private static final long ALARM_DURATION_MS = 60000; // 60 saniye

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "🚀 HealmedyFirebaseMessagingService created");
        createNotificationChannels();
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "🔑 New FCM Token: " + token.substring(0, Math.min(20, token.length())) + "...");
        
        // Token'ı backend'e gönder
        sendTokenToServer(token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        
        Log.d(TAG, "═══════════════════════════════════════════════════════");
        Log.d(TAG, "📬 MESSAGE RECEIVED from: " + remoteMessage.getFrom());
        Log.d(TAG, "📬 Message ID: " + remoteMessage.getMessageId());

        // Data payload
        Map<String, String> data = remoteMessage.getData();
        Log.d(TAG, "📬 Data payload size: " + data.size());
        for (Map.Entry<String, String> entry : data.entrySet()) {
            Log.d(TAG, "📬 Data: " + entry.getKey() + " = " + entry.getValue());
        }
        
        // Notification payload (if any)
        RemoteMessage.Notification notification = remoteMessage.getNotification();
        if (notification != null) {
            Log.d(TAG, "📬 Notification payload: title=" + notification.getTitle() + ", body=" + notification.getBody());
        } else {
            Log.d(TAG, "📬 No notification payload (DATA-ONLY message) ✓");
        }

        String title = "HealMedy Bildirimi";
        String body = "Yeni bildiriminiz var";
        String type = "general";
        String caseId = null;
        String priority = "normal";

        // Data'dan al (DATA-ONLY mesajlarda tüm bilgi burada)
        if (data.size() > 0) {
            title = data.getOrDefault("title", title);
            body = data.getOrDefault("body", body);
            type = data.getOrDefault("type", type);
            caseId = data.get("case_id");
            priority = data.getOrDefault("priority", priority);
            
            Log.d(TAG, "📬 Parsed - type: " + type + ", priority: " + priority);
        }

        // Notification payload'dan al (eğer varsa, öncelikli)
        if (notification != null) {
            if (notification.getTitle() != null) title = notification.getTitle();
            if (notification.getBody() != null) body = notification.getBody();
        }

        // Wake lock al - ekran kapalıyken bile çalışması için
        acquireWakeLock();

        // Bildirimi göster
        showNotification(title, body, type, caseId, priority);
        
        Log.d(TAG, "═══════════════════════════════════════════════════════");
    }

    private void acquireWakeLock() {
        try {
            if (wakeLock == null || !wakeLock.isHeld()) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                wakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "HealMedy:EmergencyAlarm"
                );
                wakeLock.acquire(ALARM_DURATION_MS + 10000); // Alarm süresi + 10 saniye
                Log.d(TAG, "🔋 WakeLock acquired for emergency alarm");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error acquiring wake lock: " + e.getMessage());
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                Log.d(TAG, "🔋 WakeLock released");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error releasing wake lock: " + e.getMessage());
        }
    }

    private void showNotification(String title, String body, String type, String caseId, String priority) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        
        if (caseId != null) {
            intent.putExtra("case_id", caseId);
            intent.putExtra("navigate_to", "/dashboard/cases/" + caseId);
        }

        int notificationId = (int) System.currentTimeMillis();

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, notificationId, intent,
            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        // Kanal ve acil durum belirleme
        String channelId = CHANNEL_GENERAL;
        boolean isEmergency = false;
        
        // Emergency, critical, new_case veya priority=critical olduğunda acil alarm çal
        if ("emergency".equals(type) || "critical".equals(priority) || 
            "new_case".equals(type) || "case_assigned".equals(type)) {
            channelId = CHANNEL_EMERGENCY;
            isEmergency = true;
            Log.d(TAG, "🚨 EMERGENCY notification detected! type=" + type + ", priority=" + priority);
        } else if ("case".equals(type)) {
            channelId = CHANNEL_CASE;
            Log.d(TAG, "📋 Case notification detected");
        } else {
            Log.d(TAG, "🔔 General notification detected");
        }

        // Bildirim oluştur
        NotificationCompat.Builder notificationBuilder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(!isEmergency)
            .setOngoing(isEmergency) // Acil: kaydırarak kapanmaz
            .setContentIntent(pendingIntent)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setColor(Color.parseColor("#dc2626"));

        if (isEmergency) {
            Log.d(TAG, "🚨 Building EMERGENCY notification...");
            
            notificationBuilder
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setVibrate(new long[]{0, 1000, 500, 1000, 500, 1000})
                .setLights(Color.RED, 500, 500)
                .setFullScreenIntent(pendingIntent, true);
            
            // "Anlaşıldı" butonu
            Intent dismissIntent = new Intent(this, EmergencyDismissReceiver.class);
            dismissIntent.putExtra("notification_id", notificationId);
            PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
                this, notificationId, dismissIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            notificationBuilder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "✓ ANLAŞILDI", dismissPendingIntent);
            
            // Acil alarm başlat
            Log.d(TAG, "🚨 Starting emergency alarm...");
            startEmergencyAlarm();
            emergencyNotificationId = notificationId;
            
        } else if (CHANNEL_CASE.equals(channelId)) {
            notificationBuilder
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVibrate(new long[]{0, 300, 100, 300});
        }

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        notificationManager.notify(notificationId, notificationBuilder.build());
        
        Log.d(TAG, "✅ Notification shown: " + title + " (emergency: " + isEmergency + ", id: " + notificationId + ")");
    }
    
    private void startEmergencyAlarm() {
        Log.d(TAG, "🔊 startEmergencyAlarm() called");
        
        // Önce mevcut alarmı durdur
        stopEmergencyAlarm();
        
        try {
            // 1. Ses URI'sini belirle
            Uri sirenUri = null;
            
            // Önce custom siren sesini dene (res/raw/emergency_siren.mp3)
            int sirenResId = getResources().getIdentifier("emergency_siren", "raw", getPackageName());
            
            if (sirenResId != 0) {
                sirenUri = Uri.parse("android.resource://" + getPackageName() + "/" + sirenResId);
                Log.d(TAG, "🔊 Using CUSTOM siren sound: " + sirenUri);
            } else {
                // Custom siren yoksa, sistem alarm sesini kullan
                sirenUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                Log.d(TAG, "🔊 Custom siren not found, trying system alarm");
                
                if (sirenUri == null) {
                    sirenUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                    Log.d(TAG, "🔊 Alarm not found, trying ringtone");
                }
                if (sirenUri == null) {
                    sirenUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    Log.d(TAG, "🔊 Ringtone not found, using notification");
                }
                Log.d(TAG, "🔊 Using SYSTEM sound: " + sirenUri);
            }
            
            if (sirenUri == null) {
                Log.e(TAG, "❌ No sound URI found! Cannot play alarm.");
                return;
            }
            
            // 2. Ses seviyesini MAKSIMUM yap
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            
            // Önceki ses seviyelerini logla
            Log.d(TAG, "🔊 Current volumes - Alarm: " + am.getStreamVolume(AudioManager.STREAM_ALARM) + 
                       "/" + am.getStreamMaxVolume(AudioManager.STREAM_ALARM));
            
            // Tüm ses kanallarını maksimuma çek
            try {
                am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0);
                am.setStreamVolume(AudioManager.STREAM_RING, am.getStreamMaxVolume(AudioManager.STREAM_RING), 0);
                am.setStreamVolume(AudioManager.STREAM_NOTIFICATION, am.getStreamMaxVolume(AudioManager.STREAM_NOTIFICATION), 0);
                am.setStreamVolume(AudioManager.STREAM_MUSIC, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC), 0);
                Log.d(TAG, "🔊 All volumes set to MAX");
            } catch (SecurityException e) {
                Log.w(TAG, "⚠️ Cannot set volume: " + e.getMessage());
            }
            
            // 3. Sessiz modu devre dışı bırak
            try {
                int currentMode = am.getRingerMode();
                Log.d(TAG, "🔊 Current ringer mode: " + currentMode);
                if (currentMode != AudioManager.RINGER_MODE_NORMAL) {
                    am.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
                    Log.d(TAG, "🔊 Ringer mode set to NORMAL");
                }
            } catch (SecurityException e) {
                Log.w(TAG, "⚠️ Cannot change ringer mode: " + e.getMessage());
            }
            
            // 4. MediaPlayer oluştur
            emergencyMediaPlayer = new MediaPlayer();
            emergencyMediaPlayer.setDataSource(this, sirenUri);
            emergencyMediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                .build());
            emergencyMediaPlayer.setLooping(true);
            
            // Hata dinleyicisi
            emergencyMediaPlayer.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "❌ MediaPlayer error: what=" + what + ", extra=" + extra);
                return false;
            });
            
            // Hazırlık tamamlandı dinleyicisi
            emergencyMediaPlayer.setOnPreparedListener(mp -> {
                Log.d(TAG, "🔊 MediaPlayer prepared, starting playback...");
                mp.start();
                Log.d(TAG, "🚨🚨🚨 EMERGENCY ALARM PLAYING AT MAXIMUM VOLUME! 🚨🚨🚨");
            });
            
            // Async prepare
            emergencyMediaPlayer.prepareAsync();
            
            // 5. Titreşimi başlat
            startEmergencyVibration();
            
            // 6. 60 saniye sonra otomatik dur
            alarmHandler = new Handler(Looper.getMainLooper());
            alarmHandler.postDelayed(() -> {
                Log.d(TAG, "⏰ Alarm timeout reached, stopping...");
                stopEmergencyAlarm();
            }, ALARM_DURATION_MS);
            
            Log.d(TAG, "✅ Emergency alarm setup complete");
            
        } catch (Exception e) { 
            Log.e(TAG, "❌ Error starting alarm: " + e.getMessage(), e); 
        }
    }
    
    private void startEmergencyVibration() {
        try {
            Log.d(TAG, "📳 Starting emergency vibration...");
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                emergencyVibrator = vm.getDefaultVibrator();
            } else {
                emergencyVibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }
            
            if (emergencyVibrator != null && emergencyVibrator.hasVibrator()) {
                // Güçlü titreşim deseni: 1sn titreşim, 0.5sn bekleme, tekrar
                long[] pattern = {0, 1000, 500, 1000, 500, 1000, 500, 1000, 500};
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    emergencyVibrator.vibrate(VibrationEffect.createWaveform(pattern, 0)); // 0 = loop
                } else {
                    emergencyVibrator.vibrate(pattern, 0);
                }
                Log.d(TAG, "📳 Vibration started");
            } else {
                Log.w(TAG, "📳 Vibrator not available");
            }
        } catch (Exception e) { 
            Log.e(TAG, "❌ Error starting vibration: " + e.getMessage()); 
        }
    }
    
    public static void stopEmergencyAlarm() {
        Log.d("HealmedyFCM", "🛑 stopEmergencyAlarm() called");
        
        if (emergencyMediaPlayer != null) {
            try { 
                if (emergencyMediaPlayer.isPlaying()) {
                    emergencyMediaPlayer.stop(); 
                    Log.d("HealmedyFCM", "🛑 MediaPlayer stopped");
                }
                emergencyMediaPlayer.release(); 
            } catch (Exception e) {
                Log.e("HealmedyFCM", "❌ Error stopping MediaPlayer: " + e.getMessage());
            }
            emergencyMediaPlayer = null;
        }
        
        if (emergencyVibrator != null) {
            try { 
                emergencyVibrator.cancel(); 
                Log.d("HealmedyFCM", "🛑 Vibrator cancelled");
            } catch (Exception e) {
                Log.e("HealmedyFCM", "❌ Error cancelling vibrator: " + e.getMessage());
            }
            emergencyVibrator = null;
        }
        
        if (alarmHandler != null) { 
            alarmHandler.removeCallbacksAndMessages(null); 
            alarmHandler = null; 
        }
        
        // WakeLock'u da serbest bırak
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
                Log.d("HealmedyFCM", "🔋 WakeLock released");
            } catch (Exception e) {
                Log.e("HealmedyFCM", "❌ Error releasing wake lock: " + e.getMessage());
            }
        }
        
        Log.d("HealmedyFCM", "✅ Emergency alarm fully stopped");
    }
    
    public static int getEmergencyNotificationId() { return emergencyNotificationId; }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Log.d(TAG, "📢 Creating notification channels...");
            
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

            // Custom siren sesini kontrol et
            Uri sirenUri = null;
            int sirenResId = getResources().getIdentifier("emergency_siren", "raw", getPackageName());
            if (sirenResId != 0) {
                sirenUri = Uri.parse("android.resource://" + getPackageName() + "/" + sirenResId);
                Log.d(TAG, "📢 Custom siren found for channel: " + sirenUri);
            } else {
                sirenUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                Log.d(TAG, "📢 Using system alarm for channel: " + sirenUri);
            }

            // 🚨 ACİL DURUM KANALI - EN YÜKSEK ÖNCELİK
            NotificationChannel emergency = new NotificationChannel(
                CHANNEL_EMERGENCY, 
                "🚨 Acil Vakalar", 
                NotificationManager.IMPORTANCE_HIGH
            );
            emergency.setDescription("Yeni vaka bildirimleri - Yüksek sesli alarm");
            emergency.enableVibration(true);
            emergency.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000, 500, 1000});
            emergency.setSound(sirenUri,
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                    .build());
            emergency.setBypassDnd(true);
            emergency.enableLights(true);
            emergency.setLightColor(Color.RED);
            emergency.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(emergency);
            Log.d(TAG, "📢 Emergency channel created: " + CHANNEL_EMERGENCY);

            // 📋 Vaka Kanalı
            NotificationChannel caseChannel = new NotificationChannel(
                CHANNEL_CASE, 
                "📋 Vaka Bildirimleri", 
                NotificationManager.IMPORTANCE_HIGH
            );
            caseChannel.setDescription("Vaka güncellemeleri");
            caseChannel.enableVibration(true);
            caseChannel.enableLights(true);
            caseChannel.setLightColor(Color.BLUE);
            nm.createNotificationChannel(caseChannel);
            Log.d(TAG, "📢 Case channel created: " + CHANNEL_CASE);

            // 🔔 Genel Kanal
            NotificationChannel general = new NotificationChannel(
                CHANNEL_GENERAL, 
                "🔔 Genel Bildirimler", 
                NotificationManager.IMPORTANCE_DEFAULT
            );
            general.setDescription("Genel sistem bildirimleri");
            nm.createNotificationChannel(general);
            Log.d(TAG, "📢 General channel created: " + CHANNEL_GENERAL);

            Log.d(TAG, "✅ All notification channels created");
        }
    }

    private void sendTokenToServer(String token) {
        // Token'ı SharedPreferences'a kaydet
        getSharedPreferences("healmedy_prefs", MODE_PRIVATE)
            .edit()
            .putString("fcm_token", token)
            .apply();
        
        Log.d(TAG, "💾 FCM Token saved to preferences");
        
        // TODO: Backend'e gönder (JavaScript tarafından yapılacak)
    }
}
