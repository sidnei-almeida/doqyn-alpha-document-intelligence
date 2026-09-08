import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTranslation } from 'react-i18next';

type EmptyFolderStateProps = {
  hasActiveFilters: boolean;
  title?: string;
  description?: string;
  showUploadActions?: boolean;
  onClearFilters: () => void;
  onUploadClick: () => void;
  uploadButtonLabel?: string;
};

/**
 * Vazio dentro de pasta.
 *
 * O convite deixou de ser um bloco preenchido: numa tela feita só de fio e
 * texto, ele era a única superfície pintada — e o teal saturado no meio do vão
 * gritava mais alto do que a frase que explica o que fazer. Agora é botão de
 * contorno, e o arrastar-e-soltar continua logo abaixo, como segunda via.
 */
export function EmptyFolderState({
  hasActiveFilters,
  title = 'Esta pasta ainda está vazia',
  description = 'Envie um documento para o DOQYN analisar e classificar.',
  showUploadActions = true,
  onClearFilters,
  onUploadClick,
  uploadButtonLabel = 'Enviar documento',
}: EmptyFolderStateProps) {
  const { t } = useTranslation('library');

  if (hasActiveFilters) {
    return (
      <div data-testid="library-empty-state">
        <EmptyState
          title={t('emptyFolderState.nenhumDocumentoParaOs')}
          description={t('emptyFolderState.ajusteABuscaOu')}
          action={
            <Button type="button" variant="secondary" size="sm" onClick={onClearFilters}>
              {t('emptyFolderState.limparFiltros')}
            </Button>
          }
        />
      </div>
    );
  }

  /**
   * Sem pictograma.
   *
   * A nuvem de upload no meio da tela era a terceira marca visual para a mesma ideia: o resto do
   * app abre o vazio com o fio curto do `EmptyState`, e a Biblioteca inteira vazia com a folha
   * desenhada. Três desenhos para "não há nada aqui" fazem parecer três situações diferentes — e a
   * nuvem ainda repetia em imagem o que o botão logo abaixo já diz em palavra.
   */
  return (
    <div data-testid="library-empty-state">
      <EmptyState
        title={title}
        description={description}
        stretch
        action={
          showUploadActions ? (
            <div className="flex flex-col items-center gap-4">
              <Button type="button" variant="secondary" size="md" onClick={onUploadClick}>
                {uploadButtonLabel}
              </Button>
              <p className="text-caption text-doqyn-subtle">
                {t('emptyFolderState.voceTambemPodeArrastar')}
              </p>
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
