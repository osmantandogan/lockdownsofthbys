package com.healmedy.ambulans;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.healmedy.ambulans.services.HealmedyFirebaseMessagingService;

/**
 * Tam ekran acil durum popup'ı
 * Vaka atandığında ekranda gösterilir
 */
public class EmergencyPopupActivity extends AppCompatActivity {
    
    private static final String TAG = "EmergencyPopup";
    
    private String caseId;
    private String caseNumber;
    private String patientName;
    private String patientPhone;
    private String patientComplaint;
    private String address;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Log.d(TAG, "🚨 EmergencyPopupActivity created");
        
        // Ekranı aç ve kilit ekranının üstünde göster
        setupWindowFlags();
        
        // Intent'ten verileri al
        Intent intent = getIntent();
        caseId = intent.getStringExtra("case_id");
        caseNumber = intent.getStringExtra("case_number");
        patientName = intent.getStringExtra("patient_name");
        patientPhone = intent.getStringExtra("patient_phone");
        patientComplaint = intent.getStringExtra("patient_complaint");
        address = intent.getStringExtra("address");
        
        Log.d(TAG, "Case: " + caseNumber + ", Patient: " + patientName);
        
        // UI oluştur
        createUI();
    }
    
    private void setupWindowFlags() {
        // Ekranı aç ve kilit ekranının üstünde göster
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (keyguardManager != null) {
                keyguardManager.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }
        
        // Tam ekran
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        );
    }
    
    private void createUI() {
        // Ana layout
        LinearLayout mainLayout = new LinearLayout(this);
        mainLayout.setOrientation(LinearLayout.VERTICAL);
        mainLayout.setBackgroundColor(0xFFDC2626); // Kırmızı arka plan
        mainLayout.setPadding(48, 100, 48, 48);
        mainLayout.setGravity(android.view.Gravity.CENTER);
        
        // Tüm ekrana tıklayınca sesi durdur
        mainLayout.setOnClickListener(v -> {
            Log.d(TAG, "🛑 Screen tapped - stopping alarm");
            HealmedyFirebaseMessagingService.stopEmergencyAlarm();
        });
        
        // 🚨 ACİL DURUM başlığı
        TextView emergencyTitle = new TextView(this);
        emergencyTitle.setText("🚨 ACİL DURUM 🚨");
        emergencyTitle.setTextColor(0xFFFFFFFF);
        emergencyTitle.setTextSize(32);
        emergencyTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        emergencyTitle.setGravity(android.view.Gravity.CENTER);
        mainLayout.addView(emergencyTitle);
        
        addSpacer(mainLayout, 40);
        
        // Vaka Numarası
        addInfoRow(mainLayout, "VAKA NO", caseNumber != null ? caseNumber : "-");
        addSpacer(mainLayout, 24);
        
        // Hasta Adı
        addInfoRow(mainLayout, "HASTA", patientName != null ? patientName : "-");
        addSpacer(mainLayout, 24);
        
        // Telefon
        addInfoRow(mainLayout, "TELEFON", patientPhone != null ? patientPhone : "-");
        addSpacer(mainLayout, 24);
        
        // Şikayet
        addInfoRow(mainLayout, "ŞİKAYET", patientComplaint != null ? patientComplaint : "-");
        addSpacer(mainLayout, 24);
        
        // Adres
        addInfoRow(mainLayout, "ADRES", address != null ? address : "-");
        
        addSpacer(mainLayout, 60);
        
        // Butonlar layout
        LinearLayout buttonLayout = new LinearLayout(this);
        buttonLayout.setOrientation(LinearLayout.HORIZONTAL);
        buttonLayout.setGravity(android.view.Gravity.CENTER);
        
        // VAKAYA GİT butonu
        Button goToCase = new Button(this);
        goToCase.setText("✓ VAKAYA GİT");
        goToCase.setTextColor(0xFFFFFFFF);
        goToCase.setBackgroundColor(0xFF16A34A); // Yeşil
        goToCase.setTextSize(18);
        goToCase.setPadding(48, 32, 48, 32);
        goToCase.setOnClickListener(v -> {
            Log.d(TAG, "✅ Go to case clicked");
            HealmedyFirebaseMessagingService.stopEmergencyAlarm();
            openCase();
        });
        buttonLayout.addView(goToCase);
        
        // Boşluk
        View spacer = new View(this);
        LinearLayout.LayoutParams spacerParams = new LinearLayout.LayoutParams(32, 1);
        spacer.setLayoutParams(spacerParams);
        buttonLayout.addView(spacer);
        
        // MAZERET BİLDİR butonu
        Button excuse = new Button(this);
        excuse.setText("⚠ MAZERET BİLDİR");
        excuse.setTextColor(0xFFFFFFFF);
        excuse.setBackgroundColor(0xFFF97316); // Turuncu
        excuse.setTextSize(18);
        excuse.setPadding(48, 32, 48, 32);
        excuse.setOnClickListener(v -> {
            Log.d(TAG, "⚠️ Excuse clicked");
            HealmedyFirebaseMessagingService.stopEmergencyAlarm();
            showExcuseDialog();
        });
        buttonLayout.addView(excuse);
        
        mainLayout.addView(buttonLayout);
        
        addSpacer(mainLayout, 40);
        
        // Alt bilgi
        TextView tapInfo = new TextView(this);
        tapInfo.setText("Ekrana dokunarak sesi kapatabilirsiniz");
        tapInfo.setTextColor(0xAAFFFFFF);
        tapInfo.setTextSize(14);
        tapInfo.setGravity(android.view.Gravity.CENTER);
        mainLayout.addView(tapInfo);
        
        setContentView(mainLayout);
    }
    
    private void addInfoRow(LinearLayout parent, String label, String value) {
        // Label
        TextView labelView = new TextView(this);
        labelView.setText(label);
        labelView.setTextColor(0xAAFFFFFF);
        labelView.setTextSize(14);
        parent.addView(labelView);
        
        // Value
        TextView valueView = new TextView(this);
        valueView.setText(value);
        valueView.setTextColor(0xFFFFFFFF);
        valueView.setTextSize(20);
        valueView.setTypeface(null, android.graphics.Typeface.BOLD);
        parent.addView(valueView);
    }
    
    private void addSpacer(LinearLayout parent, int height) {
        View spacer = new View(this);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, height);
        spacer.setLayoutParams(params);
        parent.addView(spacer);
    }
    
    private void openCase() {
        // MainActivity'e dön ve vakayı aç
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        if (caseId != null) {
            intent.putExtra("case_id", caseId);
            intent.putExtra("navigate_to", "/dashboard/cases/" + caseId);
        }
        startActivity(intent);
        finish();
    }
    
    private void showExcuseDialog() {
        // TODO: Mazeret dialog'u göster
        // Şimdilik sadece kapat
        android.widget.Toast.makeText(this, "Mazeret bildirim özelliği yakında eklenecek", android.widget.Toast.LENGTH_SHORT).show();
        finish();
    }
    
    @Override
    public void onBackPressed() {
        // Geri tuşunu devre dışı bırak
        // Kullanıcı mutlaka bir buton seçmeli
    }
}



