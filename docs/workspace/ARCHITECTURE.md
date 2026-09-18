# Boardy workspace architecture

## Source of truth

Supabase is authoritative for profiles, workspace membership, collections, whiteboard metadata/revisions, grants, invitations, comments, mentions, reactions, notifications, and audit events. Browser and Excalidraw caches may improve startup and offline behavior, but clearing them must never delete the cloud record or change access.

## Hierarchy

```text
Workspace
├── Members (admin, staff, external)
├── Collections (private, workspace, selected)
│   └── Whiteboards (owner, editor, commenter, viewer)
│       ├── Cloud scene + immutable revisions + assets
│       └── Comment threads
│           ├── point, region, element, or general anchor
│           ├── messages, mentions, reactions, read state
│           └── resolved or open state
└── Invitations + audit events
```

An account with a paid entitlement creates a sponsored workspace at first bootstrap. A valid workspace, collection, or whiteboard invitation grants access before the subscription screen, so invited collaborators bypass the individual paywall without becoming billing sponsors. At rollout, all existing Supabase Auth users are snapshotted into `boardy_subscription_allowlist`; this grandfathering does not automatically include later signups.

## Boundaries and flows

- `/app` loads the workspace dashboard; `/app/boards/:id` loads a cloud scene; `/app/collections/:id` filters the dashboard.
- The `workspace` Edge Function owns orchestration and all privileged mutations. Client access still uses user-scoped RPCs where authorization must be evaluated by RLS.
- `scenes` remains the whiteboard document/revision API. New whiteboards are created in a workspace and collection.
- Invitation tokens are random, returned once, and stored only as SHA-256 hashes. Redemption is a row-locked database transaction, making max-use enforcement atomic and idempotent per user.
- Comment anchors use scene coordinates. The canvas converts scene-to-viewport positions on every pan/zoom and converts the placement click back to scene coordinates.
- Realtime collaboration uses private `board:<scene-id>:collaboration` channels. Read access is required to receive; edit access is required to publish document changes.
- Avatar files use the private `boardy-avatars` bucket and short-lived signed URLs.

## Integrity constraints

- Collection names are unique per workspace after trimming and case folding.
- Active whiteboard names are unique inside a collection after trimming and case folding.
- A whiteboard belongs to exactly one workspace and collection after bootstrap.
- An invitation targets at most one collection or whiteboard.
- Comment writes use idempotency request IDs; thread updates use an optimistic version.
- Removed members retain authored history while losing active workspace access.

## Operational order

1. Apply the migration.
2. Deploy `workspace`, then the updated `scenes` function.
3. Deploy the web application.
4. Verify paid bootstrap, invited-user bypass, RLS denials, comment placement, and private Realtime authorization before promotion.
