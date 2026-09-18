import { useEffect, useState } from "react";

import { cloudApi, localApi } from "../agentic-board/client";
import { supabase } from "../supabase/client";

import { createCollection, loadWorkspace, workspaceApi } from "./api";
import { BoardCommentsPanel } from "./BoardCommentsPanel";

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
    | "profile";
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

const WhiteboardPreview = ({ board }: { board: WhiteboardSummary }) => (
  <div className="boardy-preview" aria-hidden="true">
    <span className="boardy-preview__line is-long" />
    <span className="boardy-preview__note is-blue" />
    <span className="boardy-preview__note is-yellow" />
    <span className="boardy-preview__connector" />
    <span className="boardy-preview__line" />
    <small>v{board.current_revision_number}</small>
  </div>
);

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
}: {
  data: WorkspaceDashboard;
  activeCollection: string | null;
  pathname: string;
}) => (
  <aside className="boardy-workspace-sidebar">
    <a
      className="boardy-workspace-brand"
      href="/app"
      aria-label="Boardy whiteboards"
    >
      <span>Boardy</span>
      <small>By Atelix</small>
    </a>
    <button className="boardy-workspace-switcher" type="button">
      <span className="boardy-avatar">
        {data.workspace.name.slice(0, 1).toUpperCase()}
      </span>
      <span>
        <strong>{data.workspace.name}</strong>
        <small>{data.membership.role}</small>
      </span>
    </button>
    <nav aria-label="Workspace navigation">
      <SidebarButton
        active={!activeCollection && pathname === "/app"}
        icon="boards"
        onClick={(event) =>
          routeTo(event.currentTarget.ownerDocument.defaultView, "/app")
        }
      >
        Whiteboards
      </SidebarButton>
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
            Members
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
    </nav>
    <div className="boardy-collection-heading">
      <span>Collections</span>
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
    <button
      className="boardy-profile-button"
      type="button"
      onClick={(event) =>
        routeTo(event.currentTarget.ownerDocument.defaultView, "/app/profile")
      }
    >
      <UserIdentity profile={data.profile} />
    </button>
  </aside>
);

const DashboardContent = ({
  data,
  activeCollection,
  refresh,
}: {
  data: WorkspaceDashboard;
  activeCollection: string | null;
  refresh: () => Promise<void>;
}) => {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newCollection, setNewCollection] = useState(false);
  const [sharingCollection, setSharingCollection] = useState(false);
  const collection = data.collections.find(
    (item) => item.id === activeCollection,
  );
  const boards = data.whiteboards.filter(
    (board) =>
      board.status === "active" &&
      (!activeCollection || board.collection_id === activeCollection) &&
      board.title.toLowerCase().includes(query.toLowerCase()),
  );
  const defaultCollection = collection || data.collections[0];

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
        <div>
          <p>{collection ? "Collection" : "Workspace"}</p>
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
        <label className="boardy-search">
          <Icon name="search" />
          <span className="sr-only">Search whiteboards</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search whiteboards"
          />
        </label>
        <select aria-label="Sort whiteboards" defaultValue="updated">
          <option value="updated">Recently updated</option>
          <option value="name">Name</option>
        </select>
      </div>
      {boards.length ? (
        <section className="boardy-board-grid" aria-label="Whiteboards">
          {boards.map((board) => (
            <article className="boardy-board-card" key={board.id}>
              <button
                type="button"
                onClick={(event) =>
                  routeTo(
                    event.currentTarget.ownerDocument.defaultView,
                    `/app/boards/${board.id}`,
                  )
                }
                aria-label={`Open ${board.title}`}
              >
                <WhiteboardPreview board={board} />
                <span className="boardy-board-card__copy">
                  <strong>{board.title}</strong>
                  <small>Updated {relativeTime(board.updated_at)}</small>
                </span>
              </button>
              <label className="boardy-board-move">
                <span className="sr-only">
                  Move {board.title} to collection
                </span>
                <select
                  value={board.collection_id}
                  onChange={async (event) => {
                    await workspaceApi(`whiteboards/${board.id}`, "PATCH", {
                      workspaceId: data.workspace.id,
                      collectionId: event.target.value,
                    });
                    await refresh();
                  }}
                >
                  {data.collections.map((item) => (
                    <option key={item.id} value={item.id}>
                      Move to {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </article>
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
        <div>
          <p>Administration</p>
          <h1>Members</h1>
        </div>
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
          <p>Account</p>
          <h1>Your profile</h1>
        </div>
      </header>
      <section className="boardy-settings-panel">
        <UserIdentity profile={data.profile} />
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Profile photo
            <input
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
                  .upload(path, file, { upsert: true, contentType: file.type });
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
          <button className="boardy-button is-primary" type="submit">
            Save profile
          </button>
          {status && <p role="status">{status}</p>}
        </form>
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
  const [title, setTitle] = useState(board?.title || "Whiteboard");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
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
          <input
            aria-label="Whiteboard name"
            value={title}
            maxLength={160}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={async () => {
              const next = title.trim() || "Untitled whiteboard";
              setTitle(next);
              await workspaceApi(`whiteboards/${sceneId}`, "PATCH", {
                workspaceId: data.workspace.id,
                title: next,
              });
            }}
          />
          <small>Saved to Boardy cloud</small>
        </div>
        <div className="boardy-editor-actions">
          <button
            type="button"
            className="boardy-button is-secondary"
            onClick={() => setCommentsOpen((value) => !value)}
            aria-pressed={commentsOpen}
          >
            <Icon name="comments" />
            Comments
          </button>
          <button
            type="button"
            className="boardy-button is-primary"
            onClick={() => setSharing(true)}
          >
            <Icon name="share" />
            Share
          </button>
        </div>
      </header>
      <div className="boardy-editor-body">
        <main className="boardy-editor-canvas">
          <BoardApp />
        </main>
        {commentsOpen && (
          <BoardCommentsPanel
            sceneId={sceneId}
            members={data.members}
            onClose={() => setCommentsOpen(false)}
          />
        )}
      </div>
      {sharing && (
        <ShareDialog
          data={data}
          sceneId={sceneId}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
};

const ShareDialog = ({
  data,
  sceneId,
  onClose,
}: {
  data: WorkspaceDashboard;
  sceneId: string;
  onClose: () => void;
}) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [link, setLink] = useState("");
  return (
    <div className="boardy-dialog-backdrop" role="presentation">
      <section
        className="boardy-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
      >
        <h2 id="share-title">Share whiteboard</h2>
        <p>
          Invite collaborators by email. A copied whiteboard URL only works for
          people who already have access.
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
                sceneId,
                recipientEmail: email,
                workspaceRole: "external",
                resourceRole: role,
                maxUses: 1,
              },
            );
            setLink(
              `${ownerWindow?.location.origin || ""}/invite/${result.token}`,
            );
          }}
        >
          <label>
            Email
            <input
              type="email"
              required
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
            Create invitation
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
    ) : pathname === "/app/profile" ? (
      <ProfileView data={data} refresh={refresh} />
    ) : (
      <DashboardContent
        data={data}
        activeCollection={collectionId}
        refresh={refresh}
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
      />
      <div className="boardy-workspace-stage">
        {content}
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
    </div>
  );
};
