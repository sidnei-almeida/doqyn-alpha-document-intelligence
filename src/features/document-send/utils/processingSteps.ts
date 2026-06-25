import type { ProcessingLogItem } from '../types';

export type ProcessingStepId =
  | 'received'
  | 'text'
  | 'snippets'
  | 'class'
  | 'metadata'
  | 'ready';

export type ProcessingStepStatus = 'pending' | 'active' | 'done';

export type ProcessingStep = {
  id: ProcessingStepId;
  label: string;
  status: ProcessingStepStatus;
};

export const PROCESSING_STEP_DEFINITIONS: Array<{ id: ProcessingStepId; label: string }> = [
  { id: 'received', label: 'Documento recebido' },
  { id: 'text', label: 'Texto extraído' },
  { id: 'snippets', label: 'Trechos relevantes selecionados' },
  { id: 'class', label: 'Classe identificada' },
  { id: 'metadata', label: 'Metadados extraídos' },
  { id: 'ready', label: 'Resultado preparado' },
];

const LOG_TITLE_TO_STEP: Record<string, ProcessingStepId> = {
  'Documento recebido': 'received',
  'Texto extraído': 'text',
  'Trechos relevantes selecionados': 'snippets',
  'Classe identificada': 'class',
  'Metadados extraídos': 'metadata',
  'Nome recomendado gerado': 'ready',
  'Pronto para confirmação': 'ready',
  'Revisão necessária': 'ready',
};

function stepIndex(id: ProcessingStepId): number {
  return PROCESSING_STEP_DEFINITIONS.findIndex((step) => step.id === id);
}

export function buildStepsFromLogs(logs: ProcessingLogItem[]): ProcessingStep[] {
  const completed = new Set<ProcessingStepId>();

  for (const log of logs) {
    const stepId = LOG_TITLE_TO_STEP[log.title];
    if (stepId && (log.status === 'done' || log.status === 'error')) {
      completed.add(stepId);
    }
  }

  let activeIndex = -1;
  for (let index = 0; index < PROCESSING_STEP_DEFINITIONS.length; index += 1) {
    const step = PROCESSING_STEP_DEFINITIONS[index];
    if (!completed.has(step.id)) {
      activeIndex = index;
      break;
    }
  }

  return PROCESSING_STEP_DEFINITIONS.map((step, index) => {
    if (completed.has(step.id)) {
      return { ...step, status: 'done' as const };
    }
    if (index === activeIndex) {
      return { ...step, status: 'active' as const };
    }
    return { ...step, status: 'pending' as const };
  });
}

export function buildSimulatedSteps(activeStepIndex: number): ProcessingStep[] {
  return PROCESSING_STEP_DEFINITIONS.map((step, index) => {
    if (index < activeStepIndex) {
      return { ...step, status: 'done' as const };
    }
    if (index === activeStepIndex) {
      return { ...step, status: 'active' as const };
    }
    return { ...step, status: 'pending' as const };
  });
}

export function getMaxCompletedStepFromLogs(logs: ProcessingLogItem[]): number {
  let max = 0;
  for (const log of logs) {
    const stepId = LOG_TITLE_TO_STEP[log.title];
    if (stepId && log.status === 'done') {
      max = Math.max(max, stepIndex(stepId) + 1);
    }
  }
  return max;
}
