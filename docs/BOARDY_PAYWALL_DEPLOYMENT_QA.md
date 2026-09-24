# Boardy paywall release QA

## Release order and gate

1. Configure `REVENUECAT_SECRET_API_KEY` as a Supabase Edge Function secret for the production RevenueCat project. Keep the browser Web Billing public key separate; the local public key must be the sandbox key. Confirm the entitlement identifier is `boardybyatelix_pro` and that the server can read CustomerInfo for a known paying account. Do not ship the paywall changes until this works: paid server actions fail closed without it.
2. Apply the additive `20260923120000_boardy_free_creation_and_pro_verification.sql` migration. Confirm existing scenes, memberships, collection visibility, and subscription allowlist rows remain readable. Avoid a destructive database reset.
3. Deploy the `scenes`, `workspace`, `ai-generate`, and `ai-templates` Edge Functions together. Smoke test an existing Pro account and a free account before releasing the web client. Keep the previous function bundle available for rollback.
4. Deploy the web client. Check the canonical production alias, not just the preview deployment. Monitor Edge Function 4xx/5xx rates, editor errors, and failed scene saves during rollout.

## Active user regression checks

- Keep a board open in two browser sessions while releasing. Add, move, and edit shapes before, during, and after deployment. Verify both sessions converge, revisions persist after reload, and there is no lost update or forced paywall while editing an existing board.
- Open a live-collaboration invitation while signed out. It must open Sign in with the complete invitation and collaboration hash retained in `next`. Switch to Sign up and confirm the same destination remains. After email confirmation, `/auth/callback` must preserve `next`, redeem the invitation, and open the shared board directly, without showing the dashboard. Confirm both cursors and collaborator indicators appear and move in separate sessions.
- Keep an existing workspace settings page open. Change a harmless setting after release, reload, and confirm the value persists. Existing collections and staff access must remain intact.
- Verify a free user can open and edit their first board, export PNG/SVG, and view existing comments. Their second board or collection creation opens the paywall without creating a partial resource. Existing boards and collections stay usable.
- Verify a Pro user can create boards and collections, apply templates, use the Assistant, invite by email, post a text and image comment, insert a document, and upload a library file. Check the server response and persistence after reload for each action.
- For a Shared collection, verify another workspace staff member can list and open it without a direct invitation. For a Private collection, verify staff who are not invited cannot access it.
- Test comment search, sort, unread/read, notification choice, resolve/reopen, and delete with two users. A free user's comment send CTA and Enter should open the paywall before an attachment upload.
- Test a narrow viewport, keyboard navigation, the comment search icon, the sort control without a native arrow, and template preview plus scrolling.

## Rollback and observation

If active editing or collaboration fails, stop the web rollout and restore the previous web and Edge Function versions. Leave the additive migration in place until a separate data-safe rollback is designed. Confirm open sessions can still save, and inspect scene revision conflicts and comment errors before retrying. Do not classify a ready deployment or a successful build as proof of live collaboration.

## Local manual QA

Start local Supabase and its Edge Functions, then run `node scripts/start-local-qa.mjs` from the repository root. Open `http://127.0.0.1:5174/`. The local-only free and Pro QA accounts are created by `scripts/create-local-free-qa.mjs` and `scripts/create-local-pro-qa.mjs`; the latter is an allowlist fixture, not a verified RevenueCat purchase. Run `node scripts/qa-local-paywall.mjs` for server 402 checks and `node scripts/qa-local-comment-image.mjs` for image comment upload and readback.
