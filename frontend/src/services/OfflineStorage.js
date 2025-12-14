/**
 * OfflineStorage - IndexedDB tabanlı offline veri depolama
 * Form verileri, vakalar ve diğer kritik verilerin offline saklanması
 */

const DB_NAME = 'healmedy_offline_db';
const DB_VERSION = 1;

// Store tanımları
const STORES = {
  PENDING_FORMS: 'pending_forms',      // Gönderilmemiş formlar
  PENDING_LOCATIONS: 'pending_locations', // Gönderilmemiş GPS verileri
  CACHED_CASES: 'cached_cases',        // Cache'lenmiş vakalar
  CACHED_MEDICATIONS: 'cached_medications', // İlaç listesi cache
  CACHED_HOSPITALS: 'cached_hospitals',    // Hastane listesi cache
  SYNC_QUEUE: 'sync_queue',            // Senkronizasyon kuyruğu
  USER_DATA: 'user_data'               // Kullanıcı verileri
};

let db = null;

/**
 * IndexedDB'yi başlat
 */
const initDB = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('[OfflineStorage] Database error:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      db = event.target.result;
      console.log('[OfflineStorage] Database opened successfully');
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Pending Forms Store
      if (!database.objectStoreNames.contains(STORES.PENDING_FORMS)) {
        const formsStore = database.createObjectStore(STORES.PENDING_FORMS, { keyPath: 'id' });
        formsStore.createIndex('type', 'type', { unique: false });
        formsStore.createIndex('createdAt', 'createdAt', { unique: false });
        formsStore.createIndex('status', 'status', { unique: false });
      }
      
      // Pending Locations Store
      if (!database.objectStoreNames.contains(STORES.PENDING_LOCATIONS)) {
        const locationsStore = database.createObjectStore(STORES.PENDING_LOCATIONS, { keyPath: 'id' });
        locationsStore.createIndex('timestamp', 'timestamp', { unique: false });
        locationsStore.createIndex('vehicleId', 'vehicleId', { unique: false });
      }
      
      // Cached Cases Store
      if (!database.objectStoreNames.contains(STORES.CACHED_CASES)) {
        const casesStore = database.createObjectStore(STORES.CACHED_CASES, { keyPath: 'id' });
        casesStore.createIndex('status', 'status', { unique: false });
        casesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      
      // Cached Medications Store
      if (!database.objectStoreNames.contains(STORES.CACHED_MEDICATIONS)) {
        database.createObjectStore(STORES.CACHED_MEDICATIONS, { keyPath: 'id' });
      }
      
      // Cached Hospitals Store
      if (!database.objectStoreNames.contains(STORES.CACHED_HOSPITALS)) {
        database.createObjectStore(STORES.CACHED_HOSPITALS, { keyPath: 'id' });
      }
      
      // Sync Queue Store
      if (!database.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = database.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
        syncStore.createIndex('priority', 'priority', { unique: false });
        syncStore.createIndex('status', 'status', { unique: false });
        syncStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      
      // User Data Store
      if (!database.objectStoreNames.contains(STORES.USER_DATA)) {
        database.createObjectStore(STORES.USER_DATA, { keyPath: 'key' });
      }
      
      console.log('[OfflineStorage] Database schema created');
    };
  });
};

/**
 * Store'a veri ekle
 */
