# Sources and implementation baseline

Reviewed 2026-09-16. Repository baseline: `7fa6d450bbd1bbfb31670e5373b463cd5e04f33b`. External documentation is living material; pin version-specific contracts before implementation. Source observations below are distinct from proposed design.

## Local evidence

Paths are relative to repository root.

| Source | Observed fact |
| --- | --- |
| `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`, `CLAUDE.md` | Current identity, design direction, engineering conventions; pricing is marketing-only |
| `packages/excalidraw/package.json` | Local editor version 0.18.0 |
| `packages/excalidraw/data/json.ts` | `serializeAsJSON(elements, appState, files, type)` with local/database modes |
| `dev-docs/docs/@excalidraw/excalidraw/api/props/excalidraw-api.mdx` | Native imperative editor API |
| `excalidraw-app/site/AtelixRouter.tsx` | Current auth and app routing |
| `excalidraw-app/data/supabaseCollab.ts` | Browser encryption, ciphertext/IV persistence, read/reconcile/upsert; encrypted room files |
| `excalidraw-app/collab/SupabaseCollaborationSocket.ts` | Private channel, broadcast/presence, direct room membership insert |
| `supabase/migrations/20260915145909_atelixboard_collaboration.sql` | Existing room membership RLS, encrypted scenes, private board-files with 4 MiB limit |
| `supabase/migrations/20260915151213_index_board_members_user_id.sql` | Membership user index |
| `supabase/migrations/20260915151833_board_file_cleanup_policy.sql` | Existing member file deletion policy |
| `vercel.json` | Static app build and route fallback, not a persistent Docmost service |

## Official upstream sources

- [Excalidraw editor props and API](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/): use the native integration surface; validate against this repository's version.
- [Docmost repository](https://github.com/docmost/docmost): product scope, source, and split between AGPL core and enterprise directories.
- [Docmost documentation](https://docmost.com/docs/): collaborative documents and feature editions.
- [Docmost diagrams](https://docmost.com/docs/user-guide/diagrams): existing diagram and Excalidraw capability; adding the two editors alone is not differentiated.
- [Docmost API guide](https://docmost.com/docs/user-guide/api): REST API requires an active enterprise license; personal keys inherit user permissions and can expire/revoke.
- [Docmost API reference](https://docmost.com/api-docs): canonical upstream reference. The page loads the [Scalar OpenAPI specification](https://registry.scalar.com/@docmost/apis/docmost-api@latest?format=yaml), retrieved on 2026-09-16, reporting API version 1.1.0. Response envelope, POST action style, and pagination were verified. This is a conventions reference, not a community API-key entitlement.
- [Docmost installation](https://docmost.com/docs/installation): separate server, PostgreSQL, Redis, persistent storage, reverse proxy/websocket requirements; `/api/health` is documented.
- [Docmost core license](https://github.com/docmost/docmost/blob/main/LICENSE): AGPL obligations require review for the intended distribution/hosting approach.
- [Docmost enterprise license](https://docmost.com/enterprise-edition-license): commercial components have separate terms and are excluded from the chosen community-only design.
- [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization): private channels and RLS; authorization/session behavior must be considered during revocation.
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control): private storage authorization through policies.

## Evidence limitations

The public Boardy application is login-gated. These docs rely on source inspection for current implementation and do not claim authenticated production testing. Docmost upstream source was read at `6205bbeb908fe846f87dd6a2cbf562e24777db38` (package version 0.96.0). No Docmost tenant, production schema, custom bridge, permission sync, or end-to-end integration was exercised. No customer interviews, traction, founder biography verification, or sourced market counts were established. Performance, pricing, retention, TAM/SAM/SOM, and go-to-market statements are explicit hypotheses or targets.

## Community-source review update

The source inspection and open-source-only decision are detailed in [Open-source integration](DOCMOST-OSS-INTEGRATION.md). Source files can be verified at the [pinned upstream revision](https://github.com/docmost/docmost/tree/6205bbeb908fe846f87dd6a2cbf562e24777db38). The live API spec version (1.1.0) and repository package version (0.96.0) identify different artifacts; they are not a claim of matching releases.
