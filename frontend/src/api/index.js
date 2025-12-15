import axios from 'axios';
import { API_URL } from '../config/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// Token yönetimi
const TOKEN_KEY = 'healmedy_session_token';

/**
 * Token'ın benzersiz parmak izini al
 */
const getTokenFingerprint = (token) => {
  if (!token) return 'null';
  return '...' + token.slice(-10);
};

/**
 * JWT token'dan user ID'yi çıkar
 */
const decodeTokenUserId = (token) => {
  try {
    if (!token) return 'null';
    const parts = token.split('.');
    if (parts.length !== 3) return 'invalid';
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || payload.user_id || payload.id || 'unknown';
  } catch (e) {
    return 'decode-error';
  }
};

export const setAuthToken = (token) => {
  if (token) {
    const fingerprint = getTokenFingerprint(token);
    const tokenUserId = decodeTokenUserId(token);
    console.log(`[API] setAuthToken: fingerprint=${fingerprint}, decoded_user=${tokenUserId}`);
    localStorage.setItem(TOKEN_KEY, token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    console.log('[API] setAuthToken: clearing token');
    localStorage.removeItem(TOKEN_KEY);
    delete api.defaults.headers.common['Authorization'];
  }
};

export const getAuthToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

// Sayfa yüklendiğinde token'ı header'a ekle
const savedToken = getAuthToken();
if (savedToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
}

// Request interceptor - her istekte token ekle
api.interceptors.request.use(
  (config) => {
    // Mevcut header'ı kontrol et
    const existingAuth = config.headers['Authorization'] || api.defaults.headers.common['Authorization'];
    const storageToken = getAuthToken();
    
    // /auth/me endpoint'i için detaylı log
    if (config.url?.includes('/auth/me')) {
      const existingFingerprint = existingAuth ? getTokenFingerprint(existingAuth.replace('Bearer ', '')) : 'none';
      const storageFingerprint = getTokenFingerprint(storageToken);
      const existingUserId = existingAuth ? decodeTokenUserId(existingAuth.replace('Bearer ', '')) : 'none';
      const storageUserId = decodeTokenUserId(storageToken);
      
      console.log('[API Interceptor] === /auth/me REQUEST ===');
      console.log(`[API Interceptor] Existing header fingerprint: ${existingFingerprint} (user: ${existingUserId})`);
      console.log(`[API Interceptor] Storage token fingerprint: ${storageFingerprint} (user: ${storageUserId})`);
      console.log(`[API Interceptor] Using: ${existingAuth ? 'existing header' : 'storage token'}`);
    }
    
    // Sadece header yoksa storage'dan ekle
    if (storageToken && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${storageToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - 401 hatalarında token temizle
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token geçersiz - temizle (ama login sayfasına yönlendirme yapma, AuthContext halleder)
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
        console.log('[API] 401 - Token might be invalid');
      }
    }
    return Promise.reject(error);
  }
);

// Cases API
export const casesAPI = {
  getAll: (params) => api.get('/cases', { params }),
  getById: (id) => api.get(`/cases/${id}`),
  create: (data) => api.post('/cases', data),
  assignTeam: (id, data) => api.post(`/cases/${id}/assign-team`, data),
  assignMultipleTeams: (id, vehicleIds) => api.post(`/cases/${id}/assign-multiple-teams`, { vehicle_ids: vehicleIds }),
  updateStatus: (id, data) => api.patch(`/cases/${id}/status`, data),
  getStats: () => api.get('/cases/stats/dashboard'),
  getNextCaseNumber: () => api.get('/cases/next-case-number'),
  sendNotification: (id, vehicleId) => api.post(`/cases/${id}/send-notification`, null, {
    params: { vehicle_id: vehicleId }
  }),
  // Real-time collaboration
  joinCase: (id) => api.post(`/cases/${id}/join`),
  leaveCase: (id) => api.post(`/cases/${id}/leave`),
  getParticipants: (id) => api.get(`/cases/${id}/participants`),
  getMedicalForm: (id) => api.get(`/cases/${id}/medical-form`),
  updateMedicalForm: (id, data) => api.patch(`/cases/${id}/medical-form`, data),
  // Doctor approval
  doctorApproval: (id, data) => api.post(`/cases/${id}/doctor-approval`, data),
  // Video call (legacy - Jitsi)
  startVideoCall: (id) => api.post(`/cases/${id}/start-video-call`),
  // 36 saat erişim onayı
  requestAccess: (id, data) => api.post(`/cases/${id}/request-access`, data),
  // Hasta bilgisi güncelleme
  updatePatientInfo: (id, data) => api.patch(`/cases/${id}/patient`, data),
  // Excel export - Backend template kullanarak
  exportExcel: (id) => api.get(`/cases/${id}/export-excel`, { responseType: 'blob' }),
  // Dinamik Excel export - Mapping şablonu ile
  exportExcelWithTemplate: (caseId, templateId) => api.get(`/cases/${caseId}/export-excel-template/${templateId}`, { responseType: 'blob' }),
  // Vaka Form Mapping ile export (Görsel Editör)
  exportExcelWithMapping: (caseId) => api.get(`/cases/${caseId}/export-excel-mapped`, { responseType: 'blob' }),
  // Vaka Form Mapping ile PDF export (Tek Sayfa)
  exportPdfWithMapping: (caseId) => api.get(`/cases/${caseId}/export-pdf-mapped`, { responseType: 'blob' })
};

// Video Call API (Daily.co)
export const videoCallAPI = {
  createRoom: (caseId) => api.post(`/video/${caseId}/create-room`),
  endRoom: (caseId) => api.post(`/video/${caseId}/end-room`),
  getRoomStatus: (caseId) => api.get(`/video/${caseId}/room-status`)
};

// Reference Data API
export const referenceAPI = {
  searchIcdCodes: (query) => api.get('/reference/icd-codes', { params: { q: query } }),
  getHospitals: (params) => api.get('/reference/hospitals', { params }),
  getHospitalsGrouped: () => api.get('/reference/hospitals/grouped'),
  // YENİ: Tüm Türkiye hastaneleri
  getTurkeyProvinces: () => api.get('/reference/hospitals/turkey/provinces'),
  getHospitalsByProvince: (province, type = 'all') => api.get(`/reference/hospitals/turkey/by-province/${encodeURIComponent(province)}`, { params: { hospital_type: type } }),
  searchTurkeyHospitals: (query, province = '') => api.get('/reference/hospitals/turkey/search', { params: { q: query, province } })
};

// Vehicles API
export const vehiclesAPI = {
  getAll: (params) => api.get('/vehicles', { params }),
  getById: (id) => {
    if (!id || id === 'undefined' || id === 'null') {
      console.warn('vehiclesAPI.getById called with invalid ID:', id);
      return Promise.resolve({ data: null });
    }
    return api.get(`/vehicles/${id}`);
  },
  getByQR: (qr) => api.get(`/vehicles/qr/${qr}`),
  create: (data) => api.post('/vehicles', data),
  update: (id, data) => api.patch(`/vehicles/${id}`, data),
  delete: (id) => api.delete(`/vehicles/${id}`),
  getStats: () => api.get('/vehicles/stats/summary'),
  getDailyAssignments: (date) => api.get('/vehicles/daily-assignments', { params: { date } }),
  getMonthlyCalendar: (year, month) => api.get('/vehicles/monthly-calendar', { params: { year, month } }),
  getKmReport: (id, params) => api.get(`/vehicles/km-report/${id}`, { params }),
  updateStationCodes: () => api.post('/vehicles/update-station-codes')
};

// Stock API
export const stockAPI = {
  getAll: (params) => api.get('/stock', { params }),
  getAllGrouped: (params) => api.get('/stock/all-grouped', { params }),
  getById: (id) => api.get(`/stock/${id}`),
  getByQR: (qr) => api.get(`/stock/qr/${qr}`),
  create: (data) => api.post('/stock', data),
  update: (id, data) => api.patch(`/stock/${id}`, data),
  delete: (id) => api.delete(`/stock/${id}`),
  getAlerts: () => api.get('/stock/alerts/summary'),
  search: (params) => api.get('/medications/stock/search', { params }),
  getVehicleStock: (vehicleId) => api.get(`/medications/vehicles/${vehicleId}/stock`),
  // Lokasyon Yönetimi
  getLocations: (params) => api.get('/stock/locations', { params }),
  createLocation: (data) => api.post('/stock/locations', data),
  deleteLocation: (id) => api.delete(`/stock/locations/${id}`),
  getLocationsSummary: () => api.get('/stock/locations/summary'),
  getLocationItems: (id) => api.get(`/stock/locations/${id}/items`),
  getItemBarcodeDetails: (locationId, itemName) => api.get(`/stock/locations/${locationId}/items/${encodeURIComponent(itemName)}/details`),
  
  // YENİ: Stok Transfer
  transfer: (data) => api.post('/stock/transfer', data),
  getTransfers: (params) => api.get('/stock/transfers', { params }),
  getLocationStock: (locationId) => api.get(`/stock/location/${locationId}/stock`),
  getVehicleAllStock: (vehicleId) => api.get(`/stock/vehicle/${vehicleId}/all-stock`),
  
  // YENİ: Karekod Bazlı Stok (Gruplu)
  getBarcodeInventory: (params) => api.get('/stock-barcode/inventory', { params }),
  getGroupedInventory: (params) => api.get('/stock-barcode/inventory/grouped', { params }),
  getItemQRDetails: (itemName, location) => api.get(`/stock-barcode/inventory/item-details/${encodeURIComponent(itemName)}`, { params: { location } }),
  addBarcodeStock: (data) => api.post('/stock-barcode/add', data),
  deductBarcodeStock: (data) => api.post('/stock-barcode/deduct', data),
  
  // Otomatik Lokasyon Senkronizasyonu
  syncVehicleLocations: () => api.post('/stock-barcode/sync-vehicle-locations'),
  getStockLocations: (type) => api.get('/stock-barcode/stock-locations', { params: { type } }),
  cleanupOldLocations: () => api.delete('/stock-barcode/stock-locations/cleanup-old'),
  
  // Stok Parçalama (QR -> Adet)
  getSplitInfo: (barcodeStockId) => api.get(`/stock-barcode/split-info/${barcodeStockId}`),
  splitStock: (data) => api.post('/stock-barcode/split', data),
  
  // Stok Hareketleri
  sendStockToLocation: (data) => api.post('/stock-barcode/movements/send', data),
  getStockMovements: (params) => api.get('/stock-barcode/movements', { params }),
  createStockMovement: (data) => api.post('/stock-barcode/movements/create', data),
  createStockMovement: (data) => api.post('/stock-barcode/movements/create', data)
};

// Medications API (Vakada kullanılan ilaçlar)
export const medicationsAPI = {
  // Karekod işlemleri
  parseBarcode: (barcode, vehiclePlate) => api.post('/medications/parse-barcode', { 
    barcode, 
    vehicle_plate: vehiclePlate 
  }),
  createFromBarcode: (data) => api.post('/medications/stock/from-barcode', data),
  
  // Vaka ilaç kullanımı
  getCaseMedications: (caseId) => api.get(`/medications/cases/${caseId}/medications`),
  addToCases: (caseId, data) => api.post(`/medications/cases/${caseId}/medications`, data),
  removeFromCase: (caseId, medicationId) => api.delete(`/medications/cases/${caseId}/medications/${medicationId}`)
};

// Shifts API
export const shiftsAPI = {
  // Shift assignments - Yeni v2 endpoint (body ile veri gönderir)
  createAssignment: (data) => api.post('/shifts/create-assignment-v2', data),
  getMyAssignments: () => api.get('/shifts/assignments/my'),
  getAllAssignments: () => api.get('/shifts/assignments'),
  getAssignmentsByDate: (date) => api.get('/shifts/assignments', { params: { date } }),
  getTodayAssignments: () => api.get('/shifts/assignments/today'),
  deleteAssignment: (id) => api.delete(`/shifts/assignments/${id}`),
  startAssignmentByAdmin: (id) => api.post(`/shifts/assignments/${id}/start`),
  endAssignmentByAdmin: (id) => api.post(`/shifts/assignments/${id}/end`),
  
  // Shifts
  start: (data) => api.post('/shifts/start', data),
  end: (data) => api.post('/shifts/end', data),
  getActive: () => api.get('/shifts/active'),
  getHistory: (params) => api.get('/shifts/history', { params }),
  getStats: (params) => api.get('/shifts/stats/summary', { params }),
  
  // Shift Photos
  getPhotos: (params) => api.get('/shifts/photos', { params }),
  getPhotosByShiftId: (shiftId) => api.get(`/shifts/photos/${shiftId}`),
  
  // YENİ: Günlük Form Kontrolü
  checkDailyForm: (vehicleId, date) => api.get(`/shifts/check-daily-form/${vehicleId}`, { params: { date } }),
  markDailyFormFilled: (data) => api.post('/shifts/mark-daily-form-filled', data),
  logSectionTime: (data) => api.post('/shifts/log-section-time', data),
  
  // YENİ: Devir Teslim
  startHandover: (data) => api.post('/shifts/handover/start', data),
  getActiveHandover: () => api.get('/shifts/handover/active'),
  signHandover: (sessionId, data) => api.post(`/shifts/handover/${sessionId}/sign`, data),
  approveHandover: (sessionId, data) => api.post(`/shifts/handover/${sessionId}/approve`, data),
  getPendingApprovals: (date) => api.get('/shifts/handover/pending-approvals', { params: { date } }),
  getHandoverLogs: (params) => api.get('/shifts/handover/logs', { params }),
  
  // YENİ: Ekip Gruplama
  getTodayTeam: (vehicleId) => api.get(`/shifts/today-team/${vehicleId}`),
  
  // YENİ: Vardiya Başlatma Onay Sistemi
  requestStartApproval: (data) => api.post('/shifts/start-approval/request', data),
  getPendingStartApprovals: (roleType) => api.get('/shifts/start-approval/pending', { params: { role_type: roleType } }),
  checkStartApproval: (approvalId) => api.get(`/shifts/start-approval/check/${approvalId}`),
  approveStartApproval: (approvalId) => api.post(`/shifts/start-approval/${approvalId}/approve`),
  rejectStartApproval: (approvalId, reason) => api.post(`/shifts/start-approval/${approvalId}/reject`, null, { params: { reason } }),
  
  // YENİ: Vardiya Bitirme Onay Sistemi
  endApprovalRequest: (data) => api.post('/shifts/end-approval/request', data),
  getPendingShiftApprovals: () => api.get('/shifts/shift-approvals/pending'),
  approveShiftApproval: (id) => api.post(`/shifts/shift-approvals/${id}/approve`),
  rejectShiftApproval: (id, reason) => api.post(`/shifts/shift-approvals/${id}/reject`, null, { params: { reason } }),
  getShiftApprovalLogs: (params) => api.get('/shifts/shift-approvals/logs', { params }),
  getShiftLogs: (params) => api.get('/shifts/shift-logs', { params })
};

// Locations API (YENİ)
export const locationsAPI = {
  // Healmedy Lokasyonları
  getHealmedy: () => api.get('/locations/healmedy'),
  
  // Saha Lokasyonları
  getField: (params) => api.get('/locations/field', { params }),
  createField: (data) => api.post('/locations/field', data),
  getFieldById: (id) => api.get(`/locations/field/${id}`),
  getFieldByQR: (qr) => api.get(`/locations/field/qr/${qr}`),
  deleteField: (id) => api.delete(`/locations/field/${id}`),
  
  // Lokasyon Değişikliği
  createChangeRequest: (data) => api.post('/locations/change-request', data),
  getPendingChangeRequests: () => api.get('/locations/change-request/pending'),
  approveChange: (id) => api.post(`/locations/change-request/${id}/approve`),
  rejectChange: (id, data) => api.post(`/locations/change-request/${id}/reject`, data),
  
  // Araç Lokasyonu
  getVehicleLocation: (vehicleId) => api.get(`/locations/vehicle/${vehicleId}/current`),
  setVehicleLocation: (vehicleId, data) => api.post(`/locations/vehicle/${vehicleId}/set-location`, data),
  getVehiclesByLocation: (locationId) => api.get(`/locations/vehicles/by-location/${locationId}`),
  
  // GPS Tracking (YENİ)
  updateVehicleGPS: (vehicleId, data) => api.post(`/locations/vehicle/${vehicleId}/gps`, data),
  getVehicleGPSHistory: (vehicleId, params) => api.get(`/locations/vehicle/${vehicleId}/gps/history`, { params }),
  getVehicleLatestGPS: (vehicleId) => api.get(`/locations/vehicle/${vehicleId}/gps/latest`),
  getAllVehiclesGPS: () => api.get('/locations/vehicles/all-gps'),
  saveBatchLocations: (data) => api.post('/locations/batch', data)
};

// Users API
export const usersAPI = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.patch(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),  // Personel silme (sadece Op.Müdürü ve Merkez Ofis)
  assignTempRole: (id, role, duration) => api.post(`/users/${id}/assign-temp-role`, null, {
    params: { role, duration_days: duration }
  }),
  removeTempRole: (id, role) => api.delete(`/users/${id}/remove-temp-role`, {
    params: { role }
  }),
  getStaffPerformance: (params) => api.get('/users/staff-performance', { params }),
  // Profil fotoğrafı
  uploadPhoto: (photoBase64) => api.post('/users/me/photo', { photo_base64: photoBase64 }),
  deletePhoto: () => api.delete('/users/me/photo'),
  getMyPhoto: () => api.get('/users/me/photo'),
  getUserPhoto: (id) => api.get(`/users/${id}/photo`)
};

