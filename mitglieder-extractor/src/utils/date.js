/**
 * Returns today's date as YYYY-MM-DD in local timezone.
 * @returns {string} Date string in ISO local format.
 */
export function localDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns current date and time as YYYY-MM-DD_HH-MM-SS in local timezone.
 * Suitable for unique, sortable filenames that include both date and time.
 * @param {Date} [date=new Date()] - Date to format.
 * @returns {string} DateTime string (e.g. "2026-02-14_17-30-45").
 */
export function localDateTime(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const sec = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day}_${h}-${min}-${sec}`;
}

/**
 * Returns a timestamp string suitable for session directory names.
 * Format: YYYYMMDD_HH_MM
 * @param {Date} [date=new Date()] - Date to format.
 * @returns {string} Formatted timestamp string.
 */
export function formatSessionTimestamp(date = new Date()) {
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
  const timePart = [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
  ].join('_');
  return `${datePart}_${timePart}`;
}
