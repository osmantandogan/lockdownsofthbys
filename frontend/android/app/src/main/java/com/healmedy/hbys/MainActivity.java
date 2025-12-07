package com.healmedy.hbys;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.onesignal.OneSignal;

public class MainActivity extends BridgeActivity {
    
    // OneSignal App ID
    private static final String ONESIGNAL_APP_ID = "207f0010-c2d6-4903-9e9d-1e72dfbc3ae2";
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // OneSignal'i başlat
        OneSignal.initWithContext(this, ONESIGNAL_APP_ID);
        
        // Bildirim izni iste (Android 13+ için)
        OneSignal.getNotifications().requestPermission(true, null);
    }
}
