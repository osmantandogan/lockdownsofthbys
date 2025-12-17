/**
 * ReferenceDataCache - Referans Veri Önbellek Servisi
 * Uygulama başladığında tüm kritik verileri cache'ler
 * Offline modda bu verilerden okuma yapar
 */

import OfflineStorage from './OfflineStorage';
import { 
  firmsAPI, 
  usersAPI, 
  vehiclesAPI, 
  locationsAPI,
  patientsAPI,
  stockBarcodeAPI
} from '../api';

// Cache süresi (dakika)
const CACHE_DURATIONS = {
  firms: 60 * 24,        // 24 saat
  users: 60 * 12,        // 12 saat
  vehicles: 60 * 6,      // 6 saat
  locations: 60 * 24,    // 24 saat
  medications: 60 * 24,  // 24 saat
  hospitals: 60 * 24 * 7, // 7 gün
  icd_codes: 60 * 24 * 7  // 7 gün
};

let isInitialized = false;
let initPromise = null;

/**
 * Tüm referans verileri cache'le
 */
const initializeCache = async (forceRefresh = false) => {
  if (initPromise) {
    return initPromise;
  }
  
  initPromise = (async () => {
    console.log('[ReferenceDataCache] Initializing cache...');
    
    const results = {
      firms: false,
      users: false,
      vehicles: false,
      locations: false,
      medications: false,
      hospitals: false
    };
    
    try {
      // Paralel olarak tüm verileri cache'le
      const promises = [];
      
      // Firmalar
      if (forceRefresh || !(await OfflineStorage.isCacheValid('firms', CACHE_DURATIONS.firms))) {
        promises.push(
          cacheFirms().then(() => { results.firms = true; }).catch(e => console.warn('[Cache] Firms failed:', e))
        );
      } else {
        results.firms = true;
      }
      
      // Kullanıcılar
      if (forceRefresh || !(await OfflineStorage.isCacheValid('users', CACHE_DURATIONS.users))) {
        promises.push(
          cacheUsers().then(() => { results.users = true; }).catch(e => console.warn('[Cache] Users failed:', e))
        );
      } else {
        results.users = true;
      }
      
      // Araçlar
      if (forceRefresh || !(await OfflineStorage.isCacheValid('vehicles', CACHE_DURATIONS.vehicles))) {
        promises.push(
          cacheVehicles().then(() => { results.vehicles = true; }).catch(e => console.warn('[Cache] Vehicles failed:', e))
        );
      } else {
        results.vehicles = true;
      }
      
      // Lokasyonlar
      if (forceRefresh || !(await OfflineStorage.isCacheValid('locations', CACHE_DURATIONS.locations))) {
        promises.push(
          cacheLocations().then(() => { results.locations = true; }).catch(e => console.warn('[Cache] Locations failed:', e))
        );
      } else {
        results.locations = true;
      }
      
      // İlaçlar
      if (forceRefresh || !(await OfflineStorage.isCacheValid('medications', CACHE_DURATIONS.medications))) {
        promises.push(
          cacheMedications().then(() => { results.medications = true; }).catch(e => console.warn('[Cache] Medications failed:', e))
        );
      } else {
        results.medications = true;
      }
      
      // Hastaneler
      if (forceRefresh || !(await OfflineStorage.isCacheValid('hospitals', CACHE_DURATIONS.hospitals))) {
        promises.push(
          cacheHospitals().then(() => { results.hospitals = true; }).catch(e => console.warn('[Cache] Hospitals failed:', e))
        );
      } else {
        results.hospitals = true;
      }
      
      await Promise.all(promises);
      
      isInitialized = true;
      console.log('[ReferenceDataCache] Cache initialized:', results);
      
      return results;
    } catch (error) {
      console.error('[ReferenceDataCache] Initialization error:', error);
      return results;
    } finally {
      initPromise = null;
    }
  })();
  
  return initPromise;
};

/**
 * Firmaları cache'le
 */
const cacheFirms = async () => {
  try {
    const response = await firmsAPI.getAll();
    const firms = response.data || [];
    await OfflineStorage.cacheFirms(firms);
    return firms.length;
  } catch (error) {
    console.error('[ReferenceDataCache] Failed to cache firms:', error);
    throw error;
  }
};

/**
 * Kullanıcıları cache'le
 */
