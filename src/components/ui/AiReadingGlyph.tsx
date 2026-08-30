import { cn } from '@/lib/utils';

/**
 * O sinal de que é a IA trabalhando — desenhado na língua da casa, não na de banco de ícones.
 *
 * A estrelinha de "magia" que estava aqui é o selo que todo produto usa para dizer IA, e não diz
 * nada sobre este: ela brilha, e o que a nossa faz é **ler**. O glifo é o mesmo gesto do painel da
 * antessala e da miniatura da fila — linhas de texto e um fio atravessando —, reduzido ao tamanho
 * de um ícone.
 *
 * O fio desce enquanto há leitura acontecendo e para quando acaba. Parado, ele fica na última
 * linha: é onde a leitura termina, e não uma posição de descanso escolhida por gosto.
 */
export function AiReadingGlyph({ reading, className }: { reading: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      {/* As linhas do texto: larguras desiguais, porque bloco alinhado lê como grade. */}
      <g stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" opacity="0.45">
        <path d="M3 4h10" />
        <path d="M3 7h7" />
        <path d="M3 10h9" />
        <path d="M3 13h5" />
      </g>

      {/* O fio da leitura: é a única parte acesa, e a única que se move. */}
      <path
        className={cn('ai-reading__thread', reading && 'ai-reading__thread--running')}
        d="M1.5 13h13"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
