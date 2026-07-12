import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SettingsCard } from './SettingsCard';
import { SettingsRow, SettingsRowList } from './SettingsRow';
import {
  emailChangeApi,
  getEmailChangeErrorMessage,
  type RequestEmailChangeResponse,
} from '../api/emailChangeApi';

export function ChangeEmailCard() {
  const { user, refreshUser } = useAuth();
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
    <SettingsCard density="compact" className="max-w-2xl">
      <div className="border-b border-doqyn-border px-4 py-4 sm:px-5">
        <h3 className="text-base font-semibold text-doqyn-text">E-mail da conta</h3>
        <p className="mt-1 text-sm text-doqyn-muted">
          Use o e-mail profissional da empresa. Enviaremos um link de confirmação para o novo
          endereço antes de aplicar a troca.
        </p>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <SettingsRowList>
          <SettingsRow
            label="E-mail atual"
            control={<p className="text-sm text-doqyn-text">{user?.email ?? '—'}</p>}
          />
          <SettingsRow
            label="Novo e-mail"
            description="Deve ser um endereço profissional válido da sua empresa."
            control={
              <Input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="voce@suaempresa.com.br"
                disabled={pending}
              />
            }
          />
          <SettingsRow
            label="Senha atual"
            description="Confirme sua identidade para solicitar a troca."
            control={
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Sua senha"
                disabled={pending}
              />
            }
          />
        </SettingsRowList>

        {pendingStatus ? (
          <p className="mt-4 rounded-md border border-doqyn-border bg-doqyn-surface-2 px-3 py-2 text-sm text-doqyn-muted">
            Confirmação pendente para <strong>{pendingStatus.newEmail}</strong>. Verifique a
            caixa de entrada do novo e-mail e clique no link recebido.
          </p>
        ) : null}

        {devLink ? (
          <p className="mt-3 break-all rounded-md border border-dashed border-doqyn-border px-3 py-2 text-xs text-doqyn-muted">
            Link de desenvolvimento: {devLink}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            onClick={() => requestMutation.mutate()}
            disabled={requestMutation.isPending || pending || !newEmail || !password}
          >
            {requestMutation.isPending ? 'Enviando…' : 'Solicitar troca de e-mail'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void refreshUser()}
            disabled={requestMutation.isPending}
          >
            Atualizar status
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}
