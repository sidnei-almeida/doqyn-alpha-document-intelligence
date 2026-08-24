import { cn } from '@/lib/utils';
import { DoqynMark } from './DoqynMark';

type SidebarBrandLogoProps = {
  collapsed?: boolean;
  className?: string;
};

/**
 * Logo da sidebar — marca em SVG mais wordmark tipográfico.
 *
 * Eram três PNG: um claro, um escuro e um ícone isolado, trocados por tema. A
 * marca desenhada em código segue o token de acento sozinha, dispensa o par
 * claro/escuro, não fica devendo nitidez em tela densa e some junto com o
 * wordmark quando a barra recolhe.
 */
export function SidebarBrandLogo({ collapsed = false, className }: SidebarBrandLogoProps) {
  return (
    <div
      className={cn(
        'flex items-center',
        collapsed ? 'w-10 justify-center' : 'w-full gap-2.5 px-1',
        className,
      )}
      role="img"
      aria-label="DOQYN"
    >
      <DoqynMark size={collapsed ? 24 : 26} className="shrink-0 text-doqyn-accent-active" />
      {collapsed ? null : (
        <span className="font-display text-[17px] font-medium uppercase leading-none tracking-[0.16em] text-doqyn-text">
          Doqyn
        </span>
      )}
    </div>
  );
}
