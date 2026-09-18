import { useEffect, useRef, useState } from "react";
import { exportToSvg, getNonDeletedElements } from "@excalidraw/excalidraw";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
export function ScenePreview({
  elements,
  files = {},
  title,
  variant = "default",
}: {
  elements: readonly ExcalidrawElement[];
  files?: BinaryFiles;
  title: string;
  variant?: "default" | "card";
}) {
  const node = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    exportToSvg({
      elements: getNonDeletedElements(elements),
      appState: {
        exportBackground: true,
        viewBackgroundColor: variant === "card" ? "#f2f6ff" : "#ffffff",
      },
      files,
      exportPadding: 30,
    })
      .then((svg) => {
        if (!active || !node.current) {
          return;
        }
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.setAttribute("aria-hidden", "true");
        node.current.replaceChildren(
          node.current.ownerDocument.importNode(svg, true),
        );
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [elements, files, variant]);
  return (
    <div
      className={`agentic-preview agentic-preview--${variant}`}
      role="img"
      aria-label={`${title} canvas preview`}
      ref={node}
    >
      {failed ? "Preview unavailable. Try another template." : null}
    </div>
  );
}
