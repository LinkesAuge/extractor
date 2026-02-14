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
