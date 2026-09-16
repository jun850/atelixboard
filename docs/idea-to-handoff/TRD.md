# Technical requirements

## Existing foundation

Boardy is a React/Vite application using a local Excalidraw fork, Supabase Auth, encrypted scene persistence, Storage, and private Realtime channels. Vercel currently serves a static application. Existing durable scene records contain ciphertext and IV; the browser has the room key. Current persistence uses read/reconcile/upsert, not atomic compare-and-swap. Current room self-enrollment is insufficient for the proposed project authorization model.

The proposed system adds a workflow service, project metadata, durable commands, and an optional document adapter. It does not replace Excalidraw's native editor or serialization.

## Component boundaries

| Component | Responsibility | Must not own |
| --- | --- | --- |
| Boardy web app | Canvas UX, client decryption, selection preview, workflow UI | Server secrets or upstream document credentials |
| Workflow API | Auth, project ACL, handoff transitions, file intents, idempotency | Full board decryption or native document CRDT state |
| Supabase Postgres | Workflow authority, immutable version records, audit, outbox | A second copy of editable Docmost document bodies |
| Supabase Storage | Existing encrypted board assets; separate published snapshots and project file versions | Public unauthenticated project objects |
| Worker | Scanning, document jobs, provider reconciliation, cleanup | User impersonation without explicit actor context |
| Docmost | Document editing, collaboration, history, its own attachments | Authoritative Boardy handoff state |

API can be deployed as authenticated Supabase Edge Functions behind a stable `/api/v1` gateway; sustained scanning/provider jobs require an appropriate worker. This is a proposed deployment choice that must be benchmarked. Do not put persistent Docmost/Postgres/Redis inside the existing static Vercel build. Deploy Docmost separately using its supported runtime, pinned image, persistent database, Redis, and storage.

## Security and privacy requirements

- Verify access tokens server-side; derive actor identity from the token, never a request field.
- Apply RLS to all exposed tables, project ownership to every foreign reference, and both read/write checks. A service credential is server-only and is not a substitute for explicit ACL checks.
- Prevent membership self-enrollment. Project invitations/membership changes require an authorized owner. Do not reuse legacy room membership as proof of project access.
- Keep existing encrypted boards encrypted. The user publishes only a previewed selection into a distinct server-readable snapshot. Reject room keys and arbitrary board ciphertext as document-generation input.
- Default document generation to the accepted published version and ready, explicitly selected project files. No hidden whole-board context.
- Authorize every file download; signed URLs have short lifetime. Removing membership cannot retract already downloaded files or instantly revoke an issued URL.
- Avoid token/content logging. Sanitize generated rich content and filenames. Treat document text, files, and AI output as untrusted inputs, never instructions to bypass authorization.
- Use Docmost Community with our independently implemented bridge, not the enterprise API-key system. The bridge invokes pinned core services with explicit actor and space checks. Configure a dedicated private project space and verify membership parity before exposing document links or enabling generation. See [Open-source integration](DOCMOST-OSS-INTEGRATION.md) for identity, public-sharing policy, and licensing boundaries.

## Consistency

All workflow state transitions, audit events, idempotency results, and outbox records commit in one database transaction. Use a monotonic workflow `revision` for compare-and-swap. The Excalidraw scene version is unrelated and must not be used as a transaction revision.

Uploads and external document creation cannot share a Postgres transaction. Use staged file intents and an outbox. Workers are at-least-once: handlers must be idempotent. A provider timeout after possible creation enters `needs_reconciliation`; do not blindly recreate a document. Exactly-once creation requires a verified upstream idempotency mechanism or reliable reconciliation and is not assumed.

Realtime announces invalidations after commit. Clients reload bounded authorized data; durable tables remain the authority. Reconnect uses a cursor/page refresh, not replay assumptions about ephemeral broadcasts. Use capped exponential backoff with jitter and stop on permission failures. Avoid per-card queries and unbounded polling.

## Native integration rules

Use `onChange`, `getSceneElements`, `getAppState`, `getFiles`, `updateScene`, native restore/export helpers, and the repository's actual TypeScript signatures. Native scene JSON remains the portable canvas format. Keep workflow relationships in sidecar tables. Optional element `customData` is a convenience hint, never an ACL or source of truth.

Use Docmost's community editor, history, and core services. Implement a narrow namespaced NestJS bridge in a maintained open-source fork. It owns a versioned integration contract and invokes core services with the same authorization checks as native controllers. Do not make Boardy depend directly on undocumented browser routes or write Docmost content tables externally. Keep native content/CRDT persistence intact. Internal services are not stable public APIs: pin the source commit and test the bridge on every upgrade. See [Open-source integration](DOCMOST-OSS-INTEGRATION.md).

## Performance and operations targets

Targets to validate in staging, not current guarantees: workflow reads p95 under 500 ms and commands under 1 second excluding upload/provider time; handoff first meaningful view under 2 seconds on an ordinary broadband connection. Paginate lists with default 20/max 100 records. Batch authorization/metadata lookups. Fetch document bodies only inside Docmost or explicit preview requests.

Proposed job policy: five retry attempts for safe transient failures with bounded backoff, ten-minute stale-job detection, and manual reconciliation for ambiguous provider results. Use a database lease or queue visibility timeout; no tight polling. Scan concurrency starts at two jobs per worker and is configurable.

Observe request/job IDs, error class, latency, queue age, provider health, and authorization failures. Alert on stuck jobs, failed backups, and sustained error rates. Separate operational logs from user-visible activity.

Recovery targets: workflow RPO 24 hours and RTO 8 hours until stronger requirements are justified. Test coordinated restore of metadata/object references and Docmost separately; these targets are not provided merely by selecting a vendor.

## Verification

Test cross-tenant isolation, invalid transitions, stale revisions, retry duplication, snapshot immutability, missing image assets, upload type/size violations, revoked membership, document-provider outages, ambiguous creation, and cleanup reconciliation. Verify keyboard, narrow-screen, empty/error, and loading states. Do not claim runtime readiness from documentation or typechecking alone.
