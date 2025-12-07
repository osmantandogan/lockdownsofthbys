import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// Cases API
export const casesAPI = {
  getAll: (params) => api.get('/cases', { params }),
  getById: (id) => api.get(`/cases/${id}`),
  create: (data) => api.post('/cases', data),
  assignTeam: (id, data) => api.post(`/cases/${id}/assign-team`, data),
  updateStatus: (id, data) => api.patch(`/cases/${id}/status`, data),
  getStats: () => api.get('/cases/stats/dashboard'),
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
  startVideoCall: (id) => api.post(`/cases/${id}/start-video-call`)
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
  getById: (id) => api.get(`/vehicles/${id}`),
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
  getVehicleStock: (vehicleId) => api.get(`/medications/vehicles/${vehicleId}/stock`)
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
  getStats: (params) => api.get('/shifts/stats/summary', { params })
};

// Users API
export const usersAPI = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.patch(`/users/${id}`, data),
  assignTempRole: (id, role, duration) => api.post(`/users/${id}/assign-temp-role`, null, {
    params: { role, duration_days: duration }
  }),
  removeTempRole: (id, role) => api.delete(`/users/${id}/remove-temp-role`, {
    params: { role }
  }),
  getStaffPerformance: (params) => api.get('/users/staff-performance', { params })
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

// Notifications API
export const notificationsAPI = {
  // Bildirimler
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/mark-all-read'),
  delete: (id) => api.delete(`/notifications/${id}`),
  
  // Push subscription
  subscribePush: (subscription) => api.post('/notifications/subscribe-push', subscription),
  subscribeFCM: (fcmToken) => api.post('/notifications/subscribe-fcm', { fcm_token: fcmToken }),
  unsubscribePush: (subscription) => api.delete('/notifications/unsubscribe-push', { data: subscription }),
  getVapidPublicKey: () => api.get('/notifications/vapid-public-key'),
  
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

export default api;
