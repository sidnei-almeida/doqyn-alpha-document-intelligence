/** Textos padronizados para confirmações destrutivas */
export const CONFIRM_DELETE_WORD = 'EXCLUIR';

export function buildRemoveFromGroupConfirm(memberName: string, groupName: string) {
  return {
    title: 'Remover membro do grupo?',
    description: `${memberName} perderá acesso às categorias liberadas para o grupo ${groupName}. Esta ação pode ser revertida arrastando o membro de volta.`,
    confirmLabel: 'Remover do grupo',
    variant: 'warning' as const,
  };
}

export function buildRemoveGroupFromCategoryConfirm(groupName: string, categoryName: string) {
  return {
    title: 'Remover acesso do grupo?',
    description: `Todos os membros do grupo ${groupName} perderão acesso à categoria ${categoryName}.`,
    confirmLabel: 'Remover acesso',
    variant: 'warning' as const,
  };
}

export function buildDeleteCategoryConfirm(categoryName: string) {
  return {
    title: 'Excluir categoria?',
    description: `A categoria "${categoryName}" será removida permanentemente. Documentos vinculados a ela precisarão ser reclassificados.`,
    confirmLabel: 'Excluir categoria',
    confirmationText: CONFIRM_DELETE_WORD,
    variant: 'danger' as const,
  };
}

export function buildMoveToTrashConfirm(count: number) {
  const label = count === 1 ? 'este documento' : `${count} documentos`;
  return {
    title: 'Mover para a lixeira?',
    description: `${label.charAt(0).toUpperCase()}${label.slice(1)} será movido para a lixeira. Você poderá restaurar antes da exclusão permanente.`,
    confirmLabel: 'Mover para lixeira',
    variant: 'warning' as const,
  };
}

export function buildPermanentDeleteConfirm(count: number) {
  const label = count === 1 ? 'este documento' : `${count} documentos`;
  return {
    title: 'Excluir permanentemente?',
    description: `${label.charAt(0).toUpperCase()}${label.slice(1)} será removido de forma irreversível, incluindo arquivos originais e previews no storage.`,
    confirmLabel: 'Excluir permanentemente',
    confirmationText: CONFIRM_DELETE_WORD,
    variant: 'danger' as const,
  };
}

export function buildDeleteGroupConfirm(groupName: string, memberCount: number) {
  return {
    title: 'Excluir grupo?',
    description: `O grupo "${groupName}" será removido. ${memberCount} membro(s) perderão as permissões associadas a este grupo, e as categorias vinculadas serão atualizadas.`,
    confirmLabel: 'Excluir grupo',
    confirmationText: CONFIRM_DELETE_WORD,
    variant: 'danger' as const,
  };
}

export function buildRejectApprovalConfirm(name: string) {
  return {
    title: 'Recusar solicitação?',
    description: `${name} não terá acesso à empresa. Esta ação não pode ser desfeita automaticamente — será necessário enviar um novo convite.`,
    confirmLabel: 'Recusar',
    confirmationText: CONFIRM_DELETE_WORD,
    variant: 'danger' as const,
  };
}

export function buildRemoveMemberConfirm(name: string) {
  return {
    title: 'Remover membro da empresa?',
    description: `${name} perderá todo o acesso a documentos e grupos imediatamente. Esta ação é irreversível sem um novo convite.`,
    confirmLabel: 'Remover membro',
    confirmationText: name,
    variant: 'danger' as const,
  };
}

export function buildSuspendMemberConfirm(name: string) {
  return {
    title: 'Suspender acesso?',
    description: `${name} não poderá acessar documentos até que o acesso seja reativado por um administrador.`,
    confirmLabel: 'Suspender',
    variant: 'warning' as const,
  };
}