// Settings API
export const settingsAPI = {
  getProfile: () => api.get('/settings/profile'),
  updateProfile: (data) => api.patch('/settings/profile', data),
  getSystemInfo: () => api.get('/settings/system')
};

// PDF Templates API
export const pdfTemplatesAPI = {
  getAll: (params) => api.get('/pdf-templates', { params }),
  getById: (id) => api.get(`/pdf-templates/${id}`),
  getDefault: (usageType) => api.get(`/pdf-templates/default/${usageType}`),
  getBlockDefinitions: () => api.get('/pdf-templates/block-definitions'),
  create: (data) => api.post('/pdf-templates', data),
  update: (id, data) => api.patch(`/pdf-templates/${id}`, data),
  delete: (id) => api.delete(`/pdf-templates/${id}`),
  setDefault: (id) => api.post(`/pdf-templates/${id}/set-default`),
  duplicate: (id) => api.post(`/pdf-templates/${id}/duplicate`)
};

// Form Şablonları API (PDF + Tablo şablonları)
export const formTemplatesAPI = {
  getAll: (params) => api.get('/form-templates', { params }),
  getById: (id) => api.get(`/form-templates/${id}`),
  getDefault: (usageType) => api.get(`/form-templates/default/${usageType}`),
  getBlockDefinitions: () => api.get('/form-templates/block-definitions'),
  create: (data) => api.post('/form-templates', data),
  update: (id, data) => api.patch(`/form-templates/${id}`, data),
  delete: (id) => api.delete(`/form-templates/${id}`),
  setDefault: (id) => api.post(`/form-templates/${id}/set-default`),
  duplicate: (id) => api.post(`/form-templates/${id}/duplicate`),
  // Tablo şablonu için PDF oluştur
  generateTablePdf: (templateId, caseId) => api.get(`/form-templates/${templateId}/generate-pdf/${caseId}`, { responseType: 'blob' })
};

