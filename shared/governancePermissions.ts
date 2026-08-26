/**
 * Vocabulário do terceiro estado da governança — fonte única entre front e servidor.
 *
 * A regra grupo × categoria respondia "pode" ou "não pode". Agora responde três coisas, porque o
 * administrador do tenant precisa dizer que um grupo pode fazer algo **pedindo aprovação**: Gestão
 * compartilha direto, Comercial compartilha pedindo, Estágio não compartilha.
 */

export type GovernancePermissionState = 'deny' | 'require' | 'allow';

/**
 * O que fica gravado no Mongo.
 *
 * `true` e `false` são o formato antigo e continuam válidos — não há migração de dados. Só
 * `'require'` é novo. Ler pelo normalizador, nunca pelo valor cru: um `if (permissions.share)`
 * trataria `'require'` como liberado, que é justamente o lado errado para falhar.
 */
export type GovernancePermissionValue = boolean | 'require';

export function toPermissionState(
  value: GovernancePermissionValue | undefined,
): GovernancePermissionState {
  if (value === 'require') return 'require';
  return value ? 'allow' : 'deny';
}

export function fromPermissionState(state: GovernancePermissionState): GovernancePermissionValue {
  if (state === 'require') return 'require';
  return state === 'allow';
}

/**
 * Verbos que aceitam "pode, pedindo".
 *
 * Ler não entra: exigir aprovação para **ver** ou para **auditar** obrigaria a listagem a criar um
 * pedido por documento consultado, o que não é uma configuração inconveniente — é um jeito de
 * derrubar a Biblioteca. O terceiro estado só faz sentido para verbo que produz efeito.
 */
export const REQUIRABLE_PERMISSIONS = ['download', 'update', 'share'] as const;

export type RequirablePermission = (typeof REQUIRABLE_PERMISSIONS)[number];

export function isRequirablePermission(permission: string): permission is RequirablePermission {
  return (REQUIRABLE_PERMISSIONS as readonly string[]).includes(permission);
}

/**
 * Nivela um estado que o verbo não suporta.
 *
 * Guarda de escrita: `'require'` gravado em `view` viraria um estado que a autorização não sabe
 * honrar. Aqui ele cai para `allow`, que é o que o administrador quis dizer ao marcar a célula.
 */
export function normalizePermissionState(
  permission: string,
  state: GovernancePermissionState,
): GovernancePermissionState {
  if (state === 'require' && !isRequirablePermission(permission)) return 'allow';
  return state;
}
