/**
 * Textos padronizados para confirmações destrutivas.
 *
 * As frases moram em `src/i18n/catalog/<locale>/confirm.json`; aqui ficam só a montagem e as decisões
 * que um catálogo não expressa — qual `variant` usar, e quais confirmações exigem digitar uma
 * palavra antes de prosseguir.
 *
 * Duas coisas mudaram junto com a extração, e valem registro:
 *
 * **O plural saiu do código.** `buildMoveToTrashConfirm` decidia entre "este documento" e
 * "N documentos" com um ternário, e depois capitalizava a primeira letra com
 * `charAt(0).toUpperCase()` porque a frase começava pelo trecho variável. Isso já era frágil em
 * português e não sobreviveria a nenhum outro idioma: em inglês a ordem das palavras muda, e a
 * letra a capitalizar deixa de ser a primeira do trecho. Agora são duas frases inteiras no
 * catálogo, cada uma escrita por extenso, e quem escolhe é o `Intl.PluralRules`.
 *
 * **`buildDeleteGroupConfirm` ganhou plural que não tinha.** Dizia "1 membro(s)", com o
 * parêntese que existe justamente para não ter de escolher. Agora escolhe.
 */
import { i18n } from '@/i18n';

const NS = 'confirm';

function t(key: string, params?: Record<string, unknown>): string {
  return i18n.t(`${NS}:${key}`, params ?? {});
}

/** A palavra que a pessoa digita para liberar uma ação irreversível. */
export const CONFIRM_DELETE_WORD = 'EXCLUIR';

export function buildRemoveFromGroupConfirm(memberName: string, groupName: string) {
  return {
    title: t('removeFromGroup.title'),
    description: t('removeFromGroup.description', { memberName, groupName }),
    confirmLabel: t('removeFromGroup.confirmLabel'),
    variant: 'warning' as const,
  };
}

export function buildRemoveGroupFromCategoryConfirm(groupName: string, categoryName: string) {
  return {
    title: t('removeGroupFromCategory.title'),
    description: t('removeGroupFromCategory.description', { groupName, categoryName }),
    confirmLabel: t('removeGroupFromCategory.confirmLabel'),
    variant: 'warning' as const,
  };
}

export function buildDeleteCategoryConfirm(categoryName: string) {
  // O efeito da exclusão não está na pasta que some: está nos documentos que se mexem. Dizer
  // "precisarão ser reclassificados" mandava a pessoa fazer à mão o que o servidor já faz.
  //
  // Sem número aqui de propósito: a tela só conhece o que carregou, e com filtro ativo o número
  // seria menor que o real — pequeno demais para uma decisão irreversível. Quantos se moveram é o
  // servidor que responde, depois.
  return {
    title: t('deleteCategory.title'),
    description: t('deleteCategory.description', { categoryName }),
    confirmLabel: t('deleteCategory.confirmLabel'),
    confirmationText: CONFIRM_DELETE_WORD,
    variant: 'danger' as const,
  };
}

export function buildMoveToTrashConfirm(count: number) {
  return {
    title: t('moveToTrash.title'),
    description: t('moveToTrash.description', { count }),
    confirmLabel: t('moveToTrash.confirmLabel'),
    variant: 'warning' as const,
  };
}

export function buildDeleteGroupConfirm(groupName: string, memberCount: number) {
  return {
    title: t('deleteGroup.title'),
    description: t('deleteGroup.description', { groupName, count: memberCount }),
    confirmLabel: t('deleteGroup.confirmLabel'),
    confirmationText: CONFIRM_DELETE_WORD,
    variant: 'danger' as const,
  };
}

export function buildRejectApprovalConfirm(name: string) {
  return {
    title: t('rejectApproval.title'),
    description: t('rejectApproval.description', { name }),
    confirmLabel: t('rejectApproval.confirmLabel'),
    confirmationText: CONFIRM_DELETE_WORD,
    variant: 'danger' as const,
  };
}

export function buildRemoveMemberConfirm(name: string) {
  return {
    title: t('removeMember.title'),
    description: t('removeMember.description', { name }),
    confirmLabel: t('removeMember.confirmLabel'),
    /* A palavra a digitar é o nome da pessoa, não uma constante: é o que obriga a olhar
       para quem está sendo removido antes de confirmar. Não se traduz. */
    confirmationText: name,
    variant: 'danger' as const,
  };
}

export function buildSuspendMemberConfirm(name: string) {
  return {
    title: t('suspendMember.title'),
    description: t('suspendMember.description', { name }),
    confirmLabel: t('suspendMember.confirmLabel'),
    variant: 'warning' as const,
  };
}

export function buildRevokeSignatureRequestConfirm(signerName: string) {
  const name = signerName.trim() || t('revokeSignatureRequest.unnamedSigner');
  return {
    title: t('revokeSignatureRequest.title'),
    description: t('revokeSignatureRequest.description', { signerName: name }),
    confirmLabel: t('revokeSignatureRequest.confirmLabel'),
    variant: 'danger' as const,
  };
}
