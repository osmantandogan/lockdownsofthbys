package com.healmedy.ambulans.services;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
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
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        // Vaka ID varsa ekle
        if (caseId != null) {
            intent.putExtra("case_id", caseId);
            intent.putExtra("navigate_to", "/dashboard/cases/" + caseId);
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
            intent,
            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        // Kanal seç
        String channelId = CHANNEL_GENERAL;
        if ("emergency".equals(type) || "critical".equals(priority)) {
            channelId = CHANNEL_EMERGENCY;
        } else if ("case".equals(type) || "new_case".equals(type)) {
            channelId = CHANNEL_CASE;
        }

        // Bildirim oluştur
        NotificationCompat.Builder notificationBuilder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE);

        // Acil durumlar için özel ayarlar
        if (CHANNEL_EMERGENCY.equals(channelId)) {
            notificationBuilder
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVibrate(new long[]{0, 500, 200, 500, 200, 500})
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM));
        } else if (CHANNEL_CASE.equals(channelId)) {
            notificationBuilder
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVibrate(new long[]{0, 300, 100, 300});
        }

        NotificationManager notificationManager = 
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        // Unique ID
        int notificationId = (int) System.currentTimeMillis();
        notificationManager.notify(notificationId, notificationBuilder.build());
        
        Log.d(TAG, "Notification shown: " + title);
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = 
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

            // Acil Durum Kanalı
            NotificationChannel emergencyChannel = new NotificationChannel(
                CHANNEL_EMERGENCY,
                "Acil Durumlar",
                NotificationManager.IMPORTANCE_HIGH
            );
            emergencyChannel.setDescription("Acil vaka ve kritik bildirimler");
            emergencyChannel.enableVibration(true);
            emergencyChannel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
            emergencyChannel.setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            );
            emergencyChannel.setBypassDnd(true);
            notificationManager.createNotificationChannel(emergencyChannel);

            // Vaka Kanalı
            NotificationChannel caseChannel = new NotificationChannel(
                CHANNEL_CASE,
                "Vaka Bildirimleri",
                NotificationManager.IMPORTANCE_HIGH
            );
            caseChannel.setDescription("Yeni vaka atamaları ve güncellemeleri");
            caseChannel.enableVibration(true);
            notificationManager.createNotificationChannel(caseChannel);

            // Genel Kanal
            NotificationChannel generalChannel = new NotificationChannel(
                CHANNEL_GENERAL,
                "Genel Bildirimler",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            generalChannel.setDescription("Genel sistem bildirimleri");
            notificationManager.createNotificationChannel(generalChannel);

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

