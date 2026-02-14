/**
 * History UI: list past OCR results, show details, export, delete.
 * @module modules/history-ui
 */

import { $, t, escapeHtml, localDateString, getRankClass } from '../utils/helpers.js';
import state from './state.js';
import { showConfirmDialog } from '../components/confirm-dialog.js';

const historyEmptyHint = $('#historyEmptyHint');
const historyListContainer = $('#historyListContainer');
const historyListBody = $('#historyListBody');
const historyDetailSection = $('#historyDetailSection');
const historyDetailTitle = $('#historyDetailTitle');
const historyDetailCount = $('#historyDetailCount');
const historyDetailBody = $('#historyDetailBody');
const historyEventDetailBody = $('#historyEventDetailBody');
const historyMemberTable = $('#historyMemberTable');
const historyEventTable = $('#historyEventTable');
const btnRefreshHistory = $('#btnRefreshHistory');
const btnOpenResultsDir = $('#btnOpenResultsDir');
const btnHistoryExportCsv = $('#btnHistoryExportCsv');

/** Load history entries from the main process. */
export async function loadHistory() {
  const result = await window.api.loadHistory();
  if (!result.ok) return;
  state.historyEntries = result.entries;
  if (state.historyEntries.length === 0) {
    historyEmptyHint.style.display = 'block';
    historyListContainer.style.display = 'none';
    historyDetailSection.style.display = 'none';
    return;
  }
  historyEmptyHint.style.display = 'none';
  historyListContainer.style.display = 'block';
  renderHistoryList();
}

/** Render the history list table. */
export function renderHistoryList() {
  historyListBody.innerHTML = '';
  const locale = window.i18n.getLanguage() === 'en' ? 'en-US' : 'de-DE';
  state.historyEntries.forEach(entry => {
    const tr = document.createElement('tr');
    if (state.selectedHistoryFile === entry.fileName) tr.classList.add('active');
    const dateFormatted = new Date(entry.date + 'T00:00:00').toLocaleDateString(locale, {
      weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const typeLabel = entry.type === 'event' ? t('history.typeEvent') : t('history.typeMember');
    const countLabel = entry.type === 'event'
      ? t('format.eventPlayerCount', { count: entry.memberCount })
      : t('format.memberCount', { count: entry.memberCount });
    tr.innerHTML = `
      <td><span class="history-date">${dateFormatted}</span></td>
      <td><span class="validation-mode-badge mode-${entry.type || 'member'}">${typeLabel}</span></td>
      <td>${countLabel}</td>
      <td class="info-text">${escapeHtml(entry.fileName)}</td>
      <td><button class="history-delete-btn" title="${t('tooltip.removeName')}">&times;</button></td>
    `;
    tr.addEventListener('click', (e) => {
      if (e.target.closest('.history-delete-btn')) return;
      state.selectedHistoryFile = entry.fileName;
      renderHistoryList();
      loadHistoryDetail(entry.fileName);
    });
    tr.querySelector('.history-delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!(await showConfirmDialog(t('confirm.deleteHistory', { fileName: entry.fileName })))) return;
      await window.api.deleteHistoryEntry(entry.fileName);
      if (state.selectedHistoryFile === entry.fileName) {
        state.selectedHistoryFile = null;
        historyDetailSection.style.display = 'none';
        state.historyMembers = null;
      }
      await loadHistory();
    });
    historyListBody.appendChild(tr);
  });
}

/** Load and display detail for a single history entry. */
async function loadHistoryDetail(fileName) {
  const result = await window.api.loadHistoryEntry(fileName);
  if (!result.ok) return;
  const type = result.type || 'member';
  if (type === 'event') {
    state.historyMembers = null;
    renderHistoryEventDetail(result.entries || [], fileName);
  } else {
    state.historyMembers = result.members;
    renderHistoryMemberDetail(result.members, fileName);
  }
}

/** Render member history detail table. */
function renderHistoryMemberDetail(members, fileName) {
  historyDetailSection.style.display = 'block';
  historyMemberTable.style.display = '';
  historyEventTable.style.display = 'none';
  const locale = window.i18n.getLanguage() === 'en' ? 'en-US' : 'de-DE';
  const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
  const dateStr = dateMatch
    ? new Date(dateMatch[1] + 'T00:00:00').toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
    : fileName;
  historyDetailTitle.textContent = t('history.resultTitle', { date: dateStr });
  historyDetailCount.textContent = t('format.memberCount', { count: members.length });
  historyDetailBody.innerHTML = '';
  members.forEach((m, idx) => {
    const tr = document.createElement('tr');
    const rankClass = getRankClass(m.rank);
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><span class="ocr-rank-badge ${rankClass}">${escapeHtml(m.rank)}</span></td>
      <td>${escapeHtml(m.name)}</td>
      <td>${escapeHtml(m.coords)}</td>
      <td>${m.score.toLocaleString('de-DE')}</td>
    `;
    historyDetailBody.appendChild(tr);
  });
  setTimeout(() => historyDetailSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

/** Render event history detail table. */
function renderHistoryEventDetail(entries, fileName) {
  historyDetailSection.style.display = 'block';
  historyMemberTable.style.display = 'none';
  historyEventTable.style.display = '';
  const locale = window.i18n.getLanguage() === 'en' ? 'en-US' : 'de-DE';
  const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
  const dateStr = dateMatch
    ? new Date(dateMatch[1] + 'T00:00:00').toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
    : fileName;
  historyDetailTitle.textContent = t('history.resultTitle', { date: dateStr });
  historyDetailCount.textContent = t('format.eventPlayerCount', { count: entries.length });
  historyEventDetailBody.innerHTML = '';
  entries.forEach((e, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${escapeHtml(e.name)}</td>
      <td>${e.power.toLocaleString('de-DE')}</td>
      <td>${e.eventPoints.toLocaleString('de-DE')}</td>
    `;
    historyEventDetailBody.appendChild(tr);
  });
  setTimeout(() => historyDetailSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

/**
 * Initialize history UI event listeners.
 */
export function initHistoryUI() {
  btnRefreshHistory.addEventListener('click', () => loadHistory());
  btnOpenResultsDir.addEventListener('click', () => window.api.openResultsDir());
  btnHistoryExportCsv.addEventListener('click', async () => {
    const isEvent = state.selectedHistoryFile && state.selectedHistoryFile.startsWith('event_');
    if (isEvent) {
      const result = await window.api.loadHistoryEntry(state.selectedHistoryFile);
      if (result.ok && result.entries) {
        const defaultName = state.selectedHistoryFile || `event_${localDateString()}.csv`;
        await window.api.exportEventCsv(result.entries, defaultName);
      }
    } else {
      if (!state.historyMembers || state.historyMembers.length === 0) return;
      const defaultName = state.selectedHistoryFile || `mitglieder_${localDateString()}.csv`;
      await window.api.exportCsv(state.historyMembers, defaultName);
    }
  });
}

/** Refresh dynamic i18n texts for history UI. */
export function refreshHistoryUI() {
  if (state.historyEntries.length > 0) renderHistoryList();
  if (state.historyMembers && state.selectedHistoryFile) {
    renderHistoryMemberDetail(state.historyMembers, state.selectedHistoryFile);
  }
}
