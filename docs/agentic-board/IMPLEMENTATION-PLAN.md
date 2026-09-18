# Implementation sequencing and agent handoff

Status: proposed. This package is complete as a planning handoff; feature work and release verification remain unimplemented. Read [README](README.md) first.

## Work ownership

| Workstream | Owns | Must coordinate before changing |
| --- | --- | --- |
| Frontend | Gallery, forms, assistant, model selector, preview/apply, native builders, UI sandbox | Shared schemas/events, source scope/version checks, generated iframe behavior |
| Backend | Vault/RLS, connections, discovery, permits/leases, generation, template storage, retention | Shared schemas, model capabilities, template sanitization and lifecycle |
| Companion | Native app, runtime pin/configuration, pairing, local discovery/execution and installers | Permit contract, normalized events, cancellation, capability compatibility |
| QA | Fixtures, contract/security tests, journey matrix and evidence | Requirements and supported platform matrix |
| Coordinating agent | Contract decisions, integration sequence, gates and final report | Any behavior that changes the agreed user scope |

These are ownership assignments for future work; they do not require spawning agents or changing the current execution policy. Avoid concurrent edits to shared contracts, editor core or schema migrations without named ownership. UI/backend mocks must be generated from the agreed contracts, not invented independently.

## Milestones

### M0 — baseline and contracts

- Reinspect checkout, nested AGENTS instructions and provider documentation. Confirm existing encryption/persistence behavior and local development commands.
- Establish shared TypeScript schema/validation package, fixture format and contract version. Lock task/result/events, limits, error semantics, personal-template sanitizer and model capability handling.
- Validate feasibility of Codex runtime isolation on both operating systems before committing to a pinned binary. Record signing/distribution prerequisites.
- Exit: shared contract fixtures accepted by frontend/backend/companion; no unresolved secret/tool-boundary assumptions.

### M1 — template foundation and credential services

- Frontend: FE-01 and native layout builders for every catalog item; blank insertion, private preview and account-scoped local state.
- Backend: BE-01/02/04 migrations, Vault routines, connection management, dynamic model listing and personal-template storage.
- QA: catalog fixture matrix, RLS denial tests, model pagination/rotation/compatibility fixtures.
- Parallel boundary: frontend uses contract fixtures until backend endpoints pass ownership tests.
- Exit: all catalog templates insert manually, personal templates round-trip privately, keys cannot be exposed, model picker receives real discovered catalogs.

### M2 — API generation and controlled scene application

- Backend: BE-03/05 bounded provider calls, leases/idempotency, events, cancellation and future capability boundary.
- Frontend: FE-02/03, selected-context disclosure, dynamic user model choice, assistant/refinement, conflict handling and atomic apply/undo.
- QA: API generation for both providers with mocks plus bounded live smoke tests; scene/collaboration/reload/conflict verification.
- Exit: AB-04–09/11/15 met with private previews and no silent model or context changes.

### M3 — wireframe-to-UI

- Adapt ordinary/magic frames into the same request lifecycle. Generate bounded complete HTML documents.
- Replace executable streaming/pending scene behavior with private previews. Apply the hardened renderer on new and reopened/imported generated HTML.
- Exit: QA-17/18 pass, including adversarial requests; ordinary editor/URL embeds remain usable.

### M4 — native subscription connection

- Implement DC-01–04: packaged app, official local authentication, secure pairing, permit flow, runtime model list, execution and cancellation.
- Integrate companion status/model UI and the same shared draft validators.
- Exit: QA-21–24 pass with native platform evidence; installers signed/notarized and update path verified. Do not call a CLI-only build complete.

### M5 — end-to-end acceptance and rollout preparation

- Run the full QA matrix; document unsupported browser transport combinations and untested environments honestly.
- Review content-free telemetry, bounded PostgREST traffic, cache invalidation, retention, provider failures, account switching and cleanup.
- Prepare independent API/companion feature flags and rollback procedure. Flags disable new generations while preserving ordinary editing of accepted content.
- Exit: every released requirement linked to passed evidence. Any missing signing credential, provider access or runtime enforcement remains a specific release gate.

## Definition of done

All catalog templates work; user-selected discovered models are honored; credentials/contexts are private within documented boundaries; previews apply atomically; collaborator edits survive; UI execution is isolated; macOS/Windows companion behavior is verified; accessible states work; required QA evidence exists.

Implementation completion is distinct from production deployment. Do not deploy migrations/functions, publish installers or change marketing/billing without the applicable authorization. Never claim deployed status from local source or build evidence.

## Documentation maintenance

Change [API contracts](API-CONTRACTS.md) first when a shared behavior changes, then update the PRD, workstream plans and matching QA scenarios in the same change. Keep IDs stable. Record deliberate deviations and why they were necessary. Do not quietly replace dynamic discovery with a hardcoded model list, skip catalog entries, broaden context, weaken sandboxing or add a paywall.
