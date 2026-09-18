# Template catalog and customization

Status: proposed; **29 built-in templates**. This is the user-approved comprehensive catalog, not a claim of exact parity with the reference site's inaccessible video/catalog.

## Template definition contract

Each built-in has a stable ID, version, category, search tags, short description, parameter schema, example input, deterministic default content, layout builder, AI content schema and validation rules. Generate thumbnails from actual default scenes. Shared builders cover graphs, trees, grids, lanes, timelines, documents and ordered frames.

Common inputs: title/topic, purpose, audience, detail (`brief`, `standard`, `detailed`), and optional instructions. Style choices map to existing editor color/font/stroke/roughness controls. Do not invent a separate theme system. The model fills content/relationships; code owns IDs, dimensions, spacing, bindings and frame placement.

Gallery categories are fixed for the initial catalog:

| Category | Template IDs |
| --- | --- |
| Diagrams and engineering | flowchart, system-architecture, sequence-diagram, uml-class, entity-relationship, org-chart |
| Brainstorming | mind-map, idea-collection, affinity-map, concept-map |
| Meetings and research | meeting-agenda, interview-plan, workshop-agenda |
| Product and design | prd, user-journey, user-story-map, desktop-wireframe, mobile-wireframe, ui-component-sheet |
| Planning and delivery | kanban, sprint-planning, retrospective, roadmap, gantt |
| Strategy | swot, business-model-canvas, impact-effort |
| Communication | storyboard, presentation-frames |

The numeric values below are product defaults, not mandatory user data. Bound user-customized structures to the common element limit. Use placeholders when real values are missing.

| ID | Template | Specific inputs/default structure | Layout and acceptance checks |
| --- | --- | --- | --- |
| flowchart | Flowchart | Process, 5 steps, decisions | Directed graph; labeled decision edges, valid terminals and bindings |
| system-architecture | System architecture | Actors, 3 system layers, services/connections | Layered containers; services contained, cross-layer edges legible |
| sequence-diagram | Sequence diagram | 3 participants, 6 messages | Lifelines and ordered message rows; participants aligned |
| uml-class | UML class diagram | 4 classes, fields/methods/relationships | Compartmented rectangles; relationship labels preserved |
| entity-relationship | Entity relationship diagram | 4 entities, fields, keys, cardinalities | Entity tables; key labels and cardinalities explicit |
| org-chart | Org chart | 3 levels, roles/reporting lines | Hierarchical tree; one parent per non-root role unless supplied otherwise |
| mind-map | Mind map | Central topic, 5 branches | Radial/tree layout; no orphan nodes or overlapping labels |
| idea-collection | Idea collection | Prompt, 3 idea areas, 3 placeholders each | Framed note grid; empty placeholders distinguishable from generated ideas |
| affinity-map | Affinity map | Ideas, 4 clusters | Labeled grouped notes; each supplied idea represented exactly once |
| concept-map | Concept map | Topic, 6 concepts, labeled relationships | Connected graph; relationship meaning visible |
| meeting-agenda | Meeting agenda and actions | Goal, agenda, decisions, actions | Four sections; action owner/date remain placeholders unless supplied |
| interview-plan | Interview plan and notes | Research goal, participant role, questions | Goal/questions/notes/insights; no fabricated interview findings |
| workshop-agenda | Workshop agenda | Outcome, duration, 4 activities | Timeline/lane layout; supplied time allocations reconcile |
| prd | PRD | Problem, users, goals, scope, requirements, success, questions | Seven text sections; long content wraps and expands frames |
| user-journey | User journey | Persona, 5 stages, actions/pain points/opportunities | Stage-by-row matrix; each stage consistently aligned |
| user-story-map | User story map | Persona, 4 activities, stories, 2 release lanes | Backbone with story cards and release rows |
| desktop-wireframe | Desktop wireframe | Screen purpose, sections, primary action; one screen | Desktop frame with native controls and labeled placeholders |
| mobile-wireframe | Mobile wireframe | Screen purpose, sections, navigation; one screen | Phone-sized frame; readable controls and consistent hierarchy |
| ui-component-sheet | UI component sheet | Component set; buttons/inputs/cards/navigation | Grouped native components with default/selected/disabled examples |
| kanban | Kanban | Columns, cards, optional owners; To do/In progress/Done | Equal lanes; cards fit columns; native visual board, no task backend |
| sprint-planning | Sprint planning | Goal, backlog, capacity, commitments | Four sections; no invented velocity or commitment |
| retrospective | Retrospective | Format; Start/Stop/Continue, actions | Three columns plus actions; format labels configurable |
| roadmap | Roadmap | Themes, horizons, initiatives; Now/Next/Later | Horizon lanes; do not invent calendar dates |
| gantt | Gantt chart | Tasks, supplied dates/durations, dependencies; 5 sample rows | Aligned time axis/bars; invalid dates rejected; undated example is labeled illustrative |
| swot | SWOT | Subject, strengths/weaknesses/opportunities/threats | Labeled 2×2 grid; consistent text containment |
| business-model-canvas | Business model canvas | Business context and nine standard sections | Nine-region layout; assumptions labeled, no invented validated traction |
| impact-effort | Impact–effort matrix | Initiatives, impact/effort labels | Four quadrants and axes; inferred placements labeled suggestions |
| storyboard | Storyboard | Scenario, 6 panels | Ordered frames with native scene placeholders and captions |
| presentation-frames | Presentation frames | Audience, objective, 5 slides | Ordered equal-sized frames; titles/body remain editable |

## Generation and layout rules

1. Normalize inputs and reject structures whose estimated element count exceeds the limit before calling the provider.
2. Ask for template-specific structured content. Prompt text and existing board labels are untrusted data, not tool authority.
3. Validate required sections, relationships, dates and counts. Preserve supplied facts; distinguish assumptions.
4. Build elements using Excalidraw conversion/measurement utilities. Size containers to text, route connections, normalize group/frame membership and place frames outside existing content.
5. Verify finite coordinates, bounded geometry, valid bindings, label containment and the total element cap. Use one model repair only for content/schema problems; deterministic layout correction should not spend a model call.
6. Return a private preview; refinement uses the same template version and user-selected model unless the user changes them.

Large multi-frame requests must offer reduced detail or a staged next generation before exceeding 300 elements. Do not silently truncate content. Presentation and storyboard illustrations remain native shapes/placeholders; there is no generated image/video pipeline.

## My templates

Save selected native primitives, text, arrows, freehand marks, groups, frames, sticky notes, and images as a versioned snapshot, with title and one category. Copy only the binary files referenced by selected image elements; remove comments, links, board/room IDs, generation metadata, embeddables, and executable content. Display exclusions before save and reject an empty sanitized selection. Arrows crossing the selection boundary lose the external binding while preserving their visible geometry.

Personal templates use a generic bounded content-revision schema over that snapshot, not executable layout scripts supplied by the user. Preserve topology by default; the user can request a private revised draft. Each insertion remaps all IDs and bindings and remains independent of the saved source. Renaming/deleting a template never changes previously inserted objects.

## Quality evidence

Maintain a fixture for each ID: default insertion, realistic AI content, long text and maximum supported structure. Each must pass QA-03/QA-04 in [QA](QA-E2E.md). Gallery completion means every listed entry is selectable and tested, not a collection of placeholder cards.
