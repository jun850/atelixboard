# Data model and storage

All new names and schemas below are proposed. Add immutable migrations only during an authorized implementation phase. Existing collaboration tables and files are not migrated by this documentation.

## Ownership

| Content | Authority | Storage |
| --- | --- | --- |
| Auth identity | Supabase Auth | Existing auth service |
| Legacy encrypted scene | Current Boardy scene mechanism | `board_scenes` ciphertext/IV |
| Legacy encrypted assets | Current Boardy file mechanism | Private `board-files`, existing 4 MiB limit |
| Project membership, workflow, references | Boardy | New Postgres tables |
| Published selection | Boardy immutable handoff version | Private snapshot object plus metadata |
| Project files | Boardy | New private bucket, immutable object keys |
| Editable detailed document/history | Docmost | Docmost database and native collaboration system |
| Docmost attachments | Docmost | Its configured persistent local/S3/Azure storage |

Do not store the full document body in both systems. Generated Markdown may be retained as an explicitly labeled immutable draft/export artifact; it is not the live Docmost document.

## Proposed relational entities

Use UUID primary keys for new entities, `timestamptz` timestamps, explicit foreign keys, and indexed project/workspace filters. Keep legacy room IDs as text.

| Table | Key fields and constraints |
| --- | --- |
| `workspaces` | id, name, created_by, created_at |
| `workspace_members` | workspace_id + user_id unique, role owner/member, active |
| `projects` | id, workspace_id, name, archived_at; composite unique(workspace_id,id) |
| `project_members` | project_id + user_id unique, role owner/editor/viewer; active workspace membership required |
| `project_boards` | id, project_id, legacy_room_id unique nullable, title, created_by; binding requires verified control, not knowledge of room ID |
| `handoffs` | id, project_id, board_id nullable, sender_id, assignee_id, lifecycle, execution_status, revision, current_version_id, accepted_version_id nullable, predecessor_id nullable |
| `handoff_versions` | id, project_id, handoff_id, sequence unique per handoff, title, next_action, success_criterion, context, due_at, assignee_id, snapshot_id, created_by, created_at; append-only |
| `published_snapshots` | id, project_id, source_board_id, source_scene_version informational, selected_element_ids, object_key, sha256, byte_size, format_version, published_by, published_at, state staged/ready |
| `project_files` | id, project_id, display_name, current_version_id, deleted_at |
| `file_versions` | id, project_id, file_id, object_key unique, sha256, byte_size, detected_mime, scan_status, created_by; immutable after ready |
| `handoff_file_refs` | project_id, handoff_version_id, file_version_id; exact immutable version, not current-file pointer |
| `document_links` | id, project_id, handoff_version_id, provider, instance_id, space_id, external_page_id, canonical_url, status, created_by; unique provider/instance/page |
| `document_jobs` | id, project_id, handoff_id, accepted_version_id, template, selected_file_version_ids, generation_mode, state, provider_request_key, attempts, lease_until, result_link_id, error_code |
| `document_identity_links` | instance_id + boardy_user_id unique, docmost_user_id, docmost_workspace_id, confirmed_at, revoked_at; dual-session proof, never email-only matching |
| `project_document_spaces` | project_id unique, instance_id, space_id, permission_sync_state, last_verified_at; secrets referenced from secret store only |
| `activity_events` | id, project_id, actor_id, type, entity_id, version_id, created_at; append-only metadata, no secrets/content |
| `command_receipts` | actor_id + workspace_id + route + idempotency_key unique, request_hash, response_status/body, expires_at |
| `outbox_events` | id, project_id, type, entity_id, dedupe_key unique, available_at, attempts, lease_until, completed_at |
| `upload_intents` | id, project_id, actor_id, purpose, object_key, max_bytes, declared_mime, expires_at, state, content_hash |

