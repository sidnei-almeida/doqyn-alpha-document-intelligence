import {
  fromPermissionState,
  isRequirablePermission,
  toPermissionState,
  type GovernancePermissionState,
  type GovernancePermissionValue,
} from '@shared/governancePermissions';
import { cn } from '@/lib/utils';
import type { DocumentAccessPermissions } from '../../api/rulesApi';

export type PermissionVerb = 'view' | 'download' | 'upload';

/** `upload` é o nome persistido do verbo `update` — é ele que decide se aceita "pedindo". */
const DOMAIN_VERB: Record<PermissionVerb, string> = {
  view: 'view',
  download: 'download',
  upload: 'update',
};

export const PERMISSION_VERBS: Array<{ key: PermissionVerb; label: string; short: string }> = [
  { key: 'view', label: 'Ver documentos', short: 'ver' },
  { key: 'download', label: 'Baixar', short: 'baixar' },
  { key: 'upload', label: 'Enviar', short: 'enviar' },
];

const STATE_SUFFIX: Record<GovernancePermissionState, string> = {
  deny: '',
  allow: ' — liberado',
  require: ' — pedindo aprovação',
};

/**
 * O próximo estado ao clicar.
 *
 * Verbo que aceita o meio-termo cicla `não · liberado · pedindo`; os de leitura seguem em dois
 * estados. Ciclar em vez de abrir um seletor mantém o verbo como o próprio controle — foi essa a
 * escolha que tirou a permissão de dentro do popover.
 */
function nextState(
  verb: PermissionVerb,
  current: GovernancePermissionState,
): GovernancePermissionState {
  if (!isRequirablePermission(DOMAIN_VERB[verb])) {
    return current === 'deny' ? 'allow' : 'deny';
  }
  if (current === 'deny') return 'allow';
  if (current === 'allow') return 'require';
  return 'deny';
}

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
  onToggle?: (verb: PermissionVerb, next: GovernancePermissionValue) => void;
  disabled?: boolean;
  variant?: 'token' | 'grid';
  className?: string;
}) {
  const readOnly = disabled || !onToggle;

  return (
    <span className={cn('permission-verbs', `permission-verbs--${variant}`, className)}>
      {PERMISSION_VERBS.map((verb) => {
        const state = toPermissionState(permissions[verb.key]);
        const label = `${verb.label}${STATE_SUFFIX[state]}`;
        if (readOnly) {
          return (
            <span
              key={verb.key}
              className="permission-verbs__mark"
              data-state={state}
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
            data-state={state}
            // Três estados não cabem em `aria-pressed`: o rótulo diz qual é.
            title={label}
            aria-label={label}
            onClick={(event) => {
              event.stopPropagation();
              onToggle(verb.key, fromPermissionState(nextState(verb.key, state)));
            }}
          >
            {variant === 'grid' ? '' : verb.short}
          </button>
        );
      })}
    </span>
  );
}
