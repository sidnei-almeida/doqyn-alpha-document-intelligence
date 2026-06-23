# Roadmap — DOQYN Alpha → Beta

## Fase Alpha (atual)

- [x] Estrutura do projeto e design system
- [x] Tela de login (mock + preparação Keycloak)
- [x] Tela de envio de documento
- [x] Telas de documentos, versionamento e auditoria
- [x] API `/api/health` e endpoints básicos
- [x] Modelos MongoDB e serviços simulados
- [x] Documentação inicial

## Fase Alpha+ (próximas 2–4 semanas)

- [ ] Integração real com Keycloak (OIDC/SSO)
- [ ] Conexão MongoDB Atlas em ambiente de staging
- [ ] Upload real com storage simulado em disco
- [ ] Testes automatizados (unit + integration)
- [ ] CI/CD com GitHub Actions

## Fase Beta

- [ ] Google Document AI — extração de metadados real
- [ ] AWS S3 como storage primário
- [ ] Cloudflare R2 como storage de backup/CDN
- [ ] Motor de regras de acesso por grupo/área
- [ ] Notificações de revisão pendente
- [ ] Comparação avançada entre versões

## Fase Produção

- [ ] Multi-tenant completo
- [ ] Billing e planos
- [ ] Painel administrativo
- [ ] RAG com Groq para consulta inteligente
- [ ] Conformidade (LGPD, retenção, exportação)
- [ ] SLA e monitoramento (Datadog/Sentry)

## Prioridades técnicas

1. **Segurança** — autenticação, autorização, auditoria
2. **Rastreabilidade** — nenhum documento deletado, histórico completo
3. **Simplicidade** — interface corporativa, sem exposição de infraestrutura
4. **Extensibilidade** — serviços desacoplados para integrações futuras
