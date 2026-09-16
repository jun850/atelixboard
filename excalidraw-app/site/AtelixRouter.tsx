import React, { useEffect, useState } from "react";

import { isSupabaseConfigured, supabase } from "../supabase/client";

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
      <span>By Atelix</span>
      <img src="/android-chrome-192x192.png" alt="" width="192" height="192" />
    </span>
  </a>
);

const LandingPage = ({ signedIn }: { signedIn: boolean }) => (
  <main className="atelix-page atelix-landing-page">
    <header className="atelix-site-header">
      <BoardyBrand />
      <nav aria-label="Primary navigation">
        <a className="atelix-text-link" href={signedIn ? "/app" : "/login"}>
          {signedIn ? "Open workspace" : "Sign in"}
        </a>
      </nav>
    </header>
    <section className="atelix-hero" aria-labelledby="atelix-hero-title">
      <div className="atelix-eyebrow">BOARDY WORKSPACE</div>
      <h1 id="atelix-hero-title">Think clearly. Build together.</h1>
      <p>
        A focused, hand-drawn canvas for mapping ideas, aligning teams, and
        turning early thinking into a shared plan.
      </p>
      <div className="atelix-hero-actions">
        <a
          className="atelix-button atelix-button-primary"
          href={signedIn ? "/app" : "/signup"}
        >
          {signedIn ? "Open workspace" : "Get started"}
        </a>
        <a
          className="atelix-button atelix-button-secondary"
          href="#how-it-works"
        >
          See how it works
        </a>
      </div>
    </section>
    <section
      className="atelix-proof-grid"
      id="how-it-works"
      aria-label="Workspace benefits"
    >
      <article>
        <span>01</span>
        <h2>Start with clarity</h2>
        <p>Put the first idea on a canvas without setting up a project.</p>
      </article>
      <article>
        <span>02</span>
        <h2>Shape the thinking</h2>
        <p>Use a flexible board that keeps the conversation visible.</p>
      </article>
      <article>
        <span>03</span>
        <h2>Move forward</h2>
        <p>Keep a durable visual record of the decisions your team makes.</p>
      </article>
    </section>
    <footer className="atelix-site-footer">Boardy, by Atelix.</footer>
  </main>
);

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
