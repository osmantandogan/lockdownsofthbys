/**
 * SessionManager - Çoklu Oturum Yönetimi
 * Ambulans ekibi için tek cihazda birden fazla rol oturumu yönetimi
 * Şoför, ATT, Paramedik aynı anda oturum açık tutabilir
 */

const SESSIONS_KEY = 'healmedy_multi_sessions';
const ACTIVE_ROLE_KEY = 'healmedy_active_role';

// Desteklenen roller
const FIELD_ROLES = ['sofor', 'att', 'paramedik'];

// Rol etiketleri
const ROLE_LABELS = {
  sofor: 'Şoför',
  att: 'ATT',
  paramedik: 'Paramedik',
  hemsire: 'Hemşire',
  doktor: 'Doktor',
  cagri_merkezi: 'Çağrı Merkezi',
  operasyon_muduru: 'Operasyon Müdürü',
  merkez_ofis: 'Merkez Ofis'
};

// Rol ikonları (lucide icon isimleri)
const ROLE_ICONS = {
  sofor: 'Car',
  att: 'Stethoscope',
  paramedik: 'Heart'
};

// Rol renkleri
const ROLE_COLORS = {
  sofor: {
    bg: 'bg-blue-500',
    hover: 'hover:bg-blue-600',
    text: 'text-blue-600',
    border: 'border-blue-500',
    light: 'bg-blue-50'
  },
  att: {
    bg: 'bg-green-500',
    hover: 'hover:bg-green-600',
    text: 'text-green-600',
    border: 'border-green-500',
    light: 'bg-green-50'
  },
  paramedik: {
    bg: 'bg-red-500',
    hover: 'hover:bg-red-600',
    text: 'text-red-600',
    border: 'border-red-500',
    light: 'bg-red-50'
  }
};

/**
 * Tüm oturumları getir
 */
const getSessions = () => {
  try {
    const sessionsStr = localStorage.getItem(SESSIONS_KEY);
    return sessionsStr ? JSON.parse(sessionsStr) : {};
  } catch (error) {
    console.error('[SessionManager] Error reading sessions:', error);
    return {};
  }
};

/**
 * Oturumları kaydet
 */
const saveSessions = (sessions) => {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('[SessionManager] Error saving sessions:', error);
  }
};

/**
 * Belirli bir rol için oturum ekle
 */
const addSession = (role, userData, token) => {
  const sessions = getSessions();
  sessions[role] = {
    user: userData,
    token: token,
    loginTime: new Date().toISOString(),
    lastActive: new Date().toISOString()
  };
  saveSessions(sessions);
  console.log(`[SessionManager] Session added for role: ${role}`);
  return sessions[role];
};

/**
 * Belirli bir rol için oturumu kaldır
 */
const removeSession = (role) => {
  const sessions = getSessions();
  if (sessions[role]) {
    delete sessions[role];
    saveSessions(sessions);
    console.log(`[SessionManager] Session removed for role: ${role}`);
  }
  
  // Eğer aktif rol bu ise, aktif rolü temizle
  if (getActiveRole() === role) {
    clearActiveRole();
  }
};

/**
 * Tüm oturumları temizle
 */
const clearAllSessions = () => {
  localStorage.removeItem(SESSIONS_KEY);
  localStorage.removeItem(ACTIVE_ROLE_KEY);
  console.log('[SessionManager] All sessions cleared');
};

/**
 * Belirli bir rolün oturumu var mı?
 */
const hasSession = (role) => {
  const sessions = getSessions();
  return !!sessions[role]?.token;
};

/**
 * Belirli bir rolün oturum bilgisini getir
 */
const getSession = (role) => {
  const sessions = getSessions();
  return sessions[role] || null;
};

/**
 * Aktif rolü getir
 */
const getActiveRole = () => {
  return localStorage.getItem(ACTIVE_ROLE_KEY);
};

/**
 * Aktif rolü ayarla
 */
const setActiveRole = (role) => {
  if (role) {
    localStorage.setItem(ACTIVE_ROLE_KEY, role);
    
    // Son aktif zamanı güncelle
    const sessions = getSessions();
    if (sessions[role]) {
      sessions[role].lastActive = new Date().toISOString();
      saveSessions(sessions);
    }
    
    console.log(`[SessionManager] Active role set to: ${role}`);
  }
};

/**
 * Aktif rolü temizle
 */
const clearActiveRole = () => {
  localStorage.removeItem(ACTIVE_ROLE_KEY);
  console.log('[SessionManager] Active role cleared');
};

/**
 * Aktif oturumu getir (mevcut aktif rolün oturumu)
 */
const getActiveSession = () => {
  const activeRole = getActiveRole();
  if (!activeRole) return null;
  return getSession(activeRole);
};

/**
 * Oturumu olan tüm rolleri getir
 */
const getLoggedInRoles = () => {
  const sessions = getSessions();
  return Object.keys(sessions).filter(role => sessions[role]?.token);
};

/**
 * Saha rollerinden oturumu olanları getir
 */
const getLoggedInFieldRoles = () => {
  return getLoggedInRoles().filter(role => FIELD_ROLES.includes(role));
};

/**
 * Rol bilgilerini getir
 */
const getRoleInfo = (role) => {
  return {
    key: role,
    label: ROLE_LABELS[role] || role,
    icon: ROLE_ICONS[role],
    colors: ROLE_COLORS[role],
    isFieldRole: FIELD_ROLES.includes(role),
    hasSession: hasSession(role),
    session: getSession(role)
  };
};

/**
 * Saha rollerinin durumlarını getir
 */
const getFieldRolesStatus = () => {
  return FIELD_ROLES.map(role => getRoleInfo(role));
};

/**
 * Token'ı belirli bir rol için güncelle
 */
const updateToken = (role, newToken) => {
  const sessions = getSessions();
  if (sessions[role]) {
    sessions[role].token = newToken;
    sessions[role].lastActive = new Date().toISOString();
    saveSessions(sessions);
  }
};

/**
 * Kullanıcı bilgisini güncelle
 */
const updateUserData = (role, userData) => {
  const sessions = getSessions();
  if (sessions[role]) {
    sessions[role].user = { ...sessions[role].user, ...userData };
    sessions[role].lastActive = new Date().toISOString();
    saveSessions(sessions);
  }
};

/**
 * Oturum sayısını getir
 */
const getSessionCount = () => {
  return getLoggedInRoles().length;
};

/**
 * Belirli bir rol için oturum geçerli mi kontrol et
 */
const isSessionValid = (role) => {
  const session = getSession(role);
  if (!session || !session.token) return false;
  
  // Token süresi kontrolü (opsiyonel - JWT decode gerektirir)
  // Şimdilik sadece token varlığını kontrol ediyoruz
  return true;
};

// Export
const SessionManager = {
  // Constants
  FIELD_ROLES,
  ROLE_LABELS,
  ROLE_ICONS,
  ROLE_COLORS,
  
  // Session CRUD
  getSessions,
  addSession,
  removeSession,
  clearAllSessions,
  hasSession,
  getSession,
  
  // Active role
  getActiveRole,
  setActiveRole,
  clearActiveRole,
  getActiveSession,
  
  // Queries
  getLoggedInRoles,
  getLoggedInFieldRoles,
  getRoleInfo,
  getFieldRolesStatus,
  getSessionCount,
  isSessionValid,
  
  // Updates
  updateToken,
  updateUserData
};

export default SessionManager;

