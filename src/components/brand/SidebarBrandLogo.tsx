import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { DoqynMark } from './DoqynMark';
import { useTranslation } from 'react-i18next';

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
 *
 * A marca é o atalho para a Biblioteca: é o que se espera do canto superior
 * esquerdo, e é de lá que todo o resto do workspace parte.
 */
export function SidebarBrandLogo({ collapsed = false, className }: SidebarBrandLogoProps) {
  const { t } = useTranslation('components');

  return (
    <Link
      to="/library"
      aria-label={t('sidebarBrandLogo.homeLink')}
      className={cn(
        'flex items-center rounded-[4px] transition-opacity hover:opacity-80',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-accent-active/40 focus-visible:ring-offset-2 focus-visible:ring-offset-doqyn-shell',
        collapsed ? 'w-10 justify-center' : 'w-full gap-2.5 px-1',
        className,
      )}
    >
      <DoqynMark size={collapsed ? 24 : 26} className="shrink-0 text-doqyn-accent-active" />
      {collapsed ? null : (
        <span className="font-display text-[17px] font-medium uppercase leading-none tracking-[0.16em] text-doqyn-text">
          {t('sidebarBrandLogo.doqyn')}
        </span>
      )}
    </Link>
  );
}
