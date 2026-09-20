# API contracts

**This is a proposed Boardy API, not an existing Excalidraw or Docmost HTTP API.** The machine-readable contract is [openapi.json](openapi.json), version `0.2.0-proposed`. It covers the initial workflow vertical slice. Membership administration, board-key distribution, file listings, billing, and deletion administration require a later contract before their respective phases ship.

## Standardization boundary

| Surface | Reuse | Boardy customization |
| --- | --- | --- |
| Canvas | Local Excalidraw editor props/API, native scene types, restore/export | Project relationships, selected-context publication, handoff UI |
| Documents | Docmost native editing/history and open-source services behind our custom bridge | Adapter, source version links, jobs, project-space mapping |
| Authentication/storage | Supabase supported token verification, RLS, private storage | Project ACL, immutable snapshots, workflow transitions |

Do not add custom editor endpoints where a native client API already exists. Do not rename Boardy routes as if they were supported upstream Docmost routes.

## Native Excalidraw contract

Use `onChange(elements, appState, files)`, `getSceneElements()`, `getAppState()`, `getFiles()`, `updateScene(...)`, native restore, and export helpers from the pinned local package. The repository's actual serialization signature is:

```ts
serializeAsJSON(
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
  type: "local" | "database",
): string
```

`local` includes relevant file data; `database` omits file payloads. Selection export must explicitly filter elements and assets before serialization. Never feed a full-board file map or app state blindly into a publication package. Render a matching preview with the native export helpers. Native scene version is informational, not Boardy's mutation revision.

## HTTP conventions

- Base path `/api/v1`; bearer token from Supabase Auth. Server verifies token and derives actor.
- UUID identifiers, UTC ISO-8601 timestamps, camelCase JSON fields. Database names remain snake_case.
- Every mutation requires `Idempotency-Key`. Scope receipts by actor, workspace, route including resource identity, and key. Retain 24 hours. Same key/body returns recorded response; different body returns 409 `IDEMPOTENCY_CONFLICT`.
- Handoff mutations require `If-Match: "7"`, where 7 is the last fetched revision. Missing header returns 428 `PRECONDITION_REQUIRED`; stale returns 412 `REVISION_CONFLICT`. Responses expose `revision`; an HTTP ETag may mirror it.
- Receipt lookup occurs before stale-revision validation so a retry of an already committed command returns its result. Never replay an expired download URL: expired receipt URLs return a specific expiry error and require a new key.
- Inaccessible resource IDs return 404; a visible resource with a forbidden operation returns 403. Lists return only permitted rows and use opaque cursors, default 20/max 100. Follow the official Docmost response/pagination conventions below.
- Error body uses the documented custom envelope below with `success: false`, matching HTTP status, and a structured `error`. Do not include tokens, room keys, signed URLs, or source text in errors.
- 429 uses `Retry-After`. Clients retry transient failures with capped backoff and the same idempotency key; never retry actor/state failures automatically.

## Command rules

| Command | Actor and precondition | Result |
| --- | --- | --- |
| Create project | Authorized workspace owner/member according to creation policy | Project and creator's owner membership, one transaction |
| Create draft | Project editor/owner; ready same-project snapshot; active assignee | Draft with immutable initial version |
| Replace content | Sender or project owner; draft/changes_requested only | Append version, increment revision; no in-place sent edit |
| Send | Sender/project owner; draft/changes_requested, complete version | Freeze current version, lifecycle sent |
| Accept | Assigned active editor/owner; sent | Accepted pointer = current version, execution not_started |
| Request changes | Assignee; sent; reason required | changes_requested with response event |
| Cancel | Sender/project owner; draft/sent/changes_requested | cancelled; accepted history cannot be cancelled |
| Set execution | Assignee; accepted | Update independent status; blocked requires explanatory note |
| Request document | Project editor/owner; accepted; matching revision and capability | 202 durable job tied to accepted version |
| Link document | Project editor/owner; accepted; verified configured project space | Verified canonical link, never arbitrary URL trust |
| Export Markdown | Project member; accepted | Deterministic export; no AI or Docmost dependency |

For P0, project creation is limited to workspace owners until workspace policy is implemented. System bootstrap creates the initial workspace through a controlled administrative path; open workspace creation is not implied by this API.

Material changes after acceptance create a successor via draft creation with `predecessorId`. Board and predecessor must belong to the same project. Document requests reference the accepted version, not whichever board state is currently open. File inputs must already be ready and either attached to that accepted version or explicitly selected and authorized for the new detail job; record the exact file-version set in the job.

