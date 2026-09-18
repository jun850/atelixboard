# Shared API and execution contracts

Status: proposed. This is the contract authority for [frontend](FRONTEND-PLAN.md), [backend](BACKEND-PLAN.md) and [companion](DESKTOP-COMPANION-PLAN.md). Validate real provider/runtime APIs before generating implementation types. The types below describe interfaces, not deployed code.

## Ownership and transport

Boardy API calls carry a Supabase access token; verify it server-side and derive the user ID. Never accept a caller-supplied owner ID as authorization. The companion uses an owner-bound, short-lived permit plus its local pairing token. No browser receives provider secrets, Vault references or a service-role credential.

Use Edge Functions as the custom HTTP API. Proposed function namespaces are `ai-connections`, `ai-generate` and `ai-templates`. SSE uses authenticated `fetch` streaming, not a query-string bearer token. Desktop bridge calls use the same generation/result schema but different authentication. Ordinary remote board membership remains the existing authorization model; this feature does not invent project roles absent from the implementation.

## Shared interface fields

| Type | Required information |
| --- | --- |
| ConnectionDescriptor | Opaque ID, provider (`openai`, `anthropic`, `codex`), transport (`api`, `local`), display label, status, credential revision for cache invalidation; masked suffix only for API keys |
| ModelDescriptor | Exact model ID, display name, connection ID, discovered-at time, availability, input/output modalities, structured-output support, optional reasoning choices/context/output limits; unknown capabilities explicitly nullable |
| TemplateDefinition | Stable ID/version, category/tags, parameter schema/defaults, content schema, builder identifier, preview fixture and validation rules |
| PersonalTemplate | ID, title, category, format version, native-element snapshot, revision, timestamps; ownership derived from auth |
| GenerationRequest | Client request UUID, schema version, connection ID, exact model ID, optional supported reasoning setting, task (`board` or `ui`), prompt, optional template ID/version or personal-template reference/revision, parameters, bounded conversation, scope and base element versions |
| ContextSnapshot | Optional room ID, mode (`prompt_only`, `selection`, `frame`, `whole_board`), selected native elements/text, optional frame screenshot and its MIME/dimensions; no room key or unrelated files |
| BoardDraft | Draft ID, schema/template versions, base versions, proposed create/update/delete operations, summary, assumptions and validation result |
| UiDraft | Draft ID, source frame ID/base versions, validated complete HTML, dimensions, summary and assumptions |
| RunRecord | Run/request IDs, authenticated owner, transport, connection/model, lifecycle status, start/deadline/end, usage when available, bounded error code; no request or result content |

Updates/deletions may target only IDs in the supplied mutable scope. Created IDs are assigned/remapped by trusted code, not reused from model output. A result cannot set app state, ownership, arbitrary customData, files or external executable references. Scope expansion requires a new disclosed request.

## Operations

Paths below are relative to `/functions/v1/` and are proposed routes within each function.

| Method/path | Request | Response and constraints |
| --- | --- | --- |
| GET `ai-connections` | None | Safe owned connection descriptors |
| POST `ai-connections` | Provider, key, label | Validate discovery without a paid completion; save secret only on success |
| POST `ai-connections/{id}/test` | None | Connection/discovery status; does not claim every model can generate |
| PUT `ai-connections/{id}` | Replacement key, optional label | Validate replacement, atomically switch secret reference and credential revision |
| DELETE `ai-connections/{id}` | None | Disable immediately, revoke future use, remove owned Vault secret; idempotent |
| GET `ai-connections/{id}/models` | Optional explicit refresh | Aggregated paginated catalog, fetched-at and capability metadata; five-minute owner/credential-scoped cache |
| GET `ai-templates` | Cursor/limit, optional category/search | Owned metadata; paginated, no payload-per-card fetch |
| POST `ai-templates` | Name/category/sanitized snapshot | Stored personal template metadata; backend repeats validation |
| GET `ai-templates/{id}` | None | Owned snapshot and revision |
| PATCH `ai-templates/{id}` | Name/category, expected revision | Updated metadata or conflict; template replacement is not required in v1 |
| DELETE `ai-templates/{id}` | None | Delete owned snapshot; idempotent |
| POST `ai-generate` | GenerationRequest | API transport SSE; reserves user slot atomically before inference |
| POST `ai-generate/permits` | Request UUID, paired device ID, connection/model ID; no canvas payload | Short-lived local run permit and reserved run ID for the companion |
| GET `ai-generate/{runId}` | None | Owned metadata/status only; no result replay |
| POST `ai-generate/{runId}/cancel` | None | Durable cancellation signal; companion also receives a direct local cancel |
| POST `ai-generate/{runId}/finish` | Local run permit, terminal status, optional usage | Companion completion; cannot mutate scene or award access/credits |

