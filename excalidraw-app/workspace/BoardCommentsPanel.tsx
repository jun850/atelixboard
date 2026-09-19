import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createComment,
  loadComments,
  reactToMessage,
  replyToThread,
  updateThread,
} from "./api";
import {
  COMMENT_PLACEMENT_EVENT,
  COMMENTS_CHANGED_EVENT,
} from "./commentEvents";
import { UserIdentity } from "./WorkspaceApp";

import type { FormEvent } from "react";
import type { CommentThread, CommentsResponse, WorkspaceMember } from "./types";

const MentionPicker = ({
  members,
  onMention,
}: {
  members: WorkspaceMember[];
  onMention: (member: WorkspaceMember) => void;
}) => (
  <div className="boardy-mention-picker" aria-label="Mention a teammate">
    <span>Mention</span>
    {members.slice(0, 8).map((member) => (
      <button
        key={member.user_id}
        type="button"
        onClick={() => onMention(member)}
        title={`${member.profile.displayName} (${member.profile.email})`}
      >
        {member.profile.avatarUrl ? (
          <img src={member.profile.avatarUrl} alt="" />
        ) : (
          <span>{member.profile.displayName.slice(0, 1).toUpperCase()}</span>
        )}
        <span className="boardy-mention-picker__identity">
          <strong>{member.profile.displayName}</strong>
          <small>{member.profile.email}</small>
        </span>
      </button>
    ))}
  </div>
);

const emitChanged = (ownerWindow: Window) =>
  ownerWindow.dispatchEvent(new CustomEvent(COMMENTS_CHANGED_EVENT));

