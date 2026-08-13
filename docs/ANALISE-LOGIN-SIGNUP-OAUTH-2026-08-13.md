# Análise — login, cadastro e OAuth (Google / Microsoft)

**Data:** 2026-08-13 · **Repos:** `doqyn-auth-service` (OAuth, formulários no servidor) e
`doqyn-alpha-document-intelligence` (telas)

Levantamento de oportunidades de melhoria. Nada foi alterado — este documento é insumo de decisão.
A ordem é por consequência, não por esforço.

## O que já está bem feito

Vale registrar antes das críticas, porque muda o tipo de trabalho que falta:

- **PKCE com S256**, `state` e `nonce` conferidos, `id_token` verificado por JWKS remoto com issuer e
  audience checados (`oauth.providers.ts`). É o desenho correto, não a versão simplificada.
- **Cookie `pending` separado do state**, com o `codeVerifier` fora da URL.
- **Auditoria** em cada passo — `auth.oauth_user_created`, `auth.oauth_account_linked`, e-mail
  redigido nos metadados.
- **Vinculação automática guardada por e-mail verificado** (`oauth.accounts.service.ts:170`), que é
  exatamente a proteção certa contra tomada de conta por OAuth.
- Login já tem os dois botões (`Login.tsx:77-96`), e o callback roteia por status, inclusive
  `onboarding_required` → `/onboarding`.

O trabalho que falta é de arestas, não de fundação.

---

## 1. Microsoft não emite `email_verified` — e o código depende disso

**Impacto: alto. Melhor resolver antes de criar o app registration.**

`payloadToIdentity` (`oauth.providers.ts:117`) é compartilhado pelos dois provedores e faz:

```ts
emailVerified: payload.email_verified === true,
```

`email_verified` é claim padrão OIDC que o **Google emite e o Microsoft Entra não**. No `id_token`
v2.0 da Microsoft ela simplesmente não existe. Logo, para todo usuário Microsoft,
`identity.emailVerified` será `false`, sempre.

Duas consequências, ambas silenciosas:

**a) Quem já tem conta por senha nunca consegue entrar com Microsoft.**
`resolveOAuthUser` acha o usuário pelo e-mail e cai em:

```ts
if (!identity.emailVerified) {
  throw new Error('OAUTH_EMAIL_NOT_VERIFIED');
}
```

O usuário clica "Continuar com Microsoft", é levado à Microsoft, autentica com sucesso, e volta para
a tela de login com um erro que não explica nada acionável. Não é um caso raro: é **todo** usuário
que se cadastrou por formulário e depois tenta o SSO.

**b) Todo usuário novo da Microsoft nasce com `emailVerified: false`** e status
`pending_verification`. Hoje `isUserLoginAllowed` aceita esse status, então ele entra — mas o
produto perde a garantia de e-mail verificado justamente no caminho que deveria trazê-la de graça.

**Como resolver.** A Microsoft expõe a claim opcional **`xms_edov`** (*email domain owner
verified*), que precisa ser habilitada no app registration — ou seja, é decisão de configuração que
você vai tomar agora de qualquer forma. O tratamento passa a ser por provedor:

- Google: `email_verified === true`
- Microsoft: `xms_edov === true` (e apenas quando o e-mail vier da claim `email`, não do fallback)

Se a claim opcional não for habilitada, a decisão consciente é **não vincular automaticamente** e
mandar o usuário para um fluxo de confirmação — nunca assumir verificado.

## 2. `preferred_username` usado como e-mail

**Impacto: alto, e agrava o item 1.**

```ts
const email =
  typeof payload.email === 'string' ? payload.email
  : typeof payload.preferred_username === 'string' ? payload.preferred_username
  : null;
```

No Google isso é inofensivo. No Microsoft, `preferred_username` é o **UPN**, que frequentemente não
é o e-mail real do usuário: pode ser `fulano@empresa.onmicrosoft.com`, um alias interno, ou um nome
de login sem domínio roteável. Gravar isso como e-mail da conta produz identidade errada — e, pior,
uma identidade que pode colidir com o e-mail de outra pessoa.

**Sugestão:** usar `preferred_username` só quando ele contiver `@` **e** o provedor for Google; para
Microsoft, exigir a claim `email` (que é opcional e também precisa ser pedida no app registration
via escopo/claim). Sem e-mail confiável, `OAUTH_EMAIL_REQUIRED` já existe e é a resposta correta.

## 3. `OAUTH_MICROSOFT_TENANT=common` aceita conta pessoal

**Impacto: depende de como o item 1 for resolvido — e é aí que mora o risco.**

`common` permite tanto contas corporativas quanto contas pessoais Microsoft. Isso é uma escolha
legítima de produto, mas cria uma superfície: qualquer pessoa cria uma conta pessoal Microsoft
declarando um e-mail e tenta entrar.

Hoje o guard de e-mail verificado bloqueia isso — por acidente, já que ele bloqueia *todo mundo* da
Microsoft. **Ao consertar o item 1, esse bloqueio some.** Se `xms_edov` for habilitada, ela cobre o
caso (uma conta pessoal não tem domínio verificado). Se for "resolvido" apenas relaxando a checagem,
abre-se a porta que o guard fechava.

