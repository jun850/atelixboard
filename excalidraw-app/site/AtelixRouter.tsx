import React, { useEffect, useState } from "react";

import { localApi } from "../agentic-board/client";
import {
  getRevenueCatPublicOfferings,
  REVENUECAT_PRODUCT_IDS,
  syncRevenueCatUser,
} from "../revenuecat";
import { isSupabaseConfigured, supabase } from "../supabase/client";

import { BoardArtwork, LandingIcon } from "./LandingArtwork";
import { EditorArtwork } from "./EditorArtwork";
import { BillingPage } from "./BillingPage";

import "./AtelixRouter.scss";

import type { Session } from "@supabase/supabase-js";
import type { Offerings, Package } from "@revenuecat/purchases-js";

type BoardAppComponent = React.ComponentType;
type AuthMode = "login" | "signup" | "forgot" | "reset";

const getPublicProPackages = (offerings: Offerings | null) => {
  const availablePackages = offerings?.current?.availablePackages ?? [];
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

  return { annual, monthly: monthly ?? legacyMonthly };
};

const getPackagePeriodLabel = (pkg: Package | undefined) => {
  const period = pkg?.webBillingProduct.period;
  if (!period) {
    return "access";
  }
  return period.number === 1
    ? `/${period.unit}`
    : `/${period.number} ${period.unit}s`;
};

const getAnnualSavingsLabel = (
  monthly: Package | undefined,
  annual: Package | undefined,
) => {
  const monthlyAmount = monthly?.webBillingProduct.price.amountMicros;
  const annualAmount = annual?.webBillingProduct.price.amountMicros;
  if (!monthlyAmount || !annualAmount) {
    return "Annual billing";
  }
  const savings = Math.round(
    ((monthlyAmount * 12 - annualAmount) / (monthlyAmount * 12)) * 100,
  );
  return savings > 0 ? `Save ${savings}%` : "Annual billing";
};

