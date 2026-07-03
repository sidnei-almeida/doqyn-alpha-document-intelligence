import type { NotificationPreferencesDto, PlatformRole } from './api/usersApi';

export type AccessFormState = {
  platformRoles: PlatformRole[];
  accessGroupIds: string[];
  documentGroupIds: string[];
  notificationPreferences: NotificationPreferencesDto;
};

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function notificationPrefsEqual(
  a: NotificationPreferencesDto,
  b: NotificationPreferencesDto,
): boolean {
  const keys = Object.keys(a) as Array<keyof NotificationPreferencesDto>;
  return keys.every((key) => a[key] === b[key]);
}

export function cloneAccessFormState(state: AccessFormState): AccessFormState {
  return {
    platformRoles: [...state.platformRoles],
    accessGroupIds: [...state.accessGroupIds],
    documentGroupIds: [...state.documentGroupIds],
    notificationPreferences: { ...state.notificationPreferences },
  };
}

export function isAccessFormDirty(current: AccessFormState, baseline: AccessFormState): boolean {
  const currentRoles = sortedUnique(current.platformRoles);
  const baselineRoles = sortedUnique(baseline.platformRoles);

  if (currentRoles.length !== baselineRoles.length) return true;
  for (let index = 0; index < currentRoles.length; index += 1) {
    if (currentRoles[index] !== baselineRoles[index]) return true;
  }

  const currentAccess = sortedUnique(current.accessGroupIds);
  const baselineAccess = sortedUnique(baseline.accessGroupIds);
  if (currentAccess.length !== baselineAccess.length) return true;
  for (let index = 0; index < currentAccess.length; index += 1) {
    if (currentAccess[index] !== baselineAccess[index]) return true;
  }

  const currentDocs = sortedUnique(current.documentGroupIds);
  const baselineDocs = sortedUnique(baseline.documentGroupIds);
  if (currentDocs.length !== baselineDocs.length) return true;
  for (let index = 0; index < currentDocs.length; index += 1) {
    if (currentDocs[index] !== baselineDocs[index]) return true;
  }

  return !notificationPrefsEqual(current.notificationPreferences, baseline.notificationPreferences);
}