const cacheUsers = async () => {
  try {
    const response = await usersAPI.getAll();
    const users = response.data || [];
    await OfflineStorage.cacheUsers(users);
    return users.length;
  } catch (error) {
    console.error('[ReferenceDataCache] Failed to cache users:', error);
    throw error;
  }
};

/**
 * Araçları cache'le
 */
const cacheVehicles = async () => {
  try {
    const response = await vehiclesAPI.getAll({});
    const vehicles = response.data || [];
    await OfflineStorage.cacheVehicles(vehicles);
    return vehicles.length;
  } catch (error) {
    console.error('[ReferenceDataCache] Failed to cache vehicles:', error);
    throw error;
  }
};

/**
 * Lokasyonları cache'le
 */
const cacheLocations = async () => {
  try {
    const response = await locationsAPI.getHealmedy();
    const locations = response.data || [];
    await OfflineStorage.cacheLocations(locations);
    return locations.length;
  } catch (error) {
    console.error('[ReferenceDataCache] Failed to cache locations:', error);
    throw error;
  }
};

/**
 * İlaçları cache'le
 */
const cacheMedications = async () => {
  try {
    // stockBarcodeAPI.searchMedications {results: [], count: 0} formatında dönüyor
    const response = await stockBarcodeAPI.searchMedications('a'); // 'a' ile başlayan ilaçları al
    // Response formatı: {results: [...], count: X}
    const medications = response.data?.results || response.data || [];
    
    // Array değilse boş array kullan
    if (!Array.isArray(medications)) {
      console.warn('[ReferenceDataCache] Medications data is not an array:', medications);
      await OfflineStorage.cacheMedications([]);
      return 0;
    }
    
    await OfflineStorage.cacheMedications(medications);
    return medications.length;
  } catch (error) {
    console.error('[ReferenceDataCache] Failed to cache medications:', error);
    // Hata durumunda boş array cache'le (crash'i önle)
    await OfflineStorage.cacheMedications([]);
    throw error;
  }
};

/**
 * Hastaneleri cache'le
 */
const cacheHospitals = async () => {
  try {
    // API'den hastaneleri al - /reference/hospitals/grouped endpoint'i
    const { referenceAPI } = await import('../api');
    const response = await referenceAPI.getHospitalsGrouped();
    
    if (response.data) {
      // Grouped format: {healmedy: [], zonguldak_devlet: [], ...}
      // Tüm hastaneleri tek array'e dönüştür
      const hospitalData = response.data;
      const allHospitals = [];
      
      // Her kategoriden hastaneleri topla
      if (Array.isArray(hospitalData.healmedy)) {
        allHospitals.push(...hospitalData.healmedy);
      }
      if (Array.isArray(hospitalData.healmedy_bekleme_noktalari)) {
        allHospitals.push(...hospitalData.healmedy_bekleme_noktalari);
      }
      if (Array.isArray(hospitalData.zonguldak_devlet)) {
        allHospitals.push(...hospitalData.zonguldak_devlet);
      }
      if (Array.isArray(hospitalData.zonguldak_ozel)) {
        allHospitals.push(...hospitalData.zonguldak_ozel);
      }
      
      await OfflineStorage.cacheHospitals(allHospitals);
      return allHospitals.length;
    }
    return 0;
  } catch (error) {
    console.error('[ReferenceDataCache] Failed to cache hospitals:', error);
    // Hata durumunda boş array cache'le
    await OfflineStorage.cacheHospitals([]);
    throw error;
  }
};

// ==================== OFFLINE-FIRST DATA ACCESS ====================

/**
 * Firmaları getir (önce cache, yoksa API)
 */
const getFirms = async (forceOnline = false) => {
  // Önce cache'den dene
  if (!forceOnline) {
    const cached = await OfflineStorage.getCachedFirms();
    if (cached.length > 0) {
      return { data: cached, fromCache: true };
    }
  }
  
  // API'den al
  try {
    const response = await firmsAPI.getAll();
    const firms = response.data || [];
    
    // Cache'e kaydet
    await OfflineStorage.cacheFirms(firms);
    
    return { data: firms, fromCache: false };
  } catch (error) {
    // Offline ise cache'den döndür
    const cached = await OfflineStorage.getCachedFirms();
    if (cached.length > 0) {
      return { data: cached, fromCache: true, error: 'Çevrimdışı - cache kullanıldı' };
    }
    throw error;
  }
};

