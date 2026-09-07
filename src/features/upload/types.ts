import type { PerItemNamingChoice } from '@/features/document-send/types/reviewWorkflowSettings';
import type { ExtractedMetadata } from '@/features/document-send/types';
import type { AnalysisQueueStatus, AnalyzePdfResponse } from './services/analyzePdf';
import type { UploadThumbnail } from './services/uploadThumbnail';

export type UploadQueueItemStatus =
  | 'queued'
  | 'analyzing'
  | 'review'
  | 'confirming'
  | 'awaiting_approval'
  | 'ai_paused'
  /**
   * O navegador parou de acompanhar; o servidor continua analisando. Não é erro, e por isso não
   * mora junto de `error`: o documento aparece na Biblioteca quando terminar.
   */
  | 'still_running'
  | 'done'
  | 'error';

/** Contexto de onde o upload foi iniciado (espaço/categoria aberto na Biblioteca). */
export type UploadContext = {
  categoryId?: string;
  categoryName?: string;
  /**
   * O pedido que este envio cumpre.
   *
   * Viaja no contexto do item porque é o único lugar que sobrevive ao caminho inteiro — fila,
   * análise, revisão e confirmação. O servidor usa isso para decidir a categoria, e por isso a
   * escolha de quem envia não a sobrescreve.
   */
  documentRequestId?: string;
};

export type UploadQueueItemAnalysis = {
  metadata: ExtractedMetadata;
  raw: AnalyzePdfResponse;
};

export type UploadQueueItem = {
  id: string;
  fileName: string;
  fileSize: number;
  status: UploadQueueItemStatus;
  context?: UploadContext;
  analysis?: UploadQueueItemAnalysis;
  documentId?: string;
  approvalId?: string;
  errorMessage?: string;
  /**
   * A pasta em que o documento entrou, dita pelo servidor ao confirmar.
   *
   * Não sai da análise: `classification.className` é o palpite da IA, que vem vazio quando o
   * documento cai em revisão e fica velho quando alguém corrige a classe antes de salvar.
   */
  savedCategoryName?: string;
  /** Escolha de nomeação por arquivo (quando policy = ask_each_file ou revisão manual). */
  namingChoice?: PerItemNamingChoice;
  /** Onde o documento está na fila da plataforma, atualizado a cada consulta de status. */
  queueStatus?: AnalysisQueueStatus;
  /**
   * A primeira página do arquivo, para a fila mostrar o documento sendo lido em vez de um ícone.
   *
   * Chega depois do item — renderizar a página leva alguns quadros, e segurar o enfileiramento por
   * causa disso atrasaria o envio para ganhar um enfeite. Ausente quando não dá para desenhar:
   * formato que o navegador não abre, PDF cifrado, arquivo corrompido.
   */
  thumbnail?: UploadThumbnail;
};
