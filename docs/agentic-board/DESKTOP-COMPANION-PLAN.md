# Desktop companion agent plan

Status: proposed. A required part of the selected release scope, with separate rollout control. Read [contracts](API-CONTRACTS.md), AB-05/AB-12/AB-13 in the [PRD](PRD.md), and QA-21–24 in [QA](QA-E2E.md).

## DC-01: application and distribution

Build a small Electron application for macOS Apple Silicon/Intel and Windows x64. UI responsibilities are connection status, official Codex sign-in, pairing approval, active-run cancellation, device disconnect, diagnostics and updates. Reuse Boardy language and restrained controls; the canvas continues to run in the browser.

Pin and package a tested Codex runtime with verified official artifact provenance, checksums and required notices. Start it over stdio from the main process. Do not depend on finding an arbitrary user-installed CLI version or scrape a ChatGPT/Codex desktop interface. Existing CLI users may sign in through the same official flow, but the companion uses its dedicated profile and does not copy another application's auth files.

Use signed macOS builds with notarization and signed Windows installers. Verify signed update manifests/artifacts and retain an explicit manual-update path. Do not promise unattended updates until they are tested. Signing certificates, notarization credentials and download hosting are release prerequisites; never publish unsigned builds as production-ready.

## DC-02: authentication and model selection

Use the runtime's documented official authentication flow. Subscription credentials remain within its isolated device profile/credential store and never traverse Boardy's browser or Supabase. Do not collect a ChatGPT password or pasted session token. Distinguish signing out of Codex from disconnecting the paired Boardy browser.

Call App Server `model/list` with pagination on successful connection and explicit refresh; normalize to ModelDescriptor. Keep exact model identifiers and runtime-reported reasoning choices. Bind cache to runtime profile/version/reconnection. Preserve the user's selected model for subsequent runs; the runtime default does not silently override it.

Use structured-output turns to produce the shared schemas. Do not enable experimental dynamic tools merely to generate a board: shared local validation and layout building are sufficient. If a selected runtime/model rejects a task, return a typed error with no API fallback.

## DC-03: loopback pairing and protocol

Expose a narrow bridge on loopback only. App Server itself remains stdio-only and is never exposed as a raw browser RPC endpoint. Bridge operations: pair/status, list-models, generate/stream, cancel and revoke. Reject unknown operations and arbitrary filesystem paths, URLs, process arguments or Codex configuration.

Use an app-owned deep-link scheme to launch pairing with a random one-time challenge and an allowlisted Boardy origin. The native app shows the origin and account binding for explicit approval. Return the local endpoint through a state-bound callback to the approved web origin; never accept an arbitrary redirect URL. The one-time challenge is not an enduring credential. Exchange it for an in-memory expiring bridge token using exact Origin/Host validation and a short expiry. Keep tokens out of URLs, logs and analytics after exchange.

Register the paired device through authenticated Boardy endpoints; bind subsequent run permits to that user/device and challenge-established session. Use an isolated OS credential store for any persistent device secret. The browser supplies a fresh signed backend permit for each generation, enforcing ordinary Boardy auth/capability/concurrency policy. Check signature, audience, device, request ID, model and deadline before dispatch. Track consumed permits to prevent replay, including after application restart.

Local requests require both the paired bridge token and the bounded run permit where applicable. Reject wildcard CORS, non-loopback Host, unknown/null origins and DNS rebinding attempts. Never grant a generic native IPC API to remote content.

Verify HTTPS-site-to-loopback behavior, browser local-network permission handling and callback delivery on supported browser/OS combinations. A denied permission produces an actionable disconnected state. If a browser cannot support the protected bridge, mark that transport unsupported there; do not weaken TLS, Origin checks or pairing. API-key connections remain explicitly selectable.

## DC-04: runtime isolation and lifecycle

Use a dedicated configuration/profile and empty working directory. Disable inherited project instructions, user plugins/MCP, shell/code execution, web search, arbitrary file access/mutation and unrelated tools through supported runtime controls. Deny escalation requests; do not reinterpret `approvalPolicy=never` as a sandbox by itself. Enforce filesystem and network restrictions in the runtime/OS boundary while retaining only required provider communication.

Before choosing the pinned release, demonstrate these controls on both operating systems. If the runtime exposes an unavoidable tool or cannot isolate context, the companion release is blocked until a supported safe configuration exists. Prompt instructions are not a substitute. Document exact settings and evidence when implemented; this documentation does not claim they have been tested.

Apply the same request/output limits and shared validation as the API path. Cancel propagates to the active turn and terminates the child process after a bounded grace period if necessary. Deadline/process crash/interrupted stream release the backend lease via completion or expiry. Device revocation prevents new permits and stops active runs where reachable.

Keep Electron context isolation and renderer sandboxing enabled; disable Node integration in renderer UI. Validate IPC sender and payload. The companion renderer never displays executable model HTML; UI prototypes render through the web application's hardened preview. Diagnostics contain versions/status only, not prompts, account tokens or board content.

## Completion evidence

Supply installation/sign-in/pairing/model-list/generation/cancel/disconnect/update evidence on macOS and Windows. Include blocked-origin and replay tests, malicious local-file/tool requests, offline companion behavior and version incompatibility. Separate a development executable from a signed distributable. API feature success does not imply companion readiness.
