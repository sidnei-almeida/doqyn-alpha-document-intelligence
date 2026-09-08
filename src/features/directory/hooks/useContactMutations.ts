import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';
import { forgetContactDecision, hideContact, saveContact } from '../api/frequentContactsApi';
import { i18n } from '@/i18n';

/**
 * Salvar e tirar da lista, com a lista se refazendo sozinha depois.
 *
 * Invalida a busca junto: quem acabou de salvar alguém achado pelo apelido precisa ver o botão
 * virar "salvo" sem recarregar a página.
 */
export function useContactMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['frequent-contacts'] });
    void queryClient.invalidateQueries({ queryKey: ['directory-search'] });
  };

  const save = useMutation({
    mutationFn: saveContact,
    onSuccess: () => {
      toast.success(i18n.t('directory:toast.contatoSalvo'));
      invalidate();
    },
    onError: (error) => showApiErrorToast(error, 'Não foi possível salvar o contato.'),
  });

  const hide = useMutation({
    mutationFn: hideContact,
    onSuccess: () => {
      // O aviso diz o que aconteceu de verdade: a troca continua registrada, e é ela que responde
      // auditoria. Dizer "excluído" prometeria um apagamento que não houve.
      toast.success(i18n.t('directory:toast.contatoRemovido'));
      invalidate();
    },
    onError: (error) => showApiErrorToast(error, 'Não foi possível remover o contato.'),
  });

  const forget = useMutation({
    mutationFn: forgetContactDecision,
    onSuccess: invalidate,
    onError: (error) => showApiErrorToast(error, 'Não foi possível desfazer.'),
  });

  return { save, hide, forget };
}
