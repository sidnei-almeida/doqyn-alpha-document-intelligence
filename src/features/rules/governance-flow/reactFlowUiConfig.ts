/**
 * Opções de UI do React Flow — controladas por variáveis VITE_* (ver .env.example).
 *
 * Defaults quando a variável não está definida:
 * - attribution oculta (UI limpa em builds internos/demo)
 * - MiniMap desligado
 */

function envFlag(name: keyof ImportMetaEnv, defaultValue: boolean): boolean {
  const raw = import.meta.env?.[name];
  if (raw === undefined || raw === '') return defaultValue;
  return raw === 'true';
}

/** Oculta o link "React Flow" no canto do canvas (API oficial: proOptions.hideAttribution). */
export const REACT_FLOW_HIDE_ATTRIBUTION = envFlag('VITE_REACT_FLOW_HIDE_ATTRIBUTION', true);

/** Exibe o MiniMap no canto inferior direito (útil para mapas muito grandes). */
export const REACT_FLOW_SHOW_MINIMAP = envFlag('VITE_REACT_FLOW_SHOW_MINIMAP', false);
