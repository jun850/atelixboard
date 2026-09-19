import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  loadComments,
  markAllCommentsRead,
  reactToMessage,
  replyToThread,
  setCommentPreference,
  setThreadUnread,
  updateThread,
} from "./api";
import { CommentComposer } from "./CommentComposer";
import {
  COMMENTS_CHANGED_EVENT,
  COMMENT_SIDEBAR_CLOSE_EVENT,
  COMMENT_THREAD_SELECT_EVENT,
} from "./commentEvents";
import { UserIdentity } from "./WorkspaceApp";

import type {
  CommentMessage,
  CommentThread,
  CommentsResponse,
  WorkspaceMember,
} from "./types";

const emitChanged = (element: HTMLElement | null) => {
  const ownerWindow = element?.ownerDocument.defaultView;
  ownerWindow?.dispatchEvent(
    new ownerWindow.CustomEvent(COMMENTS_CHANGED_EVENT),
  );
};

const RichComment = ({ message }: { message: CommentMessage }) => {
  if (message.deleted_at) {
    return <p className="boardy-comment-body is-deleted">Comment deleted</p>;
  }
  const mentions = [...(message.mentions || [])]
    .filter((mention) => mention.profile && mention.displayText)
    .sort((a, b) => b.displayText.length - a.displayText.length);
  if (!mentions.length) {
    return <p className="boardy-comment-body">{message.body}</p>;
  }
  const pattern = new RegExp(
    `(${mentions
      .map((item) => item.displayText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})`,
    "g",
  );
  const byText = new Map(mentions.map((item) => [item.displayText, item]));
  return (
    <p className="boardy-comment-body">
      {message.body.split(pattern).map((part, index) =>
        byText.has(part) ? (
          <strong className="boardy-comment-mention" key={`${part}-${index}`}>
            {part}
          </strong>
        ) : (
          <Fragment key={`${part}-${index}`}>{part}</Fragment>
        ),
      )}
    </p>
  );
};

const ThreadDetail = ({
  thread,
  sceneId,
  members,
  onBack,
  refresh,
}: {
  thread: CommentThread;
  sceneId: string;
  members: WorkspaceMember[];
  onBack: (ownerWindow: (Window & typeof globalThis) | null) => void;
  refresh: () => Promise<void>;
}) => {
  const rootRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <section
      className="boardy-comment-detail"
      ref={rootRef}
      aria-label={`Comment ${thread.thread_number}`}
    >
      <header className="boardy-comment-detail__header">
        <button
          type="button"
          onClick={() =>
            onBack(rootRef.current?.ownerDocument.defaultView || null)
          }
          aria-label="Back to comments"
        >
          ←
        </button>
        <h2>Comment</h2>
        <button
          type="button"
          aria-label={thread.resolved_at ? "Reopen thread" : "Resolve thread"}
          title={thread.resolved_at ? "Reopen" : "Resolve"}
          onClick={async () => {
            await updateThread(
              thread.id,
              thread.resolved_at ? "reopen" : "resolve",
              thread.version,
            );
            emitChanged(rootRef.current);
            await refresh();
          }}
        >
          ✓
        </button>
        <button
          type="button"
          aria-label="Comment actions"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          •••
        </button>
        {menuOpen && (
          <div className="boardy-comment-quick-menu">
            <button
              type="button"
              onClick={async () => {
                await setThreadUnread(thread.id, true);
                setMenuOpen(false);
                emitChanged(rootRef.current);
                await refresh();
              }}
            >
              Mark as unread
            </button>
            <button
              type="button"
              onClick={async () => {
                const ownerWindow = rootRef.current?.ownerDocument.defaultView;
                if (!ownerWindow) {
                  return;
                }
                const link = new ownerWindow.URL(ownerWindow.location.href);
                link.searchParams.set("comment", thread.id);
                await ownerWindow.navigator.clipboard.writeText(
                  link.toString(),
                );
                setMenuOpen(false);
              }}
            >
              Copy link
            </button>
            <button
              className="is-danger"
              type="button"
              onClick={async () => {
                const ownerWindow = rootRef.current?.ownerDocument.defaultView;
                if (!ownerWindow?.confirm("Delete this comment thread?")) {
                  return;
                }
                await updateThread(thread.id, "delete", thread.version);
                setMenuOpen(false);
                onBack(ownerWindow);
                emitChanged(rootRef.current);
                await refresh();
              }}
            >
              Delete thread…
            </button>
          </div>
        )}
      </header>
      <div className="boardy-comment-detail__messages">
        {thread.messages.map((message) => (
          <article className="boardy-comment-message" key={message.id}>
            <div className="boardy-comment-message__byline">
              <UserIdentity profile={message.author} compact />
              <time>{new Date(message.created_at).toLocaleString()}</time>
            </div>
            <RichComment message={message} />
            {message.attachment?.url && (
              <a
                href={message.attachment.url}
                target="_blank"
                rel="noreferrer"
                className="boardy-comment-image"
              >
                <img
                  src={message.attachment.url}
                  alt={message.attachment.name}
                />
              </a>
            )}
            {!message.deleted_at && (
              <div className="boardy-comment-reactions">
                {["👍", "❤️", "🎉"].map((emoji) => {
                  const reaction = message.reactions?.find(
                    (item) => item.emoji === emoji,
                  );
                  return (
                    <button
                      type="button"
                      key={emoji}
                      className={reaction?.reacted ? "is-reacted" : ""}
                      aria-label={`React with ${emoji}`}
                      onClick={async () => {
                        await reactToMessage(message.id, emoji);
                        emitChanged(rootRef.current);
                        await refresh();
                      }}
                    >
                      {emoji}
                      {reaction?.count ? ` ${reaction.count}` : ""}
                    </button>
                  );
                })}
              </div>
            )}
          </article>
        ))}
      </div>
      {!thread.resolved_at && (
        <div className="boardy-comment-detail__reply">
          <CommentComposer
            sceneId={sceneId}
            members={members}
            placeholder="Reply"
            onSubmit={async (message, mentions, attachmentAssetId) => {
              await replyToThread(
                thread.id,
                message,
                mentions,
                attachmentAssetId,
              );
              emitChanged(rootRef.current);
              await refresh();
            }}
          />
        </div>
      )}
    </section>
  );
};

