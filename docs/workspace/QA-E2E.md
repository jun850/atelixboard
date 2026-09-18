# Workspace end-to-end QA

Use distinct browser profiles for Owner/Admin, Staff, External Editor, Commenter, Viewer, and Uninvited User. For every allowed case, verify the database row and refreshed UI. For every denied case, call the API directly as well as testing the UI.

## 1. Bootstrap and billing

1. A paid new user opens `/app`; CustomerInfo reports `boardybyatelix_pro`; one workspace, admin membership, profile, and `My whiteboards` collection are created.
2. An unpaid user without an invitation is redirected to `/app/subscription`.
3. An unpaid invited user signs up through `/invite/:token`, redeems once, and reaches the target without the paywall.
4. Reopening a redeemed invitation is idempotent. Expired, revoked, wrong-email, and exhausted links fail without partial membership rows.
5. Every Auth user present when the migration runs has one allowlist row and bypasses billing; a user created after migration without subscription/invitation is not allowlisted.

## 2. Whiteboards and collections

1. Admin and Staff create a collection and a whiteboard; refresh confirms cloud persistence.
2. Open the card, navigate back, rename the whiteboard, and move it to another collection.
3. Attempt duplicate collection names and duplicate active whiteboard names with casing/whitespace changes; both fail clearly.
4. Share collection privately to one External user and by reusable link; only redeemed users can open its URL.
5. Verify `workspace`, `selected`, and `private` visibility against every role.
6. Clear browser cache/storage and sign in again; all content reloads from Supabase.

## 3. Roles and sharing

1. Admin creates invite links, adds Staff and External users, changes each role, and removes a user.
2. Staff can create content and manage owned collections but cannot manage workspace members.
3. External users cannot discover unrelated collections/boards or list internal members unless explicitly shared.
4. Owner shares one board as Editor, Commenter, and Viewer to separate users.
5. Editor can change canvas content but cannot reshare, rename, move, or delete.
6. Commenter can comment but cannot publish canvas updates. Viewer can only read.
7. Removed users immediately lose dashboard, API, signed-asset, and Realtime access while historical author identity remains.

## 4. Figma-style comments

1. Owner types a comment, mentions Staff, chooses `Pin to canvas`, and clicks at a known shape.
2. Pan and zoom: the numbered pin remains anchored to the same scene coordinate.
3. Staff receives a mention notification, sees avatar/name/email, opens the thread, replies, and reacts.
4. Commenter creates a general comment and a pinned comment, replies, reacts, and resolves their own thread.
5. Viewer sees open/resolved comments but every create/reply/react/resolve API request is denied.
6. Editor resolves and reopens another user’s thread. Commenter cannot resolve another user’s thread.
7. Search filters message text; resolved toggle includes/excludes resolved threads; pin selection scrolls the right panel thread into view.
8. Two clients update the same thread version; one succeeds and the stale update returns a conflict without overwriting.
9. Delete/move permissions, 10,000-character limit, duplicate request retry, and inaccessible mention targets are rejected.
10. Refresh and clear cache; anchors, messages, mentions, reactions, identity, and resolution state reload from cloud.

## 5. Profile, responsive, accessibility, and resilience

1. Update display name and upload JPEG/PNG/WebP avatar under 5 MB; every identity surface updates and uses a signed URL.
2. Keyboard-test sidebar, board cards, dialogs, comment composer, mentions, role selectors, and focus states.
3. Test 1440×900, 1024×768, 390×844, and 320×568; no clipped actions or horizontal page overflow.
4. With reduced motion enabled, transitions are effectively disabled.
5. Simulate offline/network failure during board/comment mutation; UI reports failure and never claims a cloud save.
6. Verify request bounds: dashboard ≤250 boards, comments ≤200 threads, no per-row frontend fetch loop, and no tight polling.

## Release evidence

- Migration reset and database lint/advisors pass.
- Typecheck, scoped lint, production build, and relevant tests pass.
- Desktop/mobile browser screenshots and interaction recording are retained.
- Impeccable detector and final visual polish pass are clean or have documented exceptions.
