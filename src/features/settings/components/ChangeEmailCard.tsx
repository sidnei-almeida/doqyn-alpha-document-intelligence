import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  emailChangeApi,
  getEmailChangeErrorMessage,
  type RequestEmailChangeResponse,
} from '../api/emailChangeApi';

/**
 * Troca de e-mail é pedido, não campo: o endereço só muda depois que a pessoa confirma
 * pelo link enviado ao novo endereço.
 */
export function ChangeEmailCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [devLink, setDevLink] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ['email-change-status'],
    queryFn: async () => emailChangeApi.getStatus(),
  });

  const requestMutation = useMutation({
    mutationFn: (): Promise<RequestEmailChangeResponse> =>
      emailChangeApi.request({
        newEmail,
        password,
      }),
    onSuccess: async (result: RequestEmailChangeResponse) => {
      toast.success(result.message);
      setPassword('');
      setDevLink(result.confirmUrl ?? null);
      await queryClient.invalidateQueries({ queryKey: ['email-change-status'] });
    },
    onError: (error) => toast.error(getEmailChangeErrorMessage(error)),
  });

  useEffect(() => {
    if (statusQuery.data?.pending) {
      setNewEmail(statusQuery.data.newEmail);
    }
  }, [statusQuery.data]);

  const pendingStatus =
    statusQuery.data && statusQuery.data.pending === true && 'newEmail' in statusQuery.data
      ? statusQuery.data
      : null;
  const pending = pendingStatus !== null;

  return (
    <div className="settings-subblock">
      <div className="settings-subblock__header">
        <p className="register-label text-doqyn-subtle">Trocar e-mail</p>
        <p className="settings-section-note">
          O endereço atual é {user?.email ?? '—'}. Enviamos um link de confirmação para o novo
          e-mail antes de aplicar a troca.
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
        <p className="settings-section-note">
          Confirmação pendente para{' '}
          <strong className="font-medium text-doqyn-text">{pendingStatus.newEmail}</strong>.
          Verifique a caixa de entrada do novo endereço.
        </p>
      ) : null}

      {devLink ? (
        <p className="settings-section-note break-all">Link de desenvolvimento: {devLink}</p>
      ) : null}

      <div className="settings-block__action settings-block__action--end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => requestMutation.mutate()}
          disabled={requestMutation.isPending || pending || !newEmail || !password}
        >
          {requestMutation.isPending ? 'Enviando…' : 'Solicitar troca de e-mail'}
        </Button>
      </div>
    </div>
  );
}
