---
name: Boardy AI Visibility Studio
description: A compact operations dashboard in Boardy's white, mist, and cobalt palette.
colors:
  studio-ink: "#18202e"
  studio-muted: "#667085"
  studio-accent: "#2f6ce5"
  studio-line: "#e2e6ed"
  studio-paper: "#fff"
  studio-soft: "#f5f7fa"
  sidebar-mist: "#f8f9fb"
  field-line: "#d9dee6"
typography:
  headline:
    fontFamily: "Assistant, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Assistant, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Assistant, Arial, sans-serif"
    fontSize: "16px"
    lineHeight: 1.5
  label:
    fontFamily: "Assistant, Arial, sans-serif"
    fontSize: "14px"
rounded:
  control: "6px"
  panel: "8px"
  dialog: "10px"
spacing:
  compact: "8px"
  control: "12px"
  group: "16px"
  section: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.studio-accent}"
    textColor: "{colors.studio-paper}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  text-field:
    backgroundColor: "{colors.studio-paper}"
    textColor: "{colors.studio-ink}"
    rounded: "{rounded.control}"
    padding: "9px 11px"
---

# Design System: Boardy AI Visibility Studio

## Overview

This contract applies only to the AI visibility studio at `/app/visibility` and its article editor. It does not replace the root product or design documents. The user-supplied Prompting Company screenshots govern the dashboard's navigation, layout, density, tables, and dialogs; Boardy's white, mist, and cobalt identity governs its palette.

The implemented source is `excalidraw-app/site/VisibilityPage.tsx`, `VisibilityPage.scss`, and `site/discovery/ArticleEditor.tsx`. The interface favors compact controls, readable rows, and explicit actions over decorative surfaces.

Local fixture screenshots in `.impeccable/review/` record content, prompts, mobile, and corrected editor/preview states: `studio-content.png`, `studio-prompts.png`, `studio-mobile.png`, `studio-editor-fixed.png`, and `studio-preview-fixed.png`. These are fixture evidence, not production authentication or complete end-to-end verification. The editor reading-width review correction is implemented in both edit and preview modes.

## Colors

Cobalt identifies primary actions and selected navigation. White supplies the working surface; mist separates sidebar, table headers, and batch actions. Ink supports titles and article text, while muted slate distinguishes supporting copy. Neutral lines divide rows and bound panels without making every section a card.

**The Restrained Accent Rule.** Use cobalt for actions and state, never to decorate editable text-field borders or focus halos. Success and error treatments retain text labels so meaning does not depend on color alone.

## Typography

Assistant is the shared interface and article face, with Arial and sans-serif fallbacks. Page titles lead a compact hierarchy: section titles, smaller subsection headings (17px, weight 600), body, table text (15px), labels, and supporting metadata (12–13px). Table numbers use tabular numerals.

**The Reading Measure Rule.** Center article body and preview prose at a maximum width of 74ch. Keep the modal header, title, description, and toolbar available across the wider editor. Knowledge-file text has a separate 72ch cap. Long URLs and knowledge text wrap rather than force the page wider.

## Layout

Desktop uses a sticky, independently scrollable 264px sidebar beside a flexible content column. A 66px top bar anchors the page; main content has 32px horizontal padding and a maximum width of 1800px. Section gaps generally use 24px. Metrics form a five-column strip, while related panels use two columns.

At 1100px and below, the sidebar narrows to 220px, main padding becomes 24px, and metrics use three columns. At 700px and below, the sidebar becomes a horizontal scrolling navigation strip above the page; group headings, account block, back link, and navigation icons are hidden. Main padding becomes 16px horizontally, the top bar becomes 52px, metrics use two columns, and paired panels stack. Toolbars, batch actions, and editor header actions wrap. Tables retain local horizontal scrolling. Knowledge-file navigation stacks above its document at 760px and below.

## Elevation & Depth

Panels remain flat, separated by neutral borders and soft surfaces. Native modal dialogs use a dim backdrop (`#11182770`) and a diffuse shadow (`0 24px 80px #11182725`). Do not spread dialog elevation to ordinary panels. Reduced-motion styling keeps scrolling behavior automatic.

## Shapes

Controls have modest rounding, panels slightly more, and dialogs the largest radius in this system. Status badges are compact rectangles with 4px corners. One-pixel neutral borders establish grouping; selected navigation combines a soft blue surface with a slim cobalt edge.

## Components

- **Navigation:** labeled links expose `aria-current="page"`; inline SVG icons are decorative. Preserve concise labels and the visible selected state when the sidebar reflows.
- **Buttons:** primary actions are cobalt with white text; secondary actions remain transparent with neutral borders. Minimum button height is 36px. Disabled actions reduce opacity and use a disabled cursor. Buttons, links, and disclosure summaries receive a visible cobalt keyboard outline.
- **Text entry:** maintain the same light field border, white background, no shadow, and normal text weight when empty, hovered, focused, or populated. Keep visible associated labels. The article body is a labeled multiline textbox with a stable neutral border.
- **Selects:** transparent, borderless, and shadow-free with concise options. Keyboard focus uses an underline rather than a halo. Explanations belong beside controls in hover- and keyboard-accessible tooltips, never inside selected values; do not assume such tooltips exist where the source does not implement them.
- **Tables:** mist header rows, neutral row dividers, 18px cell padding, compact status badges, labeled selection checkboxes, and explicit row actions. Busy table regions expose `aria-busy`. Keep content density and column relationships consistent with the reference dashboard.
- **Dialogs:** native `showModal()` dialogs have accessible heading labels and bounded scrolling (90dvh). Form, result, and editor widths cap at 640px, 900px, and 1120px respectively, always leaving 16px viewport gutters. The editor header stays sticky. Escape follows the editor's save-before-close path; a failed save exposes Retry save and Discard unsaved changes.
- **Editor:** a labeled formatting toolbar accompanies edit/preview, history, publish, and close actions. Save progress uses `role="status"`; errors use `role="alert"`. The body supports headings, lists, links, images with an alt-text field, and tables. Bold exposes its pressed state; do not infer complete toolbar state semantics or full keyboard testing from that one control.
- **Keyboard access:** a focus-revealed Skip to content link targets the main region. Preserve native controls, dialog semantics, visible labels, and focus styling. Source-level semantics and fixture screenshots do not establish a complete accessibility audit.

## Do's and Don'ts

- **Do** preserve the supplied dashboard's composition and density while applying Boardy's palette.
- **Do** keep the corrected article measure in both editor and preview.
- **Do** distinguish fixture observations from authenticated production behavior.
- **Don't** add focus halos, darker borders, or heavier populated text to editable fields.
- **Don't** introduce bordered field chrome or filled backgrounds to selects and filters.
- **Don't** canonize current exceptions: the product tile uses a text initial instead of a supplied brand asset, and small uppercase sidebar group labels are inherited reference structure rather than a new general-purpose eyebrow style. These are not patterns to propagate to new surfaces.
