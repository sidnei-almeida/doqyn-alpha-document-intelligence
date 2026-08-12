# Estudo — prompts de classificação e extração de metadados

**Data:** 2026-08-12 · **Bancada:** `scripts/bench-extractor-prompts.mjs` · **Dados brutos:** `logs/bench/bench-results.json`

## Pergunta

Qual estratégia de prompt extrai melhor os metadados, sabendo que o DOQYN recebe **qualquer tipo
de documento** — não só NDA? Nenhuma resposta pode depender de vocabulário de um tipo específico.

## Montagem

Pipeline real reproduzido em duas etapas, como em produção:

1. **Classificar** contra as classes do tenant, com opção de abster-se (`classId: null`)
2. **Extrair** com os campos da classe escolhida

Classificação errada marca cascata e zera a extração — é o que acontece no produto.

**Corpus** (3 documentos, um deles negativo de propósito):

| Documento | Classe esperada | Por quê |
|---|---|---|
| NDA real (6.192 chars) | Acordo de confidencialidade | Tem armadilha: cita "3 anos" duas vezes (não concorrência, não aliciamento) e o prazo real do acordo é "7 anos" |
| Contrato de prestação de serviços | Contrato | Campos limpos e diretos |
| Relatório técnico (21.361 chars) | **nenhuma** | Fala *sobre* contratos o tempo todo sem *ser* um. Mede alucinação |

**Classes oferecidas:** 4, sendo 2 distratores (nota fiscal, procuração) que nenhum documento satisfaz.

**Entradas:** texto limpo e texto degradado simulando OCR (confusão `0/O`, `1/l`, `rn/m`, perda
parcial de acento, quebra de linha no meio da frase, inversão de linhas vizinhas).
Aproximação declarada — sem credencial do Google Vision no ambiente.

**Fatiamento** espelhando `server/ai/constants.ts`: chunks de 1800 chars, classificador limitado a
5×1200. Mandar o documento inteiro estourava o limite de request do modelo pequeno (413) e não
representava produção.

**Modelo:** `llama-3.1-8b-instant`, temperatura 0, 48 execuções, zero erro.

## Resultado 1 — a classificação é onde o OCR dói

| Entrada | Prompt genérico | Prompt evidência-primeiro |
|---|---|---|
| limpo | **12/12** | **12/12** |
| OCR | 8/12 | 8/12 |

Os dois prompts empatam. O que muda tudo é a qualidade do texto: **−33% de acerto com OCR**, e
sempre o mesmo erro — o relatório técnico classificado como contrato de prestação de serviços.
O ruído empurrou uma decisão que já era limítrofe: um documento que *menciona* contratos passou a
*ser* um contrato.

Na extração o OCR custou zero: 77% limpo, 77% sujo, em todas as variantes.

**Implicação:** investir em prompt de extração enquanto a classificação erra é otimizar a etapa
errada. Uma classificação errada zera a extração inteira, por melhor que ela seja.

## Resultado 2 — o teto de 77% não é culpa do prompt

Acerto por campo, somando todas as variantes e as duas entradas:

| Campo | ok | errado | faltou |
|---|---|---|---|
| parte_reveladora | 16 | 0 | 0 |
| parte_receptora | 16 | 0 | 0 |
| prazo_vigencia | **16** | 0 | 0 |
| foro | 16 | 0 | 0 |
| multa | 16 | 0 | 0 |
| contratante / contratada | 16 | 0 | 0 |
| vigencia_inicio / vigencia_fim | 16 | 0 | 0 |
| valor | 16 | 0 | 0 |
| **data_assinatura** | 2 | **30** | 0 |
| **data_validade** | 0 | 0 | **16** |

Tudo acerta, sempre. Duas exceções, sistemáticas e idênticas em todos os prompts:

**`data_assinatura` — 30 erros de 32, e nenhum é erro de leitura.** O modelo devolveu
`"09 de junho de 2026"` e `"15 de janeiro de 2026"`. Achou a data certa todas as vezes; não a
normalizou. O campo declara `type: "date"` e nenhum prompt diz o que fazer com essa declaração.

