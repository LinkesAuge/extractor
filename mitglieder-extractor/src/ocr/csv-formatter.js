const BOM = '\uFEFF';

/**
 * Formats a member list as a CSV string (UTF-8 with BOM for Excel).
 * @param {Array<{name: string, coords: string, score: number}>} members
 * @returns {string} CSV content.
 */
export function toMemberCSV(members) {
  const header = 'Name,Koordinaten,Score';
  const rows = members.map(m =>
    `"${(m.name ?? '').replace(/"/g, '""')}","${(m.coords ?? '')}",${m.score}`
  );
  return BOM + [header, ...rows].join('\r\n');
}

/**
 * Formats an event list as a CSV string (UTF-8 with BOM for Excel).
 * @param {Array<{name: string, power: number, eventPoints: number}>} entries
 * @returns {string} CSV content.
 */
export function toEventCSV(entries) {
  const header = 'Name,Macht,Event-Punkte';
  const rows = entries.map(e =>
    `"${e.name.replace(/"/g, '""')}",${e.power},${e.eventPoints}`
  );
  return BOM + [header, ...rows].join('\r\n');
}
