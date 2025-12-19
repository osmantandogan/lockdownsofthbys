/**
 * OfflineContext - Offline mod yönetimi
 * Network durumunu izler ve otomatik senkronizasyon yapar
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import NativeBridge from '../native';
import OfflineStorage from '../services/OfflineStorage';
import ReferenceDataCache from '../services/ReferenceDataCache';
import api from '../api';
import { toast } from 'sonner';

const OfflineContext = createContext(null);

export const OfflineProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [cacheReady, setCacheReady] = useState(false);
  
  const syncIntervalRef = useRef(null);
  const wasOfflineRef = useRef(false);
  const initRef = useRef(false);
  
  // Pending item sayısını güncelle
  const updatePendingCount = useCallback(async () => {
    try {
      const [forms, locations, queue, pendingCases] = await Promise.all([
        OfflineStorage.getPendingForms(),
        OfflineStorage.getPendingLocations(),
        OfflineStorage.getSyncQueue(),
        OfflineStorage.getPendingCases()
      ]);
      
      const total = forms.length + locations.length + queue.length + pendingCases.length;
      setPendingCount(total);
      
      console.log(`[Offline] Pending counts - Forms: ${forms.length}, Locations: ${locations.length}, Queue: ${queue.length}, Cases: ${pendingCases.length}, Total: ${total}`);
      
      return total;
    } catch (error) {
      console.error('[Offline] Failed to count pending items:', error);
      return 0;
    }
  }, []);
  
  // Senkronizasyon yap
  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline) {
      console.log('[Offline] Sync skipped:', isSyncing ? 'already syncing' : 'offline');
      return false;
    }
    
    setIsSyncing(true);
    setSyncError(null);
    
    console.log('[Offline] Starting sync...');
    
    try {
      let successCount = 0;
      let failCount = 0;
      
      // 1. Pending CASES işle (en önce vakalar)
      const pendingCases = await OfflineStorage.getPendingCases();
      console.log(`[Offline] Syncing ${pendingCases.length} pending cases...`);
      
      for (const pendingCase of pendingCases) {
        if (pendingCase.status === 'pending' || (pendingCase.status === 'failed' && (pendingCase.retryCount || 0) < 3)) {
          try {
            console.log('[Offline] Syncing case:', pendingCase.id);
            
            // Vaka oluştur - offline id'yi çıkar
            const caseData = { ...pendingCase };
            delete caseData.id;
            delete caseData.status;
            delete caseData.createdAt;
            delete caseData.isOffline;
            delete caseData.retryCount;
            
            const response = await api.post('/cases', caseData);
            console.log('[Offline] Case synced successfully:', response.data?.id || response.data?._id);
            
            await OfflineStorage.removePendingCase(pendingCase.id);
            successCount++;
            
            toast.success(`Çevrimdışı vaka senkronize edildi: ${response.data?.case_number || 'Yeni Vaka'}`);
          } catch (error) {
            console.error('[Offline] Failed to sync case:', error);
            
            // Retry count güncelle
            await OfflineStorage.put(OfflineStorage.STORES.PENDING_CASES, {
              ...pendingCase,
              status: 'failed',
              retryCount: (pendingCase.retryCount || 0) + 1,
              lastError: error.response?.data?.detail || error.message
            });
            
            failCount++;
            toast.error(`Vaka senkronize edilemedi: ${error.response?.data?.detail || error.message}`);
          }
        }
      }
      
      // 2. Sync queue'daki öğeleri işle
      const queue = await OfflineStorage.getSyncQueue();
      console.log(`[Offline] Syncing ${queue.length} queue items...`);
      
      for (const item of queue) {
        if (item.status === 'pending' || (item.status === 'failed' && item.retryCount < 3)) {
          try {
            const method = item.action.toLowerCase();
            console.log(`[Offline] Queue item: ${method} ${item.endpoint}`);
            
            // API method'unu doğru şekilde çağır
            if (method === 'post') {
              await api.post(item.endpoint, item.data);
            } else if (method === 'put') {
              await api.put(item.endpoint, item.data);
            } else if (method === 'patch') {
              await api.patch(item.endpoint, item.data);
            } else if (method === 'delete') {
              await api.delete(item.endpoint);
            } else if (method === 'get') {
              await api.get(item.endpoint);
            }
            
            await OfflineStorage.removeSyncItem(item.id);
            successCount++;
          } catch (error) {
            console.error('[Offline] Queue sync failed:', error);
            await OfflineStorage.updateSyncItem(item.id, 'failed', error.response?.data?.detail || error.message);
            failCount++;
          }
        }
      }
      
      // 3. Pending formları işle
      const forms = await OfflineStorage.getPendingForms();
      console.log(`[Offline] Syncing ${forms.length} pending forms...`);
      
      for (const form of forms) {
        if (form.status === 'pending' || (form.status === 'failed' && form.retryCount < 3)) {
          try {
            let endpoint = '/forms';
            if (form.caseId) {
              endpoint = `/cases/${form.caseId}/forms`;
            }
            
            console.log(`[Offline] Syncing form: ${form.type} to ${endpoint}`);
            
            await api.post(endpoint, {
              type: form.type,
              data: form.data,
              submitted_at: form.createdAt
            });
            
            await OfflineStorage.removePendingForm(form.id);
            successCount++;
          } catch (error) {
            console.error('[Offline] Form sync failed:', error);
            await OfflineStorage.updatePendingFormStatus(form.id, 'failed', error.response?.data?.detail || error.message);
            failCount++;
          }
        }
      }
      
      // 4. Pending locations işle
      const locations = await OfflineStorage.getPendingLocations();
      if (locations.length > 0) {
        console.log(`[Offline] Syncing ${locations.length} pending locations...`);
        
        // Lokasyonları tek tek gönder (batch endpoint yoksa)
        for (const loc of locations) {
          try {
            if (loc.vehicleId) {
              await api.put(`/vehicles/${loc.vehicleId}/gps`, {
                latitude: loc.latitude,
                longitude: loc.longitude,
                accuracy: loc.accuracy,
                timestamp: loc.timestamp
              });
            }
            await OfflineStorage.removePendingLocation(loc.id);
            successCount++;
          } catch (error) {
            console.warn('[Offline] Location sync failed:', error);
            failCount++;
          }
        }
      }
      
      setLastSyncTime(new Date());
      await updatePendingCount();
      
      if (successCount > 0) {
        console.log(`[Offline] Sync complete: ${successCount} items synced`);
        if (wasOfflineRef.current) {
          toast.success(`${successCount} veri senkronize edildi`);
          wasOfflineRef.current = false;
        }
      }
      
      if (failCount > 0) {
        console.warn(`[Offline] Sync incomplete: ${failCount} items failed`);
        toast.warning(`${failCount} veri senkronize edilemedi, tekrar denenecek`);
      }
      
      return true;
    } catch (error) {
      console.error('[Offline] Sync error:', error);
      setSyncError(error.message);
      toast.error('Senkronizasyon hatası: ' + error.message);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, updatePendingCount]);
  
  // Form verisi kaydet (offline için)
  const saveFormOffline = useCallback(async (formType, formData, caseId = null) => {
    try {
      await OfflineStorage.savePendingForm(formType, formData, caseId);
      await updatePendingCount();
      
      if (!isOnline) {
        toast.info('Form çevrimdışı kaydedildi. İnternet bağlantısı sağlandığında otomatik gönderilecek.');
      }
      
      return true;
    } catch (error) {
      console.error('[Offline] Failed to save form:', error);
      return false;
    }
  }, [isOnline, updatePendingCount]);
  
  // API isteğini offline queue'ya ekle
  const queueRequest = useCallback(async (action, endpoint, data, priority = 5) => {
    try {
      await OfflineStorage.addToSyncQueue(action, endpoint, data, priority);
      await updatePendingCount();
      return true;
    } catch (error) {
      console.error('[Offline] Failed to queue request:', error);
      return false;
    }
  }, [updatePendingCount]);
  
  // Referans veriyi cache'le
  const cacheReferenceData = useCallback(async () => {
    if (!isOnline) return;
    
    try {
      // İlaç listesi
      const medsResponse = await api.get('/medications', { params: { limit: 1000 } });
      const medsData = medsResponse.data?.data || medsResponse.data || [];
      if (medsData && medsData.length > 0) {
        await OfflineStorage.cacheMedications(medsData);
        console.log('[Offline] Medications cached:', medsData.length);
      }
      
      // Hastane listesi
      const hospitalsResponse = await api.get('/reference-data/hospitals');
      if (hospitalsResponse.data) {
        await OfflineStorage.cacheHospitals(hospitalsResponse.data);
        console.log('[Offline] Hospitals cached');
      }
    } catch (error) {
      console.warn('[Offline] Failed to cache reference data:', error);
    }
  }, [isOnline]);
  
  // Cached referans veriyi al
  const getCachedMedications = useCallback(async () => {
    return OfflineStorage.getCachedMedications();
  }, []);
  
  const getCachedHospitals = useCallback(async () => {
    return OfflineStorage.getCachedHospitals();
  }, []);
  
  // Vakayı cache'le
  const cacheCase = useCallback(async (caseData) => {
    try {
      await OfflineStorage.cacheCase(caseData);
      return true;
    } catch (error) {
      console.error('[Offline] Failed to cache case:', error);
      return false;
    }
  }, []);
  
  // Cache'den vaka al
  const getCachedCase = useCallback(async (caseId) => {
    return OfflineStorage.getCachedCase(caseId);
  }, []);
  
  // Network durumu değişikliğini izle
  useEffect(() => {
    const cleanup = NativeBridge.watchNetworkStatus((status) => {
      const wasOnline = isOnline;
      setIsOnline(status.connected);
      
      if (!wasOnline && status.connected) {
        // Offline'dan online'a geçiş
        console.log('[Offline] Back online, starting sync...');
        wasOfflineRef.current = true;
        toast.info('İnternet bağlantısı sağlandı. Veriler senkronize ediliyor...');
        syncNow();
      } else if (wasOnline && !status.connected) {
        // Online'dan offline'a geçiş
        console.log('[Offline] Gone offline');
        toast.warning('İnternet bağlantısı kesildi. Veriler yerel olarak kaydedilecek.');
      }
    });
    
    // İlk network durumunu al
    NativeBridge.getNetworkStatus().then((status) => {
      setIsOnline(status.connected);
    });
    
    // Pending count'u güncelle
    updatePendingCount();
    
    return cleanup;
  }, [syncNow, updatePendingCount, isOnline]);
  
  // Periyodik senkronizasyon (5 dakikada bir)
  useEffect(() => {
    if (isOnline) {
      syncIntervalRef.current = setInterval(() => {
        updatePendingCount().then((count) => {
          if (count > 0) {
            syncNow();
          }
        });
      }, 5 * 60 * 1000); // 5 dakika
    }
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isOnline, syncNow, updatePendingCount]);
  
  // Uygulama başladığında referans verileri cache'le
  useEffect(() => {
    if (isOnline && !initRef.current) {
      initRef.current = true;
      setIsInitializing(true);
      
      // Kritik verileri cache'le
      const initializeCache = async () => {
        console.log('[Offline] Initializing reference data cache...');
        try {
          await ReferenceDataCache.initializeCache();
          setCacheReady(true);
          console.log('[Offline] Reference data cache initialized');
        } catch (error) {
          console.error('[Offline] Cache initialization failed:', error);
        } finally {
          setIsInitializing(false);
        }
      };
      
      // 2 saniye sonra başlat (auth yüklenmesini bekle)
      const timer = setTimeout(initializeCache, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);
  
  // Pending vaka oluştur (offline)
  const createOfflineCase = useCallback(async (caseData) => {
    try {
      const id = await OfflineStorage.savePendingCase(caseData);
      await updatePendingCount();
      toast.info('Vaka çevrimdışı kaydedildi. İnternet bağlantısı sağlandığında gönderilecek.');
      return { success: true, id, offline: true };
    } catch (error) {
      console.error('[Offline] Failed to save pending case:', error);
      return { success: false, error: error.message };
    }
  }, [updatePendingCount]);
  
  // Pending vakaları getir
  const getPendingCases = useCallback(async () => {
    return OfflineStorage.getPendingCases();
  }, []);
  
  // Cache istatistikleri
  const getCacheStats = useCallback(async () => {
    return OfflineStorage.getCacheStats();
  }, []);
  
  // Cache'i yenile
  const refreshCache = useCallback(async () => {
    if (!isOnline) {
      toast.error('Cache yenilemek için internet bağlantısı gerekli');
      return false;
    }
    
    try {
      await ReferenceDataCache.initializeCache(true);
      toast.success('Referans verileri güncellendi');
      return true;
    } catch (error) {
      toast.error('Cache yenilenemedi');
      return false;
    }
  }, [isOnline]);
  
  const value = {
    // State
    isOnline,
    isSyncing,
    isInitializing,
    pendingCount,
    lastSyncTime,
    syncError,
    cacheReady,
    
    // Actions
    syncNow,
    saveFormOffline,
    queueRequest,
    cacheReferenceData,
    getCachedMedications,
    getCachedHospitals,
    cacheCase,
    getCachedCase,
    createOfflineCase,
    getPendingCases,
    getCacheStats,
    refreshCache,
    updatePendingCount
  };
  
  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

export default OfflineContext;

