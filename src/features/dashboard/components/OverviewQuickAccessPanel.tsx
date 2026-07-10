import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { OverviewPanelShell } from './OverviewPanelShell';

type QuickLink = {
  id: string;
  label: string;
  description: string;
  path: string;
  icon: string;
};

const ADMIN_LINKS: QuickLink[] = [
  {
    id: 'rules',
    label: 'Regras e categorias',
    description: 'Mapa de acesso e extração',
    path: '/rules',
    icon: 'balance',
  },
  {
    id: 'users',
    label: 'Usuários e grupos',
    description: 'Membros e permissões',
    path: '/users',
    icon: 'group',
  },
  {
    id: 'upload-ia',
    label: 'Upload e IA',
    description: 'Revisão e nomeação',
    path: '/settings?section=upload-ia',
    icon: 'neurology',
  },
  {
    id: 'settings',
    label: 'Configurações da conta',
    description: 'Perfil, tema e segurança',
    path: '/settings',
    icon: 'settings',
  },
];

const OPERATIONAL_LINKS: QuickLink[] = [
  {
    id: 'preferencias',
    label: 'Preferências',
    description: 'Tema e experiência',
    path: '/settings?section=perfil&tab=preferencias',
    icon: 'tune',
  },
  {
    id: 'perfil',
    label: 'Minha conta',
    description: 'Perfil e identidade',
    path: '/settings?section=perfil',
    icon: 'settings',
  },
];

type OverviewQuickAccessPanelProps = {
  isAdmin: boolean;
};

/** Atalhos grandes para configurações — menos cliques até o destino. */
export function OverviewQuickAccessPanel({ isAdmin }: OverviewQuickAccessPanelProps) {
  const navigate = useNavigate();
  const links = isAdmin ? ADMIN_LINKS : OPERATIONAL_LINKS;

  return (
    <OverviewPanelShell
      title="Acesso rápido"
      subtitle="Configurações e governança em um clique"
      titleId="overview-quick-access-title"
      className="h-full"
      bodyClassName="p-3 sm:p-4"
      data-testid="overview-quick-access"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {links.map((link) => (
          <button
            key={link.id}
            type="button"
            onClick={() => navigate(link.path)}
            className={cn(
              'overview-quick-link group flex items-center gap-3 rounded-xl border border-doqyn-border-subtle',
              'bg-doqyn-bg/40 px-3 py-3 text-left transition-colors hover:bg-doqyn-surface-hover sm:px-4 sm:py-3.5',
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-doqyn-primary-bg text-doqyn-primary">
              <Icon name={link.icon} size={ICON_SIZE.md} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-doqyn-text">{link.label}</span>
              <span className="mt-0.5 block text-xs text-doqyn-muted">{link.description}</span>
            </span>
            <Icon
              name="chevron_right"
              size={ICON_SIZE.xs}
              className="shrink-0 text-doqyn-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-doqyn-muted"
              aria-hidden
            />
          </button>
        ))}
      </div>
    </OverviewPanelShell>
  );
}
