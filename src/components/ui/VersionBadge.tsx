import { cn } from '@/lib/utils';
import { Tooltip } from './Tooltip';

interface VersionBadgeProps {
  version: number | string;
  isCurrent?: boolean;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

function formatVersionLabel(version: number | string): string {
  if (typeof version === 'number') return `v${version}`;
  const trimmed = version.trim();
  if (!trimmed) return trimmed;
  return /^v/i.test(trimmed) ? trimmed : `v${trimmed}`;
}

const SIZE_CLASS = {
  xs: 'text-micro',
  sm: 'text-micro',
  md: 'text-caption',
} as const;

/**
 * Versão é identificador, não estado — então não usa etiqueta. Sai a cápsula
 * azul e fica o que se lê caractere por caractere: monoespaçado e tabular.
 * A versão atual vem no tom do texto; as anteriores recuam para o discreto.
 */
export function VersionBadge({ version, isCurrent, className, size = 'sm' }: VersionBadgeProps) {
  const label = formatVersionLabel(version);
  const mark = (
    <span
      className={cn(
        'shrink-0 font-mono tabular-nums',
        SIZE_CLASS[size],
        isCurrent ? 'text-doqyn-muted' : 'text-doqyn-subtle',
        className,
      )}
    >
      {label}
    </span>
  );

  if (isCurrent) {
    return <Tooltip label="Versão atual">{mark}</Tooltip>;
  }

  return mark;
}
