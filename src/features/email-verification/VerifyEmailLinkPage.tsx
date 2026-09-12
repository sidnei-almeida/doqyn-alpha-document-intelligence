import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthHeading } from '@/components/layout/AuthSplitShell';
import { AUTH_PRIMARY_BUTTON } from '@/features/auth/components/authControls';
import { cn } from '@/lib/utils';
import { emailVerificationApi, getEmailVerificationErrorMessage } from './api/emailVerificationApi';
import { clearVerificationTicket } from './verificationTicket';
import { useTranslation } from 'react-i18next';

/**
 * O caminho do link do e-mail: `/verificar-email/:token`.
 *
 * Confirma sozinha ao abrir, sem botão. O clique no e-mail já foi a intenção — pedir um segundo
 * clique aqui só adicionaria um passo entre a pessoa e a conta dela. Não pede sessão nem ticket:
 * quem abre isto costuma estar no celular, onde nunca houve login.
 */
export function VerifyEmailLinkPage() {
  const { t } = useTranslation('auth');

  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<'confirming' | 'done' | 'failed'>('confirming');
  const [error, setError] = useState<string | null>(null);
  // O StrictMode monta duas vezes em desenvolvimento, e o token é de uso único: sem esta trava a
  // segunda montagem confirmaria de novo e mostraria "link já utilizado" no caminho feliz.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    void (async () => {
      try {
        await emailVerificationApi.confirmToken(token);
        clearVerificationTicket();
        setState('done');
        toast.success(t('verifyEmailLinkPage.confirmed'));
      } catch (err) {
        setError(getEmailVerificationErrorMessage(err));
        setState('failed');
      }
    })();
  }, [token]);

  if (state === 'confirming') {
    return <AuthHeading title={t('verifyEmailLinkPage.confirmandoSeuEMail')} />;
  }

  if (state === 'failed') {
    return (
      <>
        <AuthHeading
          title={t('verifyEmailLinkPage.naoFoiPossivelConfirmar')}
          description={error ?? t('verifyEmailLinkPage.linkExpired')}
        />
        <Link to="/login" className={cn(AUTH_PRIMARY_BUTTON, 'w-full')}>
          {t('verifyEmailLinkPage.irParaOLogin')}
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title={t('verifyEmailLinkPage.eMailConfirmado')}
        description={t('verifyEmailLinkPage.suaContaEstaLiberada')}
      />
      <button
        type="button"
        onClick={() => navigate('/login', { replace: true })}
        className={cn(AUTH_PRIMARY_BUTTON, 'w-full')}
      >
        {t('verifyEmailLinkPage.irParaOLogin2')}
      </button>
    </>
  );
}
