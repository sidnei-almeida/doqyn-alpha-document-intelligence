import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { OverviewPanelShell } from './OverviewPanelShell';
import { useTranslation } from 'react-i18next';

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
    path: '/settings?section=perfil',
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

/**
 * Atalhos como índice: quatro linhas separadas por fio. Eram quatro cartões
 * com ladrilho preenchido em acento — quatro ações principais na mesma tela,
 * quando só pode existir uma.
 */
export function OverviewQuickAccessPanel({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation('dashboard');

  const navigate = useNavigate();
  const links = isAdmin ? ADMIN_LINKS : OPERATIONAL_LINKS;

  return (
    <OverviewPanelShell
      title={t('overviewQuickAccessPanel.acessoRapido')}
      subtitle="Governança e configurações em um clique"
      titleId="overview-quick-access-title"
      bodyClassName="flex flex-col"
      data-testid="overview-quick-access"
    >
      {links.map((link) => (
        <button
          key={link.id}
          type="button"
          onClick={() => navigate(link.path)}
          className="overview-row group flex items-center gap-3 py-3 pl-4 pr-2 text-left focus-visible:outline-none"
        >
          <Icon
            name={link.icon}
            size={ICON_SIZE.xs}
            className="shrink-0 text-doqyn-subtle transition-colors group-hover:text-doqyn-text"
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="block text-label font-medium text-doqyn-text">{link.label}</span>
            <span className="overview-row-meta mt-0.5 block">{link.description}</span>
          </span>
          <Icon
            name="chevron_right"
            size={ICON_SIZE.xs}
            className="shrink-0 text-doqyn-subtle transition-transform duration-150 group-hover:translate-x-0.5"
            aria-hidden
          />
        </button>
      ))}
    </OverviewPanelShell>
  );
}
