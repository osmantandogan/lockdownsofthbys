/**
 * OfflineStorage - IndexedDB tabanlı offline veri depolama
 * Form verileri, vakalar, firmalar, hastalar ve diğer kritik verilerin offline saklanması
 */

const DB_NAME = 'healmedy_offline_db';
const DB_VERSION = 2; // Versiyon artırıldı - yeni store'lar eklendi

// Store tanımları
const STORES = {
  // Bekleyen veriler (sync için)
  PENDING_FORMS: 'pending_forms',
  PENDING_LOCATIONS: 'pending_locations',
  PENDING_CASES: 'pending_cases',
  SYNC_QUEUE: 'sync_queue',
  
  // Cache'lenmiş veriler
  CACHED_CASES: 'cached_cases',
  CACHED_MEDICATIONS: 'cached_medications',
  CACHED_HOSPITALS: 'cached_hospitals',
  CACHED_FIRMS: 'cached_firms',
  CACHED_PATIENTS: 'cached_patients',
  CACHED_USERS: 'cached_users',
  CACHED_VEHICLES: 'cached_vehicles',
  CACHED_LOCATIONS: 'cached_locations',
  CACHED_ICD_CODES: 'cached_icd_codes',
  CACHED_SHIFTS: 'cached_shifts',
  
  // Kullanıcı verileri
  USER_DATA: 'user_data',
  
  // Metadata
  CACHE_METADATA: 'cache_metadata'
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
      
      // Pending Cases Store (offline oluşturulan vakalar)
      if (!database.objectStoreNames.contains(STORES.PENDING_CASES)) {
        const pendingCasesStore = database.createObjectStore(STORES.PENDING_CASES, { keyPath: 'id' });
        pendingCasesStore.createIndex('createdAt', 'createdAt', { unique: false });
        pendingCasesStore.createIndex('status', 'status', { unique: false });
      }
      
      // Cached Cases Store
      if (!database.objectStoreNames.contains(STORES.CACHED_CASES)) {
        const casesStore = database.createObjectStore(STORES.CACHED_CASES, { keyPath: 'id' });
        casesStore.createIndex('status', 'status', { unique: false });
        casesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      
      // Cached Medications Store
      if (!database.objectStoreNames.contains(STORES.CACHED_MEDICATIONS)) {
        const medsStore = database.createObjectStore(STORES.CACHED_MEDICATIONS, { keyPath: 'id' });
        medsStore.createIndex('name', 'name', { unique: false });
        medsStore.createIndex('barcode', 'barcode', { unique: false });
      }
      
      // Cached Hospitals Store
      if (!database.objectStoreNames.contains(STORES.CACHED_HOSPITALS)) {
        const hospitalsStore = database.createObjectStore(STORES.CACHED_HOSPITALS, { keyPath: 'id' });
        hospitalsStore.createIndex('name', 'name', { unique: false });
        hospitalsStore.createIndex('city', 'city', { unique: false });
      }
      
      // Cached Firms Store (YENİ)
      if (!database.objectStoreNames.contains(STORES.CACHED_FIRMS)) {
        const firmsStore = database.createObjectStore(STORES.CACHED_FIRMS, { keyPath: 'id' });
        firmsStore.createIndex('name', 'name', { unique: false });
      }
      
      // Cached Patients Store (YENİ)
      if (!database.objectStoreNames.contains(STORES.CACHED_PATIENTS)) {
        const patientsStore = database.createObjectStore(STORES.CACHED_PATIENTS, { keyPath: 'id' });
        patientsStore.createIndex('tc_no', 'tc_no', { unique: false });
        patientsStore.createIndex('name', 'name', { unique: false });
      }
      
      // Cached Users Store (YENİ)
      if (!database.objectStoreNames.contains(STORES.CACHED_USERS)) {
        const usersStore = database.createObjectStore(STORES.CACHED_USERS, { keyPath: 'id' });
        usersStore.createIndex('role', 'role', { unique: false });
        usersStore.createIndex('name', 'name', { unique: false });
      }
      
      // Cached Vehicles Store (YENİ)
      if (!database.objectStoreNames.contains(STORES.CACHED_VEHICLES)) {
        const vehiclesStore = database.createObjectStore(STORES.CACHED_VEHICLES, { keyPath: 'id' });
        vehiclesStore.createIndex('plate', 'plate', { unique: false });
        vehiclesStore.createIndex('status', 'status', { unique: false });
      }
      
      // Cached Locations Store (YENİ)
      if (!database.objectStoreNames.contains(STORES.CACHED_LOCATIONS)) {
        const locationsStore = database.createObjectStore(STORES.CACHED_LOCATIONS, { keyPath: 'id' });
        locationsStore.createIndex('name', 'name', { unique: false });
      }
      
      // Cached ICD Codes Store (YENİ)
      if (!database.objectStoreNames.contains(STORES.CACHED_ICD_CODES)) {
        const icdStore = database.createObjectStore(STORES.CACHED_ICD_CODES, { keyPath: 'id' });
        icdStore.createIndex('code', 'code', { unique: false });
        icdStore.createIndex('name', 'name', { unique: false });
      }
      
      // Cached Shifts Store (YENİ)
      if (!database.objectStoreNames.contains(STORES.CACHED_SHIFTS)) {
        const shiftsStore = database.createObjectStore(STORES.CACHED_SHIFTS, { keyPath: 'id' });
        shiftsStore.createIndex('date', 'date', { unique: false });
        shiftsStore.createIndex('userId', 'userId', { unique: false });
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
      
      // Cache Metadata Store (YENİ)
      if (!database.objectStoreNames.contains(STORES.CACHE_METADATA)) {
        database.createObjectStore(STORES.CACHE_METADATA, { keyPath: 'key' });
      }
      
      console.log('[OfflineStorage] Database schema created/updated');
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
 * Store'daki veriyi güncelle veya ekle
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
 * Toplu veri ekle/güncelle
 */
const putBulk = async (storeName, items) => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    let completed = 0;
    const total = items.length;
    
    if (total === 0) {
      resolve(0);
      return;
    }
    
    items.forEach(item => {
      const request = store.put(item);
      request.onsuccess = () => {
        completed++;
        if (completed === total) {
          resolve(completed);
        }
      };
      request.onerror = () => {
        console.error('[OfflineStorage] Put error:', request.error);
        completed++;
        if (completed === total) {
          resolve(completed);
        }
      };
    });
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
    
    request.onsuccess = () => resolve(request.result || []);
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
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Arama yap (text search)
 */
const search = async (storeName, searchField, searchText) => {
  const items = await getAll(storeName);
  const lowerSearch = searchText.toLowerCase();
  
  return items.filter(item => {
    const value = item[searchField];
    if (typeof value === 'string') {
      return value.toLowerCase().includes(lowerSearch);
    }
    return false;
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

/**
 * Store'daki kayıt sayısını al
 */
const count = async (storeName) => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    const request = store.count();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// ==================== CACHE METADATA ====================

const setCacheMetadata = async (key, data) => {
  return put(STORES.CACHE_METADATA, {
    key,
    ...data,
    updatedAt: new Date().toISOString()
  });
};

const getCacheMetadata = async (key) => {
  return get(STORES.CACHE_METADATA, key);
};

const isCacheValid = async (key, maxAgeMinutes = 60) => {
  const metadata = await getCacheMetadata(key);
  if (!metadata || !metadata.updatedAt) return false;
  
  const updatedAt = new Date(metadata.updatedAt);
  const now = new Date();
  const diffMinutes = (now - updatedAt) / 1000 / 60;
  
  return diffMinutes < maxAgeMinutes;
};

// ==================== FIRMALAR ====================

const cacheFirms = async (firms) => {
  await clear(STORES.CACHED_FIRMS);
  const count = await putBulk(STORES.CACHED_FIRMS, firms.map(f => ({
    id: f.id || f._id,
    name: f.name,
    ...f
  })));
  await setCacheMetadata('firms', { count });
  console.log(`[OfflineStorage] ${count} firma cache'lendi`);
  return count;
};

const getCachedFirms = async () => {
  return getAll(STORES.CACHED_FIRMS);
};

const searchFirms = async (query) => {
  return search(STORES.CACHED_FIRMS, 'name', query);
};

// ==================== HASTALAR ====================

const cachePatient = async (patient) => {
  return put(STORES.CACHED_PATIENTS, {
    id: patient.id || patient._id,
    tc_no: patient.tc_no,
    name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
    ...patient
  });
};

const cachePatients = async (patients) => {
  const count = await putBulk(STORES.CACHED_PATIENTS, patients.map(p => ({
    id: p.id || p._id,
    tc_no: p.tc_no,
    name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
    ...p
  })));
  await setCacheMetadata('patients', { count });
  console.log(`[OfflineStorage] ${count} hasta cache'lendi`);
  return count;
};

const getCachedPatients = async () => {
  return getAll(STORES.CACHED_PATIENTS);
};

const getCachedPatientByTc = async (tcNo) => {
  const results = await getByIndex(STORES.CACHED_PATIENTS, 'tc_no', tcNo);
  return results[0] || null;
};

const searchPatients = async (query) => {
  const byName = await search(STORES.CACHED_PATIENTS, 'name', query);
  const byTc = await search(STORES.CACHED_PATIENTS, 'tc_no', query);
  
  // Merge and deduplicate
  const all = [...byName, ...byTc];
  const unique = all.filter((item, index, self) =>
    index === self.findIndex((t) => t.id === item.id)
  );
  return unique;
};

// ==================== KULLANICILAR ====================

const cacheUsers = async (users) => {
  await clear(STORES.CACHED_USERS);
  const count = await putBulk(STORES.CACHED_USERS, users.map(u => ({
    id: u.id || u._id,
    name: u.name,
    role: u.role,
    email: u.email,
    ...u
  })));
  await setCacheMetadata('users', { count });
  console.log(`[OfflineStorage] ${count} kullanıcı cache'lendi`);
  return count;
};

const getCachedUsers = async () => {
  return getAll(STORES.CACHED_USERS);
};

const getCachedUsersByRole = async (role) => {
  return getByIndex(STORES.CACHED_USERS, 'role', role);
};

// ==================== ARAÇLAR ====================

const cacheVehicles = async (vehicles) => {
  await clear(STORES.CACHED_VEHICLES);
  const count = await putBulk(STORES.CACHED_VEHICLES, vehicles.map(v => ({
    id: v.id || v._id,
    plate: v.plate,
    status: v.status,
    type: v.type,
    ...v
  })));
  await setCacheMetadata('vehicles', { count });
  console.log(`[OfflineStorage] ${count} araç cache'lendi`);
  return count;
};

const getCachedVehicles = async () => {
  return getAll(STORES.CACHED_VEHICLES);
};

const getCachedVehicleByPlate = async (plate) => {
  const results = await getByIndex(STORES.CACHED_VEHICLES, 'plate', plate);
  return results[0] || null;
};

// ==================== LOKASYONLAR ====================

const cacheLocations = async (locations) => {
  await clear(STORES.CACHED_LOCATIONS);
  const count = await putBulk(STORES.CACHED_LOCATIONS, locations.map(l => ({
    id: l.id || l._id,
    name: l.name,
    ...l
  })));
  await setCacheMetadata('locations', { count });
  console.log(`[OfflineStorage] ${count} lokasyon cache'lendi`);
  return count;
};

const getCachedLocations = async () => {
  return getAll(STORES.CACHED_LOCATIONS);
};

// ==================== İLAÇLAR ====================

const cacheMedications = async (medications) => {
  await clear(STORES.CACHED_MEDICATIONS);
  const count = await putBulk(STORES.CACHED_MEDICATIONS, medications.map(m => ({
    id: m.id || m._id || m.gtin,
    name: m.name || m.product_name,
    barcode: m.barcode || m.gtin,
    ...m
  })));
  await setCacheMetadata('medications', { count });
  console.log(`[OfflineStorage] ${count} ilaç cache'lendi`);
  return count;
};

const getCachedMedications = async () => {
  return getAll(STORES.CACHED_MEDICATIONS);
};

const searchMedications = async (query) => {
  return search(STORES.CACHED_MEDICATIONS, 'name', query);
};

// ==================== HASTANELER ====================

const cacheHospitals = async (hospitals) => {
  await clear(STORES.CACHED_HOSPITALS);
  const count = await putBulk(STORES.CACHED_HOSPITALS, hospitals.map(h => ({
    id: h.id || h._id || `hospital_${Math.random().toString(36).substr(2, 9)}`,
    name: h.name,
    city: h.city || h.il,
    ...h
  })));
  await setCacheMetadata('hospitals', { count });
  console.log(`[OfflineStorage] ${count} hastane cache'lendi`);
  return count;
};

const getCachedHospitals = async () => {
  return getAll(STORES.CACHED_HOSPITALS);
};

const searchHospitals = async (query) => {
  return search(STORES.CACHED_HOSPITALS, 'name', query);
};

// ==================== ICD KODLARI ====================

const cacheICDCodes = async (codes) => {
  await clear(STORES.CACHED_ICD_CODES);
  const count = await putBulk(STORES.CACHED_ICD_CODES, codes.map(c => ({
    id: c.id || c.code,
    code: c.code,
    name: c.name || c.description,
    ...c
  })));
  await setCacheMetadata('icd_codes', { count });
  console.log(`[OfflineStorage] ${count} ICD kodu cache'lendi`);
  return count;
};

const getCachedICDCodes = async () => {
  return getAll(STORES.CACHED_ICD_CODES);
};

const searchICDCodes = async (query) => {
  const byCode = await search(STORES.CACHED_ICD_CODES, 'code', query);
  const byName = await search(STORES.CACHED_ICD_CODES, 'name', query);
  
  const all = [...byCode, ...byName];
  const unique = all.filter((item, index, self) =>
    index === self.findIndex((t) => t.id === item.id)
  );
  return unique;
};

// ==================== VARDİYALAR ====================

const cacheShifts = async (shifts) => {
  const count = await putBulk(STORES.CACHED_SHIFTS, shifts.map(s => ({
    id: s.id || s._id,
    date: s.date || s.shift_date,
    userId: s.user_id,
    ...s
  })));
  await setCacheMetadata('shifts', { count });
  console.log(`[OfflineStorage] ${count} vardiya cache'lendi`);
  return count;
};

const getCachedShifts = async () => {
  return getAll(STORES.CACHED_SHIFTS);
};

const getCachedTodayShifts = async () => {
  const today = new Date().toISOString().split('T')[0];
  return getByIndex(STORES.CACHED_SHIFTS, 'date', today);
};

// ==================== VAKALAR ====================

const cacheCase = async (caseData) => {
  return put(STORES.CACHED_CASES, {
    ...caseData,
    id: caseData.id || caseData._id,
    cachedAt: new Date().toISOString()
  });
};

const cacheCases = async (cases) => {
  const count = await putBulk(STORES.CACHED_CASES, cases.map(c => ({
    ...c,
    id: c.id || c._id,
    cachedAt: new Date().toISOString()
  })));
  await setCacheMetadata('cases', { count });
  return count;
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

// ==================== PENDING CASES ====================

const savePendingCase = async (caseData) => {
  const id = `pending_case_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return add(STORES.PENDING_CASES, {
    id,
    ...caseData,
    status: 'pending',
    createdAt: new Date().toISOString(),
    isOffline: true
  });
};

const getPendingCases = async () => {
  return getAll(STORES.PENDING_CASES);
};

const removePendingCase = async (id) => {
  return remove(STORES.PENDING_CASES, id);
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

// ==================== SYNC QUEUE ====================

const addToSyncQueue = async (action, endpoint, data, priority = 5) => {
  return add(STORES.SYNC_QUEUE, {
    action,
    endpoint,
    data,
    priority,
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

// ==================== CACHE STATS ====================

const getCacheStats = async () => {
  const stats = {};
  
  for (const [key, storeName] of Object.entries(STORES)) {
    try {
      stats[key] = await count(storeName);
    } catch (e) {
      stats[key] = 0;
    }
  }
  
  return stats;
};

// ==================== EXPORT ====================

const OfflineStorage = {
  // Core
  initDB,
  STORES,
  
  // Generic operations
  add,
  put,
  putBulk,
  get,
  getAll,
  getByIndex,
  search,
  remove,
  clear,
  count,
  
  // Cache Metadata
  setCacheMetadata,
  getCacheMetadata,
  isCacheValid,
  
  // Firmalar
  cacheFirms,
  getCachedFirms,
  searchFirms,
  
  // Hastalar
  cachePatient,
  cachePatients,
  getCachedPatients,
  getCachedPatientByTc,
  searchPatients,
  
  // Kullanıcılar
  cacheUsers,
  getCachedUsers,
  getCachedUsersByRole,
  
  // Araçlar
  cacheVehicles,
  getCachedVehicles,
  getCachedVehicleByPlate,
  
  // Lokasyonlar
  cacheLocations,
  getCachedLocations,
  
  // İlaçlar
  cacheMedications,
  getCachedMedications,
  searchMedications,
  
  // Hastaneler
  cacheHospitals,
  getCachedHospitals,
  searchHospitals,
  
  // ICD Kodları
  cacheICDCodes,
  getCachedICDCodes,
  searchICDCodes,
  
  // Vardiyalar
  cacheShifts,
  getCachedShifts,
  getCachedTodayShifts,
  
  // Vakalar
  cacheCase,
  cacheCases,
  getCachedCase,
  getCachedCases,
  removeCachedCase,
  
  // Pending Forms
  savePendingForm,
  getPendingForms,
  getPendingFormsByType,
  updatePendingFormStatus,
  removePendingForm,
  
  // Pending Cases
  savePendingCase,
  getPendingCases,
  removePendingCase,
  
  // Pending Locations
  savePendingLocation,
  getPendingLocations,
  removePendingLocation,
  clearSyncedLocations,
  
  // Sync Queue
  addToSyncQueue,
  getSyncQueue,
  updateSyncItem,
  removeSyncItem,
  
  // User Data
  setUserData,
  getUserData,
  
  // Stats
  getCacheStats
};

export default OfflineStorage;
