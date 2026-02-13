/**
 * Registry of supported vision models for OCR.
 * Each entry defines the model's identity, size, and Ollama pull reference.
 */

/** @typedef {'ollama-library' | 'huggingface-gguf'} ModelSource */

/**
 * @typedef {Object} OcrModelDefinition
 * @property {string} id - Unique model identifier (used in config).
 * @property {string} name - Human-readable display name.
 * @property {string} params - Parameter count label (e.g. "0.9B").
 * @property {string} downloadSize - Approximate download size (e.g. "~2.2GB").
 * @property {string} minRam - Minimum RAM recommendation (e.g. "4GB").
 * @property {ModelSource} source - Where the model comes from.
 * @property {string} ollamaRef - Ollama pull reference (library name or hf.co/ path).
 * @property {string} description - Short description of the model's strengths.
 * @property {boolean} ocrSpecific - Whether the model is purpose-built for OCR.
 */

/** @type {OcrModelDefinition[]} */
export const MODEL_REGISTRY = [
  {
    id: 'glm-ocr',
    name: 'GLM-OCR',
    params: '0.9B',
    downloadSize: '~2.2GB',
    minRam: '4GB',
    source: 'ollama-library',
    ollamaRef: 'glm-ocr',
    description: '#1 on OmniDocBench, extremely lightweight, edge-optimized',
    ocrSpecific: true,
  },
  {
    id: 'qwen3-vl-2b',
    name: 'Qwen3-VL 2B',
    params: '2B',
    downloadSize: '~1.9GB',
    minRam: '4GB',
    source: 'ollama-library',
    ollamaRef: 'qwen3-vl:2b',
    description: 'Latest Qwen vision family, lightweight and fast',
    ocrSpecific: false,
  },
  {
    id: 'deepseek-ocr',
    name: 'DeepSeek-OCR',
    params: '3B',
    downloadSize: '~6.7GB',
    minRam: '8GB',
    source: 'ollama-library',
    ollamaRef: 'deepseek-ocr',
    description: 'OCR-optimized, 96-97% benchmark accuracy, token-efficient',
    ocrSpecific: true,
  },
  {
    id: 'qwen3-vl-8b',
    name: 'Qwen3-VL 8B',
    params: '8B',
    downloadSize: '~6.1GB',
    minRam: '10GB',
    source: 'ollama-library',
    ollamaRef: 'qwen3-vl:8b',
    description: 'Strong all-round vision, 256K context window',
    ocrSpecific: false,
  },
  {
    id: 'olmocr-2',
    name: 'OlmOCR-2',
    params: '7B',
    downloadSize: '~8.9GB',
    minRam: '12GB',
    source: 'huggingface-gguf',
    ollamaRef: 'hf.co/richardyoung/olmOCR-2-7B-1025-GGUF',
    description: 'Document OCR specialist by Allen AI, based on Qwen2-VL',
    ocrSpecific: true,
  },
];

/**
 * Find a model definition by its ID.
 * @param {string} modelId - The model identifier.
 * @returns {OcrModelDefinition | undefined}
 */
export function findModelById(modelId) {
  return MODEL_REGISTRY.find(m => m.id === modelId);
}

/**
 * Get the Ollama pull reference for a model.
 * @param {string} modelId - The model identifier.
 * @returns {string} Ollama pull reference.
 * @throws {Error} If model ID is unknown.
 */
export function getOllamaRef(modelId) {
  const model = findModelById(modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);
  return model.ollamaRef;
}