Use composite foreign keys or transactional checks to ensure a handoff cannot point to another project's board, snapshot, file, predecessor, or document. A valid UUID alone is never proof of access. Retain accepted owner identity/history when a member becomes inactive.

## Published snapshot format

An immutable package contains a manifest, native Excalidraw selection JSON, a raster preview, and required selected assets. Native JSON uses upstream element structures and filtered app state/files. Include only selected elements and necessary bound elements explicitly shown in preview. Strip unrelated app state, collaborator identities, and unselected file payloads. Freeze file bytes or reference immutable file versions, never mutable legacy object keys. Validate completeness before publication.

The manifest records schema version, selected element IDs, source board ID, informational scene version, publication time, publisher, and content hashes. It never contains room keys. Exclude elements whose referenced assets cannot be resolved. The preview and downloadable scene must represent the same approved selection.

## Object layout

```text
board-files/{legacyRoomId}/{fileId}                     existing encrypted assets
project-files/{workspaceId}/{projectId}/{fileId}/{versionId}/original
handoff-snapshots/{workspaceId}/{projectId}/{snapshotId}/manifest.json
handoff-snapshots/{workspaceId}/{projectId}/{snapshotId}/selection.excalidraw
handoff-snapshots/{workspaceId}/{projectId}/{snapshotId}/preview.png
handoff-snapshots/{workspaceId}/{projectId}/{snapshotId}/assets/{assetId}
```

Bucket names and path layout are proposed. All are private. Path prefixes assist organization; database authorization is still mandatory. Published snapshot packages must be finalized server-side against an authorized upload intent, content hash, size, and validated manifest before becoming eligible for a handoff.

Start new project uploads with a proposed 25 MiB per-file limit; keep legacy 4 MiB behavior until explicitly changed. File types: PDF, common image types, plain text/Markdown, and approved office formats. Detect MIME server-side, quarantine unsupported/unsafe files, and never execute uploaded content. Limits and allowed types are configuration returned with upload intents.

## RLS and authorization

Members read only active projects to which they belong. Editors mutate drafts/uploads; owners administer project access. Transition commands enforce narrower actor rules. Direct table writes must not bypass lifecycle checks: expose read views as needed, and route workflow mutations through tightly scoped transactions/RPCs. Any security-definer function uses a fixed search path and explicit authorization; never trust user-editable metadata as a role.

Storage policies use project membership and readiness, not merely a user-supplied folder path. Download URLs are minted after authorization with a proposed 60-second lifetime. Upload URLs expire after a proposed 10 minutes and authorize only a generated object key with bounded size. Completion revalidates actual content. Never allow overwrite of a ready version.

Legacy membership self-enrollment is a known gap. Do not attach a legacy room to a private project until room ownership/invitation and access revocation semantics have been implemented and tested. The room key remains a separate capability; membership alone cannot decrypt a board.

## Retention and recovery

Proposed defaults: deleted projects/files enter 30-day trash; abandoned upload intents are swept within 24 hours after expiry; command receipts expire after 24 hours; operational logs retain 30 days. Define customer deletion and legal retention requirements before launch. Backups use a proposed 30-day window subject to selected infrastructure capability. Document-provider retention may differ and must be configured and disclosed.

Deletion is a tracked job: revoke access → mark tombstone → remove objects and upstream resources under an explicit policy → record completion. Do not delete a Docmost page merely because a link was removed. Avoid deleting file versions referenced by retained accepted handoffs. A hard project deletion deliberately removes those records together. Reconcile orphaned objects and failed external deletions. Restore drills verify both metadata and object availability.

## Community bridge extension storage

The maintained Docmost fork owns a dedicated correlation/receipt ledger keyed by workspace and correlation ID, with request hash, actor, page ID, state and timestamps. It must participate in the native create transaction or force ambiguous-result reconciliation. Boardy never writes native document tables. See [Open-source integration](DOCMOST-OSS-INTEGRATION.md) for identity, public-sharing policy, asset-copy and source obligations.