// Excel Şablonları API
export const excelTemplatesAPI = {
  getAll: () => api.get('/excel-templates'),
  getById: (id) => api.get(`/excel-templates/${id}`),
  create: (data) => api.post('/excel-templates', data),
  update: (id, data) => api.put(`/excel-templates/${id}`, data),
  delete: (id) => api.delete(`/excel-templates/${id}`),
  setDefault: (id) => api.post(`/excel-templates/${id}/set-default`),
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/excel-templates/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  importVakaFormu: (formData) => api.post('/excel-templates/import-from-file', formData)
};

// Şablonlu PDF Oluşturma API
export const pdfGeneratorAPI = {
  getAvailableTemplates: (usageType = 'vaka_formu') => api.get('/pdf-template/available', { params: { usage_type: usageType } }),
  generateCasePdf: (caseId, templateId = null) => api.get(`/pdf-template/case/${caseId}`, { 
    params: templateId ? { template_id: templateId } : {},
    responseType: 'blob'
  })
};

// Forms API
export const formsAPI = {
  submit: (data) => api.post('/forms', data),
  getAll: (params) => api.get('/forms', { params }),
  getById: (id) => api.get(`/forms/${id}`),
  delete: (id) => api.delete(`/forms/${id}`),
  getStats: () => api.get('/forms/stats/summary')
};

