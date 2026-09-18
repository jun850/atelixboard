# Product requirements

Status: proposed. Normative implementation contracts are in [API contracts](API-CONTRACTS.md); tests are in [QA](QA-E2E.md).

## User journeys

**Template without AI:** open Templates → search/filter → inspect preview → configure structure → insert → edit normally. No provider connection is needed.

**Template with AI:** choose template → supply purpose and parameters → choose connection and available model → inspect context disclosure → generate → refine private preview → apply or discard.

**Free-form request:** open Assistant → describe a goal → see the proposed template/output and scope → generate with the chosen model → review → apply. Users can change the proposed template before generating.

**Existing content:** select native objects/frame → ask for revision → review proposed changes → apply if source versions still match, or regenerate/insert a separate copy after a conflict.

**Wireframe to UI:** select a regular or magic frame → choose compatible model and input mode → generate interactive preview → refine → apply beside source → optionally export HTML.

**Personal template:** select native elements/frame → Save as template → inspect sanitized snapshot → name/categorize/save → retrieve under My templates on another authenticated session.

## Requirements and traceability

| ID | Requirement and acceptance boundary | Owner | QA |
| --- | --- | --- | --- |
| AB-01 | One gallery reachable from sidebar, welcome screen, menu and command palette; search, categories, Built-in/My templates | Frontend | QA-01, QA-02 |
| AB-02 | All 29 catalog entries produce editable, valid native elements, both blank and AI-customized | Frontend/shared | QA-03, QA-04 |
| AB-03 | Save, list, insert, rename and delete private native snapshots; independent IDs on insertion | Frontend/backend | QA-05, QA-06 |
| AB-04 | Connect/test/replace/delete own OpenAI or Claude key; masked metadata only | Backend/frontend | QA-07, QA-08 |
| AB-05 | Discover available models per connection; explicit choice, refresh, capabilities and no silent substitution | Shared | QA-09, QA-10, QA-11 |
| AB-06 | Draft, refine and validate privately; use supplied scope, not the entire board by default | Shared | QA-12, QA-13 |
| AB-07 | Apply once, undo once, preserve manual work; source-version conflicts require a new decision | Frontend | QA-14, QA-15 |
| AB-08 | Accepted output collaborates and survives save/reload using existing encrypted scene handling | Frontend | QA-16 |
| AB-09 | Explicit provider/context disclosure; no room keys, credentials or content in logs | Shared | QA-08, QA-13, QA-25 |
| AB-10 | Generate self-contained interactive HTML from a regular/magic frame; preview, apply and export | Frontend/backend | QA-17, QA-18 |
| AB-11 | Bound runtime/output; stop, errors, retries and duplicates cannot apply partial/duplicate changes | Shared | QA-19, QA-20 |
| AB-12 | macOS/Windows companion authenticates through Codex, pairs securely and lists runtime models | Companion | QA-21, QA-22, QA-23 |
| AB-13 | Agent cannot escape permitted output/tool scope, including through malicious context | Shared | QA-18, QA-22, QA-24 |
| AB-14 | Keyboard, mobile, light/dark, long-content, empty/error and disconnected states work | Frontend/companion | QA-02, QA-26 |
| AB-15 | Signed-in access without paywall; one future entitlement boundary; no provider fallback or platform-funded usage | Backend/frontend | QA-10, QA-27 |
| AB-16 | Existing manual editor, library, Mermaid and external embed behavior remain usable | Frontend | QA-28 |

## Interaction rules

- New generations require an authenticated Boardy session; manual templates work within the authenticated editor without AI credentials.
- A connection is personal. A collaborator can edit an applied result but cannot use the author's provider connection or read their draft/history.
- With no selection, use prompt and template parameters only. Full-board context is opt-in and bounded. Show text/element/image inclusion before transmission.
- Missing facts use labeled placeholders. Do not invent participants, dates, owners, dependencies or product commitments as confirmed facts.
- On model change, preserve conversation and draft locally. Sending earlier conversation/context to a different provider requires the same disclosure; never replay it automatically.
- Applied artifacts are normal editable objects. Editing does not automatically call a model or maintain live synchronization with a template.
- Save as template explicitly copies selected content from the encrypted board into owner-private account storage. RLS privacy is not equivalent to the board's end-to-end encryption.

## Scope defaults and release prerequisites

Limits, error semantics and persistence policy are centralized in [API contracts](API-CONTRACTS.md). Support all catalog entries before declaring the gallery complete. Support API keys on mobile; Codex pairing requires a running companion on the same desktop.

Desktop signing/notarization credentials, public download infrastructure, permitted provider accounts and verified runtime restrictions are release prerequisites. Missing prerequisites must be reported as unverified/blocked release gates, not silently replaced with terminal installation or insecure execution.
