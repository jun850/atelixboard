# Backend agent plan

Status: proposed. Read [contracts](API-CONTRACTS.md) before implementing. Owns credential, authorization, discovery, generation and personal-template services; never applies changes directly to the encrypted board.

## BE-01: schema and credential ownership

Use additive Supabase migrations with explicit grants and RLS. Recheck Supabase CLI and current documentation before migration work. Do not mutate existing migration history or deploy as a side effect of implementation.

Proposed stores:

| Store | Data and access |
| --- | --- |
| `ai_connections` | Safe metadata, owner, provider, state, revision; owner-readable, backend-controlled mutations |
| Private credential mapping | Connection/owner to Vault secret reference; no client access |
| `ai_runs` | Metadata/lease/idempotency; owner-readable status, backend-only state changes |
| `personal_templates` | Owner, metadata, versioned sanitized snapshot; owner RLS and validation-backed mutations |
| `ai_devices` | Owned companion registration, public identity/pairing metadata, revocation; no Codex credentials |

Supabase Vault stores per-user API keys. Function secrets hold infrastructure keys and permit-signing material. Never create one environment secret per user or expose `vault.decrypted_secrets` through client grants. Privileged helpers must have fixed search paths, minimal privileges, revoked public execution and service-only callable entry points. Do not solve ownership checks by blanket service-role bypass.

Validate identity with Supabase server auth, then enforce ownership on every lookup before resolving secrets. New connections validate using model discovery without a paid inference probe. Replace atomically after successful validation; failures keep the old connection. Disconnect disables first and deletes the secret with recoverable cleanup handling; abort active use where possible, acknowledging already-dispatched requests may incur usage. Redact key values/suffix context from exception payloads and provider headers.

## BE-02: model discovery and adapters

Implement a shared adapter contract: list models, describe known capabilities, generate validated output, cancel, and normalize usage/errors. OpenAI uses Responses; Anthropic uses Messages. Paginate model discovery fully with a bounded page/cursor guard. Do not treat every listed model as compatible with those generation endpoints.

Cache by owner, connection ID and credential revision for five minutes; coalesce concurrent fetches. Explicit refresh invalidates that entry. No cross-user catalog cache leaks. Capability data comes from provider/runtime metadata and a maintained compatibility descriptor where necessary; it is not a fixed list of permitted commercial models. Unknown models remain explicitly unverified. Do not infer vision/JSON support from a model name alone.

Known unsupported modality/endpoint combinations fail before generation. For supported text models without native structured output, validate parsed JSON and permit one repair. Model access errors update safe status and ask for reselection; never fall back. Do not make an inference request per model to populate the picker.

## BE-03: bounded execution

Atomically reserve the user slot and request UUID using a database transaction/guarded routine. The same slot covers API and companion permits. Store a request identity fingerprint only as needed for conflict detection; do not persist raw context. A repeated UUID cannot create another paid call. Deadline expiry releases the slot even after a process crash.

Validate request size, template version, model choice and owned connection before reading a secret. For requests with a room ID, check existing board membership. The backend cannot verify the encrypted scene's plaintext contents or versions; final scope/version checks belong to the browser. Local unsaved boards may omit room ID and still require account auth.

Run bounded planning/content generation with approved output schemas; deterministic code validates structure and builds the draft. Enforce the total budget across planning, content and repair, not separately per call. Do not expose provider tools for browsing, filesystem, code execution or media generation. Treat board text as data even when it contains instructions.

Stream progress and validated final output. Abort on client disconnection and check durable cancellation between calls and at a bounded interval while streaming; never poll per token. Do not auto-retry an ambiguous provider failure because it may already have incurred charges. Surface explicit retry as a new run. No long-lived worker or arbitrary execution service is required for this bounded API path; confirm selected deployment limits support the deadline before release.

## BE-04: templates, privacy and storage

Built-ins are versioned source assets, not database-generated runtime code. Personal templates are owner-private snapshots under RLS, with native-type/metadata sanitization repeated server-side. Save uses an explicit disclosure: selected plaintext leaves the encrypted scene and is stored as a private account template protected by access control. Do not describe it as end-to-end encrypted.

List metadata with pagination in one query; return payload only on detail retrieval. Update checks expected revision. Delete removes the snapshot and associated server-owned metadata without touching inserted scenes. Authentication deletion must clean up owned Vault secrets as well as ordinary rows; design this explicitly because Vault secrets are not automatically covered by an auth-user foreign key.

Run records expire after 30 days through a bounded cleanup job. No server prompt, conversation or HTML archive. Provider retention is governed by the user's provider/account; do not promise zero provider retention. Locally stored history is a frontend responsibility.

## BE-05: permits, future premium and operations

Authenticate and verify companion ownership before signing the limited run permit. No canvas content or provider subscription token is needed in the permit API. Signed claims bind device/user/request/model/expiry. Local completion reports settle status only; they cannot create entitlement, payment credit or authoritative provider billing.

Implement one `canUseAi` policy boundary that currently permits authenticated users, subject to feature flags and operational limits. Future premium checks extend it; do not trust client flags, model output or user-editable auth metadata as entitlement. Enforce policy before secret access/permit issuance.

Track metadata-only latency, failure category, provider/model, validation outcome, cancellations and usage availability. Never log authorization headers, key values, room keys, prompts, screenshots, drafts or HTML. Review invoked code for PostgREST call counts: batch authorization/lease operations, cache catalogs, avoid N+1 template calls and token-level writes.

Verify migrations/RLS locally, run security advisors where available, and execute QA-06–13, QA-19–25 and QA-27. Capture unauthorized direct-API tests, not only successful UI flows. Keep production migration/deployment a separate explicitly authorized action.
