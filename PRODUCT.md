# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Teams and individuals who brainstorm, map ideas, review work, and make decisions together on a shared visual canvas.

## Product Purpose

Boardy is a collaborative whiteboard workspace for turning early ideas into clear, shared next steps. Success means a visitor can understand the product quickly, create an account, and move into the working canvas.

## Positioning

Boardy combines a flexible hand-drawn canvas with live collaboration, contextual comments, and a durable workspace under a Boardy account.

## Operating Context

People use Boardy in a browser for brainstorming, visual planning, lightweight diagramming, and collaborative review. The working product includes authenticated workspaces, real-time collaboration, drawing tools, comments, sharing, and canvas navigation.

## Capabilities and Constraints

- The app is a React/Vite web application built on the Excalidraw editor.
- Supabase provides account authentication and live collaboration.
- Public routes include the landing page, sign-in, sign-up, and password recovery; the authenticated canvas lives at `/app`.
- Landing-page calls to action must route to the existing account or workspace flows.
- Pricing shown in the supplied landing-page reference is treated as approved marketing content, but this repository does not contain a checkout flow; pricing calls to action therefore route to account creation.

## Brand Commitments

- Keep the existing Boardy by Atelix logo treatment unchanged.
- The supplied Pen design is the binding visual and compositional reference for the landing page.
- Product language is direct, calm, collaborative, and focused on turning ideas into decisions.

## Evidence on Hand

- The runnable Boardy editor and existing authentication routes are present in `excalidraw-app`.
- Existing Boardy and Atelix logo assets are in `public/`.
- No customer logos, testimonials, or independent performance claims are present and none should be fabricated.

## Product Principles

- Make the canvas feel like the product, not a decorative illustration.
- Keep collaboration visible and understandable at a glance.
- Move visitors toward a real account or workspace action.
- Preserve clarity and keyboard accessibility across desktop and mobile.

## Accessibility & Inclusion

The landing page must remain keyboard operable, maintain readable contrast, adapt to narrow screens, and provide an intentional reduced-motion experience.
