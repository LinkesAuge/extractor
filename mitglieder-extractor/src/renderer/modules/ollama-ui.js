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
let initialized = false;

/** Model ID to pre-select after model list loads (from saved config). */
let pendingModelSelection = null;

/**
 * Initialize the Ollama setup wizard inside the vision-settings container.
 * Safe to call multiple times — only builds the DOM once, then refreshes.
 * @param {string} [savedModelId] - Previously saved model ID to pre-select.
 */
export function initOllamaUi(savedModelId) {
  if (savedModelId) pendingModelSelection = savedModelId;
  if (initialized) {
    refreshOllamaStatus();
    return;
  }
  const container = $('#vision-settings');
  if (!container) return;
  container.innerHTML = '';
  buildWizardDom(container);
  registerIpcListeners();
  initialized = true;
  refreshOllamaStatus();
}

/**
 * Rebuild the wizard DOM (call after language change).
 */
export function refreshOllamaUiText() {
  if (!initialized) return;
  // Update static text that uses t()
  step1?.setTitle(t('ollama.step1Title') || 'Ollama Runtime');
  step2?.setTitle(t('ollama.step2Title') || 'Select Model');
  step3?.setTitle(t('ollama.step3Title') || 'Test');
  const testBtn = $('#ollama-test-btn');
  if (testBtn) testBtn.textContent = t('ollama.testBtn') || 'Run test with sample image';
  const folderBtn = $('#ollama-open-folder-btn');
  if (folderBtn) folderBtn.title = t('ollama.openModelsFolder') || 'Open models folder';
  refreshOllamaStatus();
}

// ─── DOM Construction ─────────────────────────────────────────────────────────

function buildWizardDom(container) {
  // ─── Step 1: Ollama Runtime ───────────────────────────────────────────
  step1 = createStepPanel({ step: 1, title: t('ollama.step1Title') || 'Ollama Runtime', id: 'ollama-step1' });
  step1.enable();
  ollamaStatus = createStatusIndicator('ollama-status');
  installProgress = createProgressBar('ollama-install-progress');
  const installBtn = document.createElement('button');
  installBtn.id = 'ollama-install-btn';
  installBtn.className = 'btn btn-primary';
  installBtn.textContent = t('ollama.installBtn') || 'Download & Install Ollama';
  // Single click handler — action changes based on state (set in refreshOllamaStatus)
  installBtn.addEventListener('click', () => {
    const action = installBtn.dataset.action;
    if (action === 'start') handleStartOllama();
    else handleInstallOllama();
  });
  step1.content.appendChild(ollamaStatus.container);
  step1.content.appendChild(installBtn);
  step1.content.appendChild(installProgress.container);
  container.appendChild(step1.panel);
  // ─── Step 2: Model Selection ──────────────────────────────────────────
  step2 = createStepPanel({ step: 2, title: t('ollama.step2Title') || 'Select Model', id: 'ollama-step2' });
  // Header row with "Open models folder" button
  const modelHeader = document.createElement('div');
  modelHeader.className = 'model-list-header';
  const openFolderBtn = document.createElement('button');
  openFolderBtn.id = 'ollama-open-folder-btn';
  openFolderBtn.className = 'btn btn-icon';
  openFolderBtn.title = t('ollama.openModelsFolder') || 'Open models folder';
  openFolderBtn.innerHTML = '&#128193;'; // 📁
  openFolderBtn.addEventListener('click', handleOpenModelsFolder);
  modelHeader.appendChild(openFolderBtn);
  step2.content.appendChild(modelHeader);
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
  testBtn.addEventListener('click', handleTestOllama);
  const testResult = document.createElement('div');
  testResult.id = 'ollama-test-result';
  testResult.className = 'ollama-test-result';
  step3.content.appendChild(testBtn);
  step3.content.appendChild(testResult);
  container.appendChild(step3.panel);
}

/**
 * Register IPC progress listeners exactly once.
 */
function registerIpcListeners() {
  window.api.onOllamaInstallProgress?.(handleInstallProgress);
  window.api.onOllamaPullProgress?.(handlePullProgress);
}

// ─── Status & Refresh ─────────────────────────────────────────────────────────

/**
 * Refresh Ollama status and update UI accordingly.
 */
