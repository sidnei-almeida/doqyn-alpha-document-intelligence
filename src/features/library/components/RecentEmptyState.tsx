import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTranslation } from 'react-i18next';

type RecentEmptyStateProps = {
  onUploadClick: () => void;
};

/**
 * Recentes vazio, dentro da home.
 *
 * Usa o `EmptyState` como todo o resto: era o mesmo aviso escrito com tipografia própria
 * (`text-[13px]`, `text-[12px]`) e dentro de uma caixa de fundo, e isso o fazia parecer outro tipo
 * de coisa a três centímetros da lista vazia da pasta ao lado.
 *
 * O botão fica: aqui a seção está vazia enquanto o resto da tela tem conteúdo, então há para onde
 * apontar. É o oposto da Biblioteca inteira vazia, onde a barra lateral já oferece o caminho.
 */
export function RecentEmptyState({ onUploadClick }: RecentEmptyStateProps) {
  const { t } = useTranslation('library');

  return (
    <div data-testid="recent-empty-state">
      <EmptyState
        title={t('recentEmptyState.nenhumArquivoRecente')}
        description={t('recentEmptyState.envieUmDocumentoPara')}
        action={
          <Button type="button" variant="secondary" size="sm" onClick={onUploadClick}>
            {t('recentEmptyState.enviarDocumento')}
          </Button>
        }
        className="py-10"
      />
    </div>
  );
}
