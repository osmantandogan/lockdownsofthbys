package com.healmedy.ambulans.services;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.media.ToneGenerator;
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
    private static AudioTrack emergencySirenTrack;
    private static Thread sirenThread;
    private static volatile boolean sirenPlaying = false;
    private static Vibrator emergencyVibrator;
    private static int emergencyNotificationId = -1;
    private static Handler alarmHandler;
    private static PowerManager.WakeLock wakeLock;
    private static final long ALARM_DURATION_MS = 60000; // 60 saniye
    
    // Siren parameters - Avrupa ambulans siren sesi için
    private static final int SIREN_SAMPLE_RATE = 44100;
    private static final int SIREN_LOW_FREQ = 650;   // Düşük frekans (Hz)
    private static final int SIREN_HIGH_FREQ = 1000; // Yüksek frekans (Hz)
    private static final int SIREN_CYCLE_MS = 1200;  // Bir döngü süresi (ms)

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
        String caseNumber = null;
        String patientName = null;
        String patientPhone = null;
        String patientComplaint = null;
        String address = null;
        String priority = "normal";

        // Data'dan al (DATA-ONLY mesajlarda tüm bilgi burada)
        if (data.size() > 0) {
            title = data.getOrDefault("title", title);
            body = data.getOrDefault("body", body);
            type = data.getOrDefault("type", type);
            caseId = data.get("case_id");
            caseNumber = data.get("case_number");
            patientName = data.get("patient_name");
            patientPhone = data.get("patient_phone");
            patientComplaint = data.get("patient_complaint");
            address = data.get("address");
            priority = data.getOrDefault("priority", priority);
            
            Log.d(TAG, "📬 Parsed - type: " + type + ", priority: " + priority);
            Log.d(TAG, "📬 Case: " + caseNumber + ", Patient: " + patientName);
        }

        // Notification payload'dan al (eğer varsa, öncelikli)
        if (notification != null) {
            if (notification.getTitle() != null) title = notification.getTitle();
            if (notification.getBody() != null) body = notification.getBody();
        }

        // Wake lock al - ekran kapalıyken bile çalışması için
        acquireWakeLock();

        // Bildirimi göster
        showNotification(title, body, type, caseId, caseNumber, patientName, patientPhone, patientComplaint, address, priority);
        
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

    private void showNotification(String title, String body, String type, String caseId, 
            String caseNumber, String patientName, String patientPhone, 
            String patientComplaint, String address, String priority) {
        
        int notificationId = (int) System.currentTimeMillis();
        
        // Kanal ve acil durum belirleme
        String channelId = CHANNEL_GENERAL;
        boolean isEmergency = false;
        
        // Emergency, critical, new_case veya priority=critical olduğunda acil alarm çal
        if ("emergency".equals(type) || "critical".equals(priority) || 
            "new_case".equals(type) || "case_assigned".equals(type)) {
            isEmergency = true;
        }
        
        // Acil durum ise popup activity başlat
        if (isEmergency) {
            Log.d(TAG, "🚨 EMERGENCY! Launching popup activity...");
            launchEmergencyPopup(caseId, caseNumber, patientName, patientPhone, patientComplaint, address);
        }
        
        // Normal intent
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        
        if (caseId != null) {
            intent.putExtra("case_id", caseId);
            intent.putExtra("navigate_to", "/dashboard/cases/" + caseId);
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, notificationId, intent,
            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );
        
        // Kanal belirleme
        if (isEmergency) {
            channelId = CHANNEL_EMERGENCY;
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
            // 1. Ses seviyesini MAKSIMUM yap
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            
            // Önceki ses seviyelerini logla
            Log.d(TAG, "🔊 Current volumes - Music: " + am.getStreamVolume(AudioManager.STREAM_MUSIC) + 
                       "/" + am.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
            
            // Tüm ses kanallarını maksimuma çek
            try {
                am.setStreamVolume(AudioManager.STREAM_MUSIC, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC), 0);
                am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0);
                am.setStreamVolume(AudioManager.STREAM_RING, am.getStreamMaxVolume(AudioManager.STREAM_RING), 0);
                am.setStreamVolume(AudioManager.STREAM_NOTIFICATION, am.getStreamMaxVolume(AudioManager.STREAM_NOTIFICATION), 0);
                Log.d(TAG, "🔊 All volumes set to MAX");
            } catch (SecurityException e) {
                Log.w(TAG, "⚠️ Cannot set volume: " + e.getMessage());
            }
            
            // 2. Sessiz modu devre dışı bırak
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
            
            // 3. Programatik ambulans siren sesi oluştur ve çal
            sirenPlaying = true;
            sirenThread = new Thread(() -> {
                Log.d(TAG, "🚨 Siren thread started");
                playSirenSound();
            });
            sirenThread.start();
            
            // 4. Titreşimi başlat
            startEmergencyVibration();
            
            // 5. 60 saniye sonra otomatik dur
            alarmHandler = new Handler(Looper.getMainLooper());
            alarmHandler.postDelayed(() -> {
                Log.d(TAG, "⏰ Alarm timeout reached, stopping...");
                stopEmergencyAlarm();
            }, ALARM_DURATION_MS);
            
            Log.d(TAG, "✅ Emergency siren alarm started");
            
        } catch (Exception e) { 
            Log.e(TAG, "❌ Error starting alarm: " + e.getMessage(), e); 
        }
    }
    
    /**
     * Avrupa tarzı ambulans siren sesi oluşturur (Hi-Lo pattern)
     * İki ton arasında sürekli geçiş yapar
     */
    private void playSirenSound() {
        try {
            int bufferSize = AudioTrack.getMinBufferSize(
                SIREN_SAMPLE_RATE,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            );
            
            if (bufferSize <= 0) {
                bufferSize = SIREN_SAMPLE_RATE * 2; // Fallback
            }
            
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                .build();
            
            AudioFormat audioFormat = new AudioFormat.Builder()
                .setSampleRate(SIREN_SAMPLE_RATE)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build();
            
            emergencySirenTrack = new AudioTrack.Builder()
                .setAudioAttributes(audioAttributes)
                .setAudioFormat(audioFormat)
                .setBufferSizeInBytes(bufferSize * 2)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build();
            
            emergencySirenTrack.play();
            Log.d(TAG, "🚨🚨🚨 AMBULANCE SIREN PLAYING! 🚨🚨🚨");
            
            // Siren döngüsü
            int samplesPerCycle = (SIREN_SAMPLE_RATE * SIREN_CYCLE_MS) / 1000;
            short[] buffer = new short[samplesPerCycle];
            
            while (sirenPlaying) {
                // Her döngüde düşük frekans -> yüksek frekans -> düşük frekans geçişi
                generateSirenCycle(buffer, samplesPerCycle);
                
                if (emergencySirenTrack != null && sirenPlaying) {
                    emergencySirenTrack.write(buffer, 0, samplesPerCycle);
                }
            }
            
            Log.d(TAG, "🛑 Siren sound loop ended");
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error playing siren: " + e.getMessage(), e);
            
            // Fallback: ToneGenerator kullan
            playFallbackTone();
        }
    }
    
    /**
     * Bir siren döngüsü oluşturur (Hi-Lo-Hi pattern)
     */
    private void generateSirenCycle(short[] buffer, int samples) {
        double phase = 0;
        int halfSamples = samples / 2;
        
        for (int i = 0; i < samples; i++) {
            // İlk yarı: düşük -> yüksek, ikinci yarı: yüksek -> düşük
            double progress;
            double frequency;
            
            if (i < halfSamples) {
                // Frekans artıyor (düşük -> yüksek)
                progress = (double) i / halfSamples;
                frequency = SIREN_LOW_FREQ + (SIREN_HIGH_FREQ - SIREN_LOW_FREQ) * progress;
            } else {
                // Frekans azalıyor (yüksek -> düşük)
                progress = (double) (i - halfSamples) / halfSamples;
                frequency = SIREN_HIGH_FREQ - (SIREN_HIGH_FREQ - SIREN_LOW_FREQ) * progress;
            }
            
            // Sinüs dalgası oluştur
            phase += 2.0 * Math.PI * frequency / SIREN_SAMPLE_RATE;
            if (phase > 2.0 * Math.PI) {
                phase -= 2.0 * Math.PI;
            }
            
            // Maksimum ses seviyesi (0.95 - clipping önlemek için)
            buffer[i] = (short) (Math.sin(phase) * Short.MAX_VALUE * 0.95);
        }
    }
    
    /**
     * AudioTrack çalışmazsa ToneGenerator ile fallback
     */
    private void playFallbackTone() {
        try {
            Log.d(TAG, "🔊 Using ToneGenerator fallback");
            ToneGenerator toneGen = new ToneGenerator(AudioManager.STREAM_ALARM, ToneGenerator.MAX_VOLUME);
            
            while (sirenPlaying) {
                // Alternatif tonlar çal
                toneGen.startTone(ToneGenerator.TONE_CDMA_EMERGENCY_RINGBACK, 600);
                Thread.sleep(700);
                if (!sirenPlaying) break;
                
                toneGen.startTone(ToneGenerator.TONE_CDMA_HIGH_L, 500);
                Thread.sleep(600);
            }
            
            toneGen.release();
        } catch (Exception e) {
            Log.e(TAG, "❌ ToneGenerator fallback failed: " + e.getMessage());
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
        
        // 1. Siren thread'i durdur
        sirenPlaying = false;
        
        if (sirenThread != null) {
            try {
                sirenThread.interrupt();
                sirenThread = null;
                Log.d("HealmedyFCM", "🛑 Siren thread stopped");
            } catch (Exception e) {
                Log.e("HealmedyFCM", "❌ Error stopping siren thread: " + e.getMessage());
            }
        }
        
        // 2. AudioTrack durdur
        if (emergencySirenTrack != null) {
            try {
                emergencySirenTrack.stop();
                emergencySirenTrack.release();
                Log.d("HealmedyFCM", "🛑 AudioTrack stopped");
            } catch (Exception e) {
                Log.e("HealmedyFCM", "❌ Error stopping AudioTrack: " + e.getMessage());
            }
            emergencySirenTrack = null;
        }
        
        // 3. MediaPlayer durdur (fallback için)
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
        
        // 4. Titreşimi durdur
        if (emergencyVibrator != null) {
            try { 
                emergencyVibrator.cancel(); 
                Log.d("HealmedyFCM", "🛑 Vibrator cancelled");
            } catch (Exception e) {
                Log.e("HealmedyFCM", "❌ Error cancelling vibrator: " + e.getMessage());
            }
            emergencyVibrator = null;
        }
        
        // 5. Handler'ı temizle
        if (alarmHandler != null) { 
            alarmHandler.removeCallbacksAndMessages(null); 
            alarmHandler = null; 
        }
        
        // 6. WakeLock'u serbest bırak
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
                Log.d("HealmedyFCM", "🔋 WakeLock released");
            } catch (Exception e) {
                Log.e("HealmedyFCM", "❌ Error releasing wake lock: " + e.getMessage());
            }
        }
        
        Log.d("HealmedyFCM", "✅ Emergency siren alarm fully stopped");
    }
    
    /**
     * Acil durum popup activity'sini başlat
     */
    private void launchEmergencyPopup(String caseId, String caseNumber, String patientName, 
            String patientPhone, String patientComplaint, String address) {
        try {
            Log.d(TAG, "🚨 Launching EmergencyPopupActivity...");
            
            Intent popupIntent = new Intent(this, com.healmedy.ambulans.EmergencyPopupActivity.class);
            popupIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | 
                                 Intent.FLAG_ACTIVITY_CLEAR_TOP |
                                 Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
            
            // Vaka bilgilerini ekle
            if (caseId != null) popupIntent.putExtra("case_id", caseId);
            if (caseNumber != null) popupIntent.putExtra("case_number", caseNumber);
            if (patientName != null) popupIntent.putExtra("patient_name", patientName);
            if (patientPhone != null) popupIntent.putExtra("patient_phone", patientPhone);
            if (patientComplaint != null) popupIntent.putExtra("patient_complaint", patientComplaint);
            if (address != null) popupIntent.putExtra("address", address);
            
            startActivity(popupIntent);
            Log.d(TAG, "✅ EmergencyPopupActivity started");
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error launching popup: " + e.getMessage(), e);
        }
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