const add = async (storeName, data) => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    const request = store.add({
      ...data,
      id: data.id || `${storeName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Store'daki veriyi güncelle
 */
const put = async (storeName, data) => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    const request = store.put(data);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * ID ile veri getir
 */
const get = async (storeName, id) => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Tüm verileri getir
 */
const getAll = async (storeName) => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Index ile veri getir
 */
const getByIndex = async (storeName, indexName, value) => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    
    const request = index.getAll(value);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Veri sil
 */
const remove = async (storeName, id) => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    const request = store.delete(id);
    
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Store'u temizle
 */
const clear = async (storeName) => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    const request = store.clear();
    
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

// ==================== PENDING FORMS ====================

const savePendingForm = async (formType, formData, caseId = null) => {
  return add(STORES.PENDING_FORMS, {
    type: formType,
    caseId,
    data: formData,
    status: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
};

const getPendingForms = async () => {
  return getAll(STORES.PENDING_FORMS);
};

const getPendingFormsByType = async (formType) => {
  return getByIndex(STORES.PENDING_FORMS, 'type', formType);
};

const updatePendingFormStatus = async (id, status, error = null) => {
  const form = await get(STORES.PENDING_FORMS, id);
  if (form) {
    form.status = status;
    form.error = error;
    form.updatedAt = new Date().toISOString();
    if (status === 'failed') {
      form.retryCount = (form.retryCount || 0) + 1;
    }
    return put(STORES.PENDING_FORMS, form);
  }
};

const removePendingForm = async (id) => {
  return remove(STORES.PENDING_FORMS, id);
};

// ==================== PENDING LOCATIONS ====================

const savePendingLocation = async (locationData) => {
  return add(STORES.PENDING_LOCATIONS, {
    ...locationData,
    timestamp: new Date().toISOString(),
    synced: false
  });
};

const getPendingLocations = async () => {
  return getAll(STORES.PENDING_LOCATIONS);
};

const removePendingLocation = async (id) => {
  return remove(STORES.PENDING_LOCATIONS, id);
};

const clearSyncedLocations = async () => {
  const locations = await getAll(STORES.PENDING_LOCATIONS);
  const syncedIds = locations.filter(l => l.synced).map(l => l.id);
  
  for (const id of syncedIds) {
    await remove(STORES.PENDING_LOCATIONS, id);
  }
};

// ==================== CACHED CASES ====================

const cacheCase = async (caseData) => {
  return put(STORES.CACHED_CASES, {
    ...caseData,
    cachedAt: new Date().toISOString()
  });
};

const getCachedCase = async (id) => {
  return get(STORES.CACHED_CASES, id);
};

const getCachedCases = async () => {
  return getAll(STORES.CACHED_CASES);
};

const removeCachedCase = async (id) => {
  return remove(STORES.CACHED_CASES, id);
};

// ==================== REFERENCE DATA CACHE ====================

const cacheMedications = async (medications) => {
  await clear(STORES.CACHED_MEDICATIONS);
  for (const med of medications) {
    await add(STORES.CACHED_MEDICATIONS, med);
  }
};

const getCachedMedications = async () => {
  return getAll(STORES.CACHED_MEDICATIONS);
};

const cacheHospitals = async (hospitals) => {
  await clear(STORES.CACHED_HOSPITALS);
  for (const hospital of hospitals) {
    await add(STORES.CACHED_HOSPITALS, hospital);
  }
};

const getCachedHospitals = async () => {
  return getAll(STORES.CACHED_HOSPITALS);
};

// ==================== SYNC QUEUE ====================

const addToSyncQueue = async (action, endpoint, data, priority = 5) => {
  return add(STORES.SYNC_QUEUE, {
    action,      // 'POST', 'PUT', 'PATCH', 'DELETE'
    endpoint,
    data,
    priority,    // 1-10, 1 en yüksek öncelik
    status: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString()
  });
};

const getSyncQueue = async () => {
  const items = await getAll(STORES.SYNC_QUEUE);
  return items.sort((a, b) => a.priority - b.priority);
};

const updateSyncItem = async (id, status, error = null) => {
  const item = await get(STORES.SYNC_QUEUE, id);
  if (item) {
    item.status = status;
    item.error = error;
    item.lastAttempt = new Date().toISOString();
    if (status === 'failed') {
      item.retryCount = (item.retryCount || 0) + 1;
    }
    return put(STORES.SYNC_QUEUE, item);
  }
};

const removeSyncItem = async (id) => {
  return remove(STORES.SYNC_QUEUE, id);
};

// ==================== USER DATA ====================

const setUserData = async (key, value) => {
  return put(STORES.USER_DATA, { key, value, updatedAt: new Date().toISOString() });
};

const getUserData = async (key) => {
  const data = await get(STORES.USER_DATA, key);
  return data?.value || null;
};

// ==================== SYNC MANAGER ====================

let isSyncing = false;

const syncPendingData = async (api) => {
  if (isSyncing) {
    console.log('[OfflineStorage] Sync already in progress');
    return;
  }
  
  isSyncing = true;
  console.log('[OfflineStorage] Starting sync...');
  
  try {
    // 1. Sync queue'daki öğeleri işle
    const queue = await getSyncQueue();
    for (const item of queue) {
      if (item.status === 'pending' || (item.status === 'failed' && item.retryCount < 3)) {
        try {
          await api[item.action.toLowerCase()](item.endpoint, item.data);
          await removeSyncItem(item.id);
          console.log(`[OfflineStorage] Synced: ${item.action} ${item.endpoint}`);
        } catch (error) {
          await updateSyncItem(item.id, 'failed', error.message);
          console.error(`[OfflineStorage] Sync failed: ${item.action} ${item.endpoint}`, error);
        }
      }
    }
    
    // 2. Pending formları işle
    const pendingForms = await getPendingForms();
    for (const form of pendingForms) {
      if (form.status === 'pending' || (form.status === 'failed' && form.retryCount < 3)) {
        try {
          // Form tipine göre endpoint belirle
          let endpoint = '/forms';
          if (form.caseId) {
            endpoint = `/cases/${form.caseId}/forms`;
          }
          
          await api.post(endpoint, form.data);
          await removePendingForm(form.id);
          console.log(`[OfflineStorage] Form synced: ${form.type}`);
        } catch (error) {
          await updatePendingFormStatus(form.id, 'failed', error.message);
          console.error(`[OfflineStorage] Form sync failed: ${form.type}`, error);
        }
      }
    }
    
    // 3. Pending locations'ları işle
    const pendingLocations = await getPendingLocations();
    if (pendingLocations.length > 0) {
      try {
        // Batch olarak gönder
        await api.post('/locations/batch', { locations: pendingLocations });
        
        for (const loc of pendingLocations) {
          await removePendingLocation(loc.id);
        }
        console.log(`[OfflineStorage] Locations synced: ${pendingLocations.length} items`);
      } catch (error) {
        console.error('[OfflineStorage] Locations sync failed:', error);
      }
    }
    
    console.log('[OfflineStorage] Sync completed');
  } catch (error) {
    console.error('[OfflineStorage] Sync error:', error);
  } finally {
    isSyncing = false;
  }
};

// ==================== EXPORT ====================

const OfflineStorage = {
  // Core
  initDB,
  STORES,
  
  // Generic operations
  add,
  put,
  get,
  getAll,
  getByIndex,
  remove,
  clear,
  
  // Pending Forms
  savePendingForm,
  getPendingForms,
  getPendingFormsByType,
  updatePendingFormStatus,
  removePendingForm,
  
  // Pending Locations
  savePendingLocation,
  getPendingLocations,
  removePendingLocation,
  clearSyncedLocations,
  
  // Cached Cases
  cacheCase,
  getCachedCase,
  getCachedCases,
  removeCachedCase,
  
  // Reference Data
  cacheMedications,
  getCachedMedications,
  cacheHospitals,
  getCachedHospitals,
  
  // Sync Queue
  addToSyncQueue,
  getSyncQueue,
  updateSyncItem,
  removeSyncItem,
  
  // User Data
  setUserData,
  getUserData,
  
  // Sync Manager
  syncPendingData
};

export default OfflineStorage;


