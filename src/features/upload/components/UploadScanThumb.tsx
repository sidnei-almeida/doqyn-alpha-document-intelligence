import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { UploadQueueItem, UploadQueueItemStatus } from '../types';

/**
 * O documento sendo lido, do tamanho de um ícone.
 *
 * É a mesma linguagem da antessala do login — página clara, varredura descendo —, com uma
 * diferença que muda tudo: **aqui a página é o arquivo de verdade**, e o movimento responde ao
 * estado real do envio. Quem enviou sabe o que enviou; varrer uma folha inventada seria enfeite
 * que se desmascara no primeiro olhar.
 *
 * A varredura corre **só** enquanto a IA está lendo. Antes disso a página espera parada, depois
 * dela fica nítida com o carimbo. É o que separa animação de informação: a fila fica aberta no
 * canto durante todo o trabalho, e movimento que não diz nada, ali, vira ruído.
 */
const SCANNING: UploadQueueItemStatus[] = ['analyzing', 'confirming'];

/** Sem miniatura a linha continua: não desenhar a página é detalhe, não é falha do envio. */
function FallbackGlyph({ status }: { status: UploadQueueItemStatus }) {
  const name =
    status === 'error' || status === 'ai_paused'
      ? 'error'
      : status === 'done'
        ? 'check_circle'
        : status === 'still_running'
          ? 'cloud_sync'
          : status === 'review'
            ? 'visibility'
            : status === 'awaiting_approval'
              ? 'hourglass_top'
              : 'description';
  return (
    <Icon
      name={name}
      size={ICON_SIZE.sm}
      className={cn(
        status === 'done' && 'text-doqyn-success',
        (status === 'error' || status === 'ai_paused') && 'text-doqyn-danger',
        status === 'still_running' && 'text-doqyn-info',
        status === 'review' && 'text-doqyn-warning',
        status === 'awaiting_approval' && 'text-doqyn-info',
        !['done', 'error', 'ai_paused', 'still_running', 'review', 'awaiting_approval'].includes(
          status,
        ) && 'text-doqyn-muted',
      )}
    />
  );
}

export function UploadScanThumb({ item }: { item: UploadQueueItem }) {
  const { thumbnail, status } = item;

  if (!thumbnail) {
    return (
      <span className="flex h-11 w-8 items-center justify-center">
        <FallbackGlyph status={status} />
      </span>
    );
  }

  const scanning = SCANNING.includes(status);
  const failed = status === 'error' || status === 'ai_paused';

  return (
    <span
      className={cn(
        'upload-thumb relative block h-11 w-8 shrink-0 overflow-hidden rounded-[2px] bg-white',
        // A página inteira esmaece quando o envio falha: manter o papel aceso ao lado da mensagem
        // de erro diria que ainda há trabalho em curso.
        failed && 'opacity-40 grayscale',
      )}
      aria-hidden
    >
      <img
        src={thumbnail.url}
        alt=""
        className="h-full w-full object-cover object-top"
        draggable={false}
      />

      {scanning ? (
        <span className="upload-thumb__scan pointer-events-none absolute inset-x-0" />
      ) : null}

      {/* O carimbo do fim: assenta uma vez, e é o que diz que a página parou de ser trabalhada. */}
      {status === 'done' ? (
        <span className="upload-thumb__stamp absolute inset-x-0 bottom-0 flex items-center justify-center bg-doqyn-success/90 py-[1px]">
          <Icon name="check" size={10} className="text-white" />
        </span>
      ) : null}
    </span>
  );
}