const Thread = ({
  thread,
  ownerWindow,
  refresh,
  members,
}: {
  thread: CommentThread;
  ownerWindow: Window;
  refresh: () => Promise<void>;
  members: WorkspaceMember[];
}) => {
  const [reply, setReply] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const submitReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!reply.trim()) {
      return;
    }
    await replyToThread(thread.id, reply, mentionIds);
    setReply("");
    setMentionIds([]);
    emitChanged(ownerWindow);
    await refresh();
  };
  return (
    <article
      className={`boardy-comment-thread${
        thread.resolved_at ? " is-resolved" : ""
      }`}
      id={`comment-${thread.id}`}
    >
      <header>
        <span className="boardy-comment-number">{thread.thread_number}</span>
        <strong>
          {thread.anchor_kind === "general" ? "General" : "On canvas"}
        </strong>
        <button
          type="button"
          onClick={async () => {
            await updateThread(
              thread.id,
              thread.resolved_at ? "reopen" : "resolve",
              thread.version,
            );
            emitChanged(ownerWindow);
            await refresh();
          }}
        >
          {thread.resolved_at ? "Reopen" : "Resolve"}
        </button>
      </header>
      {thread.messages.map((message) => (
        <div className="boardy-comment-message" key={message.id}>
          <UserIdentity profile={message.author} compact />
          <p>{message.deleted_at ? "Comment deleted" : message.body}</p>
          {!message.deleted_at && (
            <button
              className="boardy-reaction"
              type="button"
              aria-label="React with thumbs up"
              onClick={async () => {
                await reactToMessage(message.id, "👍");
                emitChanged(ownerWindow);
                await refresh();
              }}
            >
              👍{" "}
              {message.reactions?.find((item) => item.emoji === "👍")?.count ||
                ""}
            </button>
          )}
        </div>
      ))}
      {!thread.resolved_at && (
        <form
          className="boardy-comment-reply"
          onSubmit={(event) => void submitReply(event)}
        >
          <label>
            <span className="sr-only">
              Reply to comment {thread.thread_number}
            </span>
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Reply or @mention a teammate"
              rows={2}
            />
          </label>
          <MentionPicker
            members={members}
            onMention={(member) => {
              setReply(
                (value) =>
                  `${value}${value && !value.endsWith(" ") ? " " : ""}@${
                    member.profile.displayName
                  } `,
              );
              setMentionIds((value) => [
                ...new Set([...value, member.user_id]),
              ]);
            }}
          />
          <button
            className="boardy-button is-primary"
            type="submit"
            disabled={!reply.trim()}
          >
            Reply
          </button>
        </form>
      )}
    </article>
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
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [error, setError] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
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
    const listener = () => void refresh();
    ownerWindow.addEventListener(COMMENTS_CHANGED_EVENT, listener);
    return () =>
      ownerWindow.removeEventListener(COMMENTS_CHANGED_EVENT, listener);
  }, [refresh]);
  const threads = useMemo(
    () =>
      (data?.threads || []).filter(
        (thread) =>
          (showResolved || !thread.resolved_at) &&
          (!query ||
            thread.messages.some((item) =>
              item.body.toLowerCase().includes(query.toLowerCase()),
            )),
      ),
    [data, query, showResolved],
  );
  const addGeneral = async () => {
    if (!message.trim()) {
      return;
    }
    await createComment(sceneId, message, "general", {}, mentionIds);
    setMessage("");
    setMentionIds([]);
    const ownerWindow = rootRef.current?.ownerDocument.defaultView;
    if (ownerWindow) {
      emitChanged(ownerWindow);
    }
    await refresh();
  };
  const startPlacement = (anchorKind: "point" | "region") => {
    const ownerWindow = rootRef.current?.ownerDocument.defaultView;
    if (!ownerWindow || !message.trim()) {
      return;
    }
    ownerWindow.dispatchEvent(
      new CustomEvent(COMMENT_PLACEMENT_EVENT, {
        detail: {
          message: message.trim(),
          anchorKind,
          mentionUserIds: mentionIds,
        },
      }),
    );
    setMessage("");
    setMentionIds([]);
  };
  return (
    <aside
      className={`boardy-comments-panel${embedded ? " is-embedded" : ""}`}
      aria-label="Comments"
      ref={rootRef}
    >
      {!embedded && (
        <header>
          <h2>Comments</h2>
          <button type="button" aria-label="Close comments" onClick={onClose}>
            ×
          </button>
        </header>
      )}
      <div className="boardy-comment-compose">
        <label>
          <span className="sr-only">New comment</span>
          <textarea
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Add feedback or @mention a teammate"
          />
        </label>
        <MentionPicker
          members={members}
          onMention={(member) => {
            setMessage(
              (value) =>
                `${value}${value && !value.endsWith(" ") ? " " : ""}@${
                  member.profile.displayName
                } `,
            );
            setMentionIds((value) => [...new Set([...value, member.user_id])]);
          }}
        />
        <div>
          <button
            type="button"
            onClick={() => void addGeneral()}
            disabled={!message.trim()}
          >
            General
          </button>
          <button
            className="is-primary"
            type="button"
            onClick={() => startPlacement("point")}
            disabled={!message.trim()}
          >
            Pin to canvas
          </button>
          <button
            type="button"
            onClick={() => startPlacement("region")}
            disabled={!message.trim()}
          >
            Mark area
          </button>
        </div>
        <small>Place a pin with one click, or drag to mark an area.</small>
      </div>
      <div className="boardy-comments-tools">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search comments"
          aria-label="Search comments"
        />
        <label>
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(event) => setShowResolved(event.target.checked)}
          />
          Resolved
        </label>
      </div>
      {error && (
        <p className="boardy-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="boardy-comments-list">
        {threads.map((thread) => {
          const ownerWindow = rootRef.current?.ownerDocument.defaultView;
          return ownerWindow ? (
            <Thread
              key={thread.id}
              thread={thread}
              ownerWindow={ownerWindow}
              refresh={refresh}
              members={members}
            />
          ) : null;
        })}
        {data && !threads.length && (
          <p className="boardy-comments-empty">No comments in this view.</p>
        )}
      </div>
    </aside>
  );
};
