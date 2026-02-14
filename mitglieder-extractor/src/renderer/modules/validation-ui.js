/**
 * Validation UI: OCR result validation, name list management, corrections.
 * @module modules/validation-ui
 */

import { $, $$, t, escapeHtml, localDateTimeString, switchToSubTab } from '../utils/helpers.js';
import state from './state.js';
import { showInputDialog } from '../components/input-dialog.js';
import { showConfirmDialog, showAlertDialog } from '../components/confirm-dialog.js';
import { switchToTab } from './tab-manager.js';

// ─── DOM Elements ──────────────────────────────────────────────────────────

const validationSummary = $('#validationSummary');
const validationEmptyHint = $('#validationEmptyHint');
const validationOcrContent = $('#validationOcrContent');
const validationOcrBody = $('#validationOcrBody');
const validationOcrHead = $('#validationOcrHead');
const validationOcrPagination = $('#validationOcrPagination');

/** Max rows to render at once; above this, pagination is used. */
const VISIBLE_ROWS = 100;

/** Current page index (0-based) for validation OCR table pagination. */
let validationOcrCurrentPage = 0;
const validationSearch = $('#validationSearch');
const validationNamesList = $('#validationNamesList');
const validationNameCount = $('#validationNameCount');
const correctionsList = $('#correctionsList');
const correctionCount = $('#correctionCount');
const correctionFromInput = $('#correctionFromInput');
const correctionToInput = $('#correctionToInput');
const btnAddManualCorrection = $('#btnAddManualCorrection');
const correctionSearch = $('#correctionSearch');
const btnAcceptAllSuggestions = $('#btnAcceptAllSuggestions');
const btnAddSelectedToList = $('#btnAddSelectedToList');
const validationFilterBtns = $$('.validation-filter-btn');
const btnAddValidationName = $('#btnAddValidationName');
const btnValidationExportCsv = $('#btnValidationExportCsv');
const btnImportValidation = $('#btnImportValidation');
const btnExportValidation = $('#btnExportValidation');
const btnRevalidate = $('#btnRevalidate');
const validationModeSubTabBar = $('#validationModeSubTabBar');

// ─── Core Validation Logic ─────────────────────────────────────────────────

/** Load the validation list (names + corrections) from the main process. */
export async function loadValidationList() {
  const result = await window.api.loadValidationList();
  if (result.ok) {
    state.validationKnownNames = result.knownNames || [];
    state.validationCorrections = result.corrections || {};
    renderValidationNames();
    renderCorrections();
    if (state.ocrMembers && state.ocrMembers.length > 0 && state.validationKnownNames.length > 0 && !state.validatedMembers) {
      await validateCurrentResults();
    }
  }
}

/** Validate the current OCR results using the main process. */
export async function validateCurrentResults() {
  const members = state.validationMode === 'event' ? state.eventOcrEntries : state.ocrMembers;
  if (!members || members.length === 0) {
    validationEmptyHint.style.display = 'block';
    validationOcrContent.style.display = 'none';
    validationSummary.textContent = '';
    return;
  }
  const options = state.validationMode === 'event' ? { mode: 'event' } : {};
  const result = await window.api.validateOcrResults(members, options);
  if (result.ok) {
    state.validatedMembers = result.members;
    validationOcrCurrentPage = 0;
    validationEmptyHint.style.display = 'none';
    validationOcrContent.style.display = '';
    renderValidationOcrTable();
    updateValidationSummary();
    await loadValidationList();
  }
}

/** Update the validation summary line. */
function updateValidationSummary() {
  if (!state.validatedMembers) return;
  const counts = { confirmed: 0, corrected: 0, suggested: 0, unknown: 0 };
  state.validatedMembers.forEach(m => counts[m.validationStatus]++);
  const total = state.validatedMembers.length;
  const ok = counts.confirmed + counts.corrected;
  validationSummary.textContent = t('validation.summary', {
    ok, total, suggested: counts.suggested, unknown: counts.unknown,
  });
}

// ─── Validation OCR Table ──────────────────────────────────────────────────

