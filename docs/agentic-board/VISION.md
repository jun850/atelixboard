# Vision: useful visual work through connected AI

Status: proposed. See [index](README.md) and [PRD](PRD.md).

## Purpose and audience

Help individuals and teams turn an intention into an understandable, editable board without assembling every shape themselves. Initial workflows include product discovery, technical explanation, workshops, project planning, and design exploration. A user should be able to describe a goal, choose a familiar template and their own model, inspect the draft, and continue working with ordinary Excalidraw tools.

The core value is a useful visual artifact the user can understand and change. More generated objects, longer conversations or more model calls are not success by themselves.

## Product principles

1. **Keep the canvas familiar.** Templates and AI use existing Excalidraw controls and native elements. The assistant supports the editor rather than replacing it with another application.
2. **Give the user control.** Connection, model, shared context and applied changes are visible choices. Generation never silently spends against another connection.
3. **Make structure reliable.** Versioned templates and deterministic layouts turn model content into legible diagrams and boards. Prompting alone is insufficient for layout correctness.
4. **Preserve private work.** Share selected context deliberately; keep room keys out of generation APIs. A private draft does not become collaborative until applied.
5. **Bound agency.** The agent can reason about the supplied context, draft, validate and repair. It cannot browse, deploy, assign people, execute arbitrary tools or generate unrelated media.
6. **Make reuse practical.** Users can save useful native canvas structures as private templates and adapt them to the next project.

## Relationship to Boardy

This capability strengthens the exploration step of [idea → handoff → detail](../idea-to-handoff/VISION.md). Generated content remains a draft until people decide what it means and who owns the next action. A canvas PRD or kanban does not create an authoritative specification, workflow approval or task synchronization.

Future premium positioning: paid access to assisted creation, iteration and reusable workflows, with users retaining provider choice. The current release has no paywall and no included inference allowance. Do not change landing-page prices or make subscription promises as part of this implementation.

## Success measures

Measure template selection-to-insertion completion, generation-to-apply rate, time to first useful artifact, validation failure rate, repeat template use, provider errors and cancellations. Use explicit apply and save actions as signals, not assumptions about business outcomes. Collect IDs, timing and status only; exclude board text, prompts, HTML, keys and signed URLs from analytics.

Product hypotheses to validate: templates reduce setup effort; preview builds confidence; users value existing provider subscriptions/keys; generated objects remain useful after manual editing. Establish baselines with real sessions before setting conversion or retention targets.

## Boundaries

Support native visual boards and local-interaction HTML prototypes. Defer video/audio/image generation, autonomous external actions, full project management, calendar scheduling, external task synchronization, hosted applications, backend provisioning and React project builds. Presentations are editable frames, not a new slide playback product. A native Codex companion is a connection mechanism, not permission to read arbitrary local files.
