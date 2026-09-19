import { useEffect, useState } from "react";

import { cloudApi, localApi } from "../agentic-board/client";
import { supabase } from "../supabase/client";

import { createCollection, loadWorkspace, workspaceApi } from "./api";
import { WorkspaceCommentsContext } from "./WorkspaceCommentsContext";

import "./WorkspaceApp.scss";

import type { Session } from "@supabase/supabase-js";
import type {
  ComponentType,
  FormEvent,
  MouseEventHandler,
  ReactNode,
} from "react";
import type {
  BoardyProfile,
  WhiteboardSummary,
  WorkspaceCollection,
  WorkspaceDashboard,
} from "./types";

const routeTo = (ownerWindow: Window | null, path: string) => {
  if (!ownerWindow) {
    return;
  }
  ownerWindow.history.pushState({}, "", path);
  ownerWindow.dispatchEvent(new PopStateEvent("popstate"));
};

const Icon = ({
  name,
}: {
  name:
    | "boards"
    | "collection"
    | "shared"
    | "trash"
    | "members"
    | "settings"
    | "search"
    | "plus"
    | "back"
    | "comments"
    | "share"
    | "profile"
    | "more"
    | "sort"
    | "edit"
    | "move";
}) => {
  const paths: Record<typeof name, ReactNode> = {
    boards: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    collection: (
      <path d="M3 7.5h7l2 2h9v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7.5V5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2.5" />
    ),
    shared: (
      <>
        <circle cx="8" cy="8" r="3" />
        <circle cx="17" cy="7" r="2.5" />
        <path d="M3 20c.5-4 2.5-6 5-6s4.5 2 5 6M14 14c3.5-.5 6 1.5 7 5" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 3h6l1 4H8zM7 7l1 14h8l1-14" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
    members: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21c.5-4.5 2.5-7 6-7s5.5 2.5 6 7M16 5v6M13 8h6" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3l-.7 2-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7z"
          transform="translate(2 -1) scale(.83)"
        />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    back: <path d="m15 18-6-6 6-6" />,
    comments: <path d="M4 5h16v11H9l-5 4z" />,
    share: (
      <>
        <circle cx="18" cy="5" r="2.5" />
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="19" r="2.5" />
        <path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22c.5-5.5 3.5-8 8-8s7.5 2.5 8 8" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1.25" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1.25" fill="currentColor" stroke="none" />
      </>
    ),
    sort: <path d="M8 5v14m0 0-4-4m4 4 4-4M16 19V5m0 0-4 4m4-4 4 4" />,
    edit: (
      <>
        <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z" />
        <path d="m14.5 7.5 3 3" />
      </>
    ),
    move: (
      <>
        <path d="M12 3v18M3 12h18" />
        <path d="m8 7 4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

export const UserIdentity = ({
  profile,
  compact = false,
}: {
  profile: BoardyProfile;
  compact?: boolean;
}) => (
  <span className={`boardy-identity${compact ? " is-compact" : ""}`}>
    {profile.avatarUrl ? (
      <img src={profile.avatarUrl} alt="" />
    ) : (
      <span className="boardy-avatar" aria-hidden="true">
        {profile.displayName.slice(0, 1).toUpperCase()}
      </span>
    )}
    <span>
      <strong>{profile.displayName}</strong>
      <small>{profile.email}</small>
    </span>
  </span>
);

type ThumbnailElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  opacity?: number;
  points?: readonly (readonly [number, number])[];
  text?: string;
  fontSize?: number;
  fileId?: string | null;
  isDeleted?: boolean;
};

type ThumbnailDocument = {
  elements: ThumbnailElement[];
  files?: Record<string, { dataURL?: string }>;
};

const WhiteboardPreview = ({
  board,
  document,
}: {
  board: WhiteboardSummary;
  document: ThumbnailDocument | null | undefined;
}) => {
  const elements = (document?.elements || []).filter(
    (element) => !element.isDeleted,
  );
  const bounds = elements.reduce(
    (value, element) => ({
      minX: Math.min(value.minX, element.x),
      minY: Math.min(value.minY, element.y),
      maxX: Math.max(value.maxX, element.x + Math.max(element.width, 1)),
      maxY: Math.max(value.maxY, element.y + Math.max(element.height, 1)),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
  const padding = 24;
  const viewBox = elements.length
    ? `${bounds.minX - padding} ${bounds.minY - padding} ${Math.max(
        bounds.maxX - bounds.minX + padding * 2,
        1,
      )} ${Math.max(bounds.maxY - bounds.minY + padding * 2, 1)}`
    : "0 0 320 180";
  return (
    <div className="boardy-preview" aria-hidden="true">
      {document && !elements.length ? (
        <img
          className="boardy-preview__empty"
          src="/brand/empty-whiteboard-thumbnail.png"
          alt=""
        />
      ) : document ? (
        <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
          {elements.map((element) => {
            const stroke = element.strokeColor || "#1b243d";
            const fill =
              element.backgroundColor &&
              element.backgroundColor !== "transparent"
                ? element.backgroundColor
                : "none";
            const transform = element.angle
              ? `rotate(${(element.angle * 180) / Math.PI} ${
                  element.x + element.width / 2
                } ${element.y + element.height / 2})`
              : undefined;
            const common = {
              key: element.id,
              opacity: (element.opacity ?? 100) / 100,
              stroke,
              strokeWidth: element.strokeWidth || 2,
              fill,
              transform,
            };
            if (element.type === "ellipse") {
              return (
                <ellipse
                  {...common}
                  cx={element.x + element.width / 2}
                  cy={element.y + element.height / 2}
                  rx={Math.abs(element.width / 2)}
                  ry={Math.abs(element.height / 2)}
                />
              );
            }
            if (element.type === "diamond") {
              return (
                <polygon
                  {...common}
                  points={`${element.x + element.width / 2},${element.y} ${
                    element.x + element.width
                  },${element.y + element.height / 2} ${
                    element.x + element.width / 2
                  },${element.y + element.height} ${element.x},${
                    element.y + element.height / 2
                  }`}
                />
              );
            }
            if (
              ["line", "arrow", "freedraw"].includes(element.type) &&
              element.points?.length
            ) {
              return (
                <polyline
                  {...common}
                  points={element.points
                    .map(
                      (point) =>
                        `${element.x + point[0]},${element.y + point[1]}`,
                    )
                    .join(" ")}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            }
            if (element.type === "text") {
              return (
                <text
                  {...common}
                  x={element.x}
                  y={element.y + (element.fontSize || 20)}
                  fill={stroke}
                  stroke="none"
                  fontSize={element.fontSize || 20}
                  fontFamily="Assistant, sans-serif"
                >
                  {(element.text || "").slice(0, 120)}
                </text>
              );
            }
            if (
              element.type === "image" &&
              element.fileId &&
              document.files?.[element.fileId]?.dataURL
            ) {
              return (
                <image
                  key={element.id}
                  href={document.files[element.fileId].dataURL}
                  x={element.x}
                  y={element.y}
                  width={element.width}
                  height={element.height}
                  opacity={(element.opacity ?? 100) / 100}
                  transform={transform}
                  preserveAspectRatio="xMidYMid slice"
                />
              );
            }
            return (
              <rect
                {...common}
                x={element.x}
                y={element.y}
                width={Math.abs(element.width)}
                height={Math.abs(element.height)}
                rx={Math.min(8, Math.abs(element.width) / 8)}
              />
            );
          })}
        </svg>
      ) : (
        <span className="boardy-preview__loading" />
      )}
      <small>v{board.current_revision_number}</small>
    </div>
  );
};

const relativeTime = (value: string) => {
  const seconds = Math.max(
    1,
    Math.round((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const SidebarButton = ({
  active,
  icon,
  children,
  onClick,
}: {
  active?: boolean;
  icon: Parameters<typeof Icon>[0]["name"];
  children: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
}) => (
  <button
    className={active ? "is-active" : undefined}
    type="button"
    aria-label={typeof children === "string" ? children : undefined}
    onClick={onClick}
  >
    <Icon name={icon} />
    <span>{children}</span>
  </button>
);

const WorkspaceSidebar = ({
  data,
  activeCollection,
  pathname,
  onSignOut,
  localDemo,
  query,
  setQuery,
}: {
  data: WorkspaceDashboard;
  activeCollection: string | null;
  pathname: string;
  onSignOut: () => Promise<void>;
  localDemo: boolean;
  query: string;
  setQuery: (value: string) => void;
}) => (
  <aside className="boardy-workspace-sidebar">
    <div className="boardy-workspace-switcher">
      <span className="boardy-workspace-mark" aria-hidden="true">
        {data.workspace.name.slice(0, 1).toUpperCase()}
      </span>
      <span>
        <strong>{data.workspace.name}</strong>
        <small>Boardy Pro</small>
      </span>
      <span className="boardy-switcher-chevron" aria-hidden="true" />
    </div>
    <label className="boardy-sidebar-search">
      <Icon name="search" />
      <span className="sr-only">Quick search</span>
      <input
        type="search"
        value={query}
        onFocus={(event) =>
          pathname === "/app" ||
          routeTo(event.currentTarget.ownerDocument.defaultView, "/app")
        }
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Quick search"
      />
      <kbd>⌘P</kbd>
    </label>
    <nav aria-label="Workspace navigation">
      <SidebarButton
        active={!activeCollection && pathname === "/app"}
        icon="boards"
        onClick={(event) =>
          routeTo(event.currentTarget.ownerDocument.defaultView, "/app")
        }
      >
        Dashboard
      </SidebarButton>
      {data.membership.role === "admin" && (
        <>
          <SidebarButton
            icon="members"
            onClick={(event) =>
              routeTo(
                event.currentTarget.ownerDocument.defaultView,
                "/app/members",
              )
            }
          >
            Team members
          </SidebarButton>
          <SidebarButton
            icon="settings"
            onClick={(event) =>
              routeTo(
                event.currentTarget.ownerDocument.defaultView,
                "/app/settings",
              )
            }
          >
            Workspace settings
          </SidebarButton>
        </>
      )}
      <SidebarButton
        icon="shared"
        onClick={(event) =>
          routeTo(
            event.currentTarget.ownerDocument.defaultView,
            "/app?view=shared",
          )
        }
      >
        Shared with me
      </SidebarButton>
      <SidebarButton
        icon="trash"
        onClick={(event) =>
          routeTo(event.currentTarget.ownerDocument.defaultView, "/app/trash")
        }
      >
        Trash
      </SidebarButton>
    </nav>
    <div className="boardy-collection-heading">
      <span>Collections</span>
      <button
        type="button"
        aria-label="Create collection"
        onClick={(event) =>
          routeTo(
            event.currentTarget.ownerDocument.defaultView,
            "/app?new=collection",
          )
        }
      >
        <Icon name="plus" />
      </button>
    </div>
    <nav aria-label="Collections">
      {data.collections.map((collection) => (
        <SidebarButton
          active={collection.id === activeCollection}
          icon="collection"
          key={collection.id}
          onClick={(event) =>
            routeTo(
              event.currentTarget.ownerDocument.defaultView,
              `/app/collections/${collection.id}`,
            )
          }
        >
          {collection.name}
        </SidebarButton>
      ))}
    </nav>
    <div className="boardy-sidebar-account">
      <button
        className="boardy-profile-button"
        type="button"
        onClick={(event) =>
          routeTo(event.currentTarget.ownerDocument.defaultView, "/app/profile")
        }
      >
        <UserIdentity profile={data.profile} />
      </button>
      <button
        type="button"
        className="boardy-sign-out"
        onClick={async (event) => {
          const ownerWindow = event.currentTarget.ownerDocument.defaultView;
          if (import.meta.env.DEV && ownerWindow && localDemo) {
            await localApi(ownerWindow, "session", "DELETE").catch(
              () => undefined,
            );
          }
          await supabase.auth.signOut();
          await onSignOut();
        }}
      >
        Sign out
      </button>
    </div>
  </aside>
);

const WhiteboardCard = ({
  board,
  collections,
  workspaceId,
  refresh,
  preview,
}: {
  board: WhiteboardSummary;
  collections: WorkspaceCollection[];
  workspaceId: string;
  refresh: () => Promise<void>;
  preview: ThumbnailDocument | null | undefined;
}) => {
  const [title, setTitle] = useState(board.title);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState("");
  const [action, setAction] = useState<"rename" | "move" | null>(null);
  const [collectionId, setCollectionId] = useState(board.collection_id);
  const rename = async (event: FormEvent) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle || nextTitle === board.title) {
      return;
    }
    setRenaming(true);
    setRenameError("");
    try {
      await workspaceApi(`whiteboards/${board.id}`, "PATCH", {
        workspaceId,
        title: nextTitle,
      });
      setAction(null);
      await refresh();
    } catch (caught) {
      setRenameError(
        caught instanceof Error
          ? caught.message
          : "Whiteboard could not be renamed.",
      );
    } finally {
      setRenaming(false);
    }
  };
  return (
    <article className="boardy-board-card">
      <button
        className="boardy-board-card__open"
        type="button"
        onClick={(event) =>
          routeTo(
            event.currentTarget.ownerDocument.defaultView,
            `/app/boards/${board.id}`,
          )
        }
        aria-label={`Open ${board.title}`}
      >
        <WhiteboardPreview board={board} document={preview} />
        <span className="boardy-board-card__copy">
          <strong>{board.title}</strong>
          <small>Updated {relativeTime(board.updated_at)}</small>
        </span>
      </button>
      <details className="boardy-board-menu">
        <summary aria-label={`Board options for ${board.title}`}>
          <Icon name="more" />
        </summary>
        <div className="boardy-board-menu__list">
          <button
            type="button"
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              setTitle(board.title);
              setRenameError("");
              setAction("rename");
            }}
          >
            <Icon name="edit" />
            Rename
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              setCollectionId(board.collection_id);
              setAction("move");
            }}
          >
            <Icon name="move" />
            Move to collection
          </button>
        </div>
      </details>
      {action && (
        <div className="boardy-dialog-backdrop" role="presentation">
          <section
            className="boardy-dialog boardy-board-action-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`board-action-${board.id}`}
          >
            <h2 id={`board-action-${board.id}`}>
              {action === "rename" ? "Rename whiteboard" : "Move whiteboard"}
            </h2>
            <p>
              {action === "rename"
                ? "Choose a clear name your team can recognize quickly."
                : `Choose a collection for ${board.title}.`}
            </p>
            {action === "rename" ? (
              <form onSubmit={(event) => void rename(event)}>
                <label>
                  Whiteboard name
                  <input
                    autoFocus
                    value={title}
                    maxLength={160}
                    required
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </label>
                {renameError && <small role="alert">{renameError}</small>}
                <div className="boardy-dialog-actions">
                  <button
                    className="boardy-button is-secondary"
                    type="button"
                    onClick={() => setAction(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="boardy-button is-primary"
                    type="submit"
                    disabled={renaming || title.trim() === board.title}
                  >
                    {renaming ? "Saving…" : "Save name"}
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  await workspaceApi(`whiteboards/${board.id}`, "PATCH", {
                    workspaceId,
                    collectionId,
                  });
                  setAction(null);
                  await refresh();
                }}
              >
                <label>
                  Collection
                  <select
                    autoFocus
                    value={collectionId}
                    onChange={(event) => setCollectionId(event.target.value)}
                  >
                    {collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="boardy-dialog-actions">
                  <button
                    className="boardy-button is-secondary"
                    type="button"
                    onClick={() => setAction(null)}
                  >
                    Cancel
                  </button>
                  <button className="boardy-button is-primary" type="submit">
                    Move whiteboard
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </article>
  );
};

const DashboardContent = ({
  data,
  activeCollection,
  refresh,
  query,
  openNewCollection,
}: {
  data: WorkspaceDashboard;
  activeCollection: string | null;
  refresh: () => Promise<void>;
  query: string;
  openNewCollection: boolean;
}) => {
  const [sort, setSort] = useState<"updated" | "name-asc" | "name-desc">(
    "updated",
  );
  const [creating, setCreating] = useState(false);
  const [newCollection, setNewCollection] = useState(false);
  const [sharingCollection, setSharingCollection] = useState(false);
  const [previews, setPreviews] = useState<
    Record<string, ThumbnailDocument | null>
  >({});
  const collection = data.collections.find(
    (item) => item.id === activeCollection,
  );
  const boards = data.whiteboards
    .filter(
      (board) =>
        board.status === "active" &&
        (!activeCollection || board.collection_id === activeCollection) &&
        board.title.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((left, right) => {
      if (sort === "name-asc") {
        return left.title.localeCompare(right.title);
      }
      if (sort === "name-desc") {
        return right.title.localeCompare(left.title);
      }
      return (
        new Date(right.updated_at).getTime() -
        new Date(left.updated_at).getTime()
      );
    });
  const defaultCollection = collection || data.collections[0];
  useEffect(() => {
    let active = true;
    void workspaceApi<{
      previews: Record<string, ThumbnailDocument | null>;
    }>("previews", "GET", { workspaceId: data.workspace.id })
      .then((result) => {
        if (active) {
          setPreviews(result.previews);
        }
      })
      .catch(() => {
        if (active) {
          setPreviews({});
        }
      });
    return () => {
      active = false;
    };
  }, [data.workspace.id, data.whiteboards]);
  useEffect(() => {
    if (openNewCollection) {
      setNewCollection(true);
    }
  }, [openNewCollection]);

  const createBoard = async (ownerWindow: Window | null) => {
    if (!defaultCollection) {
      return;
    }
    setCreating(true);
    try {
      const created = await cloudApi<{ sceneId: string }>(
        "scenes",
        "scenes",
        "POST",
        {
          title: "Untitled whiteboard",
          workspaceId: data.workspace.id,
          collectionId: defaultCollection.id,
          requestId: `${
            ownerWindow?.crypto.randomUUID() || Date.now().toString(36)
          }-${Date.now().toString(36)}`,
          document: { version: 1, elements: [], appState: null, files: {} },
        },
      );
      routeTo(ownerWindow, `/app/boards/${created.sceneId}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="boardy-dashboard-main" id="main-content">
      <header className="boardy-dashboard-header">
        <div className="boardy-dashboard-heading">
          <span aria-hidden="true">
            <Icon name={collection ? "collection" : "boards"} />
          </span>
          <h1>{collection?.name || "Whiteboards"}</h1>
        </div>
        <div className="boardy-dashboard-actions">
          {collection && (
            <button
              type="button"
              className="boardy-button is-secondary"
              onClick={() => setSharingCollection(true)}
            >
              <Icon name="share" /> Share collection
            </button>
          )}
          <button
            type="button"
            className="boardy-button is-secondary"
            onClick={() => setNewCollection(true)}
          >
            <Icon name="collection" /> New collection
          </button>
          <button
            type="button"
            className="boardy-button is-primary"
            disabled={creating || !defaultCollection}
            onClick={(event) =>
              void createBoard(event.currentTarget.ownerDocument.defaultView)
            }
          >
            <Icon name="plus" /> {creating ? "Creating…" : "Create whiteboard"}
          </button>
        </div>
      </header>
      <div className="boardy-dashboard-toolbar">
        <label className="boardy-sort-control">
          <Icon name="sort" />
          <span className="sr-only">Sort whiteboards</span>
          <select
            aria-label="Sort whiteboards"
            value={sort}
            onChange={(event) =>
              setSort(
                event.target.value as "updated" | "name-asc" | "name-desc",
              )
            }
          >
            <option value="updated">Recently updated</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
          </select>
        </label>
      </div>
      {boards.length ? (
        <section className="boardy-board-grid" aria-label="Whiteboards">
          {boards.map((board) => (
            <WhiteboardCard
              board={board}
              collections={data.collections}
              key={board.id}
              refresh={refresh}
              workspaceId={data.workspace.id}
              preview={previews[board.id]}
            />
          ))}
        </section>
      ) : (
        <section className="boardy-empty-state">
          <div>
            <Icon name="boards" />
          </div>
          <h2>
            {query ? "No matching whiteboards" : "Create your first whiteboard"}
          </h2>
          <p>
            {query
              ? "Try a different search."
              : "Start with a blank canvas and invite collaborators when you are ready."}
          </p>
          {!query && (
            <button
              className="boardy-button is-primary"
              type="button"
              onClick={(event) =>
                void createBoard(event.currentTarget.ownerDocument.defaultView)
              }
            >
              Create whiteboard
            </button>
          )}
        </section>
      )}
      {newCollection && (
        <CollectionDialog
          data={data}
          onClose={() => setNewCollection(false)}
          onCreated={refresh}
        />
      )}
      {sharingCollection && collection && (
        <ResourceShareDialog
          data={data}
          collectionId={collection.id}
          resourceName={collection.name}
          onClose={() => setSharingCollection(false)}
        />
      )}
    </main>
  );
};

const CollectionDialog = ({
  data,
  onClose,
  onCreated,
}: {
  data: WorkspaceDashboard;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) => {
  const [name, setName] = useState("");
  const [visibility, setVisibility] =
    useState<WorkspaceCollection["visibility"]>("private");
  const [error, setError] = useState("");
  return (
    <div
      className="boardy-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="boardy-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-dialog-title"
      >
        <h2 id="collection-dialog-title">New collection</h2>
        <p>
          Collections keep related whiteboards and their shared access together.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            try {
              await createCollection(data.workspace.id, name, visibility);
              await onCreated();
              onClose();
            } catch (caught) {
              setError(
                caught instanceof Error
                  ? caught.message
                  : "Collection could not be created.",
              );
            }
          }}
        >
          <label>
            Name
            <input
              autoFocus
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Access
            <select
              value={visibility}
              onChange={(event) =>
                setVisibility(
                  event.target.value as WorkspaceCollection["visibility"],
                )
              }
            >
              <option value="private">
                Private — workspace admins can still access
              </option>
              <option value="workspace">Everyone in the workspace</option>
              <option value="selected">Selected people</option>
            </select>
          </label>
          {error && (
            <p className="boardy-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="boardy-dialog-actions">
            <button
              type="button"
              className="boardy-button is-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="boardy-button is-primary" type="submit">
              Create collection
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

const MembersView = ({
  data,
  refresh,
}: {
  data: WorkspaceDashboard;
  refresh: () => Promise<void>;
}) => {
  const [inviteLink, setInviteLink] = useState("");
  const invite = async (ownerWindow: Window | null) => {
    const result = await workspaceApi<{ token: string }>(
      "invitations",
      "POST",
      {
        workspaceId: data.workspace.id,
        workspaceRole: "external",
        maxUses: 30,
        expiresInDays: 7,
      },
    );
    setInviteLink(
      `${ownerWindow?.location.origin || ""}/invite/${result.token}`,
    );
  };
  return (
    <main className="boardy-dashboard-main" id="main-content">
      <header className="boardy-dashboard-header">
        <h1>Members</h1>
        <button
          className="boardy-button is-primary"
          type="button"
          onClick={(event) =>
            void invite(event.currentTarget.ownerDocument.defaultView)
          }
        >
          <Icon name="plus" />
          Create invite link
        </button>
      </header>
      {inviteLink && (
        <div className="boardy-invite-result" role="status">
          <input readOnly value={inviteLink} />
          <button
            type="button"
            onClick={(event) =>
              void event.currentTarget.ownerDocument.defaultView?.navigator.clipboard.writeText(
                inviteLink,
              )
            }
          >
            Copy link
          </button>
        </div>
      )}
      <div className="boardy-member-list">
        {data.members.map((member) => (
          <div className="boardy-member-row" key={member.user_id}>
            <UserIdentity profile={member.profile} />
            <div className="boardy-member-actions">
              <label>
                <span className="sr-only">
                  Role for {member.profile.displayName}
                </span>
                <select
                  value={member.role}
                  disabled={member.user_id === data.profile.userId}
                  onChange={async (event) => {
                    await workspaceApi(`members/${member.user_id}`, "PATCH", {
                      workspaceId: data.workspace.id,
                      role: event.target.value,
                    });
                    await refresh();
                  }}
                >
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="external">External</option>
                </select>
              </label>
              {member.user_id !== data.profile.userId && (
                <button
                  type="button"
                  onClick={async () => {
                    await workspaceApi(`members/${member.user_id}`, "PATCH", {
                      workspaceId: data.workspace.id,
                      action: "remove",
                    });
                    await refresh();
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
};

const ProfileView = ({
  data,
  refresh,
}: {
  data: WorkspaceDashboard;
  refresh: () => Promise<void>;
}) => {
  const [name, setName] = useState(data.profile.displayName);
  const [status, setStatus] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await workspaceApi("profile", "PATCH", { displayName: name });
    setStatus("Profile saved.");
    await refresh();
  };
  return (
    <main className="boardy-dashboard-main" id="main-content">
      <header className="boardy-dashboard-header">
        <div>
          <h1>Your profile</h1>
          <p className="boardy-page-description">
            Keep your identity recognizable across whiteboards, comments, and
            mentions.
          </p>
        </div>
      </header>
      <div className="boardy-profile-layout">
        <section className="boardy-profile-summary">
          <UserIdentity profile={data.profile} />
          <dl>
            <div>
              <dt>Workspace role</dt>
              <dd>{data.membership.role}</dd>
            </div>
            <div>
              <dt>Workspace</dt>
              <dd>{data.workspace.name}</dd>
            </div>
          </dl>
        </section>
        <section className="boardy-settings-panel">
          <header>
            <h2>Profile details</h2>
            <p>Shown to people you collaborate with.</p>
          </header>
          <form onSubmit={(event) => void submit(event)}>
            <label className="boardy-upload-control">
              <span>Profile photo</span>
              <span className="boardy-upload-button">Choose image</span>
              <small>JPG, PNG, or WebP.</small>
              <input
                className="boardy-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }
                  const extension =
                    file.name.split(".").pop()?.toLowerCase() || "jpg";
                  const path = `${data.profile.userId}/avatar.${extension}`;
                  const { error } = await supabase.storage
                    .from("boardy-avatars")
                    .upload(path, file, {
                      upsert: true,
                      contentType: file.type,
                    });
                  if (error) {
                    setStatus(error.message);
                    return;
                  }
                  await workspaceApi("profile", "PATCH", {
                    displayName: name,
                    avatarPath: path,
                  });
                  setStatus("Profile photo saved.");
                  await refresh();
                }}
              />
            </label>
            <label>
              Display name
              <input
                value={name}
                maxLength={120}
                required
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Email
              <input value={data.profile.email} readOnly />
              <small>
                Email changes require verification through your account.
              </small>
            </label>
            <div className="boardy-form-footer">
              {status && <p role="status">{status}</p>}
              <button className="boardy-button is-primary" type="submit">
                Save changes
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
};

const WorkspaceSettingsView = ({
  data,
  refresh,
}: {
  data: WorkspaceDashboard;
  refresh: () => Promise<void>;
}) => {
  const [name, setName] = useState(data.workspace.name);
  const [status, setStatus] = useState("");
  const isAdmin = data.membership.role === "admin";
  const saveWorkspace = async (event: FormEvent) => {
    event.preventDefault();
    await workspaceApi("settings", "PATCH", {
      workspaceId: data.workspace.id,
      name,
    });
    setStatus("Workspace details saved.");
    await refresh();
  };
  const roles = [
    {
      name: "Admin",
      summary: "Owns workspace governance and billing.",
      capabilities: "Manage members, roles, settings, collections, and boards",
    },
    {
      name: "Staff",
      summary: "Creates and organizes team work.",
      capabilities: "Create boards and collections; manage owned resources",
    },
    {
      name: "External",
      summary: "Collaborates only where access is granted.",
      capabilities: "View, comment, or edit according to each share permission",
    },
  ];
  return (
    <main className="boardy-dashboard-main" id="main-content">
      <header className="boardy-dashboard-header">
        <div>
          <h1>Workspace settings</h1>
          <p className="boardy-page-description">
            Manage company identity, subscription access, and workspace roles.
          </p>
        </div>
      </header>
      <div className="boardy-settings-grid">
        <section className="boardy-settings-panel">
          <header>
            <h2>Company details</h2>
            <p>Used throughout the shared workspace.</p>
          </header>
          <form onSubmit={(event) => void saveWorkspace(event)}>
            <label>
              Company or workspace name
              <input
                value={name}
                maxLength={120}
                required
                disabled={!isAdmin}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            {isAdmin && (
              <div className="boardy-form-footer">
                {status && <p role="status">{status}</p>}
                <button
                  className="boardy-button is-primary"
                  type="submit"
                  disabled={!name.trim() || name.trim() === data.workspace.name}
                >
                  Save workspace
                </button>
              </div>
            )}
          </form>
          <dl className="boardy-workspace-metadata">
            <div>
              <dt>Workspace slug</dt>
              <dd>{data.workspace.slug}</dd>
            </div>
            <div>
              <dt>Workspace ID</dt>
              <dd>{data.workspace.id}</dd>
            </div>
          </dl>
        </section>
        <section className="boardy-settings-panel boardy-billing-card">
          <header>
            <h2>Plan and billing</h2>
            <span className="boardy-status-badge">
              {data.workspace.subscription_status}
            </span>
          </header>
          <div className="boardy-plan-summary">
            <strong>Boardy Pro</strong>
            <span>Cloud whiteboards and team collaboration</span>
          </div>
          <dl>
            <div>
              <dt>Active members</dt>
              <dd>
                {
                  data.members.filter((member) => member.status === "active")
                    .length
                }
              </dd>
            </div>
            <div>
              <dt>Billing access</dt>
              <dd>Workspace admins</dd>
            </div>
          </dl>
          {isAdmin && (
            <button
              className="boardy-button is-secondary"
              type="button"
              onClick={(event) =>
                routeTo(
                  event.currentTarget.ownerDocument.defaultView,
                  "/app/subscription",
                )
              }
            >
              Manage plan and billing
            </button>
          )}
        </section>
      </div>
      <section className="boardy-role-panel">
        <header>
          <div>
            <h2>Roles and capabilities</h2>
            <p>
              Workspace roles set the ceiling; each share can narrow access.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              className="boardy-button is-secondary"
              onClick={(event) =>
                routeTo(
                  event.currentTarget.ownerDocument.defaultView,
                  "/app/members",
                )
              }
            >
              Manage members
            </button>
          )}
        </header>
        <div className="boardy-role-list">
          {roles.map((role) => (
            <article key={role.name}>
              <div>
                <strong>{role.name}</strong>
                <p>{role.summary}</p>
              </div>
              <span>{role.capabilities}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
};

const BoardEditor = ({
  data,
  BoardApp,
  sceneId,
}: {
  data: WorkspaceDashboard;
  BoardApp: ComponentType;
  sceneId: string;
}) => {
  const board = data.whiteboards.find((item) => item.id === sceneId);
  const [commentsOpenRequest, setCommentsOpenRequest] = useState(0);
  return (
    <div className="boardy-editor-shell">
      <header className="boardy-editor-header">
        <button
          type="button"
          className="boardy-icon-text"
          onClick={(event) =>
            routeTo(
              event.currentTarget.ownerDocument.defaultView,
              board?.collection_id
                ? `/app/collections/${board.collection_id}`
                : "/app",
            )
          }
        >
          <Icon name="back" />
          Whiteboards
        </button>
        <div className="boardy-editor-title">
          <strong>{board?.title || "Whiteboard"}</strong>
        </div>
        <div className="boardy-editor-actions">
          <button
            type="button"
            className="boardy-button is-secondary"
            onClick={() => setCommentsOpenRequest((value) => value + 1)}
          >
            <Icon name="comments" />
            Comments
          </button>
        </div>
      </header>
      <div className="boardy-editor-body">
        <WorkspaceCommentsContext.Provider
          value={{
            sceneId,
            members: data.members,
            openRequest: commentsOpenRequest,
          }}
        >
          <main className="boardy-editor-canvas">
            <BoardApp />
          </main>
        </WorkspaceCommentsContext.Provider>
      </div>
    </div>
  );
};

const ResourceShareDialog = ({
  data,
  collectionId,
  resourceName,
  onClose,
}: {
  data: WorkspaceDashboard;
  collectionId: string;
  resourceName: string;
  onClose: () => void;
}) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [link, setLink] = useState("");
  return (
    <div className="boardy-dialog-backdrop" role="presentation">
      <section
        className="boardy-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-share-title"
      >
        <h2 id="collection-share-title">Share {resourceName}</h2>
        <p>
          People with this invitation can access every whiteboard in this
          collection with the selected permission.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const ownerWindow = event.currentTarget.ownerDocument.defaultView;
            const result = await workspaceApi<{ token: string }>(
              "invitations",
              "POST",
              {
                workspaceId: data.workspace.id,
                collectionId,
                recipientEmail: email || undefined,
                workspaceRole: "external",
                resourceRole: role,
                maxUses: email ? 1 : 30,
              },
            );
            setLink(
              `${ownerWindow?.location.origin || ""}/invite/${result.token}`,
            );
          }}
        >
          <label>
            Email (optional for a reusable link)
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Permission
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="editor">Editor</option>
              <option value="commenter">Commenter</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          <button className="boardy-button is-primary" type="submit">
            Create collection link
          </button>
        </form>
        {link && (
          <div className="boardy-invite-result">
            <input readOnly value={link} />
            <button
              type="button"
              onClick={(event) =>
                void event.currentTarget.ownerDocument.defaultView?.navigator.clipboard.writeText(
                  link,
                )
              }
            >
              Copy
            </button>
          </div>
        )}
        <div className="boardy-dialog-actions">
          <button
            className="boardy-button is-secondary"
            type="button"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </section>
    </div>
  );
};

export const WorkspaceApp = ({
  BoardApp,
  onSignOut,
  localDemo,
  locationHref,
}: {
  BoardApp: ComponentType;
  session: Session;
  onSignOut: () => Promise<void>;
  localDemo: boolean;
  locationHref: string;
}) => {
  const [data, setData] = useState<WorkspaceDashboard | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const refresh = async () => {
    try {
      setData(await loadWorkspace());
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Workspace could not be loaded.",
      );
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const pathname = new URL(locationHref).pathname;
  const sceneId =
    pathname.match(/^\/app\/boards\/([0-9a-f-]{36})$/i)?.[1] || null;
  const collectionId =
    pathname.match(/^\/app\/collections\/([0-9a-f-]{36})$/i)?.[1] || null;
  if (!data) {
    return (
      <main className="atelix-page atelix-loading-page" aria-live="polite">
        {error || "Preparing your workspace…"}
      </main>
    );
  }
  if (sceneId) {
    return <BoardEditor data={data} BoardApp={BoardApp} sceneId={sceneId} />;
  }
  const content =
    pathname === "/app/members" ? (
      <MembersView data={data} refresh={refresh} />
    ) : pathname === "/app/settings" ? (
      <WorkspaceSettingsView data={data} refresh={refresh} />
    ) : pathname === "/app/profile" ? (
      <ProfileView data={data} refresh={refresh} />
    ) : (
      <DashboardContent
        data={data}
        activeCollection={collectionId}
        refresh={refresh}
        query={query}
        openNewCollection={locationHref.includes("new=collection")}
      />
    );
  return (
    <div className="boardy-workspace-shell">
      <a className="boardy-skip-link" href="#main-content">
        Skip to content
      </a>
      <WorkspaceSidebar
        data={data}
        activeCollection={collectionId}
        pathname={pathname}
        onSignOut={onSignOut}
        localDemo={localDemo}
        query={query}
        setQuery={setQuery}
      />
      <div className="boardy-workspace-stage">{content}</div>
    </div>
  );
};
