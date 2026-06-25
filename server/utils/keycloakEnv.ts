export function getKeycloakBaseUrl(): string {
  return (
    process.env.KEYCLOAK_BASE_URL?.trim() ||
    process.env.VITE_KEYCLOAK_URL?.trim() ||
    ''
  ).replace(/\/$/, '');
}

export function getKeycloakRealm(): string {
  return process.env.KEYCLOAK_REALM?.trim() || process.env.VITE_KEYCLOAK_REALM?.trim() || 'doqyn';
}

export function getKeycloakAdminClientId(): string {
  return process.env.KEYCLOAK_ADMIN_CLIENT_ID?.trim() || 'doqyn-admin-api';
}

export function getKeycloakAdminClientSecret(): string {
  return process.env.KEYCLOAK_ADMIN_CLIENT_SECRET?.trim() || '';
}

export function getKeycloakFrontendClientId(): string {
  return (
    process.env.KEYCLOAK_FRONTEND_CLIENT_ID?.trim() ||
    process.env.VITE_KEYCLOAK_CLIENT_ID?.trim() ||
    'doqyn-web'
  );
}

export function getKeycloakIssuer(): string {
  return `${getKeycloakBaseUrl()}/realms/${getKeycloakRealm()}`;
}

export function isKeycloakAdminConfigured(): boolean {
  return Boolean(
    getKeycloakBaseUrl() &&
      getKeycloakRealm() &&
      getKeycloakAdminClientId() &&
      getKeycloakAdminClientSecret(),
  );
}

export function isKeycloakJwtConfigured(): boolean {
  return Boolean(getKeycloakBaseUrl() && getKeycloakRealm());
}
