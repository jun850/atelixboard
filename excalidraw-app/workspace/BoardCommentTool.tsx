import { useEffect, useRef } from "react";

import type {
  ExcalidrawImperativeAPI,
  UIAppState,
} from "@excalidraw/excalidraw/types";

const CommentIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5.5 18.5H4V12a8 8 0 1 1 8 8H7.5l-2 1.5v-3Z" />
  </svg>
);

export const BoardCommentTool = ({
  appState,
  api,
}: {
  appState: UIAppState;
  api: ExcalidrawImperativeAPI;
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selected =
    appState.activeTool.type === "custom" &&
    appState.activeTool.customType === "comment";

  useEffect(() => {
    const ownerDocument = buttonRef.current?.ownerDocument;
    const ownerWindow = ownerDocument?.defaultView;
    if (!ownerDocument || !ownerWindow) {
      return;
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target?.matches("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      if (event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        api.toggleSidebar({ name: "default", tab: "boardy-comments" });
        return;
      }
      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        api.setActiveTool({ type: "custom", customType: "comment" });
      }
    };
    ownerDocument.addEventListener("keydown", onKeyDown);
    return () => ownerDocument.removeEventListener("keydown", onKeyDown);
  }, [api]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`boardy-comment-tool${selected ? " is-selected" : ""}`}
      aria-label="Comment"
      aria-pressed={selected}
      title="Comment — C"
      onClick={() =>
        api.setActiveTool(
          selected
            ? { type: "selection" }
            : { type: "custom", customType: "comment" },
        )
      }
    >
      <CommentIcon />
      <span className="boardy-comment-tool__tooltip" role="tooltip">
        Comment <kbd>C</kbd>
      </span>
    </button>
  );
};
