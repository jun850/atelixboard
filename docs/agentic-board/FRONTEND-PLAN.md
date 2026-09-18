# Frontend agent plan

Status: proposed. Owns AB-01–03, AB-05–11, AB-14–16 UI behavior. Read [PRD](PRD.md), [catalog](TEMPLATE-CATALOG.md), [contracts](API-CONTRACTS.md), then [QA](QA-E2E.md).

## Boundaries and reuse

Keep Boardy provider/storage logic in the host app. Add upstream editor APIs only when host composition cannot safely implement scene behavior. Relevant existing entry points: `excalidraw-app/components/AI.tsx`, `packages/excalidraw/components/DefaultSidebar.tsx`, and `packages/excalidraw/components/App.tsx`.

| Need | Existing pattern | Implementation decision |
| --- | --- | --- |
| Template discovery | DefaultSidebar, LibraryMenu, library thumbnails | Add Templates tab; reuse layout/interaction patterns without storing templates in the asset library |
| Assistant | Sidebar, TTD chat/preview components | Compose one assistant state machine; preserve manual Mermaid entry |
| Gallery/detail/settings | Dialog, tabs, inputs, buttons, tooltips | Reuse primitives and editor tokens; no new standalone dashboard route |
| Entry points | AppWelcomeScreen, AppMainMenu, CommandPalette | Open the same gallery/assistant state |
| Scene creation | Element conversion, restore/measurement utilities, imperative API | Shared deterministic builders and validated scene transaction |
| Frame-to-UI | DiagramToCodePlugin, generated iframe elements | Adapt normal/magic frames, private preview first, harden generated renderer |

All new browser API usage derives from `app.ownerDocument`/`app.ownerWindow`, or a mounted node's owner document/default view. Use `Merge<Base, Overrides>` for overridden type properties. Do not copy existing global-window usage into new code.

## FE-01: gallery and personal templates

Add search, category filters and Built-in/My templates tabs. A card shows an actual scene thumbnail, title and short purpose. Details show a larger preview and form; actions are Insert template and Customize with AI. Allow keyboard activation without drag. Desktop uses sidebar browsing and existing dialog detail patterns; narrow layouts use the responsive dialog with reachable actions.

Render defaults immediately without a provider. AI customization preserves form values through connection setup and failures. New objects go in available canvas space, not over the selected source by default; fit/select the inserted result after application without disrupting existing content.

Save as template extracts selected native content, displays excluded content and the private-account storage disclosure, and requires a name/category. Generate previews client-side from the snapshot. List metadata in one paginated request; fetch the payload on selection, not once per thumbnail. Locally generated thumbnail caching must be account-scoped and cleared on sign-out. Handle duplicate names without overwriting another template.

## FE-02: connection and model controls

AI connections settings accept OpenAI/Claude API keys with password-style input and clear/save on successful submission; never write keys to localStorage/IndexedDB, analytics or console. Display masked metadata, Test, Replace and Disconnect. Manage local companion installation/pairing separately from API-key entry.

Show connection and exact selected model adjacent to the composer. Search discovered models, expose supported reasoning controls and show incompatible entries with reasons. Unknown capability is not an invented positive flag. Preserve selection per account/connection; require explicit initial selection and reselection after removal. Do not select a paid fallback on any failure.

The browser connects only to the approved loopback companion endpoint and passes a short-lived local run permit. Mobile presents API connections and a clear desktop-only companion explanation. Model switching affects the next generation only.

## FE-03: assistant and review

State flow: `idle → configuring → generating → preview → applying → applied`; generation can end `error`/`cancelled`/`interrupted`, and source verification can enter `conflict`. Refining returns to generating with a new request ID and the existing draft as bounded context. One user-facing busy state prevents duplicate starts.

Before generation show template/output, model and included selection/frame/image. Without selection default to prompt-only. Require explicit whole-board selection. Provider changes must not automatically transmit old conversation. Store conversations/previews in account-and-board-scoped IndexedDB; remove active in-memory content on sign-out and never surface another account's history.

Render native scene drafts in an isolated preview. List additions/updates/deletions and assumptions. Apply and Discard are explicit; closing does not apply. Normal source edits, collaborator events and undo continue independently while generation runs.

For apply, revalidate the result and current scope, compare affected element versions, remap IDs, and submit all changes as one history transaction. Compare per-element versions, not only an aggregate scene version. Reject updates to deleted/changed targets; offer regenerate or insert copy, never overwrite. Prevent the same draft being applied twice. Preserve unrelated customData/history and do not replace the whole live scene from a stale snapshot.

## FE-04: generated UI isolation

The current magic-frame path inserts a pending iframe and streams partial HTML. Refactor this path so generation is private until Apply. The generated-content renderer must enforce a separate policy from ordinary URL embeds.

Build a trusted HTML wrapper with restrictive CSP and an iframe with `sandbox="allow-scripts"` only. Strip navigation, nested documents, remote resources, forms and other excluded features; prohibit network via CSP, including connect, image, media, font and frame destinations except explicitly embedded safe data needed by the renderer. Generated code gets no credentials, app bridge, parent APIs or powerful permissions. The wrapper and sandbox policy apply to saved/imported generated HTML as well as new results.

Do not execute raw streamed HTML or use its content to construct host DOM. Exports happen through a host-owned download button after validation, not iframe download permission. Any messaging is source-checked, schema-checked and nonce-bound; no generic command dispatch. A complete security test, not sanitization alone, is the release gate.

## FE-05: acceptance and evidence

Cover loading catalogs, no models/templates, missing keys, invalid inputs, unavailable companions, quota errors, interrupted streams, conflicts and deleted templates. Preserve user input on recoverable errors. Focus returns to the triggering control after dialogs close; status is announced without stealing focus. Honor reduced motion, light/dark, 320px reflow and 200% text sizing.

Run repository type checks and targeted component tests; inspect desktop/narrow layouts and the full keyboard path. Validate QA-01–05, QA-09–20 and QA-26–28. Record source, automated, browser and unverified device evidence separately. Do not claim UI quality from a build pass alone.
