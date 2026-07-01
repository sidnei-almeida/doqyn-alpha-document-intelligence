/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_AUTH_MODE: string;
  readonly VITE_AUTH_PROVIDER: string;
  readonly VITE_AUTH_BASE_PATH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
