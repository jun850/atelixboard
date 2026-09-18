# Local implementation and testing

2026-09-17. This is a **local development test build**, not completion of the full PRD or a production release. The user explicitly selected session-only local API keys. No commits, pushes, database migrations, function deployments or installer publishing were performed.

## Start and try it

From the repository root, with dependencies installed:

```sh
cd excalidraw-app
../node_modules/.bin/vite --host 127.0.0.1 --port 3000 --strictPort
```

Open `http://127.0.0.1:3000/app` and sign in with your existing Boardy account. Open **Templates and assistant** from the main menu, the command palette, the welcome screen, or the Templates tab beside Search/Library.

- **Templates:** search/filter all 29 built-ins. Open one, edit its title/section text, preview, then Apply. Output uses native elements and one undoable insertion.
- **My templates:** select native elements, Save selection as template, review exclusions, name/categorize, save. Rename, delete and reinsert are available. These are account-scoped **local IndexedDB** snapshots, not cloud-synced templates.
- **Assistant:** choose a template, open AI connections, sign in through Codex/Claude Code or connect an OpenAI/Claude API key, explicitly select a discovered model, select the disclosed context and generate. Review before Apply; refinement includes the prior draft only on the same connection. Stop cancels the local request and attempts to abort upstream inference. Already-dispatched usage may still be billed.
- **UI prototype:** select a normal or magic frame and choose Selected content. Text/geometry are used, not a screenshot. The result is sanitized HTML/CSS with native browser controls. JavaScript is disabled; export downloads the sanitized document.

The verification session left an editable Kanban board and a saved `Kanban local test` template. They contain placeholders only.

## Subscription sign-in (local Mac)

Open **Assistant → AI connections**:

1. Choose **Sign in to Codex** or **Sign in through Claude Code**. No API key is needed.
2. Follow **Continue official sign-in** and complete the provider’s login yourself. Claude Code also opens its official login page automatically. Boardy never accepts a pasted auth code or subscription token.
3. Return to Boardy and click **Test / refresh**. This checks authentication and loads the runtime’s models without inference.
4. Click Done, choose the connection and an explicit discovered model, then generate a private draft. Subscription usage is charged against your own provider account under that provider’s terms.
5. **Cancel sign-in** stops a pending login. **Disconnect** signs out and removes the dedicated local profile.

This test bridge requires the unmodified installed **Codex CLI 0.154.0** and **Claude Code 2.1.226**. It resolves the executable path, checks the exact version, and rejects other versions. Check installations with `codex --version` / `claude --version`. It does not install or update your runtimes. Bundled, signed, cross-platform desktop installers remain unfinished.

Each connection has a separate mode-0700 temporary profile, outside the repository; existing terminal profiles are not imported. The runtime owns its credential storage and refresh. Environment variables are allowlisted, excluding inherited API keys, subscription tokens, provider/proxy overrides and agent configuration. Normal disconnect, sign-out, idle expiry and server shutdown invoke runtime logout and remove the profile. A forced kill/crash can leave runtime-owned credentials in the temporary profile or OS credential store; crash recovery and installer lifecycle are still production work. API keys remain memory-only.

Codex uses App Server stdio with experimental empty `environments`, no selected capability roots, no inherited instructions, ephemeral threads and read-only policy. The pinned runtime was probed without inference and returned empty environments/instruction sources. Claude Code uses its official login command, empty tool list, safe mode, no slash commands, no MCP servers and no persistent conversation. Models come from Codex `model/list` (paged) and Claude’s initialization response; Claude aliases are resolved to explicit model IDs. The browser cannot invoke generic runtime RPC or shell commands.

