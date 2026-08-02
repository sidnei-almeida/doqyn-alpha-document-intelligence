#!/usr/bin/env node
/**
 * Gera HTML da documentação técnica/funcional DoQyn Alpha + AUH.
 * Fontes auditadas: código dos repos alpha + doqyn-auth-service (2026-07-14).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, 'Documentacao_DoQyn_Alpha_AUH.html');
const DATE = '14 de julho de 2026';
const VERSION = '0.1.0-alpha';

/** Caixas de auditoria internas — não entram no PDF do produto. */
function audit(_sources, _findings, _confidence) {
  return '';
}

function simp(title, body) {
  return `<div class="box simp"><div class="box-label">Explicação simplificada</div><h4>${title}</h4>${body}</div>`;
}

function tech(title, body) {
  return `<div class="box tech"><div class="box-label">Explicação técnica</div><h4>${title}</h4>${body}</div>`;
}

const css = `
@page { size: A4; margin: 18mm 16mm 20mm 16mm; }
* { box-sizing: border-box; }
body {
  font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  color: #1a1a1a;
  line-height: 1.55;
  font-size: 10.5pt;
  max-width: 190mm;
  margin: 0 auto;
  padding: 0 4mm 24mm;
}
h1 { font-size: 22pt; margin: 0 0 8pt; color: #0b1f33; }
h2 {
  font-size: 15pt;
  color: #0b1f33;
  border-bottom: 2px solid #1a6b4a;
  padding-bottom: 4pt;
  margin-top: 28pt;
  page-break-after: avoid;
}
h3 { font-size: 12pt; color: #16324f; margin-top: 16pt; page-break-after: avoid; }
h4 { font-size: 10.5pt; margin: 0 0 6pt; }
p, li { orphans: 3; widows: 3; }
.cover {
  min-height: 240mm;
  display: flex;
  flex-direction: column;
  justify-content: center;
  page-break-after: always;
  border-left: 8px solid #1a6b4a;
  padding-left: 24pt;
}
.cover .brand { font-size: 13pt; letter-spacing: 0.18em; text-transform: uppercase; color: #1a6b4a; font-weight: 700; }
.cover .meta { margin-top: 28pt; color: #444; font-size: 10pt; }
.cover table.meta-t { border: none; margin-top: 12pt; }
.cover table.meta-t td { border: none; padding: 3pt 12pt 3pt 0; }
.toc { page-break-after: always; }
.toc ol { padding-left: 18pt; }
.toc a { color: #0b1f33; text-decoration: none; }
.box {
  border-radius: 6px;
  padding: 10pt 12pt;
  margin: 10pt 0;
  page-break-inside: avoid;
}
.box.simp { background: #f3f8f5; border: 1px solid #b7d4c5; }
.box.tech { background: #f4f6fa; border: 1px solid #c5cedd; }
.box-label {
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: #1a6b4a;
  margin-bottom: 4pt;
}
.box.tech .box-label { color: #2c4a6e; }
.callout {
  background: #eef6ff;
  border-left: 4px solid #2b6cb0;
  padding: 8pt 10pt;
  margin: 10pt 0;
  font-size: 9.5pt;
}
.warn {
  background: #fff1f0;
  border-left: 4px solid #c53030;
  padding: 8pt 10pt;
  margin: 10pt 0;
  font-size: 9.5pt;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9pt;
  margin: 8pt 0 14pt;
}
th, td {
  border: 1px solid #cfd6df;
  padding: 5pt 6pt;
  vertical-align: top;
  text-align: left;
}
th { background: #e8eef5; color: #0b1f33; }
tr:nth-child(even) td { background: #fafbfd; }
code, .mono {
  font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
  font-size: 8.5pt;
}
pre {
  background: #0d1117;
  color: #c9d1d9;
  padding: 10pt 12pt;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 7.8pt;
  line-height: 1.4;
  page-break-inside: avoid;
}
.diagram {
  background: #f7f9fb;
  border: 1px dashed #9aa8b8;
  padding: 10pt;
  font-family: ui-monospace, monospace;
  font-size: 7.5pt;
  white-space: pre;
  overflow-x: auto;
  line-height: 1.35;
  page-break-inside: avoid;
}
.footer-note { color: #666; font-size: 8.5pt; margin-top: 20pt; }
.page-break { page-break-before: always; }
.pill {
  display: inline-block;
  background: #1a6b4a;
  color: #fff;
  padding: 1pt 7pt;
  border-radius: 999px;
  font-size: 8pt;
  font-weight: 600;
}
.pill.warn { background: #b45309; }
.pill.bad { background: #b91c1c; }
.pill.ok { background: #15803d; }
.pill.muted { background: #64748b; }
`;

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Documentação Técnica & Funcional — DoQyn Alpha + AUH</title>
<style>${css}</style>
</head>
<body>

<!-- ===================== CAPA ===================== -->
<section class="cover">
  <div class="brand">DOQYN</div>
  <h1>Documentação Técnica &amp; Funcional</h1>
  <p style="font-size:14pt;margin:0;color:#333;">DoQyn Alpha + AUH<br/><span style="font-size:11pt;color:#555;">(doqyn-alpha-document-intelligence + doqyn-auth-service)</span></p>
  <div class="meta">
    <table class="meta-t">
      <tr><td><strong>Versão do documento</strong></td><td>1.2</td></tr>
      <tr><td><strong>Versão dos produtos</strong></td><td>${VERSION}</td></tr>
      <tr><td><strong>Data</strong></td><td>${DATE}</td></tr>
      <tr><td><strong>Status do projeto</strong></td><td>Alpha técnico / multi-tenant operacional em desenvolvimento</td></tr>
      <tr><td><strong>Método</strong></td><td>Gerado a partir do código-fonte real dos repositórios</td></tr>
      <tr><td><strong>Idioma</strong></td><td>Português brasileiro</td></tr>
    </table>
  </div>
  <p class="footer-note">Documento interno. Baseado no código-fonte. “AUH” = Auth / doqyn-auth-service. Keycloak não faz parte do produto.</p>
</section>

<!-- ===================== SUMÁRIO ===================== -->
<section class="toc">
  <h2>Sumário</h2>
  <ol>
    <li><a href="#s1">Visão Geral do Projeto</a></li>
    <li><a href="#s2">Stack Tecnológica</a></li>
    <li><a href="#s3">Arquitetura Geral</a></li>
    <li><a href="#s4">Fluxo de Dados (Data Flow)</a></li>
    <li><a href="#s5">Schemas de Banco de Dados</a> (Postgres, Mongo, ponte de IDs)</li>
    <li><a href="#s6">Workflows Completos</a></li>
    <li><a href="#s7">Conexões, Integrações e Variáveis de Ambiente</a></li>
    <li><a href="#s8">O que já está funcionando bem</a></li>
    <li><a href="#s9">O que está incompleto / dívida técnica</a></li>
    <li><a href="#s10">Oportunidades de Melhoria</a></li>
    <li><a href="#s11">Como rodar o projeto localmente</a></li>
    <li><a href="#s12">Anexo — Dívidas técnicas conhecidas</a></li>
  </ol>
</section>

