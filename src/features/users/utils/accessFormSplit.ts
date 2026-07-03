export type UserAccessFormInput = {
  platformRoles: string[];
  accessGroupIds: string[];
  documentGroupIds: string[];
  notificationPreferences?: Record<string, boolean>;
};

export function splitUserAccessPayload(form: UserAccessFormInput) {
  return {
    authService: {
      platformRoles: form.platformRoles,
      accessGroupIds: form.accessGroupIds,
      notificationPreferences: form.notificationPreferences,
    },
    documentGovernance: {
      documentGroupIds: form.documentGroupIds,
    },
  };
}

export function accessGroupIdsConflictWithDocumentGroups(
  accessGroupIds: string[],
  documentGroupIds: string[],
): boolean {
  return accessGroupIds.some((id) => documentGroupIds.includes(id));
}

/** Capacidades da tela /rules — membros são gerenciados em /users. */
export const RULES_SCREEN_CAPABILITIES = {
  managesDocumentGroupMembers: false,
  showsMemberCountReadOnly: true,
  managesAccessGroups: false,
  managesUserRoles: false,
} as const;
