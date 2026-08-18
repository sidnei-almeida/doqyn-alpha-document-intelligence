#!/usr/bin/env node
/**
 * Gera o relatório de configuração do SSO (Microsoft Entra e Google) para o
 * gestor da conta cloud.
 *
 * Autocontido de propósito: não importa nada de generate-doqyn-docs.mjs para não
 * arriscar o gerador do documento principal, que já está estável. O CSS é uma
 * cópia do estilo daquele documento, para os dois PDFs saírem da mesma família.
 *
 * O PDF fica fora do repo, em ~/Documents, junto dos demais relatórios de
 * entrega. Aqui ficam só o gerador e o HTML.
 *
 * PDF: node docs/generate-relatorio-sso.mjs && chromium --headless \
 *      --no-pdf-header-footer \
 *      --print-to-pdf=~/Documents/RELATORIO_SSO_MICROSOFT_GOOGLE.pdf \
 *      docs/RELATORIO_SSO_MICROSOFT_GOOGLE.html
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, 'RELATORIO_SSO_MICROSOFT_GOOGLE.html');
const DATE = '18 de agosto de 2026';
const APP_URL = 'https://app.doqyn.com';

function simp(title, body) {
  return `<div class="box simp"><div class="box-label">Em linguagem simples</div><h4>${title}</h4>${body}</div>`;
}

function tech(title, body) {
  return `<div class="box tech"><div class="box-label">Detalhe técnico</div><h4>${title}</h4>${body}</div>`;
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
.box { border-radius: 6px; padding: 10pt 12pt; margin: 10pt 0; page-break-inside: avoid; }
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
table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 8pt 0 14pt; }
th, td { border: 1px solid #cfd6df; padding: 5pt 6pt; vertical-align: top; text-align: left; }
th { background: #e8eef5; color: #0b1f33; }
tr:nth-child(even) td { background: #fafbfd; }
code, .mono { font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace; font-size: 8.5pt; }
.path { background: #eef1f5; padding: 1pt 4pt; border-radius: 3px; }
.footer-note { color: #666; font-size: 8.5pt; margin-top: 20pt; }
.page-break { page-break-before: always; }
.pill { display: inline-block; background: #1a6b4a; color: #fff; padding: 1pt 7pt; border-radius: 999px; font-size: 8pt; font-weight: 600; }
.pill.warn { background: #b45309; }
.pill.bad { background: #b91c1c; }
.step { border-left: 3px solid #1a6b4a; padding-left: 12pt; margin: 14pt 0; page-break-inside: avoid; }
.step .n { font-weight: 700; color: #1a6b4a; font-size: 9pt; letter-spacing: 0.06em; text-transform: uppercase; }
.check { font-size: 9.5pt; }
.check td:first-child { width: 22pt; text-align: center; font-size: 12pt; color: #1a6b4a; }
`;

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Relatório — Configuração do Login com Microsoft e Google</title>
<style>${css}</style>
</head>
<body>

<section class="cover">
  <div class="brand">DOQYN</div>
  <h1>Configuração do login<br>com Microsoft e Google</h1>
  <p style="font-size:12pt;color:#16324f;margin-top:4pt">
    O que falta ser feito no portal da Microsoft para o acesso corporativo entrar no ar
  </p>
  <div class="meta">
    <table class="meta-t">
      <tr><td><strong>Relatório</strong></td><td>Complementar — SSO corporativo</td></tr>
      <tr><td><strong>Data</strong></td><td>${DATE}</td></tr>
      <tr><td><strong>Aplicação</strong></td><td>${APP_URL}</td></tr>
      <tr><td><strong>Situação da aplicação</strong></td><td>No ar, com HTTPS ativo</td></tr>
      <tr><td><strong>Situação do SSO</strong></td><td>Aguardando configuração no portal</td></tr>
    </table>
  </div>
</section>

<section class="toc">
  <h2>Conteúdo</h2>
  <ol>
    <li>Onde estamos</li>
    <li>Por que preciso que estes passos sejam feitos por você</li>
    <li>Pedido prioritário: substituir a chave secreta</li>
    <li>Os quatro ajustes no aplicativo da Microsoft</li>
    <li>O que preciso receber de volta</li>
    <li>Google: o mesmo procedimento, mais curto</li>
    <li>Manutenção: a data que não pode passar em branco</li>
  </ol>
</section>

<h2>1. Onde estamos</h2>

<p>
  A plataforma está no ar em <strong>${APP_URL}</strong>, com certificado de segurança
  válido e renovação automática configurada. O acesso por e-mail e senha funciona.
</p>

<p>
  O que ainda não funciona é o <strong>login com conta Microsoft</strong> — aquele botão
  que permite entrar usando a conta corporativa, sem criar mais uma senha. Do nosso lado
  o código está pronto e testado. O que falta é o registro do aplicativo no portal da
  Microsoft ser autorizado a conversar com o nosso endereço.
</p>

${simp(
  'Uma analogia',
  `<p>Pense no portal da Microsoft como a portaria de um prédio, e na nossa aplicação como
  um escritório que acabou de se mudar para lá. A portaria já sabe quem são os funcionários
  da empresa. O que ela ainda não sabe é que existe um escritório novo chamado
  <em>app.doqyn.com</em> autorizado a receber essas pessoas.</p>
  <p>Enquanto ninguém avisar a portaria, ela vai barrar todo mundo que tentar entrar por ali
  — não por erro, mas porque recusar visitante não cadastrado é exatamente a função dela.
  Os passos deste relatório são esse cadastro.</p>`,
)}

<h2>2. Por que preciso que estes passos sejam feitos por você</h2>

<p>
  Desde que a verificação em duas etapas foi ativada na conta, eu perdi o acesso ao painel
  da cloud. Não consigo abrir o registro do aplicativo nem para conferir como ele está
  configurado hoje.
</p>

<p>
  Por isso este relatório é detalhado no nível de "qual botão clicar": cada item precisa ser
  executado por você no portal, e alguns deles eu preciso que você me informe o valor,
  porque não tenho como consultar.
</p>

<div class="callout">
  <strong>Sugestão para o futuro:</strong> se em algum momento fizer sentido, um acesso
  somente de leitura ao registro do aplicativo já resolveria a maior parte dessas idas e
  vindas. Eu conseguiria diagnosticar sem poder alterar nada. Não é urgente, mas evita que
  toda conferência dependa de troca de mensagens.
</div>

<h2>3. Pedido prioritário: substituir a chave secreta</h2>

<p>
  A chave secreta (<em>client secret</em>) que você me enviou precisa ser <strong>descartada e
  gerada novamente</strong>. Não é problema de conteúdo — é do caminho que ela percorreu.
</p>

<div class="warn">
  <strong>Por que trocar:</strong> a chave foi enviada por aplicativo de mensagem. Ela agora
  está gravada no histórico da conversa nos dois aparelhos, no backup automático do celular
  e possivelmente na nuvem pessoal vinculada a esses backups. Nenhum desses lugares é
  controlado por nós, e nenhum deles pode ser apagado com garantia.
  <br><br>
  Uma chave secreta funciona como a senha do aplicativo: quem a tiver, junto com o
  identificador público, consegue se passar pela nossa aplicação diante da Microsoft. O
  procedimento padrão, quando uma chave passa por um canal não controlado, é considerá-la
  comprometida e substituí-la. Não é desconfiança de ninguém, é higiene — leva menos de um
  minuto e elimina a dúvida.
</div>

<p>
  <strong>O identificador do aplicativo</strong> (<em>client ID</em>, o código que começa com
  <code>b127ee42-</code>) <strong>não</strong> precisa ser trocado. Ele é público por
  natureza e aparece na barra de endereço do navegador durante o login. Pode circular
  livremente.
</p>

<h3>Como substituir</h3>

<div class="step">
  <div class="n">Passo 1</div>
  <p>No portal, abra <span class="path">Azure Active Directory</span> (ou
  <span class="path">Microsoft Entra ID</span>, dependendo da versão do portal) e vá em
  <span class="path">App registrations</span>. Selecione o aplicativo do DOQYN.</p>
</div>

<div class="step">
  <div class="n">Passo 2</div>
  <p>No menu lateral, clique em <span class="path">Certificates &amp; secrets</span>, aba
  <span class="path">Client secrets</span>.</p>
</div>

<div class="step">
  <div class="n">Passo 3</div>
  <p>Clique em <span class="path">New client secret</span>. Dê uma descrição que identifique
  o uso (por exemplo, <em>DOQYN produção</em>) e escolha o prazo de validade.</p>
  <p><strong>Copie o valor imediatamente.</strong> A Microsoft mostra a chave uma única vez;
  ao sair da tela ela não pode mais ser lida, apenas apagada e recriada. O que você precisa
  copiar é a coluna <strong>Value</strong>, e não a coluna <em>Secret ID</em> — são coisas
  diferentes e é comum confundir.</p>
</div>

<div class="step">
  <div class="n">Passo 4</div>
  <p>Apague a chave antiga na mesma tela, no ícone de lixeira ao lado dela. Enquanto ela
  existir, continua válida.</p>
</div>

<div class="step">
  <div class="n">Passo 5</div>
  <p>Para me enviar a chave nova, evite aplicativo de mensagem. Qualquer uma destas serve:
  um gerenciador de senhas compartilhado, um cofre de segredos, ou simplesmente uma ligação
  em que você lê e eu anoto na hora.</p>
</div>

<h2>4. Os quatro ajustes no aplicativo da Microsoft</h2>

<p>
  Estes itens ficam no mesmo registro de aplicativo. Alguns podem já estar corretos — nesse
  caso é só confirmar.
</p>

<h3>4.1 — Endereço de retorno</h3>

<p>
  Depois que a pessoa digita a senha da Microsoft, o navegador precisa voltar para a nossa
  aplicação. A Microsoft só devolve para endereços previamente cadastrados.
</p>

<p>Em <span class="path">Authentication</span> → <span class="path">Add a platform</span>,
escolha <strong>Web</strong> e cadastre exatamente:</p>

<p style="text-align:center;font-size:11pt;margin:12pt 0">
  <code>${APP_URL}/oauth/microsoft/callback</code>
</p>

<div class="warn">
  <strong>Cuidado com a opção escolhida:</strong> tem que ser <strong>Web</strong>, não
  <em>Single-page application (SPA)</em>. As duas aparecem lado a lado e a diferença não é
  cosmética: aplicativos do tipo SPA são proibidos de usar chave secreta, porque rodam
  dentro do navegador do usuário. A nossa troca acontece no servidor, com a chave secreta.
  Se o cadastro ficar como SPA, a Microsoft rejeita o login com uma mensagem que não deixa
  claro que a causa foi essa.
</div>

<h3>4.2 — Quem pode entrar (e o identificador da organização)</h3>

<p>
  Preciso saber qual opção está marcada em <span class="path">Supported account types</span>,
  que aparece na página <span class="path">Overview</span> do aplicativo. As possibilidades
  relevantes são duas:
</p>

<table>
  <tr>
    <th>Se estiver marcado</th>
    <th>Significa</th>
    <th>Do que eu preciso</th>
  </tr>
  <tr>
    <td>Apenas contas neste diretório organizacional</td>
    <td>Só quem tem conta da nossa empresa consegue entrar</td>
    <td>Preciso do <strong>Directory (tenant) ID</strong>, na mesma página Overview</td>
  </tr>
  <tr>
    <td>Contas em qualquer diretório organizacional</td>
    <td>Qualquer conta Microsoft corporativa consegue entrar</td>
    <td>Só me confirmar que é esta opção</td>
  </tr>
</table>

${tech(
  'Por que essa informação é indispensável',
  `<p>A aplicação valida a assinatura do token recebido contra um endereço que inclui o
  identificador da organização. Se eu configurar o valor genérico enquanto o aplicativo está
  restrito à organização, a verificação falha em todo login — e falha por segurança, não por
  defeito. Não existe como descobrir esse valor por tentativa: ou é informado, ou o login
  não funciona.</p>`,
)}

<h3>4.3 — Confirmação de que o e-mail é legítimo</h3>

<p>
  Em <span class="path">Token configuration</span> → <span class="path">Add optional claim</span>,
  escolha o tipo <strong>ID</strong> e marque a opção chamada <strong><code>xms_edov</code></strong>.
</p>

${simp(
  'O que isso muda na prática',
  `<p>Sem essa opção, a Microsoft nos informa o e-mail da pessoa, mas não nos diz se aquele
  e-mail foi de fato confirmado. Nosso sistema, diante dessa dúvida, toma a decisão segura:
  trata como não confirmado.</p>
  <p>A consequência aparece para quem já tem conta no DOQYN criada com senha. Ao clicar em
  "entrar com Microsoft", em vez de reconhecer que é a mesma pessoa e conectar as duas
  formas de acesso, o sistema pede uma confirmação adicional por e-mail — um passo a mais,
  para toda a equipe, sempre.</p>
  <p>Com a opção ativada, o reconhecimento é automático e o login flui direto. O sistema
  funciona nos dois cenários; a diferença é atrito desnecessário para os usuários.</p>`,
)}

<h3>4.4 — Permissões</h3>

<p>
  Em <span class="path">API permissions</span>, confirme que existem as permissões delegadas
  <code>openid</code>, <code>email</code> e <code>profile</code>. Normalmente já vêm marcadas
  por padrão; é só uma verificação. Não precisamos de nenhuma permissão além dessas — não
  lemos e-mails, arquivos ou agenda de ninguém.
</p>

<h2>5. O que preciso receber de volta</h2>

<table class="check">
  <tr><th colspan="2">Itens para me enviar</th></tr>
  <tr><td>☐</td><td>A <strong>chave secreta nova</strong> (por canal que não seja aplicativo de mensagem)</td></tr>
  <tr><td>☐</td><td>Qual opção está marcada em <strong>Supported account types</strong></td></tr>
  <tr><td>☐</td><td>O <strong>Directory (tenant) ID</strong>, caso o aplicativo seja restrito à organização</td></tr>
  <tr><td>☐</td><td>A <strong>data de expiração</strong> da chave nova</td></tr>
  <tr><th colspan="2">Itens apenas para confirmar que foram feitos</th></tr>
  <tr><td>☐</td><td>Endereço de retorno cadastrado como <strong>Web</strong></td></tr>
  <tr><td>☐</td><td>Chave secreta antiga <strong>apagada</strong></td></tr>
  <tr><td>☐</td><td>Opção <code>xms_edov</code> marcada</td></tr>
  <tr><td>☐</td><td>Permissões <code>openid</code>, <code>email</code>, <code>profile</code> presentes</td></tr>
</table>

<p>
  Com esses itens em mãos, a ativação do nosso lado leva poucos minutos e é verificável na
  hora — consigo confirmar que o provedor entrou no ar antes mesmo de alguém tentar o
  primeiro login.
</p>

<h2>6. Google: o mesmo procedimento, mais curto</h2>

<p>
  Para o login com Google preciso de três coisas:
</p>

<table>
  <tr><th>Item</th><th>Onde fica</th></tr>
  <tr><td><strong>Client ID</strong></td><td>Google Cloud Console → Credenciais → ID do cliente OAuth</td></tr>
  <tr><td><strong>Client Secret</strong></td><td>Mesma tela (mesmo cuidado de canal da chave da Microsoft)</td></tr>
  <tr>
    <td><strong>URI de redirecionamento autorizada</strong></td>
    <td>Cadastrar <code>${APP_URL}/oauth/google/callback</code></td>
  </tr>
</table>

<p>
  O Google não tem o equivalente ao item 4.3 — ele já informa de origem se o e-mail foi
  verificado. Por isso esse provedor é mais simples de configurar.
</p>

<h2>7. Manutenção: a data que não pode passar em branco</h2>

<p>
  A chave secreta da Microsoft <strong>tem prazo de validade</strong>. Quando ele vence, o
  login com conta corporativa para de funcionar — e esse é o tipo de falha que costuma pegar
  a equipe de surpresa, porque o restante do sistema continua funcionando normalmente. Quem
  entra por e-mail e senha não percebe nada; só quem usa o botão da Microsoft é afetado.
</p>

<p>
  Por isso peço a data de expiração no item 5. Com ela anotada, a substituição é agendada com
  antecedência e feita sem pressa, em vez de virar urgência.
</p>

<table>
  <tr><th>Item</th><th>Vencimento</th><th>Consequência se vencer</th><th>Responsável</th></tr>
  <tr>
    <td>Chave secreta da Microsoft</td>
    <td>Definida na criação (até 24 meses)</td>
    <td>Login com Microsoft para; e-mail e senha seguem funcionando</td>
    <td>Gestor da conta cloud</td>
  </tr>
  <tr>
    <td>Certificado de segurança do site</td>
    <td>A cada 90 dias</td>
    <td>Nenhuma — renovação automática já configurada</td>
    <td>Automático</td>
  </tr>
</table>

<div class="callout">
  <strong>Resumo em uma linha:</strong> a aplicação está no ar e funcionando; o login
  corporativo depende de uma chave nova e de quatro ajustes no portal, todos listados
  na seção 5.
</div>

<p class="footer-note">
  Relatório complementar gerado em ${DATE}. Documento de apoio à configuração do SSO —
  não substitui a documentação técnica principal da plataforma.
</p>

</body>
</html>`;

writeFileSync(OUT, html, 'utf8');
console.log('HTML escrito em', OUT);
console.log('bytes', Buffer.byteLength(html));
