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
  const configured = normalizeBase(process.env.PUBLIC_APP_BASE_URL);
  if (configured) return configured;

  if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error(
      'PUBLIC_APP_BASE_URL é obrigatório em produção: sem ele os links externos apontam para o endereço errado.',
    );
  }

  return normalizeBase(requestOrigin) ?? LOCAL_FALLBACK;
}

export function isPublicAppBaseUrlConfigured(): boolean {
  return normalizeBase(process.env.PUBLIC_APP_BASE_URL) !== null;
}
