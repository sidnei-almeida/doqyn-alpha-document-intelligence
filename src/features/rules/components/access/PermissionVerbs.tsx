import { cn } from '@/lib/utils';
import type { DocumentAccessPermissions } from '../../api/rulesApi';

export type PermissionVerb = 'view' | 'download' | 'upload';

export const PERMISSION_VERBS: Array<{ key: PermissionVerb; label: string; short: string }> = [
  { key: 'view', label: 'Ver documentos', short: 'ver' },
  { key: 'download', label: 'Baixar', short: 'baixar' },
  { key: 'upload', label: 'Enviar', short: 'enviar' },
];

/**
 * Os três verbos de acesso, alternáveis no lugar.
 *
 * Antes o verbo só existia dentro do popover: para saber o que um grupo podia fazer era preciso
 * abrir a ficha dele. Aqui o verbo é o próprio controle — clicar liga e desliga —, e o popover
 * fica para o que é raro (remover o acesso, abrir os detalhes).
 *
 * `token` acompanha a ficha do quadro; `grid` é a marca compacta da célula da matriz.
 */
export function PermissionVerbs({
  permissions,
  onToggle,
  disabled,
  variant = 'token',
  className,
}: {
  permissions: DocumentAccessPermissions;
  onToggle?: (verb: PermissionVerb, next: boolean) => void;
  disabled?: boolean;
  variant?: 'token' | 'grid';
  className?: string;
}) {
  const readOnly = disabled || !onToggle;

  return (
    <span className={cn('permission-verbs', `permission-verbs--${variant}`, className)}>
      {PERMISSION_VERBS.map((verb) => {
        const active = permissions[verb.key];
        const label = `${verb.label}${active ? ' — ativo' : ''}`;
        if (readOnly) {
          return (
            <span
              key={verb.key}
              className="permission-verbs__mark"
              data-active={active}
              title={label}
              aria-label={label}
            >
              {variant === 'grid' ? '' : verb.short}
            </span>
          );
        }
        return (
          <button
            key={verb.key}
            type="button"
            className="permission-verbs__mark"
            data-active={active}
            aria-pressed={active}
            title={label}
            aria-label={label}
            onClick={(event) => {
              event.stopPropagation();
              onToggle(verb.key, !active);
            }}
          >
            {variant === 'grid' ? '' : verb.short}
          </button>
        );
      })}
    </span>
  );
}