**A ordem importa:** decidir a política de tenant (`common` × `organizations` × tenant específico)
junto com a política de verificação, não depois.

## 4. Cadastro não oferece Google nem Microsoft

**Impacto: médio-alto, é a maior perda de conversão.**

O login oferece os dois provedores. O cadastro (`CompanySignupPage`, `IndividualSignupPage`) só
oferece formulário. O usuário que chega para se cadastrar preenche **7 campos obrigatórios** —
nome da empresa, CNPJ, nome, sobrenome, e-mail corporativo, WhatsApp e senha.

Três desses (nome, sobrenome, e-mail) o Google e a Microsoft entregam prontos e verificados.

O caminho técnico já existe: quem clica "Continuar com Google" sem conta vira usuário novo com
`postLoginStatus: 'onboarding_required'`, e o callback já roteia para `/onboarding`. Falta a ponte na
UI — um "Continuar com Google" na tela de cadastro que leve ao mesmo fluxo, com o formulário
pré-preenchido e reduzido ao que o provedor não sabe (empresa, CNPJ, WhatsApp).

Vale conferir se `/onboarding` hoje cobre esse caso ou se ele deságua numa tela vazia — não
verifiquei o conteúdo dessa rota.

## 5. Formulários sem `autoComplete`

**Impacto: médio. Custo: uma linha por campo.**

```
CompanySignupPage.tsx     0 ocorrências de autoComplete
IndividualSignupPage.tsx  0 ocorrências
Login.tsx                 2 ocorrências
```

Sem esses atributos, o gerenciador de senhas do navegador não preenche e — pior — **não se oferece
para salvar a senha** que o usuário acabou de criar. Quem cadastra pelo formulário sai sem a senha
guardada, e a próxima visita vira "esqueci minha senha".

O componente `Input` já repassa `...props` para o elemento nativo, então é só passar:

| Campo | Valor |
|---|---|
| Nome da empresa | `organization` |
| Nome / Sobrenome | `given-name` / `family-name` |
| E-mail | `email` (login: `username`) |
| WhatsApp | `tel` |
| Senha (cadastro) | `new-password` |
| Confirmar senha | `new-password` |
| Senha (login) | `current-password` |

## 6. Política de senha mínima

**Impacto: médio.**

`companySignups.schemas.ts:15` exige `min(8)` e a confirmação. Não há verificação de força nem de
vazamento. Para um produto que guarda documento confidencial de empresa, 8 caracteres sem mais nada
é o piso do piso — e o item 4 tem relação direta: quanto mais gente entrar por SSO, menos senha
fraca existe para proteger.

Duas melhorias baratas, em ordem de retorno: checar a senha contra a lista de vazadas do
Have I Been Pwned por *range* de hash (k-anonymity, não envia a senha), e exigir comprimento maior
em vez de regras de composição — comprimento vence complexidade em senha real.

## 7. Inconsistência entre os botões

**Impacto: baixo, mas é assimetria gratuita.**

Google recebe `prompt: 'select_account'`; Microsoft não. Na prática, quem tem sessão Microsoft ativa
entra direto sem escolher conta — comportamento diferente do botão ao lado, e ruim para quem tem
conta pessoal e corporativa no mesmo navegador. Vale alinhar (`prompt=select_account` também no
Microsoft).

Vale conferir também `domain_hint`, útil quando o tenant for fixo.

## 8. Mensagem de erro do callback

`OAUTH_EMAIL_NOT_VERIFIED` chega ao usuário como código; `loginFeedback.ts` mapeia alguns códigos,
mas convém garantir que este tenha texto acionável — ele diz ao usuário o que fazer (entrar com
e-mail e senha, ou verificar o e-mail no provedor), não apenas que falhou. Com o item 1 corrigido a
frequência cai muito, mas o caminho continua existindo.

---

## Ordem sugerida

1. **Decidir junto**: política de tenant Microsoft + claims opcionais (`xms_edov`, `email`) no app
   registration. É configuração, e você vai criar o app de qualquer forma.
2. **Itens 1 e 2** no código, por provedor — antes de o Microsoft entrar no ar, para não nascer com
   vinculação quebrada.
3. **Item 5** (`autoComplete`), que é barato e melhora conversão hoje, sem depender de nada.
4. **Item 4** (OAuth no cadastro), que é o de maior retorno e o de maior trabalho.
5. Itens 6, 7 e 8 conforme a folga.

## Arquivos citados

| Assunto | Arquivo |
|---|---|
| Montagem das URLs e verificação de token | `doqyn-auth-service/src/modules/oauth/oauth.providers.ts` |
| Vinculação e criação de conta | `doqyn-auth-service/src/modules/oauth/oauth.accounts.service.ts` |
| Configuração por provedor | `doqyn-auth-service/src/modules/oauth/oauth.config.ts` |
| Schema de cadastro empresa | `doqyn-auth-service/src/modules/company-signups/companySignups.schemas.ts` |
| Tela de login | `src/pages/Login.tsx` |
| Retorno do OAuth | `src/pages/OAuthCallbackPage.tsx` |
| Formulários de cadastro | `src/features/company-signup/`, `src/features/individual-signup/` |
