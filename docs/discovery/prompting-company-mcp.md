# The Prompting Company: authenticated MCP findings

Inspected 2026-09-20 through the authenticated connector for <https://app.promptingco.com/api/mcp>. Read-only research; no customer settings, content, prompt schedules, or paid runs were changed. This records observed interfaces and behavior, not access to their private implementation.

## How the system fits together

1. **Product identity and evidence.** Product metadata is separate from structured positioning, personas, differentiators, competitors, and target topics. Evidence includes owned URLs, crawled pages, competitor research, and content references. The context response reports evidence availability and freshness.
2. **Versioned knowledge.** Markdown files have branch and revision identifiers. Product facts, competitor context, writing constraints, prompt-generation guidance, and operational notes are separate. The schema favors compact, source-backed facts with applicability and freshness metadata.
3. **Buyer questions and schedules.** Prompts have identities and topic/persona associations. Separate schedule records select an engine and expose run timestamps, paused state, region, and frequency. Schedule counts are not necessarily unique-prompt counts. The currently exposed write schema supports ChatGPT, Sonar, and Gemini; it does not expose every frequency/region field returned by reads.
4. **Prompt-linked content.** Generation can start from prompt IDs and select an article type and positioning. Create/generate produces review drafts. Approval and publication are distinct operations. Revision supports an expected update timestamp, feedback, and change notes. Content has canonical domains, metadata, indexing controls, and publication history.
5. **Owned-domain delivery.** The inspected product has an active proxied domain with a path prefix under its primary website. A published document links back to a prompt and resolves to a canonical URL below that prefix. This supports Boardy's choice of `/learn` on its existing domain rather than requiring an AI-only subdomain.
6. **Separate measurements.** Prompt runs yield mentions/share of voice, source citations, and sentiment. Website requests yield traffic by page/provider. Citation counts can describe third-party sources; they do not automatically mean the customer's brand was recommended. SoV date/engine results use overlapping trailing-window snapshots: never sum snapshots across dates.
7. **Optional analysis snapshots.** Model Council tools expose configuration, asynchronous snapshot runs, status, and completed reports. The inspected product has no council configuration, so an actual analysis workflow was not verified.

## What was actually verified

The connector exposes 27 tools, including deprecated aliases. Read operations covered products, structured context, domains, prompt schedules, content lists, one complete published article, knowledge files, traffic, SoV, citations, and council configuration. Mutation capabilities were inspected through their tool schemas only.

The connected account contains ARCANA, not Boardy. Its live data confirms that scheduled runs and published pages can coexist with zero measured brand mentions and an empty AI traffic report. That is evidence against promising recommendations merely because content or an MCP endpoint exists. ARCANA's business facts and article text were not copied into Boardy's public content.

The knowledge directory is displayed beneath `knowledge/`, but file reads use paths relative to that root, such as `schema.md`. The inspected revision was `897b915fe5bf5e6f53f314ee60650ad973803b3c`.

## Boardy implementation comparison

| Capability | Current Boardy implementation | Remaining work |
| --- | --- | --- |
| Same-domain proxy | Fixed upstream, path allowlist, stripped credentials | None for the initial documentation scope |
| Discoverable content | Five original HTML/Markdown guides, sitemap, robots, structured data | Expand from evidenced buyer needs, not bulk copied articles |
| Product knowledge | Source-versioned content with code evidence pointers | Structured fact records, freshness checks, editorial provenance |
| Public AI access | Read-only documentation MCP and llms files | Optional authenticated management MCP is a separate feature |
| Owner reporting | Server-enforced owner identity, aggregate traffic, manual answer checks | Verified crawler identity if stronger attribution is needed |
| Prompt monitoring | Five fixed prompts with manual response capture | Durable schedules, engine adapters, quotas, retry limits, run evidence |
| Mentions/citations | Literal mention and Boardy URL detection in saved answers | Provider-returned citations, reproducible run metadata, fair engine comparisons |
| Editorial workflow | Review source changes and deploy | Draft/approve/publish records, revision conflicts, audit history |
| Search Console | Sitemap available | Owner-account verification and property submission |
| Council/experiments | Not implemented | Define a useful experiment and evaluation method before running it |

