import {
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import { useCallback, useEffect, useRef, useState } from "react";

import { createComment, loadComments } from "./api";
import {
  COMMENT_PLACEMENT_EVENT,
  COMMENTS_CHANGED_EVENT,
} from "./commentEvents";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { CommentPlacementDetail } from "./commentEvents";
import type { CommentThread } from "./types";

const sceneIdFromPath = (pathname: string) =>
  pathname.match(/^\/app\/boards\/([0-9a-f-]{36})$/i)?.[1] || null;

export const BoardCommentPins = ({ api }: { api: ExcalidrawImperativeAPI }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const placement = useRef<CommentPlacementDetail | null>(null);
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [revision, setRevision] = useState(0);
  const ownerWindow = rootRef.current?.ownerDocument.defaultView;
  const sceneId = ownerWindow
    ? sceneIdFromPath(ownerWindow.location.pathname)
    : null;
  const refresh = useCallback(async () => {
    if (!sceneId) return;
    const result = await loadComments(sceneId).catch(() => null);
    if (result) setThreads(result.threads);
  }, [sceneId]);

  useEffect(() => void refresh(), [refresh]);
  useEffect(() => {
    const win = rootRef.current?.ownerDocument.defaultView;
    if (!win || !sceneId) return;
    const place = (event: Event) => {
      placement.current = (event as CustomEvent<CommentPlacementDetail>).detail;
      rootRef.current?.classList.add("is-placing");
      api.setToast({ message: "Click the canvas to place your comment pin." });
    };
    const changed = () => void refresh();
    win.addEventListener(COMMENT_PLACEMENT_EVENT, place);
    win.addEventListener(COMMENTS_CHANGED_EVENT, changed);
    const unsubscribeScroll = api.onScrollChange(() =>
      setRevision((value) => value + 1),
    );
    const unsubscribeChange = api.onChange(() =>
      setRevision((value) => value + 1),
    );
    return () => {
      win.removeEventListener(COMMENT_PLACEMENT_EVENT, place);
      win.removeEventListener(COMMENTS_CHANGED_EVENT, changed);
      unsubscribeScroll();
      unsubscribeChange();
    };
  }, [api, refresh, sceneId]);

  if (!sceneId) return null;
  const appState = api.getAppState();
  return (
    <div
      className="boardy-comment-pins"
      ref={rootRef}
      data-revision={revision}
      onPointerDown={async (event) => {
        if (!placement.current || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const anchor = viewportCoordsToSceneCoords(
          { clientX: event.clientX, clientY: event.clientY },
          api.getAppState(),
        );
        const pending = placement.current;
        placement.current = null;
        rootRef.current?.classList.remove("is-placing");
        await createComment(
          sceneId,
          pending.message,
          pending.anchorKind,
          anchor,
          pending.mentionUserIds,
        );
        rootRef.current?.ownerDocument.defaultView?.dispatchEvent(
          new CustomEvent(COMMENTS_CHANGED_EVENT),
        );
        await refresh();
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
          return (
            <button
              key={thread.id}
              type="button"
              className="boardy-comment-pin"
              style={{ left: position.x, top: position.y }}
              title={thread.messages[0]?.body || "Comment"}
              onClick={() =>
                rootRef.current?.ownerDocument
                  .getElementById(`comment-${thread.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            >
              {thread.thread_number}
            </button>
          );
        })}
    </div>
  );
};
