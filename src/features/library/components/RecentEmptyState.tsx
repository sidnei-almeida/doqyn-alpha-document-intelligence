import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

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
  return (
    <div data-testid="recent-empty-state">
      <EmptyState
        title="Nenhum arquivo recente"
        description="Envie um documento para começar."
        action={
          <Button type="button" variant="secondary" size="sm" onClick={onUploadClick}>
            Enviar documento
          </Button>
        }
        className="py-10"
      />
    </div>
  );
}
