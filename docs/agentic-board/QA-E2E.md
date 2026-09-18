# QA: end-to-end acceptance scenarios

Status: test plan, **not executed**. These scenarios cover [PRD](PRD.md) requirements and [contracts](API-CONTRACTS.md). The QA agent must record actual results, not change this status based on source inspection alone.

## Fixtures and environments

- Local/test Supabase with two accounts A/B, separate private templates/connections, a shared room, an inaccessible room and an unsaved local board.
- Deterministic provider fixtures for successful text/vision output, pagination, invalid JSON, unsupported models, expired credentials, 429, timeout, interrupted streams and cancellation. Fixtures never require real keys in committed files.
- A bounded live test using explicitly provided test-provider credentials for each adapter; do not run the entire matrix against paid inference. Local mocks prove behavior, not provider compatibility.
- Codex subscription test account, pinned companion/runtime builds, macOS Apple Silicon/Intel and Windows x64 installation environments. Record any architecture not actually tested.
- Native scene fixtures for each template, a realistic wireframe, long labels, Unicode/RTL text, malicious board instructions, adversarial HTML and concurrent edits.
- Desktop Chrome/Edge/Firefox and macOS Safari where available; narrow mobile browser coverage for API-key use. Missing device/browser access remains an explicit release-evidence gap.

## Scenario matrix

