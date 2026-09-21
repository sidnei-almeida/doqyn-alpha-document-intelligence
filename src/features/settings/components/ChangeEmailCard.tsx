import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CodeInput } from '@/features/email-verification/components/CodeInput';
import { isIndividualTenant } from '@/lib/tenantVocabulary';
import {
  emailChangeApi,
  getEmailChangeErrorMessage,
  type RequestEmailChangeResponse,
} from '../api/emailChangeApi';
import { useTranslation } from 'react-i18next';

/** Segundos que faltam até `iso`, nunca negativo. */
function secondsUntil(iso: string | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

/**
 * Troca de e-mail é pedido, não campo: o endereço só muda depois que a pessoa prova ter acesso ao
 * novo — pelos 6 dígitos aqui, ou pelo link do mesmo e-mail.
 *
 * O código existe porque o link sozinho obrigava quem lê o e-mail no celular a voltar ao
 * computador com nada na mão. Os dois chegam na mesma mensagem.
 */
export function ChangeEmailCard() {
  const { t } = useTranslation('settings');

  const { user, tenant, refreshUser } = useAuth();
  // Sugerir um endereço corporativo a quem tem conta pessoal é oferecer um exemplo que não
  // se parece com o caso de uso dela.
  const emailPlaceholder = isIndividualTenant(tenant?.tenantType)
    ? t('changeEmailCard.placeholderIndividual')
    : t('changeEmailCard.placeholderBusiness');
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const statusQuery = useQuery({
    queryKey: ['email-change-status'],
    queryFn: async () => emailChangeApi.getStatus(),
  });

  const pendingStatus =
    statusQuery.data && statusQuery.data.pending === true && 'newEmail' in statusQuery.data
      ? statusQuery.data
      : null;
  const pending = pendingStatus !== null;

  function absorb(result: RequestEmailChangeResponse) {
    toast.success(result.message);
    setPassword('');
    setCode('');
    setDevCode(result.confirmCode ?? null);
  }

  const requestMutation = useMutation({
    mutationFn: (): Promise<RequestEmailChangeResponse> =>
      emailChangeApi.request({ newEmail, password }),
    onSuccess: async (result) => {
      absorb(result);
      await queryClient.invalidateQueries({ queryKey: ['email-change-status'] });
    },
    onError: (error) => toast.error(getEmailChangeErrorMessage(error)),
  });

  const resendMutation = useMutation({
    mutationFn: (): Promise<RequestEmailChangeResponse> => emailChangeApi.resend(),
    onSuccess: async (result) => {
      absorb(result);
      await queryClient.invalidateQueries({ queryKey: ['email-change-status'] });
    },
    onError: async (error) => {
      toast.error(getEmailChangeErrorMessage(error));
      await queryClient.invalidateQueries({ queryKey: ['email-change-status'] });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (value: string) => emailChangeApi.confirmCode(value),
    onSuccess: async (result) => {
      toast.success(result.message);
      setCode('');
      setNewEmail('');
      setDevCode(null);
      // O endereço mudou na conta, e a sessão em memória ainda tem o antigo — sem isto o card
      // continua anunciando "o endereço atual é" o que acabou de deixar de ser.
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ['email-change-status'] });
    },
    onError: async (error) => {
      setCode('');
      toast.error(getEmailChangeErrorMessage(error));
      // A contagem de tentativas restantes vive no servidor; recarregá-la é o que mantém o aviso
      // desta tela honesto depois de cada erro.
      await queryClient.invalidateQueries({ queryKey: ['email-change-status'] });
    },
  });

  useEffect(() => {
    if (pendingStatus) {
      setNewEmail(pendingStatus.newEmail);
      setCooldown(secondsUntil(pendingStatus.canResendAt));
    }
  }, [pendingStatus]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const attemptsLeft = pendingStatus?.attemptsLeft;
  const blocked = attemptsLeft === 0;

  return (
    <div className="settings-subblock">
      <div className="settings-subblock__header">
        <p className="register-label text-doqyn-subtle">{t('changeEmailCard.trocarEMail')}</p>
        <p className="settings-section-note">
          {t('changeEmailCard.oEnderecoAtualE')} {user?.email ?? '—'}
          {t('changeEmailCard.enviamosUmCodigoDe')}
        </p>
      </div>

      <div className="settings-identity__fields">
        <Input
          variant="rule"
          type="email"
          label={t('changeEmailCard.novoEMail')}
          value={newEmail}
          onChange={(event) => setNewEmail(event.target.value)}
          placeholder={emailPlaceholder}
          disabled={pending}
        />
        <Input
          variant="rule"
          type="password"
          revealable
          label={t('changeEmailCard.senhaAtual')}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t('changeEmailCard.confirmeSuaIdentidade')}
          disabled={pending}
        />
      </div>

      {pendingStatus ? (
        <div className="flex flex-col gap-4">
          <p className="settings-section-note">
            {t('changeEmailCard.enviamosUmCodigoPara')}{' '}
            <strong className="font-medium text-doqyn-text">{pendingStatus.newEmail}</strong>
            {t('changeEmailCard.digiteOAbaixoOu')}
          </p>

          <CodeInput
            value={code}
            onChange={setCode}
            onComplete={(value) => confirmMutation.mutate(value)}
            disabled={confirmMutation.isPending || blocked}
            invalid={confirmMutation.isError}
          />

          {/* Só depois de errar — ver `EmailVerificationPage`, mesmo raciocínio. */}
          {typeof attemptsLeft === 'number' && (confirmMutation.isError || blocked) ? (
            <p className="settings-section-note">
              {blocked
                ? t('changeEmailCard.codeBlocked')
                : t('changeEmailCard.attemptsLeft', { count: attemptsLeft })}
            </p>
          ) : null}

          {devCode ? (
            <p className="settings-section-note">
              {t('changeEmailCard.codigoDeDesenvolvimento')} {devCode}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="settings-block__action settings-block__action--end">
        {pending ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => resendMutation.mutate()}
              disabled={resendMutation.isPending || cooldown > 0}
            >
              {cooldown > 0
                ? t('changeEmailCard.resendIn', { seconds: cooldown })
                : resendMutation.isPending
                  ? t('changeEmailCard.resending')
                  : t('changeEmailCard.resend')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => confirmMutation.mutate(code)}
              disabled={code.length !== 6 || confirmMutation.isPending || blocked}
            >
              {confirmMutation.isPending
                ? t('changeEmailCard.confirming')
                : t('changeEmailCard.confirmChange')}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => requestMutation.mutate()}
            disabled={requestMutation.isPending || !newEmail || !password}
          >
            {requestMutation.isPending
              ? t('changeEmailCard.sending')
              : t('changeEmailCard.requestChange')}
          </Button>
        )}
      </div>
    </div>
  );
}
