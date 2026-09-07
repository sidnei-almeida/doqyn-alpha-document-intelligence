/**
 * Endereço público do app, usado para montar todo link que sai daqui para fora
 * (convite de compartilhamento externo, portal de assinatura).
 *
 * Antes o link era montado com o header `Origin`/`Referer` da requisição e caía para
 * `http://localhost:5173` quando não vinha nenhum — então link criado por job, por
 * integração ou por um navegador em outra origem saía apontando para a máquina errada.
 * O header agora é só reserva de desenvolvimento; em produção manda a variável.
 */
const LOCAL_FALLBACK = 'http://localhost:5173';

const MISSING_BASE_URL_MESSAGE =
  'Endereço público do app ausente em produção: sem ele os links externos (portal de assinatura, convite externo) apontariam para o endereço errado. Defina DOQYN_PUBLIC_APP_URL (ou PUBLIC_APP_BASE_URL) em deploy/.env, ex.: https://app.doqyn.com';

function isProductionRuntime(): boolean {
  return process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production';
}

/**
 * `DOQYN_PUBLIC_APP_URL` é o nome que o provisionamento já escreve (`setup-production-env.sh`,
 * `deploy/env/.env.production.example`) e que o `validate-vps-ready.sh` exige com https e
 * domínio. Este módulo nasceu com um nome próprio, `PUBLIC_APP_BASE_URL`, que nenhum deploy
 * jamais definiu — então em produção todo link externo caía no `throw` de `resolve...` e o
 * usuário via 500. Um endereço público só, com dois nomes aceitos: o específico ganha, o
 * provisionado vale.
 */
function readConfiguredBase(): string | null {
  return (
    normalizeBase(process.env.PUBLIC_APP_BASE_URL) ??
    normalizeBase(process.env.DOQYN_PUBLIC_APP_URL)
  );
}

function normalizeBase(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return null;
  }
}

export function resolvePublicAppBaseUrl(requestOrigin?: string | null): string {
  const configured = readConfiguredBase();
  if (configured) return configured;

  if (isProductionRuntime()) {
    throw new Error(MISSING_BASE_URL_MESSAGE);
  }

  return normalizeBase(requestOrigin) ?? LOCAL_FALLBACK;
}

export function isPublicAppBaseUrlConfigured(): boolean {
  return readConfiguredBase() !== null;
}

/**
 * Chamada no boot do servidor. `resolvePublicAppBaseUrl` só descobre a ausência quando alguém
 * pede um link, e aí já é tarde: a solicitação de assinatura fica gravada no banco e o usuário
 * recebe 500 sem explicação. Aqui o processo nem sobe.
 */
export function assertPublicAppBaseUrlInProduction(): void {
  if (!isProductionRuntime() || isPublicAppBaseUrlConfigured()) return;
  throw new Error(MISSING_BASE_URL_MESSAGE);
}
