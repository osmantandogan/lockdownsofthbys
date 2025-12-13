package com.healmedy.ambulans.services;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Acil durum bildirimindeki "Anlaşıldı" butonuna tıklandığında
 * alarmı ve bildirimi durduran receiver
 */
public class EmergencyDismissReceiver extends BroadcastReceiver {
    
    private static final String TAG = "EmergencyDismiss";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "Emergency dismiss button clicked");
        
        // Alarmı durdur
        HealmedyFirebaseMessagingService.stopEmergencyAlarm();
        
        // Bildirimi kaldır
        int notificationId = intent.getIntExtra("notification_id", -1);
        if (notificationId != -1) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            nm.cancel(notificationId);
            Log.d(TAG, "Notification " + notificationId + " cancelled");
        }
    }
}

