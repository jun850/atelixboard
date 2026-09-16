# Implementation plan

These phases are the order of work, not completed tasks. Do not start by embedding a second application or introducing AI.

| Phase | Deliverable | Exit condition |
| --- | --- | --- |
| 0. Confirm workflow | Observe 10 design partners; clickable idea-to-handoff prototype | Recipient understands next step; minimum form and audience wording tested |
| 1. Secure project foundation | Projects, membership, room binding, RLS, storage intents | Cross-project negative tests pass; self-enrollment cannot expose project content; legacy board behavior preserved |
| 2. Handoff vertical slice | Selection preview, publication, draft/send/accept/change flow, inbox | One real handoff survives reload, retry, conflict, and revoked access; docs never required |
| 3. Files and manual detail | Immutable file versions, scan/readiness, Markdown export, gated links, execution state | User can complete next action with optional supporting detail; failures understandable |
| 4. Docmost integration | Pinned deployment, custom open-source bridge, identity/space mapping, async jobs | Community-only build, custom bridge contract, identity linking, access parity, retries and reconciliation verified |
| 5. Commercial validation | Billing experiment, retention measurement, customer onboarding | Willingness to pay and repeat usage justify expansion; actual costs understood |

## First engineering slice

Create one project with owner/editor membership, a single board binding, and an accepted handoff with an immutable snapshot. Use existing UI primitives and editor APIs. A simple manual Markdown export completes the downstream detail path. Do not add full search, AI, billing, client guests, or broad document imports to this slice.

Before writing migrations, inspect current schema and deployment policies. Add new immutable migrations, generated types, and transactional commands. Keep app-specific code in the application layer. Follow repository guidance about ownerDocument/ownerWindow and type overrides.

## Open gates and who resolves them

| Gate | Decision owner | Required evidence |
| --- | --- | --- |
| ICP and paid pain | Product/founder | Observed repeated handoffs and purchase conversations |
| Legacy room control and key distribution | Engineering/security | Verified ownership/invite design and revocation tests |
| Publication disclosure | Product/security | Users understand selected content becomes server-readable |
| Community source/license boundary | Engineering/founder | Pinned core-only dependency review, retained notices, corresponding-source distribution plan for modified AGPL code |
| Custom bridge/core service mapping | Engineering | Pinned community source, tested actor/space authorization, native page creation and bridge OpenAPI contract |
| Identity and project-space parity | Engineering/security | Tested account provisioning, removal, and stale-session behavior |
| Worker and file scanner | Engineering/operations | Chosen runtime, bounded workload test, fail-closed handling |
| Retention/backup policy | Product/operations | Configured capabilities and successful restore drill |

The implementation uses AGPL community code and independently written bridge features. Do not import enterprise modules, remove paid-feature checks to activate enterprise functionality, or add an enterprise subscription as a prerequisite. Track source notices and corresponding-source obligations for the modified Docmost deployment. Build and test without paid credentials. Engineering compatibility and access-control gates remain; purchasing a license is not a phase.

## Release checklist

- Verify project authorization, negative cross-tenant cases, and assignee-only acceptance.
- Verify published preview matches snapshot and includes no full-board key/content leak.
- Verify every mutation is transactional and repeatable with the same idempotency key.
- Verify stale revision cannot overwrite an accepted version.
- Verify upload completion checks actual content and readiness before use.
- Verify no duplicate document on ambiguous provider retry; demonstrate reconciliation behavior.
- Verify keyboard, narrow-screen, loading, empty, error, and permission states.
- Verify query counts under realistic lists; avoid N+1 authorization or polling.
- Verify applicable repository checks for changed code. No implementation or deployment is implied by these docs.

## Agent handoff format

For each implementation change report: phase and requirement IDs, files changed, new schema/API impact, checks actually run, unverified layers, and remaining gates. Never label a feature complete solely because its documentation exists. Update these docs when an accepted implementation changes the contract.
