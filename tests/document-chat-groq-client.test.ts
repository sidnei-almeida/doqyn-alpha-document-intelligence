import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('server/ai/services/groqClient.ts', 'utf-8');

test('groqClient expõe completeChatConversation para o chat documental', () => {
  assert.ok(source.includes('export async function completeChatConversation'));
  assert.ok(source.includes("role: 'system' | 'user' | 'assistant'"));
});

test('chat NÃO força response_format json (resposta é texto livre)', () => {
  const fnStart = source.indexOf('export async function completeChatConversation');
  assert.ok(fnStart > -1);
  const fnBody = source.slice(fnStart);
  assert.ok(!fnBody.includes('response_format'));
});
