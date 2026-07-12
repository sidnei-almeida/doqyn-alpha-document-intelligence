import type { DocumentAnalysisProvider } from './types.js';
import { classifyDocumentWithRules } from '../services/documentClassifierAgent.js';
import { extractMetadataWithRule } from '../services/metadataExtractorAgent.js';
import { isGroqApiKeyConfigured } from '../services/groqClient.js';

export const groqDocumentAnalysisProvider: DocumentAnalysisProvider = {
  name: 'groq',

  isConfigured() {
    return isGroqApiKeyConfigured();
  },

  classify(input) {
    return classifyDocumentWithRules({
      chunks: input.chunks,
      classes: input.classes,
      context: input.context,
    });
  },

  extractMetadata(input) {
    return extractMetadataWithRule({
      chunks: input.chunks,
      selectedClass: input.selectedClass,
      classification: input.classification,
      context: input.context,
    });
  },
};