// Notifications API (OneSignal)
export const notificationsAPI = {
  // In-app Bildirimler
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/mark-all-read'),
  delete: (id) => api.delete(`/notifications/${id}`),
  
  // OneSignal Subscription
  subscribe: (data) => api.post('/notifications/subscribe', data),
  unsubscribe: () => api.delete('/notifications/unsubscribe'),
  getStatus: () => api.get('/notifications/status'),
  getConfig: () => api.get('/notifications/onesignal-config'),
  
  // FCM (Firebase Cloud Messaging) - Android
  registerFCM: (data) => api.post('/notifications/fcm/register', data),
  unregisterFCM: (token) => api.delete('/notifications/fcm/unregister', { params: { fcm_token: token } }),
  testFCM: () => api.post('/notifications/fcm/test'),
  getFCMStatus: () => api.get('/notifications/fcm/status'),
  
  // Tercihler
  getPreferences: () => api.get('/notifications/preferences'),
  updatePreferences: (prefs) => api.put('/notifications/preferences', prefs),
  
  // Master Code
  generateMasterCode: (data) => api.post('/notifications/generate-master-code', data),
  verifyMasterCode: (code) => api.post('/notifications/verify-master-code', null, { params: { code } }),
  
  // Test & Broadcast
  sendTest: (data) => api.post('/notifications/test', data),
  broadcast: (data) => api.post('/notifications/broadcast', null, { params: data })
};

