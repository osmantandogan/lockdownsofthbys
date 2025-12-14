/**
 * useBiometricAuth - Biyometrik ve PIN kimlik doğrulama
 * Parmak izi, yüz tanıma veya PIN ile güvenli giriş
 */

import { useState, useCallback, useEffect } from 'react';
import NativeBridge from '../native';

const BIOMETRIC_KEY = 'healmedy_biometric_enabled';
const PIN_KEY = 'healmedy_pin_hash';

const useBiometricAuth = () => {
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isPinEnabled, setIsPinEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState(null); // 'fingerprint', 'face', 'iris'
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);
  
  // Biyometrik desteği kontrol et
  const checkBiometricSupport = useCallback(async () => {
    // Web Credential API kontrolü
    if (window.PublicKeyCredential) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setIsBiometricAvailable(available);
        if (available) {
          setBiometricType('platform');
        }
      } catch (e) {
        console.log('[BiometricAuth] WebAuthn not supported:', e);
        setIsBiometricAvailable(false);
      }
    } else {
      setIsBiometricAvailable(false);
    }
    
    // Kayıtlı durumu kontrol et
    const biometricEnabled = await NativeBridge.getItem(BIOMETRIC_KEY);
    setIsBiometricEnabled(biometricEnabled === true);
    
    const pinHash = await NativeBridge.getItem(PIN_KEY);
    setIsPinEnabled(!!pinHash);
  }, []);
  
  useEffect(() => {
    checkBiometricSupport();
  }, [checkBiometricSupport]);
  
  // PIN hash'le
  const hashPin = async (pin) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + 'healmedy_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };
  
  // PIN ayarla
  const setPin = useCallback(async (pin) => {
    if (!pin || pin.length < 4) {
      setError('PIN en az 4 karakter olmalıdır');
      return false;
    }
    
    try {
      const hashedPin = await hashPin(pin);
      await NativeBridge.setItem(PIN_KEY, hashedPin);
      setIsPinEnabled(true);
      setError(null);
      return true;
    } catch (e) {
      setError('PIN kaydedilemedi');
      return false;
    }
  }, []);
  
  // PIN doğrula
  const verifyPin = useCallback(async (pin) => {
    try {
      const storedHash = await NativeBridge.getItem(PIN_KEY);
      if (!storedHash) {
        setError('PIN ayarlanmamış');
        return false;
      }
      
      const inputHash = await hashPin(pin);
      const isValid = inputHash === storedHash;
      
      if (isValid) {
        setIsAuthenticated(true);
        setError(null);
      } else {
        setError('Yanlış PIN');
      }
      
      return isValid;
    } catch (e) {
      setError('PIN doğrulanamadı');
      return false;
    }
  }, []);
  
  // PIN kaldır
  const removePin = useCallback(async () => {
    await NativeBridge.removeItem(PIN_KEY);
    setIsPinEnabled(false);
  }, []);
  
  // Biyometrik etkinleştir
  const enableBiometric = useCallback(async () => {
    if (!isBiometricAvailable) {
      setError('Biyometrik doğrulama bu cihazda desteklenmiyor');
      return false;
    }
    
    try {
      // WebAuthn ile kayıt
      if (window.PublicKeyCredential) {
        // Bu basit bir implementasyon - gerçek uygulamada server-side challenge gerekir
        await NativeBridge.setItem(BIOMETRIC_KEY, true);
        setIsBiometricEnabled(true);
        setError(null);
        return true;
      }
      
      setError('Biyometrik kayıt başarısız');
      return false;
    } catch (e) {
      setError('Biyometrik etkinleştirilemedi: ' + e.message);
      return false;
    }
  }, [isBiometricAvailable]);
  
  // Biyometrik devre dışı bırak
  const disableBiometric = useCallback(async () => {
    await NativeBridge.removeItem(BIOMETRIC_KEY);
    setIsBiometricEnabled(false);
  }, []);
  
  // Biyometrik ile doğrula
  const authenticateWithBiometric = useCallback(async () => {
    if (!isBiometricAvailable || !isBiometricEnabled) {
      setError('Biyometrik doğrulama kullanılamıyor');
      return false;
    }
    
    try {
      // WebAuthn platformAuthenticator kullan
      // Not: Bu basitleştirilmiş bir implementasyon
      // Gerçek uygulamada server-side challenge ve credential management gerekir
      
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32), // Server'dan gelmeli
          timeout: 60000,
          userVerification: 'required',
          rpId: window.location.hostname
        }
      });
      
      if (credential) {
        setIsAuthenticated(true);
        setError(null);
        return true;
      }
      
      return false;
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        setError('Biyometrik doğrulama iptal edildi');
      } else {
        setError('Biyometrik doğrulama başarısız');
      }
      return false;
    }
  }, [isBiometricAvailable, isBiometricEnabled]);
  
  // Oturumu kilitle
  const lock = useCallback(() => {
    setIsAuthenticated(false);
  }, []);
  
  // Oturumu aç (PIN veya Biyometrik ile)
  const unlock = useCallback(async (method, credential = null) => {
    if (method === 'biometric') {
      return authenticateWithBiometric();
    } else if (method === 'pin' && credential) {
      return verifyPin(credential);
    }
    return false;
  }, [authenticateWithBiometric, verifyPin]);
  
  return {
    // State
    isBiometricAvailable,
    isBiometricEnabled,
    isPinEnabled,
    biometricType,
    isAuthenticated,
    error,
    
    // Actions
    checkBiometricSupport,
    enableBiometric,
    disableBiometric,
    authenticateWithBiometric,
    setPin,
    verifyPin,
    removePin,
    lock,
    unlock
  };
};

export default useBiometricAuth;

