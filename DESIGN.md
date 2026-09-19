# Boardy design system

## Visual world

Boardy uses a crisp, editorial product-demo aesthetic: warm white surfaces, deep ink typography, bright cobalt actions, pale blue atmospheric fields, and restrained hairline borders. The canvas interface is the primary visual material.

## Typography

Use the existing Assistant family. Headlines are bold, tightly tracked, and compact; body copy is calm and open. Small uppercase labels are reserved for structural navigation inside artwork, not marketing-section eyebrows.

## Color

- Ink: `#111827`
- Muted ink: `#667085`
- Cobalt: `#2f6ce5`
- Deep blue: `#183269`
- Mist: `#f3f7ff`
- Line: `#dfe6f1`
- White: `#ffffff`

## Composition

The landing page follows the supplied Pen reference: quiet navigation, a split hero whose oversized product artwork runs to the right edge, a full-width canvas demonstration, a three-part benefit band, a two-column pricing stage, and a deep-blue conversion footer. The existing Boardy by Atelix mark remains untouched.

## Motion

The hero artwork is anchored while the page begins moving, with bounded scroll-linked depth. Cursors traverse the board, comments and sticky notes settle into place, and interface surfaces use small shadow and transform changes for state. Content remains visible without scripts. Reduced motion removes continuous travel and scroll displacement while retaining clear focus and hover feedback.

## Interaction

Primary actions are cobalt filled buttons; secondary actions are quiet text links or white controls. Every interactive element has a visible focus ring. Anchor links use smooth scrolling only when motion preferences allow it.

## Application workspace

The authenticated `/app` workspace uses quiet white surfaces on a soft-gray stage. Cobalt is reserved for the primary action, selected navigation, and spatial collaboration markers; it is not used as decorative chrome. Whiteboard grids stay compact and scannable, with actions grouped in the page header and contextual board operations kept in each card menu.

True form fields, such as rename, profile, invitation, and company-detail inputs, use neutral gray borders, subtle elevation, and a monochrome focus halo. Do not introduce a colored outline, underline, or glow when text is entered or edited. Search is a navigation aid rather than a form: it stays borderless and transparent in every state, including focus. Filters and sort controls remain compact, quiet, single-row controls rather than oversized form fields.

Read-only metadata must never imitate an input. Slugs, identifiers, plan facts, timestamps, and similar system values are rendered as plain text inside a labeled metadata wrapper or definition list. Reserve field chrome for values the user can actually edit.

Picker values and submenu labels stay short and literal. Explanations, role capabilities, consequences, and important access caveats belong in a small adjacent information tooltip that opens on hover and keyboard focus. Tooltips supplement a persistent label, never replace it, and must remain usable without color or pointer input.

Menus, pickers, filters, and selects use transparent surfaces with no field border, filled background, or focus halo. A restrained current-color keyboard outline may indicate focus without turning the control into a form field. Bordered control chrome is reserved for editable text-entry fields.

Whiteboard names are display-only inside the canvas editor and are renamed from the dashboard card menu. Comments open as a dedicated right-side panel so the canvas remains the primary workspace. Whiteboard access controls belong in the existing collaboration dialog; do not duplicate sharing actions in the editor header. Collection sharing remains a collection-level dashboard action.

The workspace sidebar owns navigation, identity, and session actions. Profile surfaces always show the person's avatar, display name, and email when the data is available. On narrow screens, the workspace becomes a bottom navigation bar and the content stage retains independent vertical scrolling.