// OTP API (Internal Onay Kodu)
export const otpAPI = {
  // Kendi OTP kodumu al
  getMyCode: () => api.get('/otp/my-code'),
  // OTP doğrula
  verify: (code, userId = null) => api.post('/otp/verify', { code, user_id: userId }),
  // Secret yenile
  regenerateSecret: () => api.post('/otp/regenerate-secret'),
  // Başka kullanıcının kodunu al (müdür)
  getUserCode: (userId) => api.get(`/otp/user/${userId}/code`),
  // Google Authenticator kurulumu
  getSetup: () => api.get('/otp/setup'),
  // Kurulumu doğrula
  verifySetup: (code) => api.post('/otp/verify-setup', { code })
};

// İTS - İlaç Takip Sistemi API
export const itsAPI = {
  // Durum
  getStatus: () => api.get('/its/status'),
  // Yapılandırma (müdür)
  configure: (data) => api.post('/its/configure', data),
  // İlaç senkronizasyonu
  syncDrugs: () => api.post('/its/sync-drugs'),
  // İlaç listesi
  getDrugs: (params) => api.get('/its/drugs', { params }),
  // GTIN ile ilaç getir
  getDrugByGtin: (gtin) => api.get(`/its/drugs/${gtin}`),
  // Karekod parse et
  parseBarcode: (barcode) => api.post('/its/parse-barcode', { barcode }),
  // İlaç ara
  searchDrugs: (query, limit = 20) => api.post('/its/search-drugs', { query, limit }),
  // Manuel ilaç ekle
  addManualDrug: (data) => api.post('/its/drugs/manual', data),
  // Manuel ilacı sil
  deleteDrug: (gtin) => api.delete(`/its/drugs/${gtin}`)
};