<!-- ===================== 1 ===================== -->
<section id="s1">
<h2>1. Visão Geral do Projeto</h2>

${simp('O que é o DoQyn?', `
<p>Imagine uma <strong>biblioteca digital empresarial</strong>: a empresa faz upload de PDFs, a IA sugere o tipo e os dados do documento, a equipe organiza por pastas/categorias, assina eletronicamente, compartilha com controle e audita quem fez o quê. Isso é o <strong>DoQyn Alpha</strong>.</p>
<p>O <strong>AUH</strong> (Auth) é o <strong>porteiro e o departamento de RH digital</strong>: quem é a pessoa, a que empresa (tenant) ela pertence, quais papéis e grupos de acesso ela tem, e se a sessão ainda é válida. Sem o AUH, o Alpha não sabe quem está logado de forma confiável.</p>
`)}

${tech('Definição de produto e fronteiras', `
<ul>
  <li><strong>DoQyn Alpha</strong> (<code>doqyn-alpha-document-intelligence</code>, v${VERSION}): produto de gestão documental com IA (classificação/extração via Groq), OCR opcional (Google Vision), storage (Cloudflare R2 ou local), versionamento, assinaturas eletrônicas, governança (categorias/regras/grupos), auditoria e lixeira.</li>
  <li><strong>AUH / Auth</strong> (<code>doqyn-auth-service</code>, v0.1.0): serviço de identidade e acesso — login, sessão cookie HttpOnly, tenants, memberships, roles, access groups, invites, OAuth Google/Microsoft, endpoints internos de verify.</li>
  <li><strong>Contrato entre eles:</strong> o cookie de sessão é do AUH; o Alpha chama <code>POST /internal/sessions/verify</code> e expõe <code>GET /api/me</code> (e <code>/api/auth/me</code>) como contrato do produto.</li>
</ul>
<table>
  <tr><th>Responsabilidade</th><th>AUH (Postgres)</th><th>Alpha (Mongo + R2)</th></tr>
  <tr><td>Identidade / senha / sessão</td><td>Sim</td><td>Não (só valida)</td></tr>
  <tr><td>Tenants / memberships / roles / groups</td><td>Fonte da verdade</td><td>Espelho operacional em <code>tenants</code> / <code>tenant_members</code></td></tr>
  <tr><td>Documentos, versões, chunks, audit documental</td><td>Não</td><td>Sim</td></tr>
  <tr><td>Arquivos binários (PDF)</td><td>Não</td><td>R2 / disco local</td></tr>
  <tr><td>IA / OCR / filas</td><td>Não</td><td>Sim</td></tr>
</table>
`)}

${audit(
  '<code>README.md</code> (ambos), <code>docs/AUTH_INTEGRATION.md</code>, <code>server/auth/authConfig.ts</code>, <code>doqyn-auth-service/README.md</code>, exploração de <code>src/modules/*</code> e <code>server/**</code>.',
  'README do Alpha ainda menciona Mongoose em pontos; o código usa driver nativo <code>mongodb</code>. README do AUH ainda diz “não faz social login”, mas OAuth Google/Microsoft existe. Fronteira de responsabilidades está correta no código.',
  'Alta para fronteiras atuais; Média quando a fonte é README legado.'
)}
</section>

<!-- ===================== 2 ===================== -->
<section id="s2" class="page-break">
<h2>2. Stack Tecnológica</h2>

${simp('Do que o sistema é feito?', `
<p>No navegador: React moderno. No servidor do produto: Node + TypeScript. Identidade: outro serviço Node com banco relacional (Postgres). Documentos: MongoDB. Arquivos: Cloudflare R2. Filas: Redis + BullMQ. Inteligência: Groq (e opcionalmente Google Vision para ler PDF escaneado).</p>
`)}

${tech('Tabela de stack com versões declaradas', `
<table>
  <tr><th>Camada</th><th>Tecnologia</th><th>Versão (package.json)</th><th>Onde</th></tr>
  <tr><td>Frontend</td><td>React / React DOM</td><td>^19.1.0</td><td>Alpha <code>src/</code></td></tr>
  <tr><td>Frontend</td><td>Vite</td><td>^6.3.3</td><td>Alpha</td></tr>
  <tr><td>Frontend</td><td>React Router, TanStack Query, RHF, Zod, Zustand, Tailwind, Sonner</td><td>várias ^7 / ^5 / ^7 / ^3 / ^5 / 3.4</td><td>Alpha</td></tr>
  <tr><td>API Alpha</td><td>Node HTTP + handlers estilo Vercel (<code>@vercel/node</code>)</td><td>tsx / esbuild</td><td><code>server/apiServer.ts</code>, <code>api/</code></td></tr>
  <tr><td>API AUH</td><td>Fastify</td><td>^5.2.1</td><td>Auth <code>src/</code></td></tr>
  <tr><td>ORM AUH</td><td>Prisma</td><td>^6.5.0</td><td>Auth</td></tr>
  <tr><td>DB Auth</td><td>PostgreSQL</td><td>16 (Docker)</td><td><code>docker-compose.yml</code></td></tr>
  <tr><td>DB Alpha</td><td>MongoDB driver nativo</td><td>^7.3.0</td><td>Alpha <code>server/db/</code></td></tr>
  <tr><td>Auth crypto</td><td>Argon2, jose, AES-GCM custom</td><td>argon2 ^0.41 / jose ^6</td><td>AUH</td></tr>
  <tr><td>Filas</td><td>BullMQ + ioredis</td><td>^5.80 / ^5.11</td><td>Alpha (+ rate limit Redis no AUH)</td></tr>
  <tr><td>IA</td><td>groq-sdk</td><td>^1.3.0</td><td>Alpha</td></tr>
  <tr><td>OCR</td><td>@google-cloud/vision</td><td>^5.3.7</td><td>Alpha</td></tr>
  <tr><td>Storage</td><td>@aws-sdk/client-s3 (R2)</td><td>^3.1077</td><td>Alpha</td></tr>
  <tr><td>PDF</td><td>pdf-parse, pdf-lib, pdfjs-dist, sharp, Ghostscript</td><td>várias</td><td>Alpha</td></tr>
  <tr><td>Deploy</td><td>Docker / nginx / scripts VPS</td><td>—</td><td><code>deploy/</code>, auth compose produção</td></tr>
</table>
`)}

${audit(
  '<code>package.json</code> de ambos os repos; <code>docker-compose.yml</code> do Auth; <code>deploy/docker-compose.*.yml</code> do Alpha.',
  'README Alpha cita Mongoose — <strong>incorreto</strong> no código atual. Node do Auth Dockerfile: <code>node:22-alpine</code>; engines Auth: <code>&gt;=20</code>.',
  'Alta.'
)}
</section>

<!-- ===================== 3 ===================== -->
<section id="s3" class="page-break">
<h2>3. Arquitetura Geral</h2>

${simp('Como as peças se encaixam?', `
<p>Você abre o site na porta 5173. O login vai para o serviço de Auth (4100). Depois disso, tudo que é documento (listar, upload, assinar) vai para a API do Alpha (3001), que fala com Mongo e R2, e sempre que precisa saber “quem é você?” pergunta de novo ao Auth por uma rota interna secreta.</p>
`)}

