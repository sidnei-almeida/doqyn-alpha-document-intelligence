import { AccessChoicePage } from '@/features/access-request/AccessChoicePage';

export function OnboardingPage() {
  return (
    <AccessChoicePage
      title="Como você quer começar no DOQYN?"
      description="Sua conta foi autenticada. Falta escolher como o seu acesso será configurado."
    />
  );
}
