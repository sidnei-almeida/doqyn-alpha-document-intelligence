import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path: string): string {
  return readFileSync(path, 'utf-8');
}

test('endpoint de chat documental exige POST, autentica, valida acesso e delega ao service', () => {
  const source = read('api/documents/[documentId]/chat.ts');

  assert.ok(source.includes("req.method !== 'POST'"));
  assert.ok(source.includes('requireDocumentAuthContext'));
  assert.ok(source.includes('assertCanAccessDocument'));
  assert.ok(source.includes('answerDocumentChatQuestion'));
  assert.ok(source.includes('isServiceError'));
});

test('rota de chat está registrada no dispatcher da API', () => {
  const source = read('server/apiServer.ts');
  assert.ok(source.includes("api/documents/[documentId]/chat.js"));
  assert.match(source, /chat\$/);
});