${tech('Diagrama de componentes', `
<div class="diagram">┌──────────────┐     /auth /oauth      ┌─────────────────────┐
│  Browser     │ ───────────────────►  │  AUH (:4100)        │
│  Vite :5173  │                       │  Fastify + Prisma   │
│              │ ◄── cookie sessão ─── │  PostgreSQL :5433   │
│              │                       └──────────┬──────────┘
│              │     /api/*            ┌──────────▼──────────┐
│              │ ───────────────────►  │  Alpha API (:3001)  │
└──────────────┘                       │  + workers BullMQ   │
                                       └─────┬─────┬────┬────┘
                   MongoDB ◄─────────────────┘     │    └────► Redis
                   R2 / local ◄────────────────────┘
                   Groq / Vision ◄─────────────────┘
</div>
<p><strong>Proxy Vite (dev):</strong> <code>/api</code> → 3001; <code>/auth</code> e <code>/oauth</code> → 4100 (<code>vite.config.ts</code>).</p>
<table>
  <tr><th>Componente</th><th>Porta típica</th><th>Papel</th></tr>
  <tr><td>Frontend SPA</td><td>5173</td><td>UI React</td></tr>
  <tr><td>Alpha API</td><td>3001</td><td>Documentos, IA, assinaturas, me</td></tr>
  <tr><td>AUH</td><td>4100</td><td>Login, sessão, admin identidade</td></tr>
  <tr><td>Postgres Auth</td><td>5433→5432</td><td>Dados AUH</td></tr>
  <tr><td>MongoDB</td><td>Atlas ou local</td><td>Metadados documentais</td></tr>
  <tr><td>Redis</td><td>6379</td><td>Filas, cache sessão, quotas, rate limit</td></tr>
</table>
`)}

${audit(
  '<code>vite.config.ts</code>, <code>server/dev-server.ts</code>, <code>server/apiServer.ts</code>, <code>src/server.ts</code> (Auth), <code>docs/LOCAL_DEV.md</code>.',
  'Arquitetura real alinhada com LOCAL_DEV; diagramas de roadmap/architecture.md legados (Keycloak) <strong>não</strong> refletem o estado atual.',
  'Alta.'
)}
</section>

<!-- ===================== 4 ===================== -->
<section id="s4" class="page-break">
<h2>4. Fluxo de Dados (Data Flow)</h2>

<h3>4.1 Cadastro / Login / Sessão (AUH)</h3>
${simp('', `<p>Você digita e-mail e senha. O Auth confere, cria uma “pulseira” (cookie) e guarda só a digital dessa pulseira no banco. Nas próximas visitas, o navegador manda o cookie e o Auth sabe quem é.</p>`)}
${tech('', `
<ol>
  <li><code>POST /auth/login</code> — rate limit → lookup por <code>emailLookupHash</code> → Argon2 → exige membership ativa → <code>createSession</code> (token aleatório; grava <code>sessionTokenHash</code>) → Set-Cookie HttpOnly (<code>SESSION_COOKIE_NAME</code>, default <code>doqyn_session</code>).</li>
  <li><code>GET /auth/session</code> — lê cookie → valida hash/expiração/revogação → retorna user + activeMembership + memberships.</li>
  <li><code>POST /auth/select-tenant</code> — troca <code>activeMembershipId</code> da sessão.</li>
  <li><code>POST /auth/logout</code> — revoga sessão + limpa cookie.</li>
  <li><strong>Não há refresh token JWT clássico</strong> no fluxo principal: a sessão é cookie opaco + TTL (<code>SESSION_TTL_DAYS</code>, default 7).</li>
  <li>OAuth: <code>/oauth/google|microsoft/start|callback</code> com PKCE/state/nonce.</li>
  <li>Signups: <code>POST /auth/company-signups</code>, <code>/auth/individual-signups</code>, access-requests, invites.</li>
</ol>
<div class="callout"><strong>Password reset:</strong> em não-produção o token pode voltar no JSON; em produção o registro é criado, mas envio de e-mail depende de <code>EMAIL_ENABLED</code> + SMTP (hoje frequentemente desligado).</div>
`)}

${audit(
  'Auth <code>src/modules/auth/*</code>, <code>sessions/*</code>, <code>oauth/*</code>, <code>security/cookies.ts</code>, <code>password-reset/*</code>.',
  'Pedido original do briefing citava “Refresh Token”; no código AUH o modelo principal é <strong>sessão cookie</strong>, não refresh JWT. Documentado fielmente.',
  'Alta.'
)}

<h3>4.2 Como o token/cookie é validado no DoQyn Alpha</h3>
${simp('', `<p>O Alpha não abre a pulseira sozinho. Ele pega o cookie e liga para o Auth perguntando: “essa pulseira ainda vale?”. Se o Auth dizer sim, o Alpha monta o perfil do usuário para o produto.</p>`)}
${tech('', `
<ol>
  <li><code>AUTH_PROVIDER=doqyn_auth</code> (<code>server/auth/authConfig.ts</code>).</li>
  <li>Middleware <code>requireAuth</code> → lê cookie <code>DOQYN_AUTH_COOKIE_NAME</code>.</li>
  <li><code>verifyDoqynAuthSession</code> → <code>POST {DOQYN_AUTH_BASE_URL}/internal/sessions/verify</code> com body <code>{ sessionToken }</code> e header <code>Authorization: Bearer {DOQYN_AUTH_INTERNAL_API_KEY}</code> (deve casar com <code>DOQYN_INTERNAL_API_KEY</code> do AUH).</li>
  <li>Cache Redis opcional: <code>SESSION_CACHE_ENABLED</code>, TTL <code>SESSION_CACHE_TTL_SECONDS</code>.</li>
  <li><code>GET /api/me</code> agrega user + tenant + membership + roles + accessGroupIds (+ espelho “legacyUser”).</li>
</ol>
`)}

${audit(
  '<code>server/auth/providers/doqynAuthProvider.ts</code>, <code>api/me.ts</code>, Auth <code>internal.routes.ts</code>.',
  'Fluxo confirmado end-to-end em ambiente local (login → /api/auth/me → /internal/sessions/verify 200).',
  'Alta.'
)}

<h3>4.3 Criação e leitura de documentos no Alpha</h3>
${simp('', `<p>Você manda um PDF. A IA “lê” e sugere tipo/campos. Você confirma. O sistema grava metadados no Mongo e o arquivo no R2. Depois você lista e abre na biblioteca.</p>`)}
${tech('', `
<ol>
  <li><strong>Análise:</strong> <code>POST /api/ai/analyze-pdf</code> (multipart ou staging presigned <code>/api/documents/upload-url</code>).</li>
  <li>Síncrono se <code>ANALYSIS_SYNC_FALLBACK=true</code>; senão BullMQ fila <code>document-analysis</code> + poll <code>GET /api/ai/jobs/:jobId</code>.</li>
  <li>Pipeline: validar → extrair texto (pdf-parse; Vision OCR se texto insuficiente) → classificar/extrair Groq → sugestões.</li>
  <li><strong>Persistência:</strong> <code>POST /api/documents/confirm-analysis</code> → document + version + chunks + storage + audit + preview.</li>
  <li><strong>Leitura:</strong> <code>GET /api/documents</code>, <code>GET /api/documents/:id</code>, download/preview.</li>
  <li>Update de versão: analyze-pdf-update + confirm-update.</li>
</ol>
`)}

