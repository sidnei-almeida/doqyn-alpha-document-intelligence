# Notas de Segurança — DOQYN Alpha

## Variáveis de ambiente

| Variável | Escopo | Notas |
|----------|--------|-------|
| `VITE_*` | Público (frontend) | Apenas configuração não sensível |
| `MONGODB_URI` | Backend | Nunca expor no frontend |
| `GROQ_API_KEY` | Backend | Integração futura |
| `GOOGLE_*` | Backend | Document AI |
| `AWS_*` / `CLOUDFLARE_*` | Backend | Storage futuro |

## Autenticação

- Modo mock é **apenas para desenvolvimento**
- Em produção, usar `VITE_AUTH_MODE=keycloak`
- Tokens devem ser validados no backend (a implementar na fase Alpha+)
- Sessão mock armazenada em `localStorage` — substituir por tokens HTTP-only na produção

## Upload de arquivos

- Validação de tipo MIME no backend
- Limite de tamanho a implementar (sugestão: 25 MB)
- Hash SHA-256 calculado para integridade
- Arquivos não são persistidos nesta fase alpha

## Auditoria

- Todos os eventos críticos devem gerar `AuditEvent`
- Campos: ator, ação, resultado, timestamp, documento
- Histórico imutável — sem delete de eventos

## MongoDB

- Apenas metadados — nunca armazenar binários
- Índices em `tenantId`, `status`, texto em `displayName`
- Soft delete via `deletedAt` (sem remoção física)

## Checklist pré-produção

- [ ] HTTPS obrigatório
- [ ] Rate limiting na API
- [ ] Validação de input com Zod em todos os endpoints
- [ ] CORS restrito ao domínio da aplicação
- [ ] Rotação de chaves de API
- [ ] Logs sem dados sensíveis
- [ ] Revisão de permissões por tenant
