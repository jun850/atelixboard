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
    : "We couldn't complete that request. Please try again.";

const formatPeriod = (pkg: Package) => {
  const period = pkg.webBillingProduct.period;
  if (!period) {
    return "One-time access";
  }
  return `Every ${period.number} ${period.unit}${
    period.number === 1 ? "" : "s"
  }`;
};

const getAnnualSavingsPercent = (
  monthly: Package | undefined,
  annual: Package | undefined,
) => {
  const monthlyAmount = monthly?.webBillingProduct.price.amountMicros;
  const annualAmount = annual?.webBillingProduct.price.amountMicros;
  if (!monthlyAmount || !annualAmount) {
    return null;
  }
  const savings = Math.round(
    ((monthlyAmount * 12 - annualAmount) / (monthlyAmount * 12)) * 100,
  );
  return savings > 0 ? savings : null;
};

const getOfferText = (pkg: Package) => {
  const product = pkg.webBillingProduct;
  if (product.identifier === REVENUECAT_PRODUCT_IDS.annual) {
    return "Annually";
  }
  if (
    product.identifier === REVENUECAT_PRODUCT_IDS.monthly ||
    product.identifier === REVENUECAT_PRODUCT_IDS.monthlyLegacy
  ) {
    return "Monthly";
  }
  return formatPeriod(pkg);
};

const getPlanTitle = (pkg: Package) =>
  pkg.webBillingProduct.identifier === REVENUECAT_PRODUCT_IDS.annual
    ? "Pro Annual"
    : "Pro Monthly";

const PRO_BENEFIT_GROUPS = [
  {
    title: "Create without limits",
    icon: "create",
    benefits: [
      "Full editor and infinite board",
      "Unlimited scenes and folders",
      "PNG, SVG and file export",
      "Libraries and templates",
    ],
  },
  {
    title: "Collaborate clearly",
    icon: "collaborate",
    benefits: [
      "Unlimited collaborators",
      "Team workspaces and comments",
      "Presentations and sharing",
      "Edit and view permissions",
    ],
  },
  {
    title: "Use your own stack",
    icon: "stack",
    benefits: ["Extended AI tools", "Bring your own LLM subscription"],
  },
  {
    title: "Share with control",
    icon: "share",
    benefits: ["Secure cloud storage", "Access management"],
  },
];

const PaywallBenefitIcon = ({ icon }: { icon: string }) => (
  <span className="boardy-paywall__benefit-icon" aria-hidden="true">
    <svg viewBox="0 0 20 20" focusable="false">
      <path
        d={
          icon === "collaborate"
            ? "M6.5 8.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Zm7-1.1a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM2.8 15.8c.3-2.4 1.6-3.7 3.7-3.7s3.4 1.3 3.7 3.7M11.5 12.7c.5-.9 1.2-1.4 2.2-1.4 1.7 0 2.7 1 3 2.9"
            : icon === "stack"
            ? "M5.2 4.8h9.6M3.5 8.5h13M5.2 12.2h9.6M7.4 15.2h5.2"
            : icon === "share"
            ? "M10 2.8 16 5v4.4c0 3.7-2.3 6.3-6 7.8-3.7-1.5-6-4.1-6-7.8V5l6-2.2Zm-2.4 7 1.5 1.5 3.3-3.3"
            : "M4 5.2h7.8L15.8 9v5.8H4V5.2Zm7.8 0V9h4M7 12l2.8-2.8L12 11.4"
        }
      />
    </svg>
  </span>
);

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
  packages,
  selected,
  onSelect,
}: {
  pkg: Package;
  packages: Package[];
  selected: boolean;
  onSelect: () => void;
}) => {
  const product = pkg.webBillingProduct;
  const isAnnual = product.identifier === REVENUECAT_PRODUCT_IDS.annual;
  const annual = packages.find(
    (candidate) =>
      candidate.webBillingProduct.identifier === REVENUECAT_PRODUCT_IDS.annual,
  );
  const monthly = packages.find(
    (candidate) =>
      candidate.webBillingProduct.identifier ===
        REVENUECAT_PRODUCT_IDS.monthly ||
      candidate.webBillingProduct.identifier ===
        REVENUECAT_PRODUCT_IDS.monthlyLegacy,
  );
  const savings = isAnnual ? getAnnualSavingsPercent(monthly, annual) : null;
  return (
    <button
      className={`boardy-paywall-product${selected ? " is-selected" : ""}${
        savings ? " has-savings" : ""
      }`}
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
    >
      <span className="boardy-paywall-product__radio" aria-hidden="true" />
      <span className="boardy-paywall-product__copy">
        <span className="boardy-paywall-product__title-row">
          <strong>{getPlanTitle(pkg)}</strong>
          {savings && (
            <span className="boardy-paywall-product__savings">
              Save {savings}%
            </span>
          )}
        </span>
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
          <span className="boardy-paywall__brand-mark">
            <span className="boardy-paywall__brand-by">By</span>
            <img src="/atelix-horizontal.png" alt="Atelix" />
          </span>
        </a>
        {onSignOut && (
          <div className="boardy-paywall__nav-actions">
            <span className="boardy-paywall__nav-account">{user.email}</span>
            <button type="button" onClick={() => void onSignOut()}>
              Sign out
            </button>
          </div>
        )}
      </header>

      <div className="boardy-paywall__layout">
        <section className="boardy-paywall__story">
          <h1 id="boardy-paywall-title">
            Everything you need to think, share, and ship.
          </h1>
          <p className="boardy-paywall__lede">
            Simplify your brainstorming workflow with familiar, smart
            whiteboarding and live collaboration.
          </p>
        </section>

        <section
          className="boardy-paywall__benefit-grid"
          aria-label="Everything included with Boardy Pro"
        >
          {PRO_BENEFIT_GROUPS.map((group) => (
            <article key={group.title}>
              <PaywallBenefitIcon icon={group.icon} />
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
            <div
              className="boardy-paywall__loading"
              aria-live="polite"
              aria-label="Getting your workspace ready"
            >
              <img
                className="boardy-paywall__loader-art"
                src="/brand/boardy-loader.png"
                alt=""
              />
              <span>Getting your workspace ready…</span>
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
                    packages={packages}
                    selected={selectedPackage?.identifier === pkg.identifier}
                    onSelect={() => setSelectedPackage(pkg)}
                  />
                ))}
              </div>
              {selectedPackage && (
                <div className="boardy-paywall__summary" aria-live="polite">
                  <span>
                    <small>Selected plan</small>
                    <strong>{getPlanTitle(selectedPackage)}</strong>
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
                  View full checkout
                </button>
              )}
              <p className="boardy-paywall__fineprint">
                Secure checkout · Cancel anytime
                <br />
                Subscription details and applicable taxes appear before payment.
              </p>
            </>
          ) : (
            <div className="boardy-paywall__empty" role="alert">
              <strong>No plans are available yet.</strong>
              <p>Plans are temporarily unavailable. Refresh to try again.</p>
              <button type="button" onClick={() => void refresh()}>
                Refresh plans
              </button>
            </div>
          )}
        </section>
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
