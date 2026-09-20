# Boardy AI visibility studio

Owner route: `/app/visibility`. Public documents: `/learn`, `/learn/:slug`, matching `.md`, `/llms.txt`, `/llms-full.txt`, `/ai`, `/sitemap.xml`, and read-only `/mcp`.

## Architecture and provenance

React/Vite dashboard → authenticated `discovery-studio` Supabase function → private Postgres records. A paired Mac worker polls outbound and runs fresh Codex sessions using ChatGPT subscription authentication. Public Vercel routes proxy a fixed Boardy `discovery` function and serve only published snapshots. The competitor is not a runtime dependency.

[Upstream manifest](upstream.json) records repository commit SHAs, licenses, source files and Boardy equivalents. GEO and benchmark methods are adapted with [MIT attribution](TPC-SKILLS-LICENSE.txt). Unlicensed repositories informed architecture only. [MCP research](prompting-company-mcp.md) distinguishes observed competitor capabilities from our implementation. [Design contract](DESIGN.md) documents the reference layout and Boardy palette.

Six versioned roles have distinct instructions: research, prompt generation, writing, editorial review, neutral visibility checks and analysis. Analysis is deterministic SQL. Role files live under `scripts/discovery/skills`; runtime instructions and result validation live in `studio-core.ts`. Research and writing cannot publish. Runs retain model, skill version, input knowledge snapshot, timestamps, result and web-search artifacts. Generated prompts require source excerpts verified against fetched public pages. This verifies the excerpt exists, not every factual inference; owner review remains required.

## Owner and worker security

Every private call verifies Supabase Auth, confirmed email `junarcana263@gmail.com`, and pinned owner UUID. All private tables have RLS and deny direct anon/authenticated access; only the backend service role accesses them. Short-lived pairing codes are one-use. Device tokens are hashed server-side, revocable, and stored locally with mode 0600. ChatGPT credentials stay in `~/.boardy-discovery/runtime` and never enter Boardy's database.

From this repository on the Mac:

```sh
yarn discovery:worker pair <code-from-Connection>
yarn discovery:worker login
# Select an available model in Connection.
yarn discovery:worker start
# Optional: run on Mac login instead of leaving a terminal open.
yarn discovery:worker install
```

The optional LaunchAgent depends on this checkout and its installed dependencies remaining at this path. Remove it with `launchctl bootout gui/$(id -u)/com.boardy.discovery-worker` and remove `~/Library/LaunchAgents/com.boardy.discovery-worker.plist`. Revoke the device in Connection to deny backend access immediately. Logs and recovery receipts are private under `~/.boardy-discovery`.

No paid API fallback or silent model substitution. Exhausted capacity pauses work. Missing capacity data is displayed as unavailable. Mac sleep/offline pauses execution. Weekly selected-prompt checks are scheduled when the worker next claims work; one overdue check per prompt, no historical backlog. Generation takes priority. Leases renew every 30 seconds. Expired/ambiguous work becomes interrupted and requires explicit retry; duplicate completions cannot duplicate content.

## Editing, publication and measurement

Tiptap supports formatting, headings, lists, links, owned images with alt text, tables, undo/redo, autosave, preview and revision history. Saves use optimistic version checks. Editorial suggestions only apply to the version reviewed. Published snapshots remain unchanged until owner publication; subsequent edits return to Review queue. Unpublish preserves the draft, URL identity, revisions and historical counts. Public HTML is generated from an allowlisted document tree; arbitrary HTML/scripts are not accepted.

Results are Codex observations, not consumer ChatGPT rankings or cross-engine market share. Monitoring sessions receive the question and neutral instructions without promotional knowledge. Failed jobs do not enter successful-answer rates. Answers, incidental Boardy links and source artifacts remain inspectable. Links are not presented as verified provider citations. Crawlers are user-agent classifications, AI referrals are referrer classifications, and other requests are separate. These are requests, not unique visitors or verified bot identities. Controlled verification traffic must not be described as organic growth.

Google Search Console is not connected. Internal analytics works independently. Domain verification and sitemap submission require the owner's Google account.

## Performance and validation

