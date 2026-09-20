# Cloud API contracts

Edge Functions accept a POST envelope:

```json
{ "path": "scenes", "method": "GET", "body": {} }
```

Authentication is the Supabase bearer token. Errors are `{"error":"CODE"}`. Mutation request IDs are 16–100 URL-safe characters.

## Scenes (`scenes`)

- `GET scenes` — active scenes, newest first; `includeDeleted` includes trash.
- `POST scenes` — `{title, document, requestId}`; creates revision 1.
- `GET scenes/:id` — metadata, head revision metadata, decoded document.
- `PUT scenes/:id` — `{document, expectedRevisionNumber, requestId, changeKind?, changeSummary?, assetIds?}`.
- `PATCH scenes/:id` — `{action: "rename"|"delete"|"restore", title?, requestId}`.
- `GET scenes/:id/history` — owner-only revisions, audit, actor-email map.
- `POST scenes/:id/restore-revision` — `{revisionId, requestId}`; owner-only, creating a new head revision.

## Assets (`scene-assets`)

- `POST assets/intent` — `{sceneId, fileName, mediaType, byteSize}`; returns a 15-minute signed upload URL/token and asset ID.
- `POST assets/:id/finalize` — hashes/promotes staging and queues inspection.
- `POST assets/import-url` — `{sceneId, url, sourceKind, requestId}`; queues guarded URL/CDN ingestion.
- `GET assets/:id/access` — five-minute signed original and variant URLs.

## Personal templates (`ai-templates`)

- `GET templates` — private templates with current snapshots.
- `POST templates` — `{name, description?, category, document, requestId}`.
- `PATCH templates/:id` — metadata update or delete/restore action.

## BYO assistant (`ai-generate`)

Existing OpenAI/Anthropic connection contracts remain. When optional `sceneId` is supplied and accessible, prompt, sanitized context descriptor, response, provider/model, thread, and draft are stored in the private workspace. Keys remain Vault-only.

Stable errors: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `REVISION_NOT_FOUND`, `REVISION_CONFLICT`, `LIMIT_EXCEEDED`, and `CLOUD_STORAGE_ERROR`.
