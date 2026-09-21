import { cloudApi } from "../agentic-board/client";
import { requireSupabase } from "../supabase/client";

import type {
  CommentsResponse,
  CommentMention,
  CommentNotificationPreference,
  WorkspaceCollection,
  WorkspaceDashboard,
} from "./types";

export const workspaceApi = <T>(
  path: string,
  method = "GET",
  body?: Record<string, unknown>,
) => cloudApi<T>("workspace", path, method, body);

export type InvitationEmailDelivery = {
  status: "not_requested" | "sent" | "failed" | "suppressed";
  retryable: boolean;
};

export type InvitationResponse = {
  invitation: {
    id: string;
    expires_at: string;
    max_uses: number;
    email_status: string | null;
  };
  token: string;
  emailDelivery: InvitationEmailDelivery;
};

export const retryInvitationEmail = (
  workspaceId: string,
  invitationId: string,
  token: string,
) =>
  workspaceApi<{ emailDelivery: InvitationEmailDelivery }>(
    `invitations/${invitationId}/email`,
    "POST",
    { workspaceId, token },
  );

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
  mentions: CommentMention[] = [],
  attachmentAssetId?: string,
) =>
  workspaceApi(`comments/${sceneId}`, "POST", {
    message,
    anchorKind,
    anchor,
    mentions,
    ...(attachmentAssetId ? { attachmentAssetId } : {}),
  });

export const replyToThread = (
  threadId: string,
  message: string,
  mentions: CommentMention[] = [],
  attachmentAssetId?: string,
) =>
  workspaceApi(`comments/threads/${threadId}`, "POST", {
    message,
    mentions,
    ...(attachmentAssetId ? { attachmentAssetId } : {}),
  });

export const updateThread = (
  threadId: string,
  action: "resolve" | "reopen" | "delete",
  version: number,
) => workspaceApi(`comments/threads/${threadId}`, "PATCH", { action, version });

export const reactToMessage = (messageId: string, emoji: string) =>
  workspaceApi(`comments/messages/${messageId}/reactions`, "POST", { emoji });

export const setCommentPreference = (
  sceneId: string,
  mode: CommentNotificationPreference,
) => workspaceApi(`comments/${sceneId}/preference`, "PUT", { mode });

export const markAllCommentsRead = (sceneId: string) =>
  workspaceApi(`comments/${sceneId}/read`, "POST");

export const setThreadUnread = (threadId: string, unread: boolean) =>
  workspaceApi(`comments/threads/${threadId}/read`, "POST", { unread });

export const uploadCommentImage = async (sceneId: string, file: File) => {
  if (
    file.size < 1 ||
    file.size > 5 * 1024 * 1024 ||
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)
  ) {
    throw new Error("Choose a PNG, JPEG, WebP, or GIF up to 5 MB.");
  }
  const intent = await cloudApi<{
    assetId: string;
    storagePath: string;
    token: string;
  }>("scene-assets", "assets/intent", "POST", {
    sceneId,
    fileName: file.name,
    mediaType: file.type,
    byteSize: file.size,
  });
  const { error } = await requireSupabase()
    .storage.from("scene-staging")
    .uploadToSignedUrl(intent.storagePath, intent.token, file, {
      contentType: file.type,
    });
  if (error) {
    throw error;
  }
  await cloudApi("scene-assets", `assets/${intent.assetId}/finalize`, "POST");
  return intent.assetId;
};
