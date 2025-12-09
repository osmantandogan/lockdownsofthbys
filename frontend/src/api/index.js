import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// Token yönetimi
const TOKEN_KEY = 'healmedy_session_token';

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
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
    const token = getAuthToken();
    if (token && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${token}`;
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
  exportExcel: (id) => api.get(`/cases/${id}/export-excel`, { responseType: 'blob' })
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
  getHospitalsGrouped: () => api.get('/reference/hospitals/grouped')
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
  getKmReport: (id, params) => api.get(`/vehicles/km-report/${id}`, { params })
};

// Stock API
export const stockAPI = {
  getAll: (params) => api.get('/stock', { params }),
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
  getItemBarcodeDetails: (locationId, itemName) => api.get(`/stock/locations/${locationId}/items/${encodeURIComponent(itemName)}/details`)
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
  getTodayAssignments: () => api.get('/shifts/assignments/today'),
  deleteAssignment: (id) => api.delete(`/shifts/assignments/${id}`),
  startAssignmentByAdmin: (id) => api.post(`/shifts/assignments/${id}/start`),
  
  // Shifts
  start: (data) => api.post('/shifts/start', data),
  end: (data) => api.post('/shifts/end', data),
  getActive: () => api.get('/shifts/active'),
  getHistory: (params) => api.get('/shifts/history', { params }),
  getStats: (params) => api.get('/shifts/stats/summary', { params }),
  
  // Shift Photos
  getPhotos: (params) => api.get('/shifts/photos', { params }),
  getPhotosByShiftId: (shiftId) => api.get(`/shifts/photos/${shiftId}`)
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
  getUserCode: (userId) => api.get(`/otp/user/${userId}/code`)
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

// Auth API (token yönetimi için)
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me')
};

export default api;