The [current Claude rules](https://code.claude.com/docs/en/legal-and-compliance) distinguish an end user signing into an unmodified Claude Code runtime from a third-party Claude.ai token proxy. This local implementation uses the former. Review commercial terms and distribution requirements before releasing a product. [Codex App Server reference](https://developers.openai.com/codex/app-server).

## Development storage and security boundary

`/__agentic/*` exists only in the Vite development server. The gallery/assistant entries are DEV-gated. The app still requires normal Boardy sign-in. Each backend request verifies the Supabase access token with `getUser`; owner identity is never accepted from the request body. No service-role key is used.

The local service accepts loopback Host values, matching Origin (or same-origin browser GET), and a custom request header. It exposes no wildcard CORS. Keys stay in process memory, are owner-isolated, and are cleared by explicit disconnect/sign-out, process restart or one hour of inactivity. Test/replacement uses discovery without paid inference. Replacement failures preserve the working key. No provider key enters IndexedDB or localStorage.

Connections/model catalogs and idempotency records are local process state. Restarting clears them. Idempotency is therefore guaranteed within the current server lifetime, not across a crash/restart. Discovery supports bounded Anthropic pagination, a five-minute catalog lifetime and explicit refresh. OpenAI model endpoint compatibility is explicitly unverified unless known incompatible; the user must opt in to try an unverified model. Models are not silently substituted.

Generation reserves one owner slot before inference, has a 90-second total abort deadline, performs at most two calls (one optional schema repair), and requests at most 16,000 output tokens across both API-key calls. Subscription runs use the runtime’s token limits; the 90-second deadline and two-attempt bound still apply. API-key calls do not enable tools. Claude Code runs with all tools disabled; Codex disables workspace environments, shell, browser, connectors, plugins and other action tools. Runtime utility events can still exist; unexpected approval requests terminate the process. Errors return bounded safe codes, not raw provider bodies. The backend does not log/store prompts, generated output or keys.

PostgREST review: **zero new PostgREST queries**. The new service makes one Supabase Auth verification per request. Models are fetched per connection, not per model. No per-element, per-token or per-thumbnail backend calls exist. The local snapshot store loads up to 100 records in one IndexedDB transaction.

Generated iframe content, including saved/imported HTML, is sanitized and receives `sandbox=""` and a deny-by-default CSP. Scripts, event handlers, links, nested documents, images, forms and external resources are disabled/removed. Native controls such as details/selects remain usable. Ordinary external URL embeds retain their existing policy. This conservative implementation deliberately does **not** claim the PRD's executable-JavaScript acceptance.

## Implemented scope versus remaining PRD work

| Requirement | Local status / remaining work |
| --- | --- |
| AB-01 | Four gallery entry points, search, categories and local My templates implemented. |
| AB-02 | All 29 fixed default layouts insert natively; title/section editing and structured AI content supported. Full template-specific parameter schemas, user-defined relationship topology, date validation and complete QA-04 semantic coverage remain. |
| AB-03 | Local private snapshots, independent IDs/bindings, rename/delete/reinsert. Cloud RLS-backed snapshots and generic AI revision of personal topology remain. |
| AB-04/05 | Session-only provider connections, test/replace/disconnect, dynamic discovery, exact model choice. Vault, durable revisions, full capability/reasoning metadata and live provider smoke evidence remain. |
| AB-06/07 | Private previews/refinement, disclosed prompt/selection/whole-board text/geometry, conflict rejection, separate-copy choice, atomic insert/undo and duplicate-apply identity. Source updates/deletions and persistent account/board-scoped draft history remain. Drafts are session memory and clear on account/hash changes. |
| AB-08 | Uses ordinary scene persistence; local reload verified. Multi-client encrypted collaboration acceptance remains unverified. |
| AB-09 | Explicit local disclosures, no room keys/comments/images in the new generation payload. Production retention/telemetry review remains. |
| AB-10/13 | Conservative HTML/CSS prototype preview/apply/export with scripts blocked. Executable network-isolated JavaScript, screenshot input and legacy magic-frame flow unification remain. |
| AB-11 | Local slot/deadline/cancel/repair/request-ID guards. Durable lease recovery, SSE event protocol and crash-safe run metadata remain. |
| AB-12 | Local Codex/Claude Code subscription bridge and official runtime sign-in implemented for this Mac. Version checks and tool restrictions are present. Signed Electron companion, packaged binary integrity, pairing/permits, full OS isolation, macOS/Windows installers and update/crash recovery evidence remain. |
| AB-14 | Native controls, labels, live status and responsive sidebar/dialog tested on desktop and phone widths. Full dark-mode, 200% text, keyboard/screen-reader matrix remains. |
| AB-15 | Authenticated BYO-key local use; no paywall or Boardy-funded inference. Production capability policy/flags remain. |
| AB-16 | Existing library and editor remain available; host/fallback sidebar duplication fixed. Legacy AI callbacks remain separate; they are not evidence of the new provider lifecycle. |

Production contracts in API-CONTRACTS.md remain the target. The development adapter uses a bounded JSON response rather than SSE, local process connection/run state rather than database leases, a simpler section-content schema rather than arbitrary scene operations, and IndexedDB snapshots rather than the proposed template API. Do not deploy this adapter as a substitute for the backend plan.

## Verification evidence

Local source, macOS, Node 24.8.0, Vite 5.0.12, repository TypeScript 5.9.3 / Vitest 3.0.6. No live paid model calls were made during this verification.

- Targeted fixtures: all 29 default layouts plus all 29 long-content layouts; unique IDs, bounds, binding/frame remapping, sanitizer exclusions, invalid content/context rejection and source conflict checks.
- Real editor harness: private gallery preview, atomic insertion, unrelated metadata preservation, duplicate application rejection, single-step undo, and one host sidebar.
- Mock provider service: authentication/origin rejection, owner isolation, safe descriptor/error handling, exact model forwarding, duplicate request blocking, failed replacement retention, one repair/total token bound and session cleanup.
- Signed-in Chrome: search Kanban → template preview → private review → Apply → Undo → Redo; native objects and selected-shape controls observed. Saved personal template and scene both verified after reload. Connection settings loaded from the authenticated local API without errors.
- Visual: desktop template review and responsive review at 375×812; assistant inspected at 320×812. Overlapping action buttons and duplicated fallback sidebar found and fixed. Browser viewport restored after testing.
- Baseline regression: 132 passing tests across the original two new test files and the existing 60-test editor interactivity suite. Subscription extension: 86 tests pass across the three agentic-board files (including 14 new runtime/service cases).
- Commands: `yarn test:typecheck`, targeted `vitest run excalidraw-app/agentic-board`, scoped ESLint, and `vite build` (equivalent binaries used from node_modules). Full release acceptance is not claimed.

### Subscription verification (2026-09-17)

- 86 agentic-board tests passed; scoped ESLint and TypeScript passed; local Vite build passed.
- Real Codex 0.154.0 startup returned no inherited instructions, no environments and network access disabled. Both dedicated runtime profiles initially reported sign-in required. Claude initialization returned resolved model IDs with slash commands disabled, without inference.
- Signed-in Chrome displayed both subscription buttons. Codex returned its official OAuth link; Claude Code opened the official Claude sign-in page using its local callback. Login pages were left for the user.
- Codex subscription smoke test completed after a fresh official handoff: five models discovered, gpt-5.6-luna explicitly selected, prompt-only generation and refinement returned validated private drafts, and Apply → Undo → Redo worked in the real editor. The native Local Codex test flowchart is left beside the existing Kanban. Claude subscription generation still awaits its own completed login and smoke test.

- The Codex smoke test exposed zero-origin connectors and omitted flowchart item text. Fixed connector geometry/bindings and flow content rendering, then visually verified the corrected generated preview and applied native canvas. Added a regression case; 87 agentic-board tests pass. Typecheck, scoped lint and local build passed.