const navigate = (path: string) => {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

const getNextPath = () => {
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/app") ? next : "/app";
};

const authPath = (path: string) => {
  const next = getNextPath();
  return `${path}?next=${encodeURIComponent(next)}`;
};

const BoardyBrand = () => (
  <a className="boardy-brand" href="/" aria-label="Boardy by Atelix home">
    <span className="boardy-brand__name">Boardy</span>
    <span className="boardy-brand__byline">
      <span>By</span>
      <img src="/atelix-horizontal.png" alt="" width="6900" height="1500" />
    </span>
  </a>
);

const landingFooterGroups = [
  {
    title: "Product",
    links: ["Features", "Pricing", "Teams", "Roadmap"],
  },
  {
    title: "Resources",
    links: ["Help center", "Community", "Templates", "Updates"],
  },
  {
    title: "Company",
    links: ["About", "Contact", "Privacy", "Terms"],
  },
] as const;

const PlaceholderFooterLink = ({ children }: { children: React.ReactNode }) => (
  <button type="button" disabled>
    {children}
  </button>
);

const LandingPage = ({ signedIn }: { signedIn: boolean }) => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly",
  );
  const [pricingOfferings, setPricingOfferings] = useState<Offerings | null>(
    null,
  );

  useEffect(() => {
    let isCurrent = true;
    void getRevenueCatPublicOfferings()
      .then((offerings) => {
        if (isCurrent) {
          setPricingOfferings(offerings);
        }
      })
      .catch(() => undefined);

    return () => {
      isCurrent = false;
    };
  }, []);

  const primaryPath = signedIn ? "/app" : "/signup";
  const primaryLabel = signedIn ? "Open workspace" : "Sign up";
  const publicProPackages = getPublicProPackages(pricingOfferings);
  const selectedPackage = publicProPackages[billingCycle];
  const selectedProduct = selectedPackage?.webBillingProduct;
  const selectedPrice = selectedProduct?.price.formattedPrice;
  const selectedPeriod = getPackagePeriodLabel(selectedPackage);

  return (
    <main className="atelix-page atelix-landing-page">
      <header className="atelix-site-header">
        <BoardyBrand />
        <nav className="atelix-site-nav" aria-label="Primary navigation">
          <a href="#product">Product</a>
          <a href="#solutions">Solutions</a>
          <a href="#resources">Resources</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="atelix-site-actions">
          {!signedIn && (
            <a className="atelix-text-link" href="/login">
              Login
            </a>
          )}
          <a className="atelix-button atelix-button-primary" href={primaryPath}>
            {primaryLabel}
          </a>
        </div>
      </header>

      <section className="atelix-hero" aria-labelledby="atelix-hero-title">
        <div className="atelix-hero__copy">
          <h1 id="atelix-hero-title">Turn big ideas into clear next steps.</h1>
          <p className="atelix-hero__description">
            Boardy is the fast, flexible workspace for brainstorming, mapping,
            and making decisions—together, in real time.
          </p>
          <a className="atelix-button atelix-button-primary" href={primaryPath}>
            {primaryLabel}
            <LandingIcon name="arrow" />
          </a>
        </div>
        <div className="atelix-hero__art" aria-label="Boardy workspace preview">
          <BoardArtwork variant="hero" />
        </div>
      </section>

      <section
        className="atelix-product-section"
        id="product"
        aria-labelledby="product-title"
      >
        <h2 id="product-title">
          A familiar whiteboard, reimagined for focused teamwork and live
          collaboration
        </h2>
        <div className="atelix-product-stage">
          <EditorArtwork />
        </div>
      </section>

      <section
        className="atelix-benefits"
        id="solutions"
        aria-labelledby="benefits-title"
      >
        <h2 id="benefits-title">
          Everything your team needs to find the signal.
        </h2>
        <div className="atelix-benefit-grid">
          <article>
            <span className="atelix-benefit-icon">
              <LandingIcon name="collaborate" />
            </span>
            <h3>Live collaboration</h3>
            <p>
              See cursors, comments, and ideas arrive in real time—without
              losing your own train of thought.
            </p>
            <a href="#product">
              Learn more <LandingIcon name="arrow" />
            </a>
          </article>
          <article>
            <span className="atelix-benefit-icon">
              <LandingIcon name="organize" />
            </span>
            <h3>Ideas, organized</h3>
            <p>
              Turn clusters of notes into themes and action items with one
              beautifully simple workflow.
            </p>
            <a href="#product">
              Learn more <LandingIcon name="arrow" />
            </a>
          </article>
          <article id="resources">
            <span className="atelix-benefit-icon">
              <LandingIcon name="chat" />
            </span>
            <h3>Feedback in context</h3>
            <p>
              Keep decisions next to the work with mentions, threads, and
              lightweight reactions.
            </p>
            <a href="#product">
              Learn more <LandingIcon name="arrow" />
            </a>
          </article>
        </div>
      </section>

      <section
        className="atelix-pricing"
        id="pricing"
        aria-labelledby="pricing-title"
      >
        <h2 id="pricing-title">Choose your rhythm.</h2>
        <p>
          One Pro plan. Pick monthly or annual billing and get the complete
          Boardy workspace.
        </p>
        <div
          className="atelix-billing-toggle"
          aria-label="Pricing cadence"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={billingCycle === "monthly"}
            className={billingCycle === "monthly" ? "is-active" : ""}
            onClick={() => setBillingCycle("monthly")}
          >
            Monthly
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={billingCycle === "annual"}
            className={billingCycle === "annual" ? "is-active" : ""}
            onClick={() => setBillingCycle("annual")}
          >
            Annual{" "}
            <small>
              {getAnnualSavingsLabel(
                publicProPackages.monthly,
                publicProPackages.annual,
              )}
            </small>
          </button>
        </div>
        <div className="atelix-pricing-grid">
          <article className="atelix-plan atelix-plan--pro atelix-plan--single">
            <h3>Pro</h3>
            <p>Everything teams need to move from idea to delivery.</p>
            <div className="atelix-plan__price">
              <strong>{selectedPrice ?? "—"}</strong>
              <span>{selectedPeriod}</span>
            </div>
            <a
              className="atelix-button"
              href={signedIn ? "/app/subscription" : primaryPath}
            >
              Sign Up
            </a>
            <h4>Everything included</h4>
            <ul className="atelix-plan__benefits">
              <li>Unlimited boards &amp; folders</li>
              <li>Cloud sync and version history</li>
              <li>Roles and access controls</li>
              <li>View-only links and embeds</li>
              <li>Team workspace management</li>
              <li>Templates and libraries</li>
              <li>Extended AI tools</li>
              <li>Bring your own LLM subscription</li>
              <li>Live collaboration</li>
              <li>Comments and threads</li>
            </ul>
          </article>
        </div>
      </section>

      <footer className="atelix-site-footer" data-landing-reveal>
        <div className="atelix-site-footer__inner">
          <div className="atelix-site-footer__cta">
            <div>
              <h2>Your next breakthrough starts on Boardy.</h2>
              <p>
                Bring your team, your half-formed ideas, and the work worth
                figuring out together.
              </p>
            </div>
            <a className="atelix-button" href={primaryPath}>
              {primaryLabel} <LandingIcon name="arrow" />
            </a>
          </div>

          <div className="atelix-site-footer__directory">
            <div className="atelix-site-footer__brand">
              <BoardyBrand />
              <p>A calmer canvas for clearer thinking and stronger teamwork.</p>
            </div>
            <nav
              className="atelix-site-footer__links"
              aria-label="Footer navigation"
            >
              {landingFooterGroups.map((group) => (
                <section key={group.title}>
                  <h3>{group.title}</h3>
                  {group.links.map((link) => (
                    <PlaceholderFooterLink key={link}>
                      {link}
                    </PlaceholderFooterLink>
                  ))}
                </section>
              ))}
            </nav>
          </div>

          <div className="atelix-site-footer__bottom">
            <span>
              © {new Date().getFullYear()} Atelix AI Inc. All rights reserved.
            </span>
            <div aria-label="Social links">
              <PlaceholderFooterLink>LinkedIn</PlaceholderFooterLink>
              <PlaceholderFooterLink>X</PlaceholderFooterLink>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
};

