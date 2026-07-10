export type SignatureCompletedMessage = {
  type: 'doqyn:signature-completed';
  documentId: string;
  signatureRequestId: string;
};

const CHANNEL_NAME = 'doqyn-signature-completed';

export function publishSignatureCompleted(input: {
  documentId: string;
  signatureRequestId: string;
}): void {
  if (typeof BroadcastChannel === 'undefined') return;

  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage({
    type: 'doqyn:signature-completed',
    documentId: input.documentId,
    signatureRequestId: input.signatureRequestId,
  } satisfies SignatureCompletedMessage);
  channel.close();
}

export function subscribeSignatureCompleted(
  handler: (message: SignatureCompletedMessage) => void,
): () => void {
  if (typeof BroadcastChannel === 'undefined') {
    return () => undefined;
  }

  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<SignatureCompletedMessage>) => {
    const data = event.data;
    if (data?.type !== 'doqyn:signature-completed') return;
    if (!data.documentId?.trim() || !data.signatureRequestId?.trim()) return;
    handler(data);
  };

  return () => channel.close();
}
