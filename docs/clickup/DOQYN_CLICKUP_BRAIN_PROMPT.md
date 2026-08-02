# Prompt — ClickUp Brain (gerar roadmap + backlog DoQyn)

Copie **tudo abaixo da linha** para o Chat / Brain do ClickUp, depois de ter criado o Doc com o conteúdo de `DOQYN_CLICKUP_BOOTSTRAP_DOC.md` (e mencione esse Doc no prompt).

---

Você é o PM técnico do produto **DoQyn** (document intelligence + auth-service).

### Contexto obrigatório
Use **apenas** o Doc do workspace: **“DoQyn — Estado do produto (bootstrap ClickUp)”** (e anexos ligados a ele).  
**Não invente** features que a seção “O que já funciona” marca como shipped.  
**Não** proponha Keycloak, Mongoose, nem access groups só no Mongo como fonte da verdade.

### Objetivo
Criar a estrutura inicial de PM neste Space:

1. Confirme/crie estas **Listas** (se não existirem):
   - Product Roadmap  
   - Engineering Backlog  
   - Bugs / Incidents  
   - Tech Debt  
   - Ops / Deploy  

2. Crie **épicos** na Product Roadmap (um card/task por épico), com descrição curta e release alvo:
   - Alpha estável  
   - Alpha+ E-mail  
   - Notificações (e-mail primeiro; WhatsApp depois)  
   - Beta privada  
   - Migração legado (`keycloakUserId`, companies/document_classes, temporary-auth)  
   - Prod VPS  

3. Quebre em **tasks** (Engineering Backlog + Tech Debt), cada uma com:
   - Título claro  
   - Descrição (o quê / por quê / critério de aceite)  
   - Prioridade **P0 / P1 / P2** (conforme o Doc)  
   - Custom fields se disponíveis: Área, Repo, Release  
   - Lista correta (feature → Engineering; dívida → Tech Debt; infra → Ops)  
   - Estimativa em story points **só se** você tiver certeza; senão deixe em branco  

4. Crie **3–5 milestones** na Timeline (Alpha estável → Alpha+ e-mail → Beta → Prod).

5. Na lista **Bugs / Incidents**, crie **1 task template**:  
   “Triagem bugs Alpha (browser) — preencher após testes do Sidnei”  
   com subtarefas: Login/UI · Upload/IA · Assinaturas · Governança · Auth OAuth.

6. Gere um **Doc filho** chamado “DoQyn — Plano gerado pelo Brain (revisar)” com:
   - Tabela épico → tasks  
   - O que foi **propositadamente omitido** (já shipped / fora de escopo)  
   - Riscos e dependências (ex.: SMTP depende do gestor Hostinger ou conta Resend)

### Regras de qualidade
- Máximo **35 tasks** na primeira geração (evitar explosão).  
- Preferir tasks **acionáveis em 1–3 dias**.  
- Agrupar micro-itens legados em 1–2 tasks de “cleanup”, não 20.  
- Se algo no Doc estiver ambíguo, crie uma task de **descoberta** (spike) em vez de inventar escopo.  
- Ao final, peça minha revisão: liste o que eu deveria **apagar** ou **fundir** primeiro.

### Idioma
Português brasileiro. Tom profissional e direto.

### Primeira resposta esperada
Antes de criar tudo em massa: mostre um **outline** (lista de épicos + títulos das tasks propostas).  
Espere meu “pode criar” — **a menos que** o ClickUp neste workspace já permita criar direto e eu tenha dito “criar agora”.  
Neste workspace: **criar agora** os itens após o outline numa segunda mensagem sua, se a UI permitir action; caso contrário, deixe o outline + texto pronto pra eu confirmar.
