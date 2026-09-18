import {
  Purchases,
  type CustomerInfo,
  type Offerings,
  type Package,
} from "@revenuecat/purchases-js";

export const REVENUECAT_ENTITLEMENT = "boardybyatelix_pro";

export const REVENUECAT_PRODUCT_IDS = {
  annual: "pro_annual",
  monthly: "prod_subs_monthly",
  monthlyLegacy: "subscription_monthly",
} as const;

let purchases: Purchases | null = null;
let configuredUserId: string | null = null;

const getConfiguredApiKey = () =>
  import.meta.env.VITE_REVENUECAT_PUBLIC_API_KEY?.trim() || null;

const isWebBillingKey = (apiKey: string) =>
  apiKey.startsWith("rcb_") || apiKey.startsWith("rcb_sb_");

const isSandboxKey = (apiKey: string) => apiKey.startsWith("rcb_sb_");

const validateEnvironmentKey = (apiKey: string) => {
  if (import.meta.env.DEV && !isSandboxKey(apiKey)) {
    throw new Error(
      "Local development requires a RevenueCat sandbox Web Billing key beginning with rcb_sb_.",
    );
  }
  if (import.meta.env.PROD && isSandboxKey(apiKey)) {
    throw new Error(
      "Production cannot use a RevenueCat sandbox key. Configure a production rcb_ Web Billing key.",
    );
  }
};

export const isRevenueCatConfigured = () => {
  const apiKey = getConfiguredApiKey();
  if (!apiKey || !isWebBillingKey(apiKey)) {
    return false;
  }
  return import.meta.env.DEV ? isSandboxKey(apiKey) : !isSandboxKey(apiKey);
};

const requirePurchases = () => {
  if (!purchases) {
    throw new Error(
      "RevenueCat is not configured. Add a Web Billing public key as VITE_REVENUECAT_PUBLIC_API_KEY.",
    );
  }
  return purchases;
};

/** Configure once, then switch the RevenueCat identity when Supabase auth changes. */
export const syncRevenueCatUser = async (
  userId: string,
  email?: string | null,
) => {
  const apiKey = getConfiguredApiKey();
  if (!apiKey) {
    return null;
  }
  if (!isWebBillingKey(apiKey)) {
    throw new Error(
      "RevenueCat Web Billing needs an rcb_ public API key. The supplied test_ key is not a Web SDK key.",
    );
  }
  validateEnvironmentKey(apiKey);

  if (!purchases) {
    purchases = Purchases.configure({ apiKey, appUserId: userId });
  } else if (configuredUserId !== userId) {
    await purchases.changeUser(userId);
  }
  configuredUserId = userId;

  if (email) {
    await purchases.setAttributes({ $email: email });
  }
  return purchases;
};

export const getRevenueCatCustomerInfo = () =>
  requirePurchases().getCustomerInfo();

export const hasProEntitlement = (customerInfo: CustomerInfo) =>
  customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT]?.isActive === true;

export const checkProEntitlement = () =>
  requirePurchases().isEntitledTo(REVENUECAT_ENTITLEMENT);

export const getRevenueCatOfferings = (): Promise<Offerings> =>
  requirePurchases().getOfferings();

export const getPackageByProductId = (
  offerings: Offerings,
  productId: string,
): Package | null => {
  const pkg = offerings.current?.availablePackages.find(
    ({ webBillingProduct }) => webBillingProduct.identifier === productId,
  );
  return pkg ?? null;
};

export const purchaseRevenueCatPackage = (
  pkg: Package,
  email?: string | null,
  discountCode?: string | null,
) =>
  requirePurchases().purchase({
    rcPackage: pkg,
    customerEmail: email ?? undefined,
    showDiscountCodeField: true,
    discountCode: discountCode?.trim() || undefined,
  });

export const presentRevenueCatPaywall = (email?: string | null) =>
  requirePurchases().presentPaywall({
    customerEmail: email ?? undefined,
    showDiscountCodeField: true,
  });

export const getSubscriptionManagementUrl = (customerInfo: CustomerInfo) =>
  customerInfo.managementURL;