/** Render the validation OCR results table. */
export function renderValidationOcrTable() {
  validationOcrBody.innerHTML = '';
  if (!state.validatedMembers) return;

  const isEvent = state.validationMode === 'event';
  const activeEntries = isEvent ? state.eventOcrEntries : state.ocrMembers;

  // Build table header with sortable columns
  validationOcrHead.innerHTML = '';
  const headerTr = document.createElement('tr');
  const checkboxTh = `<th class="th-checkbox"><input type="checkbox" id="validationSelectAll" title="${t('tooltip.selectAll')}"></th>`;
  const sortIcon = (col) => {
    if (state.validationSortColumn !== col) return '';
    return state.validationSortDirection === 'asc' ? ' &#9650;' : ' &#9660;';
  };
  const sortTh = (col, label) =>
    `<th class="th-sortable${state.validationSortColumn === col ? ' th-sorted' : ''}" data-sort="${col}">${label}${sortIcon(col)}</th>`;
  if (isEvent) {
    headerTr.innerHTML = `${checkboxTh}<th class="th-rownum">#</th>${sortTh('status', t('th.status'))}${sortTh('name', t('th.ocrName'))}${sortTh('suggestion', t('th.correctionSuggestion'))}${sortTh('power', t('th.power'))}${sortTh('eventPoints', t('th.eventPoints'))}<th></th>`;
  } else {
    headerTr.innerHTML = `${checkboxTh}<th class="th-rownum">#</th>${sortTh('status', t('th.status'))}${sortTh('name', t('th.ocrName'))}${sortTh('suggestion', t('th.correctionSuggestion'))}${sortTh('coords', t('th.coords'))}${sortTh('score', t('th.score'))}<th></th>`;
  }
  validationOcrHead.appendChild(headerTr);
  // Bind sort click handlers
  headerTr.querySelectorAll('.th-sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (state.validationSortColumn === col) {
        state.validationSortDirection = state.validationSortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.validationSortColumn = col;
        state.validationSortDirection = 'asc';
      }
      renderValidationOcrTable();
    });
  });
  const newSelectAll = validationOcrHead.querySelector('#validationSelectAll');

  // Track active corrections
  state.activeCorrections.clear();
  state.validatedMembers.forEach(m => {
    if (m.validationStatus === 'corrected' && m.originalName && m.originalName !== m.name) {
      state.activeCorrections.add(m.originalName);
    }
  });

  const statusLabels = {
    confirmed: t('validation.confirmed'),
    corrected: t('validation.corrected'),
    suggested: t('validation.suggested'),
    unknown: t('validation.unknown'),
  };

  const visibleIndices = [];
  state.validatedMembers.forEach((m, idx) => {
    if (state.validationFilter !== 'all' && m.validationStatus !== state.validationFilter) return;
    visibleIndices.push(idx);
  });

  // Sort visible indices if a sort column is active
  if (state.validationSortColumn) {
    sortVisibleIndices(visibleIndices, state.validationSortColumn, state.validationSortDirection, isEvent, activeEntries);
  }

  const usePagination = visibleIndices.length > VISIBLE_ROWS;
  let indicesToRender = visibleIndices;
  if (usePagination) {
    const totalPages = Math.ceil(visibleIndices.length / VISIBLE_ROWS);
    validationOcrCurrentPage = Math.min(Math.max(0, validationOcrCurrentPage), totalPages - 1);
    const startIdx = validationOcrCurrentPage * VISIBLE_ROWS;
    indicesToRender = visibleIndices.slice(startIdx, startIdx + VISIBLE_ROWS);
  }

  indicesToRender.forEach((idx) => {
    const m = state.validatedMembers[idx];
    const tr = document.createElement('tr');
    tr.className = `v-row-${m.validationStatus}`;
    if (state.selectedOcrRow === idx) tr.classList.add('selected');

    const statusLabel = statusLabels[m.validationStatus] || m.validationStatus;
    const isChecked = state.selectedOcrRows.has(idx) ? 'checked' : '';

    const correctionHtml = buildCorrectionHtml(m);
    const actionHtml = buildActionHtml(m, idx, activeEntries);

    const scoreColumnsHtml = buildScoreColumns(isEvent, activeEntries, idx);

    tr.innerHTML = `
      <td class="td-checkbox"><input type="checkbox" class="v-row-checkbox" data-idx="${idx}" ${isChecked}></td>
      <td class="td-rownum">${idx + 1}</td>
      <td><span class="v-status v-status-${m.validationStatus}"></span> ${statusLabel}</td>
      <td>${escapeHtml(m.validationStatus === 'corrected' ? m.originalName : m.name)}</td>
      <td>${correctionHtml}</td>
      ${scoreColumnsHtml}
      <td class="td-actions">${actionHtml}</td>
    `;

    tr.addEventListener('click', (e) => {
      if (e.target.closest('.v-action-btn') || e.target.closest('.v-row-checkbox') || e.target.closest('.td-score')) return;
      state.selectedOcrRow = idx;
      renderValidationOcrTable();
    });

    validationOcrBody.appendChild(tr);
  });

  bindCheckboxes(indicesToRender, newSelectAll);
  bindScoreEditing(isEvent, activeEntries);
  bindActionButtons(activeEntries);
  updateBatchButtonState();

  if (validationOcrPagination) {
    if (usePagination) {
      const totalPages = Math.ceil(visibleIndices.length / VISIBLE_ROWS);
      validationOcrPagination.style.display = '';
      validationOcrPagination.innerHTML = `
        <button class="btn btn-small validation-pagination-btn" id="validationPaginationPrev" ${validationOcrCurrentPage === 0 ? 'disabled' : ''}>${t('btn.previous')}</button>
        <span class="validation-pagination-info">${t('pagination.pageOf', { page: validationOcrCurrentPage + 1, total: totalPages })}</span>
        <button class="btn btn-small validation-pagination-btn" id="validationPaginationNext" ${validationOcrCurrentPage >= totalPages - 1 ? 'disabled' : ''}>${t('btn.next')}</button>
      `;
      const prevBtn = validationOcrPagination.querySelector('#validationPaginationPrev');
      const nextBtn = validationOcrPagination.querySelector('#validationPaginationNext');
      if (prevBtn) prevBtn.addEventListener('click', () => { validationOcrCurrentPage--; renderValidationOcrTable(); });
      if (nextBtn) nextBtn.addEventListener('click', () => { validationOcrCurrentPage++; renderValidationOcrTable(); });
    } else {
      validationOcrPagination.style.display = 'none';
      validationOcrPagination.innerHTML = '';
    }
  }
}