// Approvals API - Onay Sistemi (SMS + Email + Push)
export const approvalsAPI = {
  // Genel onay kodu doğrula (hem SMS/Email hem de Internal OTP destekler)
  verify: (data) => api.post('/approvals/verify', data),
  // Bekleyen onaylarım
  getPending: (type = null) => api.get('/approvals/pending', { params: { approval_type: type } }),
  // Devir teslim onayı oluştur (alıcıya)
  createHandover: (data) => api.post('/approvals/shift-handover', data),
  // Yönetici onayı talep et (Vardiya Başlatma için)
  requestManagerApproval: (data) => api.post('/approvals/request-manager-approval', data),
  // Yönetici onayı doğrula
  verifyManagerApproval: (data) => api.post('/approvals/verify-manager-approval', data),
  // Sonraki vardiya görevlisini getir
  getNextShiftUser: (vehicleId) => {
    if (!vehicleId || vehicleId === 'undefined') {
      console.warn('approvalsAPI.getNextShiftUser called with invalid vehicleId:', vehicleId);
      return Promise.resolve({ data: null });
    }
    return api.get(`/approvals/next-shift-user/${vehicleId}`);
  },
  // Devir teslim bilgilerini getir (otomatik doldurma)
  getHandoverInfo: (vehicleId) => {
    if (!vehicleId || vehicleId === 'undefined') {
      console.warn('approvalsAPI.getHandoverInfo called with invalid vehicleId:', vehicleId);
      return Promise.resolve({ data: null });
    }
    return api.get(`/approvals/handover-info/${vehicleId}`);
  }
};

