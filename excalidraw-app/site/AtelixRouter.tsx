import React, { useEffect, useState } from "react";

import { isSupabaseConfigured, supabase } from "../supabase/client";

import { BoardArtwork, LandingIcon } from "./LandingArtwork";
import { EditorArtwork } from "./EditorArtwork";

import "./AtelixRouter.scss";

import type { Session } from "@supabase/supabase-js";

type BoardAppComponent = React.ComponentType;
type AuthMode = "login" | "signup" | "forgot" | "reset";

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

const LandingPage = ({ signedIn }: { signedIn: boolean }) => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly",
  );

  const primaryPath = signedIn ? "/app" : "/signup";
  const primaryLabel = signedIn ? "Open workspace" : "Sign up";

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
          <a className="atelix-text-link" href={signedIn ? "/app" : "/login"}>
            {signedIn ? "Workspace" : "Login"}
          </a>
          <a className="atelix-button atelix-button-primary" href={primaryPath}>
            {primaryLabel}
          </a>
        </div>
      </header>

      <section className="atelix-hero" aria-labelledby="atelix-hero-title">
        <div className="atelix-hero__copy">
          <p className="atelix-hero__promise">
            <span /> The canvas for teams that think together
          </p>
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
        <h2 id="pricing-title">Pick the plan that fits your flow.</h2>
        <p>
          All the essentials for visual thinking, with powerful upgrades when
          your team needs more.
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
            Annual <small>Save up to 44%</small>
          </button>
        </div>
        <div className="atelix-pricing-grid">
          <article className="atelix-plan atelix-plan--standard">
            <h3>Standard</h3>
            <p>Everything you need to create and collaborate.</p>
            <div className="atelix-plan__price">
              <strong>{billingCycle === "monthly" ? "$3" : "$20"}</strong>
              <span>{billingCycle === "monthly" ? "/ month" : "/ year"}</span>
            </div>
            <small>
              {billingCycle === "monthly"
                ? "or $20 billed annually"
                : "billed annually"}
            </small>
            <a
              className="atelix-button atelix-button-secondary"
              href={primaryPath}
            >
              Sign up for Standard
            </a>
            <h4>Includes</h4>
            <ul>
              <li>Unlimited boards for focused work</li>
              <li>Real-time collaboration</li>
              <li>Comments and sharing</li>
              <li>Secure Boardy workspace</li>
            </ul>
          </article>
          <article className="atelix-plan atelix-plan--pro">
            <span className="atelix-plan__badge">Most popular</span>
            <h3>Pro</h3>
            <p>Premium tools for ambitious teams and polished delivery.</p>
            <div className="atelix-plan__price">
              <strong>{billingCycle === "monthly" ? "$6" : "$50"}</strong>
              <span>{billingCycle === "monthly" ? "/ month" : "/ year"}</span>
            </div>
            <small>
              {billingCycle === "monthly"
                ? "or $50 billed annually"
                : "billed annually"}
            </small>
            <a className="atelix-button" href={primaryPath}>
              Sign up for Pro
            </a>
            <h4>Everything in Standard, plus</h4>
            <ul>
              <li>Advanced team workflows</li>
              <li>Priority collaboration tools</li>
              <li>Expanded workspace controls</li>
              <li>Early access to new features</li>
            </ul>
          </article>
        </div>
      </section>

      <footer className="atelix-site-footer" data-landing-reveal>
        <div>
          <h2>Your next breakthrough starts on Boardy.</h2>
          <p>
            Bring your team, your half-formed ideas, and the work worth figuring
            out together.
          </p>
        </div>
        <a className="atelix-button" href={primaryPath}>
          {primaryLabel} <LandingIcon name="arrow" />
        </a>
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
  const currentUrl = new URL(location);
  const path = currentUrl.pathname;
  const pendingNext = currentUrl.searchParams.get("next");

  useEffect(() => {
    const onPopState = () => setLocation(window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
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
  }, []);

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
      }
    }
  }, [location, path, session]);

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

  if (path === "/app") {
    if (!session) {
      return null;
    }
    return (
      <div className="atelix-board-shell">
        <header className="atelix-board-header">
          <BoardyBrand />
          <div className="atelix-board-account">
            <span title={session.user.email}>{session.user.email}</span>
            <button
              className="atelix-board-logout"
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/");
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

  return <LandingPage signedIn={Boolean(session)} />;
};