Companion registration/revocation and permit exchange belong to `ai-connections`. A permit is signed, bound to user, device, request/run IDs and model, expires at the run deadline, and can be consumed only once locally. Revocation prevents renewal. The companion never receives the browser's refresh token. This mechanism gates ordinary product use; it cannot control a user's independent Codex usage outside Boardy.

## Streaming and run state

States: `running → completed | failed | cancelled | interrupted`. Expired leases become `interrupted`; terminal transitions are monotonic. `completed` means a valid draft was returned, not that it was applied to a board.

Each SSE event has `schemaVersion`, `runId`, monotonic `sequence`, `type`, and typed payload. Types: `started`, `progress`, `draft`, `usage`, `completed`, `error`, `cancelled`. Progress contains user-facing phase labels, not hidden reasoning. Emit at most one accepted final draft per run; refinements are new runs. HTML code may be shown as inert text during generation but must not execute before validation.

On stream loss, stop accepting events, cancel upstream where possible and mark interrupted. Do not auto-replay a chargeable request. Keep received valid previews locally; otherwise offer an explicit new attempt. Duplicate user/request IDs return the existing status/run ID without invoking a provider again. If a completed result was lost, metadata cannot reconstruct it; clearly offer regeneration as a new request.

Applying is a frontend scene transaction, not a backend mutation. Persist draft-application identity with inserted elements to prevent accidental repeat application in the normal client flow. One undo must revert the accepted transaction, including generated frames and bindings.

## Limits and policies

| Limit | Initial default |
| --- | --- |
| Concurrent runs | One per authenticated user across API and companion; atomic lease |
| Deadline | 90 seconds total including validation/repair; stop starting calls when remaining budget is insufficient |
| Model calls | Three maximum total; at most one is a repair call |
| Prompt | 16,000 Unicode characters |
| Conversation plus element/text context | 256 KiB serialized UTF-8, and within selected model token limits |
| Frame screenshot | One JPEG/PNG, at most 2 MiB decoded, longest edge at most 1600 px |
| Generated board | At most 300 elements including labels, connectors and frames |
| UI artifact | 256 KiB UTF-8 HTML; no binary media or remote assets |
| Output tokens | At most 16,000 total per run or the model's lower supported limit, including reported reasoning where applicable |
| Personal template | 300 elements and 512 KiB snapshot; 100 saved templates per user initially |
| Model cache | Five minutes; invalidate on key revision or runtime reconnection; manual refresh rate limited |
| Metadata retention | Run metadata/idempotency records 30 days; personal templates until deletion; no backend prompt/result history |

These operational defaults are implementation assumptions, not a paid allowance or guarantee of exact spend. Measure and deliberately revise them; never lift a limit silently. Subscription usage/cost can be unknown. Cache catalogs and batch DB work; never query once per element, token or template thumbnail.

## Errors

Use a stable `code`, safe message, `retryable` flag and request/run ID. Codes: `UNAUTHENTICATED`, `FORBIDDEN`, `CONNECTION_UNAVAILABLE`, `MODEL_UNAVAILABLE`, `MODEL_INCOMPATIBLE`, `CAPABILITY_UNKNOWN`, `RATE_LIMITED`, `LIMIT_EXCEEDED`, `RUN_IN_PROGRESS`, `INVALID_OUTPUT`, `CONTEXT_CONFLICT`, `PROVIDER_ERROR`, `DEADLINE_EXCEEDED`, `CANCELLED`, `INTERRUPTED`, `COMPANION_UNAVAILABLE`, `COMPANION_INCOMPATIBLE`.

Map provider errors without returning headers, credentials or raw content. Known incompatible models cannot start the incompatible operation; unknown capability models may be explicitly tried under validation. No automatic provider/model substitution. Changing providers does not automatically replay history.
