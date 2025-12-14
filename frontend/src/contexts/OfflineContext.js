/**
 * OfflineContext - Offline mod yönetimi
 * Network durumunu izler ve otomatik senkronizasyon yapar
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import NativeBridge from '../native';
import OfflineStorage from '../services/OfflineStorage';
import api from '../api';
import { toast } from 'sonner';

const OfflineContext = createContext(null);

export const OfflineProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);
  
  const syncIntervalRef = useRef(null);
  const wasOfflineRef = useRef(false);
  
  // Pending item sayısını güncelle
  const updatePendingCount = useCallback(async () => {
    try {
      const [forms, locations, queue] = await Promise.all([
        OfflineStorage.getPendingForms(),
        OfflineStorage.getPendingLocations(),
        OfflineStorage.getSyncQueue()
      ]);
      
      const total = forms.length + locations.length + queue.length;
      setPendingCount(total);
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
      // Sync queue'daki öğeleri işle
      const queue = await OfflineStorage.getSyncQueue();
      let successCount = 0;
      let failCount = 0;
      
      for (const item of queue) {
        if (item.status === 'pending' || (item.status === 'failed' && item.retryCount < 3)) {
          try {
            const method = item.action.toLowerCase();
            if (api[method]) {
              await api[method](item.endpoint, item.data);
              await OfflineStorage.removeSyncItem(item.id);
              successCount++;
            }
          } catch (error) {
            await OfflineStorage.updateSyncItem(item.id, 'failed', error.message);
            failCount++;
          }
        }
      }
      
      // Pending formları işle
      const forms = await OfflineStorage.getPendingForms();
      for (const form of forms) {
        if (form.status === 'pending' || (form.status === 'failed' && form.retryCount < 3)) {
          try {
            let endpoint = '/forms';
            if (form.caseId) {
              endpoint = `/cases/${form.caseId}/forms`;
            }
            
            await api.post(endpoint, form.data);
            await OfflineStorage.removePendingForm(form.id);
            successCount++;
          } catch (error) {
            await OfflineStorage.updatePendingFormStatus(form.id, 'failed', error.message);
            failCount++;
          }
        }
      }
      
      // Pending locations işle
      const locations = await OfflineStorage.getPendingLocations();
      if (locations.length > 0) {
        try {
          await api.post('/locations/batch', { locations });
          for (const loc of locations) {
            await OfflineStorage.removePendingLocation(loc.id);
          }
          successCount += locations.length;
        } catch (error) {
          failCount += locations.length;
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
      }
      
      return true;
    } catch (error) {
      console.error('[Offline] Sync error:', error);
      setSyncError(error.message);
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
    if (isOnline) {
      // İlk yüklemeden sonra cache'le
      const timer = setTimeout(cacheReferenceData, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, cacheReferenceData]);
  
  const value = {
    // State
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    syncError,
    
    // Actions
    syncNow,
    saveFormOffline,
    queueRequest,
    cacheReferenceData,
    getCachedMedications,
    getCachedHospitals,
    cacheCase,
    getCachedCase,
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

