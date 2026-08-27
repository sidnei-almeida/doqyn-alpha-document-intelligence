/**
 * O envio entre empresas está ligado?
 *
 * O diretório sabe distinguir "usuário DOQYN de outra empresa" de "não tem conta" desde a Fase B1,
 * mas o envio entre tenants só nasce na Fase D. Enquanto não nascer, contar a diferença a quem
 * consulta é a saída do oráculo de enumeração sem nada em troca: `/api/directory/lookup` é aberto
 * a qualquer autenticado, e a resposta viraria uma forma barata de descobrir quem tem conta aqui.
 *
 * Desligado, os dois casos respondem `external` — que é, hoje, a verdade útil: o link com token é
 * o único caminho disponível para os dois.
 */
export function isInterTenantSharingEnabled(): boolean {
  return process.env.INTERTENANT_SHARING_ENABLED === 'true';
}