// Patients API - Hasta Kartı Sistemi
export const patientsAPI = {
  // CRUD
  create: (data) => api.post('/patients', data),
  search: (params) => api.get('/patients/search', { params }),
  getByTc: (tcNo) => api.get(`/patients/by-tc/${tcNo}`),
  getById: (id) => api.get(`/patients/${id}`),
  update: (id, data) => api.patch(`/patients/${id}`, data),
  
  // Hemşire erişim talebi (OTP ile)
  requestAccess: (patientId, data) => api.post(`/patients/${patientId}/request-access`, data),
  
  // Alerji yönetimi
  addAllergy: (patientId, data) => api.post(`/patients/${patientId}/allergies`, data),
  removeAllergy: (patientId, allergyId) => api.delete(`/patients/${patientId}/allergies/${allergyId}`),
  
  // Kronik hastalık yönetimi
  addDisease: (patientId, data) => api.post(`/patients/${patientId}/chronic-diseases`, data),
  removeDisease: (patientId, diseaseId) => api.delete(`/patients/${patientId}/chronic-diseases/${diseaseId}`),
  
  // Doktor notu
  addDoctorNote: (patientId, data) => api.post(`/patients/${patientId}/doctor-notes`, data),
  removeDoctorNote: (patientId, noteId) => api.delete(`/patients/${patientId}/doctor-notes/${noteId}`),
  
  // Acil durum iletişim
  addEmergencyContact: (patientId, data) => api.post(`/patients/${patientId}/emergency-contacts`, data),
  
  // Tıbbi geçmiş
  getMedicalHistory: (patientId, limit = 20) => api.get(`/patients/${patientId}/medical-history`, { params: { limit } }),
  addMedicalHistory: (patientId, data) => api.post(`/patients/${patientId}/medical-history`, data),
  
  // Erişim logları
  getAccessLogs: (patientId, limit = 50) => api.get(`/patients/${patientId}/access-logs`, { params: { limit } }),
  getCaseCount: (patientId) => api.get(`/patients/${patientId}/case-count`),
  
  // İstatistikler
  getStats: () => api.get('/patients/stats/summary')
};