/**
 * Sort visible indices in-place by the given column and direction.
 * @param {number[]} indices - Array of member indices to sort.
 * @param {string} col - Sort column key.
 * @param {string} dir - 'asc' or 'desc'.
 * @param {boolean} isEvent - Whether we are in event mode.
 * @param {Array} entries - The active OCR entries array.
 */
function sortVisibleIndices(indices, col, dir, isEvent, entries) {
  const members = state.validatedMembers;
  const multiplier = dir === 'asc' ? 1 : -1;
  indices.sort((a, b) => {
    const ma = members[a];
    const mb = members[b];
    const ea = entries && entries[a];
    const eb = entries && entries[b];
    let va, vb;
    switch (col) {
      case 'status':
        va = ma.validationStatus || '';
        vb = mb.validationStatus || '';
        return multiplier * va.localeCompare(vb, 'de');
      case 'name':
        va = (ma.validationStatus === 'corrected' ? ma.originalName : ma.name) || '';
        vb = (mb.validationStatus === 'corrected' ? mb.originalName : mb.name) || '';
        return multiplier * va.localeCompare(vb, 'de');
      case 'suggestion':
        va = ma.suggestion || ma.name || '';
        vb = mb.suggestion || mb.name || '';
        return multiplier * va.localeCompare(vb, 'de');
      case 'coords':
        va = ea ? (ea.coords || '') : '';
        vb = eb ? (eb.coords || '') : '';
        return multiplier * va.localeCompare(vb, 'de');
      case 'score':
        va = ea ? (ea.score ?? 0) : 0;
        vb = eb ? (eb.score ?? 0) : 0;
        return multiplier * (va - vb);
      case 'power':
        va = ea ? (ea.power ?? 0) : 0;
        vb = eb ? (eb.power ?? 0) : 0;
        return multiplier * (va - vb);
      case 'eventPoints':
        va = ea ? (ea.eventPoints ?? 0) : 0;
        vb = eb ? (eb.eventPoints ?? 0) : 0;
        return multiplier * (va - vb);
      default:
        return 0;
    }
  });
}

