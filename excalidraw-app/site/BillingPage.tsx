import React, { useEffect, useMemo, useState } from "react";

import {
  getRevenueCatCustomerInfo,
  getRevenueCatOfferings,
  hasProEntitlement,
  presentRevenueCatPaywall,
  purchaseRevenueCatPackage,
  syncRevenueCatUser,
  getSubscriptionManagementUrl,
  REVENUECAT_PRODUCT_IDS,
} from "../revenuecat";

import type {
  CustomerInfo,
  Offerings,
  Package,
} from "@revenuecat/purchases-js";
import type { User } from "@supabase/supabase-js";

type BillingPageProps = {
  user: User;
  onUnlocked?: () => void;
  onSignOut?: () => Promise<void>;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "RevenueCat could not complete that request.";

const formatPeriod = (pkg: Package) => {
  const period = pkg.webBillingProduct.period;
  if (!period) {
    return "One-time access";
  }
  return `Every ${period.number} ${period.unit}${
    period.number === 1 ? "" : "s"
  }`;
};

const getOfferText = (pkg: Package) => {
  const product = pkg.webBillingProduct;
  const trial = product.freeTrialPhase;
  if (trial?.period) {
    return `Includes a ${trial.period.number} ${trial.period.unit} free trial`;
  }
  const intro = product.introPricePhase;
  if (intro?.price) {
    return `Intro price ${intro.price.formattedPrice}`;
  }
  return product.description || formatPeriod(pkg);
};

const PRO_BENEFITS = [
  "Unlimited boards & folders",
  "Cloud sync and version history",
  "Roles and access controls",
  "View-only links and embeds",
  "Team workspace management",
  "Templates and libraries",
  "Extended AI tools",
  "Bring your own LLM subscription",
];

const PRO_BENEFIT_GROUPS = [
  {
    title: "Create without limits",
    benefits: [PRO_BENEFITS[0], PRO_BENEFITS[1]],
  },
  {
    title: "Collaborate clearly",
    benefits: [PRO_BENEFITS[4], PRO_BENEFITS[3]],
  },
  {
    title: "Use your own stack",
    benefits: [PRO_BENEFITS[6], PRO_BENEFITS[7]],
  },
  {
    title: "Share with control",
    benefits: [PRO_BENEFITS[2], PRO_BENEFITS[5]],
  },
];

const getProPackages = (availablePackages: Package[]) => {
  const annual = availablePackages.find(
    (pkg) => pkg.webBillingProduct.identifier === REVENUECAT_PRODUCT_IDS.annual,
  );
  const monthly = availablePackages.find(
    (pkg) =>
      pkg.webBillingProduct.identifier === REVENUECAT_PRODUCT_IDS.monthly,
  );
  const legacyMonthly = availablePackages.find(
    (pkg) =>
      pkg.webBillingProduct.identifier === REVENUECAT_PRODUCT_IDS.monthlyLegacy,
  );

  return [annual, monthly ?? legacyMonthly].filter((pkg): pkg is Package =>
    Boolean(pkg),
  );
};

const ProductOption = ({
  pkg,
  selected,
  onSelect,
}: {
  pkg: Package;
  selected: boolean;
  onSelect: () => void;
}) => {
  const product = pkg.webBillingProduct;
  return (
    <button
      className={`boardy-paywall-product${selected ? " is-selected" : ""}`}
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
    >
      <span className="boardy-paywall-product__radio" aria-hidden="true" />
      <span className="boardy-paywall-product__copy">
        <strong>{product.title}</strong>
        <small>{getOfferText(pkg)}</small>
      </span>
      <span className="boardy-paywall-product__price">
        <strong>{product.price.formattedPrice}</strong>
        <small>{formatPeriod(pkg)}</small>
      </span>
    </button>
  );
};

export const BillingPage = ({
  user,
  onUnlocked,
  onSignOut,
}: BillingPageProps) => {
  const [offerings, setOfferings] = useState<Offerings | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await syncRevenueCatUser(user.id, user.email);
      const [nextOfferings, nextCustomerInfo] = await Promise.all([
        getRevenueCatOfferings(),
        getRevenueCatCustomerInfo(),
      ]);
      setOfferings(nextOfferings);
      setCustomerInfo(nextCustomerInfo);
      const packages = getProPackages(
        nextOfferings.current?.availablePackages ?? [],
      );
      setSelectedPackage((current) => current ?? packages[0] ?? null);
      if (hasProEntitlement(nextCustomerInfo)) {
        onUnlocked?.();
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // The page is mounted for one authenticated user at a time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const packages = useMemo(
    () => getProPackages(offerings?.current?.availablePackages ?? []),
    [offerings],
  );
  const isPro = customerInfo ? hasProEntitlement(customerInfo) : false;
  const managementUrl = customerInfo
    ? getSubscriptionManagementUrl(customerInfo)
    : null;

  const completePurchase = async (pkg: Package) => {
    setIsWorking(true);
    setError(null);
    try {
      const result = await purchaseRevenueCatPackage(pkg, user.email);
      setCustomerInfo(result.customerInfo);
      if (hasProEntitlement(result.customerInfo)) {
        onUnlocked?.();
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setIsWorking(false);
    }
  };

  const openRevenueCatPaywall = async () => {
    setIsWorking(true);
    setError(null);
    try {
      const result = await presentRevenueCatPaywall(user.email);
      setCustomerInfo(result.customerInfo);
      if (hasProEntitlement(result.customerInfo)) {
        onUnlocked?.();
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <main className="boardy-paywall" aria-labelledby="boardy-paywall-title">
      <header className="boardy-paywall__topbar">
        <a className="boardy-paywall__brand" href="/" aria-label="Boardy home">
          <span>Boardy</span>
          <small>BY ATELIX</small>
        </a>
      </header>

      <div className="boardy-paywall__layout">
        <section className="boardy-paywall__story">
          <h1 id="boardy-paywall-title">
            Everything you need to think, share, and ship.
          </h1>
          <p className="boardy-paywall__lede">
            The complete whiteboard toolkit—local-first when you want it,
            cloud-powered when your team needs it.
          </p>
          <div className="boardy-paywall__benefit-grid">
            {PRO_BENEFIT_GROUPS.map((group) => (
              <article key={group.title}>
                <h3>{group.title}</h3>
                <ul>
                  {group.benefits.map((benefit) => (
                    <li key={benefit}>
                      <span aria-hidden="true">✓</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section
          className="boardy-paywall__panel"
          aria-label="Boardy Pro plans"
        >
          <div className="boardy-paywall__panel-heading">
            <div>
              <p className="boardy-paywall__eyebrow">Choose your plan</p>
              <h2>Boardy Pro</h2>
              <p>One plan, two billing rhythms. Cancel anytime.</p>
            </div>
          </div>

          {error && (
            <div className="boardy-paywall__error" role="alert">
              <strong>We couldn’t load your plans.</strong>
              <span>{error}</span>
              <button type="button" onClick={() => void refresh()}>
                Try again
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="boardy-paywall__loading" aria-live="polite">
              <span className="boardy-paywall__loader" />
              Loading plans from RevenueCat…
            </div>
          ) : error ? null : isPro ? (
            <div className="boardy-paywall__active" role="status">
              <span className="boardy-paywall__active-mark">Active</span>
              <strong>Boardy Pro is active.</strong>
              <p>Your entitlement is synced to this Boardy account.</p>
              {managementUrl && (
                <a href={managementUrl} target="_blank" rel="noreferrer">
                  Manage subscription
                </a>
              )}
              <button type="button" onClick={onUnlocked}>
                Continue to workspace
              </button>
            </div>
          ) : packages.length ? (
            <>
              <div
                className="boardy-paywall__products"
                role="radiogroup"
                aria-label="Choose your Pro billing cadence"
              >
                {packages.map((pkg) => (
                  <ProductOption
                    key={pkg.identifier}
                    pkg={pkg}
                    selected={selectedPackage?.identifier === pkg.identifier}
                    onSelect={() => setSelectedPackage(pkg)}
                  />
                ))}
              </div>
              {selectedPackage && (
                <div className="boardy-paywall__summary" aria-live="polite">
                  <span>
                    <small>Selected plan</small>
                    <strong>{selectedPackage.webBillingProduct.title}</strong>
                  </span>
                  <span>
                    <small>{formatPeriod(selectedPackage)}</small>
                    <strong>
                      {selectedPackage.webBillingProduct.price.formattedPrice}
                    </strong>
                  </span>
                </div>
              )}
              <button
                className="boardy-paywall__primary-action"
                type="button"
                disabled={!selectedPackage || isWorking}
                onClick={() =>
                  selectedPackage && void completePurchase(selectedPackage)
                }
              >
                {isWorking
                  ? "Opening secure checkout…"
                  : "Continue to checkout"}
              </button>
              {offerings?.current?.hasPaywall && (
                <button
                  className="boardy-paywall__secondary-action"
                  type="button"
                  disabled={isWorking}
                  onClick={() => void openRevenueCatPaywall()}
                >
                  View full RevenueCat paywall
                </button>
              )}
              <p className="boardy-paywall__fineprint">
                Secure checkout by RevenueCat · Cancel anytime
                <br />
                Subscription details and applicable taxes appear before payment.
              </p>
            </>
          ) : (
            <div className="boardy-paywall__empty" role="alert">
              <strong>No plans are available yet.</strong>
              <p>
                Set a current RevenueCat offering with at least one web package,
                then try again.
              </p>
              <button type="button" onClick={() => void refresh()}>
                Refresh plans
              </button>
            </div>
          )}
        </section>
      </div>

      <div className="boardy-paywall__footer">
        {onSignOut ? (
          <button type="button" onClick={() => void onSignOut()}>
            Sign out
          </button>
        ) : (
          <a href="/">Return home</a>
        )}
        <span>Need help? Contact your workspace administrator.</span>
      </div>
    </main>
  );
};

export const RevenueCatGate = ({
  user,
  children,
  onSignOut,
}: {
  user: User;
  children: React.ReactNode;
  onSignOut: () => Promise<void>;
}) => {
  const [unlocked, setUnlocked] = useState(false);
  if (unlocked) {
    return <>{children}</>;
  }
  return (
    <BillingPage
      user={user}
      onUnlocked={() => setUnlocked(true)}
      onSignOut={onSignOut}
    />
  );
};
