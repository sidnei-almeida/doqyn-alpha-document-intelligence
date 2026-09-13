/**
 * As rotas que eram em português, e para onde foram.
 *
 * A URL era bilíngue por acidente — `/dashboard` e `/biblioteca` lado a lado. Padronizou em
 * inglês, e o endereço antigo **não morre**: há link dele em e-mail já entregue, em token de
 * convite em circulação e em favorito de navegador.
 *
 * Três leitores, uma lista: o roteador (redirect no cliente, que é o que funciona em
 * desenvolvimento), o nginx (`rewrite … permanent`, o 301 de verdade que link de e-mail recebe) e
 * o `vercel.json`. `tests/legacy-routes.test.ts` confere que os três conhecem cada entrada — um
 * redirect faltando é link quebrado que só aparece quando alguém clica.
 *
 * A ordem importa: o prefixo mais específico vem antes do geral.
 */
export const LEGACY_ROUTE_PREFIXES: ReadonlyArray<readonly [from: string, to: string]> = [
  ['/biblioteca/compartilhados', '/library/shared'],
  ['/biblioteca/assinaturas', '/library/signatures'],
  ['/biblioteca/recentes', '/library/recent'],
  ['/biblioteca/favoritos', '/library/favorites'],
  ['/biblioteca/lixeira', '/library/trash'],
  ['/biblioteca/desativados', '/library/deactivated'],
  ['/biblioteca', '/library'],
  ['/pedidos', '/requests'],
  ['/contatos', '/contacts'],
  ['/notificacoes', '/notifications'],
  ['/termos', '/terms'],
  ['/convite', '/invite'],
  ['/criar-empresa', '/signup/company'],
  ['/criar-acesso-cpf', '/signup/individual'],
  ['/confirmar-cadastro', '/verify-email'],
  ['/verificar-email', '/verify-email'],
  ['/confirmar-email', '/confirm-email-change'],
  ['/acesso', '/access'],
  ['/assinaturas', '/signatures'],
  ['/matriz', '/access-matrix'],
];

/** O primeiro segmento de cada rota antiga — uma rota curinga no roteador para cada. */
export const LEGACY_ROUTE_ROOTS: readonly string[] = [
  ...new Set(LEGACY_ROUTE_PREFIXES.map(([from]) => from.split('/')[1])),
];

/** O caminho novo para um antigo, com o resto do caminho preservado; `null` se não é antigo. */
export function resolveLegacyPath(pathname: string): string | null {
  for (const [from, to] of LEGACY_ROUTE_PREFIXES) {
    if (pathname === from || pathname.startsWith(`${from}/`)) {
      return `${to}${pathname.slice(from.length)}`;
    }
  }
  return null;
}