export const BoardCommentsPanel = ({
  sceneId,
  onClose,
  members,
  embedded = false,
}: {
  sceneId: string;
  onClose?: () => void;
  members: WorkspaceMember[];
  embedded?: boolean;
}) => {
  const rootRef = useRef<HTMLElement>(null);
  const [data, setData] = useState<CommentsResponse | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"open" | "all" | "resolved">("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setData(await loadComments(sceneId));
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Comments could not be loaded.",
      );
    }
  }, [sceneId]);
  useEffect(() => void refresh(), [refresh]);
  useEffect(() => {
    const ownerWindow = rootRef.current?.ownerDocument.defaultView;
    if (!ownerWindow) {
      return;
    }
    const currentUrl = new ownerWindow.URL(ownerWindow.location.href);
    const fromUrl = currentUrl.searchParams.get("comment");
    if (fromUrl) {
      setSelectedId(fromUrl);
      void setThreadUnread(fromUrl, false).then(refresh);
    }
    if (currentUrl.searchParams.get("comments") === "settings") {
      setSettingsOpen(true);
    }
    const changed = () => void refresh();
    const selected = (event: Event) => {
      const threadId = (event as CustomEvent<{ threadId: string }>).detail
        .threadId;
      setSelectedId(threadId);
      void setThreadUnread(threadId, false).then(refresh);
    };
    ownerWindow.addEventListener(COMMENTS_CHANGED_EVENT, changed);
    ownerWindow.addEventListener(COMMENT_THREAD_SELECT_EVENT, selected);
    return () => {
      ownerWindow.removeEventListener(COMMENTS_CHANGED_EVENT, changed);
      ownerWindow.removeEventListener(COMMENT_THREAD_SELECT_EVENT, selected);
    };
  }, [refresh]);

  const threads = useMemo(
    () =>
      (data?.threads || []).filter((thread) => {
        if (filter === "open" && thread.resolved_at) {
          return false;
        }
        if (filter === "resolved" && !thread.resolved_at) {
          return false;
        }
        return (
          !query ||
          thread.messages.some((message) =>
            message.body.toLowerCase().includes(query.toLowerCase()),
          )
        );
      }),
    [data, filter, query],
  );
  const selectedThread = data?.threads.find(
    (thread) => thread.id === selectedId,
  );
  const closeDetail = (ownerWindow: (Window & typeof globalThis) | null) => {
    setSelectedId(null);
    if (ownerWindow) {
      const url = new ownerWindow.URL(ownerWindow.location.href);
      url.searchParams.delete("comment");
      ownerWindow.history.replaceState(ownerWindow.history.state, "", url);
    }
  };

  if (selectedThread) {
    return (
      <ThreadDetail
        thread={selectedThread}
        sceneId={sceneId}
        members={members}
        onBack={closeDetail}
        refresh={refresh}
      />
    );
  }

  return (
    <aside
      className={`boardy-comments-panel${embedded ? " is-embedded" : ""}`}
      aria-label="Comments"
      ref={rootRef}
    >
      <header className="boardy-comments-panel__header">
        <h2>Comments</h2>
        {!embedded && (
          <button type="button" aria-label="Close comments" onClick={onClose}>
            ×
          </button>
        )}
      </header>
      <div className="boardy-comments-tools">
        <label className="boardy-comments-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search comments"
          />
        </label>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as typeof filter)}
          aria-label="Filter comments"
        >
          <option value="open">Open</option>
          <option value="all">All</option>
          <option value="resolved">Resolved</option>
        </select>
        <button
          type="button"
          aria-label="Comment settings"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((open) => !open)}
        >
          •••
        </button>
        {settingsOpen && data && (
          <div className="boardy-comment-settings">
            <button
              type="button"
              onClick={() => {
                const ownerWindow = rootRef.current?.ownerDocument.defaultView;
                ownerWindow?.dispatchEvent(
                  new ownerWindow.CustomEvent(COMMENT_SIDEBAR_CLOSE_EVENT),
                );
                setSettingsOpen(false);
              }}
            >
              Hide comments <kbd>⇧C</kbd>
            </button>
            <fieldset>
              <legend>Comment notifications</legend>
              {(
                [
                  ["everything", "Everything"],
                  ["mentions_replies", "Just mentions and replies"],
                  ["nothing", "Nothing"],
                ] as const
              ).map(([mode, label]) => (
                <label key={mode}>
                  <input
                    type="radio"
                    name="comment-notifications"
                    checked={data.notificationPreference === mode}
                    onChange={async () => {
                      await setCommentPreference(sceneId, mode);
                      setData((current) =>
                        current
                          ? { ...current, notificationPreference: mode }
                          : current,
                      );
                    }}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              onClick={async () => {
                await markAllCommentsRead(sceneId);
                setSettingsOpen(false);
                emitChanged(rootRef.current);
                await refresh();
              }}
            >
              Mark all as read
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="boardy-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="boardy-comments-list">
        {threads.map((thread) => {
          const first = thread.messages[0];
          return (
            <button
              type="button"
              className={`boardy-comment-card${
                thread.unread ? " is-unread" : ""
              }`}
              key={thread.id}
              onClick={async () => {
                setSelectedId(thread.id);
                const ownerWindow = rootRef.current?.ownerDocument.defaultView;
                if (ownerWindow) {
                  const url = new ownerWindow.URL(ownerWindow.location.href);
                  url.searchParams.set("comment", thread.id);
                  ownerWindow.history.replaceState(
                    ownerWindow.history.state,
                    "",
                    url,
                  );
                }
                await setThreadUnread(thread.id, false);
                await refresh();
              }}
            >
              <span className="boardy-comment-card__top">
                <span className="boardy-comment-avatar">
                  {first?.author.avatarUrl ? (
                    <img src={first.author.avatarUrl} alt="" />
                  ) : (
                    first?.author.displayName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <strong>
                  #{thread.thread_number} ·{" "}
                  {thread.anchor_kind === "general" ? "General" : "Whiteboard"}
                </strong>
                {thread.unread && <i aria-label="Unread" />}
              </span>
              <span>
                {first?.author.displayName} ·{" "}
                {new Date(thread.last_activity_at).toLocaleString()}
              </span>
              <span className="boardy-comment-card__body">
                {first?.body || "Image"}
              </span>
              {(thread.messages.length > 1 || first?.attachment) && (
                <span className="boardy-comment-card__meta">
                  {thread.messages.length > 1
                    ? `${thread.messages.length - 1} ${
                        thread.messages.length === 2 ? "reply" : "replies"
                      }`
                    : ""}
                  {thread.messages.length > 1 && first?.attachment ? " · " : ""}
                  {first?.attachment ? "1 image" : ""}
                </span>
              )}
            </button>
          );
        })}
        {data && !threads.length && (
          <p className="boardy-comments-empty">No comments in this view.</p>
        )}
      </div>
    </aside>
  );
};
