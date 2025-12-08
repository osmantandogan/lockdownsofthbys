/**
 * Constants Index
 * Tüm sabit değerleri buradan export ediyoruz
 */

export { COMPANIES, searchCompanies, getCompanyById, getCompanyByName } from './companies';

// Rol tanımları
export const ROLES = {
  SOFOR: 'sofor',
  BAS_SOFOR: 'bas_sofor',
  HEMSIRE: 'hemsire',
  DOKTOR: 'doktor',
  PARAMEDIK: 'paramedik',
  ATT: 'att',
  MERKEZ_OFIS: 'merkez_ofis',
  OPERASYON_MUDURU: 'operasyon_muduru',
  CAGRI_MERKEZI: 'cagri_merkezi'
};

// Rol etiketleri
export const ROLE_LABELS = {
  sofor: 'Şoför',
  bas_sofor: 'Baş Şoför',
  hemsire: 'Hemşire',
  doktor: 'Doktor',
  paramedik: 'Paramedik',
  att: 'ATT',
  merkez_ofis: 'Merkez Ofis',
  operasyon_muduru: 'Operasyon Müdürü',
  cagri_merkezi: 'Çağrı Merkezi'
};

// Öncelik seviyeleri
export const PRIORITY_LEVELS = {
  YUKSEK: 'yuksek',
  ORTA: 'orta',
  DUSUK: 'dusuk'
};

export const PRIORITY_LABELS = {
  yuksek: 'Yüksek',
  orta: 'Orta',
  dusuk: 'Düşük'
};

export const PRIORITY_COLORS = {
  yuksek: 'red',
  orta: 'yellow',
  dusuk: 'green'
};

// Vaka durumları
export const CASE_STATUS = {
  ACIK: 'acik',
  DEVAM_EDIYOR: 'devam_ediyor',
  KAPALI: 'kapali',
  IPTAL: 'iptal'
};

export const CASE_STATUS_LABELS = {
  acik: 'Açık',
  devam_ediyor: 'Devam Ediyor',
  kapali: 'Kapalı',
  iptal: 'İptal'
};

// Araç durumları
export const VEHICLE_STATUS = {
  MUSAIT: 'musait',
  GOREVDE: 'gorevde',
  BAKIM: 'bakim',
  PASIF: 'pasif'
};

export const VEHICLE_STATUS_LABELS = {
  musait: 'Müsait',
  gorevde: 'Görevde',
  bakim: 'Bakımda',
  pasif: 'Pasif'
};

// Yakınlık ilişkileri
export const RELATIONSHIPS = [
  { value: 'kendisi', label: 'Kendisi' },
  { value: 'esi', label: 'Eşi' },
  { value: 'annesi', label: 'Annesi' },
  { value: 'babasi', label: 'Babası' },
  { value: 'cocugu', label: 'Çocuğu' },
  { value: 'kardesi', label: 'Kardeşi' },
  { value: 'arkadasi', label: 'Arkadaşı' },
  { value: 'komsusu', label: 'Komşusu' },
  { value: 'is_arkadasi', label: 'İş Arkadaşı' },
  { value: 'diger', label: 'Diğer' }
];

// Cinsiyet seçenekleri
export const GENDERS = [
  { value: 'erkek', label: 'Erkek' },
  { value: 'kadin', label: 'Kadın' },
  { value: 'diger', label: 'Diğer' }
];