/** Build correction/suggestion HTML for a validation row. */
function buildCorrectionHtml(m) {
  if (m.validationStatus === 'corrected' && m.originalName !== m.name) {
    return `<span class="v-correction">${escapeHtml(m.name)}</span>
      <span class="v-original-name">OCR: ${escapeHtml(m.originalName)}</span>`;
  }
  if (m.validationStatus === 'suggested' && m.suggestion) {
    return `<span class="v-suggestion">${escapeHtml(m.suggestion)}?</span>`;
  }
  return '';
}

/** Build action buttons HTML for a validation row. */
function buildActionHtml(m, idx, activeEntries) {
  let html = '';
  if (m.validationStatus === 'suggested' && m.suggestion) {
    html += `<button class="v-action-btn accept" data-idx="${idx}" data-action="accept-suggestion" title="${t('tooltip.acceptSuggestion')}">&#10003;</button>`;
  }
  if (m.validationStatus !== 'corrected' && m.validationStatus !== 'confirmed') {
    html += ` <button class="v-action-btn make-correction" data-idx="${idx}" data-action="make-correction" title="${t('tooltip.makeCorrection')}">&#8644;</button>`;
  }
  html += ` <button class="v-action-btn" data-idx="${idx}" data-action="edit-name" title="${t('tooltip.editName')}">&#9998;</button>`;
  html += ` <button class="v-action-btn add-to-list" data-idx="${idx}" data-action="add-to-list" title="${t('tooltip.addToList')}">&#43;</button>`;
  const srcEntry = activeEntries && activeEntries[idx];
  if (srcEntry && srcEntry._sourceFiles && srcEntry._sourceFiles.length > 0) {
    const count = srcEntry._sourceFiles.length;
    const tipText = count === 1 ? t('tooltip.openScreenshot') : t('tooltip.openScreenshots', { count });
    html += ` <button class="v-action-btn screenshot-btn" data-idx="${idx}" data-action="open-screenshot" title="${tipText}">&#128065;</button>`;
  }
  return html;
}

/** Build score columns HTML for a validation row. */
function buildScoreColumns(isEvent, activeEntries, idx) {
  const srcEntry = activeEntries && activeEntries[idx];
  if (!srcEntry) {
    return isEvent
      ? '<td class="td-score">-</td><td class="td-score">-</td>'
      : '<td class="td-score">-</td><td class="td-score">-</td>';
  }
  if (isEvent) {
    const hasWarning = srcEntry._warning;
    const powerEdited = srcEntry._powerEdited ? ' score-edited' : '';
    const epEdited = srcEntry._eventPointsEdited ? ' score-edited' : '';
    const warnClass = hasWarning ? ' score-warning' : '';
    const warnTitle = hasWarning ? t('tooltip.scoreWarning') : t('tooltip.clickToEdit');
    return `
      <td class="td-score${powerEdited}${warnClass}" data-idx="${idx}" data-field="power" title="${warnTitle}">${srcEntry.power.toLocaleString('de-DE')}</td>
      <td class="td-score${epEdited}${warnClass}" data-idx="${idx}" data-field="eventPoints" title="${warnTitle}">${srcEntry.eventPoints.toLocaleString('de-DE')}</td>
    `;
  }
  const coordsEdited = srcEntry._coordsEdited ? ' score-edited' : '';
  const scoreEdited = srcEntry._scoreEdited ? ' score-edited' : '';
  return `
    <td class="td-score${coordsEdited}" data-idx="${idx}" data-field="coords" title="${t('tooltip.clickToEdit')}">${escapeHtml(srcEntry.coords || '')}</td>
    <td class="td-score${scoreEdited}" data-idx="${idx}" data-field="score" title="${t('tooltip.clickToEdit')}">${(srcEntry.score || 0).toLocaleString('de-DE')}</td>
  `;
}