**`data_validade` — 16 faltas de 16.** Exige aritmética (assinatura + prazo). Só o prompt de
produção pedia isso, e pedia dentro do bloco NDA-específico.

**A armadilha dos prazos não pegou ninguém.** `prazo_vigencia` fez 16/16 porque a `description`
do campo diz *"não confundir com prazos de obrigações específicas previstas dentro dele"* — e isso
é **dado configurado pelo tenant**, não instrução hardcoded no prompt.

## Resultado 3 — alucinação separa os prompts; precisão não

Na rodada anterior, com o modelo grande e um documento negativo:

| Variante | Acerto | Campos inventados no documento negativo |
|---|---|---|
| mínimo | 58% | **12 de 12** |
| genérico | 94% | 0 |
| evidência-primeiro | 100% | 0 |

O prompt mínimo, diante de um relatório técnico avaliado contra campos de contrato, preencheu
**todos** os campos: inventou contratante, contratada, vigência e valor. Num produto onde alguém
decide com base no metadado extraído, isso é pior do que não extrair.

Exigir trecho literal antes de escrever o valor elimina isso — e é instrução **genérica**.

## Recomendação

### 1. Trocar as dicas por tipo por duas capacidades genéricas

`server/ai/utils/extractorPrompt.ts` injeta hoje ~30 linhas de instrução específica de NDA
(`confidentialityExtractionHints`), e `server/ai/utils/documentClassHeuristics.ts` tem termos de
recuperação, campos de parte e augmentação de classe hardcoded para confidencialidade. Isso não
escala para "todo tipo de documento" — seria um bloco por classe.

Os dados dizem que também não é necessário. O que o prompt genérico precisa ganhar:

- **Normalização pelo `type` do campo.** `date` → `yyyy-mm-dd`; `number` sem separador de milhar;
  e assim por diante. Resolve os 30 erros de `data_assinatura` e vale para qualquer tipo documental.
- **Cálculo de valor derivado** quando houver âncora e termo relativo, citando no snippet que foi
  calculado. Resolve `data_validade` e serve a contrato, apólice, garantia, licença — não só NDA.
- **Disciplina de evidência** (achar o trecho literal antes de escrever o valor), que já se mostrou
  o antídoto contra alucinação.

Nada disso menciona tipo de documento. Tudo que é específico continua vindo de `description`,
`aliases`, `keywords` e `negativeKeywords` — configurados pelo tenant, coerente com o escopo do
produto de que a configuração de acesso e de regras é do cliente.

### 2. Priorizar a classificação sobre a extração

O OCR custa 33% de acerto na classificação e 0% na extração. E o erro é sempre o mesmo tipo:
confundir documento que *fala sobre* um assunto com documento que *é* daquele tipo. Vale endereçar
explicitamente no prompt do classificador, de forma genérica.

### 3. Medir com Vision de verdade

A degradação aqui é simulada. Basta o service account em `deploy/secrets/gcp-vision-sa.json` e
`VISION_OCR_ENABLED=true` para a bancada rodar sobre a saída real do OCR.

## Como reproduzir

```bash
# textos já extraídos em logs/bench/{nda,contrato,relatorio}.txt
BENCH_MODELS=llama-3.1-8b-instant BENCH_REPS=1 BENCH_INPUTS=limpo,ocr \
  node scripts/bench-extractor-prompts.mjs
```

O modelo `llama-3.3-70b-versatile` bate em rate limit (429) ao varrer todas as combinações em
sequência; rode-o separado e com menos repetições.

## Erros cometidos nesta bancada, para não repetir

1. **Documento inteiro no prompt** → `413 Request too large` no modelo pequeno. O pipeline fatia;
   a bancada tem de fatiar igual, senão mede outra coisa.
2. **Abstenção correta contada como erro.** O modelo devolve a string `"null"`, não `null` JSON.
   Comparar cru marcou 12 acertos como falha e teria invertido a conclusão sobre o teste negativo.
3. **Rate limit virando zero silencioso**, que a média depois lia como prompt ruim. Hoje há backoff.
4. **Variantes NDA-específicas na primeira versão** (few-shot com exemplo de NDA, desambiguação
   citando "não concorrência"). Pontuavam bem e não provavam nada: não sobreviveriam a uma nota fiscal.
