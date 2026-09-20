import React, { useEffect, useRef, useState } from "react";

import { plainDoc } from "../../supabase/functions/_shared/studio-core";

import { ArticleEditor } from "./discovery/ArticleEditor";
import { studio, type Row } from "./discovery/api";
import "./VisibilityPage.scss";

import type { Session } from "@supabase/supabase-js";

const navigation = [
  ["", "Overview", "overview"],
  ["DISCOVER", "Prompts", "prompts"],
  ["CREATE", "Knowledge", "knowledge"],
  ["", "Content", "content"],
  ["MEASURE", "Content analytics", "analytics"],
  ["", "AI traffic", "traffic"],
  ["OPERATIONS", "Generation queue", "queue"],
  ["SETTINGS", "Product setup", "product"],
  ["", "Prompt execution", "execution"],
  ["", "Personas", "personas"],
  ["", "Website", "website"],
  ["", "Codex connection", "connection"],
];
const descriptions: Record<string, string> = {
  overview:
    "Track how Boardy is discovered, cited, and visited across AI surfaces.",
  prompts: "Discover the questions your future customers are asking.",
  knowledge:
    "Your product’s shared notes and facts, used whenever we need context to answer or write.",
  content:
    "Create, publish, and manage the content your audience and AI agents discover.",
  analytics: "Monitor observed article links, tracked URLs, and AI traffic.",
  traffic: "See which crawlers visit your website, and which pages they read.",
  queue: "Follow generation, review, and monitoring work on your Mac.",
  product: "Manage the product facts used in your visibility workspace.",
  execution: "Choose how prompts run for this product.",
  personas: "Manage the audiences used when creating prompts.",
  website: "Publish original content on your own domain.",
  connection: "Connect your ChatGPT subscription through Codex on your Mac.",
};
function Icon({ kind }: { kind: string }) {
  const shapes: Record<string, React.ReactNode> = {
    overview: (
      <>
        <path d="m3 10 9-7 9 7v10H3Z" />
        <path d="M9 20v-7h6v7" />
      </>
    ),
    prompts: (
      <>
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="m7 18-3 4m4-13h8m-8 4h5" />
      </>
    ),
    knowledge: (
      <>
        <path d="M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1v15" />
      </>
    ),
    content: (
      <>
        <rect x="4" y="3" width="15" height="18" rx="2" />
        <path d="M8 8h7M8 12h7M8 16h4" />
      </>
    ),
    analytics: (
      <>
        <path d="M12 3v9h9A9 9 0 1 1 12 3Z" />
        <path d="M16 3a9 9 0 0 1 5 5h-5Z" />
      </>
    ),
    traffic: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M12 3v4M8 12v3m8-3v3" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {shapes[kind] || (
        <>
          <path d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="8" cy="6" r="2" />
          <circle cx="16" cy="12" r="2" />
          <circle cx="10" cy="18" r="2" />
        </>
      )}
    </svg>
  );
}
const date = (s: string) => (s ? new Date(s).toLocaleDateString() : "—");
const fmt = (n: unknown) => Number(n || 0).toLocaleString();
const formats = [
  "faq",
  "explainer",
  "decision-guide",
  "comparison",
  "workflow",
];
export const VisibilityPage = ({ session }: { session: Session }) => {
  const root = useRef<HTMLDivElement>(null);
  const [view, setView] = useState("overview");
  const [tab, setTab] = useState("library");
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [boot, setBoot] = useState<Row | null>(null);
  const [rowPage, setRowPage] = useState<{ key: string; rows: Row[] }>({
    key: "",
    rows: [],
  });
  const [total, setTotal] = useState(0);
  const [performance, setPerformance] = useState<Record<string, Row>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [editor, setEditor] = useState<Row | null>(null);
  const [form, setForm] = useState<Row | null>(null);
  const [pairCode, setPairCode] = useState("");
  const [details, setDetails] = useState<Row | null>(null);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [format, setFormat] = useState("explainer");
  const owner =
    session.user.id === "702d5af6-4cd5-4b71-8f6c-210229068379" &&
    session.user.email?.toLowerCase() === "junarcana263@gmail.com";
  const refresh = () => setRevision((n) => n + 1);
  const requestKey = () =>
    root.current!.ownerDocument.defaultView!.crypto.randomUUID();
  const navigate = (next: string) => {
    setView(next);
    setTab("library");
    setPage(0);
    setSearch("");
    setQuery("");
    setSelected([]);
    setDetails(null);
    const w = root.current?.ownerDocument.defaultView;
    if (w) {
      w.history.pushState({}, "", `/app/visibility?view=${next}`);
    }
  };
  useEffect(() => {
    const w = root.current?.ownerDocument.defaultView;
    if (!w) {
      return;
    }
    const sync = () => {
      const v = new URL(w.location.href).searchParams.get("view");
      if (navigation.some((n) => n[2] === v)) {
        setView(v!);
      }
    };
    sync();
    w.addEventListener("popstate", sync);
    return () => w.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    if (root.current) {
      root.current.ownerDocument.title = `${
        navigation.find((n) => n[2] === view)?.[1]
      } | Boardy`;
    }
  }, [view]);
  useEffect(() => {
    const w = root.current?.ownerDocument.defaultView;
    const timer = w?.setTimeout(() => {
      setQuery(search);
      setPage(0);
    }, 350);
    return () => {
      if (timer) {
        w?.clearTimeout(timer);
      }
    };
  }, [search]);
  useEffect(() => {
    if (!owner) {
      return;
    }
    let active = true;
    void studio({ action: "bootstrap", days })
      .then((data) => {
        if (active) {
          setBoot(data);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [owner, days, revision]);
  const entity =
    view === "prompts" || (view === "content" && tab === "create")
      ? "prompts"
      : view === "content" || view === "analytics"
      ? "articles"
      : view === "knowledge"
      ? "knowledge"
      : view === "queue"
      ? "jobs"
      : view === "traffic"
      ? "articles"
      : null;
  const pageKey = `${entity}:${view}:${tab}:${page}:${query}`;
  const rows = rowPage.key === pageKey ? rowPage.rows : [];
  useEffect(() => {
    if (!owner || !entity) {
      setRowPage({ key: "", rows: [] });
      return;
    }
    let active = true;
    setLoading(true);
    setSelected([]);
    setError("");
    void studio({
      action: "list",
      entity,
      page,
      search: query,
      days,
      filter: view === "content" && tab === "review" ? "draft" : undefined,
    })
      .then((data) => {
        if (active) {
          setRowPage({ key: pageKey, rows: data.rows });
          setTotal(data.total);
          setPerformance(
            Object.fromEntries(
              (data.performance || []).map((p: Row) => [p.id, p]),
            ),
          );
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [owner, entity, page, query, days, revision, tab, view, pageKey]);
  async function act(body: Record<string, unknown>, success = "Saved") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await studio(body);
      setMessage(success);
      refresh();
      return data;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const enqueue = (kind: string, ids = selected) =>
    act(
      {
        action: "enqueue",
        kind,
        ids,
        topic,
        count,
        format,
        requestKey: requestKey(),
      },
      "Queued. Your Mac will process this when connected.",
    );
  const openArticle = async (id: string) => {
    const data = await act({ action: "get", entity: "articles", id }, "");
    if (data) {
      setEditor(data.item);
    }
  };
  const editRow = async (entity: string, id: string) => {
    const data = await act({ action: "get", entity, id }, "");
    if (data) {
      setForm({ entity, ...data.item });
    }
  };
  const published = rows
    .filter((r) => selected.includes(r.id))
    .map((r) => ({ id: r.id, version: r.version }));
  const stats = boot?.stats;
  const connected = boot?.workers.some(
    (w: Row) =>
      !w.revoked &&
      w.status.connected &&
      Date.now() - new Date(w.heartbeat_at).getTime() < 120000,
  );
  const sources = stats?.sources || [];
  return (
    <div className="boardy-studio" ref={root}>
      <a className="studio-skip" href="#studio-main">
        Skip to content
      </a>
      <aside className="studio-sidebar">
        <a className="studio-back" href="/app">
          ‹ Back to workspace
        </a>
        <a className="studio-product" href="/app/visibility">
          <span className="studio-logo">B</span>
          <span>
            Boardy by Atelix<small>boardy.sbs</small>
          </span>
        </a>
        <nav aria-label="AI visibility">
          {navigation.map(([group, label, key]) => (
            <React.Fragment key={key}>
              {group && <p className="studio-nav-group">{group}</p>}
              <a
                href={`/app/visibility?view=${key}`}
                aria-current={view === key ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(key);
                }}
              >
                <Icon kind={key} />
                {label}
              </a>
            </React.Fragment>
          ))}
        </nav>
        <div className="studio-user">
          <span className="studio-avatar">J</span>
          <span>
            Jun<small>{session.user.email}</small>
          </span>
        </div>
      </aside>
      <div className="studio-stage">
        <header className="studio-topbar">
          <span>{navigation.find((n) => n[2] === view)?.[1]}</span>
          <div className="studio-actions">
            <span className="studio-engine">Codex</span>
            <button onClick={refresh} disabled={busy}>
              Refresh
            </button>
          </div>
        </header>
        <main id="studio-main" className="studio-main">
          <div className="studio-page-heading">
            <div>
              <h1>{navigation.find((n) => n[2] === view)?.[1]}</h1>
              <p>{descriptions[view]}</p>
            </div>
            <label className="studio-period">
              Period
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </label>
          </div>
          {!owner ? (
            <p role="alert">
              This dashboard is restricted to the owner account.
            </p>
          ) : (
            <>
              {error && (
                <p className="studio-error" role="alert">
                  {error}
                </p>
              )}
              <p className="studio-status" role="status">
                {message || (!boot && !error ? "Loading workspace…" : "")}
              </p>
              {view === "overview" && stats && (
                <>
                  <div className="studio-onboarding">
                    <span
                      className="studio-progress"
                      aria-label={`${
                        Number(connected) +
                        Number(stats.prompts > 0) +
                        Number(stats.published > 0)
                      } of 3 steps complete`}
                    >
                      {[connected, stats.prompts > 0, stats.published > 0].map(
                        (done, i) => (
                          <i key={i} className={done ? "done" : ""} />
                        ),
                      )}
                    </span>
                    <span>
                      Next:{" "}
                      {!connected
                        ? "Connect Codex"
                        : !stats.prompts
                        ? "Create prompts"
                        : "Review your content"}
                    </span>
                    <button
                      onClick={() =>
                        navigate(
                          !connected
                            ? "connection"
                            : !stats.prompts
                            ? "prompts"
                            : "content",
                        )
                      }
                    >
                      {!connected ? "Connect Codex" : "Open content"} →
                    </button>
                  </div>
                  <section className="studio-panel">
                    <div className="studio-panel-heading">
                      <h2>Visibility & traffic</h2>
                      <p>
                        Compare recorded Codex answers with requests reaching
                        your site.
                      </p>
                    </div>
                    <div className="studio-metrics">
                      {[
                        [
                          "Mention rate",
                          stats.runs
                            ? `${Math.round(
                                (stats.mentions / stats.runs) * 100,
                              )}%`
                            : "—",
                          `${fmt(stats.runs)} successful checks`,
                        ],
                        [
                          "Published articles",
                          fmt(stats.published),
                          "Reviewed and published",
                        ],
                        [
                          "AI referrals",
                          fmt(stats.traffic.ai_referral),
                          "Observed requests",
                        ],
                        [
                          "Boardy link rate",
                          stats.runs
                            ? `${Math.round(
                                (stats.citations / stats.runs) * 100,
                              )}%`
                            : "—",
                          "Links in recorded answers",
                        ],
                        [
                          "Top traffic source",
                          sources[0]?.source || "—",
                          "In this period",
                        ],
                      ].map(([label, value, note]) => (
                        <div key={label}>
                          <span>{label}</span>
                          <strong>{value}</strong>
                          <small>{note}</small>
                        </div>
                      ))}
                    </div>
                    <Trend data={stats.daily} />
                  </section>
                  <div className="studio-two">
                    <section className="studio-panel">
                      <h2>Content workspace</h2>
                      <div className="studio-row">
                        <span>Buyer prompts</span>
                        <strong>{fmt(stats.prompts)}</strong>
                      </div>
                      <div className="studio-row">
                        <span>Articles</span>
                        <strong>{fmt(stats.articles)}</strong>
                      </div>
                      <button onClick={() => navigate("content")}>
                        Open content →
                      </button>
                    </section>
                    <section className="studio-panel">
                      <h2>Generation queue</h2>
                      <p>{fmt(stats.queued)} jobs waiting or running</p>
                      <p>
                        {connected
                          ? "Your Mac is connected."
                          : "Your Mac is offline. Jobs stay safely queued."}
                      </p>
                      <button onClick={() => navigate("queue")}>
                        View queue →
                      </button>
                    </section>
                  </div>
                  <p className="studio-note">
                    Codex observations are not consumer ChatGPT rankings.
                    Crawler identities are inferred from user agents; requests
                    are not unique visitors.
                  </p>
                </>
              )}
              {[
                "prompts",
                "content",
                "knowledge",
                "analytics",
                "traffic",
                "queue",
              ].includes(view) && (
                <>
                  {view === "content" && (
                    <div
                      className="studio-tabs"
                      role="tablist"
                      aria-label="Content"
                    >
                      {[
                        ["library", "Library"],
                        ["create", "To create"],
                        ["review", "Review queue"],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          role="tab"
                          aria-selected={tab === key}
                          onClick={() => {
                            setTab(key);
                            setPage(0);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  {view === "knowledge" && (
                    <div className="studio-tabs">
                      <button
                        onClick={() => setTab("library")}
                        aria-pressed={tab === "library"}
                      >
                        Overview
                      </button>
                      <button
                        onClick={() => setTab("files")}
                        aria-pressed={tab === "files"}
                      >
                        Files
                      </button>
                    </div>
                  )}
                  {view === "traffic" && stats && (
                    <section className="studio-panel">
                      <h2>Incoming AI traffic</h2>
                      <Trend data={stats.daily} />
                      <div className="studio-source-list">
                        {sources.map((s: Row) => (
                          <div className="studio-row" key={s.source + s.kind}>
                            <span>
                              {s.source}
                              <small>{s.kind.replaceAll("_", " ")}</small>
                            </span>
                            <strong>{fmt(s.requests)}</strong>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {view === "prompts" && (
                    <section className="studio-generate">
                      <div>
                        <h2>Discover buyer questions</h2>
                        <p>
                          Generate source-backed, unbranded questions in
                          repeatable batches.
                        </p>
                      </div>
                      <div className="studio-actions">
                        <label>
                          Topic
                          <input
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g. planning a team workshop"
                          />
                        </label>
                        <label>
                          Count
                          <input
                            type="number"
                            min={1}
                            max={25}
                            value={count}
                            onChange={(e) => setCount(Number(e.target.value))}
                          />
                        </label>
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() => void enqueue("prompts")}
                        >
                          Generate prompts
                        </button>
                        <button
                          onClick={() =>
                            setForm({
                              entity: "prompts",
                              text: "",
                              topic: "",
                              persona: "",
                              journey: "",
                              sources: [],
                            })
                          }
                        >
                          Add prompt
                        </button>
                      </div>
                    </section>
                  )}
                  {view === "knowledge" && (
                    <section className="studio-generate">
                      <div>
                        <h2>Add a source</h2>
                        <p>
                          Keep verified facts separate from research awaiting
                          your review.
                        </p>
                      </div>
                      <div className="studio-actions">
                        <button
                          className="primary"
                          onClick={() =>
                            setForm({
                              entity: "knowledge",
                              name: "",
                              body: "",
                              source_url: "",
                              approved: false,
                            })
                          }
                        >
                          Add knowledge
                        </button>
                        <label>
                          Research topic
                          <input
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Buyer needs or product context"
                          />
                        </label>
                        <button
                          disabled={busy}
                          onClick={() => void enqueue("research")}
                        >
                          Research with Codex
                        </button>
                      </div>
                    </section>
                  )}
                  <div className="studio-library-toolbar">
                    <span>
                      {fmt(total)} {entity}
                    </span>
                    <label className="studio-search">
                      Search
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={`Search ${entity}…`}
                      />
                    </label>
                    {view === "content" && tab !== "create" && (
                      <button
                        onClick={async () => {
                          const data = await act(
                            {
                              action: "save",
                              entity: "articles",
                              title: "Untitled article",
                              description: "",
                              doc: plainDoc("Start writing here."),
                            },
                            "Draft created",
                          );
                          if (data) {
                            setEditor(data.item);
                          }
                        }}
                      >
                        New article
                      </button>
                    )}
                  </div>
                  {(entity === "prompts" || entity === "articles") && (
                    <div className="studio-batch">
                      <span>{selected.length} selected</span>
                      {entity === "prompts" ? (
                        <>
                          <label>
                            Format
                            <select
                              value={format}
                              onChange={(e) => setFormat(e.target.value)}
                            >
                              {formats.map((f) => (
                                <option key={f} value={f}>
                                  {f.replaceAll("-", " ")}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            className="primary"
                            disabled={!selected.length || busy}
                            onClick={() => void enqueue("article")}
                          >
                            Create drafts
                          </button>
                          <button
                            disabled={!selected.length || busy}
                            onClick={() =>
                              void act(
                                {
                                  action: "track",
                                  ids: selected,
                                  tracked: true,
                                },
                                "Weekly tracking enabled",
                              )
                            }
                          >
                            Track weekly
                          </button>
                          <button
                            disabled={!selected.length || busy}
                            onClick={() =>
                              void act(
                                {
                                  action: "track",
                                  ids: selected,
                                  tracked: false,
                                },
                                "Tracking paused",
                              )
                            }
                          >
                            Pause tracking
                          </button>
                          <button
                            disabled={!selected.length || busy}
                            onClick={() => void enqueue("check")}
                          >
                            Run checks
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="primary"
                            disabled={!selected.length || busy}
                            onClick={() =>
                              void act(
                                { action: "publish", items: published },
                                "Published selected articles",
                              )
                            }
                          >
                            Publish selected
                          </button>
                          <button
                            disabled={!selected.length || busy}
                            onClick={() =>
                              void act(
                                {
                                  action: "publish",
                                  items: published,
                                  publish: false,
                                },
                                "Unpublished selected articles",
                              )
                            }
                          >
                            Unpublish
                          </button>
                        </>
                      )}
                      <button onClick={() => setSelected([])}>
                        Clear selection
                      </button>
                    </div>
                  )}
                  {view === "knowledge" && tab === "files" ? (
                    <KnowledgeFiles
                      rows={rows}
                      edit={(id) => void editRow("knowledge", id)}
                    />
                  ) : (
                    <div className="studio-table-wrap" aria-busy={loading}>
                      <table>
                        <thead>
                          <tr>
                            {["prompts", "articles"].includes(entity || "") && (
                              <th>
                                <input
                                  type="checkbox"
                                  aria-label="Select this page"
                                  checked={
                                    rows.length > 0 &&
                                    selected.length === rows.length
                                  }
                                  onChange={(e) =>
                                    setSelected(
                                      e.target.checked
                                        ? rows.map((r) => r.id)
                                        : [],
                                    )
                                  }
                                />
                              </th>
                            )}
                            <th>
                              {entity === "prompts"
                                ? "Prompt"
                                : entity === "articles"
                                ? "Article"
                                : entity === "knowledge"
                                ? "Knowledge file"
                                : "Job"}
                            </th>
                            {entity === "prompts" ? (
                              <>
                                <th>Coverage</th>
                                <th>Checks</th>
                                <th>Mentions</th>
                                <th>Tracking</th>
                              </>
                            ) : entity === "articles" ? (
                              <>
                                <th>Status</th>
                                <th>Crawls</th>
                                <th>AI referrals</th>
                                <th>Other requests</th>
                                <th>Links</th>
                              </>
                            ) : entity === "knowledge" ? (
                              <>
                                <th>Version</th>
                                <th>Status</th>
                                <th>Updated</th>
                              </>
                            ) : (
                              <>
                                <th>Status</th>
                                <th>Created</th>
                              </>
                            )}
                            <th>
                              <span className="studio-sr">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => {
                            const p = performance[r.id] || {};
                            return (
                              <tr key={r.id}>
                                {["prompts", "articles"].includes(
                                  entity || "",
                                ) && (
                                  <td>
                                    <input
                                      type="checkbox"
                                      aria-label={`Select ${r.title || r.text}`}
                                      checked={selected.includes(r.id)}
                                      onChange={(e) =>
                                        setSelected(
                                          e.target.checked
                                            ? [...selected, r.id]
                                            : selected.filter(
                                                (id) => id !== r.id,
                                              ),
                                        )
                                      }
                                    />
                                  </td>
                                )}
                                <td className="studio-title-cell">
                                  {entity === "prompts" ? (
                                    <>
                                      <button
                                        className="studio-text-button"
                                        onClick={() =>
                                          void editRow("prompts", r.id)
                                        }
                                      >
                                        {r.text}
                                      </button>
                                      <small>
                                        {r.topic || "Uncategorized"} ·{" "}
                                        {r.persona || "General buyer"}
                                      </small>
                                    </>
                                  ) : entity === "articles" ? (
                                    <>
                                      <button
                                        className="studio-text-button"
                                        onClick={() => void openArticle(r.id)}
                                      >
                                        {r.title}
                                      </button>
                                      <small>
                                        {r.format.replaceAll("-", " ")} ·{" "}
                                        {date(r.updated_at)}
                                      </small>
                                    </>
                                  ) : entity === "knowledge" ? (
                                    <>
                                      <button
                                        className="studio-text-button"
                                        onClick={() =>
                                          void editRow("knowledge", r.id)
                                        }
                                      >
                                        {r.name}
                                      </button>
                                      <small>
                                        {r.source_url || "Product knowledge"}
                                      </small>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        className="studio-text-button"
                                        onClick={async () => {
                                          const data = await act(
                                            {
                                              action: "get",
                                              entity: "jobs",
                                              id: r.id,
                                            },
                                            "",
                                          );
                                          if (data) {
                                            setDetails(data.item);
                                          }
                                        }}
                                      >
                                        {r.kind}
                                      </button>
                                      <small>
                                        {r.input?.prompt ||
                                          r.input?.topic ||
                                          r.input?.article?.title ||
                                          "Boardy workflow"}
                                      </small>
                                    </>
                                  )}
                                </td>
                                {entity === "prompts" ? (
                                  <>
                                    <td>
                                      {p.formats?.length || 0} of{" "}
                                      {formats.length} formats
                                      <small>{p.articles || 0} articles</small>
                                    </td>
                                    <td>{fmt(p.runs)}</td>
                                    <td>
                                      {p.runs ? `${p.mentions}/${p.runs}` : "—"}
                                    </td>
                                    <td>
                                      <span className="studio-badge">
                                        {r.tracked ? "Weekly" : "Paused"}
                                      </span>
                                    </td>
                                  </>
                                ) : entity === "articles" ? (
                                  <>
                                    <td>
                                      <span
                                        className={`studio-badge ${
                                          r.published_at ? "success" : ""
                                        }`}
                                      >
                                        {r.published_at
                                          ? r.has_draft
                                            ? "Draft changes"
                                            : "Published"
                                          : "In review"}
                                      </span>
                                    </td>
                                    <td>{fmt(p.crawls)}</td>
                                    <td>{fmt(p.referrals)}</td>
                                    <td>{fmt(p.requests)}</td>
                                    <td>{fmt(p.citations)}</td>
                                  </>
                                ) : entity === "knowledge" ? (
                                  <>
                                    <td>{r.version}</td>
                                    <td>
                                      <span className="studio-badge">
                                        {r.approved ? "Approved" : "In review"}
                                      </span>
                                    </td>
                                    <td>{date(r.updated_at)}</td>
                                  </>
                                ) : (
                                  <>
                                    <td>
                                      <span className="studio-badge">
                                        {r.state}
                                      </span>
                                      {r.error && <small>{r.error}</small>}
                                    </td>
                                    <td>{date(r.created_at)}</td>
                                  </>
                                )}
                                <td>
                                  {entity === "articles" ? (
                                    r.published_at ? (
                                      <a
                                        href={`/learn/${r.slug}`}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        View ↗
                                      </a>
                                    ) : (
                                      <button
                                        onClick={() => void openArticle(r.id)}
                                      >
                                        Review draft
                                      </button>
                                    )
                                  ) : entity === "prompts" ? (
                                    <button
                                      onClick={async () => {
                                        const data = await act(
                                          {
                                            action: "list",
                                            entity: "runs",
                                            id: r.id,
                                          },
                                          "",
                                        );
                                        if (data) {
                                          setDetails({
                                            kind: "observations",
                                            result: data.rows,
                                          });
                                        }
                                      }}
                                    >
                                      Results
                                    </button>
                                  ) : entity === "jobs" ? (
                                    <>
                                      {["queued", "running"].includes(
                                        r.state,
                                      ) ? (
                                        <button
                                          disabled={busy}
                                          onClick={() =>
                                            void act(
                                              { action: "cancel", id: r.id },
                                              "Cancelled",
                                            )
                                          }
                                        >
                                          Cancel
                                        </button>
                                      ) : [
                                          "failed",
                                          "interrupted",
                                          "cancelled",
                                        ].includes(r.state) ? (
                                        <button
                                          disabled={busy}
                                          onClick={() =>
                                            void act(
                                              {
                                                action: "retry",
                                                id: r.id,
                                                requestKey: requestKey(),
                                              },
                                              "Retry queued",
                                            )
                                          }
                                        >
                                          Retry
                                        </button>
                                      ) : null}
                                    </>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {!rows.length && (
                        <div className="studio-empty">
                          <Icon kind={view} />
                          <h3>{loading ? "Loading…" : `No ${entity} found`}</h3>
                          <p>
                            {loading
                              ? "Fetching your workspace."
                              : view === "queue"
                              ? "Generation jobs appear here when you create prompts or articles."
                              : "Add content or change your search to get started."}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="studio-pagination">
                    <span>
                      Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}
                    </span>
                    <div>
                      <button
                        disabled={!page || loading}
                        onClick={() => setPage(page - 1)}
                      >
                        Previous
                      </button>
                      <button
                        disabled={(page + 1) * 25 >= total || loading}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
              {view === "connection" && (
                <>
                  <section className="studio-panel">
                    <h2>ChatGPT subscription</h2>
                    <p>
                      Generate on your Mac with Codex. Your login stays on your
                      Mac; publishing and analytics stay online.
                    </p>
                    <ol className="studio-steps">
                      <li>
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={async () => {
                            const d = await act(
                              { action: "pair-create" },
                              "Pairing code expires in 10 minutes",
                            );
                            if (d) {
                              setPairCode(d.code);
                            }
                          }}
                        >
                          Pair a Mac
                        </button>
                      </li>
                      <li>
                        <p>From the Boardy repository on your Mac:</p>
                        <code>
                          yarn discovery:worker pair{" "}
                          {pairCode || "&lt;pairing-code&gt;"}
                        </code>
                      </li>
                      <li>
                        <code>yarn discovery:worker login</code>
                        <p>
                          Complete the official ChatGPT sign-in in your browser.
                        </p>
                      </li>
                      <li>
                        <code>yarn discovery:worker start</code>
                        <p>
                          Leave the worker running while generation is queued.
                        </p>
                        <p>Or run automatically when you log into this Mac:</p>
                        <code>yarn discovery:worker install</code>
                      </li>
                    </ol>
                    <label>
                      Model
                      <select
                        value={boot?.settings.model || ""}
                        onChange={(e) =>
                          void act(
                            { action: "settings", model: e.target.value },
                            "Model selected",
                          )
                        }
                      >
                        <option value="">Select model</option>
                        {Array.from(
                          new Map(
                            (boot?.workers || [])
                              .filter((w: Row) => !w.revoked)
                              .flatMap((w: Row) => w.status.models || [])
                              .map((m: Row) => [m.id, m]),
                          ).values(),
                        ).map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {m.name || m.id}
                          </option>
                        ))}
                      </select>
                    </label>
                  </section>
                  {boot?.workers.map((w: Row) => (
                    <section className="studio-panel" key={w.id}>
                      <div className="studio-row">
                        <h2>{w.name}</h2>
                        <span className="studio-badge">
                          {w.revoked
                            ? "Revoked"
                            : w.status.connected &&
                              Date.now() - new Date(w.heartbeat_at).getTime() <
                                120000
                            ? "Connected"
                            : "Offline"}
                        </span>
                      </div>
                      <p>
                        Last seen:{" "}
                        {w.heartbeat_at
                          ? new Date(w.heartbeat_at).toLocaleString()
                          : "Waiting for pairing"}
                      </p>
                      <p>{w.status.message}</p>
                      {w.status.limits && (
                        <details>
                          <summary>Subscription usage</summary>
                          <pre>{JSON.stringify(w.status.limits, null, 2)}</pre>
                        </details>
                      )}
                      <button
                        disabled={w.revoked || busy}
                        onClick={() =>
                          void act(
                            { action: "revoke", id: w.id },
                            "Worker revoked",
                          )
                        }
                      >
                        Disconnect
                      </button>
                    </section>
                  ))}
                </>
              )}
              {view === "execution" && (
                <section className="studio-panel">
                  <h2>Codex execution</h2>
                  <p>
                    Selected prompts run weekly in a fresh session with search
                    enabled. Writing jobs run first. Missed weeks are combined
                    into one overdue check.
                  </p>
                  <label className="studio-check">
                    <input
                      type="checkbox"
                      checked={boot?.settings.paused || false}
                      onChange={(e) =>
                        void act(
                          { action: "settings", paused: e.target.checked },
                          e.target.checked ? "Queue paused" : "Queue resumed",
                        )
                      }
                    />
                    Pause all jobs
                  </label>
                  <p>
                    Results identify the actual Codex model. They do not
                    represent consumer ChatGPT rankings.
                  </p>
                  <button onClick={() => navigate("connection")}>
                    Manage connection
                  </button>
                </section>
              )}
              {view === "product" && (
                <section className="studio-panel">
                  <h2>Boardy by Atelix</h2>
                  <dl>
                    <dt>Domain</dt>
                    <dd>https://boardy.sbs</dd>
                    <dt>Owner</dt>
                    <dd>junarcana263@gmail.com</dd>
                  </dl>
                  <p>
                    Approved knowledge is the source of truth for generated
                    product claims. Update it when features or access
                    requirements change.
                  </p>
                  <button onClick={() => navigate("knowledge")}>
                    Edit product knowledge
                  </button>
                </section>
              )}
              {view === "personas" && (
                <section className="studio-panel">
                  <div className="studio-row">
                    <h2>Audience personas</h2>
                    <button
                      className="primary"
                      onClick={() =>
                        setForm({
                          entity: "personas",
                          name: "",
                          description: "",
                        })
                      }
                    >
                      Add persona
                    </button>
                  </div>
                  {boot?.personas.map((p: Row) => (
                    <div className="studio-row" key={p.id}>
                      <div>
                        {p.name}
                        <small>{p.description}</small>
                      </div>
                      <button
                        onClick={() => setForm({ entity: "personas", ...p })}
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </section>
              )}
              {view === "website" && (
                <section className="studio-panel">
                  <h2>Your website</h2>
                  <p>
                    <a href="/learn" target="_blank" rel="noreferrer">
                      boardy.sbs/learn ↗
                    </a>
                  </p>
                  <p>
                    Vercel serves published articles through Boardy’s own
                    reverse proxy. Each article has a canonical HTML page and
                    Markdown version.
                  </p>
                  <div className="studio-row">
                    <span>Sitemap</span>
                    <a href="/sitemap.xml">Open sitemap ↗</a>
                  </div>
                  <div className="studio-row">
                    <span>AI content index</span>
                    <a href="/llms.txt">Open index ↗</a>
                  </div>
                  <div className="studio-row">
                    <span>Public MCP</span>
                    <code>https://boardy.sbs/mcp</code>
                  </div>
                  <p>
                    Google Search Console is not connected. Verify the domain in
                    your Google account and submit the sitemap.
                  </p>
                </section>
              )}
            </>
          )}
        </main>
      </div>
      {editor && (
        <ArticleEditor
          key={editor.id}
          initial={editor}
          onClose={() => setEditor(null)}
          onChange={refresh}
        />
      )}
      {form && (
        <FormDialog
          initial={form}
          error={error}
          personas={boot?.personas || []}
          onClose={() => setForm(null)}
          onSave={async (values) => {
            const d = await act(
              values.entity === "personas"
                ? { action: "persona-save", ...values }
                : { action: "save", ...values },
            );
            if (d) {
              setForm(null);
            }
          }}
        />
      )}
      {details && (
        <DetailsDialog
          item={details}
          onClose={() => setDetails(null)}
          apply={async () => {
            const a = details.input?.article;
            if (!a) {
              return;
            }
            const d = await act(
              { action: "get", entity: "articles", id: a.id },
              "",
            );
            if (!d) {
              return;
            }
            if (d.item.version !== a.version) {
              setError(
                "The article changed after this review. Compare the suggestion before applying it.",
              );
              return;
            }
            const saved = await act(
              {
                action: "save",
                entity: "articles",
                ...d.item,
                doc: details.result.doc,
              },
              "Review applied as a draft",
            );
            if (saved) {
              setDetails(null);
              setEditor(saved.item);
            }
          }}
        />
      )}
    </div>
  );
};
function Trend({ data }: { data: Row[] }) {
  const max = Math.max(1, ...data.map((d) => Number(d.requests)));
  return (
    <div className="studio-trend">
      <span className="studio-trend-label">Observed requests</span>
      {data.length ? (
        <>
          <svg
            viewBox="0 0 1000 200"
            role="img"
            aria-label="Daily observed requests"
            preserveAspectRatio="none"
          >
            <path
              d="M0 190H1000M0 95H1000M0 1H1000"
              stroke="var(--studio-line)"
              strokeDasharray="3 5"
              fill="none"
            />
            <polyline
              points={data
                .map(
                  (d, i) =>
                    `${
                      data.length === 1 ? 500 : (i / (data.length - 1)) * 1000
                    },${190 - (Number(d.requests) / max) * 175}`,
                )
                .join(" ")}
              fill="none"
              stroke="var(--studio-accent)"
              strokeWidth="2"
            />
            {data.length === 1 && (
              <circle
                cx="500"
                cy={190 - (Number(data[0].requests) / max) * 175}
                r="4"
                fill="var(--studio-accent)"
              />
            )}
          </svg>
          <div className="studio-row">
            <small>{data[0].day}</small>
            <small>{data[data.length - 1].day}</small>
          </div>
          <details>
            <summary>Daily values</summary>
            {data.map((d) => (
              <div className="studio-row" key={d.day}>
                {d.day}
                <span>{fmt(d.requests)}</span>
              </div>
            ))}
          </details>
        </>
      ) : (
        <div className="studio-empty">
          <h3>No observations yet</h3>
          <p>
            Requests will appear here as people and crawlers reach your content.
          </p>
        </div>
      )}
    </div>
  );
}
function FormDialog({
  initial,
  error,
  personas,
  onClose,
  onSave,
}: {
  initial: Row;
  error: string;
  personas: Row[];
  onClose: () => void;
  onSave: (v: Row) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const field = (key: string, val: unknown) => setV({ ...v, [key]: val });
  return (
    <dialog
      ref={ref}
      className="studio-form-dialog"
      onCancel={onClose}
      aria-labelledby="form-title"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await onSave(v);
          setBusy(false);
        }}
      >
        <h2 id="form-title">
          {initial.id ? "Edit" : "Add"}{" "}
          {initial.entity === "prompts"
            ? "prompt"
            : initial.entity === "knowledge"
            ? "knowledge"
            : "persona"}
        </h2>
        {error && <p role="alert">{error}</p>}
        {v.entity === "prompts" ? (
          <>
            <label>
              Question
              <textarea
                required
                value={v.text}
                onChange={(e) => field("text", e.target.value)}
                rows={4}
              />
            </label>
            <label>
              Topic
              <input
                value={v.topic}
                onChange={(e) => field("topic", e.target.value)}
              />
            </label>
            <label>
              Persona
              <select
                value={v.persona}
                onChange={(e) => field("persona", e.target.value)}
              >
                <option value="">General buyer</option>
                {personas.map((p) => (
                  <option key={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label>
              Buyer journey
              <input
                value={v.journey}
                onChange={(e) => field("journey", e.target.value)}
              />
            </label>
            <label>
              Source URLs
              <textarea
                value={(v.sources || []).join("\n")}
                onChange={(e) =>
                  field("sources", e.target.value.split("\n").filter(Boolean))
                }
              />
            </label>
            {v.evidence?.length > 0 && (
              <details>
                <summary>Verified source excerpts</summary>
                {v.evidence.map((e: Row, i: number) => (
                  <blockquote key={i}>
                    <p>{e.quote}</p>
                    <a href={e.url} target="_blank" rel="noreferrer">
                      Source ↗
                    </a>
                    <small>Checked {date(e.verifiedAt)}</small>
                  </blockquote>
                ))}
              </details>
            )}
          </>
        ) : (
          <>
            <label>
              Name
              <input
                required
                value={v.name}
                onChange={(e) => field("name", e.target.value)}
              />
            </label>
            {v.entity === "knowledge" ? (
              <>
                <label>
                  Source URL
                  <input
                    type="url"
                    value={v.source_url || ""}
                    onChange={(e) => field("source_url", e.target.value)}
                  />
                </label>
                <label>
                  Knowledge
                  <textarea
                    required
                    rows={12}
                    value={v.body}
                    onChange={(e) => field("body", e.target.value)}
                  />
                </label>
                <label className="studio-check">
                  <input
                    type="checkbox"
                    checked={v.approved}
                    onChange={(e) => field("approved", e.target.checked)}
                  />
                  Approved for article generation
                </label>
              </>
            ) : (
              <label>
                Description
                <textarea
                  rows={5}
                  value={v.description}
                  onChange={(e) => field("description", e.target.value)}
                />
              </label>
            )}
          </>
        )}
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
function DetailsDialog({
  item,
  onClose,
  apply,
}: {
  item: Row;
  onClose: () => void;
  apply: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      className="studio-form-dialog studio-results"
      ref={ref}
      onCancel={onClose}
      aria-labelledby="results-title"
    >
      <h2 id="results-title">
        {item.kind === "observations"
          ? "Recorded Codex answers"
          : "Workflow result"}
      </h2>
      {item.kind === "observations" ? (
        item.result.length ? (
          item.result.map((r: Row) => (
            <article key={r.id}>
              <h3>
                {r.model} · {date(r.created_at)}
              </h3>
              <p>
                Prompt version {r.prompt_version} ·{" "}
                {r.mentioned
                  ? "Boardy mentioned"
                  : "No explicit Boardy mention"}
              </p>
              <pre>{r.answer}</pre>
            </article>
          ))
        ) : (
          <p>No checks recorded for this prompt yet.</p>
        )
      ) : (
        <>
          <p>
            {item.state} {item.error}
          </p>
          {item.result?.findings && <p>{item.result.findings}</p>}
          <details>
            <summary>Input and evidence</summary>
            <pre>
              {JSON.stringify(
                { input: item.input, result: item.result },
                null,
                2,
              )}
            </pre>
          </details>
          {item.kind === "review" && item.result?.doc && (
            <button className="primary" onClick={() => void apply()}>
              Apply reviewed revision
            </button>
          )}
        </>
      )}
      <button onClick={onClose}>Close</button>
    </dialog>
  );
}

function KnowledgeFiles({
  rows,
  edit,
}: {
  rows: Row[];
  edit: (id: string) => void;
}) {
  const [selected, setSelected] = useState<Row | null>(null);
  const [history, setHistory] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function open(id: string) {
    setBusy(true);
    setError("");
    try {
      const [file, revisions] = await Promise.all([
        studio({ action: "get", entity: "knowledge", id }),
        studio({ action: "list", entity: "revisions", id }),
      ]);
      setSelected(file.item);
      setHistory(revisions.rows);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="studio-knowledge-files">
      <nav aria-label="Knowledge files">
        {rows.map((r) => (
          <button
            key={r.id}
            aria-pressed={selected?.id === r.id}
            onClick={() => void open(r.id)}
          >
            {r.name}
            <small>Version {r.version}</small>
          </button>
        ))}
      </nav>
      <article aria-busy={busy}>
        {error && <p role="alert">{error}</p>}
        {selected ? (
          <>
            <div className="studio-row">
              <h2>{selected.name}</h2>
              <button onClick={() => edit(selected.id)}>Edit</button>
            </div>
            <p>
              {selected.approved ? "Approved" : "Awaiting review"} · Version{" "}
              {selected.version}
            </p>
            <div className="studio-knowledge-text">{selected.body}</div>
            <h3>Revision activity</h3>
            {history.length ? (
              history.map((r) => (
                <details key={r.id}>
                  <summary>
                    Version {r.version} · {date(r.created_at)}
                  </summary>
                  <div className="studio-knowledge-text">{r.snapshot.body}</div>
                </details>
              ))
            ) : (
              <p>No earlier revisions.</p>
            )}
          </>
        ) : (
          <p>
            Select a knowledge file to read its facts and revision activity.
          </p>
        )}
      </article>
    </section>
  );
}