${audit(
  '<code>server/ai/services/analyzePdfService.ts</code>, <code>confirmAnalysisService.ts</code>, <code>server/queues/*</code>, <code>api/ai/*</code>, <code>api/documents/*</code>.',
  '<code>DOCUMENT_ANALYSIS_PROVIDER=google_vision</code> é stub para classificação; Vision no código é OCR. Documentado.',
  'Alta.'
)}

<h3>4.4 MongoDB × PostgreSQL</h3>
${simp('', `<p>Postgres = cadastro de pessoas e empresas. Mongo = prateleira de documentos da empresa. Eles conversam pelo ID do tenant (ex.: <code>company_dev</code>) e pelo sync de membros, não compartilham as mesmas tabelas.</p>`)}
${tech('', `
<table>
  <tr><th>Dado</th><th>Postgres (AUH)</th><th>Mongo (Alpha)</th></tr>
  <tr><td>tenantId externo</td><td><code>auth_tenants.tenant_id</code></td><td><code>tenants.tenantId</code> + prefixo de collections</td></tr>
  <tr><td>Usuário</td><td><code>auth_users</code> (PII encrypted)</td><td>referenciado por userId; profile em members</td></tr>
  <tr><td>Membership</td><td><code>auth_memberships</code> + roles + groups</td><td><code>tenant_members</code> (espelho/sync)</td></tr>
  <tr><td>Access groups</td><td>Fonte: AUH</td><td>API Mongo de access-groups responde <strong>410 Gone</strong></td></tr>
  <tr><td>Documentos</td><td>—</td><td><code>documents_{prefix}</code> etc.</td></tr>
</table>
<p>Provisionamento: Auth chama Alpha <code>POST /api/internal/tenants/provision</code> com <code>DOQYN_APP_INTERNAL_API_KEY</code>. Sync: <code>/api/internal/tenant-members/sync</code>.</p>
`)}

${audit(
  'Auth <code>integrations/appProvisioning*</code>, Alpha <code>api/internal/tenants/provision.ts</code>, <code>server/db/constants.ts</code>, access-groups handler 410.',
  'Divisão correta. Legado <code>companies</code>/<code>company_members</code> ainda listado no registry — dívida de migração.',
  'Alta.'
)}

<h3>4.5 Filas, webhooks e integrações externas</h3>
${tech('', `
<table>
  <tr><th>Integração</th><th>Tipo</th><th>Status no código</th></tr>
  <tr><td>BullMQ <code>document-analysis</code></td><td>Fila</td><td>Implementada</td></tr>
  <tr><td>BullMQ <code>document-preview</code></td><td>Fila</td><td>Implementada (Ghostscript)</td></tr>
  <tr><td>Groq</td><td>HTTP API</td><td>Classificação/extração</td></tr>
  <tr><td>Google Vision</td><td>API</td><td>OCR opcional</td></tr>
  <tr><td>Cloudflare R2</td><td>S3 API</td><td>Storage</td></tr>
  <tr><td>OAuth Google/Microsoft</td><td>OIDC</td><td>AUH</td></tr>
  <tr><td>SMTP / e-mail</td><td>nodemailer</td><td>Opcional; default console</td></tr>
  <tr><td>WhatsApp notifications</td><td>—</td><td><strong>Planejado</strong> (tipos, sem worker)</td></tr>
  <tr><td>Webhooks de saída genéricos</td><td>—</td><td>Não há framework de webhook outbound documentado no core</td></tr>
</table>
`)}

${audit(
  '<code>notificationTypes.ts</code>, <code>email.service.ts</code> (Auth), queues Alpha.',
  'Nenhum worker WhatsApp encontrado. Preferências existem; entrega não.',
  'Alta.'
)}
</section>

<!-- ===================== 5 ===================== -->
<section id="s5" class="page-break">
<h2>5. Schemas de Banco de Dados</h2>

<h3>5.1 PostgreSQL (AUH) — 20 models</h3>
${simp('', `<p>O Auth guarda pessoas, empresas, vínculos (membership), papéis, grupos, sessões e logs. Dados sensíveis (e-mail, nome, WhatsApp) ficam criptografados; a busca usa um “código” (hash) do valor.</p>`)}

<table>
  <tr><th>Tabela</th><th>O que guarda (simples)</th><th>Técnico</th></tr>
  <tr><td><code>auth_users</code></td><td>Pessoa</td><td>PII encrypted + lookup hashes; avatar metadata; status</td></tr>
  <tr><td><code>auth_credentials</code></td><td>Senha</td><td>Argon2 hash 1:1 user</td></tr>
  <tr><td><code>auth_sessions</code></td><td>Login ativo</td><td>token hash, activeMembershipId, expires/revoked</td></tr>
  <tr><td><code>auth_password_resets</code></td><td>Reset senha</td><td>token hash + TTL</td></tr>
  <tr><td><code>auth_email_verifications</code></td><td>Verificar e-mail</td><td><span class="pill warn">schema sem fluxo em src/</span></td></tr>
  <tr><td><code>auth_email_changes</code></td><td>Troca de e-mail</td><td>token + novo e-mail encrypted</td></tr>
  <tr><td><code>auth_login_attempts</code></td><td>Tentativas login</td><td>anti-abuso / audit</td></tr>
  <tr><td><code>auth_audit_logs</code></td><td>Auditoria auth</td><td>action + metadata Json</td></tr>
  <tr><td><code>auth_tenants</code></td><td>Empresa/PF</td><td>tenantId externo, taxId hash, status</td></tr>
  <tr><td><code>auth_memberships</code></td><td>Vínculo user↔tenant</td><td>status pending/active/…</td></tr>
  <tr><td><code>auth_membership_roles</code></td><td>Papéis</td><td>doqyn_admin, company_admin, individual_admin, user</td></tr>
  <tr><td><code>auth_access_groups</code></td><td>Grupos (financeiro…)</td><td>groupId + nome encrypted</td></tr>
  <tr><td><code>auth_membership_access_groups</code></td><td>User em grupos</td><td>N:N</td></tr>
  <tr><td><code>auth_access_requests</code></td><td>Pedido de acesso</td><td>público → aprovação admin</td></tr>
  <tr><td><code>auth_notification_preferences</code></td><td>Preferências aviso</td><td>email/whatsapp flags</td></tr>
  <tr><td><code>auth_account_deletion_requests</code></td><td>Apagar conta</td><td>status string</td></tr>
  <tr><td><code>auth_terms_acceptances</code></td><td>Aceite de termos</td><td>flow enum + versões</td></tr>
  <tr><td><code>auth_oauth_accounts</code></td><td>Login Google/MS</td><td>provider + subject unique</td></tr>
  <tr><td><code>auth_invites</code> + <code>auth_invite_roles</code></td><td>Convites</td><td>token hash, TTL, roles</td></tr>
  <tr><td><code>auth_tenant_outbound_email</code></td><td>SMTP do tenant</td><td>credenciais encrypted</td></tr>