// Documents API - Döküman ve Arşiv Yönetimi
export const documentsAPI = {
  getArchive: (params) => api.get('/documents/archive', { params }),
  getById: (id) => api.get(`/documents/${id}`),
  upload: (data) => api.post('/documents/upload', data),
  delete: (id) => api.delete(`/documents/${id}`)
};

// Auth API (token yönetimi için)
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me')
};

// Karekod Bazlı Stok API
export const stockBarcodeAPI = {
  // Stok girişi - karekod ile ekle
  addByBarcode: (data) => api.post('/stock-barcode/add', data),
  
  // Karekod detayları
  getBarcodeDetails: (barcode) => api.get(`/stock-barcode/details/${encodeURIComponent(barcode)}`),
  
  // Vakada kullanım - stoktan düşme
  deductByBarcode: (data) => api.post('/stock-barcode/deduct', data),
  
  // Stoğa iade
  returnStock: (data) => api.post('/stock-barcode/return', data),
  
  // Envanter sorgulama
  getInventory: (params) => api.get('/stock-barcode/inventory', { params }),
  getInventoryByLocation: () => api.get('/stock-barcode/inventory/by-location'),
  getExpiringItems: (days = 30) => api.get(`/stock-barcode/expiring?days=${days}`),
  
  // TİTCK Veritabanı ile İlaç Adı Sorgulama
  lookupBarcode: (barcode) => api.get(`/stock-barcode/lookup-barcode/${encodeURIComponent(barcode)}`),
  lookupBarcodePost: (barcode) => api.post('/stock-barcode/lookup-barcode', { barcode }),
  searchMedications: (query) => api.get('/stock-barcode/search-medications', { params: { q: query } }),
  
  // YENİ: Adet Bazlı Stok (Açılmış İlaçlar)
  getUnitStock: (location) => api.get('/stock-barcode/unit-stock', { params: { location } }),
  openBox: (stockId) => api.post('/stock-barcode/open-box', { stock_id: stockId }),
  useUnitStock: (data) => api.post('/stock-barcode/unit-stock/use', data),
  
  // YENİ: Araç Lokasyonuna Göre Stok
  getByVehicleLocation: (vehicleId) => api.get(`/stock-barcode/by-vehicle-location/${vehicleId}`),
  
  // YENİ: İtriyat ve Sarf Stokları
  getItriyat: (location) => api.get('/stock-barcode/itriyat', { params: { location } }),
  getSarf: (location) => api.get('/stock-barcode/sarf', { params: { location } }),
  
  // YENİ: Toplu Stok Ekleme
  bulkAdd: (data) => api.post('/stock-barcode/bulk-add', data)
};

// Tickets API - Bildirim ve Talepler
export const ticketsAPI = {
  create: (data) => api.post('/tickets', data),
  getAll: (params) => api.get('/tickets', { params }),
  getTickets: (params) => api.get('/tickets', { params }), // Alias for getAll
  getById: (id) => api.get(`/tickets/${id}`),
  update: (id, data) => api.patch(`/tickets/${id}`, data),
  updateTicket: (id, data) => api.patch(`/tickets/${id}`, data), // Alias for update
  updateStatus: (id, status, notes) => api.patch(`/tickets/${id}/status`, null, { params: { status, notes } }),
  getPendingCount: () => api.get('/tickets/pending/count')
};

// Firms API - Firma Yönetimi
export const firmsAPI = {
  getAll: () => api.get('/firms'),
  create: (data) => api.post('/firms', data),
  delete: (id) => api.delete(`/firms/${id}`)
};

// Form Config API - Vaka Formu Yapılandırması
export const formConfigAPI = {
  getCaseFormFields: () => api.get('/form-config/case-form-fields'),
  updateCaseFormFields: (config) => api.put('/form-config/case-form-fields', { config }),
  resetCaseFormFields: () => api.post('/form-config/case-form-fields/reset'),
  getHistory: (limit = 10) => api.get('/form-config/case-form-fields/history', { params: { limit } }),
  getVersion: (version) => api.get(`/form-config/case-form-fields/version/${version}`)
};

export default api;
