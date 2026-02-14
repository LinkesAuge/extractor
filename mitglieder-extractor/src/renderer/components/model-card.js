/**
 * Model card component for the model picker list.
 * @module components/model-card
 */

import { t } from '../utils/helpers.js';

/**
 * Escape a string for safe insertion into HTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

/**
 * Create a model card element.
 * @param {Object} model - Model definition from registry.
 * @param {Object} callbacks - Event callbacks.
 * @param {Function} callbacks.onDownload - Called when download is clicked.
 * @param {Function} callbacks.onDelete - Called when delete is clicked.
 * @param {Function} callbacks.onSelect - Called when the model is selected.
 * @returns {{card: HTMLElement, setDownloaded: Function, setSelected: Function, setProgress: Function}}
 */
export function createModelCard(model, callbacks) {
  const card = document.createElement('div');
  card.className = 'model-card';
  card.dataset.modelId = model.id;
  // Radio button
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'vision-model';
  radio.value = model.id;
  radio.className = 'model-radio';
  radio.disabled = true;
  radio.addEventListener('change', () => callbacks.onSelect?.(model.id));
  // Info section — escape all model fields before inserting
  const info = document.createElement('div');
  info.className = 'model-info';
  info.innerHTML = `
    <strong class="model-name">${escapeHtml(model.name)}</strong>
    <span class="model-meta">${escapeHtml(model.params)} &middot; ${escapeHtml(model.downloadSize)} &middot; ${escapeHtml(model.minRam)} RAM</span>
    <span class="model-desc">${escapeHtml(model.description)}</span>
  `;
  // Actions section
  const actions = document.createElement('div');
  actions.className = 'model-actions';
  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'btn btn-sm btn-primary model-download-btn';
  downloadBtn.textContent = t('ollama.download') || 'Download';
  downloadBtn.addEventListener('click', () => callbacks.onDownload?.(model.id));
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-sm btn-danger model-delete-btn';
  deleteBtn.textContent = t('ollama.delete') || 'Delete';
  deleteBtn.style.display = 'none';
  deleteBtn.addEventListener('click', () => callbacks.onDelete?.(model.id));
  // Progress
  const progressText = document.createElement('span');
  progressText.className = 'model-progress';
  progressText.style.display = 'none';
  actions.appendChild(downloadBtn);
  actions.appendChild(deleteBtn);
  actions.appendChild(progressText);
  card.appendChild(radio);
  card.appendChild(info);
  card.appendChild(actions);
  return {
    card,
    /** Mark model as downloaded (show radio + delete, hide download). */
    setDownloaded(isDownloaded) {
      radio.disabled = !isDownloaded;
      downloadBtn.style.display = isDownloaded ? 'none' : '';
      deleteBtn.style.display = isDownloaded ? '' : 'none';
      progressText.style.display = 'none';
    },
    /** Mark model as selected (check radio). */
    setSelected(isSelected) {
      radio.checked = isSelected;
    },
    /** Show download progress. */
    setProgress(text) {
      if (text) {
        progressText.style.display = '';
        progressText.textContent = text;
        downloadBtn.style.display = 'none';
      } else {
        progressText.style.display = 'none';
      }
    },
  };
}
