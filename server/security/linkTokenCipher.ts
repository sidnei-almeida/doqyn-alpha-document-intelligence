import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Guarda o token de um link externo de forma reversível, para que quem concedeu o acesso
 * possa copiar o link de novo em vez de revogar e reemitir.
 *
 * O hash continua sendo o que valida o acesso; isto aqui é só a cópia legível para o dono
 * do documento. Sem `EXTERNAL_LINK_ENCRYPTION_KEY` nada é guardado, e a tela cai no
 * comportamento antigo: o link aparece uma vez, na criação.
 *
 * Envelope: iv(12) | tag(16) | ciphertext, em base64url — o mesmo formato do IP cifrado
 * da trilha de segurança, para não termos dois envelopes diferentes no mesmo servidor.
 *
 * Gere a chave com: `openssl rand -base64 32`
 */
const MIN_SECRET_LENGTH = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function resolveKey(): Buffer | null {
  const secret = process.env.EXTERNAL_LINK_ENCRYPTION_KEY?.trim();
  if (!secret) return null;

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `EXTERNAL_LINK_ENCRYPTION_KEY deve ter pelo menos ${MIN_SECRET_LENGTH} caracteres (gere com: openssl rand -base64 32).`,
    );
  }

  return createHash('sha256').update(secret).digest();
}

/** `true` quando os links podem ser recuperados depois da criação. */
export function canRecoverExternalLinks(): boolean {
  return resolveKey() !== null;
}

export function encryptLinkToken(token: string): string | null {
  const key = resolveKey();
  if (!key || !token.trim()) return null;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token.trim(), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

/**
 * Devolve `null` — nunca lança — quando o envelope não abre: chave trocada, registro
 * gravado antes da chave existir, dado corrompido. Quem chama trata isso como
 * "link não recuperável", que é exatamente o estado anterior.
 */
export function decryptLinkToken(envelope: string | null | undefined): string | null {
  const key = resolveKey();
  if (!key || !envelope?.trim()) return null;

  try {
    const raw = Buffer.from(envelope.trim(), 'base64url');
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;

    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
