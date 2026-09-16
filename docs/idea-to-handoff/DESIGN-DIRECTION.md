# Design direction

**Canvas first. One clear handoff. Detail when it helps.**

Preserve Boardy by Atelix and the current repository's design foundations. This is a product workspace, so emphasize orientation, legible controls, and restrained feedback over landing-page decoration.

## Information architecture

```text
Workspace
├── Home                 recent projects and your pending handoffs
├── Projects
│   └── Project
│       ├── Canvas       default working surface
│       ├── Handoffs      pending, accepted, completed
│       ├── Files         project files and their versions
│       └── Documents     linked detail with source handoff
└── Settings              members and integrations
```

Proposed routes: `/app/projects`, `/app/projects/:projectId`, `/app/projects/:projectId/boards/:boardId`, `/app/projects/:projectId/handoffs/:handoffId`, and `/app/inbox`. Extend the current routing deliberately; these routes do not yet exist.

## Main composition

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Boardy     Acme / Checkout redesign                    Members   ⋯    │
├─────────────┬────────────────────────────────────┬───────────────────┤
│ Canvas      │                                    │ Hand off          │
│ Handoffs  3 │       Existing Excalidraw canvas    │ Selected idea     │
│ Files       │                                    │ [snapshot]        │
│ Documents   │       Selection → Hand off         │ Owner             │
│             │                                    │ Next action       │
│             │                                    │ What done means   │
│             │                                    │ [Send handoff]    │
└─────────────┴────────────────────────────────────┴───────────────────┘
```

The panel opens only when relevant; it should not permanently reduce drawing space. Preserve editor shortcuts and its existing toolbar. The recipient view prioritizes snapshot → next action → success criterion → response. After acceptance, replace the response area with execution status and **Add detail**. Do not present a blank document editor as the first step.

## Visual system

Use existing tokens from `DESIGN.md`: warm white surfaces, ink `#111827`, muted `#667085`, cobalt `#2f6ce5`, deep blue `#183269`, mist `#f3f7ff`, and border `#dfe6f1`. Keep Assistant as the existing family. Reuse actual components before adding equivalents.

Use a compact rem-based type scale, clear medium-weight labels, tabular dates/counts, and a 4/8 px spacing rhythm. Canvas gets the largest area. Hairline borders separate regions; reserve shadows for overlays. Use one primary action per decision area. Color supplements text and icons rather than carrying status alone. Verify contrast, including white text on cobalt, before choosing final button styles.

Proposed dimensions: desktop navigation 176–208 px; contextual panel 320–384 px; readable handoff text up to 68 characters wide. These are responsive constraints, not fixed screenshot coordinates. At narrow widths, navigation collapses and handoff becomes a full-height sheet/page. Support 320 px without horizontal form scrolling. Keep canvas pan/zoom native.

## Copy and states

| Situation | Direction |
| --- | --- |
| Empty inbox | “No handoffs waiting for you.” Offer access to projects |
| Empty project | “Start with an idea.” Primary action: Open canvas |
| Send preview | “This selection will be readable by project members.” Show actual audience and content |
| Acceptance | “Accept handoff” and “Request changes” |
| Accepted | “You own the next step.” Show next action and Add detail |
| Provider unavailable | “Document creation is unavailable. You can export this brief.” |
| Stale edit | “This handoff changed. Review the latest version before saving.” Preserve draft |
| Missing file | Explain which item needs recovery or removal |

Do not say “encrypted” about published handoff snapshots merely because transport and storage use encryption. Distinguish browser-encrypted boards from server-readable project content.

## Accessibility and motion

Meet WCAG 2.2 AA for the new workflow surfaces: labeled inputs, visible keyboard focus, logical reading order, screen-reader status announcements, accessible dialogs, and focus restoration. Aim for 44 px touch targets. Keep transitions around 150–200 ms; respect reduced motion. Do not animate workflow changes in a way that hides state or moves the acceptance button unexpectedly.

## Visual acceptance

Review desktop and narrow phone layouts with real titles, long names, missing images, many files, and permission errors. Confirm selection is identifiable without color alone, text remains readable at zoom, panel does not steal editor keyboard events, and every primary action has a clear post-action state. No fabricated activity, testimonials, or customer logos in empty states.
