import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import {
  askDocumentChatQuestion,
  type DocumentChatCitation,
  type DocumentChatHistoryMessage,
} from '../api/documentChatApi';

type ChatMessage = DocumentChatHistoryMessage & {
  id: string;
  citations?: DocumentChatCitation[];
};

type DocumentChatDrawerProps = {
  open: boolean;
  documentId: string | null;
  documentName: string | null;
  onClose: () => void;
};

function formatCitationLabel(citation: DocumentChatCitation): string {
  return citation.pageNumber ? `Página ${citation.pageNumber}` : `Trecho ${citation.chunkIndex + 1}`;
}

export function DocumentChatDrawer({ open, documentId, documentName, onClose }: DocumentChatDrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMessages([]);
    setQuestion('');
    setSending(false);
  }, [open, documentId]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!open || !documentId) return null;

  const handleSend = async () => {
    const trimmed = question.trim();
    if (!trimmed || sending) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);
    setQuestion('');
    setSending(true);

    try {
      const result = await askDocumentChatQuestion(documentId, trimmed, history);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.answer,
          citations: result.citations,
        },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível responder à pergunta.');
      setMessages((current) => current.filter((message) => message.id !== userMessage.id));
      setQuestion(trimmed);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={(event) => event.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex justify-end modal-overlay-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-chat-drawer-title"
    >
      <div className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-doqyn-border bg-doqyn-bg shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-doqyn-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="document-chat-drawer-title" className="text-[14px] font-semibold text-doqyn-text">
              Conversar com o documento
            </h2>
            {documentName && (
              <p className="truncate text-[12px] text-doqyn-muted">{documentName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-doqyn-muted transition-colors hover:bg-doqyn-hover hover:text-doqyn-text"
            aria-label="Fechar"
          >
            <Icon name="close" size={ICON_SIZE.md} />
          </button>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-doqyn-muted">
              <Icon name="chat" size={32} className="text-doqyn-subtle" />
              <p className="text-[13px]">Faça uma pergunta sobre este documento.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn('flex flex-col gap-1', message.role === 'user' ? 'items-end' : 'items-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px]',
                      message.role === 'user'
                        ? 'bg-doqyn-primary text-white'
                        : 'bg-doqyn-surface text-doqyn-text',
                    )}
                  >
                    {message.content}
                  </div>
                  {message.citations && message.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {message.citations.map((citation, index) => (
                        <span
                          key={`${message.id}-citation-${index}`}
                          className="rounded-full border border-doqyn-border-subtle bg-doqyn-surface px-2 py-0.5 text-[11px] text-doqyn-subtle"
                        >
                          {formatCitationLabel(citation)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="flex items-start">
                  <div className="flex items-center gap-2 rounded-xl bg-doqyn-surface px-3 py-2 text-[13px] text-doqyn-muted">
                    <Icon name="progress_activity" size={ICON_SIZE.xs} className="animate-spin" />
                    Pensando...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-doqyn-border px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Pergunte algo sobre este documento..."
              rows={2}
              disabled={sending}
              className="min-h-0 flex-1 resize-none rounded-lg border border-doqyn-border-subtle bg-doqyn-surface px-3 py-2 text-[13px] text-doqyn-text outline-none placeholder:text-doqyn-subtle focus:border-doqyn-primary disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending || !question.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-doqyn-primary text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Enviar pergunta"
            >
              <Icon name="send" size={ICON_SIZE.sm} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
