# Configurar o login com Microsoft

Passo a passo do que criar no portal da Microsoft e qual variável de ambiente recebe cada valor.
Escrito contra o código atual (`src/modules/oauth/`), não genérico.

## Onde

**Microsoft Entra admin center** — https://entra.microsoft.com
(ou Azure Portal → Microsoft Entra ID; é o mesmo cadastro, o Entra é a interface nova)

## 0. Antes de tudo: você precisa de um diretório

Entrando com conta Microsoft pessoal (@outlook, @hotmail, @gmail cadastrado na Microsoft), o portal
responde:

> *The ability to create applications outside of a directory has been deprecated. You may get a new
> directory by joining the M365 Developer Program or signing up for Azure.*

App registration precisa morar dentro de um diretório Entra, e conta pessoal não tem um.

**Caminho mais direto:** criar conta Azure gratuita em https://azure.microsoft.com/free — o cadastro
cria automaticamente um *Default Directory*, e o App registrations passa a aparecer. Pede cartão para
verificação de identidade, mas app registration e OAuth ficam no **Entra ID Free**, que custa zero e
não expira. O crédito de 12 meses e os serviços pagos do Azure são outra coisa, que este setup não usa.

**O diretório não amarra o produto.** Ele é apenas o endereço de cadastro do app. Com
`OAUTH_MICROSOFT_TENANT=organizations` ou `common`, quem faz login são usuários de *qualquer* outro
tenant — cada empresa cliente usa o Microsoft 365 dela. O seu diretório só hospeda o registro e o
client secret. Um diretório criado agora só para isso serve inclusive em produção.

**Alternativas:**

- **Conta corporativa existente** — se a empresa já usa Microsoft 365, o tenant já existe e serve.
  É o caminho sem burocracia.
- **M365 Developer Program** — dá tenant sandbox gratuito e renovável, mas a Microsoft apertou a
  elegibilidade e passou a exigir assinatura Visual Studio ativa para novas adesões. Confirme antes
  de contar com essa via.

Depois que existir um diretório, siga a partir daqui.

## 1. Criar o app registration

**Identity → Applications → App registrations → New registration**

| Campo | O que pôr |
|---|---|
| Name | `DOQYN` (aparece na tela de consentimento do usuário — use o nome que o cliente deve ver) |
| Supported account types | **decisão de produto, ver abaixo** |
| Redirect URI | Platform **Web**, valor na seção 3 |

### A decisão dos "supported account types"

Isso define o valor de `OAUTH_MICROSOFT_TENANT` e tem consequência de segurança:

| Escolha no portal | `OAUTH_MICROSOFT_TENANT` | Quem entra |
|---|---|---|
| Single tenant | o Directory (tenant) ID | só a sua organização |
| Multitenant | `organizations` | qualquer empresa com Microsoft 365 |
| Multitenant + contas pessoais | `common` | o acima, **mais** conta pessoal (@outlook, @hotmail) |

O código hoje usa `common` como default. Para um SaaS B2B, **`organizations` costuma ser a escolha
certa**: conta pessoal Microsoft aceita qualquer e-mail no cadastro, e é justamente o vetor que a
verificação de e-mail existe para barrar. Ver `src/modules/oauth/oauth.providers.ts`,
`isEmailVerifiedByProvider`.

## 2. Copiar os identificadores

Na tela **Overview** do app recém-criado:

| No portal | Variável |
|---|---|
| Application (client) ID | `OAUTH_MICROSOFT_CLIENT_ID` |
| Directory (tenant) ID | `OAUTH_MICROSOFT_TENANT` — **só se** escolheu single tenant |

## 3. Redirect URI

**Authentication → Add a platform → Web → Redirect URIs**

O valor precisa ser a URL que o **navegador** alcança, não a porta interna do serviço. Como o Vite
faz proxy de `/oauth` para `127.0.0.1:4100` (`vite.config.ts`), em desenvolvimento é a porta do front:

```
http://localhost:5173/oauth/microsoft/callback
```

Em produção, o domínio público atrás do nginx:

```
https://SEU-DOMINIO/oauth/microsoft/callback
```

