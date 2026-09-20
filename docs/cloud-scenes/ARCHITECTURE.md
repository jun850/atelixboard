# Cloud scene architecture

Boardy scenes are server-authoritative. Browser storage is not a scene source of truth. Opening `/app` resolves the `scene` query parameter, otherwise the most recent active scene, otherwise creates the user's first empty cloud scene.

## Data model

- `scenes` is the mutable scene identity and current-revision pointer.
- `scene_revisions` is append-only. Restore creates a new revision and never rewrites history.
- `scene_content_blobs` deduplicates gzip-compressed scene JSON by SHA-256.
- `scene_assets` describes uploaded, remote, CDN, generated, and document assets. `scene_asset_variants` holds thumbnails, previews, display copies, posters, and originals.
- `scene_revision_assets` pins revisions to the exact assets they need.
- `scene_audit_events` records actor and action. Only the scene owner can read audit/history. The API resolves actor IDs to each user's current email.
- `scene_command_receipts` makes create, revision, and restore idempotent.
- `ai_threads`, `ai_messages`, and `ai_drafts` keep BYO-model work in the workspace. Immutable personal-template revisions replace browser templates.

## Storage and delivery

All buckets are private: `scene-content` for gzip snapshots, `scene-staging` for short-lived direct uploads, and `scene-assets` for originals and variants.

Clients request an upload intent, upload directly, then finalize. Finalize hashes/promotes the object and queues inspection and derivatives. URL/CDN workers must enforce DNS/IP and redirect checks, byte limits, MIME sniffing, malware scanning, and timeouts before marking an asset ready.

The renderer requests a short-lived manifest and chooses the smallest suitable variant. Originals are reserved for export, deep zoom, and unsupported types. The compatibility client may include small Excalidraw file records in the gzip revision while the variant-backed renderer is rolled out.

## Concurrency and recovery

Commits carry `expectedRevisionNumber`. Stale clients receive `REVISION_CONFLICT` and reload/reconcile instead of overwriting. Mutations carry a stable request ID. Delete is soft delete; restore is owner-only. Garbage collection retains every blob and asset referenced by a revision or template.

## Authorization

RLS grants participant reads and owner-only audit/revert visibility. Multi-table writes use narrowly granted security-definer RPCs or authenticated Edge Functions. Provider credentials stay in Supabase Vault and never enter scene content, audit details, logs, or browser storage.