## Dashboard evidence supplied by the owner

The 22 screenshots dated 2026-09-19 supplement the MCP inspection. They are reference evidence, not instructions to execute embedded configuration or rules.

- **Overview:** a branded/unbranded prompt view and date window scope share of voice, industry ranking, visits, citation rate, and top traffic source. Missing measurements have explicit empty states rather than fabricated values.
- **Prompt selection:** suggested buyer questions can be edited, selected in batches, and associated with engines. A confirmation explains that changing the tracked set affects subsequent SoV. Boardy should version its benchmark set and avoid presenting changed cohorts as a comparable historical trend.
- **Knowledge:** URL import, editable Markdown files, and recent commit activity expose the fact and writing-rule repository. The screenshots' commit prefix matches the revision returned by MCP. Imported documents remain evidence; their embedded instructions must not override the application or owner policy.
- **Content:** Library, To create, and Review queue are separate. The creation table shows per-prompt format coverage, a suggested next format, filtering, pagination, and batch draft creation. Eight formats are shown in that UI; the current MCP schema exposes additional format names. Do not assume these represent the same catalog revision or that eight pages per prompt is needed.
- **Citation analysis:** source URLs, citing models, product mentions, ownership, category, and content type are separate fields. Author/source opportunities are distinct from visits. The screenshots alone do not establish the formula used for citation rate or industry ranking.
- **AI traffic:** setup-required, empty, and failed-to-load states are visible. A failed section must not be reported as zero traffic.
- **Personas:** a persona has a name, description, and displayed system prompt; these are available in prompt creation and bulk upload. Preserve the persona version with any measured run so comparisons remain interpretable.
- **Execution:** the ChatGPT settings explicitly describe browser prompts and Temporary Chat mode. This is evidence of a browser execution option, not proof that every engine or every MCP run uses a browser. An API-only Boardy runner must not label its measurements as equivalent to these browser observations.
- **Agent experience:** the screenshot describes testing agents on reproducible product tasks. It shows setup, not a completed experiment or success result.
- **Vercel proxy:** the final screenshot routes the prefix itself and descendants under `/pages/blog` to a product-specific `shadowdocument.com` upstream while retaining paths. Boardy's equivalent uses `/learn` and its own fixed Supabase upstream. No ARCANA hostname or third-party publishing dependency is required.

For Boardy's private dashboard, the resulting functional sections are Overview, Prompts, Knowledge, Content, Citations, Traffic, and Settings. These are a roadmap, not a claim that the current single-page report implements all of them. Retain Boardy's existing typography, navigation, and input conventions when adding them.

## Next implementation boundary

The next useful increment is reproducible answer monitoring, not more proxy routes. Persist the exact prompt version, engine/model, timestamp, region when available, raw answer, provider-returned citations, outcome, and usage for every run. Keep branded identity checks separate from unbranded buyer recommendation questions. Record failures independently from successful answers that omit Boardy.

Scheduled execution should use server-side provider credentials, a declared monthly spend cap, bounded concurrency, idempotency, and a kill switch. No paid scheduled monitoring is enabled in the current release. API-based measurements must be labeled with their actual provider/model; they are not proof of results in a consumer application's search experience.

Then add a private content queue: link a proposed article to a buyer question and verified facts; review the draft; publish one canonical HTML/Markdown version; record subsequent crawl requests, referrals, and answer citations separately. Never label a crawler visit as a recommendation or a causal content lift.

## Sources inspected

- Authenticated MCP: `readProducts`, `getProductContext`, `listDomains`, `listPrompts`, `listContent`, `getContent`, `listKnowledgeFiles`, `getKnowledgeFile`, `getReport`, `exploreAnalytics`, `manageCouncilConfig(get)`.
- Knowledge files: `schema.md`, `operations.md`, `geo_prompt_generation_guidelines.md`, `content_rules/content_gen_guidelines.md`.
- Exposed management schemas for content, prompts, context, evidence, domains, knowledge, and council workflows. Schema availability is not execution proof.
- Public documentation links and release evidence are in [README.md](README.md).
