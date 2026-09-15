export function withAuthHeaders(
  headers?: HeadersInit,
  options?: { json?: boolean; hasBody?: boolean },
): HeadersInit {
  const merged = new Headers(headers);

  const shouldSetJsonContentType =
    options?.json !== false && (options?.hasBody ?? false) && !merged.has('Content-Type');

  if (shouldSetJsonContentType) {
    merged.set('Content-Type', 'application/json');
  }

  /**
   * O idioma ativo viaja em `Accept-Language`, o cabeçalho que já existe para isso — não num
   * `X-Doqyn-Locale` inventado.
   *
   * O servidor precisa dele nos caminhos em que não há perfil para consultar: o portal de
   * assinatura e o de compartilhamento externo atendem gente sem conta, e é a requisição que
   * carrega a única pista de idioma que existe ali.
   *
   * Lido do `<html lang>` de propósito. É o mesmo valor que o i18next mantém, e ler o DOM evita
   * que a camada de rede importe o módulo de i18n — o que criaria um ciclo, já que o cliente de
   * preferências passa por aqui para gravar o idioma.
   */
  if (!merged.has('Accept-Language') && typeof document !== 'undefined') {
    const lang = document.documentElement.lang;
    if (lang) merged.set('Accept-Language', lang);
  }

  return merged;
}

export function shouldSetJsonContentType(init?: RequestInit): boolean {
  const isFormData = init?.body instanceof FormData;
  const hasBody = init?.body !== undefined && init?.body !== null;
  return hasBody && !isFormData;
}
