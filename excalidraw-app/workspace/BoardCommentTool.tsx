import { useEffect, useRef } from "react";

import { IconButton } from "@excalidraw/excalidraw/components/IconButton";
import { messageCircleIcon } from "@excalidraw/excalidraw/components/icons";

import type {
  ExcalidrawImperativeAPI,
  UIAppState,
} from "@excalidraw/excalidraw/types";

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
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        (target instanceof ownerWindow.HTMLElement &&
          target.matches("input, textarea, select, [contenteditable='true']"))
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
    <IconButton
      ref={buttonRef}
      type="toggle"
      icon={messageCircleIcon}
      checked={selected}
      aria-label="Comment"
      aria-keyshortcuts="C"
      data-testid="toolbar-comment"
      title="Comment — C"
      keyBindingLabel="C"
      onSelect={() =>
        api.setActiveTool(
          selected
            ? { type: "selection" }
            : { type: "custom", customType: "comment" },
        )
      }
    />
  );
};
