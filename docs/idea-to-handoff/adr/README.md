# Architecture decisions

Status: proposed for implementation. These decisions record the recommended direction; unresolved integration gates remain explicit.

| Decision | Chosen direction |
| --- | --- |
| ADR-001 | Idea → handoff → detail is the primary product sequence |
| ADR-002 | Preserve native Excalidraw; add a Boardy workflow sidecar |
| ADR-003 | Publish selected context explicitly across the encryption boundary |
| ADR-004 | Docmost Community owns document content; our custom bridge connects it |
| ADR-005 | Durable Postgres commands/outbox; realtime is advisory |
| ADR-006 | Project ACL with matched document spaces; no initial guests |
| ADR-007 | Immutable file versions and handoff snapshots |

## ADR-001: Handoff before documentation

**Context:** The product must turn an idea into a concrete next step without premature writing.

**Decision:** Require a small handoff, an owner, and acceptance. Offer detailed document creation after acceptance. Existing supporting material can be linked earlier, but a new document is never required.

**Alternatives:** Document-first intake makes the recipient wait for a specification; auto-generating a document for every board creates noise.

**Consequence:** Measure accepted next steps, not documents generated. Handoff and execution states remain separate.

## ADR-002: Native editor plus workflow sidecar

**Context:** This repository already uses an Excalidraw fork and native formats.

**Decision:** Reuse native scene serialization, editor APIs, rendering, reconciliation, and export. Put project relationships, assignments, immutable versions, and document references in Boardy tables and app surfaces.

**Alternatives:** Forking editor internals for business state complicates upstream maintenance; an iframe-only integration limits coherent selection workflows.

**Consequence:** Workflow changes usually stay outside core packages. Element customData may hold a hint but cannot be authoritative. Validate actual local signatures before upgrading upstream.

## ADR-003: Explicit selected-content publication

**Context:** Existing room scenes/files are browser-encrypted. Servers cannot responsibly generate documents from their ciphertext.

**Decision:** The browser prepares a selected-content preview and publishes that approved subset as a server-readable project snapshot. Keep the original board encrypted and never transmit its key to the workflow service.

**Alternatives:** Server decryption changes the existing privacy promise; browser-only generation complicates durable workflow and is a possible future mode; silently uploading the full board is unacceptable.

**Consequence:** Handoff snapshots have different confidentiality semantics from the source board. Publication needs clear audience disclosure, immutable assets, and strict project ACL. Users who decline can keep using the encrypted canvas.

## ADR-004: Community core with a maintained open-source bridge

**Context:** Docmost Community provides the document editor and diagram support, while the packaged external API-key feature is paid. The product must run without enterprise features. The official API reference remains useful for response and pagination conventions.

**Decision:** Keep Docmost separately deployed and authoritative for document bodies/history. Boardy stores links, source versions, and job state. Begin with Markdown export; enable server-side integration only with our tested custom bridge, source-license compliance, and verified identity/permissions.

**Alternatives:** Depending on enterprise API keys violates the deployment constraint. Direct database writes or browser-session scraping bypass stable integration boundaries. Rebuilding the editor duplicates substantial work. A small maintained fork carries upgrade and AGPL obligations but keeps our own integration contract explicit. Bidirectional body sync remains out of scope.

**Consequence:** Acceptance works during provider outages and without the bridge. The fork invokes core services behind our own auth and retains native checks; it does not unlock enterprise code. Manual community login plus verified account linking comes first, and any future seamless session bridge is custom work. No automatic claim that Supabase login signs a user into Docmost. Initial document opening uses the native top-level experience; embed only after cookie, CSP, authentication, and websocket validation.

## ADR-005: Transactions, outbox, and advisory realtime

**Context:** A sent/accepted handoff must survive retries and disconnections; external services cannot join a database transaction.

**Decision:** Commit state, immutable version pointers, audit, idempotency receipt, and outbox together. Use explicit revisions for conditional writes. Workers use leases and bounded retries. Realtime only invalidates client views.

**Alternatives:** Broadcast-only state loses events; synchronous provider creation makes handoffs depend on provider uptime; naive retries can duplicate documents.

**Consequence:** Ambiguous external results need reconciliation. Exactly-once external delivery is not assumed. Excalidraw scene version remains separate from workflow revision.

## ADR-006: Project ACL and document-space parity

**Context:** Legacy room self-enrollment is not a sufficient private-project access model. Separate systems can drift.

**Decision:** Require explicit project membership with owner/editor/viewer roles. Map integrated documents to a dedicated verified Docmost space. Check Boardy permissions on every command and upstream permissions through supported mechanisms. Initially exclude external guests and mixed private document subsets.

**Alternatives:** Broad workspace tokens without project checks leak content; merely hiding a link does not revoke upstream access; per-page exceptions add early complexity and may require paid features.

**Consequence:** Drift disables integration actions and triggers reconciliation. Revocation needs coordinated action in both systems and handling of cached sessions. Board access still also requires its encryption key.

## ADR-007: Immutable evidence and files

**Context:** The context a recipient accepted must remain stable as the source board changes.

**Decision:** Freeze selected native scene content and referenced asset versions at send. Store project file versions under immutable keys and link exact versions. Amendments produce successors rather than overwriting accepted context.

**Alternatives:** Live board pointers are easy but change history; copying every full board is wasteful and expands disclosure.

**Consequence:** Storage increases and requires retention/cleanup policy. UI labels source versions and dates. Deleting a file must respect retained handoff references until an explicit broader deletion.