const authCopy: Record<
  AuthMode,
  { eyebrow: string; title: string; submit: string }
> = {
  login: {
    eyebrow: "WELCOME BACK",
    title: "Sign in to your workspace.",
    submit: "Continue to workspace",
  },
  signup: {
    eyebrow: "CREATE YOUR ACCOUNT",
    title: "Start building together.",
    submit: "Create account",
  },
  forgot: {
    eyebrow: "PASSWORD RECOVERY",
    title: "Reset your password.",
    submit: "Send reset link",
  },
  reset: {
    eyebrow: "CHOOSE A PASSWORD",
    title: "Secure your account.",
    submit: "Update password",
  },
};

const AuthPage = ({ mode }: { mode: AuthMode }) => {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const copy = authCopy[mode];
  const isEmailOnly = mode === "forgot";
  const isPasswordOnly = mode === "reset";

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      if (!isSupabaseConfigured) {
        throw new Error("Authentication is not configured yet.");
      }

      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") || "").trim();
      const password = String(formData.get("password") || "");
      const confirmPassword = String(formData.get("confirmPassword") || "");

      if (
        (mode === "signup" || mode === "reset") &&
        password !== confirmPassword
      ) {
        throw new Error("Passwords do not match.");
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          throw error;
        }
        navigate(getNextPath());
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${
              window.location.origin
            }/app?next=${encodeURIComponent(getNextPath())}`,
          },
        });
        if (error) {
          throw error;
        }
        if (data.session) {
          navigate(getNextPath());
        } else {
          setMessage("Check your email to confirm your account, then sign in.");
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) {
          throw error;
        }
        setMessage(
          "If an account exists for that email, a reset link is on its way.",
        );
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          throw error;
        }
        setMessage("Password updated. Opening your workspace…");
        navigate("/app");
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="atelix-page atelix-auth-page">
      <BoardyBrand />
      <section className="atelix-auth-card" aria-labelledby="auth-title">
        <div className="atelix-eyebrow">{copy.eyebrow}</div>
        <h1 id="auth-title">{copy.title}</h1>
        <p className="atelix-auth-note">
          {mode === "forgot"
            ? "Enter the email address connected to your account."
            : mode === "reset"
            ? "Use at least six characters for your new password."
            : "Your boards are protected by your Boardy account."}
        </p>
        <form onSubmit={submit}>
          {!isPasswordOnly && (
            <>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
            </>
          )}
          {!isEmailOnly && (
            <>
              <label htmlFor="password">
                {mode === "reset" ? "New password" : "Password"}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                minLength={6}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
              />
            </>
          )}
          {(mode === "signup" || mode === "reset") && (
            <>
              <label htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                minLength={6}
                autoComplete="new-password"
                required
              />
            </>
          )}
          {error && (
            <p className="atelix-auth-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="atelix-auth-success" role="status">
              {message}
            </p>
          )}
          <button
            className="atelix-button atelix-button-primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Please wait…" : copy.submit}
          </button>
        </form>
        <div className="atelix-auth-links">
          {mode === "login" && (
            <>
              <a className="atelix-text-link" href={authPath("/signup")}>
                Create account
              </a>
              <a className="atelix-text-link" href="/forgot-password">
                Forgot password?
              </a>
            </>
          )}
          {mode !== "login" && mode !== "reset" && (
            <a className="atelix-text-link" href={authPath("/login")}>
              Back to sign in
            </a>
          )}
          <a className="atelix-text-link" href="/">
            Back to home
          </a>
        </div>
      </section>
    </main>
  );
};

export const AtelixRouter = ({ BoardApp }: { BoardApp: BoardAppComponent }) => {
  const [location, setLocation] = useState(window.location.href);
  const [session, setSession] = useState<Session | null>();
  const [hasProAccess, setHasProAccess] = useState<boolean | null>(null);
  const currentUrl = new URL(location);
  const path = currentUrl.pathname;
  const pendingNext = currentUrl.searchParams.get("next");
  const localDemo =
    import.meta.env.DEV && currentUrl.searchParams.get("localDemo") === "1";

  useEffect(() => {
    const onPopState = () => setLocation(window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (localDemo) {
      setSession({
        access_token: "local-demo",
        refresh_token: "local-demo",
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          aud: "authenticated",
          role: "authenticated",
          email: "local-demo@boardy.test",
          app_metadata: {},
          user_metadata: {},
          created_at: new Date(0).toISOString(),
        },
      } as Session);
      return;
    }
    if (!isSupabaseConfigured) {
      setSession(null);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") {
        navigate("/reset-password");
      }
    });
    return () => subscription.unsubscribe();
  }, [localDemo]);

  useEffect(() => {
    if (!session) {
      return;
    }
    void syncRevenueCatUser(session.user.id, session.user.email).catch(() => {
      // Billing surfaces the actionable configuration error. Auth and the board
      // remain usable when RevenueCat is not configured for local work.
    });
  }, [session]);

  useEffect(() => {
    setHasProAccess(null);
  }, [session?.user.id]);

  useEffect(() => {
    if (path === "/app" && session === null) {
      navigate(
        `/login?next=${encodeURIComponent(
          `${window.location.pathname}${window.location.hash}`,
        )}`,
      );
    } else if (path === "/app" && session) {
      const next = new URLSearchParams(window.location.search).get("next");
      if (next?.startsWith("/app")) {
        navigate(next);
      } else if (hasProAccess !== true) {
        navigate(`/app/subscription${localDemo ? "?localDemo=1" : ""}`);
      }
    }
  }, [hasProAccess, localDemo, location, path, session]);

  if (
    session === undefined ||
    (path === "/app" && session && pendingNext?.startsWith("/app"))
  ) {
    return (
      <main className="atelix-page atelix-loading-page" aria-live="polite">
        Loading Boardy…
      </main>
    );
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (path === "/app/subscription") {
    if (!session) {
      navigate(
        `/login?next=${encodeURIComponent(
          `/app/subscription${localDemo ? "?localDemo=1" : ""}`,
        )}`,
      );
      return null;
    }
    return (
      <BillingPage
        user={session.user}
        onUnlocked={() => {
          setHasProAccess(true);
          navigate(`/app${localDemo ? "?localDemo=1" : ""}`);
        }}
        onSignOut={signOut}
      />
    );
  }

  if (path === "/app") {
    if (!session) {
      return null;
    }
    if (hasProAccess !== true) {
      return (
        <main className="atelix-page atelix-loading-page" aria-live="polite">
          Preparing your workspace…
        </main>
      );
    }
    return (
      <div className="atelix-board-shell">
        <header className="atelix-board-header">
          <BoardyBrand />
          <div className="atelix-board-account">
            <span title={session.user.email}>{session.user.email}</span>
            <a className="atelix-board-billing" href="/app/subscription">
              Billing
            </a>
            <button
              className="atelix-board-logout"
              type="button"
              onClick={async (event) => {
                const ownerWindow =
                  event.currentTarget.ownerDocument.defaultView;
                if (import.meta.env.DEV && ownerWindow) {
                  await localApi(ownerWindow, "session", "DELETE").catch(
                    () => undefined,
                  );
                }
                await signOut();
              }}
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="atelix-board-content">
          <BoardApp />
        </main>
      </div>
    );
  }

  if (path === "/login") {
    return <AuthPage mode="login" />;
  }
  if (path === "/signup") {
    return <AuthPage mode="signup" />;
  }
  if (path === "/forgot-password") {
    return <AuthPage mode="forgot" />;
  }
  if (path === "/reset-password") {
    return <AuthPage mode="reset" />;
  }
  if (path === "/billing") {
    if (!session) {
      navigate(`/login?next=${encodeURIComponent("/app/subscription")}`);
      return null;
    }
    navigate(`/app/subscription${localDemo ? "?localDemo=1" : ""}`);
    return null;
  }

  return <LandingPage signedIn={Boolean(session)} />;
};
