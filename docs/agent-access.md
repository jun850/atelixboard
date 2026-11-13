# Boardy agent access

## Existing interfaces and sources

- Start at [the documentation index](README.md). [Cloud architecture](cloud-scenes/ARCHITECTURE.md), [cloud API contracts](cloud-scenes/API.md), [workspace permissions](workspace/PERMISSIONS.md), and [migrations](../supabase/migrations/) describe private scenes, revisions, assets, ownership, and access. [Idea-to-handoff contracts](idea-to-handoff/API.md) and [data model](idea-to-handoff/DATA-MODEL.md) govern that subsystem; documents marked as plans remain proposals.
- [Discovery](discovery/README.md) describes public guides, Markdown, sitemap, AI manifest, visibility studio, and rollout evidence. Consult current routing before claiming a guide host or delivery path. [Competitor MCP research](discovery/prompting-company-mcp.md) is reference material, not Boardy's tool contract or a runtime dependency.
- Private boards, invitations, assets, revision history, and subscription access retain existing permissions and entitlement checks. Public documentation MCP access does not grant workspace or owner-studio access. Preserve [billing requirements](REVENUECAT_WEB.md) and subsystem operations/release gates.

## Existing public documentation MCP

The repository routes `/mcp` to the discovery handler. It is a public, read-only JSON-RPC interface: no account credentials are required and no private board operations are exposed. Authoritative sources are [HTTP handling](../supabase/functions/discovery/index.ts), [base methods/tool schemas](../supabase/functions/_shared/discovery-mcp.ts), and [published-content adapter](../supabase/functions/_shared/studio-mcp.ts). Verify deployed behavior separately.

| Interface | Input and result |
| --- | --- |
| `initialize`, `ping`, `tools/list` | Protocol/capability negotiation, empty ping result, or current tool schemas. |
| `get_boardy_facts` | Empty object; text content containing canonical public product/access facts. |
| `search_boardy_docs` | `query`: nonblank string, at most 200 characters; text content with matching published guide Markdown or a no-match message. Current adapter searches published titles and returns up to 25 rows. |
| `resources/list` | Optional numeric-string `params.cursor`; returns published Markdown resource URIs/names, 25 per page, with `nextCursor` when the page is full. |
| `resources/read` | Exact published guide Markdown URI in `params.uri`; returns Markdown content, or an unknown-resource error. |

Use `tools/list` as the current input-schema authority. Search does not advertise a cursor in its tool arguments or return a continuation token; use `resources/list` to enumerate the published library. Do not promise full-text search or exhaustive results from a single search call.

HTTP requires POST, allows absent Origin or the two configured Boardy origins, bounds request bodies to 16,384 characters/declared bytes, and checks supplied protocol-version headers. Invalid JSON yields HTTP 400; method, origin, size, and backend failures may yield 405, 403, 413, and 503. JSON-RPC errors cover invalid request, invalid parameters, unknown tool/resource, and unsupported method. Notifications return HTTP 202. Consult the handler for exact shapes.

Reads can record aggregate request analytics; they do not mutate customer workspaces or publish content. No general request-rate quota or guaranteed retry schedule is established by this guide. For transient failures, use bounded backoff; retrying a public read must never trigger a private write. Keep owner publication, device pairing, and private studio authentication separate.

## Engineering defaults

Apply this guide when changing public discovery, APIs, MCP tools, backend boundaries, or database models. Treat authorized agents as users across discovery, evaluation, and task completion. Choose the smallest useful implementation and reuse current contracts and services. Add MCP tools, abstractions, dependencies, or schema changes only for a concrete supported workflow.

Keep approved public information readable in ordinary HTML, with stable canonical links and structured data matching visible content. Reuse the existing publishing and sitemap pipeline. Markdown mirrors and llms.txt are optional conveniences; accessibility alone does not prove indexing, recommendations, or revenue.

Document API/tool purpose, inputs, outputs, authentication, authorization, side effects, errors, pagination, and retry behavior alongside the authoritative implementation. Use consistent domain terminology and link schema/migration sources rather than copying a second schema. Keep public documentation to approved interface details and synthetic examples; never publish credentials, private records, signed URLs, or sensitive operational configuration.

## Access and crawler policy

Public discovery does not authorize access to private records or consequential actions. Agents inherit the same ownership, role, consent, payment, and human-review requirements as other clients. Keep public reads, authenticated reads, and writes distinct. Raw databases, private schemas, customer documents, supplier provenance, and internal economics are not crawl targets.

Crawler intent cannot be established from a user-agent string. Verify provider identity when supported and enforce authorization, bounded pagination/query cost, quotas, backoff, and targeted controls against scraping, enumeration, or abusive extraction. Preserve legitimate visitors, search, authorized agents, provider webhooks, and scheduled jobs. Robots directives express preferences rather than enforce access; publicly readable information cannot reliably exclude competitors. Do not promise complete competitor blocking or grant broad access to an alleged friendly bot.

Future enforcement changes need current provider documentation and task-specific verification. Start from observed behavior and narrow controls rather than a site-wide IP allowlist or blanket AI block. This documentation update activates no new enforcement, API, schema, or MCP server.

## Verification for future implementation

Check public retrieval without login or JavaScript where intended; ensure visible content and metadata agree. Exercise missing credentials, foreign-owned records, expired access, and permitted roles for private interfaces. Test bounded queries, pagination, retry behavior, and required human approval for affected actions. Maintain normal customer and webhook flows.

Report source changes, local checks, deployed behavior, verified crawler activity, indexing/referrals, and successful authorized actions separately. A spoofed user agent tests routing only. Run the subsystem's documented checks for later runtime changes; this documentation-only update requires link, scope, and instruction-consistency checks.

## Source and status

Owner policy recorded 13 November 2026, inspired by [Welcome to the B2A Economy](https://www.a16z.news/p/welcome-to-the-b2a-economy) (a16z, 11 November 2026). The article motivates agent-facing distribution; the security and implementation requirements here come from the owner. Its market statistics have not been independently verified. Repository source establishes implementation, not current deployment; use the linked verification/operations documents before claiming live availability.