## Upload protocol

Create an intent with purpose, declared MIME/size/hash. Server authorizes a generated object key and returns bounded upload credentials. Upload directly to private storage, then call complete. Completion validates actual size/hash/type, selection manifest where relevant, and scan state; it can return `validating`. Poll the intent only while visible, with exponential backoff capped at 30 seconds, and prefer invalidation events. `ready` returns a snapshot or file-version ID suitable for later commands. Rejected objects remain quarantined until cleanup.

For the first implementation, snapshot upload is a single bounded package containing manifest, native selection JSON, preview, and assets. The service safely validates and expands it into the documented snapshot paths, rejecting path traversal, archive bombs, mismatched hashes, and excessive expanded size. A 25 MiB expanded package limit applies initially. The signed object path is staging-only and never used directly by recipients. A dedicated multipart manifest protocol may replace packaging in a future contract revision.

Mint download URLs only for authorized, ready resources. `GET /projects/{projectId}/handoffs/{handoffId}/snapshot` returns short-lived preview, native scene, and asset URLs for the current authorized handoff version. It uses the same authorization boundary. A handoff response contains snapshot ID, never a durable public URL.

## Docmost adapter: internal, not HTTP routes

The adapter boundary needs these capabilities:

```ts
interface DocumentAdapter {
  verifyProjectSpace(projectId: string): Promise<SpaceAccessResult>;
  createDraft(input: {
    projectId: string;
    handoffVersionId: string;
    correlationId: string;
    title: string;
    markdown: string;
  }): Promise<CanonicalDocument>;
  resolvePage(
    projectId: string,
    externalPageId: string,
  ): Promise<CanonicalDocument>;
  reconcileCreate(correlationId: string): Promise<ReconciliationResult>;
}
```

These are **Boardy internal capability names**, implemented against our own community bridge rather than the packaged enterprise API. See [bridge-openapi.json](bridge-openapi.json) and [Open-source integration](DOCMOST-OSS-INTEGRATION.md). The bridge reuses pinned community services and independently implements service authentication, identity mapping, idempotency, and correlation lookup. They are not built-in community features.

Do not expose browser session credentials to a background worker or write native document tables from Boardy. A scoped, short-lived service assertion authenticates the worker to the bridge; the bridge separately authorizes the linked actor in the mapped workspace/space. Community login remains native. Markdown export/import works before this bridge is deployed.

## Response conventions aligned with Docmost

The official API specification reports version `1.1.0`; retrieved from the URL loaded by Docmost's API reference on 2026-09-16. It uses POST-based operations and success envelopes `{ data, success, status }`, with list data `{ items, meta }`. We adopt those envelopes for Boardy JSON responses and the custom bridge. `status` equals the HTTP status code; errors still use meaningful non-2xx HTTP codes. Downloads/Markdown are raw content exceptions.

```json
{
  "data": {
    "items": [],
    "meta": {
      "limit": 20,
      "hasNextPage": false,
      "hasPrevPage": false,
      "nextCursor": null,
      "prevCursor": null
    }
  },
  "success": true,
  "status": 200
}
```

List requests accept `cursor` or `beforeCursor`, mutually exclusive. The bridge uses POST action routes like Docmost. Boardy's existing proposed `/api/v1` resource routes deliberately retain GET/POST/PUT because conditional revisions and workflow commands are custom; this difference is documented rather than pretending to match upstream routes. Boardy's error envelope is our extension: `{ "data": null, "success": false, "status": 412, "error": { "code": "REVISION_CONFLICT", "message": "Review the latest version.", "requestId": "..." } }`. Do not assume this custom error shape is Docmost's native error shape.

## Example progression

```text
POST /projects/{projectId}/upload-intents
PUT  {returned staging upload URL}
POST /projects/{projectId}/upload-intents/{intentId}/complete
GET  /projects/{projectId}/upload-intents/{intentId}   → ready
POST /projects/{projectId}/handoffs                 → draft, revision 1
POST /projects/{projectId}/handoffs/{id}/decisions   → send, revision 2
POST /projects/{projectId}/handoffs/{id}/decisions   → accept, revision 3
GET  /projects/{projectId}/handoffs/{id}/export      → Markdown detail
POST /projects/{projectId}/handoffs/{id}/document-jobs → optional open-source bridge path
```

Use a distinct idempotency key per intended command, preserving it across that command's retries. Acceptance requires the recipient's token; the sender cannot perform the recipient step.
