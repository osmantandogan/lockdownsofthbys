/**
 * useOfflineForm - Offline form yönetimi hook'u
 * Formları offline kaydeder ve online olunca otomatik gönderir
 */

import { useState, useCallback, useEffect } from 'react';
import { useOffline } from '../contexts/OfflineContext';
import { toast } from 'sonner';

const useOfflineForm = (formType, options = {}) => {
  const {
    apiEndpoint = '/forms',
    caseId = null,
    onSuccess = null,
    onError = null,
    autoSave = true,
    autoSaveInterval = 30000 // 30 saniye
  } = options;
  
  const { isOnline, saveFormOffline, queueRequest } = useOffline();
  
  const [formData, setFormData] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavedOffline, setIsSavedOffline] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);
  
  // Form verisi güncelle
  const updateFormData = useCallback((updates) => {
    setFormData(prev => {
      const newData = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
      setIsDirty(true);
      return newData;
    });
  }, []);
  
  // Formu sıfırla
  const resetForm = useCallback(() => {
    setFormData({});
    setIsDirty(false);
    setIsSavedOffline(false);
    setLastSaved(null);
    setError(null);
  }, []);
  
  // Offline kaydet
  const saveOffline = useCallback(async () => {
    if (!isDirty) return true;
    
    try {
      await saveFormOffline(formType, formData, caseId);
      setIsSavedOffline(true);
      setIsDirty(false);
      setLastSaved(new Date());
      
      if (!isOnline) {
        toast.info('Form çevrimdışı kaydedildi');
      }
      
      return true;
    } catch (err) {
      setError('Offline kaydetme başarısız');
      return false;
    }
  }, [formType, formData, caseId, isDirty, isOnline, saveFormOffline]);
  
  // Form gönder (online veya offline)
  const submitForm = useCallback(async (api) => {
    setIsSaving(true);
    setError(null);
    
    try {
      if (isOnline) {
        // Online - doğrudan API'ye gönder
        let endpoint = apiEndpoint;
        if (caseId) {
          endpoint = `/cases/${caseId}/forms`;
        }
        
        const response = await api.post(endpoint, {
          type: formType,
          data: formData,
          submitted_at: new Date().toISOString()
        });
        
        setIsDirty(false);
        setIsSavedOffline(false);
        setLastSaved(new Date());
        
        toast.success('Form başarıyla gönderildi');
        onSuccess?.(response.data);
        
        return { success: true, data: response.data };
      } else {
        // Offline - kuyruğa ekle ve yerel kaydet
        await queueRequest('POST', apiEndpoint, {
          type: formType,
          data: formData,
          submitted_at: new Date().toISOString(),
          case_id: caseId
        }, 3); // Yüksek öncelik
        
        await saveFormOffline(formType, formData, caseId);
        
        setIsDirty(false);
        setIsSavedOffline(true);
        setLastSaved(new Date());
        
        toast.info('Form çevrimdışı kaydedildi. İnternet bağlantısı sağlandığında gönderilecek.');
        
        return { success: true, offline: true };
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Form gönderilemedi';
      setError(errorMessage);
      toast.error(errorMessage);
      onError?.(err);
      
      // Hata durumunda offline kaydet
      if (isOnline) {
        await saveFormOffline(formType, formData, caseId);
        toast.info('Form yerel olarak kaydedildi');
      }
      
      return { success: false, error: errorMessage };
    } finally {
      setIsSaving(false);
    }
  }, [formType, formData, caseId, apiEndpoint, isOnline, queueRequest, saveFormOffline, onSuccess, onError]);
  
  // Otomatik kaydetme
  useEffect(() => {
    if (!autoSave || !isDirty) return;
    
    const timer = setTimeout(() => {
      if (isDirty) {
        saveOffline();
      }
    }, autoSaveInterval);
    
    return () => clearTimeout(timer);
  }, [autoSave, autoSaveInterval, isDirty, saveOffline]);
  
  // Sayfa kapanmadan önce kaydet
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        // Senkron olarak kaydedemeyiz, ama uyarı gösterebiliriz
        e.preventDefault();
        e.returnValue = 'Kaydedilmemiş değişiklikler var. Sayfadan ayrılmak istediğinize emin misiniz?';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
  
  return {
    // State
    formData,
    isDirty,
    isSaving,
    isSavedOffline,
    lastSaved,
    error,
    isOnline,
    
    // Actions
    updateFormData,
    setFormData,
    resetForm,
    saveOffline,
    submitForm
  };
};

export default useOfflineForm;




