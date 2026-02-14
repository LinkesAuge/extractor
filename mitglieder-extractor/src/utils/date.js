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
