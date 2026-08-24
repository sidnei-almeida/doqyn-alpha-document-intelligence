import { cn } from '@/lib/utils';
import { DoqynMark } from './DoqynMark';

type AuthBrandLogoProps = {
  subtitle?: string;
  className?: string;
};

/**
 * Lockup das telas públicas — marca em SVG mais wordmark tipográfico.
 *
 * Antes eram dois PNG trocados por tema. Desenhada em código, a marca segue o
 * token de acento sozinha, não precisa de par claro/escuro e não fica devendo
 * nitidez em tela densa.
 *
 * A entreletra do wordmark é 0.16em. O valor antigo, 0.3em, espalhava as letras
 * a ponto de a palavra parar de ser lida como palavra.
 */
export function AuthBrandLogo({ subtitle, className }: AuthBrandLogoProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2.5 text-center', className)}>
      <span className="flex items-center gap-3" aria-label="DOQYN" role="img">
        <DoqynMark size={38} className="shrink-0 text-doqyn-accent-active" />
        <span className="font-display text-[26px] font-medium uppercase leading-none tracking-[0.16em] text-doqyn-text">
          Doqyn
        </span>
      </span>

      {subtitle ? (
        <span className="font-mono text-micro uppercase tracking-[0.14em] text-doqyn-subtle">
          {subtitle}
        </span>
      ) : null}
    </div>
  );
}
