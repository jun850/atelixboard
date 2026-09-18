import { cloudApi } from "../agentic-board/client";

import type {
  CommentsResponse,
  WorkspaceCollection,
  WorkspaceDashboard,
} from "./types";

export const workspaceApi = <T>(
  path: string,
  method = "GET",
  body?: Record<string, unknown>,
) => cloudApi<T>("workspace", path, method, body);

export const loadWorkspace = (workspaceId?: string) =>
  workspaceApi<WorkspaceDashboard>("dashboard", "GET", {
    ...(workspaceId ? { workspaceId } : {}),
  });

export const createCollection = (
  workspaceId: string,
  name: string,
  visibility: WorkspaceCollection["visibility"],
) =>
  workspaceApi<{ collection: WorkspaceCollection }>("collections", "POST", {
    workspaceId,
    name,
    visibility,
  });

export const loadComments = (sceneId: string) =>
  workspaceApi<CommentsResponse>(`comments/${sceneId}`);

export const createComment = (
  sceneId: string,
  message: string,
  anchorKind: "point" | "region" | "element" | "general",
  anchor: Record<string, unknown>,
) =>
  workspaceApi(`comments/${sceneId}`, "POST", {
    message,
    anchorKind,
    anchor,
  });

export const replyToThread = (threadId: string, message: string) =>
  workspaceApi(`comments/threads/${threadId}`, "POST", {
    message,
  });

export const updateThread = (
  threadId: string,
  action: "resolve" | "reopen" | "delete",
  version: number,
) => workspaceApi(`comments/threads/${threadId}`, "PATCH", { action, version });

export const reactToMessage = (messageId: string, emoji: string) =>
  workspaceApi(`comments/messages/${messageId}/reactions`, "POST", { emoji });
