---
phase: 05-telefone-por-pais-integracao-no-cadastro
plan: 03
subsystem: api
tags: [phone, e164, server, contactNormalize, node-test]

# Dependency graph
requires:
  - phase: 05-telefone-por-pais-integracao-no-cadastro
    provides: "Plan 05-01 phone.ts registry (client-side reference for BR/PY/US shapes, not directly imported by server code)"
provides:
  - "Multi-country E.164 normalization in server/utils/contactNormalize.ts (BR 55, PY 595, US 1) without blindly assuming +55"
  - "extractRecipientPhoneCountryCode and maskRecipientPhoneForDisplay generalized for 55/595/1"
  - "Regression + PY/US + no-double-prefix coverage in tests/contact-recipient-phone.test.ts"
affects: [share/signature/invite/access-request recipient-phone consumers, doqyn-auth-service env-sync N/A]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dial-code detection ordered most-specific-first (595 len>=12, then 55 len>=12, then 1 len===11) before falling back to length-based heuristics"

key-files:
  created: []
  modified:
    - server/utils/contactNormalize.ts
    - tests/contact-recipient-phone.test.ts

key-decisions:
  - "ensureBrCountryCode checks for an unambiguous 595-prefixed shape (len>=12) before the existing 55-prefixed check, then falls back to the pre-existing BR 10-11 digit convenience prefix — bare US numbers are intentionally NOT special-cased here since a BR national 11-digit number can legitimately start with '1' (DDD 11); US disambiguation only happens via the explicit '+' path"
  - "extractRecipientPhoneCountryCode checks 595, then 55, then 1 (len===11) before falling back to the original length-based slice heuristic, preserving prior behavior for any other shape"
  - "maskRecipientPhoneForDisplay branches per country (PY: '+595 <area2> *****-<last4>', US: '+1 (<area3>) *****-<last4>') ahead of the existing BR branch and generic fallback"

patterns-established:
  - "Known dial codes are module-level constants (BR_COUNTRY_CODE/PY_COUNTRY_CODE/US_COUNTRY_CODE) checked in most-specific-first order across normalize/extract/mask, avoiding duplicated magic strings"

requirements-completed: [TEL-03]

# Metrics
duration: 8min
completed: 2026-07-17
---

# Phase 5 Plan 3: Server-side multi-country phone normalization (TEL-03) Summary

**Generalized `server/utils/contactNormalize.ts` to normalize/extract/mask E.164 phone numbers for BR (+55), PY (+595), and US (+1) without blindly prepending 55 to numbers that already carry a known dial code.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-17T23:06:00Z
- **Completed:** 2026-07-17T23:14:54Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `ensureBrCountryCode` no longer double-prefixes 55 onto numbers already starting with a known dial code (55 or 595); BR convenience for bare 10-11 digit national numbers preserved unchanged
- `extractRecipientPhoneCountryCode` recognizes 595 (len>=12), 55 (len>=12), and 1 (len===11) in that priority order, falling back to the original length-based heuristic for anything else
- `maskRecipientPhoneForDisplay` produces country-specific masks: `+55 54 *****-9999`, `+595 98 *****-4567`, `+1 (202) *****-0123`
- `tests/contact-recipient-phone.test.ts` extended from 5 to 11 assertions (`it` blocks), covering PY/US normalization+masking, no-double-prefix for explicit `+55`, no-55-prefix for a bare 595-led number, and reaffirming the BR bare-11-digit convenience — all green, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Generalize normalization, country extraction, and masking for 55/595/1** - `cff10d7` (feat)
2. **Task 2: Extend contact-recipient-phone tests for PY/US and no-double-prefix** - `cb5ddb4` (test)

**Plan metadata:** (this commit, docs: complete plan)

_Note: tasks were carried out implementation-first then test-extension-second per the plan's own explicit two-task split (Task 1's `<verify>` is a `tsc` compile check, Task 2 is the dedicated test-authoring task), not a strict per-task RED/GREEN cycle._

## Files Created/Modified
- `server/utils/contactNormalize.ts` - added `PY_COUNTRY_CODE`/`US_COUNTRY_CODE` constants; generalized `ensureBrCountryCode`, `extractRecipientPhoneCountryCode`, `maskRecipientPhoneForDisplay` for BR/PY/US; `parseOptionalRecipientPhone`, `isValidWhatsapp`, `INVALID_RECIPIENT_PHONE_MESSAGE` untouched
- `tests/contact-recipient-phone.test.ts` - added 6 new `it` blocks (PY explicit, US explicit, no-double-prefix BR, no-55-prefix on bare 595, BR bare-11-digit reassertion, PY/US mask-only assertions); all 5 original `it` blocks kept verbatim

## Decisions Made
- Bare (no `+`) 11-digit numbers remain BR-first by design — the plan's own ambiguity note (BR DDD-11 vs US 1+10) is resolved by requiring an explicit `+` or already-dial-code-prefixed shape for non-BR bare input; this matches the client-side contract from 05-CONTEXT.md where PY/US inputs are sent with an explicit dial code.
- Dial-code checks are ordered 595 → 55 → 1 in all three functions to avoid a shorter prefix (e.g. a hypothetical future '5' code) shadowing a longer, more specific one; only 55/595/1 exist today so no shadowing conflict currently applies, but the ordering is defensive.

## Deviations from Plan

None - plan executed exactly as written. `ensureBrCountryCode`'s existing `startsWith(BR_COUNTRY_CODE)` check (no length gate) was preserved as-is per the plan's action instructions, and the new PY check was added ahead of it with an explicit `length >= 12` gate as specified.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TEL-03 requirement satisfied; `contactNormalize.ts` is ready for any future generalization of share/signature/invite/access-request phone inputs (explicitly deferred per 05-CONTEXT.md, out of scope for this plan).
- No blockers identified. Server-side E.164 handling now matches the client-side `phone.ts` registry's country set (BR/PY/US) without needing to import it (server stays decoupled from `src/`).

---
*Phase: 05-telefone-por-pais-integracao-no-cadastro*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: server/utils/contactNormalize.ts
- FOUND: tests/contact-recipient-phone.test.ts
- FOUND: commit cff10d7 (Task 1)
- FOUND: commit cb5ddb4 (Task 2)
