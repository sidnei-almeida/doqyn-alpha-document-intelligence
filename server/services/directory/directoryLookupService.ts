import type { AuthUser } from '../../auth/types.js';
import type { DocumentRequestContext } from '../../tenancy/documentRequestContext.js';
import {
  fetchDirectoryUserEmail,
  lookupDirectoryUserByEmail,
  searchDirectoryUsersByUsername,
} from '../../integrations/doqynAuthInternalClient.js';
import { listOperationalTenantMembers } from '../tenantMemberRepository.js';
import { serializeTenantMember } from '../memberSerialize.js';
import { isInterTenantSharingEnabled } from '../../config/interTenantConfig.js';
import { redisIncrWithTtl } from '../../redis/redisClient.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { buildProfileAvatarUrl } from '../profile/profileAvatarConfig.js';

/**
 * Os três destinos possíveis de um e-mail digitado no formulário de envio.
 *
 * É esta bifurcação que impede o beco sem saída de hoje: quem digita um e-mail de fora não recebe
 * alternativa nenhuma. `external` não é falha — é o caminho do link com token, que já existe.
 */
export type DirectoryLookupResult =
  | {
      kind: 'tenant_member';
      user: { userId: string; name: string; email: string };
    }
  | {
      kind: 'doqyn_user';
      user: { userId: string; name: string };
    }
  | { kind: 'external' }
  | { kind: 'self' };

/**
 * Teto por quem consulta, não por e-mail consultado.
 *
 * Limitar por e-mail alvo não protege de nada: quem enumera varre e-mails **diferentes**, e cada
 * um estrearia o próprio balde. A janela curta segura a rajada de script; o teto diário é o que
 * impede a varredura lenta, que é como uma enumeração paciente se pareceria.
 */
const BURST_LIMIT = 20;
const BURST_WINDOW_SECONDS = 5 * 60;
const DAILY_LIMIT = 100;
const DAILY_WINDOW_SECONDS = 24 * 60 * 60;

type MemoryCounter = { count: number; resetAt: number };
const memoryCounters = new Map<string, MemoryCounter>();

/**
 * Sem Redis o teto ainda vale, só que por processo.
 *
 * Um limitador em memória não é distribuído e um deploy o zera — mas devolver "sem limite" quando
 * o Redis está desligado transformaria a configuração de desenvolvimento no oráculo que este
 * arquivo inteiro existe para não ser.
 */
function incrementInMemory(key: string, windowSeconds: number): number {
  const now = Date.now();
  const current = memoryCounters.get(key);

  if (!current || current.resetAt <= now) {
    memoryCounters.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return 1;
  }

  current.count += 1;
  return current.count;
}

async function consumeQuota(key: string, windowSeconds: number, limit: number): Promise<boolean> {
  const viaRedis = await redisIncrWithTtl(key, windowSeconds);
  const count = viaRedis ?? incrementInMemory(key, windowSeconds);
  return count <= limit;
}

async function assertLookupQuota(userId: string): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const window = Math.floor(Date.now() / (BURST_WINDOW_SECONDS * 1000));

  const withinBurst = await consumeQuota(
    `directory:lookup:${userId}:${window}`,
    BURST_WINDOW_SECONDS,
    BURST_LIMIT,
  );
  const withinDay = await consumeQuota(
    `directory:lookup:${userId}:${day}`,
    DAILY_WINDOW_SECONDS,
    DAILY_LIMIT,
  );

  if (withinBurst && withinDay) return;

  throw new ServiceError(
    'Muitas buscas em pouco tempo. Tente de novo mais tarde.',
    'DIRECTORY_LOOKUP_RATE_LIMITED',
    429,
  );
}

function normalizeEmail(raw: string | undefined): string {
  const email = raw?.trim().toLowerCase() ?? '';

  // Validação de forma, não de existência: o e-mail malformado nem chega ao auth-service, e assim
  // não gasta cota de quem digitou errado.
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ServiceError('Informe um e-mail válido.', 'DIRECTORY_EMAIL_INVALID', 400);
  }

  return email;
}

/**
 * Para onde este e-mail aponta.
 *
 * A ordem importa: membro do mesmo tenant é resolvido **antes** de perguntar ao auth-service. O
 * caminho de dentro de casa já existe, não gasta chamada de rede, e não deve consumir a cota que
 * existe para proteger a fronteira de fora.
 */
export async function lookupDirectoryTarget(
  ctx: DocumentRequestContext,
  user: AuthUser,
  rawEmail: string | undefined,
): Promise<DirectoryLookupResult> {
  const email = normalizeEmail(rawEmail);

  if (email === user.email?.trim().toLowerCase()) {
    return { kind: 'self' };
  }

  const members = await listOperationalTenantMembers(ctx.tenantId);
  const member = members
    .filter((item) => item.status === 'active')
    .map(serializeTenantMember)
    .find((item) => item.email?.trim().toLowerCase() === email && Boolean(item.userId));

  if (member) {
    return {
      kind: 'tenant_member',
      user: { userId: member.userId, name: member.name, email: member.email },
    };
  }

  await assertLookupQuota(user.id);

  const found = await lookupDirectoryUserByEmail(email);

  /**
   * Enquanto a Fase D não existe, ter conta e não ter conta respondem a mesma coisa.
   *
   * O colapso é aqui, e não na tela, porque `/api/directory/lookup` é chamável direto por qualquer
   * autenticado: esconder a diferença só no formulário esconderia de quem não estava procurando.
   * A cota já foi gasta — a pergunta chegou a sair para o auth-service, e é isso que se limita.
   */
  if (!found || !isInterTenantSharingEnabled()) {
    return { kind: 'external' };
  }

  return {
    kind: 'doqyn_user',
    user: { userId: found.id, name: found.displayName },
  };
}

