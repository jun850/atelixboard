# Agentic board documentation

Status: **proposed implementation**, captured 2026-09-16. This package is a documentation handoff, not evidence that the feature is implemented or authorization to deploy production changes.

Baseline inspected: `1ada5312897ec88d3515b8fc979911fda966d96a`. Recheck the checkout before implementation. The user approved personal API keys, a macOS/Windows Codex companion, user-selected available models, preview before applying changes, built-in and personal templates, and no initial paywall.

## Local development implementation

A development-only test build is now available. See [local testing, evidence and remaining scope](LOCAL-TESTING.md). The full PRD and companion are not complete; the plans below remain the production target. Session-only local API keys were explicitly selected for this test build. The subsequent user request also adds local Codex and Claude Code subscription sign-in through their official runtimes; see the testing guide for versions and remaining installer work.

## Reading order and ownership

First read [repository instructions](../../AGENTS.md), [product context](../../PRODUCT.md), and [design context](../../DESIGN.md). The existing editor is the visual authority for this feature; landing-page styling does not override editor components.

| Document | Purpose | Primary readers |
| --- | --- | --- |
| [Vision](VISION.md) | Product purpose, audience, boundaries, measures | Everyone |
| [PRD](PRD.md) | Numbered requirements and acceptance traceability | Everyone |
| [Template catalog](TEMPLATE-CATALOG.md) | Complete initial catalog and customization contracts | Frontend, backend, QA |
| [API contracts](API-CONTRACTS.md) | Shared types, operations, events, limits, errors | Everyone before parallel work |
| [Frontend plan](FRONTEND-PLAN.md) | Editor integration, state, preview and application | Frontend |
| [Backend plan](BACKEND-PLAN.md) | Supabase, secrets, providers, access and lifecycle | Backend |
| [Desktop companion](DESKTOP-COMPANION-PLAN.md) | Codex runtime, pairing, isolation, distribution | Companion, backend, QA |
| [QA end to end](QA-E2E.md) | Steps, expected results, and evidence | QA and all implementers |
| [Implementation plan](IMPLEMENTATION-PLAN.md) | Sequencing, ownership, milestones and gates | Coordinating agent |

## Decisions that agents must preserve

- Bring your own provider. No Boardy-funded inference, checkout, or paywall in this release. Keep one capability authorization boundary for future premium access.
- OpenAI and Anthropic API keys are stored in Supabase Vault. Codex subscription credentials stay on the user's device.
- Users choose a model discovered from the active connection; no fixed commercial model allowlist or silent substitutions.
- The agent drafts and repairs privately. The user explicitly applies changes; accepted changes use native canvas editing, undo, collaboration and persistence.
- Ship all 29 built-in templates in the catalog and private user-saved templates.
- Wireframe-to-UI produces sandboxed HTML/CSS/JavaScript previews and export, not deployed applications.
- Generate only board objects and UI prototypes. Video, audio, arbitrary tools and external actions are excluded.
- Ship a desktop installer, not a terminal-only companion, for macOS Apple Silicon/Intel and Windows x64.

## Existing versus proposed

Existing: React/Vite Excalidraw editor; Supabase authentication and encrypted board collaboration; sidebar/library/dialog patterns; text-to-diagram and diagram-to-code callbacks; generated HTML stored with elements. `excalidraw-app/components/AI.tsx` currently calls an external AI backend. The current generated-content iframe is more permissive than this plan permits.

Proposed: provider connection management, Vault-backed user keys, dynamic model discovery, template gallery, private template storage, bounded generation service, reviewed scene operations, hardened UI preview and desktop companion. Existing marketing pricing is not an entitlement system.

## Relationship to the broader product

Read [idea → handoff → detail](../idea-to-handoff/README.md) for the broader workspace vision. AI-generated canvas PRDs are editable visual planning artifacts. They do not publish a handoff, assign an owner, create a Docmost document or imply acceptance. Existing formal-document requirements remain separate. This package deliberately brings richer canvas templates into this feature release; it does not advance every later-phase capability in the broader PRD.

## Source baseline and uncertainty

- [Excalidraw use cases](https://plus.excalidraw.com/use-cases) rendered a video but no readable full catalog during research. The user accepted the comprehensive catalog in this package rather than exact reference parity. [Homepage](https://plus.excalidraw.com/) verified meetings, brainstorming, diagrams, interviews, wireframes, UML and presentations. Templates must be original, not copies of paid assets.
- [Codex App Server](https://developers.openai.com/codex/app-server) documents authentication, structured outputs and `model/list`. Use stdio; its direct WebSocket transport was marked experimental during research.
- [OpenAI models](https://platform.openai.com/docs/api-reference/models/list) and [Anthropic models](https://platform.claude.com/docs/en/api/models/list) describe discovery. Discovery is not a guarantee that every returned model supports every operation.
- [Claude credential rules](https://code.claude.com/docs/en/legal-and-compliance) restrict third-party subscription credential handling. Claude API keys and end-user sign-in through an unmodified Claude Code runtime are supported paths. Do not collect or proxy Claude.ai session credentials. This clarification follows the current rules verified on 2026-09-17 and the user’s subsequent subscription-login request.
- [Supabase Vault](https://supabase.com/docs/guides/database/vault), [Function secrets](https://supabase.com/docs/guides/functions/secrets), and [Function limits](https://supabase.com/docs/guides/functions/limits) inform the backend boundary.

Reverify external APIs, policy, runtime restrictions and packaging requirements against pinned versions during implementation. Record evidence; do not convert documentation assumptions into claims of tested support.
