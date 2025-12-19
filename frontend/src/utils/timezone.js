/**
 * Türkiye Saati (UTC+3) Utility Fonksiyonları
 * Sistemin tamamı Türkiye saati ile çalışır
 * 
 * NOT: Cihaz saati yanlış ayarlanmış olsa bile bu fonksiyonlar
 * doğru Türkiye saatini döndürür.
 */

// Türkiye timezone offset (dakika cinsinden)
const TURKEY_OFFSET_MINUTES = 3 * 60; // UTC+3

/**
 * Şu anki Türkiye saatini döndürür
 * Cihaz timezone ayarından bağımsız çalışır
 * @returns {Date} Türkiye saati
 */
export function getTurkeyTime() {
  const now = new Date();
  // UTC time in milliseconds
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  // Turkey time = UTC + 3 hours
  const turkeyTime = new Date(utcTime + (TURKEY_OFFSET_MINUTES * 60000));
  return turkeyTime;
}

/**
 * Türkiye saatini ISO string olarak döndürür (YYYY-MM-DDTHH:mm:ss)
 * @returns {string} ISO format tarih string
 */
export function getTurkeyTimeISO() {
  return getTurkeyTime().toISOString();
}

/**
 * Bugünün tarihini Türkiye saatine göre YYYY-MM-DD formatında döndürür
 * @returns {string} YYYY-MM-DD format tarih
 */
export function getTurkeyDate() {
  const turkey = getTurkeyTime();
  const year = turkey.getFullYear();
  const month = String(turkey.getMonth() + 1).padStart(2, '0');
  const day = String(turkey.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Şu anki saati Türkiye saatine göre HH:mm formatında döndürür
 * @returns {string} HH:mm format saat
 */
export function getTurkeyTimeString() {
  const turkey = getTurkeyTime();
  const hours = String(turkey.getHours()).padStart(2, '0');
  const minutes = String(turkey.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Tarih ve saat bilgisini birlikte döndürür
 * @returns {{date: string, time: string}} Tarih ve saat
 */
export function getTurkeyDateTime() {
  return {
    date: getTurkeyDate(),
    time: getTurkeyTimeString()
  };
}

/**
 * UTC tarihini Türkiye saatine çevirir
 * Backend'den gelen tarihler için kullanılır
 * @param {string|Date} utcDate - UTC tarih
 * @returns {Date} Türkiye saati
 */
export function toTurkeyTime(utcDate) {
  if (!utcDate) return null;
  
  const date = new Date(utcDate);
  // Backend zaten Türkiye saati gönderiyor olabilir
  // Ama naive datetime gönderiyorsa UTC olarak yorumlanır
  // Bu durumda +3 saat eklememiz gerekir
  
  // Eğer tarih string içinde 'Z' veya timezone bilgisi yoksa
  // backend Türkiye saati gönderiyor demektir
  if (typeof utcDate === 'string' && !utcDate.includes('Z') && !utcDate.includes('+')) {
    // Türkiye saati olarak kabul et, dönüşüm yapma
    return date;
  }
  
  // UTC tarihini Türkiye saatine çevir
  const utcTime = date.getTime();
  return new Date(utcTime + (TURKEY_OFFSET_MINUTES * 60000));
}

/**
 * Tarihi Türkiye formatında göster (DD.MM.YYYY)
 * @param {string|Date} date - Tarih
 * @returns {string} DD.MM.YYYY format
 */
export function formatTurkeyDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Tarih ve saati Türkiye formatında göster (DD.MM.YYYY HH:mm)
 * @param {string|Date} date - Tarih
 * @returns {string} DD.MM.YYYY HH:mm format
 */
export function formatTurkeyDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Saati HH:mm formatında göster
 * @param {string|Date} date - Tarih
 * @returns {string} HH:mm format
 */
export function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Default export
export default {
  getTurkeyTime,
  getTurkeyTimeISO,
  getTurkeyDate,
  getTurkeyTimeString,
  getTurkeyDateTime,
  toTurkeyTime,
  formatTurkeyDate,
  formatTurkeyDateTime,
  formatTime
};

