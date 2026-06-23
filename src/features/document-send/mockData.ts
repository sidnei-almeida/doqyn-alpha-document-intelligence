import type { DocumentHistoryItem, ProcessingLogItem } from './types';

export function createSingleProcessingLogs(): ProcessingLogItem[] {
  return [
    {
      id: '1',
      title: 'Documento recebido',
      description: 'O arquivo foi recebido com sucesso.',
      time: '',
      status: 'pending',
    },
    {
      id: '2',
      title: 'Arquivo validado',
      description: 'Formato e tamanho verificados.',
      time: '',
      status: 'pending',
    },
    {
      id: '3',
      title: 'Leitura iniciada',
      description: 'Análise automática do conteúdo em andamento.',
      time: '',
      status: 'pending',
    },
    {
      id: '4',
      title: 'Tipo do documento identificado',
      description: 'Classificação concluída.',
      time: '',
      status: 'pending',
    },
    {
      id: '5',
      title: 'Metadados extraídos',
      description: 'Campos relevantes identificados.',
      time: '',
      status: 'pending',
    },
    {
      id: '6',
      title: 'Nome sugerido gerado automaticamente',
      description: 'Nome padronizado criado a partir dos metadados.',
      time: '',
      status: 'pending',
    },
    {
      id: '7',
      title: 'Regras validadas',
      description: 'Todas as regras aplicáveis foram verificadas.',
      time: '',
      status: 'pending',
    },
    {
      id: '8',
      title: 'Pronto para confirmação',
      description: 'Revise os metadados e confirme o envio.',
      time: '',
      status: 'pending',
    },
  ];
}

export function createBulkProcessingLogs(fileCount: number, reviewCount: number): ProcessingLogItem[] {
  const successCount = fileCount - reviewCount;
  return [
    {
      id: 'b1',
      title: 'Lote recebido',
      description: 'Os arquivos foram recebidos com sucesso.',
      time: '',
      status: 'pending',
    },
    {
      id: 'b2',
      title: `${fileCount} arquivos adicionados à fila`,
      description: 'Aguardando início da análise.',
      time: '',
      status: 'pending',
    },
    {
      id: 'b3',
      title: `${successCount} arquivos analisados com sucesso`,
      description: 'Metadados e nomes sugeridos gerados.',
      time: '',
      status: 'pending',
    },
    {
      id: 'b4',
      title: `${reviewCount} arquivos requerem revisão`,
      description: 'Confiança abaixo do limite recomendado.',
      time: '',
      status: reviewCount > 0 ? 'pending' : 'done',
    },
    {
      id: 'b5',
      title: 'Nomes sugeridos gerados automaticamente',
      description: 'Todos os nomes padronizados foram criados.',
      time: '',
      status: 'pending',
    },
    {
      id: 'b6',
      title: 'Lote pronto para confirmação',
      description: 'Revise os resultados e confirme o envio.',
      time: '',
      status: 'pending',
    },
  ];
}

export const MOCK_UPLOAD_HISTORY: DocumentHistoryItem[] = [
  {
    id: '1',
    originalName: 'contrato-final.pdf',
    suggestedName: 'Contrato_Acme_Suprimentos_2026-05-20_v2.pdf',
    category: 'Contrato',
    status: 'metadata_confirmed',
    confidenceScore: 0.94,
    version: 'v2.0',
    uploadedAt: '20/05/2026 09:17',
    lastActionAt: '20/05/2026 09:17',
  },
  {
    id: '2',
    originalName: 'scan_001.pdf',
    suggestedName: 'Nota_Fiscal_FornecedorX_2026-05-20_v1.pdf',
    category: 'Nota Fiscal',
    status: 'processed',
    confidenceScore: 0.91,
    version: 'v1.0',
    uploadedAt: '20/05/2026 09:02',
    lastActionAt: '20/05/2026 09:03',
  },
  {
    id: '3',
    originalName: 'arquivo_sem_nome.pdf',
    suggestedName: 'Documento_Requer_Revisao_2026-05-20_v1.pdf',
    category: 'Indefinido',
    status: 'requires_review',
    confidenceScore: 0.58,
    version: 'v1.0',
    uploadedAt: '20/05/2026 08:45',
    lastActionAt: '20/05/2026 08:46',
  },
  {
    id: '4',
    originalName: 'Boleto_789456.pdf',
    suggestedName: 'Boleto_Fornecedor_Y_2026-05-19_v1.pdf',
    category: 'Boleto',
    status: 'processed',
    confidenceScore: 0.88,
    version: 'v1.0',
    uploadedAt: '19/05/2026 16:30',
    lastActionAt: '19/05/2026 16:31',
  },
  {
    id: '5',
    originalName: 'Contrato_Servicos_TI.pdf',
    suggestedName: 'Contrato_Acme_Suprimentos_2026-05-19_v1.pdf',
    category: 'Contrato',
    status: 'metadata_confirmed',
    confidenceScore: 0.92,
    version: 'v1.3',
    uploadedAt: '19/05/2026 14:12',
    lastActionAt: '19/05/2026 14:13',
  },
  {
    id: '6',
    originalName: 'Declaracao_Fiscal_2026.pdf',
    suggestedName: 'Declaracao_Documento_2026-05-19_v1.pdf',
    category: 'Declaração',
    status: 'processed',
    confidenceScore: 0.9,
    version: 'v1.0',
    uploadedAt: '19/05/2026 11:05',
    lastActionAt: '19/05/2026 11:06',
  },
];

export function generateDocumentId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
