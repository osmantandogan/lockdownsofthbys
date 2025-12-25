package com.healmedy.ambulans;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "MainActivity";
    private static final int CAMERA_MIC_PERMISSION_REQUEST_CODE = 1001;
    private WindowInsetsControllerCompat insetsController;
    private PermissionRequest pendingPermissionRequest;
    
    // Bildirim izni için launcher
    private final ActivityResultLauncher<String> requestPermissionLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestPermission(), isGranted -> {
            if (isGranted) {
                Log.d(TAG, "Notification permission granted");
                getFCMToken();
            } else {
                Log.w(TAG, "Notification permission denied");
            }
        });
    
    // Kamera ve mikrofon izinleri için launcher
    private final ActivityResultLauncher<String[]> requestMultiplePermissionsLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> {
            Boolean cameraGranted = result.getOrDefault(Manifest.permission.CAMERA, false);
            Boolean audioGranted = result.getOrDefault(Manifest.permission.RECORD_AUDIO, false);
            
            Log.d(TAG, "Camera permission: " + cameraGranted + ", Audio permission: " + audioGranted);
            
            if (pendingPermissionRequest != null) {
                if (cameraGranted && audioGranted) {
                    pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
                    Log.d(TAG, "WebView permissions granted");
                } else {
                    pendingPermissionRequest.deny();
                    Log.w(TAG, "WebView permissions denied");
                }
                pendingPermissionRequest = null;
            }
        });
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Window window = getWindow();
        
        // Firebase FCM token al
        initializeFirebase();
        
        // Status bar rengini ayarla
        window.setStatusBarColor(Color.parseColor("#dc2626"));
        
        // Intent'ten gelen navigasyon verisini kontrol et
        handleNavigationIntent(getIntent());
        
        // Navigation bar rengini ayarla
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            window.setNavigationBarColor(Color.WHITE);
        }
        
        // Insets controller ayarla
        insetsController = WindowCompat.getInsetsController(window, window.getDecorView());
        insetsController.setAppearanceLightStatusBars(false); // false = beyaz status bar ikonları
        insetsController.setAppearanceLightNavigationBars(true); // true = koyu navigation bar ikonları
        
        // Navigation bar'ı gizle (immersive sticky mode)
        insetsController.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        insetsController.hide(WindowInsetsCompat.Type.navigationBars());
        
        // WebView ayarları
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setDatabaseEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setLoadWithOverviewMode(true);
            settings.setUseWideViewPort(true);
            
            // WebView debugging
            WebView.setWebContentsDebuggingEnabled(true);
            
            // WebChromeClient - Kamera ve mikrofon izinleri için
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    Log.d(TAG, "WebView permission request received");
                    
                    // İstenen izinleri kontrol et
                    String[] resources = request.getResources();
                    boolean needsCamera = false;
                    boolean needsMic = false;
                    
                    for (String resource : resources) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            needsCamera = true;
                            Log.d(TAG, "WebView requests camera permission");
                        }
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                            needsMic = true;
                            Log.d(TAG, "WebView requests microphone permission");
                        }
                    }
                    
                    // Android izinlerini kontrol et
                    boolean hasCameraPermission = ContextCompat.checkSelfPermission(
                        MainActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
                    boolean hasMicPermission = ContextCompat.checkSelfPermission(
                        MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
                    
                    Log.d(TAG, "Has camera permission: " + hasCameraPermission + ", Has mic permission: " + hasMicPermission);
                    
                    if (hasCameraPermission && hasMicPermission) {
                        // Tüm izinler var, WebView'a izin ver
                        runOnUiThread(() -> {
                            request.grant(resources);
                            Log.d(TAG, "WebView permissions granted directly");
                        });
                    } else {
                        // İzin iste
                        pendingPermissionRequest = request;
                        requestMultiplePermissionsLauncher.launch(new String[]{
                            Manifest.permission.CAMERA,
                            Manifest.permission.RECORD_AUDIO
                        });
                    }
                }
            });
        }
    }
    
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Uygulama focus aldığında navigation bar'ı gizle
        if (hasFocus && insetsController != null) {
            insetsController.hide(WindowInsetsCompat.Type.navigationBars());
        }
    }
    
    @Override
    public void onResume() {
        super.onResume();
        // Uygulama devam ettiğinde navigation bar'ı gizle
        if (insetsController != null) {
            insetsController.hide(WindowInsetsCompat.Type.navigationBars());
        }
    }
    
    private void initializeFirebase() {
        // Android 13+ için bildirim izni iste
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) 
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
            } else {
                getFCMToken();
            }
        } else {
            getFCMToken();
        }
    }
    
    private void getFCMToken() {
        FirebaseMessaging.getInstance().getToken()
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful()) {
                    Log.w(TAG, "FCM token fetch failed", task.getException());
                    return;
                }
                
                // FCM token'ı al
                String token = task.getResult();
                Log.d(TAG, "FCM Token: " + token);
                
                // Token'ı SharedPreferences'a kaydet
                getSharedPreferences("healmedy_prefs", MODE_PRIVATE)
                    .edit()
                    .putString("fcm_token", token)
                    .apply();
                
                // Token'ı JavaScript'e gönder
                sendTokenToWebView(token);
            });
    }
    
    private void sendTokenToWebView(String token) {
        // WebView'a JavaScript ile token gönder
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            String script = "window.dispatchEvent(new CustomEvent('fcmToken', { detail: '" + token + "' }));";
            webView.post(() -> webView.evaluateJavascript(script, null));
            Log.d(TAG, "FCM token sent to WebView");
        }
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Log.d(TAG, "📬 onNewIntent called");
        setIntent(intent);
        handleNavigationIntent(intent);
    }
    
    /**
     * Intent'ten gelen navigasyon verisini işle
     * EmergencyPopupActivity'den "Vakaya Git" butonuna tıklandığında çağrılır
     */
    private void handleNavigationIntent(Intent intent) {
        if (intent == null) return;
        
        String navigateTo = intent.getStringExtra("navigate_to");
        String caseId = intent.getStringExtra("case_id");
        
        Log.d(TAG, "📍 handleNavigationIntent - navigate_to: " + navigateTo + ", case_id: " + caseId);
        
        if (navigateTo != null && !navigateTo.isEmpty()) {
            // WebView yüklendikten sonra navigasyonu gerçekleştir
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                // Biraz bekle - WebView'un hazır olduğundan emin ol
                webView.postDelayed(() -> {
                    String script = "if (window.location.pathname !== '" + navigateTo + "') { window.location.href = '" + navigateTo + "'; }";
                    webView.evaluateJavascript(script, (result) -> {
                        Log.d(TAG, "📍 Navigation script executed - result: " + result);
                    });
                }, 500);
                
                Log.d(TAG, "📍 Navigation to: " + navigateTo);
            }
        }
    }
}