/** Bind checkbox change handlers and select-all. */
function bindCheckboxes(visibleIndices, selectAllEl) {
  validationOcrBody.querySelectorAll('.v-row-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const idx = parseInt(cb.dataset.idx);
      if (cb.checked) state.selectedOcrRows.add(idx); else state.selectedOcrRows.delete(idx);
      updateBatchButtonState();
    });
  });
  if (selectAllEl) {
    const allChecked = visibleIndices.length > 0 && visibleIndices.every(i => state.selectedOcrRows.has(i));
    selectAllEl.checked = allChecked;
    selectAllEl.addEventListener('change', () => {
      validationOcrBody.querySelectorAll('.v-row-checkbox').forEach(cb => {
        const idx = parseInt(cb.dataset.idx);
        if (selectAllEl.checked) { state.selectedOcrRows.add(idx); cb.checked = true; }
        else { state.selectedOcrRows.delete(idx); cb.checked = false; }
      });
      updateBatchButtonState();
    });
  }
}

/** Bind click-to-edit on score cells. */
function bindScoreEditing(isEvent, activeEntries) {
  validationOcrBody.querySelectorAll('.td-score').forEach(td => {
    td.addEventListener('click', (e) => {
      e.stopPropagation();
      if (td.querySelector('input')) return;
      const idx = parseInt(td.dataset.idx);
      const field = td.dataset.field;
      if (isNaN(idx) || !field) return;
      const entry = activeEntries && activeEntries[idx];
      if (!entry) return;
      const currentValue = field === 'coords' ? (entry.coords || '') : (entry[field] || 0);
      const displayValue = field === 'coords' ? currentValue : currentValue.toString();
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'score-edit-input';
      input.value = displayValue;
      const originalHtml = td.innerHTML;
      td.innerHTML = '';
      td.appendChild(input);
      input.focus();
      input.select();
      const commitEdit = () => {
        const rawVal = input.value.trim();
        if (field === 'coords') {
          if (rawVal !== (entry.coords || '')) { entry.coords = rawVal; entry._coordsEdited = true; }
          td.textContent = entry.coords || '';
        } else {
          const parsed = parseInt(rawVal.replace(/[,.\u00A0\s]/g, ''));
          const numVal = isNaN(parsed) ? 0 : parsed;
          if (numVal !== entry[field]) { entry[field] = numVal; entry[`_${field}Edited`] = true; }
          td.textContent = entry[field].toLocaleString('de-DE');
        }
        if (entry[`_${field}Edited`]) td.classList.add('score-edited');
      };
      input.addEventListener('blur', commitEdit);
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') { ke.preventDefault(); input.blur(); }
        else if (ke.key === 'Escape') { ke.preventDefault(); td.innerHTML = originalHtml; }
      });
    });
  });
}

/** Bind action button click handlers. */
function bindActionButtons(activeEntries) {
  validationOcrBody.querySelectorAll('.v-action-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      const action = btn.dataset.action;
      if (action === 'accept-suggestion') {
        const member = state.validatedMembers[idx];
        if (member.suggestion) {
          await window.api.addCorrection(member.originalName || member.name, member.suggestion);
          if (activeEntries && activeEntries[idx]) activeEntries[idx].name = member.suggestion;
          await validateCurrentResults();
        }
      } else if (action === 'make-correction') {
        await makeOcrCorrection(idx, activeEntries);
      } else if (action === 'edit-name') {
        await editOcrEntryName(idx, activeEntries);
      } else if (action === 'add-to-list') {
        await addOcrNameToValidationList(idx);
      } else if (action === 'open-screenshot') {
        const entry = activeEntries && activeEntries[idx];
        if (entry && entry._sourceFiles) {
          for (const filePath of entry._sourceFiles) {
            await window.api.openScreenshot(filePath);
          }
        }
      }
    });
  });
}

/** Edit an OCR entry name via input dialog. */
async function editOcrEntryName(idx, activeEntries) {
  const member = state.validatedMembers[idx];
  if (!member) return;
  const currentName = member.originalName || member.name;
  const newName = await showInputDialog(t('prompt.editName'), currentName);
  if (newName === null || newName.trim() === '' || newName.trim() === currentName) return;
  if (activeEntries && activeEntries[idx]) activeEntries[idx].name = newName.trim();
  await validateCurrentResults();
}