</table>

<p><strong>Diagrama ER (resumo textual):</strong></p>
<div class="diagram">AuthUser 1──1 AuthCredential
AuthUser 1──* AuthSession *──? AuthMembership
AuthUser *──* AuthTenant (via AuthMembership)
AuthMembership 1──* AuthMembershipRole
AuthMembership *──* AuthAccessGroup (via AuthMembershipAccessGroup)
AuthTenant 1──* AuthAccessGroup / AuthInvite / AuthAccessRequest
AuthTenant 1──1 AuthTenantOutboundEmail
AuthUser 1──* AuthOAuthAccount
</div>

${audit(
  'Arquivo completo <code>prisma/schema.prisma</code> (lido linha a linha) + migrations em <code>prisma/migrations/</code>.',
  '20 models confirmados. <code>AuthEmailVerification</code> sem escritas em modules de produção — dívida explícita.',
  'Alta.'
)}

<h3>5.2 MongoDB (Alpha) — inventário completo</h3>
${simp('Como o Mongo está organizado?', `
<p>Pense em três tipos de gavetas:</p>
<ol>
  <li><strong>Cadastro global</strong> — lista de empresas e membros (sem prefixo).</li>
  <li><strong>App global</strong> — coisas que atravessam tenants (assinatura, share, job de IA).</li>
  <li><strong>Gavetas da empresa</strong> — nome = <code>tipo_prefixo</code>, ex. <code>documents_company_dev</code>.</li>
</ol>
<p>Pessoa física (individual) <strong>não</strong> ganha gaveta por CPF: todos usam o pool <code>*_compartilhado</code>, e o isolamento é por <code>ownerUserId</code> no documento.</p>
`)}

${tech('Collections reais e fórmula do prefixo', `
<p><strong>Fórmula tenant-scoped:</strong> <code>\${base}_\${prefix}</code> via <code>resolveTenantCollectionNames</code> (<code>server/tenancy/tenantResolver.ts</code>).</p>
<ul>
  <li><strong>Business:</strong> <code>isolation.strategy = collection_prefix</code>; <code>collectionPrefix = tenantId</code> (ex. <code>company_dev</code>). Assert no provision: prefix === tenantId.</li>
  <li><strong>Individual:</strong> <code>strategy = shared_individual_pool</code>; prefix sempre <code>compartilhado</code> (legado <code>individual_pool</code> é normalizado).</li>
</ul>

<p><strong>Registry (sem prefixo):</strong></p>
<table>
  <tr><th>Collection</th><th>Uso</th></tr>
  <tr><td><code>tenants</code></td><td>Espelho operacional do tenant Auth + isolation + storage R2</td></tr>
  <tr><td><code>tenant_members</code></td><td>Espelho de membership (roles, accessGroupIds, prefs)</td></tr>
  <tr><td><code>companies</code> / <code>company_members</code></td><td><span class="pill warn">Legado</span> — quase morto / dual-read</td></tr>
</table>

<p><strong>Shared app (sem prefixo):</strong> <code>user_document_favorites</code>, <code>document_share_grants</code>, <code>external_document_share_grants</code>, <code>document_signature_requests</code>, <code>document_signatures</code>, <code>document_upload_approvals</code>, <code>analysis_jobs</code>.</p>

<p><strong>Exemplo business <code>company_dev</code>:</strong></p>
<pre>documents_company_dev
document_versions_company_dev
document_chunks_company_dev
processing_jobs_company_dev
audit_logs_company_dev
access_groups_company_dev          ← collection ainda resolvida; API Mongo = 410 (fonte = AUH)
document_classes_company_dev       ← legado; CRUD atual grava em categories
document_categories_company_dev
document_groups_company_dev
document_group_members_company_dev
document_rules_company_dev         ← regras de ACESSO (grupo×categoria)
document_extraction_rules_company_dev  ← regras de EXTRAÇÃO IA
</pre>

<p><strong>Exemplo individual:</strong> mesmas bases com sufixo <code>_compartilhado</code>, <strong>sem</strong> <code>access_groups_*</code>.</p>

<p><strong>Campos-chave tipados (<code>server/db/types.ts</code>):</strong></p>
<table>
  <tr><th>Tipo</th><th>Campos importantes</th></tr>
  <tr><td><code>MongoTenant</code></td><td><code>tenantId</code>, <code>tenantType</code>, <code>isolation.{strategy,collectionPrefix}</code>, <code>storage?</code>, alias legado <code>companyId</code></td></tr>
  <tr><td><code>MongoTenantMember</code></td><td><code>memberId</code>/<code>_id</code> (= membershipId Auth), <code>keycloakUserId</code> (= <strong>userId Auth</strong>, nome legado), <code>tenantRoles</code>, <code>accessGroupIds</code></td></tr>
  <tr><td><code>MongoDocument</code></td><td><code>tenantId</code>, <code>ownerUserId</code>, <code>ownerTenantId</code>, <code>currentVersionId</code>, <code>access.*GroupIds</code>, lifecycle/trash</td></tr>
  <tr><td><code>MongoDocumentVersion</code></td><td>versionNumber, storage primary/preview, metadata, classification</td></tr>
  <tr><td><code>MongoDocumentChunk</code></td><td>documentId, versionId, chunkIndex, text, embedding?</td></tr>
  <tr><td>Assinaturas</td><td>request + signature globais; referenciam <code>documentTenantId</code> + documentId</td></tr>
  <tr><td><code>MongoAuditLog</code></td><td>actor.userId/membershipId/roles/accessGroupIds + action</td></tr>
</table>
`)}

${audit(
  '<code>constants.ts</code>, <code>types.ts</code>, <code>tenantResolver.ts</code>, <code>tenantStorage.ts</code>, <code>taxId.ts</code>, provision services — 2ª auditoria dedicada 2026-07-14.',
  'PDF v1 era superficial no Mongo. Esta revisão corrige: fórmula do prefixo, pool individual, diferença rules vs extraction, <code>keycloakUserId</code> = userId Auth, collections 410/legado.',
  'Alta.'
)}

<h3>5.3 Ponte Postgres ↔ Mongo — quais IDs se conectam</h3>
${simp('A regra de ouro', `
<p>O Auth e o Alpha <strong>não compartilham o mesmo banco</strong>. Eles se entendem por <strong>IDs em texto</strong> que viajam na sessão e no sync:</p>
<ul>
  <li><strong>tenantId</strong> (ex. <code>company_dev</code>) — nome público da empresa</li>
  <li><strong>userId</strong> — UUID da pessoa no Auth</li>
  <li><strong>membershipId</strong> — UUID do vínculo pessoa↔empresa</li>
  <li><strong>accessGroupIds / roles</strong> — grupos e papéis do Auth, copiados para o member no Mongo</li>
</ul>
`)}