/**
 * Busca digitável entre empresas, por prefixo de handle.
 *
 * Consome a **mesma** cota do lookup por e-mail, e tem de consumir: buscar por prefixo é a forma
 * mais barata de varrer o cadastro que existe, e deixá-la de fora do teto tornaria o handle a
 * porta que o e-mail exato não é.
 *
 * Prefixo curto não sai daqui. Uma letra devolveria um pedaço grande do diretório a cada tecla, e
 * o cadastro inteiro em poucas dezenas de chamadas.
 */
export type DirectorySearchResult = {
  userId: string;
  username: string;
  name: string;
  /**
   * Vão junto porque o resultado precisa ser reconhecível: dois `camila.o` não se distinguem por
   * handle nenhum, e escolher o destinatário errado de um documento não é erro recuperável.
   *
   * É uma troca, e está registrada: quem varre prefixos passa a colher endereços. O teto de
   * consulta acima é o que resta segurando isso.
   */
  email: string;
  avatarUrl: string | null;
};

/**
 * O teto de resultados, e por que ele é a resposta a "e se houver mil Lucianas".
 *
 * Não há paginação aqui de propósito: um diretório navegável página a página é exatamente a
 * varredura que o teto de consulta existe para impedir. Quem não achou nas primeiras linhas
 * estreita o prefixo — é o prefixo, e não a rolagem, que resolve homônimo.
 */
export const DIRECTORY_SEARCH_LIMIT = 8;

export type DirectorySearchPage = {
  results: DirectorySearchResult[];
  /** Bateu no teto: há mais gente sob esse prefixo do que cabe na resposta. */
  hasMore: boolean;
};

export async function searchDirectoryUsers(
  ctx: DocumentRequestContext,
  user: AuthUser,
  rawQuery: string | undefined,
): Promise<DirectorySearchPage> {
  const prefix = rawQuery?.trim().toLowerCase() ?? '';
  if (prefix.length < 2) return { results: [], hasMore: false };

  if (!isInterTenantSharingEnabled()) return { results: [], hasMore: false };

  await assertLookupQuota(user.id);

  const hits = await searchDirectoryUsersByUsername(prefix, DIRECTORY_SEARCH_LIMIT);
  const members = await listOperationalTenantMembers(ctx.tenantId);
  const inHouse = new Set(
    members
      .map(serializeTenantMember)
      .map((member) => member.userId)
      .filter(Boolean),
  );

  // Contado **antes** do filtro: depois dele, oito colegas de casa removidos pareceriam "nada
  // encontrado" num prefixo que na verdade transbordou.
  const hasMore = hits.length >= DIRECTORY_SEARCH_LIMIT;

  const results = hits
    // Colega de casa some da busca de fora: para ele existe a busca por nome, que é melhor, e
    // oferecê-lo aqui criaria uma pendência de aceite onde bastava compartilhar.
    .filter((hit) => hit.id !== user.id && !inHouse.has(hit.id))
    .map((hit) => ({
      userId: hit.id,
      username: hit.username,
      name: hit.displayName || hit.username,
      email: hit.email,
      // Sem retrato ativo não há URL: mandar uma que responde 404 faria toda linha piscar a
      // imagem quebrada antes de cair na inicial.
      avatarUrl:
        hit.avatarStatus === 'active'
          ? buildProfileAvatarUrl({ userId: hit.id, version: hit.avatarVersion, size: 64 })
          : null,
    }));

  return { results, hasMore };
}

/**
 * O usuário por trás de um apelido.
 *
 * A busca devolve apelido e nome, nunca e-mail: entregá-lo a quem digitou duas letras faria do
 * diretório uma lista de endereços. Quando alguém escolhe um resultado, é o apelido que viaja, e é
 * aqui que ele vira identidade.
 *
 * Reusa a própria busca em vez de uma rota nova: um prefixo que é o apelido inteiro devolve, entre
 * os primeiros, o dono exato dele.
 */
export async function resolveDirectoryUserByUsername(
  rawUsername: string,
): Promise<{ userId: string; name: string; username: string; email: string | null } | null> {
  const username = rawUsername.trim().toLowerCase().replace(/^@/, '');
  if (username.length < 2 || !isInterTenantSharingEnabled()) return null;

  const hits = await searchDirectoryUsersByUsername(username, 5);
  const exact = hits.find((hit) => hit.username === username);
  if (!exact) return null;

  // O e-mail é buscado **aqui**, no servidor, e não vai para quem buscou: quem foi escolhido
  // precisa receber aviso, e o convite de assinatura precisa de destinatário real.
  const email = await fetchDirectoryUserEmail(exact.id);

  return {
    userId: exact.id,
    name: exact.displayName || exact.username,
    username: exact.username,
    email,
  };
}
