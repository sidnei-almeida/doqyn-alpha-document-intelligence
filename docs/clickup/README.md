# Bootstrap ClickUp — DoQyn

Material pronto para usar o ClickUp como PM + Brain².

## Arquivos

| Arquivo | Uso |
|---------|-----|
| [DOQYN_CLICKUP_BOOTSTRAP_DOC.md](./DOQYN_CLICKUP_BOOTSTRAP_DOC.md) | Colar como **Doc** no Space DoQyn |
| [DOQYN_CLICKUP_BRAIN_PROMPT.md](./DOQYN_CLICKUP_BRAIN_PROMPT.md) | Colar no **Brain / Chat** (após o Doc existir) |

## Passo a passo (5–10 min)

1. No ClickUp: Space **DoQyn** (ou crie um).
2. **Doc** → novo documento → cole o conteúdo de `DOQYN_CLICKUP_BOOTSTRAP_DOC.md`.
3. (Opcional) Anexe ou linke o PDF `../Documentacao_DoQyn_Alpha_AUH.pdf`.
4. Abra o **Brain** / Chat do workspace.
5. Cole o prompt de `DOQYN_CLICKUP_BRAIN_PROMPT.md` e **mencione o Doc** criado.
6. Revise o outline → aprove criação das tasks.
7. Ajuste P0 (bugs do browser) na lista Bugs.

## Custom fields sugeridos (criar 1x)

- **Área:** Auth | Alpha-API | Alpha-UI | Infra | Docs | IA | Security  
- **Repo:** doqyn-auth-service | doqyn-alpha-document-intelligence | ambos  
- **Release:** Alpha estável | Alpha+ | Beta | Prod  
- **Prioridade:** P0 | P1 | P2 (ou use Priority nativo do ClickUp)

## Dica

A IA do ClickUp trabalha melhor com o Doc como fonte. Se o Brain inventar Keycloak/Mongoose/features shipped, apague — o Doc manda na seção “Fora de escopo” e “O que já funciona”.