Lists use 25-row indexed pagination, stable timestamp/id ordering and debounced search. Article/prompt performance is one SQL aggregate for the current page, not per-row requests. Bootstrap aggregates server-side. No tight browser polling. An idle worker sends one heartbeat and one claim per 30 seconds; active work renews one lease per 30 seconds. Knowledge snapshots are bounded to 100 approved entries. Saved totals have no fixed quota; generation batches are bounded.

```sh
yarn vitest run --config scripts/discovery/vitest.config.ts
yarn test:typecheck
yarn build:app
supabase db query --linked --file scripts/discovery/studio-database-tests.sql
```

Database fixtures roll back and cover RLS/grants, revocation, leases, recovery, duplicate completion, draft isolation, revision conflicts/history and controlled attribution. Frontend fixtures exercise navigation and editing, but do not prove real subscription generation. Desktop/mobile screenshots are under `.impeccable/review` locally.

## Current rollout

Additive studio migrations and backend functions are deployed. The frontend is staged; production promotion awaits the real owner workflow: ChatGPT login → pair worker → generate prompts → draft → edit → owner review/publish → inspect statistics. Subscription-backed generation has not yet been verified. The official login attempt timed out while awaiting interactive login. No generated article was automatically published.

Deploy functions using `supabase functions deploy discovery-studio discovery --use-api`. Stage with `vercel deploy --prod --skip-domain`; verify before promoting the resulting deployment. Existing unrelated migration-history mismatch remains untouched; only named additive migrations were applied transactionally. Roll back the frontend to the prior canonical deployment and redeploy prior function source if needed; retain additive tables and published snapshots rather than dropping data. No Git commit or push has been performed.

### Studio staging evidence — 2026-09-20

- Ready deployment: `dpl_FJEVkenajz9h9z6LMfi3fUwXHouz`, https://atelixboard-j23n073r7-solafy.vercel.app. Build passed; authenticated Vercel CLI verified Markdown, sitemap XML and MCP tools with correct content types and HTTP 200.
- Canonical `boardy.sbs` remains on `dpl_Uc2nddtzMKrdtSPtuf9g1SQ4q89c`; no studio frontend promotion yet.
- 21 focused tests passed, plus 11 existing runtime transport tests. Application TypeScript, scoped ESLint with zero warnings, Deno checks and transactional database checks passed. Public canonical HTML/Markdown/sitemap passed; unknown article 404 and anonymous studio 401.
- Desktop/mobile fixture review completed. Real owner subscription authentication, generation, editorial review and publication remain unverified. Staging protection must not be mistaken for application response evidence.

## Historical foundation release — 2026-09-20

- Production Vercel deployment: `dpl_Uc2nddtzMKrdtSPtuf9g1SQ4q89c`, promoted to `boardy.sbs`; Supabase `discovery` deployed to the existing Boardy project.
- 13 targeted tests passed: public content/canonicals, unknown routes, attribution/lookalike domains, MCP methods, fixed-origin proxy and credential stripping, owner-only UI reads, error state, manual-check submission.
- Application TypeScript and scoped ESLint passed. Separate proxy/middleware TypeScript and Deno function checks passed. Production build passed.
- Live canonical requests: HTML 200, Markdown 200, sitemap XML 200, llms.txt 200, unknown guide 404, private route `noindex, nofollow`; MCP initialize and documentation search succeeded. The first staged deployment exposed an ESM packaging issue; it was fixed with an isolated `api/package.json` before promotion.
- Database verification asserts revoked anonymous/authenticated table and RPC privileges, RLS, atomic increments, and aggregation. Fixtures are transactional and rolled back. No new discovery security-advisor warnings; unrelated pre-existing advisories were not changed.
- Confirmed the real owner's signed-in dashboard loads and displays persisted public requests. Inspected desktop and 390px guide/report layouts; the report's document and scroll widths were both 390px. Verification visits are included in request counts and are not evidence of organic AI recommendations.
- Existing unrelated migration-history mismatch (`20260919054633` locally versus `20260919054809` remotely) was left unchanged. The new migration alone was applied and recorded transactionally.
- No Google Search Console connection, paid inference runs, scheduled prompt sweeps, or automatic article generation has been enabled. Source changes remain in the working tree; no Git commit or push was performed.
