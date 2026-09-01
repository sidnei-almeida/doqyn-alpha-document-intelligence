# Conjunto difícil — documentos sintéticos com gabarito

19 casos, 33 arquivos. Complementa o conjunto original (`../pdf`, `../images`,
`../scanned_pdf`), que é útil como piso mas não mede quase nada: lá cada campo
está atrás do seu rótulo, uma vez só, em texto limpo. Um extrator que só
reconhece `Nome:` e copia o que vem depois acerta tudo naquele conjunto e erra
tudo em produção.

Aqui cada documento existe para exercitar uma falha específica.

## O que este conjunto ataca

O contrato de extração do app (`server/ai/utils/extractorPrompt.ts`) exige
quatro coisas que o conjunto antigo não cobria:

| Exigência | Onde falha na prática | Casos que a exercitam |
|---|---|---|
| **Normalizar data** para `yyyy-mm-dd` | Data por extenso, `dd.mm.aaaa`, `March 4, 2026`, competência sem dia | `juridico_01`, `juridico_03`, `juridico_04`, `contratos_03`, `financeiro_04`, `operacional_02` |
| **Calcular valor derivado** de âncora + prazo relativo | "7 (sete) anos contados da assinatura" | `juridico_01`, `juridico_03`, `contratos_03` |
| **Abster-se** quando o dado não está no documento | Minuta sem data, recibo sem nota fiscal, folha de rosto vazia | `juridico_02`, `financeiro_03`, `ambiguo_02` |
| **Distinguir campos parecidos** — mesmo formato, papel diferente | Quatro datas no DANFE, três fornecedores na cotação, dois CNPJs vizinhos | `financeiro_01`, `financeiro_02`, `compras_01`, `rh_01`, `contratos_01` |

Mais dois eixos que o extrator não controla sozinho:

- **Classificação ambígua** — `ambiguo_01` é um contrato cujo corpo é
  majoritariamente NDA. As duas classes são defensáveis; o que se mede é se a
  confiança cai e o documento vai para revisão em vez de ser classificado com
  certeza falsa.
- **Sem conteúdo** — `ambiguo_02` é uma folha de rosto de anexo. A resposta certa
  é revisão manual e todos os campos em `null`.

## Estrutura

```
hard/
├── GROUND_TRUTH.json     gabarito completo — é o que torna o conjunto mensurável
├── pdf/                  19 PDFs digitais (com camada de texto)
├── scanned_pdf/           7 PDFs degradados, SEM camada de texto → forçam OCR
└── images/                7 PNGs (primeira página) → caminho de upload de imagem
```

Os PDFs digitais passam pelo extrator de texto. Os escaneados não: `pdf-parse`
não acha nada neles e o pipeline cai para a visão computacional — o ramo que
quase nunca é testado, porque todo PDF de teste nasce digital.

### Perfis de degradação

| Perfil | Imita | Efeito |
|---|---|---|
| `scanner_rapido` | Scanner de mesa em modo rápido | Inclinação de 1,2°, granulação leve, JPEG 62 |
| `fotocopia_terceira_geracao` | Terceira cópia da cópia | Contraste em 0,72, fundo acinzentado, tons de cinza perdidos |
| `foto_celular` | Foto sobre a mesa | Inclinação de 2,4°, sombra lateral, JPEG 48 |
| `fax_monocromatico` | Digitalização 1 bit | Limiar duro em 168, serrilhado, sem meio-tom |

## Gabarito

Cada caso em `GROUND_TRUTH.json` declara:

- `expectedClass` — a classe correta, ou `null` quando não há classe determinável.
- `expectedFields` — por campo, o valor em duas formas: `value` (o que está
  literalmente escrito) e `normalizedValue` (a forma padronizada que o sistema
  usa para buscar, ordenar e alertar). Também `acceptableValues` para leituras
  igualmente defensáveis e `nullAcceptable` quando abster-se também é correto.
- `forbiddenValues` — os valores que caracterizam **erro**, não apenas ausência
  de acerto. São as armadilhas do documento: a data de admissão em vez da data
  de rescisão, o destinatário em vez do emitente, a chave de acesso em vez do
  número da nota. Um extrator pode ter 90% de acerto e ainda estar preenchendo
  o campo errado com o valor errado nos 10% que importam.
- `traps` — em texto, o que o documento faz para induzir o erro. É o que permite
  ler o resultado sem reabrir o PDF.
- `difficulty` — `alta` ou `muito alta`. Não há caso fácil aqui de propósito;
  para linha de base, use o conjunto original.

## Regerar

```bash
node synthetic_document_dataset/generator/build.mjs    # gera tudo + gabarito
node synthetic_document_dataset/generator/verify.mjs   # confere gabarito × arquivos
```

`verify.mjs` responde duas perguntas que já erraram sozinhas: se todo valor do
gabarito aparece mesmo no texto do PDF (um gabarito com erro de digitação
transforma acerto do modelo em falha registrada, e ninguém desconfia do
gabarito), e se os PDFs escaneados estão de fato sem camada de texto (se o texto
vazar, o caso deixa de exercitar o OCR e a taxa de acerto sobe por motivo
errado).

Requisitos: `chromium` (HTML → PDF), `ghostscript` (rasterização), e as
dependências `sharp` e `pdf-lib`, que já são do projeto.

## Aviso

Todos os documentos são sintéticos. Pessoas, empresas, CNPJs, CPFs, endereços e
números de registro são fictícios. Cada arquivo traz uma nota de rodapé
declarando isso — idêntica em todos, de propósito: um rótulo que varia entre
classes viraria atalho para o classificador acertar sem ler o documento.
