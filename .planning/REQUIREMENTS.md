# Requirements: Viewer — Detalhes standard metadata

## v1 Requirements

### Viewer details (VIEW)

- [ ] **VIEW-01**: Details panel surfaces curated **standard** metadata fields (canonical vocabulary), not an arbitrary blob dump.
- [ ] **VIEW-02**: Party fields (`parte_reveladora`, `parte_receptora`, and other mapped roles when present) appear with stable PT-BR labels.
- [ ] **VIEW-03**: Date fields (`data_assinatura`, `data_documento`, `data_emissao`, vigência) appear when present.
- [ ] **VIEW-04**: Validity shows absolute date when available; else inferred from anchor + prazo when both exist; else “não determinada”.
- [ ] **VIEW-05**: When validity is inferred, UI indicates inference (not presented as a raw extracted date).
- [ ] **VIEW-06**: Existing system block (category, uploader, created/updated, version) remains.

## Out of Scope

- Exclusive Documento ↔ Ficha main-area mode
- Changing AI extraction prompts (display-only milestone unless API gap blocks VIEW-0x)
- Audit hardening P1

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VIEW-01 … VIEW-06 | 1 | Pending |

## Definition of Done

- Detalhes usable as a quick ficha for NDA-like docs with standard fields
- Validity never invents a date without anchor + prazo (or explicit validity field)