/** Create a correction rule for an OCR entry. */
async function makeOcrCorrection(idx, activeEntries) {
  const member = state.validatedMembers[idx];
  if (!member) return;
  const ocrName = member.originalName || member.name;
  const correctName = await showInputDialog(t('prompt.makeCorrection', { name: ocrName }), member.suggestion || '');
  if (correctName === null || correctName.trim() === '' || correctName.trim() === ocrName) return;
  const trimmed = correctName.trim();
  await window.api.addCorrection(ocrName, trimmed);
  if (activeEntries && activeEntries[idx]) activeEntries[idx].name = trimmed;
  await loadValidationList();
  await validateCurrentResults();
  // Switch to corrections sub-tab
  switchToSubTab('validationRightSubTabBar', 'validation-corrections');
}

/** Add a single OCR name to the validation list. */
async function addOcrNameToValidationList(idx) {
  const member = state.validatedMembers[idx];
  if (!member) return;
  const nameToAdd = await showInputDialog(t('prompt.addToList'), member.name);
  if (nameToAdd === null || nameToAdd.trim() === '') return;
  const trimmed = nameToAdd.trim();
  if (state.validationKnownNames.includes(trimmed)) {
    await showAlertDialog(t('alert.nameAlreadyExists', { name: trimmed }));
    return;
  }
  await window.api.addValidationName(trimmed);
  await loadValidationList();
  if (state.validatedMembers) await validateCurrentResults();
}

/** Batch-add selected OCR names to the validation list. */
async function addSelectedOcrNamesToValidationList() {
  if (state.selectedOcrRows.size === 0 || !state.validatedMembers) return;
  const namesToAdd = [];
  const duplicates = [];
  for (const idx of state.selectedOcrRows) {
    const member = state.validatedMembers[idx];
    if (!member) continue;
    const name = member.name;
    if (state.validationKnownNames.includes(name)) duplicates.push(name);
    else if (!namesToAdd.includes(name)) namesToAdd.push(name);
  }
  if (namesToAdd.length === 0 && duplicates.length > 0) {
    await showAlertDialog(t('alert.allNamesAlreadyExist', { count: duplicates.length }));
    return;
  }
  let confirmMsg = t('confirm.addNamesToList', { count: namesToAdd.length });
  if (duplicates.length > 0) {
    confirmMsg += '\n\n' + t('alert.duplicatesSkipped', { count: duplicates.length, names: duplicates.join(', ') });
  }
  if (!(await showConfirmDialog(confirmMsg))) return;
  for (const name of namesToAdd) {
    await window.api.addValidationName(name);
  }
  state.selectedOcrRows.clear();
  await loadValidationList();
  if (state.validatedMembers) await validateCurrentResults();
}

/** Update the batch-add button state. */
function updateBatchButtonState() {
  if (!btnAddSelectedToList) return;
  btnAddSelectedToList.disabled = state.selectedOcrRows.size === 0;
  btnAddSelectedToList.textContent = state.selectedOcrRows.size > 0
    ? t('btn.addSelectedToListCount', { count: state.selectedOcrRows.size })
    : t('btn.addSelectedToList');
}

// ─── Names List ────────────────────────────────────────────────────────────

/** Render the known names list in the validation panel. */
export function renderValidationNames() {
  validationNamesList.innerHTML = '';
  validationNameCount.textContent = t('format.nameCount', { count: state.validationKnownNames.length });
  const searchTerm = validationSearch ? validationSearch.value.toLowerCase() : '';
  const filtered = searchTerm
    ? state.validationKnownNames.filter(n => n.toLowerCase().includes(searchTerm))
    : state.validationKnownNames;
  const sorted = filtered.slice().sort((a, b) => a.localeCompare(b, 'de'));
  sorted.forEach(name => {
    const item = document.createElement('div');
    item.className = 'validation-name-item';
    if (state.selectedOcrRow !== null && state.validatedMembers) {
      const sel = state.validatedMembers[state.selectedOcrRow];
      if (sel && sel.suggestion === name) item.classList.add('highlighted');
    }
    item.innerHTML = `
      <span>${escapeHtml(name)}</span>
      <button class="remove-btn" title="${t('tooltip.removeName')}">&times;</button>
    `;
    item.addEventListener('click', async (e) => {
      if (e.target.closest('.remove-btn')) return;
      if (state.selectedOcrRow === null || !state.validatedMembers) return;
      const member = state.validatedMembers[state.selectedOcrRow];
      if (!member) return;
      const ocrName = member.originalName || member.name;
      await window.api.addCorrection(ocrName, name);
      const activeEntries = state.validationMode === 'event' ? state.eventOcrEntries : state.ocrMembers;
      if (activeEntries && activeEntries[state.selectedOcrRow]) activeEntries[state.selectedOcrRow].name = name;
      state.selectedOcrRow = null;
      await validateCurrentResults();
    });
    item.querySelector('.remove-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (await showConfirmDialog(t('confirm.removeName', { name }))) {
        await window.api.removeValidationName(name);
        await loadValidationList();
        if (state.validatedMembers) await validateCurrentResults();
      }
    });
    validationNamesList.appendChild(item);
  });
}

