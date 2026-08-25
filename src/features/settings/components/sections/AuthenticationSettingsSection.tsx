import { usesDoqynAuth } from '@/auth/authConfig';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { PasswordChangeCard } from '../PasswordChangeCard';

/**
 * Acesso é o que a pessoa faz com a própria conta. Provedor, tipo de cookie e OAuth são
 * detalhe de infraestrutura — não aparecem para quem usa o app.
 */
export function AuthenticationSettingsSection() {
  return (
    <SettingsSectionBody>{usesDoqynAuth() ? <PasswordChangeCard /> : null}</SettingsSectionBody>
  );
}
