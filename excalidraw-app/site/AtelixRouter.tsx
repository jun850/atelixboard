import React, { useCallback, useEffect, useState } from "react";

import "./AtelixRouter.scss";

const AUTH_STORAGE_KEY = "atelix-demo-auth";

type BoardAppComponent = React.ComponentType;

const isSignedIn = () => {
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY) === "signed-in";
  } catch {
    return false;
  }
};

const navigate = (path: string) => {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

const LandingPage = ({ signedIn }: { signedIn: boolean }) => (
  <main className="atelix-page atelix-landing-page">
    <header className="atelix-site-header">
      <a className="atelix-wordmark" href="/" aria-label="Atelix home">
        Atelix
      </a>
      <nav aria-label="Primary navigation">
        <a className="atelix-text-link" href={signedIn ? "/app" : "/login"}>
          {signedIn ? "Open workspace" : "Sign in"}
        </a>
      </nav>
    </header>
    <section className="atelix-hero" aria-labelledby="atelix-hero-title">
      <div className="atelix-eyebrow">ATELIX WORKSPACE</div>
      <h1 id="atelix-hero-title">Think clearly. Build together.</h1>
      <p>
        A focused, hand-drawn canvas for mapping ideas, aligning teams, and
        turning early thinking into a shared plan.
      </p>
      <div className="atelix-hero-actions">
        <a
          className="atelix-button atelix-button-primary"
          href={signedIn ? "/app" : "/login"}
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
    <footer className="atelix-site-footer">
      A calm place for ambitious work.
    </footer>
  </main>
);

const LoginPage = ({ onLogin }: { onLogin: () => void }) => {
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      window.localStorage.setItem(AUTH_STORAGE_KEY, "signed-in");
    } catch {
      // The demo remains usable if browser storage is unavailable.
    }
    onLogin();
  };

  return (
    <main className="atelix-page atelix-auth-page">
      <a className="atelix-wordmark" href="/" aria-label="Atelix home">
        Atelix
      </a>
      <section className="atelix-auth-card" aria-labelledby="login-title">
        <div className="atelix-eyebrow">WELCOME BACK</div>
        <h1 id="login-title">Sign in to your workspace.</h1>
        <p className="atelix-auth-note">
          Demo access is local for now. Connect your identity provider when the
          product foundation is ready.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
          <button className="atelix-button atelix-button-primary" type="submit">
            Continue to workspace
          </button>
        </form>
        <a className="atelix-text-link atelix-back-link" href="/">
          Back to home
        </a>
      </section>
    </main>
  );
};

export const AtelixRouter = ({ BoardApp }: { BoardApp: BoardAppComponent }) => {
  const [path, setPath] = useState(window.location.pathname);
  const [signedIn, setSignedIn] = useState(isSignedIn);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
      setSignedIn(isSignedIn());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const goToApp = useCallback(() => {
    setSignedIn(true);
    navigate("/app");
  }, []);

  if (path === "/app") {
    if (!signedIn) {
      navigate("/login");
      return null;
    }
    return (
      <div className="atelix-board-shell">
        <header className="atelix-board-header">
          <a className="atelix-wordmark" href="/" aria-label="Atelix home">
            Atelix
          </a>
          <button
            className="atelix-board-logout"
            type="button"
            onClick={() => {
              window.localStorage.removeItem(AUTH_STORAGE_KEY);
              setSignedIn(false);
              navigate("/");
            }}
          >
            Sign out
          </button>
        </header>
        <main className="atelix-board-content">
          <BoardApp />
        </main>
      </div>
    );
  }

  if (path === "/login") {
    return <LoginPage onLogin={goToApp} />;
  }

  return <LandingPage signedIn={signedIn} />;
};
