/**
 * O provider fica **acima** do `AuthProvider`, e isso não é detalhe de ordenação.
 *
 * A antessala — login, cadastro, convite, verificação de e-mail, portal de assinatura — roda
 * antes de existir sessão, e é justamente a primeira coisa que alguém de fora vê. Se o idioma
 * dependesse da sessão, essas telas ficariam presas ao padrão e um convidado espanhol seria
 * recebido em português.
 */
import { useMemo, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { initI18n } from './index';

export function I18nProvider({ children }: { children: ReactNode }) {
  const instance = useMemo(() => initI18n(), []);
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
