/**
 * useOfflineData - Offline-first veri erişim hook'u
 * Önce cache'den okur, gerekirse API'den günceller
 */

import { useState, useEffect, useCallback } from 'react';
import { useOffline } from '../contexts/OfflineContext';
import ReferenceDataCache from '../services/ReferenceDataCache';

/**
 * Firma listesi hook'u
 */
export const useFirms = (options = {}) => {
  const { autoLoad = true } = options;
  const { isOnline } = useOffline();
  
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  
  const load = useCallback(async (forceOnline = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await ReferenceDataCache.getFirms(forceOnline && isOnline);
      setFirms(result.data);
      setFromCache(result.fromCache);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isOnline]);
  
  const search = useCallback(async (query) => {
    if (!query || query.length < 2) {
      return firms;
    }
    
    const result = await ReferenceDataCache.searchFirms(query);
    return result.data;
  }, [firms]);
  
  useEffect(() => {
    if (autoLoad) {
      load();
    }
  }, [autoLoad, load]);
  
  return { firms, loading, error, fromCache, load, search };
};

/**
 * Kullanıcı listesi hook'u
 */
export const useUsers = (options = {}) => {
  const { autoLoad = true, role = null } = options;
  const { isOnline } = useOffline();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  
  const load = useCallback(async (forceOnline = false) => {
    setLoading(true);
    setError(null);
    
    try {
      let result;
      if (role) {
        const roleUsers = await ReferenceDataCache.getUsersByRole(role);
        result = { data: roleUsers, fromCache: true };
      } else {
        result = await ReferenceDataCache.getUsers(forceOnline && isOnline);
      }
      setUsers(result.data);
      setFromCache(result.fromCache);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isOnline, role]);
  
  useEffect(() => {
    if (autoLoad) {
      load();
    }
  }, [autoLoad, load]);
  
  return { users, loading, error, fromCache, load };
};

/**
 * Araç listesi hook'u
 */
export const useVehicles = (options = {}) => {
  const { autoLoad = true } = options;
  const { isOnline } = useOffline();
  
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  
  const load = useCallback(async (forceOnline = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await ReferenceDataCache.getVehicles(forceOnline && isOnline);
      setVehicles(result.data);
      setFromCache(result.fromCache);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isOnline]);
  
  const getByPlate = useCallback(async (plate) => {
    const result = await ReferenceDataCache.getVehicleByPlate(plate);
    return result.data;
  }, []);
  
  useEffect(() => {
    if (autoLoad) {
      load();
    }
  }, [autoLoad, load]);
  
  return { vehicles, loading, error, fromCache, load, getByPlate };
};

/**
 * Lokasyon listesi hook'u
 */
export const useLocations = (options = {}) => {
  const { autoLoad = true } = options;
  const { isOnline } = useOffline();
  
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  
  const load = useCallback(async (forceOnline = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await ReferenceDataCache.getLocations(forceOnline && isOnline);
      setLocations(result.data);
      setFromCache(result.fromCache);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isOnline]);
  
  useEffect(() => {
    if (autoLoad) {
      load();
    }
  }, [autoLoad, load]);
  
  return { locations, loading, error, fromCache, load };
};

/**
 * İlaç listesi hook'u
 */
export const useMedications = (options = {}) => {
  const { autoLoad = false } = options;
  const { isOnline } = useOffline();
  
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  
  const load = useCallback(async (forceOnline = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await ReferenceDataCache.getMedications(forceOnline && isOnline);
      setMedications(result.data);
      setFromCache(result.fromCache);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isOnline]);
  
  const search = useCallback(async (query) => {
    if (!query || query.length < 2) {
      return [];
    }
    
    const result = await ReferenceDataCache.searchMedications(query);
    return result.data;
  }, []);
  
  useEffect(() => {
    if (autoLoad) {
      load();
    }
  }, [autoLoad, load]);
  
  return { medications, loading, error, fromCache, load, search };
};

/**
 * Hastane listesi hook'u
 */
export const useHospitals = (options = {}) => {
  const { autoLoad = true } = options;
  
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await ReferenceDataCache.getHospitals();
      setHospitals(result.data);
      setFromCache(result.fromCache);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  
  const search = useCallback(async (query) => {
    if (!query || query.length < 2) {
      return hospitals;
    }
    
    const result = await ReferenceDataCache.searchHospitals(query);
    return result.data;
  }, [hospitals]);
  
  useEffect(() => {
    if (autoLoad) {
      load();
    }
  }, [autoLoad, load]);
  
  return { hospitals, loading, error, fromCache, load, search };
};

/**
 * Hasta arama hook'u
 */
export const usePatientSearch = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  
  const search = useCallback(async (query) => {
    if (!query || query.length < 3) {
      setPatients([]);
      return [];
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await ReferenceDataCache.searchPatients(query);
      setPatients(result.data);
      setFromCache(result.fromCache);
      return result.data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);
  
  const getByTc = useCallback(async (tcNo) => {
    if (!tcNo || tcNo.length !== 11) {
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await ReferenceDataCache.getPatientByTc(tcNo);
      setFromCache(result.fromCache);
      return result.data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return { patients, loading, error, fromCache, search, getByTc };
};

/**
 * Cache durumu hook'u
 */
export const useCacheStatus = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const cacheStats = await ReferenceDataCache.getCacheStats();
      setStats(cacheStats);
    } catch (err) {
      console.error('Cache stats error:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    refresh();
  }, [refresh]);
  
  return { stats, loading, refresh };
};

export default {
  useFirms,
  useUsers,
  useVehicles,
  useLocations,
  useMedications,
  useHospitals,
  usePatientSearch,
  useCacheStatus
};

