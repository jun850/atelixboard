import { templates, validateContent } from "./catalog";

import type { Content } from "./catalog";
export type Subscription = "codex" | "claude-code";
export type Provider = "openai" | "anthropic";
export type Model = {
  id: string;
  name: string;
  compatible: boolean | null;
  outputLimit: number | null;
  isDefault?: boolean;
  reasoningEfforts?: string[];
};
export type ConnectionAccount = {
  label: string;
  authMode: "subscription" | "api_key";
  plan?: string;
};
export type Connection = {
  id: string;
  provider: Provider;
  suffix: string;
  subscription?: Subscription;
  login?: { url?: string; pending: boolean };
  account?: ConnectionAccount;
  defaultModel?: string;
  models: Model[];
};
export type AssistantPreferences = {
  defaultConnectionId: string;
  defaultModel: string;
  defaultTask: "board" | "ui";
  defaultContext: "prompt_only" | "selection";
  persistLocalHistory: boolean;
};
export const defaultAssistantPreferences: AssistantPreferences = {
  defaultConnectionId: "",
  defaultModel: "",
  defaultTask: "board",
  defaultContext: "prompt_only",
  persistLocalHistory: false,
};
export type GenerateRequest = {
  requestId: string;
  connectionId: string;
  model: string;
  task: "board" | "ui";
  templateId: string;
  prompt: string;
  context: {
    mode: "prompt_only" | "selection" | "whole_board";
    elements: {
      type: string;
      text?: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[];
  };
  previous?: Content | { html: string };
  allowUnknown: boolean;
  reasoningEffort?: string;
  sceneId?: string;
};
export function validateRequest(value: unknown): GenerateRequest {
  const v = value as GenerateRequest;
  if (
    !v ||
    typeof v.requestId !== "string" ||
    !/^[\w-]{16,80}$/.test(v.requestId) ||
    typeof v.connectionId !== "string" ||
    typeof v.model !== "string" ||
    v.model.length > 200 ||
    !["board", "ui"].includes(v.task) ||
    !templates.some((t) => t.id === v.templateId) ||
    typeof v.prompt !== "string" ||
    !v.prompt.trim() ||
    [...v.prompt].length > 16000 ||
    !v.context ||
    !["prompt_only", "selection", "whole_board"].includes(v.context.mode) ||
    !Array.isArray(v.context.elements) ||
    v.context.elements.length > 300 ||
    (v.context.mode === "prompt_only" && v.context.elements.length > 0) ||
    new TextEncoder().encode(JSON.stringify([v.context, v.previous])).length >
      256 * 1024
  ) {
    throw new Error("LIMIT_EXCEEDED");
  }
  // Only documented, disclosed content can reach the provider.
  return {
    requestId: v.requestId,
    connectionId: v.connectionId,
    model: v.model,
    task: v.task,
    templateId: v.templateId,
    prompt: v.prompt,
    context: {
      mode: v.context.mode,
      elements: v.context.elements.map((e) => {
        if (
          !e ||
          typeof e.type !== "string" ||
          ![e.x, e.y, e.width, e.height].every(Number.isFinite) ||
          (e.text !== undefined && typeof e.text !== "string")
        ) {
          throw new Error("INVALID_OUTPUT");
        }
        return {
          type: e.type,
          ...(e.text ? { text: e.text } : {}),
          x: e.x,
          y: e.y,
          width: e.width,
          height: e.height,
        };
      }),
    },
    previous: v.previous,
    allowUnknown: v.allowUnknown === true,
    ...(typeof v.reasoningEffort === "string" &&
    ["none", "minimal", "low"].includes(v.reasoningEffort)
      ? { reasoningEffort: v.reasoningEffort }
      : {}),
    ...(typeof v.sceneId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v.sceneId,
    )
      ? { sceneId: v.sceneId }
      : {}),
  };
}
export function validateResult(
  value: unknown,
  request: GenerateRequest,
): Content | { html: string } {
  if (request.task === "board") {
    return validateContent(
      value,
      templates.find((t) => t.id === request.templateId)!,
    );
  }
  const html = (value as { html: string })?.html;
  if (
    typeof html !== "string" ||
    !/<html[\s>]/i.test(html) ||
    !/<\/html\s*>/i.test(html) ||
    new TextEncoder().encode(html).length > 256 * 1024
  ) {
    throw new Error("INVALID_OUTPUT");
  }
  return { html };
}