${tech('Mapa campo a campo', `
<div class="diagram">POSTGRES (AUH)                         MONGODB (Alpha)
─────────────────                      ─────────────────────────────
auth_tenants.tenant_id  ─────────────► tenants.tenantId
                                       tenants._id = "tenant_" + tenantId
                                       isolation.collectionPrefix (= tenantId se business)
                                       collections: *_{prefix}

auth_tenants.id (UUID interno)         (não é o tenantId opaco; Alpha usa o textual)

auth_users.id (UUID) ────────────────► tenant_members.keycloakUserId  (!nome legado!)
                                       documents.ownerUserId / createdBy
                                       signatures.requestedByUserId / signerUserId
                                       favorites.userId

auth_memberships.id ─────────────────► tenant_members.memberId e _id
                                       (AuthUser.membershipId na sessão /api/me)
                                       audit.actor.membershipId
                                       analysis_jobs.membershipId?

auth_membership_roles.role ──────────► tenant_members.tenantRoles[]
auth access groups (groupId/id) ─────► tenant_members.accessGroupIds[]
                                       documents.access.viewGroupIds etc.
                                       (NÃO escrever na collection Mongo access_groups_*)
</div>

<table>
  <tr><th>Conceito</th><th>Formato</th><th>Armadilha</th></tr>
  <tr><td>tenantId</td><td>string opaca (<code>company_dev</code>)</td><td>Não confundir com <code>tenants._id</code> Mongo nem UUID interno Postgres</td></tr>
  <tr><td>userId</td><td>UUID Auth</td><td>Campo Mongo ainda se chama <code>keycloakUserId</code> em members</td></tr>
  <tr><td>membershipId</td><td>UUID Auth</td><td>É o “memberId” do produto</td></tr>
  <tr><td>MONGODB_TENANT_ID no .env</td><td>só scripts/dev</td><td>Em runtime autenticado o tenant vem da <strong>sessão</strong>, não do .env</td></tr>
</table>
`)}

${audit(
  'Sync members / provision; <code>tenantContext.ts</code>; tipos Mongo; seed Auth <code>company_dev</code>.',
  'Documentado que runtime NÃO usa MONGODB_TENANT_ID para tenant da sessão — só scripts. Nome keycloakUserId é dívida de naming.',
  'Alta.'
)}
</section>

<!-- ===================== 6 ===================== -->
<section id="s6" class="page-break">
<h2>6. Workflows Completos</h2>

<h3>6.1 Autenticação completa</h3>
<div class="diagram">[Login form] → POST /auth/login (AUH)
        → valida Argon2 + membership active
        → Set-Cookie doqyn_session
        → Browser GET /api/me (Alpha)
        → Alpha POST /internal/sessions/verify (AUH)
        → Alpha responde user+tenant+roles
        → SPA libera rotas autenticadas
</div>

<h3>6.2 Criação de documento</h3>
<div class="diagram">[Upload] → POST /api/ai/analyze-pdf
        → (opcional) enfileira BullMQ → worker
        → extrai texto ± Vision OCR → Groq
        → UI revisa sugestões
        → POST /api/documents/confirm-analysis
        → Mongo (doc+version+chunks) + R2 object
        → agenda preview → audit_logs
</div>

<h3>6.3 Atualização / exclusão</h3>
${tech('', `
<ul>
  <li><strong>Nova versão:</strong> analyze-pdf-update → confirm-update.</li>
  <li><strong>Lixeira:</strong> trash / restore / batch / permanent-delete; retenção configurável.</li>
  <li><strong>Shares:</strong> internos e externos (grants).</li>
  <li><strong>Assinatura:</strong> signature-requests → sign (auth ou guest token) → stamp PDF → possible new version.</li>
</ul>
`)}

${audit(
  'Rotas em <code>server/apiServer.ts</code>; serviços confirm/signature/trash.',
  'Fluxos acima batem com handlers registrados. Soft-delete e permanent-delete existem como batch APIs.',
  'Alta.'
)}
</section>

<!-- ===================== 7 ===================== -->
<section id="s7" class="page-break">
<h2>7. Conexões, Integrações e Variáveis de Ambiente</h2>

${simp('', `<p>O navegador fala com a API do produto e com o Auth. A API do produto guarda documento no Mongo/R2 e, quando precisa de identidade, conversa com o Auth por um “telefone interno” com senha (API key). Várias variáveis têm <strong>nomes diferentes</strong> nos dois <code>.env</code> — mas precisam ser o mesmo valor.</p>`)}

