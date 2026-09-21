import { i18n } from '@/i18n';
import ptSettings from '@/i18n/catalog/pt-BR/settings.json';

export const PROFILE_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_AVATAR_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type AvatarMessage = keyof typeof ptSettings.profileAvatar;

/**
 * A frase no idioma ativo, com o `pt-BR` embutido como rede.
 *
 * A validação roda fora de componente e também em teste, onde o catálogo `settings` não foi
 * carregado — sem a rede, a mensagem viraria a chave crua.
 */
function message(key: AvatarMessage): string {
  const fullKey = `settings:profileAvatar.${key}`;
  return i18n.exists(fullKey) ? i18n.t(fullKey) : ptSettings.profileAvatar[key];
}

export function validateProfileAvatarFile(
  file: Pick<File, 'type' | 'size' | 'name'>,
): string | null {
  if (!PROFILE_AVATAR_ALLOWED_TYPES.has(file.type)) {
    return message('invalidType');
  }
  if (file.size > PROFILE_AVATAR_MAX_BYTES) {
    return message('tooLarge');
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.svg') || lower.endsWith('.gif')) {
    return message('notAllowed');
  }
  return null;
}
