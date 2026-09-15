import { AccessChoicePage } from '@/features/access-choice/AccessChoicePage';
import { useTranslation } from 'react-i18next';

export function OnboardingPage() {
  const { t } = useTranslation('pages');

  return (
    <AccessChoicePage
      title={t('onboardingPage.comoVoceQuerComecar')}
      description={t('onboardingPage.suaContaFoiAutenticada')}
    />
  );
}
