/**
 * O frontend fala com um provedor só: o doqyn-auth-service (cookie HttpOnly + `/api/me`).
 * O que sobrou aqui é a raiz das rotas dele.
 */
export function getAuthBasePath(): string {
  return import.meta.env.VITE_AUTH_BASE_PATH?.trim() || '/auth';
}
