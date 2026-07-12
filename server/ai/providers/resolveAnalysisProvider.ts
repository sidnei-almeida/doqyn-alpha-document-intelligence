import type { DocumentAnalysisProvider, DocumentAnalysisProviderName } from './types.js';
import { groqDocumentAnalysisProvider } from './groqDocumentAnalysisProvider.js';
import { googleVisionDocumentAnalysisProvider } from './googleVisionDocumentAnalysisProvider.js';

export function resolveAnalysisProviderName(): DocumentAnalysisProviderName {
  const configured = process.env.DOCUMENT_ANALYSIS_PROVIDER?.trim().toLowerCase();
  if (configured === 'google_vision') return 'google_vision';
  return 'groq';
}

export function resolveAnalysisProvider(): DocumentAnalysisProvider {
  const name = resolveAnalysisProviderName();
  if (name === 'google_vision') {
    return googleVisionDocumentAnalysisProvider;
  }
  return groqDocumentAnalysisProvider;
}
