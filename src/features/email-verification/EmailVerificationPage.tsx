import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { AuthFooterLink, AuthHeading } from '@/components/layout/AuthSplitShell';
import { AUTH_PRIMARY_BUTTON } from '@/features/auth/components/authControls';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/apiErrors';
import { CodeInput } from './components/CodeInput';
import {
  emailVerificationApi,
  getEmailVerificationErrorMessage,
  type EmailVerificationStatus,
} from './api/emailVerificationApi';
import {
  clearVerificationTicket,
  readVerificationTicket,
  storeVerificationTicket,
} from './verificationTicket';

/** Segundos que faltam até `iso`, nunca negativo. */
function secondsUntil(iso: string | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

/**
 * A tela que pede os 6 dígitos.
 *
 * Chega-se aqui por dois caminhos — acabou de criar a conta, ou tentou entrar e o login recusou
 * por e-mail não confirmado. Nos dois o código já foi enviado antes de a tela abrir, então o
 * primeiro estado é "digite", e não "clique para enviar".
 */
export function EmailVerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const ticketFromNavigation = (location.state as { ticket?: string } | null)?.ticket;
  const [ticket] = useState<string | null>(ticketFromNavigation ?? readVerificationTicket());

  const [code, setCode] = useState('');
  const [status, setStatus] = useState<EmailVerificationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    if (ticketFromNavigation) {
      storeVerificationTicket(ticketFromNavigation);
    }
  }, [ticketFromNavigation]);

  const refreshStatus = useCallback(async () => {
    if (!ticket) return;
    try {
      const next = await emailVerificationApi.getStatus(ticket);
      setStatus(next);
      setCooldown(secondsUntil(next.canResendAt));

      // Confirmado noutro aparelho — é o caso de quem clicou no link pelo celular enquanto
      // esta aba esperava. Não há o que digitar aqui.
      if (next.verified) {
        clearVerificationTicket();
        toast.success('E-mail confirmado. Faça login para entrar.');
        navigate('/login', { replace: true });
      }
    } catch (err) {
      setError(getEmailVerificationErrorMessage(err));
    }
  }, [navigate, ticket]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // Enquanto a pessoa espera, o link pode ter sido aberto no celular. Uma consulta a cada 15
  // segundos é o que faz esta aba perceber isso sem que ninguém precise recarregar.
  useEffect(() => {
    if (!ticket) return;
    const timer = window.setInterval(() => void refreshStatus(), 15_000);
    return () => window.clearInterval(timer);
  }, [refreshStatus, ticket]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function handleConfirm(value: string) {
    if (!ticket || value.length !== 6 || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      await emailVerificationApi.confirmCode(ticket, value);
      clearVerificationTicket();
      toast.success('E-mail confirmado. Faça login para entrar.');
      navigate('/login', { replace: true });
    } catch (err) {
      setCode('');
      setError(getEmailVerificationErrorMessage(err));
      // O servidor devolve quantas tentativas sobraram na mensagem, e o estado traz o número.
      void refreshStatus();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!ticket || cooldown > 0 || resending) return;
    setResending(true);
    setError(null);

    try {
      const result = await emailVerificationApi.resend(ticket);
      setCode('');
      setDevCode(result.code ?? null);
      toast.success(result.message);
      await refreshStatus();
    } catch (err) {
      const message = getEmailVerificationErrorMessage(err);
      setError(message);
      if (err instanceof ApiError && err.code === 'EMAIL_VERIFICATION_RESEND_TOO_SOON') {
        await refreshStatus();
      }
    } finally {
      setResending(false);
    }
  }

  if (!ticket) {
    return (
      <>
        <AuthHeading
          title="Confirmação expirada"
          description="O passe desta confirmação venceu ou foi aberto noutro navegador. Entre com seu e-mail e senha para receber um código novo."
        />
        <Link to="/login" className={cn(AUTH_PRIMARY_BUTTON, 'w-full')}>
          Voltar ao login
        </Link>
      </>
    );
  }

  const attemptsLeft = status?.attemptsLeft;
  const blocked = attemptsLeft === 0;

  return (
    <>
      <AuthHeading
        title="Confirme seu e-mail"
        description={
          status?.email
            ? `Enviamos um código de 6 dígitos para ${status.email}. Digite-o abaixo — ou use o link do mesmo e-mail, se estiver no aparelho onde o abriu.`
            : 'Enviamos um código de 6 dígitos para o endereço do seu cadastro.'
        }
      />

      {error ? (
        <div className="mb-6">
          <AlertBanner variant="error" title="Não foi possível confirmar" message={error} />
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        <CodeInput
          value={code}
          onChange={setCode}
          onComplete={handleConfirm}
          disabled={submitting || blocked}
          invalid={Boolean(error)}
          autoFocus
        />

        {/* Só depois de errar, e o número vem do servidor: o teto é configurável, então comparar
            com um 5 escrito aqui esconderia o aviso em qualquer outra configuração. */}
        {typeof attemptsLeft === 'number' && (error !== null || blocked) ? (
          <p className="text-caption text-doqyn-muted">
            {blocked
              ? 'Este código foi bloqueado por excesso de tentativas. Peça um novo.'
              : `${attemptsLeft} tentativa(s) restante(s) neste código.`}
          </p>
        ) : null}

        {devCode ? (
          <p className="text-caption text-doqyn-muted">Código de desenvolvimento: {devCode}</p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleConfirm(code)}
          disabled={code.length !== 6 || submitting || blocked}
          className={cn(AUTH_PRIMARY_BUTTON, 'w-full')}
        >
          {submitting ? 'Confirmando…' : 'Confirmar e-mail'}
        </button>

        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={cooldown > 0 || resending}
          className="self-start text-caption text-doqyn-action underline-offset-4 hover:underline disabled:text-doqyn-disabled disabled:no-underline"
        >
          {cooldown > 0
            ? `Reenviar código em ${cooldown}s`
            : resending
              ? 'Reenviando…'
              : 'Reenviar código'}
        </button>
      </div>

      <AuthFooterLink>
        Prefere entrar com outra conta?{' '}
        <Link to="/login" className="text-doqyn-action underline-offset-4 hover:underline">
          Voltar ao login
        </Link>
      </AuthFooterLink>
    </>
  );
}
