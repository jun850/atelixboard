# Cloud scenes operations

## Release order

1. Apply migrations.
2. Deploy `scenes`, `scene-assets`, `ai-templates`, `ai-connections`, and `ai-generate`.
3. Configure `BOARDY_ALLOWED_ORIGINS` and confirm JWT verification.
4. Smoke-test with owner, editor/viewer, and outsider users.
5. Deploy the client to a bounded cohort, then expand after latency/error checks.

## Required background worker

Claim `scene_processing_jobs` in bounded batches with row locking. For remote imports, reject private/link-local/metadata IPs before and after redirects. Stream with a byte ceiling, inspect true MIME and malware status, then generate:

- images: 320 px thumbnail, 1280 px preview, 2560 px display;
- video: poster and bounded MP4/WebM display rendition;
- PDF/docs: first-page thumbnail and paginated preview metadata;
- unsupported files: metadata-only attachment with signed download.

Retries are exponential and capped at 10. Permanent failures set job and asset failure codes. Clients use Realtime or bounded visible-panel backoff, not unbounded polling.

## Retention and observability

- Keep soft-deleted scenes restorable for the configured retention window.
- Audit and revisions are immutable application records.
- Garbage collection computes reachability, marks candidates, waits a safety window, then removes explicit object paths.
- Alert on conflicts, upload failures, queue age, signed URL failures, function error rate, and p95 scene load latency.
- Never log scene bodies, provider keys, signed URLs, or document content.

## Validation gates

- `supabase db reset`
- RLS owner/editor/viewer/outsider and owner-only history/revert tests
- idempotency and stale-revision tests
- upload size/MIME, URL SSRF, gzip, and corrupted-blob tests
- typecheck, lint, unit tests, production build, desktop/mobile browser checks
