import { authServiceJson } from '@/auth/authServiceClient';
import { api } from '@/lib/api';

export type AccountPreferencesUser = {
  id: string;
  email: string;
  locale?: string;
  timeZone?: string | null;
};

/**
 * A preferência é gravada no `doqyn-auth-service`, que é o dono da identidade — e é de lá que
 * o servidor do alpha a lê ao renderizar e-mail.
 *
 * O segundo passo não é opcional. O alpha guarda a sessão verificada em Redis por 45 segundos,
 * e dentro dessa janela ele continuaria usando o idioma antigo: quem acabou de mudar para
 * inglês podia disparar um compartilhamento e receber o e-mail em português. Quarenta e cinco
 * segundos é pouco, e é exatamente o intervalo em que a pessoa está conferindo se a troca
 * funcionou.
 *
 * Se o descarte do cache falhar, a gravação continua valendo — o efeito é só a janela voltar a
 * existir. Por isso ele não derruba a operação.
 */
export const accountPreferencesApi = {
  update: async (input: { locale?: string; timeZone?: string | null }) => {
    const result = await authServiceJson<{ ok: boolean; user: AccountPreferencesUser }>(
      '/account/preferences',
      { method: 'PATCH', body: JSON.stringify(input) },
    );
    await api.session.refresh().catch(() => undefined);
    return result;
  },
};