/**
 * Firma ara
 */
const searchFirms = async (query) => {
  // Önce cache'den ara
  const cached = await OfflineStorage.searchFirms(query);
  if (cached.length > 0) {
    return { data: cached, fromCache: true };
  }
  
  // Cache'de yoksa tüm firmaları getir ve ara
  const { data: allFirms } = await getFirms();
  const filtered = allFirms.filter(f => 
    f.name?.toLowerCase().includes(query.toLowerCase())
  );
  
  return { data: filtered, fromCache: false };
};

/**
 * Kullanıcıları getir
 */
const getUsers = async (forceOnline = false) => {
  if (!forceOnline) {
    const cached = await OfflineStorage.getCachedUsers();
    if (cached.length > 0) {
      return { data: cached, fromCache: true };
    }
  }
  
  try {
    const response = await usersAPI.getAll();
    const users = response.data || [];
    await OfflineStorage.cacheUsers(users);
    return { data: users, fromCache: false };
  } catch (error) {
    const cached = await OfflineStorage.getCachedUsers();
    if (cached.length > 0) {
      return { data: cached, fromCache: true, error: 'Çevrimdışı - cache kullanıldı' };
    }
    throw error;
  }
};

/**
 * Rol'e göre kullanıcıları getir
 */
const getUsersByRole = async (role) => {
  const { data: users } = await getUsers();
  return users.filter(u => u.role === role);
};

/**
 * Araçları getir
 */
const getVehicles = async (forceOnline = false) => {
  if (!forceOnline) {
    const cached = await OfflineStorage.getCachedVehicles();
    if (cached.length > 0) {
      return { data: cached, fromCache: true };
    }
  }
  
  try {
    const response = await vehiclesAPI.getAll({});
    const vehicles = response.data || [];
    await OfflineStorage.cacheVehicles(vehicles);
    return { data: vehicles, fromCache: false };
  } catch (error) {
    const cached = await OfflineStorage.getCachedVehicles();
    if (cached.length > 0) {
      return { data: cached, fromCache: true, error: 'Çevrimdışı - cache kullanıldı' };
    }
    throw error;
  }
};

/**
 * Plakaya göre araç getir
 */
const getVehicleByPlate = async (plate) => {
  const cached = await OfflineStorage.getCachedVehicleByPlate(plate);
  if (cached) {
    return { data: cached, fromCache: true };
  }
  
  const { data: vehicles } = await getVehicles();
  const vehicle = vehicles.find(v => v.plate === plate);
  return { data: vehicle || null, fromCache: false };
};

/**
 * Lokasyonları getir
 */
const getLocations = async (forceOnline = false) => {
  if (!forceOnline) {
    const cached = await OfflineStorage.getCachedLocations();
    if (cached.length > 0) {
      return { data: cached, fromCache: true };
    }
  }
  
  try {
    const response = await locationsAPI.getHealmedy();
    const locations = response.data || [];
    await OfflineStorage.cacheLocations(locations);
    return { data: locations, fromCache: false };
  } catch (error) {
    const cached = await OfflineStorage.getCachedLocations();
    if (cached.length > 0) {
      return { data: cached, fromCache: true, error: 'Çevrimdışı - cache kullanıldı' };
    }
    throw error;
  }
};

/**
 * İlaçları getir
 */
const getMedications = async (forceOnline = false) => {
  if (!forceOnline) {
    const cached = await OfflineStorage.getCachedMedications();
    if (cached.length > 0) {
      return { data: cached, fromCache: true };
    }
  }
  
  try {
    const response = await stockBarcodeAPI.searchMedications('');
    const medications = response.data || [];
    await OfflineStorage.cacheMedications(medications);
    return { data: medications, fromCache: false };
  } catch (error) {
    const cached = await OfflineStorage.getCachedMedications();
    if (cached.length > 0) {
      return { data: cached, fromCache: true, error: 'Çevrimdışı - cache kullanıldı' };
    }
    throw error;
  }
};

/**
 * İlaç ara
 */
