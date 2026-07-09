/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_AUTH_MODE: string;
  readonly VITE_AUTH_PROVIDER: string;
  readonly VITE_AUTH_BASE_PATH: string;
  /** Quando true, a fila da Biblioteca confirma documentos completed sem ReviewDrawer. */
  readonly VITE_UPLOAD_AUTO_CONFIRM_ENABLED?: string;
  /** Oculta o link "React Flow" no canvas de governança (default: true). */
  readonly VITE_REACT_FLOW_HIDE_ATTRIBUTION?: string;
  /** Exibe o MiniMap no canvas de governança (default: false). */
  readonly VITE_REACT_FLOW_SHOW_MINIMAP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
