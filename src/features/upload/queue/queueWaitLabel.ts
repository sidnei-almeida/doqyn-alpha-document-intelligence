import type { AnalysisQueueStatus } from '@/features/document-send/services/analyzePdf';
import { commonPhrase } from '@/i18n/commonPhrase';

/**
 * Texto curto de espera para o item na tela.
 *
 * "Analisando com IA…" para todo mundo é o que faz espera longa parecer travamento — e usuário que
 * acha que travou recarrega a página e reenvia, aumentando a fila que ele está esperando escoar.
 * Aqui ele vê a diferença entre "é a sua vez" e "tem 400 na frente".
 */
export function formatWaitSeconds(seconds: number): string {
  if (seconds < 60) return commonPhrase('uploadQueue.wait.lessThanMinute');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return commonPhrase('uploadQueue.wait.minutes', { count: minutes });
  const hours = Math.max(1, Math.round(seconds / 3_600));
  return commonPhrase('uploadQueue.wait.hours', { count: hours });
}

/** `null` quando não há nada de útil a dizer — aí a tela mantém o texto de status normal. */
export function formatQueueWaitLabel(queueStatus: AnalysisQueueStatus | undefined): string | null {
  if (!queueStatus) return null;
  if (queueStatus.status !== 'queued' && queueStatus.status !== 'processing') return null;

  const position = queueStatus.queuePosition;
  const estimate = queueStatus.estimatedWaitSeconds;

  // Posição zero é a vez dele: falar em "0 na frente" só confunde.
  if (position === undefined || position <= 0) {
    return estimate
      ? commonPhrase('uploadQueue.wait.yourTurn', { wait: formatWaitSeconds(estimate) })
      : null;
  }

  const positionLabel = commonPhrase('uploadQueue.wait.ahead', { count: position });
  return estimate
    ? commonPhrase('uploadQueue.wait.withEstimate', {
        position: positionLabel,
        wait: formatWaitSeconds(estimate),
      })
    : positionLabel;
}
