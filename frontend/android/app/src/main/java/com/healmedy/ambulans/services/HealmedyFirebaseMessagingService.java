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
    private static final long ALARM_DURATION_MS = 60000; // 60 saniye

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM Token: " + token);
        
        // Token'ı backend'e gönder
        sendTokenToServer(token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        
        Log.d(TAG, "Message received from: " + remoteMessage.getFrom());

        // Data payload
        Map<String, String> data = remoteMessage.getData();
        
        // Notification payload
        RemoteMessage.Notification notification = remoteMessage.getNotification();

        String title = "HealMedy Bildirimi";
        String body = "Yeni bildiriminiz var";
        String type = "general";
        String caseId = null;
        String priority = "normal";

        // Data'dan al
        if (data.size() > 0) {
            title = data.getOrDefault("title", title);
            body = data.getOrDefault("body", body);
            type = data.getOrDefault("type", type);
            caseId = data.get("case_id");
            priority = data.getOrDefault("priority", priority);
        }

        // Notification payload'dan al (öncelikli)
        if (notification != null) {
            if (notification.getTitle() != null) title = notification.getTitle();
            if (notification.getBody() != null) body = notification.getBody();
        }

        // Bildirimi göster
        showNotification(title, body, type, caseId, priority);
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
        
        if ("emergency".equals(type) || "critical".equals(priority) || "new_case".equals(type)) {
            channelId = CHANNEL_EMERGENCY;
            isEmergency = true;
        } else if ("case".equals(type)) {
            channelId = CHANNEL_CASE;
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
            startEmergencyAlarm();
            emergencyNotificationId = notificationId;
            
        } else if (CHANNEL_CASE.equals(channelId)) {
            notificationBuilder
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVibrate(new long[]{0, 300, 100, 300});
        }

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        notificationManager.notify(notificationId, notificationBuilder.build());
        
        Log.d(TAG, "Notification shown: " + title + " (emergency: " + isEmergency + ")");
    }
    
    private void startEmergencyAlarm() {
        stopEmergencyAlarm();
        try {
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            
            emergencyMediaPlayer = new MediaPlayer();
            emergencyMediaPlayer.setDataSource(this, alarmUri);
            emergencyMediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            emergencyMediaPlayer.setLooping(true);
            
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0);
            
            emergencyMediaPlayer.prepare();
            emergencyMediaPlayer.start();
            startEmergencyVibration();
            
            alarmHandler = new Handler(Looper.getMainLooper());
            alarmHandler.postDelayed(HealmedyFirebaseMessagingService::stopEmergencyAlarm, ALARM_DURATION_MS);
            Log.d(TAG, "Emergency alarm started");
        } catch (Exception e) { Log.e(TAG, "Error starting alarm", e); }
    }
    
    private void startEmergencyVibration() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                emergencyVibrator = vm.getDefaultVibrator();
            } else {
                emergencyVibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (emergencyVibrator != null && emergencyVibrator.hasVibrator()) {
                long[] pattern = {0, 1000, 500, 1000, 500, 1000, 500};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    emergencyVibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    emergencyVibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) { Log.e(TAG, "Error starting vibration", e); }
    }
    
    public static void stopEmergencyAlarm() {
        if (emergencyMediaPlayer != null) {
            try { if (emergencyMediaPlayer.isPlaying()) emergencyMediaPlayer.stop(); emergencyMediaPlayer.release(); } catch (Exception e) {}
            emergencyMediaPlayer = null;
        }
        if (emergencyVibrator != null) {
            try { emergencyVibrator.cancel(); } catch (Exception e) {}
            emergencyVibrator = null;
        }
        if (alarmHandler != null) { alarmHandler.removeCallbacksAndMessages(null); alarmHandler = null; }
        Log.d("HealmedyFCM", "Emergency alarm stopped");
    }
    
    public static int getEmergencyNotificationId() { return emergencyNotificationId; }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

            // 🚨 ACİL DURUM KANALI - EN YÜKSEK ÖNCELİK
            NotificationChannel emergency = new NotificationChannel(CHANNEL_EMERGENCY, "🚨 Acil Vakalar", NotificationManager.IMPORTANCE_HIGH);
            emergency.setDescription("Yeni vaka bildirimleri - Yüksek sesli alarm");
            emergency.enableVibration(true);
            emergency.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000});
            emergency.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            emergency.setBypassDnd(true);
            emergency.enableLights(true);
            emergency.setLightColor(Color.RED);
            emergency.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(emergency);

            // 📋 Vaka Kanalı
            NotificationChannel caseChannel = new NotificationChannel(CHANNEL_CASE, "📋 Vaka Bildirimleri", NotificationManager.IMPORTANCE_HIGH);
            caseChannel.setDescription("Vaka güncellemeleri");
            caseChannel.enableVibration(true);
            caseChannel.enableLights(true);
            caseChannel.setLightColor(Color.BLUE);
            nm.createNotificationChannel(caseChannel);

            // 🔔 Genel Kanal
            NotificationChannel general = new NotificationChannel(CHANNEL_GENERAL, "🔔 Genel Bildirimler", NotificationManager.IMPORTANCE_DEFAULT);
            general.setDescription("Genel sistem bildirimleri");
            nm.createNotificationChannel(general);

            Log.d(TAG, "Notification channels created");
        }
    }

    private void sendTokenToServer(String token) {
        // Token'ı SharedPreferences'a kaydet
        getSharedPreferences("healmedy_prefs", MODE_PRIVATE)
            .edit()
            .putString("fcm_token", token)
            .apply();
        
        Log.d(TAG, "FCM Token saved to preferences");
        
        // TODO: Backend'e gönder (JavaScript tarafından yapılacak)
    }
}