Cadastre os dois — a Microsoft aceita vários. O mesmo valor vai em
`OAUTH_MICROSOFT_REDIRECT_URI`, **byte a byte**: a Microsoft compara a string exata, e barra 
por uma barra final sobrando.

> Confira qual formato o Google está usando hoje em `OAUTH_GOOGLE_REDIRECT_URI` e siga o mesmo —
> se o Google estiver apontando direto para `:4100`, use `:4100` aqui também.

## 4. Client secret

**Certificates & secrets → Client secrets → New client secret**

- Validade: no máximo 24 meses. **Anote a data de expiração** — quando vencer, o login para de
  funcionar sem nenhum erro no seu código.
- Copie o campo **Value**, não o **Secret ID**. O Value só aparece nesta tela, uma vez.

Vai em `OAUTH_MICROSOFT_CLIENT_SECRET`.

## 5. Claims opcionais — o passo que quase todo mundo pula

**Token configuration → Add optional claim → Token type: ID → marcar `email` e `xms_edov`**

Isto **não é opcional para nós**, apesar do nome.

O Microsoft Entra **não emite `email_verified`** (a claim padrão OIDC que o Google emite). A
equivalente dele é **`xms_edov`** — *email domain owner verified*. Sem essa claim habilitada:

- todo usuário Microsoft é tratado como e-mail **não verificado**;
- quem já tem conta por senha no DOQYN **não consegue vincular** o login Microsoft — autentica com
  sucesso lá e volta com erro;
- usuário novo entra, mas sem a garantia de e-mail que o SSO deveria trazer.

Esse comportamento é deliberado (`isEmailVerifiedByProvider` trata ausência como não verificado, que
é a resposta segura), mas quem paga é o usuário. Habilite a claim.

Ao marcar `email`, o portal pode avisar que é preciso conceder a permissão correspondente — aceite.

## 6. Permissões de API

**API permissions** — normalmente já vem com `User.Read` do Microsoft Graph, que basta. O código pede
os escopos `openid email profile`, todos cobertos por permissão delegada padrão. Não precisa de
consentimento de administrador para esse conjunto.

## 7. Variáveis finais

No `.env` do `doqyn-auth-service`:

```
OAUTH_MICROSOFT_ENABLED=true
OAUTH_MICROSOFT_CLIENT_ID=<Application (client) ID>
OAUTH_MICROSOFT_CLIENT_SECRET=<o Value do secret, não o ID>
OAUTH_MICROSOFT_REDIRECT_URI=<a mesma string cadastrada no portal>
OAUTH_MICROSOFT_TENANT=organizations
```

Reinicie o serviço. `OAUTH_MICROSOFT_ENABLED=false` faz a rota devolver 404
`OAUTH_PROVIDER_DISABLED` — é o estado atual.

## 8. Conferir que funcionou

```bash
# a rota deve redirecionar (302) para login.microsoftonline.com, não devolver 404
curl -i -s "http://localhost:4100/oauth/microsoft/start" | head -5
```

Depois, pelo navegador: clique em "Continuar com Microsoft" na tela de login e verifique que
`xms_edov` chegou — o log de auditoria registra `auth.oauth_account_linked` quando a vinculação
automática acontece, o que só ocorre com e-mail verificado.

## Erros comuns

| Sintoma | Causa quase sempre |
|---|---|
| `AADSTS50011: redirect URI mismatch` | string diferente da cadastrada — barra final, http vs https, porta |
| `AADSTS7000215: invalid client secret` | copiou o Secret ID em vez do Value, ou o secret expirou |
| Login funciona mas não vincula à conta existente | `xms_edov` não habilitada (seção 5) |
| 404 `OAUTH_PROVIDER_DISABLED` | `OAUTH_MICROSOFT_ENABLED` não é `true` |

## Google, para comparação

Já está configurado, mas se precisar refazer: Google Cloud Console → APIs & Services → Credentials →
OAuth client ID → Web application. Os campos equivalentes são `OAUTH_GOOGLE_CLIENT_ID`,
`OAUTH_GOOGLE_CLIENT_SECRET` e `OAUTH_GOOGLE_REDIRECT_URI`. O Google emite `email_verified` nativamente,
sem claim opcional para configurar.
