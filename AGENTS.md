# Guidelines

- For new DOM/browser API usage, use `app.ownerDocument` and `app.ownerWindow` instead of globals; without `app`, derive them from the mounted node's `ownerDocument` and its `defaultView`.
- When overriding properties of an existing type, prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit<Base, keyof Overrides> & Overrides`.
- Keep `/app` submenu labels, picker values, and options concise. Put explanations of access levels, roles, consequences, and important caveats in a small adjacent tooltip that works on hover and keyboard focus; never embed explanatory sentences in a selected value or option label.
- Keep `/app` menus, pickers, filters, and select controls transparent and free of field borders, filled backgrounds, and focus halos. Reserve bordered field chrome for editable text-entry form controls; use only a minimal current-color keyboard outline for picker focus.

## Boardy RevenueCat testing notes

- Local development must use the RevenueCat Web Billing sandbox public key (`rcb_sb_...`) from the ignored `.env.development.local` file. Production must use the separate non-sandbox Web Billing key in Vercel Production environment variables.
- The authenticated subscription route is `/app/subscription`; `/app` stays gated until `boardybyatelix_pro` is active.
- Sandbox verification was completed with `junarcana263@gmail.com` using the monthly Web Billing flow and a Stripe test card. Verify entitlement through CustomerInfo after purchase; do not unlock from a resolved purchase promise alone.
- Customer-facing loading states must not mention RevenueCat or another vendor. Use the centered Boardy loader, reduced-motion behavior, and dynamic localized product pricing.
