import { SettingsRegisterList, type SettingsRegisterEntry } from '../SettingsRegisterList';

/** O que a plataforma já protege e registra sozinha — leitura, não configuração. */
const SECURITY_FACTS: SettingsRegisterEntry[] = [
  {
    icon: 'shield',
    title: 'Auditoria documental',
    description:
      'Upload, preview, download, alterações e acessos negados ficam registrados para investigação.',
    href: '/tracking',
    linkLabel: 'Ver tracking',
  },
  {
    icon: 'history_toggle_off',
    title: 'Histórico de versões',
    description:
      'Versões de documentos são preservadas no histórico da organização para rastreabilidade.',
  },
  {
    icon: 'visibility',
    title: 'Preview e visualização',
    description:
      'Previews respeitam as permissões de quem abre, e a visualização entra no tracking documental.',
    href: '/tracking',
    linkLabel: 'Ver tracking',
  },
  {
    icon: 'download',
    title: 'Downloads controlados',
    description: 'Download exige permissão explícita; a tentativa negada fica registrada.',
  },
  {
    icon: 'verified_user',
    title: 'Dados sanitizados',
    description:
      'Logs e tracking não guardam conteúdo de documento, OCR integral, tokens ou URL de storage em texto bruto.',
    href: '/audit',
    linkLabel: 'Ver auditoria',
  },
];

export function SecurityFactsBlock() {
  return <SettingsRegisterList entries={SECURITY_FACTS} />;
}