// ─── Corrections List ──────────────────────────────────────────────────────

/** Render the corrections list in the validation panel. */
export function renderCorrections() {
  correctionsList.innerHTML = '';
  const allEntries = Object.entries(state.validationCorrections);
  const searchTerm = correctionSearch ? correctionSearch.value.trim().toLowerCase() : '';
  const entries = searchTerm
    ? allEntries.filter(([from, to]) => from.toLowerCase().includes(searchTerm) || to.toLowerCase().includes(searchTerm))
    : allEntries;
  entries.sort((a, b) => {
    const aActive = state.activeCorrections.has(a[0]) ? 0 : 1;
    const bActive = state.activeCorrections.has(b[0]) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return a[0].localeCompare(b[0], 'de');
  });
  correctionCount.textContent = searchTerm ? `${entries.length}/${allEntries.length}` : `${allEntries.length}`;
  entries.forEach(([from, to]) => {
    const isActive = state.activeCorrections.has(from);
    const item = document.createElement('div');
    item.className = 'correction-item' + (isActive ? ' active-correction' : '');
    item.innerHTML = `
      <span class="correction-from" title="${escapeHtml(from)}">${escapeHtml(from)}</span>
      <span class="correction-arrow">&rarr;</span>
      <span class="correction-to" title="${escapeHtml(to)}">${escapeHtml(to)}</span>
      ${isActive ? '<span class="correction-active-badge" title="' + t('tooltip.correctionActive') + '">&#9679;</span>' : ''}
      <button class="remove-btn" title="${t('tooltip.removeCorrection')}">&times;</button>
    `;
    item.querySelector('.remove-btn').addEventListener('click', async () => {
      await window.api.removeCorrection(from);
      await loadValidationList();
      if (state.validatedMembers) await validateCurrentResults();
    });
    correctionsList.appendChild(item);
  });
}

// ─── Initialization ────────────────────────────────────────────────────────

/**
 * Initialize all validation UI event listeners.
 * @param {Object} deps
 * @param {Function} deps.saveConfig - Persist config.
 */
