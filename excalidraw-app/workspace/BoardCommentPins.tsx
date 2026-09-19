import {
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import { useCallback, useContext, useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { requireSupabase } from "../supabase/client";

import { createComment, loadComments } from "./api";
import { CommentComposer } from "./CommentComposer";
import {
  COMMENTS_CHANGED_EVENT,
  COMMENT_SIDEBAR_CLOSE_EVENT,
  COMMENT_THREAD_SELECT_EVENT,
} from "./commentEvents";
import { WorkspaceCommentsContext } from "./WorkspaceCommentsContext";

import type { CommentThread } from "./types";

const sceneIdFromPath = (pathname: string) =>
  pathname.match(/^\/app\/boards\/([0-9a-f-]{36})$/i)?.[1] || null;

export const BoardCommentPins = ({ api }: { api: ExcalidrawImperativeAPI }) => {
  const workspace = useContext(WorkspaceCommentsContext);
  const rootRef = useRef<HTMLDivElement>(null);
  const refreshTimer = useRef<number | null>(null);
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [revision, setRevision] = useState(0);
  const [active, setActive] = useState(false);
  const [draft, setDraft] = useState<{
    sceneX: number;
    sceneY: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const sceneId =
    workspace?.sceneId ||
    (rootRef.current?.ownerDocument.defaultView
      ? sceneIdFromPath(
          rootRef.current.ownerDocument.defaultView.location.pathname,
        )
      : null);

  const refresh = useCallback(async () => {
    if (!sceneId) {
      return;
    }
    const result = await loadComments(sceneId).catch(() => null);
    if (result) {
      setThreads(result.threads);
      if (
        !result.capabilities.can_comment &&
        api.getAppState().activeTool.type === "custom"
      ) {
        api.setActiveTool({ type: "selection" });
      }
    }
  }, [api, sceneId]);

  useEffect(() => void refresh(), [refresh]);
  useEffect(() => {
    const win = rootRef.current?.ownerDocument.defaultView;
    if (!win || !sceneId) {
      return;
    }
    const changed = () => void refresh();
    const closeSidebar = () =>
      api.toggleSidebar({ name: "default", force: false });
    win.addEventListener(COMMENTS_CHANGED_EVENT, changed);
    win.addEventListener(COMMENT_SIDEBAR_CLOSE_EVENT, closeSidebar);
    const unsubscribeScroll = api.onScrollChange(() =>
      setRevision((value) => value + 1),
    );
    const unsubscribeChange = api.onChange((_elements, appState) => {
      const nextActive =
        appState.activeTool.type === "custom" &&
        appState.activeTool.customType === "comment";
      setActive(nextActive);
      if (!nextActive) {
        setDraft(null);
      }
      setRevision((value) => value + 1);
    });
    let channel: ReturnType<
      ReturnType<typeof requireSupabase>["channel"]
    > | null = null;
    void (async () => {
      const client = requireSupabase();
      const { data } = await client.auth.getSession();
      if (!data.session) {
        return;
      }
      await client.realtime.setAuth(data.session.access_token);
      channel = client
        .channel(`board:${sceneId}:comments`, { config: { private: true } })
        .on("broadcast", { event: "comments-changed" }, () => {
          if (refreshTimer.current !== null) {
            win.clearTimeout(refreshTimer.current);
          }
          refreshTimer.current = win.setTimeout(() => void refresh(), 120);
        })
        .subscribe();
    })();
    return () => {
      win.removeEventListener(COMMENTS_CHANGED_EVENT, changed);
      win.removeEventListener(COMMENT_SIDEBAR_CLOSE_EVENT, closeSidebar);
      unsubscribeScroll();
      unsubscribeChange();
      if (refreshTimer.current !== null) {
        win.clearTimeout(refreshTimer.current);
      }
      if (channel) {
        void requireSupabase().removeChannel(channel);
      }
    };
  }, [api, refresh, sceneId]);

  if (!sceneId) {
    return null;
  }
  const appState = api.getAppState();
  const ownerWindow = rootRef.current?.ownerDocument.defaultView;
  const draftWidth = Math.min(410, (ownerWindow?.innerWidth || 442) - 32);
  const draftLeft = draft
    ? Math.max(
        16,
        Math.min(
          draft.clientX + 14,
          (ownerWindow?.innerWidth || 1024) - draftWidth - 16,
        ),
      )
    : 0;
  const draftTop = draft
    ? Math.max(
        16,
        Math.min(draft.clientY + 14, (ownerWindow?.innerHeight || 768) - 230),
      )
    : 0;
  return (
    <div
      className={`boardy-comment-pins${active ? " is-placing" : ""}`}
      ref={rootRef}
      data-revision={revision}
      onPointerDown={(event) => {
        if (!active || draft || event.button !== 0) {
          return;
        }
        const target = event.target as HTMLElement;
        if (target.closest("button, textarea, input, .boardy-comment-draft")) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const anchor = viewportCoordsToSceneCoords(
          { clientX: event.clientX, clientY: event.clientY },
          api.getAppState(),
        );
        setDraft({
          sceneX: anchor.x,
          sceneY: anchor.y,
          clientX: event.clientX,
          clientY: event.clientY,
        });
      }}
    >
      {threads
        .filter(
          (thread) =>
            !thread.resolved_at &&
            thread.anchor_kind !== "general" &&
            typeof thread.anchor.x === "number" &&
            typeof thread.anchor.y === "number",
        )
        .map((thread) => {
          const position = sceneCoordsToViewportCoords(
            { sceneX: thread.anchor.x!, sceneY: thread.anchor.y! },
            appState,
          );
          const author = thread.messages[0]?.author;
          return (
            <button
              key={thread.id}
              type="button"
              className={`boardy-comment-pin${
                thread.unread ? " is-unread" : ""
              }`}
              style={{ left: position.x, top: position.y }}
              title={thread.messages[0]?.body || "Comment"}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                const ownerWindow = rootRef.current?.ownerDocument.defaultView;
                if (!ownerWindow) {
                  return;
                }
                const url = new ownerWindow.URL(ownerWindow.location.href);
                url.searchParams.set("comment", thread.id);
                ownerWindow.history.replaceState(
                  ownerWindow.history.state,
                  "",
                  url,
                );
                api.toggleSidebar({
                  name: "default",
                  tab: "boardy-comments",
                  force: true,
                });
                ownerWindow.dispatchEvent(
                  new ownerWindow.CustomEvent(COMMENT_THREAD_SELECT_EVENT, {
                    detail: { threadId: thread.id },
                  }),
                );
              }}
            >
              {author?.avatarUrl ? (
                <img src={author.avatarUrl} alt="" />
              ) : (
                author?.displayName.slice(0, 1).toUpperCase() || "C"
              )}
            </button>
          );
        })}
      {draft && (
        <div
          className="boardy-comment-draft"
          style={{ left: draftLeft, top: draftTop, width: draftWidth }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span
            className="boardy-comment-draft__pin"
            style={{
              left: draft.clientX - draftLeft,
              top: draft.clientY - draftTop,
            }}
            aria-hidden="true"
          />
          <CommentComposer
            sceneId={sceneId}
            members={workspace?.members || []}
            placeholder="Add a comment"
            autoFocus
            onSubmit={async (message, mentions, attachmentAssetId) => {
              await createComment(
                sceneId,
                message,
                "point",
                { x: draft.sceneX, y: draft.sceneY },
                mentions,
                attachmentAssetId,
              );
              setDraft(null);
              api.setActiveTool({ type: "selection" });
              const ownerWindow = rootRef.current?.ownerDocument.defaultView;
              ownerWindow?.dispatchEvent(
                new ownerWindow.CustomEvent(COMMENTS_CHANGED_EVENT),
              );
              await refresh();
            }}
          />
        </div>
      )}
    </div>
  );
};
