# RevenueCat Web Billing for Boardy by Atelix

This app uses `@revenuecat/purchases-js` in `excalidraw-app`. RevenueCat Web Billing is configured from the browser with a public Web Billing key and the authenticated Supabase user ID. The Supabase function secret is separate and must not be used in browser code. After authentication, `/app` redirects to the full-screen `/app/subscription` paywall; the canvas mounts only after `boardybyatelix_pro` is active.

## Local setup

1. Install the SDK (already done in this checkout):

   ```bash
   npm install --save @revenuecat/purchases-js --package-lock=false
   ```

2. In RevenueCat, create or select a **Web Billing** app and copy its sandbox public key. It must begin with `rcb_sb_`. The `test_...` key supplied for this project is not a Web Billing public key, so the client intentionally rejects it.

3. Add the sandbox public key to the ignored local env file. Local development is deliberately locked to sandbox keys:

   ```dotenv
   VITE_REVENUECAT_PUBLIC_API_KEY=rcb_sb_your_public_key
   ```

````

4. The linked Supabase project stores the supplied server-side Test Store key as `REVENUECAT_TEST_STORE_API_KEY` and the sandbox public key as `REVENUECAT_PUBLIC_API_KEY`. The older `REVENUECAT_API_KEY` secret is retained for compatibility. Function secrets are server-only; they are not a replacement for the client Web Billing public key.

5. Restart Vite after changing env files.

Production is deliberately locked away from sandbox. Configure the production Vercel/environment variable with the production Web Billing key:

```dotenv
VITE_REVENUECAT_PUBLIC_API_KEY=rcb_your_production_public_key
````

The client rejects an `rcb_sb_` key in production and rejects a non-sandbox key during local development. Do not put the production key in `.env.development.local`.

## RevenueCat dashboard configuration

Create these Web Billing products with the exact product IDs:

| Display name                            | Product ID             |
| --------------------------------------- | ---------------------- |
| Annual Pro                              | `pro_annual`           |
| Monthly Subscription                    | `prod_subs_monthly`    |
| Monthly Subscription (legacy/alternate) | `subscription_monthly` |

Create the entitlement `boardybyatelix_pro`, attach all products that should unlock Pro, then create a current offering. Add packages for the products to that offering. The app accepts the two monthly IDs so you can migrate from `subscription_monthly` to `prod_subs_monthly` without breaking the UI.

The paywall displays only the Pro annual package and the primary Pro monthly package. If `prod_subs_monthly` is unavailable, it falls back to `subscription_monthly`. Prices, currency, titles, billing periods, trials, and localized formatting are read from RevenueCat at runtime; do not hardcode `$45.99` or `$4.99` in the client.

RevenueCat Web Billing discount code entry is enabled for both direct package checkout and the hosted paywall. The current founding promotion is managed in RevenueCat as `FOUNDING100`: 100% off forever for `pro_annual` and `prod_subs_monthly`, eligible for everyone. Keep the promotion configuration in RevenueCat rather than hardcoding a discount decision in the client.

If you want the remotely managed paywall, attach a Paywall to the current offering in RevenueCat. The `/app/subscription` screen calls `presentPaywall()` and RevenueCat renders the paywall and checkout UI. No custom price or entitlement decision is trusted from the browser.

## Implementation map

- `excalidraw-app/revenuecat.ts` configures the SDK once, synchronizes Supabase users, loads offerings, starts purchases, presents the paywall, retrieves CustomerInfo, and checks `boardybyatelix_pro`.
- `excalidraw-app/site/BillingPage.tsx` provides the full-screen post-login `/app/subscription` route, dynamic package selection, direct purchase checkout, RevenueCat’s remotely configured paywall, active-entitlement state, refresh, and error handling.
- The authenticated Boardy header links to `/app/subscription`; the legacy `/billing` path redirects there.

The important subscription gate is:

```ts
const customerInfo = await Purchases.getSharedInstance().getCustomerInfo();
const isPro =
  customerInfo.entitlements.active.boardybyatelix_pro?.isActive === true;
```

Use CustomerInfo after every purchase and on app startup. Do not unlock Pro merely because `purchase()` resolved; unlock only when the entitlement is active. RevenueCat’s `CustomerInfo.managementURL` is used for web subscription management. RevenueCat Customer Center is currently documented for iOS and Android, not Web Billing, so the web flow links to that management URL instead.

## Sandbox testing

Use a RevenueCat sandbox key (`rcb_sb_...`) and sandbox products. Test with a dedicated account, sign in before opening `/app/subscription`, and verify both the RevenueCat customer ID and `boardybyatelix_pro` in the RevenueCat dashboard. Keep the key in `.env.development.local`; never commit it or place a RevenueCat secret key in `VITE_*`.