export async function refreshOllamaStatus() {
  if (!ollamaStatus) return;
  ollamaStatus.update('loading', t('ollama.checking') || 'Checking...');
  const result = await window.api.ollamaStatus();
  if (!result.ok) {
    ollamaStatus.update('notInstalled', t('ollama.error') || 'Error');
    return;
  }
  const installBtn = $('#ollama-install-btn');
  if (result.running) {
    ollamaStatus.update('running', `${t('ollama.running') || 'Running'} (v${result.version})`);
    if (installBtn) installBtn.style.display = 'none';
    step2?.enable();
    step3?.enable();
    await refreshModelList();
  } else if (result.installed) {
    ollamaStatus.update('stopped', t('ollama.installed') || 'Installed (not running)');
    if (installBtn) {
      installBtn.textContent = t('ollama.startBtn') || 'Start Ollama';
      installBtn.dataset.action = 'start';
      installBtn.style.display = '';
      installBtn.disabled = false;
    }
    step2?.disable();
    step3?.disable();
  } else {
    ollamaStatus.update('notInstalled', t('ollama.notInstalled') || 'Not installed');
    if (installBtn) {
      installBtn.textContent = t('ollama.installBtn') || 'Download & Install Ollama';
      installBtn.dataset.action = 'install';
      installBtn.style.display = '';
      installBtn.disabled = false;
    }
    step2?.disable();
    step3?.disable();
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
  const downloadedModels = downloadedResult.models || [];
  for (const model of registry) {
    const isDownloaded = isModelDownloaded(model, downloadedModels);
    const card = createModelCard(model, {
      onDownload: handlePullModel,
      onDelete: handleDeleteModel,
      onSelect: handleSelectModel,
    });
    card.setDownloaded(isDownloaded);
    modelCards.set(model.id, card);
    modelList.appendChild(card.card);
  }
  // Restore previously selected model (from saved config)
  if (pendingModelSelection && modelCards.has(pendingModelSelection)) {
    const card = modelCards.get(pendingModelSelection);
    card.setSelected(true);
    pendingModelSelection = null;
  }
}

/**
 * Check if a registry model is present in the downloaded models list.
 * Handles multiple name formats from Ollama (case variations, tags, HF paths).
 *
 * @param {Object} model - Registry model entry.
 * @param {Array<{name: string}>} downloadedModels - Models from Ollama API.
 * @returns {boolean}
 */
function isModelDownloaded(model, downloadedModels) {
  const refLower = model.ollamaRef.toLowerCase();
  const idLower = model.id.toLowerCase();
  // Extract the repo portion for HuggingFace refs (e.g. "richardyoung/olmOCR-2-7B-1025-GGUF")
  const hfRepo = refLower.startsWith('hf.co/') ? refLower.slice(6) : null;
  return downloadedModels.some(d => {
    const nameLower = d.name.toLowerCase();
    const baseLower = nameLower.split(':')[0];
    // 1. Exact match (with or without tag)
    if (nameLower === refLower || baseLower === refLower) return true;
    // 2. Tagged ref match (e.g. downloaded "qwen3-vl:2b" matches ref "qwen3-vl:2b")
    if (model.ollamaRef.includes(':') && nameLower === refLower) return true;
    // 3. Untagged ref: base name matches (e.g. downloaded "glm-ocr:latest", ref "glm-ocr")
    if (!model.ollamaRef.includes(':') && baseLower === refLower) return true;
    // 4. HuggingFace: downloaded name contains the repo path
    if (hfRepo && (nameLower.includes(hfRepo) || baseLower.includes(hfRepo))) return true;
    // 5. HuggingFace fallback: downloaded name contains the model id
    if (hfRepo && nameLower.includes(idLower)) return true;
    return false;
  });
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
  const result = await window.api.ollamaPullModel(modelId);
  if (result && !result.ok) {
    card?.setProgress(`Error: ${result.error || 'Download failed'}`);
    return;
  }
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
  for (const [id, card] of modelCards) {
    card.setSelected(id === modelId);
  }
  const event = new CustomEvent('ollama-model-selected', { detail: { modelId } });
  document.dispatchEvent(event);
}

async function handleOpenModelsFolder() {
  const result = await window.api.ollamaOpenModelsFolder();
  if (!result?.ok) {
    console.warn('Could not open models folder:', result?.error);
  }
}

async function handleTestOllama() {
  const testResult = $('#ollama-test-result');
  const testBtn = $('#ollama-test-btn');
  if (!testResult) return;
  const selectedModel = getSelectedModelId();
  if (!selectedModel) {
    testResult.textContent = t('ollama.testNoModel') || 'Please select and download a model first.';
    testResult.className = 'ollama-test-result error';
    return;
  }
  testResult.textContent = t('ollama.testRunning') || 'Running test...';
  testResult.className = 'ollama-test-result';
  if (testBtn) testBtn.disabled = true;
  try {
    const result = await window.api.ollamaTest?.(selectedModel);
    if (result?.ok) {
      testResult.textContent = t('ollama.testSuccess') || 'Test passed! Model is working correctly.';
      testResult.className = 'ollama-test-result success';
    } else {
      testResult.textContent = `${t('ollama.testFailed') || 'Test failed'}: ${result?.error || 'Unknown error'}`;
      testResult.className = 'ollama-test-result error';
    }
  } catch (err) {
    testResult.textContent = `${t('ollama.testFailed') || 'Test failed'}: ${err.message}`;
    testResult.className = 'ollama-test-result error';
  } finally {
    if (testBtn) testBtn.disabled = false;
  }
}

/**
 * Get the currently selected vision model ID.
 * @returns {string | null}
 */
export function getSelectedModelId() {
  const checked = document.querySelector('input[name="vision-model"]:checked');
  return checked?.value || null;
}
