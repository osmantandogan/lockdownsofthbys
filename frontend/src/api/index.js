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
  })
};

// Vehicles API
export const vehiclesAPI = {
  getAll: (params) => api.get('/vehicles', { params }),
  getById: (id) => api.get(`/vehicles/${id}`),
  getByQR: (qr) => api.get(`/vehicles/qr/${qr}`),
  create: (data) => api.post('/vehicles', data),
  update: (id, data) => api.patch(`/vehicles/${id}`, data),
  delete: (id) => api.delete(`/vehicles/${id}`),
  getStats: () => api.get('/vehicles/stats/summary')
};

// Stock API
export const stockAPI = {
  getAll: (params) => api.get('/stock', { params }),
  getById: (id) => api.get(`/stock/${id}`),
  getByQR: (qr) => api.get(`/stock/qr/${qr}`),
  create: (data) => api.post('/stock', data),
  update: (id, data) => api.patch(`/stock/${id}`, data),
  delete: (id) => api.delete(`/stock/${id}`),
  getAlerts: () => api.get('/stock/alerts/summary')
};

// Shifts API
export const shiftsAPI = {
  // Shift assignments
  createAssignment: (data) => api.post('/shifts/assignments', null, { params: data }),
  getMyAssignments: () => api.get('/shifts/assignments/my'),
  getAllAssignments: () => api.get('/shifts/assignments'),
  deleteAssignment: (id) => api.delete(`/shifts/assignments/${id}`),
  
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
  })
};

// Settings API
export const settingsAPI = {
  getProfile: () => api.get('/settings/profile'),
  updateProfile: (data) => api.patch('/settings/profile', data),
  getSystemInfo: () => api.get('/settings/system')
};

export default api;
