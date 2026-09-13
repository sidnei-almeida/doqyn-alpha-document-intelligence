/**
 * Cabeçalho `Content-Disposition` para um nome que a pessoa lê.
 *
 * O nome de exibição guarda acento e pode vir em qualquer escrita, mas valor de cabeçalho HTTP só
 * carrega latin-1: o Node recusa o resto com `ERR_INVALID_CHAR`, e o download vira 500. Vai em dois
 * parâmetros (RFC 6266): `filename` em ASCII para cliente antigo e `filename*` em UTF-8, que o
 * navegador prefere — é ele que salva o arquivo com o acento.
 */
export function buildContentDisposition(
  disposition: 'inline' | 'attachment',
  fileName: string,
): string {
  const asciiFallback =
    fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\]/g, '_')
      .trim() || 'documento';

  const encoded = encodeURIComponent(fileName.normalize('NFC')).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
