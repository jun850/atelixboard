# Boardy by Atelix

**A collaborative visual workspace for turning ideas into shared next steps.**

Boardy brings whiteboarding, live collaboration, contextual comments, and AI-assisted planning into one browser-based workspace. Sketch a diagram, map an idea, review it with your team, and keep the work organized under your Boardy account.

**Live product: [www.boardy.sbs](https://www.boardy.sbs)**

Boardy is a **subscription SaaS**, with **custom development** available for teams that need tailored workflows, integrations, or product features.

## What you can do

- **Draw and plan:** use an infinite canvas with hand-drawn shapes, arrows, text, images, and freehand drawing, powered by Excalidraw.
- **Collaborate live:** work on the same board, see collaborators' cursors, and invite teammates to join.
- **Review in context:** add comments, replies, and image attachments; resolve discussions alongside the work.
- **Organize your workspace:** save whiteboards, group them into collections, manage private or shared access, and restore boards from trash.
- **Start with templates:** use editable planning templates and save reusable canvas selections.
- **Work with AI:** generate draft canvas content through the Assistant and bring your own model connection. Availability depends on the configured provider and runtime; see the [AI development notes](docs/agentic-board/LOCAL-TESTING.md).
- **Share and export:** manage board access and export drawings as PNG, SVG, or editable `.excalidraw` files.

Feature access depends on your plan. Visit [Boardy](https://www.boardy.sbs) for current subscription options.

## Subscriptions and custom development

Use the hosted SaaS for a managed Boardy workspace with subscription access. The application includes Pro monthly and annual subscription flows, billing management, and entitlement checks through RevenueCat Web Billing.

Need Boardy adapted to how your team works? We also offer custom development for specialized workflows, integrations, and additional features. Start a discussion through a [project issue](https://github.com/jun850/atelixboard/issues) with a brief description of your requirements; keep confidential business details out of public issues.

## Fully vibe coded

Boardy is **fully vibe coded**: the Boardy product layer is built through human-directed, AI-assisted development, from exploring ideas to implementing and refining features. Human judgment guides the product, reviews the output, and verifies the experience.

The canvas builds on the work of the Excalidraw community. “Fully vibe coded” describes our development approach to Boardy; Excalidraw and the other open-source dependencies retain their own authorship and licenses.

## Tech stack

| Layer | Technology |
| --- | --- |
| Whiteboard editor | Excalidraw, maintained in this monorepo |
| Frontend | React 19, TypeScript, Vite, Sass/SCSS |
| Client state | Jotai; IndexedDB through `idb-keyval` |
| Accounts and backend | Supabase Auth, Postgres, Storage, and Edge Functions |
| Live collaboration | Supabase Realtime with encrypted canvas synchronization |
| Subscriptions | RevenueCat Web Billing |
| Document editing | Tiptap |
| Hosting and server routes | Vercel |
| Quality checks | Vitest, Testing Library, ESLint, Prettier, and TypeScript |
| Workspace tooling | Yarn Classic workspaces |

## Run locally

Prerequisites: Node.js 18 or newer and Yarn 1.22.22. Full workspace functionality also needs a development Supabase backend with the relevant migrations, storage, and Edge Functions configured.

```sh
git clone https://github.com/jun850/atelixboard.git
cd atelixboard
yarn install
```

Create an ignored `.env.development.local` file in the repository root with your development configuration:

```dotenv
VITE_SUPABASE_URL=<development-supabase-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<development-publishable-or-anon-key>
VITE_REVENUECAT_PUBLIC_API_KEY=<sandbox-web-billing-public-key>
```

Use a RevenueCat sandbox Web Billing key (`rcb_sb_...`) for local billing work. Keep service-role keys and billing secrets server-side; never put them in `VITE_` variables or commit them.

```sh
yarn start
```

Open the URL printed by Vite. Account, cloud storage, billing, and AI workflows require their supporting services; starting the frontend alone does not provision them.

For a local Supabase environment, see the [cloud operations guide](docs/cloud-scenes/OPERATIONS.md). Once local Supabase and its Edge Functions are running, use the local QA launcher:

```sh
node scripts/start-local-qa.mjs
```

This launcher checks for a local backend and serves the app at `http://127.0.0.1:5174`. See the [subscription and collaboration QA guide](docs/BOARDY_PAYWALL_DEPLOYMENT_QA.md) for the full workflow.

## Contribute

Contributions to Boardy are welcome: bug fixes, usability improvements, accessibility, documentation, tests, and focused new features.

1. [Open an issue](https://github.com/jun850/atelixboard/issues) to report a bug or discuss a substantial change. Include reproduction steps and expected behavior for bugs.
2. Fork the repository and create a branch for your change.
3. Read [AGENTS.md](AGENTS.md), [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md), and the relevant [engineering docs](docs/README.md).
4. Make a focused change. Keep Boardy application workflows in `excalidraw-app/` and preserve the separation from the upstream editor in `packages/`.
5. Run the checks relevant to your change and verify affected user flows locally. UI changes should include screenshots; collaboration changes should be checked with two users.
6. Open a pull request against this repository explaining the problem, the change, and how you verified it. Link the related issue and note any setup or migration requirements.

Useful checks from the repository root:

```sh
yarn test:typecheck
yarn test:code
yarn test:app --watch=false
yarn build:app
```

AI-assisted contributions are welcome. Review and understand generated changes, verify their behavior, and include meaningful validation in the pull request.

For changes specifically to the Excalidraw editor, also consult the [upstream contribution guide](https://docs.excalidraw.com/docs/introduction/contributing).

## Project layout

```text
excalidraw-app/     Boardy app, workspace, authentication, billing, and collaboration
packages/          Excalidraw editor and shared canvas packages
supabase/          Database migrations and Edge Functions
api/               Vercel server routes
scripts/           Development utilities, local runtimes, and QA tools
docs/              Product plans, architecture, operations, and verification guides
public/            Static assets and branding
```

Some documents describe proposed work. Read their status notes before treating a design as an implemented feature.

## Credits and license

Boardy is built on [Excalidraw](https://github.com/excalidraw/excalidraw). Thank you to its maintainers and contributors for the editor that makes this canvas possible.

This repository includes the [MIT license](LICENSE) and the original Excalidraw copyright notice. Preserve applicable license and attribution notices when contributing or reusing code. Hosted subscriptions and custom development are commercial services offered around Boardy.
