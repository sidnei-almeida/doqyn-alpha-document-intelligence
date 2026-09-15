# Glossário do DOQYN — pt-BR · en-US · es-419

**Congelado antes de qualquer tradução.** É a Fase 11.1 do `.planning/I18N-PLANO.md`.

Sem isto, "documento" vira `document`, `file` e `record` em três telas, e o produto passa a
falar de si mesmo de três jeitos. Traduzir string solta produz frases corretas e um produto
incoerente.

Os termos saíram do catálogo real (`npm run i18n:audit`), por frequência — não de uma lista
imaginada. O número entre parênteses é quantas vezes o termo aparece no `pt-BR`.

---

## Os cinco que decidem o resto

### documento (146) → `document` · `documento`

**Nunca `file`.** No DOQYN o documento é a entidade: tem versões, metadados, categoria, regra
de acesso e trilha. O arquivo é o binário que veio junto. A tela distingue os dois — "atualizar
documento" cria uma versão nova; "baixar arquivo" entrega o PDF — e a tradução tem de
distinguir também.

### arquivo (23) → `file` · `archivo`

O binário. Aparece em upload, download e tamanho. Se a frase fala de bytes, é arquivo; se fala
de conteúdo, é documento.

### categoria (66) → `category` · `categoría`

**Nunca `folder`.** Categoria é o eixo de governança: é ela que os grupos alcançam, e é dela
que sai a regra de extração. Pasta (`folder` · `carpeta`) é a organização visual da Biblioteca,
e são coisas diferentes na mesma tela.

### ambiente (20) → `workspace` · `espacio de trabajo`

**Nunca `environment`.** Em SaaS, "environment" lê como desenvolvimento/homologação/produção.
O que a pessoa vê é o espaço da organização dela. `tenant` é termo de código e não aparece em
tela nenhuma — se aparecer, é bug.

### assinatura (37) → `signature` · `firma`

**Em espanhol, nunca `suscripción`** — que é assinatura de plano, não de documento. É o falso
amigo mais perigoso desta lista, porque o produto também poderia ter planos.

---

## Governança e acesso

| pt-BR | en-US | es-419 | Nota |
|---|---|---|---|
| acesso (59) | access | acceso | |
| grupo (37) | group | grupo | Grupo de acesso; nunca `team` |
| regras (20) | rules | reglas | A tela de governança. `Access rules` quando precisar do contexto |
| matriz | access matrix | matriz de acceso | |
| permissão (15) | permission | permiso | |
| alcance / alcançar | reach | alcance | Quem "alcança" uma categoria. Não é `access` — alcance é o resultado da regra |
| trilha | audit trail | rastro de auditoría | |
| auditoria | audit | auditoría | |
| aprovação | approval | aprobación | |

## Ciclo do documento

| pt-BR | en-US | es-419 | Nota |
|---|---|---|---|
| envio / enviar (17) | upload | subir | Enviar arquivo para o DOQYN |
| compartilhar | share | compartir | Dar acesso a outra pessoa. **Não confundir com envio** |
| análise (17) | analysis | análisis | O que a IA faz |
| revisão (23) | review | revisión | O que a pessoa faz depois da análise |
| metadados (17) | metadata | metadatos | |
| versão (31) | version | versión | |
| validade / vencimento | expiry date | fecha de vencimiento | A data em que o documento perde validade |
| lixeira | trash | papelera | |
| desativado | deactivated | desactivado | Estado terminal, depois da lixeira |
| prévia (19, hoje "preview") | preview | vista previa | Em pt-BR o produto usa "preview"; mantido |

## Pessoas e contas

| pt-BR | en-US | es-419 | Nota |
|---|---|---|---|
| conta (25) | account | cuenta | |
| usuário (32) | user | usuario | |
| membro | member | miembro | Pessoa dentro de um ambiente |
| convite (17) | invitation | invitación | Substantivo. O verbo é `invite` · `invitar` |
| solicitação (17) | request | solicitud | |
| empresa (32) | company | empresa | **Só em tenant PJ.** Em PF a frase não fala de empresa — ver abaixo |
| signatário | signer | firmante | |
| destinatário | recipient | destinatario | |

---

## Duas armadilhas do produto

### PF e PJ não dizem a mesma coisa

O DOQYN atende pessoa física e jurídica, e boa parte do vocabulário ramifica: onde PJ diz
"empresa", PF não diz nada equivalente — diz "meu acervo". A tradução **não pode neutralizar
isso para um termo só**; se a frase em português ramifica, a tradução ramifica junto.

Quem traduzir vai encontrar chaves com `scopeSectionLabel` e afins: são o ponto onde a
ramificação acontece.

### O idioma do documento não é o idioma da tela

Frases sobre o conteúdo analisado — "as partes deste contrato", "a data de emissão" — falam de
um documento que pode estar em qualquer língua. Traduzir o rótulo é certo; traduzir o **valor
extraído** é errado, e o pipeline não faz isso.

---

## Como usar

`scripts/i18n-translate.ts` manda este glossário junto de cada lote. Quem revisar deve conferir
primeiro os termos desta lista, e só depois a fluência: uma frase bonita com "environment" no
lugar de "workspace" é pior que uma frase dura com o termo certo.

**Mudou um termo aqui? Refaça as chaves que o contêm.** Um glossário que diverge do catálogo é
pior que nenhum, porque ninguém sabe qual dos dois vale.
