/**
 * Advanced OCR setup wizard.
 * Manages the 3-step Ollama setup flow using reusable components.
 * @module modules/ollama-ui
 */

import { $, t } from '../utils/helpers.js';
import { createStepPanel } from '../components/step-panel.js';
import { createProgressBar } from '../components/progress-bar.js';
import { createStatusIndicator } from '../components/status-indicator.js';
import { createModelCard } from '../components/model-card.js';

/** @type {Map<string, ReturnType<typeof createModelCard>>} */
const modelCards = new Map();
let step1, step2, step3;
let ollamaStatus, installProgress;

/**
 * Initialize the Ollama setup wizard inside the vision-settings container.
 */
export function initOllamaUi() {
  const container = $('#vision-settings');
  if (!container) return;
  container.innerHTML = '';
  // ─── Step 1: Ollama Runtime ───────────────────────────────────────────
  step1 = createStepPanel({ step: 1, title: t('ollama.step1Title') || 'Ollama Runtime', id: 'ollama-step1' });
  step1.enable();
  ollamaStatus = createStatusIndicator('ollama-status');
  installProgress = createProgressBar('ollama-install-progress');
  const installBtn = document.createElement('button');
  installBtn.id = 'ollama-install-btn';
  installBtn.className = 'btn btn-primary';
  installBtn.textContent = t('ollama.installBtn') || 'Download & Install Ollama';
  installBtn.addEventListener('click', handleInstallOllama);
  step1.content.appendChild(ollamaStatus.container);
  step1.content.appendChild(installBtn);
  step1.content.appendChild(installProgress.container);
  container.appendChild(step1.panel);
  // ─── Step 2: Model Selection ──────────────────────────────────────────
  step2 = createStepPanel({ step: 2, title: t('ollama.step2Title') || 'Select Model', id: 'ollama-step2' });
  const modelList = document.createElement('div');
  modelList.id = 'ollama-model-list';
  modelList.className = 'model-list';
  step2.content.appendChild(modelList);
  container.appendChild(step2.panel);
  // ─── Step 3: Test ─────────────────────────────────────────────────────
  step3 = createStepPanel({ step: 3, title: t('ollama.step3Title') || 'Test', id: 'ollama-step3' });
  const testBtn = document.createElement('button');
  testBtn.id = 'ollama-test-btn';
  testBtn.className = 'btn btn-secondary';
  testBtn.textContent = t('ollama.testBtn') || 'Run test with sample image';
  const testResult = document.createElement('div');
  testResult.id = 'ollama-test-result';
  testResult.className = 'ollama-test-result';
  step3.content.appendChild(testBtn);
  step3.content.appendChild(testResult);
  container.appendChild(step3.panel);
  // ─── Event listeners ──────────────────────────────────────────────────
  window.api.onOllamaInstallProgress?.(handleInstallProgress);
  window.api.onOllamaPullProgress?.(handlePullProgress);
  // Initial status check
  refreshOllamaStatus();
}

/**
 * Refresh Ollama status and update UI accordingly.
 */
export async function refreshOllamaStatus() {
  ollamaStatus?.update('loading', t('ollama.checking') || 'Checking...');
  const result = await window.api.ollamaStatus();
  if (!result.ok) {
    ollamaStatus?.update('notInstalled', t('ollama.error') || 'Error');
    return;
  }
  const installBtn = $('#ollama-install-btn');
  if (result.running) {
    ollamaStatus.update('running', `${t('ollama.running') || 'Running'} (v${result.version})`);
    if (installBtn) installBtn.style.display = 'none';
    step2.enable();
    step3.enable();
    await refreshModelList();
  } else if (result.installed) {
    ollamaStatus.update('stopped', t('ollama.installed') || 'Installed (not running)');
    if (installBtn) {
      installBtn.textContent = t('ollama.startBtn') || 'Start Ollama';
      installBtn.style.display = '';
      installBtn.onclick = handleStartOllama;
    }
    step2.disable();
    step3.disable();
  } else {
    ollamaStatus.update('notInstalled', t('ollama.notInstalled') || 'Not installed');
    if (installBtn) {
      installBtn.textContent = t('ollama.installBtn') || 'Download & Install Ollama';
      installBtn.style.display = '';
      installBtn.onclick = handleInstallOllama;
    }
    step2.disable();
    step3.disable();
  }
}

/**
 * Refresh the model list: load registry + check which are downloaded.
 */
async function refreshModelList() {
  const modelList = $('#ollama-model-list');
  if (!modelList) return;
  modelList.innerHTML = '';
  modelCards.clear();
  const [registryResult, downloadedResult] = await Promise.all([
    window.api.ollamaModelRegistry(),
    window.api.ollamaListModels(),
  ]);
  const registry = registryResult.models || [];
  const downloaded = (downloadedResult.models || []).map(m => m.name.split(':')[0]);
  for (const model of registry) {
    const isDownloaded = downloaded.some(d => model.ollamaRef.includes(d) || d.includes(model.id));
    const card = createModelCard(model, {
      onDownload: handlePullModel,
      onDelete: handleDeleteModel,
      onSelect: handleSelectModel,
    });
    card.setDownloaded(isDownloaded);
    modelCards.set(model.id, card);
    modelList.appendChild(card.card);
  }
}

// ─── Event handlers ─────────────────────────────────────────────────────────

async function handleInstallOllama() {
  const btn = $('#ollama-install-btn');
  if (btn) btn.disabled = true;
  installProgress?.update(0, t('ollama.downloading') || 'Downloading...');
  const result = await window.api.ollamaInstall();
  if (result.ok) {
    installProgress?.reset();
    await handleStartOllama();
  } else {
    installProgress?.update(0, result.error || 'Failed');
    if (btn) btn.disabled = false;
  }
}

async function handleStartOllama() {
  ollamaStatus?.update('loading', t('ollama.starting') || 'Starting...');
  await window.api.ollamaStart();
  await refreshOllamaStatus();
}

function handleInstallProgress(progress) {
  if (progress.percent !== undefined) {
    installProgress?.update(progress.percent, `${progress.percent}% (${progress.downloadedMB || '?'}/${progress.totalMB || '?'} MB)`);
  }
}

async function handlePullModel(modelId) {
  const card = modelCards.get(modelId);
  card?.setProgress(t('ollama.pulling') || 'Downloading...');
  await window.api.ollamaPullModel(modelId);
  await refreshModelList();
}

function handlePullProgress(data) {
  const card = modelCards.get(data.modelId);
  if (!card) return;
  if (data.completed && data.total) {
    const pct = Math.round((data.completed / data.total) * 100);
    card.setProgress(`${pct}%`);
  } else {
    card.setProgress(data.status || 'Downloading...');
  }
}

async function handleDeleteModel(modelId) {
  await window.api.ollamaDeleteModel(modelId);
  await refreshModelList();
}

function handleSelectModel(modelId) {
  // Deselect all, select this one
  for (const [id, card] of modelCards) {
    card.setSelected(id === modelId);
  }
  // Save selection (will be picked up by config save)
  const event = new CustomEvent('ollama-model-selected', { detail: { modelId } });
  document.dispatchEvent(event);
}

/**
 * Get the currently selected vision model ID.
 * @returns {string | null}
 */
export function getSelectedModelId() {
  const checked = document.querySelector('input[name="vision-model"]:checked');
  return checked?.value || null;
}
