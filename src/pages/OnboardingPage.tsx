import { AccessChoicePage } from '@/features/access-request/AccessChoicePage';

export function OnboardingPage() {
  return (
    <AccessChoicePage
      eyebrow="Onboarding"
      title="Como você quer começar no DOQYN?"
      description="Sua conta foi autenticada com sucesso. Escolha o próximo passo para configurar seu acesso."
    />
  );
}
