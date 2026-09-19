import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DefaultSidebar, Sidebar } from "@excalidraw/excalidraw";
import { Button } from "@excalidraw/excalidraw/components/Button";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import {
  ArrowRightIcon,
  chevronDownIcon,
  chevronLeftIcon,
  codeIcon,
  frameToolIcon,
  LockedIcon,
  MagicIcon,
  TemplatesIcon,
  save as saveIcon,
  searchIcon,
  settingsIcon,
} from "@excalidraw/excalidraw/components/icons";
import { newIframeElement } from "@excalidraw/element/newElement";
import { safeGeneratedHtml } from "@excalidraw/excalidraw/generatedHtml";
import { randomId } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { supabase } from "../supabase/client";
import { BoardCommentsPanel } from "../workspace/BoardCommentsPanel";
import { WorkspaceCommentsContext } from "../workspace/WorkspaceCommentsContext";

import { CATEGORIES, defaultContent, templates } from "./catalog";
import {
  applyDraft,
  buildTemplate,
  getBaseVersions,
  sanitizeSnapshot,
} from "./scene";
import { ScenePreview } from "./ScenePreview";
import { cloudApi, localApi } from "./client";
import {
  PenChip,
  PenIconButton,
  PenSegmentedControl,
  PenSelectRow,
} from "./PenSidebarControls";
import { defaultAssistantPreferences, validateResult } from "./protocol";
import "./AgenticBoard.scss";

import type { Content, Template } from "./catalog";
import type { BaseVersions } from "./scene";
import type {
  AssistantPreferences,
  Connection,
  GenerateRequest,
  Provider,
} from "./protocol";

const CommentsIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 5h16v11H9l-5 4z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

type Personal = {
  id: string;
  title: string;
  category: string;
  elements: ExcalidrawElement[];
  files: BinaryFiles;
};
type Draft = {
  id: string;
  elements: ExcalidrawElement[];
  base: BaseVersions;
  content?: Content;
  html?: string;
  files?: BinaryFiles;
  connectionId?: string;
};
const defaults = new Map<string, ExcalidrawElement[]>();
function getDefault(t: Template) {
  if (!defaults.has(t.id)) {
    defaults.set(t.id, buildTemplate(t, defaultContent(t)));
  }
  return defaults.get(t.id)!;
}

