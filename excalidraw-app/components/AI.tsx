import { useRef } from "react";

import { DiagramToCodePlugin, TTDDialog } from "@excalidraw/excalidraw";
import { randomId } from "@excalidraw/common";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { resolveActiveAssistantConnection } from "../agentic-board/active-connection";
import { localApi } from "../agentic-board/client";
import { validateResult } from "../agentic-board/protocol";
import { TTDIndexedDBAdapter } from "../data/TTDStorage";

import type { Content } from "../agentic-board/catalog";
import type { GenerateRequest } from "../agentic-board/protocol";

const safeMermaidLabel = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");

const contentToMermaid = (content: Content) => {
  const lines = ["flowchart TD"];
  content.sections.forEach((section, index) => {
    const details = section.items.filter(Boolean).join("<br/>");
    const label = safeMermaidLabel(
      details ? `${section.heading}<br/>${details}` : section.heading,
    );
    lines.push(`  step${index}["${label}"]`);
    if (index > 0) {
      lines.push(`  step${index - 1} --> step${index}`);
    }
  });
  return lines.join("\n");
};

const contextElement = (element: {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
}) => ({
  type: element.type,
  ...(typeof element.text === "string" ? { text: element.text } : {}),
  x: element.x,
  y: element.y,
  width: element.width,
  height: element.height,
});

export const AIComponents = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  const mountedNode = useRef<HTMLSpanElement>(null);
  const getOwnerWindow = () => {
    const ownerWindow = mountedNode.current?.ownerDocument.defaultView;
    if (!ownerWindow) {
      throw new Error("Boardy is not mounted.");
    }
    return ownerWindow;
  };

  return (
    <>
      <span ref={mountedNode} hidden />
      <DiagramToCodePlugin
        generate={async ({ frame, children }) => {
          const ownerWindow = getOwnerWindow();
          const { connection, model } = await resolveActiveAssistantConnection(
            ownerWindow,
          );
          const request: GenerateRequest = {
            requestId: randomId() + randomId(),
            connectionId: connection.id,
            model: model.id,
            task: "ui",
            templateId: "flowchart",
            prompt:
              "Convert this selected wireframe into a polished, responsive interface. Preserve its information hierarchy, visible labels, and intended interactions.",
            allowUnknown: model.compatible === null,
            context: {
              mode: "selection",
              elements: [frame, ...children].map(contextElement),
            },
          };
          const response = await localApi<{ result: unknown }>(
            ownerWindow,
            "generate",
            "POST",
            request,
          );
          const result = validateResult(response.result, request);
          if (!("html" in result)) {
            throw new Error(
              "The selected model did not return interface code.",
            );
          }
          return result;
        }}
      />

      <TTDDialog
        onTextSubmit={async ({
          messages,
          onChunk,
          onStreamCreated,
          signal,
        }) => {
          const ownerWindow = getOwnerWindow();
          const { connection, model, reasoningEffort } =
            await resolveActiveAssistantConnection(ownerWindow, "economy");
          const prompt = messages
            .slice(-4)
            .map((message) => `${message.role}: ${message.content}`)
            .join("\n")
            .slice(0, 16000);
          const request: GenerateRequest = {
            requestId: randomId() + randomId(),
            connectionId: connection.id,
            model: model.id,
            task: "board",
            templateId: "flowchart",
            prompt,
            allowUnknown: model.compatible === null,
            reasoningEffort,
            context: { mode: "prompt_only", elements: [] },
          };
          onStreamCreated?.();
          const response = await localApi<{ result: unknown }>(
            ownerWindow,
            "generate",
            "POST",
            request,
            signal,
          );
          const result = validateResult(response.result, request);
          if ("html" in result) {
            throw new Error("The selected model did not return a diagram.");
          }
          const generatedResponse = contentToMermaid(result);
          onChunk?.(generatedResponse);
          return { generatedResponse, error: null };
        }}
        persistenceAdapter={TTDIndexedDBAdapter}
      />
    </>
  );
};
