import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';
import { forgetContactDecision, hideContact, saveContact } from '../api/frequentContactsApi';

/**
 * Salvar e tirar da lista, com a lista se refazendo sozinha depois.
 *
 * Invalida a busca junto: quem acabou de salvar alguém achado pelo apelido precisa ver o botão
 * virar "salvo" sem recarregar a página.
 *
 * O `useTranslation` é o que carrega o catálogo `directory` na tela de contatos: com `i18n.t`
 * solto, o aviso sairia como chave crua ali, onde nada mais pede esse namespace.
 */
export function useContactMutations() {
  const { t } = useTranslation('directory');
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['frequent-contacts'] });
    void queryClient.invalidateQueries({ queryKey: ['directory-search'] });
  };

  const save = useMutation({
    mutationFn: saveContact,
    onSuccess: () => {
      toast.success(t('toast.contatoSalvo'));
      invalidate();
    },
    onError: (error) => showApiErrorToast(error, t('toast.erroSalvar')),
  });

  const hide = useMutation({
    mutationFn: hideContact,
    onSuccess: () => {
      // O aviso diz o que aconteceu de verdade: a troca continua registrada, e é ela que responde
      // auditoria. Dizer "excluído" prometeria um apagamento que não houve.
      toast.success(t('toast.contatoRemovido'));
      invalidate();
    },
    onError: (error) => showApiErrorToast(error, t('toast.erroRemover')),
  });

  const forget = useMutation({
    mutationFn: forgetContactDecision,
    onSuccess: invalidate,
    onError: (error) => showApiErrorToast(error, t('toast.erroDesfazer')),
  });

  return { save, hide, forget };
}