const formatPlan = (plan: string) =>
  plan
    .replace(/^prolite$/i, "Pro Lite")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export function AgenticBoard({ api }: { api: ExcalidrawImperativeAPI }) {
  const workspaceComments = useContext(WorkspaceCommentsContext);
  const root = useRef<HTMLDivElement>(null);
  const [mountedNode, setMountedNode] = useState<HTMLDivElement | null>(null);
  const [ownerWindow, setOwnerWindow] = useState<Window | null>(null);
  const bindRoot = useCallback((node: HTMLDivElement | null) => {
    root.current = node;
    setMountedNode(node);
    if (node) {
      setOwnerWindow(node.ownerDocument.defaultView);
    }
  }, []);
  const [owner, setOwner] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [detail, setDetail] = useState<Template | null>(null);
  const [title, setTitle] = useState("");
  const [detailContent, setDetailContent] = useState<Content | null>(null);
  const [template, setTemplate] = useState(templates[0]);
  const [prompt, setPrompt] = useState("");
  const [task, setTask] = useState<"board" | "ui">("board");
  const [scope, setScope] =
    useState<GenerateRequest["context"]["mode"]>("prompt_only");
  const [selection, setSelection] = useState<readonly ExcalidrawElement[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const active = useRef<AbortController | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [assistantView, setAssistantView] = useState<"compose" | "settings">(
    "compose",
  );
  const [settingsTab, setSettingsTab] = useState<
    "connections" | "defaults" | "privacy"
  >("connections");
  const [preferences, setPreferences] = useState<AssistantPreferences>(
    defaultAssistantPreferences,
  );
  const [, setPreferencesLoaded] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [model, setModel] = useState("");
  const [allowUnknown, setAllowUnknown] = useState(false);
  const [provider, setProvider] = useState<Provider>("openai");
  const [key, setKey] = useState("");
  const [replaceId, setReplaceId] = useState("");
  useEffect(() => {
    if (workspaceComments?.openRequest) {
      void api.toggleSidebar({
        name: "default",
        tab: "boardy-comments",
        force: true,
      });
    }
  }, [api, workspaceComments?.openRequest]);
  const [connectingSubscription, setConnectingSubscription] = useState<
    "codex" | "claude-code" | ""
  >("");
  const authCheck = useRef<AbortController | null>(null);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [save, setSave] = useState<{
    elements: ExcalidrawElement[];
    files: BinaryFiles;
    excluded: number;
  } | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveCategory, setSaveCategory] = useState<string>(CATEGORIES[0]);
  const [rename, setRename] = useState<Personal | null>(null);
  const currentOwner = useRef("");
  const connection = connections.find((c) => c.id === connectionId);
  const selectedModel = connection?.models.find((m) => m.id === model);
  const visibleTemplates = useMemo(
    () =>
      templates.filter(
        (item) =>
          (!category || item.category === category) &&
          `${item.title} ${item.description}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [category, query],
  );
  const visiblePersonal = useMemo(
    () =>
      personal.filter(
        (item) =>
          (!category || category === item.category) &&
          item.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [category, personal, query],
  );
  const win = () => {
    const w = root.current?.ownerDocument.defaultView;
    if (!w) {
      throw new Error("Editor is unavailable.");
    }
    return w;
  };
  const runAction = async (fn: () => Promise<void> | void) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed. Try again.");
    }
  };

  useEffect(() => {
    let mounted = true;
    const reset = (id: string) => {
      if (!mounted || currentOwner.current === id) {
        return;
      }
      currentOwner.current = id;
      active.current?.abort();
      authCheck.current?.abort();
      setOwner(id);
      setDraft(null);
      setPrompt("");
      setConnections([]);
      setPreferences(defaultAssistantPreferences);
      setPreferencesLoaded(false);
      setConnectionId("");
      setModel("");
      setPersonal([]);
      setKey("");
      setReview(false);
      setDetail(null);
      setSave(null);
      setRename(null);
      setError("");
      setStatus("");
    };
    supabase.auth
      .getSession()
      .then(({ data }) => reset(data.session?.user.id || ""));
    const { data } = supabase.auth.onAuthStateChange((_, session) =>
      reset(session?.user.id || ""),
    );
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      active.current?.abort();
      authCheck.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!owner) {
      return;
    }
    let alive = true;
    void supabase
      .from("ai_user_preferences")
      .select(
        "default_connection_id, default_model, default_task, default_context, persist_local_history",
      )
      .eq("user_id", owner)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (!alive || currentOwner.current !== owner) {
          return;
        }
        if (loadError) {
          setError("Assistant defaults could not be loaded. Try again.");
          setPreferencesLoaded(true);
          return;
        }
        if (data) {
          const next: AssistantPreferences = {
            defaultConnectionId: data.default_connection_id || "",
            defaultModel: data.default_model || "",
            defaultTask: data.default_task === "ui" ? "ui" : "board",
            defaultContext:
              data.default_context === "selection"
                ? "selection"
                : "prompt_only",
            persistLocalHistory: data.persist_local_history === true,
          };
          setPreferences(next);
          setTask(next.defaultTask);
          setScope(next.defaultContext);
          setConnectionId(next.defaultConnectionId);
          setModel(next.defaultModel);
        }
        setPreferencesLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [owner, ownerWindow]);
  useEffect(() => {
    if (!owner || !ownerWindow) {
      return;
    }
    let alive = true;
    void localApi<{ connections: Connection[] }>(ownerWindow, "connections")
      .then((result) => {
        if (!alive || currentOwner.current !== owner) {
          return;
        }
        setConnections(result.connections);
        const preferred =
          result.connections.find(
            (item) => item.id === preferences.defaultConnectionId,
          ) || result.connections.find((item) => item.models.length);
        if (
          preferences.defaultModel &&
          !preferred?.models.some(
            (item) => item.id === preferences.defaultModel,
          )
        ) {
          setModel("");
        } else if (preferred?.models.length) {
          setConnectionId(preferred.id);
          setModel(
            preferences.defaultModel ||
              preferred.defaultModel ||
              preferred.models.find((item) => item.isDefault)?.id ||
              preferred.models.find((item) => item.compatible === true)?.id ||
              "",
          );
        }
      })
      .catch(() => {
        if (alive) {
          setError("AI connections could not be loaded.");
        }
      });
    return () => {
      alive = false;
    };
  }, [
    owner,
    ownerWindow,
    preferences.defaultConnectionId,
    preferences.defaultModel,
  ]);
  useEffect(
    () =>
      api.onChange((elements, state) => {
        setSelection(
          elements.filter(
            (e) =>
              !e.isDeleted &&
              (state.selectedElementIds[e.id] ||
                (e.frameId && state.selectedElementIds[e.frameId])),
          ),
        );
      }),
    [api],
  );
  useEffect(() => {
    if (!owner || !mountedNode) {
      return;
    }
    let alive = true;
    void cloudApi<{ templates: Personal[] }>("ai-templates", "templates")
      .then(({ templates: saved }) => {
        if (alive && currentOwner.current === owner) {
          setPersonal(saved);
        }
      })
      .catch(() => {
        if (alive) {
          setError("Saved templates could not be loaded from your workspace.");
        }
      });
    return () => {
      alive = false;
    };
  }, [owner, mountedNode]);
  useEffect(() => {
    if (!ownerWindow) {
      return;
    }
    const clearBoardDraft = () => {
      active.current?.abort();
      setDraft(null);
      setReview(false);
      setPrompt("");
      setStatus("");
      setError("");
    };
    ownerWindow.addEventListener("hashchange", clearBoardDraft);
    return () => ownerWindow.removeEventListener("hashchange", clearBoardDraft);
  }, [ownerWindow]);
  const persist = async (next: Personal | null, id: string) => {
    const expectedOwner = owner;
    let saved = next;
    if (!next) {
      await cloudApi("ai-templates", `templates/${id}`, "PATCH", {
        action: "delete",
      });
    } else if (personal.some((item) => item.id === id)) {
      await cloudApi("ai-templates", `templates/${id}`, "PATCH", {
        name: next.title,
        category: next.category,
      });
    } else {
      const result = await cloudApi<{ templateId: string }>(
        "ai-templates",
        "templates",
        "POST",
        {
          requestId: `${win().crypto.randomUUID()}-${Date.now().toString(36)}`,
          name: next.title,
          category: next.category,
          document: { version: 1, elements: next.elements, files: next.files },
        },
      );
      saved = { ...next, id: result.templateId };
    }
    if (currentOwner.current === expectedOwner) {
      setPersonal((old) =>
        saved
          ? [...old.filter((p) => p.id !== id), saved]
          : old.filter((p) => p.id !== id),
      );
    }
  };
  const savePreferences = async (next: AssistantPreferences) => {
    if (!owner) {
      throw new Error("Sign in to sync assistant settings.");
    }
    const { error: saveError } = await supabase
      .from("ai_user_preferences")
      .upsert({
        user_id: owner,
        default_connection_id: next.defaultConnectionId || null,
        default_model: next.defaultModel || null,
        default_task: next.defaultTask,
        default_context: next.defaultContext,
        persist_local_history: next.persistLocalHistory,
        updated_at: new Date().toISOString(),
      });
    if (saveError) {
      throw new Error("Assistant settings could not be synced.");
    }
    setPreferences(next);
    setStatus("Assistant settings synced.");
  };
  const detailScene = useMemo(
    () =>
      detail
        ? buildTemplate(detail, {
            ...(detailContent || defaultContent(detail)),
            title: title || detail.title,
          })
        : [],
    [detail, title, detailContent],
  );
  const preview = (elements: ExcalidrawElement[], files: BinaryFiles = {}) => {
    api.addFiles(Object.values(files));
    setDraft({ id: randomId(), elements, files, base: {} });
    setReview(true);
    setDetail(null);
    setError("");
  };
  const previewPersonal = async (item: Personal) => {
    const result = await cloudApi<{ template: Personal }>(
      "ai-templates",
      `templates/${item.id}`,
    );
    const snapshot = sanitizeSnapshot(result.template.elements);
    preview(snapshot.elements, result.template.files);
  };
  const apply = (copy = false) =>
    runAction(() => {
      if (!draft) {
        return;
      }
      api.addFiles(Object.values(draft.files || {}));
      applyDraft(api, draft.elements, draft.id, copy ? {} : draft.base);
      setDraft(null);
      setReview(false);
      setStatus("Applied to the canvas. Undo once to remove this insertion.");
    });
  const refresh = async (id: string) => {
    const expectedOwner = currentOwner.current;
    const c = await localApi<Connection>(
      win(),
      `connections/${id}/refresh`,
      "POST",
    );
    if (currentOwner.current !== expectedOwner) {
      return;
    }
    setConnections((old) => old.map((x) => (x.id === id ? c : x)));
    const preferredModel =
      (preferences.defaultConnectionId === c.id &&
        c.models.find((item) => item.id === preferences.defaultModel)?.id) ||
      c.defaultModel ||
      c.models.find((item) => item.isDefault)?.id ||
      c.models.find((item) => item.compatible === true)?.id ||
      "";
    if (!connectionId || id === connectionId) {
      setConnectionId(c.id);
      setModel(
        c.models.some((item) => item.id === model) ? model : preferredModel,
      );
    }
    return c;
  };
  const connectSubscription = async (
    subscription: "codex" | "claude-code",
    reconnect = false,
  ) => {
    const boardWindow = win();
    const authWindow = boardWindow.open(
      "about:blank",
      "_blank",
      "popup,width=560,height=720",
    );
    if (!authWindow) {
      throw new Error("Allow pop-ups for Boardy, then choose Sign in again.");
    }
    authWindow.opener = null;
    authCheck.current?.abort();
    const controller = new AbortController();
    authCheck.current = controller;
    setConnectingSubscription(subscription);
    try {
      const connection = await localApi<Connection>(
        boardWindow,
        "subscriptions",
        "POST",
        { subscription, reconnect },
      );
      setConnections((old) => [
        ...old.filter(
          (item) =>
            item.id !== connection.id && item.subscription !== subscription,
        ),
        connection,
      ]);
      if (connection.models.length) {
        authWindow.close();
        await refresh(connection.id);
        setStatus(
          `${subscription === "codex" ? "Codex" : "Claude Code"} is connected.`,
        );
        return;
      }
      if (!connection.login?.url) {
        authWindow.close();
        throw new Error("The desktop runtime did not provide a sign-in page.");
      }
      authWindow.location.replace(connection.login.url);
      setStatus(
        "Finish signing in in the new window. Boardy will connect automatically.",
      );
      for (let attempt = 0; attempt < 150; attempt++) {
        if (controller.signal.aborted) {
          return;
        }
        await new Promise<void>((resolve) => {
          const timer = boardWindow.setTimeout(resolve, 2000);
          controller.signal.addEventListener(
            "abort",
            () => {
              boardWindow.clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        });
        if (controller.signal.aborted) {
          return;
        }
        try {
          const connected = await refresh(connection.id);
          if (connected?.models.length) {
            setStatus(
              `${
                subscription === "codex" ? "Codex" : "Claude Code"
              } connected successfully.`,
            );
            authWindow.close();
            return;
          }
        } catch (refreshError) {
          if (
            !(refreshError instanceof Error) ||
            refreshError.message !==
              "Finish signing in through the official runtime, then click Test / refresh."
          ) {
            throw refreshError;
          }
        }
      }
      throw new Error("Sign-in timed out. Choose Reconnect to try again.");
    } catch (connectError) {
      authWindow.close();
      throw connectError;
    } finally {
      if (authCheck.current === controller) {
        authCheck.current = null;
      }
      setConnectingSubscription("");
    }
  };
  const generate = () =>
    runAction(async () => {
      if (busyRef.current || !connection || !model) {
        return;
      }
      if (
        task === "ui" &&
        !selection.some((e) => e.type === "frame" || e.type === "magicframe")
      ) {
        throw new Error("Select a frame to generate a UI prototype.");
      }
      const contextElements =
        scope === "prompt_only"
          ? []
          : scope === "selection"
          ? selection
          : api.getSceneElements();
      if (scope === "selection" && !contextElements.length) {
        throw new Error("Select content or choose prompt only.");
      }
      if (task === "ui" && scope !== "selection") {
        throw new Error("Choose selected content to include the source frame.");
      }
      const request: GenerateRequest = {
        requestId: randomId() + randomId(),
        connectionId,
        model,
        task,
        templateId: template.id,
        prompt,
        allowUnknown,
        sceneId:
          new URL(win().location.href).searchParams.get("scene") || undefined,
        context: {
          mode: scope,
          elements: contextElements.map((e) => ({
            type: e.type,
            ...("text" in e ? { text: e.text } : {}),
            x: e.x,
            y: e.y,
            width: e.width,
            height: e.height,
          })),
        },
        ...(draft?.connectionId === connectionId
          ? {
              previous:
                draft.content ||
                (draft.html ? { html: draft.html } : undefined),
            }
          : {}),
      };
      const sourceDocument = root.current!.ownerDocument;
      const base = getBaseVersions(contextElements);
      const expectedOwner = owner;
      busyRef.current = true;
      setBusy(true);
      setStatus("Drafting privately… The canvas stays editable.");
      const controller = new AbortController();
      active.current = controller;
      try {
        const response = await localApi<{ result: unknown }>(
          win(),
          "generate",
          "POST",
          request,
          controller.signal,
        );
        if (
          controller.signal.aborted ||
          expectedOwner !== currentOwner.current
        ) {
          return;
        }
        const content = validateResult(response.result, request);
        if ("html" in content) {
          const html = safeGeneratedHtml(content.html, sourceDocument);
          const element = newIframeElement({
            type: "iframe",
            x: 0,
            y: 0,
            width: 1000,
            height: 720,
            customData: { generationData: { status: "done", html } },
          });
          setDraft({
            id: request.requestId,
            elements: [element],
            html,
            base,
            connectionId,
          });
        } else {
          setDraft({
            id: request.requestId,
            elements: buildTemplate(template, content),
            content,
            base,
            connectionId,
          });
        }
        setReview(true);
        setStatus("Draft ready. Review it before applying.");
      } catch (e) {
        if (controller.signal.aborted) {
          setStatus("Generation stopped. Nothing was applied.");
        } else {
          throw e;
        }
      } finally {
        active.current = null;
        busyRef.current = false;
        setBusy(false);
      }
    });
  const stop = () => {
    active.current?.abort();
    void runAction(async () => {
      await localApi(win(), "cancel", "POST");
    });
  };
  const saveSelected = () =>
    runAction(() => {
      const snapshot = sanitizeSnapshot(selection);
      const availableFiles = api.getFiles();
      const files = Object.fromEntries(
        snapshot.elements.flatMap((element) =>
          element.type === "image" &&
          element.fileId &&
          availableFiles[element.fileId]
            ? [[element.fileId, availableFiles[element.fileId]]]
            : [],
        ),
      );
      const fileSize = Object.values(files).reduce(
        (total, file) => total + file.dataURL.length,
        0,
      );
      if (fileSize > 10 * 1024 * 1024) {
        throw new Error("Selected images exceed the 10 MB template limit.");
      }
      setSave({ ...snapshot, files });
      setSaveName("");
    });
  const openAssistantSettings = () => {
    setAssistantView("settings");
    void runAction(async () => {
      const expectedOwner = currentOwner.current;
      const result = await localApi<{ connections: Connection[] }>(
        win(),
        "connections",
      );
      if (currentOwner.current === expectedOwner) {
        setConnections(result.connections);
      }
    });
  };

  return (
    <DefaultSidebar className="agentic-default-sidebar">
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger tab="agentic-templates" title="Templates">
          {TemplatesIcon}
        </Sidebar.TabTrigger>
        <Sidebar.TabTrigger tab="agentic-assistant" title="Assistant">
          {MagicIcon}
        </Sidebar.TabTrigger>
        {workspaceComments && (
          <Sidebar.TabTrigger tab="boardy-comments" title="Comments">
            {CommentsIcon}
          </Sidebar.TabTrigger>
        )}
      </DefaultSidebar.TabTriggers>
      <Sidebar.Tab tab="agentic-templates" className="agentic-sidebar-tab">
        <div className="agentic-board pen-sidebar-body" ref={bindRoot}>
          <header className="pen-sidebar-heading">
            <div className="pen-sidebar-heading__copy">
              <h2>Templates</h2>
              <p>Start quickly, then make it yours.</p>
            </div>
            <button
              type="button"
              className="pen-save-template-button"
              title={
                selection.length
                  ? "Save selection as a reusable template"
                  : "Select board content to save it as a template"
              }
              disabled={!selection.length || !owner}
              onClick={saveSelected}
            >
              <span className="pen-control-icon">{saveIcon}</span>
              Save selection
            </button>
          </header>
          <>
            <label className="pen-search-field">
              <span className="pen-control-icon">{searchIcon}</span>
              <input
                aria-label="Search templates"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${
                  templates.length + personal.length
                } templates`}
              />
            </label>
            <div className="pen-category-row" aria-label="Template categories">
              <PenChip selected={!category} onClick={() => setCategory("")}>
                All
              </PenChip>
              <PenChip
                selected={category === "Strategy"}
                onClick={() => setCategory("Strategy")}
              >
                Strategy
              </PenChip>
              <PenChip
                selected={category === "Product and design"}
                onClick={() => setCategory("Product and design")}
              >
                Product
              </PenChip>
              <label
                className="pen-more-categories"
                data-selected={
                  !!category &&
                  category !== "Strategy" &&
                  category !== "Product and design"
                }
              >
                <span aria-hidden="true">•••</span>
                <select
                  aria-label="More template categories"
                  value={
                    category === "Strategy" || category === "Product and design"
                      ? ""
                      : category
                  }
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="">More categories</option>
                  {CATEGORIES.filter(
                    (item) =>
                      item !== "Strategy" && item !== "Product and design",
                  ).map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
            {!!visiblePersonal.length && (
              <section className="agentic-template-section">
                <div className="pen-template-count">
                  <strong>Saved by you</strong>
                  <span>{visiblePersonal.length}</span>
                </div>
                <div className="agentic-gallery">
                  {visiblePersonal.map((item) => (
                    <article key={item.id} className="agentic-personal">
                      <button
                        type="button"
                        className="agentic-template"
                        onClick={() => runAction(() => previewPersonal(item))}
                      >
                        {item.elements.length ? (
                          <ScenePreview
                            elements={item.elements}
                            files={item.files}
                            title={item.title}
                            variant="card"
                          />
                        ) : (
                          <span className="agentic-preview agentic-preview--card agentic-preview--stored">
                            Saved template
                          </span>
                        )}
                        <strong>{item.title}</strong>
                        <span>{item.category}</span>
                      </button>
                      <div
                        className="agentic-personal__actions"
                        aria-label={`${item.title} actions`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setRename(item);
                            setSaveName(item.title);
                            setSaveCategory(item.category);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="is-danger"
                          onClick={() =>
                            runAction(() => persist(null, item.id))
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {!!visibleTemplates.length && (
              <section className="agentic-template-section">
                <div className="pen-template-count">
                  <strong>Templates</strong>
                  <span>{visibleTemplates.length}</span>
                </div>
                <div className="agentic-gallery">
                  {visibleTemplates.map((item) => (
                    <button
                      type="button"
                      className="agentic-template"
                      key={item.id}
                      onClick={() => {
                        setDetail(item);
                        setTitle(item.title);
                      }}
                    >
                      <ScenePreview
                        elements={getDefault(item)}
                        title={item.title}
                        variant="card"
                      />
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {!visiblePersonal.length && !visibleTemplates.length && (
              <div className="agentic-empty-state">
                <strong>No templates found</strong>
                <span>Try a different search or category.</span>
              </div>
            )}
          </>
          {detail && (
            <Dialog
              title={detail.title}
              onCloseRequest={() => setDetail(null)}
              size="regular"
              className="agentic-template-dialog"
            >
              <div className="agentic-board agentic-detail">
                <p className="agentic-detail__description">
                  {detail.description}
                </p>
                <div className="agentic-detail__preview-stage">
                  <ScenePreview elements={detailScene} title={detail.title} />
                </div>
                <div className="agentic-detail__controls">
                  <label>
                    Title
                    <input
                      maxLength={160}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                  <details>
                    <summary>Edit template content</summary>
                    {(detailContent || defaultContent(detail)).sections.map(
                      (section, index) => (
                        <div key={index}>
                          <label>
                            Section {index + 1}
                            <input
                              maxLength={100}
                              value={section.heading}
                              onChange={(e) =>
                                setDetailContent((old) => ({
                                  ...(old || defaultContent(detail)),
                                  sections: (
                                    old || defaultContent(detail)
                                  ).sections.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          heading: e.target.value || "Untitled",
                                        }
                                      : item,
                                  ),
                                }))
                              }
                            />
                          </label>
                          <label>
                            Content · one item per line
                            <textarea
                              rows={3}
                              value={section.items.join("\n")}
                              onChange={(e) => {
                                const items = e.target.value.split("\n");
                                if (
                                  items.length <= 6 &&
                                  items.every((item) => item.length <= 300)
                                ) {
                                  setDetailContent((old) => ({
                                    ...(old || defaultContent(detail)),
                                    sections: (
                                      old || defaultContent(detail)
                                    ).sections.map((item, i) =>
                                      i === index ? { ...item, items } : item,
                                    ),
                                  }));
                                }
                              }}
                            />
                          </label>
                        </div>
                      ),
                    )}
                  </details>
                  <div className="agentic-actions">
                    <Button onSelect={() => preview(detailScene)}>
                      Preview template
                    </Button>
                    <Button
                      onSelect={() => {
                        setTemplate(detail);
                        setPrompt(title === detail.title ? "" : title);
                        api.toggleSidebar({
                          name: "default",
                          tab: "agentic-assistant",
                          force: true,
                        });
                        setDetail(null);
                      }}
                    >
                      Customize with AI
                    </Button>
                  </div>
                </div>
              </div>
            </Dialog>
          )}
        </div>
      </Sidebar.Tab>
      <Sidebar.Tab tab="agentic-assistant" className="agentic-sidebar-tab">
        <div className="agentic-board pen-sidebar-body" ref={bindRoot}>
          <header className="pen-sidebar-heading">
            <div className="pen-sidebar-heading__copy">
              <h2>
                {assistantView === "settings"
                  ? "Assistant settings"
                  : "Assistant"}
              </h2>
              <p>
                {assistantView === "settings"
                  ? "Models, defaults, and privacy"
                  : "Describe it. Review it. Add it to your board."}
              </p>
            </div>
            <PenIconButton
              label={
                assistantView === "settings"
                  ? "Back to assistant"
                  : "Assistant settings"
              }
              onClick={() => {
                if (assistantView === "settings") {
                  setAssistantView("compose");
                  setKey("");
                  setReplaceId("");
                } else {
                  openAssistantSettings();
                }
              }}
            >
              {assistantView === "settings" ? chevronLeftIcon : settingsIcon}
            </PenIconButton>
          </header>
          {assistantView === "compose" ? (
            <div className="pen-assistant-compose">
              <PenSegmentedControl
                label="Output type"
                value={task}
                disabled={busy}
                options={[
                  {
                    value: "board",
                    label: "Editable board",
                    icon: frameToolIcon,
                  },
                  {
                    value: "ui",
                    label: "UI prototype",
                    icon: codeIcon,
                  },
                ]}
                onChange={(value) => {
                  setTask(value);
                  setDraft(null);
                }}
              />
              <PenSelectRow
                label="Starting point"
                icon={MagicIcon}
                value={template.id}
                disabled={busy}
                onChange={(value) => {
                  setTemplate(templates.find((item) => item.id === value)!);
                  setDraft(null);
                }}
              >
                {templates.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.title}
                  </option>
                ))}
              </PenSelectRow>
              <section className="pen-context-section">
                <strong>Use context from</strong>
                <div className="pen-context-choices">
                  <PenChip
                    selected={scope === "prompt_only"}
                    onClick={() => setScope("prompt_only")}
                  >
                    Prompt only
                  </PenChip>
                  <PenChip
                    selected={scope === "selection"}
                    onClick={() => setScope("selection")}
                  >
                    Selection <span>{selection.length}</span>
                  </PenChip>
                  <PenChip
                    selected={scope === "whole_board"}
                    onClick={() => setScope("whole_board")}
                  >
                    Whole board
                  </PenChip>
                </div>
                <p className="pen-privacy-note">
                  <span className="pen-control-icon">{LockedIcon}</span>
                  {scope === "prompt_only"
                    ? "Only your prompt and template are sent"
                    : "Native text and geometry are sent; private board data stays excluded"}
                </p>
              </section>
              {selectedModel?.compatible === null && (
                <label className="agentic-check">
                  <input
                    type="checkbox"
                    checked={allowUnknown}
                    onChange={(e) => setAllowUnknown(e.target.checked)}
                  />
                  Try this unverified model with output validation. Provider
                  usage may be charged.
                </label>
              )}
              {task === "ui" && (
                <p className="pen-sidebar-note">
                  Select a regular or magic frame as the source for your UI
                  prototype.
                </p>
              )}
              <label className="pen-composer">
                <span className="pen-visually-hidden">
                  What would you like to make?
                </span>
                <textarea
                  rows={5}
                  maxLength={16000}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Plan a customer onboarding workshop…"
                />
                <span className="pen-composer__footer">
                  <span className="pen-model-selector">
                    <span className="pen-control-icon">{MagicIcon}</span>
                    <select
                      aria-label="Model"
                      disabled={busy || !connections.length}
                      value={
                        connectionId && model
                          ? `${connectionId}\u001f${model}`
                          : ""
                      }
                      onChange={(event) => {
                        const [nextConnectionId, nextModel] =
                          event.target.value.split("\u001f");
                        setConnectionId(nextConnectionId || "");
                        setModel(nextModel || "");
                        setAllowUnknown(false);
                      }}
                    >
                      <option value="">
                        {connections.length ? "Choose model" : "Connect model"}
                      </option>
                      {connections.map((item) => (
                        <optgroup
                          key={item.id}
                          label={
                            item.subscription === "codex"
                              ? "Codex"
                              : item.subscription === "claude-code"
                              ? "Claude Code"
                              : `${item.provider} · ${item.suffix}`
                          }
                        >
                          {item.models.map((candidate) => (
                            <option
                              key={candidate.id}
                              value={`${item.id}\u001f${candidate.id}`}
                              disabled={candidate.compatible === false}
                            >
                              {candidate.id}
                              {candidate.compatible === false
                                ? " · incompatible"
                                : candidate.compatible === null
                                ? " · unverified"
                                : ""}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <span className="pen-select-chevron">
                      {chevronDownIcon}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="pen-generate-button"
                    disabled={
                      busy ||
                      !prompt.trim() ||
                      !model ||
                      !owner ||
                      (selectedModel?.compatible === null && !allowUnknown)
                    }
                    onClick={generate}
                  >
                    {busy ? "Generating" : draft ? "Refine" : "Generate"}
                    {ArrowRightIcon}
                  </button>
                </span>
              </label>
              {!connections.length && (
                <button
                  type="button"
                  className="pen-inline-link"
                  onClick={openAssistantSettings}
                >
                  Connect a model in Assistant settings
                </button>
              )}
              {busy && (
                <button
                  type="button"
                  className="pen-inline-link"
                  onClick={stop}
                >
                  Stop generation
                </button>
              )}
              {draft && (
                <button
                  type="button"
                  className="pen-inline-link"
                  disabled={busy}
                  onClick={() => setReview(true)}
                >
                  Review draft
                </button>
              )}
              <p className="pen-bottom-tip">
                <span className="pen-control-icon">{LockedIcon}</span>
                You will review every draft before it reaches the canvas
              </p>
            </div>
          ) : (
            <>
              <div className="pen-settings-intro">
                <h3>
                  {settingsTab === "connections"
                    ? "Models & connections"
                    : settingsTab === "defaults"
                    ? "Assistant defaults"
                    : "Privacy & cloud data"}
                </h3>
                <p>
                  {settingsTab === "connections"
                    ? "Connect the models you already use. Choose one later in the Assistant."
                    : settingsTab === "defaults"
                    ? "Choose how new assistant sessions begin."
                    : "Control shared context and what is stored in your private workspace."}
                </p>
              </div>
              <PenSegmentedControl
                label="Assistant settings sections"
                value={settingsTab}
                options={[
                  { value: "connections", label: "Connections" },
                  { value: "defaults", label: "Defaults" },
                  { value: "privacy", label: "Privacy" },
                ]}
                onChange={(value) => {
                  setSettingsTab(value);
                  setError("");
                  setStatus("");
                }}
              />
              {settingsTab === "connections" && (
                <section className="pen-settings-panel">
                  <p className="agentic-note">
                    {import.meta.env.DEV
                      ? "Local development keeps API keys only in this server's memory."
                      : "API keys are encrypted server-side."}{" "}
                    Usage is billed by your provider. Subscription sign-in
                    requires the Boardy desktop companion; credentials never
                    enter this browser.
                  </p>
                  <div className="agentic-companion-grid">
                    {(["codex", "claude-code"] as const).map((subscription) => {
                      const connected = connections.find(
                        (item) => item.subscription === subscription,
                      );
                      const defaultModel =
                        (preferences.defaultConnectionId === connected?.id &&
                          preferences.defaultModel) ||
                        connected?.defaultModel ||
                        connected?.models.find((item) => item.isDefault)?.id;
                      const isConnecting =
                        connectingSubscription === subscription;
                      return (
                        <section
                          className="agentic-connection-card"
                          key={subscription}
                        >
                          <div className="agentic-connection-card__heading">
                            <strong>
                              {subscription === "codex"
                                ? "Codex"
                                : "Claude Code"}
                            </strong>
                            {connected?.models.length ? (
                              <span className="agentic-connection__status is-ready">
                                Connected
                              </span>
                            ) : null}
                          </div>
                          <span>
                            {connected?.account?.label ||
                              "Desktop companion required"}
                          </span>
                          {connected?.account?.plan && (
                            <small>{formatPlan(connected.account.plan)}</small>
                          )}
                          {defaultModel && (
                            <small title={defaultModel}>
                              Default model · {defaultModel}
                            </small>
                          )}
                          <div className="agentic-connection-card__actions">
                            {connected?.models.length ? (
                              <button
                                type="button"
                                className="pen-card-action"
                                disabled={isConnecting}
                                onClick={() =>
                                  runAction(async () => {
                                    await refresh(connected.id);
                                  })
                                }
                              >
                                Refresh models
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="pen-card-action"
                              disabled={
                                !import.meta.env.DEV || isConnecting || busy
                              }
                              onClick={() =>
                                runAction(() =>
                                  connectSubscription(
                                    subscription,
                                    !!connected?.models.length,
                                  ),
                                )
                              }
                            >
                              {!import.meta.env.DEV
                                ? "Companion unavailable"
                                : isConnecting
                                ? "Connecting…"
                                : connected?.models.length
                                ? "Reconnect"
                                : connected?.login?.pending
                                ? "Continue sign-in"
                                : "Sign in"}
                              {import.meta.env.DEV &&
                                !isConnecting &&
                                ArrowRightIcon}
                            </button>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                  {connections
                    .filter((c) => !c.subscription)
                    .map((c) => (
                      <div key={c.id} className="agentic-connection">
                        <div className="agentic-connection__summary">
                          <span>
                            <strong>
                              {c.subscription === "codex"
                                ? "Codex subscription"
                                : c.subscription === "claude-code"
                                ? "Claude Code subscription"
                                : c.account?.label ||
                                  `${c.provider} · ending ${c.suffix}`}
                            </strong>
                            <small>
                              {c.account?.plan
                                ? `${formatPlan(c.account.plan)} · ${
                                    c.models.length
                                  } discovered models`
                                : c.models.length
                                ? `${c.models.length} discovered models`
                                : "No models discovered yet"}
                            </small>
                            {preferences.defaultConnectionId === c.id &&
                              preferences.defaultModel && (
                                <small title={preferences.defaultModel}>
                                  Default model · {preferences.defaultModel}
                                </small>
                              )}
                          </span>
                          <span
                            className={`agentic-connection__status${
                              c.models.length ? " is-ready" : ""
                            }`}
                          >
                            {c.models.length ? "Ready" : "Needs refresh"}
                          </span>
                        </div>
                        <div className="agentic-connection__actions">
                          <button
                            type="button"
                            className="pen-action-button"
                            onClick={() =>
                              runAction(async () => {
                                await refresh(c.id);
                              })
                            }
                          >
                            Refresh models
                          </button>
                          {!c.subscription && (
                            <button
                              type="button"
                              className="pen-action-button"
                              onClick={() => {
                                setReplaceId(c.id);
                                setProvider(c.provider);
                                setKey("");
                              }}
                            >
                              Replace key
                            </button>
                          )}
                          <button
                            type="button"
                            className="pen-action-button is-danger"
                            onClick={() =>
                              runAction(async () => {
                                await localApi(
                                  win(),
                                  `connections/${c.id}`,
                                  "DELETE",
                                );
                                setConnections((old) =>
                                  old.filter((x) => x.id !== c.id),
                                );
                                if (connectionId === c.id) {
                                  setConnectionId("");
                                  setModel("");
                                }
                              })
                            }
                          >
                            Disconnect
                          </button>
                        </div>
                      </div>
                    ))}
                  <div className="pen-settings-form">
                    <div className="pen-settings-form__heading">
                      <strong>
                        {replaceId ? "Replace API key" : "Add API connection"}
                      </strong>
                      <span>
                        The key is verified before this connection is saved.
                      </span>
                    </div>
                    <label>
                      Provider
                      <select
                        value={provider}
                        disabled={!!replaceId || busy}
                        onChange={(e) =>
                          setProvider(e.target.value as Provider)
                        }
                      >
                        <option value="openai">OpenAI API</option>
                        <option value="anthropic">Claude API</option>
                      </select>
                    </label>
                    <label>
                      {replaceId ? "Replacement API key" : "API key"}
                      <input
                        type="password"
                        autoComplete="off"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="pen-primary-action"
                      disabled={busy || !key.trim()}
                      onClick={() =>
                        runAction(async () => {
                          const c = await localApi<Connection>(
                            win(),
                            `connections${replaceId ? `/${replaceId}` : ""}`,
                            replaceId ? "PUT" : "POST",
                            { provider, key: key.trim() },
                          );
                          setConnections((old) => [
                            ...old.filter((x) => x.id !== c.id),
                            c,
                          ]);
                          setKey("");
                          setReplaceId("");
                          setConnectionId(c.id);
                          setModel("");
                          setStatus(
                            "Connection verified. Choose an exact model.",
                          );
                        })
                      }
                    >
                      {replaceId
                        ? "Replace connection key"
                        : "Verify and connect"}
                    </button>
                  </div>
                </section>
              )}
              {settingsTab === "defaults" && (
                <section className="pen-settings-panel">
                  <label>
                    Default output
                    <select
                      value={preferences.defaultTask}
                      onChange={(e) => {
                        const next = {
                          ...preferences,
                          defaultTask: e.target.value as "board" | "ui",
                        };
                        setTask(next.defaultTask);
                        void runAction(() => savePreferences(next));
                      }}
                    >
                      <option value="board">Editable board</option>
                      <option value="ui">Frame to UI prototype</option>
                    </select>
                  </label>
                  <label>
                    Default connection
                    <select
                      value={preferences.defaultConnectionId}
                      onChange={(e) => {
                        const next = {
                          ...preferences,
                          defaultConnectionId: e.target.value,
                          defaultModel: "",
                        };
                        setConnectionId(next.defaultConnectionId);
                        setModel("");
                        void runAction(() => savePreferences(next));
                      }}
                    >
                      <option value="">Choose each time</option>
                      {connections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.provider} · {c.suffix}
                        </option>
                      ))}
                    </select>
                  </label>
                  {connections.some(
                    (c) => c.id === preferences.defaultConnectionId,
                  ) && (
                    <label>
                      Exact default model
                      <select
                        value={preferences.defaultModel}
                        onChange={(e) => {
                          const next = {
                            ...preferences,
                            defaultModel: e.target.value,
                          };
                          setModel(next.defaultModel);
                          void runAction(() => savePreferences(next));
                        }}
                      >
                        <option value="">Choose each time</option>
                        {connections
                          .find(
                            (c) => c.id === preferences.defaultConnectionId,
                          )!
                          .models.filter((m) => m.compatible !== false)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.id}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                </section>
              )}
              {settingsTab === "privacy" && (
                <section className="pen-settings-panel">
                  <label>
                    Default context
                    <select
                      value={preferences.defaultContext}
                      onChange={(e) => {
                        const next = {
                          ...preferences,
                          defaultContext: e.target.value as
                            | "prompt_only"
                            | "selection",
                        };
                        setScope(next.defaultContext);
                        void runAction(() => savePreferences(next));
                      }}
                    >
                      <option value="prompt_only">Prompt only</option>
                      <option value="selection">
                        Selection when available
                      </option>
                    </select>
                  </label>
                  <p className="agentic-note">
                    Whole-board context is always an explicit one-time choice.
                    It can never be saved as the default.
                  </p>
                  <p className="agentic-note">
                    Assistant threads and drafts are stored in your private
                    Boardy workspace. Provider keys remain encrypted and are
                    never written to browser storage.
                  </p>
                </section>
              )}
            </>
          )}
          <div aria-live="polite" className="agentic-status">
            {status}
          </div>
          {error && (
            <p role="alert" className="agentic-error">
              {error}
            </p>
          )}
        </div>
      </Sidebar.Tab>
      {workspaceComments && (
        <Sidebar.Tab tab="boardy-comments" className="boardy-comments-tab">
          <BoardCommentsPanel
            sceneId={workspaceComments.sceneId}
            members={workspaceComments.members}
            embedded
          />
        </Sidebar.Tab>
      )}
      {review && draft && (
        <Dialog
          title="Review your draft"
          size="wide"
          onCloseRequest={() => setReview(false)}
        >
          <div className="agentic-board agentic-detail">
            {draft.html ? (
              <iframe
                title="Private UI prototype"
                srcDoc={draft.html}
                sandbox=""
                referrerPolicy="no-referrer"
                className="agentic-html"
              />
            ) : (
              <ScenePreview
                elements={draft.elements}
                files={draft.files}
                title="Private draft"
              />
            )}
            <p>
              {draft.elements.length} additions · 0 updates · 0 deletions.
              Inserted beside existing content.
            </p>
            {draft.content?.assumptions.map((a, i) => (
              <p key={i}>{a}</p>
            ))}
            {error && (
              <p role="alert" className="agentic-error">
                {error}
              </p>
            )}
            <div className="agentic-actions">
              <Button onSelect={() => apply()}>Apply to board</Button>
              {Object.keys(draft.base).length > 0 && (
                <Button onSelect={() => apply(true)}>
                  Insert separate copy
                </Button>
              )}
              <Button
                onSelect={() => {
                  setDraft(null);
                  setReview(false);
                }}
              >
                Discard
              </Button>
              <Button
                onSelect={() => {
                  setReview(false);
                  setAssistantView("compose");
                }}
              >
                Keep editing prompt
              </Button>
              {draft.html && (
                <Button
                  onSelect={() => {
                    const doc = root.current!.ownerDocument;
                    const w = win();
                    const url = w.URL.createObjectURL(
                      new w.Blob([draft.html!], { type: "text/html" }),
                    );
                    const a = doc.createElement("a");
                    a.href = url;
                    a.download = "boardy-prototype.html";
                    a.click();
                    w.setTimeout(() => w.URL.revokeObjectURL(url), 1000);
                  }}
                >
                  Export HTML
                </Button>
              )}
            </div>
          </div>
        </Dialog>
      )}
      {(save || rename) && (
        <Dialog
          title={rename ? "Rename template" : "Save private template"}
          onCloseRequest={() => {
            setSave(null);
            setRename(null);
          }}
        >
          <div className="agentic-board agentic-detail">
            {save && (
              <>
                <p>
                  {save.elements.length} reusable elements included;{" "}
                  {save.excluded} unsupported elements excluded. Links and
                  custom metadata are removed. Selected images are copied into
                  this private cloud template.
                </p>
                <ScenePreview
                  elements={save.elements}
                  files={save.files}
                  title="Saved template"
                />
              </>
            )}
            <label>
              Name
              <input
                maxLength={100}
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
            </label>
            <label>
              Category
              <select
                value={saveCategory}
                onChange={(e) => setSaveCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <Button
              disabled={!saveName.trim()}
              onSelect={() =>
                runAction(async () => {
                  if (!rename && personal.length >= 100) {
                    throw new Error("You can save up to 100 cloud templates.");
                  }
                  const next = rename
                    ? {
                        ...rename,
                        title: saveName.trim(),
                        category: saveCategory,
                      }
                    : {
                        id: randomId(),
                        title: saveName.trim(),
                        category: saveCategory,
                        elements: save!.elements,
                        files: save!.files,
                      };
                  await persist(next, next.id);
                  setSave(null);
                  setRename(null);
                  setStatus("Template saved to your workspace.");
                })
              }
            >
              Save template
            </Button>
            {error && <p role="alert">{error}</p>}
          </div>
        </Dialog>
      )}
    </DefaultSidebar>
  );
}