const searchMedications = async (query) => {
  const cached = await OfflineStorage.searchMedications(query);
  if (cached.length > 0) {
    return { data: cached, fromCache: true };
  }
  
  // Online ise API'den ara
  try {
    const response = await stockBarcodeAPI.searchMedications(query);
    return { data: response.data || [], fromCache: false };
  } catch (error) {
    return { data: cached, fromCache: true };
  }
};

/**
 * Hastaneleri getir
 */
const getHospitals = async (forceOnline = false) => {
  if (!forceOnline) {
    const cached = await OfflineStorage.getCachedHospitals();
    if (cached.length > 0) {
      return { data: cached, fromCache: true };
    }
  }
  
  await cacheHospitals();
  const cached = await OfflineStorage.getCachedHospitals();
  return { data: cached, fromCache: false };
};

/**
 * Hastane ara
 */
const searchHospitals = async (query) => {
  return { 
    data: await OfflineStorage.searchHospitals(query), 
    fromCache: true 
  };
};

/**
 * Hasta getir (TC ile)
 */
const getPatientByTc = async (tcNo, forceOnline = false) => {
  // Önce cache'den dene
  if (!forceOnline) {
    const cached = await OfflineStorage.getCachedPatientByTc(tcNo);
    if (cached) {
      return { data: cached, fromCache: true };
    }
  }
  
  // API'den al
  try {
    const response = await patientsAPI.getByTc(tcNo);
    const patient = response.data;
    
    if (patient) {
      // Cache'e kaydet
      await OfflineStorage.cachePatient(patient);
    }
    
    return { data: patient, fromCache: false };
  } catch (error) {
    // Offline ise cache'den döndür
    const cached = await OfflineStorage.getCachedPatientByTc(tcNo);
    if (cached) {
      return { data: cached, fromCache: true, error: 'Çevrimdışı - cache kullanıldı' };
    }
    throw error;
  }
};

/**
 * Hasta ara
 */
const searchPatients = async (query) => {
  // Önce cache'den ara
  const cached = await OfflineStorage.searchPatients(query);
  
  // Online ise API'den de ara
  try {
    const response = await patientsAPI.search({ q: query, limit: 20 });
    const apiResults = response.data || [];
    
    // Cache'e kaydet
    for (const patient of apiResults) {
      await OfflineStorage.cachePatient(patient);
    }
    
    // Merge results
    const merged = [...cached, ...apiResults].filter((item, index, self) =>
      index === self.findIndex((t) => t.id === item.id)
    );
    
    return { data: merged, fromCache: false };
  } catch (error) {
    // Offline ise sadece cache sonuçları
    return { data: cached, fromCache: true };
  }
};

/**
 * Cache istatistikleri
 */
const getCacheStats = async () => {
  return OfflineStorage.getCacheStats();
};

/**
 * Cache'i temizle
 */
const clearCache = async () => {
  await Promise.all([
    OfflineStorage.clear(OfflineStorage.STORES.CACHED_FIRMS),
    OfflineStorage.clear(OfflineStorage.STORES.CACHED_USERS),
    OfflineStorage.clear(OfflineStorage.STORES.CACHED_VEHICLES),
    OfflineStorage.clear(OfflineStorage.STORES.CACHED_LOCATIONS),
    OfflineStorage.clear(OfflineStorage.STORES.CACHED_MEDICATIONS),
    OfflineStorage.clear(OfflineStorage.STORES.CACHED_HOSPITALS),
    OfflineStorage.clear(OfflineStorage.STORES.CACHED_PATIENTS),
    OfflineStorage.clear(OfflineStorage.STORES.CACHE_METADATA)
  ]);
  isInitialized = false;
  console.log('[ReferenceDataCache] Cache cleared');
};

// ==================== EXPORT ====================

const ReferenceDataCache = {
  // Initialization
  initializeCache,
  isInitialized: () => isInitialized,
  
  // Cache functions
  cacheFirms,
  cacheUsers,
  cacheVehicles,
  cacheLocations,
  cacheMedications,
  cacheHospitals,
  
  // Data access (offline-first)
  getFirms,
  searchFirms,
  getUsers,
  getUsersByRole,
  getVehicles,
  getVehicleByPlate,
  getLocations,
  getMedications,
  searchMedications,
  getHospitals,
  searchHospitals,
  getPatientByTc,
  searchPatients,
  
  // Utils
  getCacheStats,
  clearCache
};

export default ReferenceDataCache;

