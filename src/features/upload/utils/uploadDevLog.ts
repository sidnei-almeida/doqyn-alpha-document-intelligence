type DevLogPayload = Record<string, string | number | boolean | null | undefined>;

/** Logs DEV seguros do fluxo upload — sem tokens, cookies, objectKey ou conteúdo PDF. */
export function logUploadDev(phase: string, payload: DevLogPayload): void {
  if (!import.meta.env.DEV) return;
  console.debug('[upload]', phase, payload);
}

/** Logs DEV da Biblioteca após confirm/refetch. */
export function logLibraryDev(phase: string, payload: DevLogPayload): void {
  if (!import.meta.env.DEV) return;
  console.debug('[library]', phase, payload);
}
