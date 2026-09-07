import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type LeadDetailProps = {
  /** O que a linha é. */
  lead: ReactNode;
  /** O que ela acrescenta — o mesmo que vinha depois do travessão. */
  detail: ReactNode;
  className?: string;
};

/**
 * Duas informações de posto diferente na mesma linha, separadas por tipografia.
 *
 * Nasceu para tirar o travessão de frases como "Panorama de DOQYN Dev — documentos,
 * atividade e governança". Ali o traço não pontuava nada: ele avisava que o que vinha
 * depois valia menos que o que vinha antes. Peso e tamanho dizem isso sem gastar um
 * caractere, e dizem antes de a pessoa ler.
 *
 * Não fixa cor nem tamanho absoluto — o posto é sempre relativo ao contexto. O detalhe
 * sai um degrau abaixo do que o pai já definiu (`0.92em`) e desbota a partir da própria
 * tinta herdada, então o mesmo componente serve num subtítulo de 16px e numa dica de
 * 12px sem que nenhuma das duas telas precise saber da outra.
 *
 * Só para pares de postos diferentes. Onde o travessão pontua uma frase de verdade, ele
 * fica; e onde `—` marca valor ausente, é vocabulário do sistema, não pontuação.
 */
export function LeadDetail({ lead, detail, className }: LeadDetailProps) {
  return (
    <span className={cn('lead-detail', className)}>
      <span className="lead-detail__lead">{lead}</span>
      <span className="lead-detail__detail">{detail}</span>
    </span>
  );
}