export function initValidationUI({ saveConfig }) {
  // Search handlers
  validationSearch.addEventListener('input', () => renderValidationNames());
  correctionSearch.addEventListener('input', () => renderCorrections());

  // Manual correction
  btnAddManualCorrection.addEventListener('click', async () => {
    const from = correctionFromInput.value.trim();
    const to = correctionToInput.value.trim();
    if (!from || !to || from === to) return;
    await window.api.addCorrection(from, to);
    correctionFromInput.value = '';
    correctionToInput.value = '';
    await loadValidationList();
    if (state.validatedMembers) await validateCurrentResults();
  });

  correctionToInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); btnAddManualCorrection.click(); }
  });
  correctionFromInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); correctionToInput.focus(); }
  });

  // Filter buttons
  validationFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      validationFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.validationFilter = btn.dataset.filter;
      state.selectedOcrRows.clear();
      validationOcrCurrentPage = 0;
      renderValidationOcrTable();
    });
  });

  // Batch add
  btnAddSelectedToList.addEventListener('click', () => addSelectedOcrNamesToValidationList());

  // Add name
  btnAddValidationName.addEventListener('click', async () => {
    const name = await showInputDialog(t('prompt.addName'));
    if (name && name.trim()) {
      const trimmed = name.trim();
      if (state.validationKnownNames.includes(trimmed)) {
        await showAlertDialog(t('alert.nameAlreadyExists', { name: trimmed }));
        return;
      }
      await window.api.addValidationName(trimmed);
      await loadValidationList();
      if (state.validatedMembers) await validateCurrentResults();
    }
  });

  // Accept all suggestions
  btnAcceptAllSuggestions.addEventListener('click', async () => {
    if (!state.validatedMembers) return;
    const suggestions = state.validatedMembers.filter(m => m.validationStatus === 'suggested' && m.suggestion);
    if (suggestions.length === 0) return;
    if (!(await showConfirmDialog(t('confirm.acceptSuggestions', { count: suggestions.length })))) return;
    const activeEntries = state.validationMode === 'event' ? state.eventOcrEntries : state.ocrMembers;
    for (const member of suggestions) {
      const ocrName = member.originalName || member.name;
      await window.api.addCorrection(ocrName, member.suggestion);
      const idx = state.validatedMembers.indexOf(member);
      if (idx >= 0 && activeEntries && activeEntries[idx]) activeEntries[idx].name = member.suggestion;
    }
    await validateCurrentResults();
  });

  // Export from validation view
  btnValidationExportCsv.addEventListener('click', async () => {
    if (state.validationMode === 'event') {
      if (!state.eventOcrEntries || state.eventOcrEntries.length === 0) return;
      const defaultName = `event_${localDateTimeString()}.csv`;
      const result = await window.api.exportEventCsv(state.eventOcrEntries, defaultName);
      if (result.ok) validationSummary.textContent = t('status.eventCsvSaved', { path: result.path });
    } else {
      const membersToExport = state.validatedMembers || state.ocrMembers;
      if (!membersToExport || membersToExport.length === 0) return;
      const defaultName = `mitglieder_${localDateTimeString()}.csv`;
      const result = await window.api.exportCsv(membersToExport, defaultName);
      if (result.ok) validationSummary.textContent = t('status.csvSaved', { path: result.path });
    }
  });

  // Import / Export validation list
  btnImportValidation.addEventListener('click', async () => {
    const result = await window.api.importValidationList();
    if (result.ok) {
      await loadValidationList();
      if (state.validatedMembers) await validateCurrentResults();
    }
  });
  btnExportValidation.addEventListener('click', () => window.api.exportValidationList());

  // Revalidate
  btnRevalidate.addEventListener('click', async () => {
    const hasData = state.validationMode === 'event'
      ? (state.eventOcrEntries && state.eventOcrEntries.length > 0)
      : (state.ocrMembers && state.ocrMembers.length > 0);
    if (hasData) {
      await validateCurrentResults();
      switchToTab('validation');
    }
  });

  // Validation mode sub-tabs (member / event)
  validationModeSubTabBar.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      switchToSubTab(validationModeSubTabBar, btn.dataset.subtab);
      const newMode = btn.dataset.subtab === 'validation-mode-event' ? 'event' : 'member';
      if (newMode !== state.validationMode) {
        state.validationMode = newMode;
        state.selectedOcrRow = null;
        state.selectedOcrRows.clear();
        state.validatedMembers = null;
        validationOcrCurrentPage = 0;
        await validateCurrentResults();
      }
    });
  });
}

/** Refresh dynamic i18n texts for validation UI. */
export function refreshValidationUI() {
  if (state.validatedMembers) {
    renderValidationOcrTable();
    updateValidationSummary();
  }
  renderValidationNames();
  renderCorrections();
}

/**
 * Handle the validation tab being opened.
 * Auto-validates if OCR results exist but haven't been validated yet.
 */
export function onValidationTabOpened() {
  const hasMembers = state.ocrMembers && state.ocrMembers.length > 0;
  const hasEvents = state.eventOcrEntries && state.eventOcrEntries.length > 0;
  if ((hasMembers || hasEvents) && !state.validatedMembers) {
    if (hasEvents && !hasMembers) state.validationMode = 'event';
    const subtabId = state.validationMode === 'event' ? 'validation-mode-event' : 'validation-mode-member';
    switchToSubTab(validationModeSubTabBar, subtabId);
    validateCurrentResults();
  }
}