| ID / requirements | Prerequisite and steps | Expected result |
| --- | --- | --- |
| QA-01 / AB-01 | Signed in; open Templates from sidebar, empty welcome screen, main menu and command palette; search a title/tag; filter each category | Every entry opens the same gallery; search/filter work; no duplicate navigation implementation |
| QA-02 / AB-01,14 | Use keyboard only through gallery/detail/form/close; repeat narrow viewport, 200% text, light/dark and reduced motion | Named controls, visible focus, correct restoration, readable previews, reachable actions, no clipped required fields |
| QA-03 / AB-02 | Parameterize over every catalog ID; insert default and max-valid structures, edit text/move shapes; undo/redo; save/reload | Every template is real/selectable; editable native objects, stable bindings/frames, valid coordinates, within limits |
| QA-04 / AB-02 | For every template use realistic customized content, long labels, empty optional data and invalid counts/dates; generate/refine | Required sections preserved; no clipping/overlap that obscures meaning; invalid inputs explained; no silent content truncation or invented confirmed facts |
| QA-05 / AB-03 | Save selection with internal/external arrows, comments and excluded media; review disclosure; rename, insert twice, delete source template | Sanitization/exclusions visible; distinct IDs and valid internal bindings; existing inserted scenes survive source rename/delete |
| QA-06 / AB-03 | A saves template; B calls list/get/patch/delete with guessed A IDs; A tests stale revision and concurrent rename | Cross-user access denied; stale writes conflict; no private content/thumbnail leakage |
| QA-07 / AB-04 | Connect valid/invalid OpenAI and Claude keys; test; replace with invalid then valid key; disconnect twice | Safe metadata only; no paid discovery completion; invalid replacement preserves old key; successful replacement invalidates cache; deletion idempotent |
| QA-08 / AB-04,09 | Inspect browser storage/network, server errors/logs; attempt direct Vault/private mapping access and forged owner IDs; delete test account | Keys not retained client-side or leaked; unauthorized secret reads denied; owned Vault secrets cleaned up on account deletion |
| QA-09 / AB-05 | Use paginated model fixtures with supported/unsupported/unknown models; connect, refresh, rotate key and reconnect runtime | Complete owner-scoped list; cache invalidation correct; incompatibility reasons shown; unknown flags not invented |
| QA-10 / AB-05,15 | Choose exact model/reasoning; start run; switch displayed selection for next run; simulate removed model/quota/access denial | Active run keeps chosen model; request uses exact ID; errors ask for choice; no automatic model/provider/API fallback |
| QA-11 / AB-05 | Use text-only, vision, JSON-native and non-JSON-native models; request screenshot UI and native board generation | Task capabilities enforced; explicit text/elements mode offered where valid; bounded JSON repair; no embedding/video execution |
| QA-12 / AB-06 | Generate and refine selection while second client observes scene; discard/close preview | No shared scene mutations until Apply; previous draft remains manageable; discard performs no canvas write |
| QA-13 / AB-06,09 | Generate with no selection, selection, frame and explicit whole-board; change provider with prior history | Only disclosed bounded context sent; no room key/unselected file leakage; provider switch does not auto-replay history |
| QA-14 / AB-07 | Apply mixed create/update/delete draft, click Apply repeatedly, undo then redo | One scene transaction/application; all accepted changes undo together; unrelated objects/history survive |
| QA-15 / AB-07 | During generation another client changes/deletes an affected target; attempt Apply, regenerate or insert copy | Conflict shown; no overwrite; copy uses new IDs and preserves live source; unrelated edits do not cause unnecessary conflicts |
| QA-16 / AB-08 | Apply native and UI drafts in shared room; inspect second client; reload and export/import | Accepted output syncs and persists; payload stays in existing encrypted scene flow; private drafts/credentials do not sync |
| QA-17 / AB-10 | Select ordinary frame then magic frame; generate, interact with preview, refine, apply and export HTML | Source remains intact; prototype works locally; insertion beside source; exported artifact matches validated accepted result |
| QA-18 / AB-10,13 | Feed scripts accessing parent/storage, fetch/WebSocket, external images/fonts/media, nested iframes, forms, navigation, popups/downloads; repeat imported legacy HTML | CSP/sandbox deny excluded effects; no host DOM execution or credentials; valid local interactions still work; partial HTML never executes |
| QA-19 / AB-11 | Stop before call, during stream, during repair and just before completion; simulate network loss/reload and late events | Stop prevents late apply; bounded upstream abort; terminal state stable; no automatic paid retry; slot eventually released |
| QA-20 / AB-11 | Submit same UUID twice, simultaneous API/local runs, oversized payloads, invalid JSON, over-limit drafts and expired deadlines | One lease/call sequence; duplicates return status; bounds enforced across calls; no partial draft applied; explicit new-run retry |
| QA-21 / AB-12 | Install signed companion on each target OS; sign in via official Codex flow; pair; list models; generate; disconnect/reconnect | No terminal prerequisite; runtime models visible; credentials stay local; connection states accurate; session cannot cross accounts |
| QA-22 / AB-12,13 | Replay challenge/token/permit; use malicious Origin/Host/callback, expired/revoked device, changed model claims and denied local-network permission | Requests fail safely; no arbitrary native RPC; no weakening of TLS/origin rules; clear recovery state |
| QA-23 / AB-12 | Companion stopped/offline; incompatible runtime; process crash; corrupt/unsigned update; missing signing prerequisites | Typed errors; no API fallback; interrupted run recovers by expiry; bad updates rejected; unready distributions not released |
| QA-24 / AB-13 | Ask through prompt and board text to read home directory, enable MCP, run shell, browse, produce video or use hidden credentials | Runtime and validators block prohibited behavior, not merely a prompt refusal; no external side effects |
| QA-25 / AB-09 | Capture instrumented API/DB calls and logs over generation/catalog/template flows; expire retention and auth session | No N+1 or token writes; bounded cancellation checks; redacted telemetry; retention cleanup; expired auth cannot resolve keys/start runs |
| QA-26 / AB-14 | Exercise empty/error/loading catalog, long names, quota, invalid form, missing connection, conflict and mobile keyboard | Input retained, status announced without focus theft, retry actionable, buttons correctly enabled and responsive layout usable |
| QA-27 / AB-15 | Signed-out/expired user attempts generation/permit; signed-in user without paid plan connects own provider; toggle feature flags | Auth enforced server-side; no paywall/checkout needed; disabled capability fails before secret use; no app-funded model call |
| QA-28 / AB-16 | Use drawing, selection, library assets, manual Mermaid, existing URL embeds, collaboration and undo with AI flags off/on | Existing editor paths remain functional; generated HTML policy does not accidentally break ordinary external embeds |

## Evidence format and gates

For each scenario record: build/commit, environment, platform/browser/provider/runtime versions, fixture/model, timestamp, steps performed, expected/actual result, pass/fail/blocked and evidence location. Redact screenshots/logs that expose private keys/content. A fixture pass is not a live-provider pass; a local executable is not a tested signed installer.

Required gates: type checking; focused unit/component tests for schemas/builders/state; local RLS and unauthorized endpoint tests; browser journey and sandbox verification; bounded live adapter smoke tests; native companion isolation/install/update evidence. Every AB requirement must have at least one passed scenario before the corresponding feature flag is released. Failed credential, ownership, sandbox, conflict or idempotency tests block that release.

Use the repository's relevant commands, including `yarn test:typecheck` and targeted `yarn test:app ... --watch=false`, after verifying local scripts. Run scoped lint/format checks and app build when implementing. For this documentation-only change, validate links and traceability; do not claim these application tests ran.
