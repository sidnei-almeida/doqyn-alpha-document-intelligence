import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CodeInput } from '@/features/email-verification/components/CodeInput';
import { plural } from '@/lib/plural';
import {
  emailChangeApi,
  getEmailChangeErrorMessage,
  type RequestEmailChangeResponse,
} from '../api/emailChangeApi';

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
  const { user, refreshUser } = useAuth();
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
        <p className="register-label text-doqyn-subtle">Trocar e-mail</p>
        <p className="settings-section-note">
          O endereço atual é {user?.email ?? '—'}. Enviamos um código de 6 dígitos ao novo e-mail
          antes de aplicar a troca.
        </p>
      </div>

      <div className="settings-identity__fields">
        <Input
          variant="rule"
          type="email"
          label="Novo e-mail"
          value={newEmail}
          onChange={(event) => setNewEmail(event.target.value)}
          placeholder="voce@suaempresa.com.br"
          disabled={pending}
        />
        <Input
          variant="rule"
          type="password"
          revealable
          label="Senha atual"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Confirme sua identidade"
          disabled={pending}
        />
      </div>

      {pendingStatus ? (
        <div className="flex flex-col gap-4">
          <p className="settings-section-note">
            Enviamos um código para{' '}
            <strong className="font-medium text-doqyn-text">{pendingStatus.newEmail}</strong>.
            Digite-o abaixo, ou use o link do mesmo e-mail.
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
                ? 'Este código foi bloqueado por excesso de tentativas. Peça um novo.'
                : `${plural(attemptsLeft, 'tentativa restante', 'tentativas restantes')} neste código.`}
            </p>
          ) : null}

          {devCode ? (
            <p className="settings-section-note">Código de desenvolvimento: {devCode}</p>
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
                ? `Reenviar em ${cooldown}s`
                : resendMutation.isPending
                  ? 'Reenviando…'
                  : 'Reenviar código'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => confirmMutation.mutate(code)}
              disabled={code.length !== 6 || confirmMutation.isPending || blocked}
            >
              {confirmMutation.isPending ? 'Confirmando…' : 'Confirmar troca'}
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
            {requestMutation.isPending ? 'Enviando…' : 'Solicitar troca de e-mail'}
          </Button>
        )}
      </div>
    </div>
  );
}