<table>
  <tr><th>De → Para</th><th>Como</th><th>Autenticação</th></tr>
  <tr><td>Browser → Alpha</td><td><code>/api/*</code> (credentials include cookie)</td><td>Cookie sessão AUH</td></tr>
  <tr><td>Browser → AUH</td><td><code>/auth/*</code>, <code>/oauth/*</code></td><td>Cookie / OAuth</td></tr>
  <tr><td>Alpha → AUH</td><td><code>/internal/sessions/verify</code> etc.</td><td><code>Bearer DOQYN_AUTH_INTERNAL_API_KEY</code></td></tr>
  <tr><td>AUH → Alpha</td><td>provision / member sync</td><td><code>DOQYN_APP_INTERNAL_API_KEY</code></td></tr>
  <tr><td>Alpha → Mongo</td><td>driver nativo</td><td><code>MONGODB_URI</code></td></tr>
  <tr><td>AUH → Postgres</td><td>Prisma</td><td><code>DATABASE_URL</code></td></tr>
  <tr><td>Alpha → Redis/R2/Groq/Vision</td><td>clients</td><td>env keys</td></tr>
</table>

<h3>7.1 Pares Alpha ↔ Auth (devem sincronizar)</h3>
<table>
  <tr><th>Alpha</th><th>AUH</th><th>Regra</th><th>Se divergir…</th></tr>
  <tr><td><code>DOQYN_AUTH_INTERNAL_API_KEY</code></td><td><code>DOQYN_INTERNAL_API_KEY</code></td><td><strong>Idênticos</strong></td><td>403 no verify / internals</td></tr>
  <tr><td><code>DOQYN_APP_INTERNAL_API_KEY</code></td><td><code>DOQYN_APP_INTERNAL_API_KEY</code></td><td><strong>Idênticos</strong></td><td>Provision/sync 401</td></tr>
  <tr><td><code>DOQYN_AUTH_COOKIE_NAME</code></td><td><code>SESSION_COOKIE_NAME</code></td><td><strong>Idênticos</strong> (default <code>doqyn_session</code>)</td><td>NO_SESSION eterno</td></tr>
  <tr><td><code>DOQYN_AUTH_BASE_URL</code></td><td><code>PORT</code> (host:4100)</td><td>Complementares</td><td>Alpha sem auth</td></tr>
  <tr><td>API <code>:3001</code></td><td><code>DOQYN_APP_BASE_URL</code></td><td>Complementares</td><td>Signup não provisiona Mongo</td></tr>
  <tr><td><code>DOQYN_PUBLIC_APP_URL</code></td><td><code>DOQYN_APP_PUBLIC_URL</code></td><td>Idealmente iguais</td><td>Links de convite/OG errados</td></tr>
  <tr><td>Origem FE (5173 / URL pública)</td><td><code>ALLOWED_ORIGINS</code></td><td>FE ⊆ lista</td><td>CORS bloqueia login</td></tr>
  <tr><td><code>AUTH_PROVIDER</code> + <code>VITE_AUTH_PROVIDER</code></td><td>—</td><td>Ambos <code>doqyn_auth</code></td><td>FE e API desencontrados</td></tr>
  <tr><td><code>MONGODB_TENANT_ID</code> (scripts)</td><td>seed <code>auth_tenants.tenantId</code></td><td>Dev: <code>company_dev</code></td><td>Scripts apontam prefixo errado</td></tr>
  <tr><td><code>REDIS_KEY_PREFIX</code></td><td><code>REDIS_KEY_PREFIX</code></td><td>Cuidado se Redis compartilhado</td><td>Colisão de keys filas×rate-limit</td></tr>
</table>

<div class="callout"><strong>Checklist mínimo local:</strong><br/>
<code>Alpha.DOQYN_AUTH_INTERNAL_API_KEY == Auth.DOQYN_INTERNAL_API_KEY</code><br/>
<code>Alpha.DOQYN_APP_INTERNAL_API_KEY == Auth.DOQYN_APP_INTERNAL_API_KEY</code><br/>
<code>Alpha.DOQYN_AUTH_COOKIE_NAME == Auth.SESSION_COOKIE_NAME</code><br/>
<code>Auth.ALLOWED_ORIGINS</code> contém <code>http://localhost:5173</code><br/>
<code>AUTH_PROVIDER</code> e <code>VITE_AUTH_PROVIDER</code> = <code>doqyn_auth</code>
</div>

<h3>7.2 Variáveis só do Auth que afetam o Alpha</h3>
<table>
  <tr><th>Auth</th><th>Efeito no produto</th></tr>
  <tr><td><code>COOKIE_SECURE</code> / <code>COOKIE_DOMAIN</code> / <code>COOKIE_SAME_SITE</code></td><td>Cookie chega (ou não) no browser→Alpha. Em production, Secure é forçado.</td></tr>
  <tr><td><code>SESSION_TTL_DAYS</code></td><td>Quanto tempo a sessão Alpha continua válida</td></tr>
  <tr><td><code>OAUTH_*_REDIRECT_URI</code> / post-login</td><td>Devem apontar para o FE Alpha</td></tr>
  <tr><td><code>DATA_ENCRYPTION_KEY</code></td><td>Base64 de <strong>32 bytes</strong>. Placeholder do example é inválido. Rotação = PII ilegível.</td></tr>
  <tr><td><code>LOOKUP_HASH_SECRET</code></td><td>Rotação = login não acha usuário (hash diverge)</td></tr>
  <tr><td><code>SESSION_TOKEN_HASH_SECRET</code></td><td>Rotação = logout global de todas as sessões</td></tr>
  <tr><td><code>PASSWORD_RESET_TOKEN_HASH_SECRET</code></td><td>Também hasheia <strong>convites</strong> e email-change</td></tr>
  <tr><td><code>PASSWORD_PEPPER</code></td><td>Rotação = todas as senhas falham até rehash</td></tr>
</table>

<h3>7.3 O que NÃO se conecta (bancos independentes)</h3>
<p><code>MONGODB_URI</code> / <code>MONGODB_DATABASE</code> (Alpha) e <code>DATABASE_URL</code> Postgres (Auth) são stores separados. Groq, R2, Vision, Tracking IP keys existem só no Alpha. JWT legado (<code>TEMP_AUTH_*</code>, <code>AUTH_COOKIE_*</code>) não deve ser usado com <code>doqyn_auth</code>.</p>

${audit(
  '2ª auditoria env cruzado: .env.example ambos, authConfig.ts, env.ts Auth, cookies.ts, crypto.ts, deploy setup-production-env.sh.',
  'Gaps documentados: nomes diferentes da mesma chave; COOKIE_* só no Auth; DATA_ENCRYPTION_KEY example inválido; MONGODB_TENANT_ID só scripts; REDIS_KEY_PREFIX risco de colisão; VITE_ vs AUTH_PROVIDER.',
  'Alta.'
)}
</section>

<!-- ===================== 8 ===================== -->
<section id="s8" class="page-break">
<h2>8. O que já está funcionando bem</h2>
<ul>
  <li><span class="pill ok">OK</span> Login/sessão cookie + verify interno Alpha↔AUH</li>
  <li><span class="pill ok">OK</span> Multi-tenant: Postgres identity + Mongo collection prefix</li>
  <li><span class="pill ok">OK</span> Provisionamento de tenant no Mongo</li>
  <li><span class="pill ok">OK</span> Pipeline análise PDF (Groq) + confirm + versionamento</li>
  <li><span class="pill ok">OK</span> OCR Vision como fallback de texto</li>
  <li><span class="pill ok">OK</span> Storage R2 / local + preview Ghostscript</li>
  <li><span class="pill ok">OK</span> Filas BullMQ (análise + preview) com fallback sync</li>
  <li><span class="pill ok">OK</span> Assinaturas eletrônicas + portal guest + verificação por código</li>
  <li><span class="pill ok">OK</span> Governança: categorias, regras, grupos documentais</li>
  <li><span class="pill ok">OK</span> Lixeira, shares, favoritos, auditoria/tracking</li>
  <li><span class="pill ok">OK</span> OAuth Google/Microsoft no AUH (quando credenciais preenchidas)</li>
  <li><span class="pill ok">OK</span> Admin API rica no AUH (members, groups, tenants, invites)</li>
  <li><span class="pill ok">OK</span> PII encryption + hashed lookups no Auth</li>
</ul>
${audit('Smoke local: health 200 ambos; login seed; /api/auth/me 200; map de rotas apiServer + modules Auth.', 'Lista baseada em código + smoke. OAuth sem CLIENT_ID fica enabled mas funcionalmente incompleto no env típico.', 'Alta.')}
</section>

<!-- ===================== 9 ===================== -->
<section id="s9" class="page-break">
<h2>9. O que está incompleto / faltando / dívida técnica</h2>
<table>
  <tr><th>Item</th><th>Evidência</th><th>Impacto</th></tr>
  <tr><td>Notificações e-mail/WhatsApp não entregues</td><td><code>notificationTypes.ts</code> “worker futuro”; preferências só</td><td>Alto (produto)</td></tr>
  <tr><td>E-mail SMTP desligado por default</td><td><code>EMAIL_ENABLED=false</code>; ConsoleEmailSender</td><td>Alto em prod</td></tr>
  <tr><td>Password reset sem e-mail em production path</td><td>passwordReset.service</td><td>Alto</td></tr>
  <tr><td><code>AuthEmailVerification</code> sem fluxo</td><td>schema sim / modules não</td><td>Médio</td></tr>
  <tr><td>Provider Vision-as-classifier stub</td><td>DOCUMENT_ANALYSIS_PROVIDER</td><td>Baixo (OCR cobre caso)</td></tr>
  <tr><td>README/architecture/roadmap desatualizados</td><td>Keycloak, Mongoose, “sem social login”</td><td>Médio (onboarding)</td></tr>
  <tr><td>Legado companyId / temporary auth / document_classes</td><td>constants + rotas</td><td>Médio</td></tr>
  <tr><td>Access-groups API Mongo 410</td><td>handler deprecated</td><td>Baixo se UI só AUH</td></tr>
  <tr><td>Arquivos vazios na raiz do Auth</td><td>login, users, sessions…</td><td>Baixo (ruído repo)</td></tr>
  <tr><td>docs/OAUTH_SETUP.md stub mínimo</td><td>Auth docs</td><td>Baixo</td></tr>
  <tr><td>RAG chat completo</td><td>rag-query é chunks/compare, não chat full</td><td>Médio (roadmap)</td></tr>
</table>
${audit('Cruzamento README×código; notificationTypes; email.service; schema vs grep em src.', 'Nada inventado: cada linha tem evidência de arquivo.', 'Alta.')}
</section>

<!-- ===================== 10 ===================== -->
<section id="s10" class="page-break">
<h2>10. Oportunidades de Melhoria</h2>
<table>
  <tr><th>Pri</th><th>Ação</th><th>Por quê</th></tr>
  <tr><td><span class="pill bad">P0</span></td><td>Ativar e-mail real (SMTP Resend/Hostinger) + fluxo reset em produção</td><td>Desbloqueia conta e convites reais</td></tr>
  <tr><td><span class="pill bad">P0</span></td><td>Alinhar documentação (README/architecture/roadmap) ao código</td><td>Evita decisões erradas da equipe</td></tr>
  <tr><td><span class="pill warn">P1</span></td><td>Worker de notificações (e-mail primeiro; WhatsApp depois com Cloud API)</td><td>Preferências já existem</td></tr>
  <tr><td><span class="pill warn">P1</span></td><td>Remover ou isolar legado temporary-auth / companies / document_classes</td><td>Reduz superfície e bugs</td></tr>
  <tr><td><span class="pill warn">P1</span></td><td>Completar fluxo AuthEmailVerification ou dropar table</td><td>Schema morto confunde</td></tr>
  <tr><td><span class="pill muted">P2</span></td><td>Limpar arquivos vazios e stubs de docs OAuth</td><td>Higiene</td></tr>
  <tr><td><span class="pill muted">P2</span></td><td>RAG conversacional / buscar sobre chunks com Groq</td><td>Diferencial produto</td></tr>
  <tr><td><span class="pill muted">P2</span></td><td>Observabilidade completa (Prometheus profile) em prod</td><td>Ops</td></tr>
</table>
${audit('Priorização baseada em risco operacional vs esforço; não é roadmap oficial do produto.', 'Sugestões práticas derivadas das dívidas da seção 9.', 'Média-Alta (julgamento de engenharia).')}
</section>

<!-- ===================== 11 ===================== -->
<section id="s11" class="page-break">
<h2>11. Como rodar o projeto localmente</h2>

${simp('', `<p>Sobe o Auth, sobe o Alpha, abre o navegador em localhost:5173 e faz login com o usuário de desenvolvimento.</p>`)}

<pre># 0) Pré-requisitos: Node ≥20, Docker (Postgres auth), Redis se for usar filas

# 1) Auth
cd ../doqyn-auth-service
cp .env.example .env   # preencher secrets (DATA_ENCRYPTION_KEY base64 32 bytes etc.)
npm install
npm run dev            # sobe Postgres :5433 se necessário + API :4100
SEED_FORCE_PASSWORD_RESET=true npm run db:seed

# 2) Alpha
cd ../doqyn-alpha-document-intelligence
cp .env.example .env
# Alinhar:
#   DOQYN_AUTH_INTERNAL_API_KEY == DOQYN_INTERNAL_API_KEY (auth)
#   DOQYN_APP_INTERNAL_API_KEY iguais nos dois
#   MONGODB_URI, GROQ_API_KEY, R2 ou STORAGE_PROVIDER=local
npm install
npm run db:setup       # índices quando Mongo ok
npm run dev            # Vite :5173 + API :3001

# Opcional filas
# REDIS_ENABLED=true ANALYSIS_SYNC_FALLBACK=false
# npm run dev:worker
# npm run dev:worker:preview
</pre>

<table>
  <tr><th>URL</th><th>Serviço</th></tr>
  <tr><td>http://localhost:5173</td><td>Frontend</td></tr>
  <tr><td>http://localhost:3001/api/health</td><td>Alpha API</td></tr>
  <tr><td>http://localhost:4100/health</td><td>AUH</td></tr>
</table>

<div class="callout"><strong>Credenciais seed padrão (código atual):</strong> <code>sidnei@doqyn.dev</code> / <code>DevDoqyn@123</code> (via <code>SEED_DEV_PASSWORD</code>). Documentação AUTH_INTEGRATION que cita outra senha pode estar desatualizada — preferir o seed.</div>

${audit(
  '<code>docs/LOCAL_DEV.md</code>, <code>package.json</code> scripts, seed Auth <code>src/db/seed.ts</code>, smoke desta sessão.',
  'Senha documentada em AUTH_INTEGRATION (`dev-password-change-me`) diverge do seed atual (`DevDoqyn@123`) — inconsistência anotada.',
  'Alta para comandos; Média para docs auxiliares contraditórios.'
)}
</section>

<!-- ===================== ANEXO ===================== -->
<section id="s12" class="page-break">
<h2>12. Anexo — Dívidas técnicas conhecidas</h2>
<ol>
  <li>Campo Mongo <code>keycloakUserId</code> ainda existe no código e nos índices — o valor é o <strong>userId do Auth</strong>; Keycloak foi dropado. Renomeação pendente.</li>
  <li>Collections legadas <code>companies</code> / <code>company_members</code> / <code>document_classes_*</code> convivem com o modelo novo.</li>
  <li>API Mongo de <code>access_groups</code> responde 410 — fonte da verdade = Auth.</li>
  <li>Model Auth <code>AuthEmailVerification</code> sem fluxo de produto.</li>
  <li>E-mail/WhatsApp: preferências existem; worker de entrega ainda não.</li>
  <li><code>DOCUMENT_ANALYSIS_PROVIDER=google_vision</code> é stub para classificação (Vision no código é OCR).</li>
  <li>Nomes de env diferentes para a mesma chave: Alpha <code>DOQYN_AUTH_INTERNAL_API_KEY</code> ↔ Auth <code>DOQYN_INTERNAL_API_KEY</code>.</li>
  <li><code>DATA_ENCRYPTION_KEY</code> no <code>.env.example</code> do Auth é placeholder inválido (precisa base64 de 32 bytes).</li>
  <li><code>MONGODB_TENANT_ID</code> afeta scripts/dev; tenant da sessão autenticada vem do Auth.</li>
  <li><code>REDIS_KEY_PREFIX=doqyn:</code> nos dois serviços — cuidado se Redis for compartilhado.</li>
</ol>
<p class="footer-note">Fim do documento v1.2. Gerado em ${DATE}. Keycloak fora do produto. PDF via Chromium headless.</p>
</section>

</body>
</html>`;

writeFileSync(OUT, html, 'utf8');
console.log('HTML escrito em', OUT);
console.log('bytes', Buffer.byteLength(html));
