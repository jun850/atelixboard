export type WorkspaceRole = "admin" | "staff" | "external";
export type ResourceRole = "owner" | "editor" | "commenter" | "viewer";

export type BoardyProfile = {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
};

export type WorkspaceMember = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  status: "active" | "removed";
  joined_at: string;
  profile: BoardyProfile;
};

export type WorkspaceCollection = {
  id: string;
  workspace_id: string;
  owner_id: string;
  name: string;
  visibility: "private" | "workspace" | "selected";
  status: "active" | "deleted";
  created_at: string;
  updated_at: string;
};

export type WhiteboardSummary = {
  id: string;
  owner_id: string;
  title: string;
  status: "active" | "deleted";
  current_revision_number: number;
  thumbnail_asset_id: string | null;
  workspace_id: string;
  collection_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type WorkspaceDashboard = {
  workspace: {
    id: string;
    name: string;
    slug: string;
    subscription_status: "active" | "grace" | "expired";
  };
  membership: WorkspaceMember;
  members: WorkspaceMember[];
  collections: WorkspaceCollection[];
  whiteboards: WhiteboardSummary[];
  profile: BoardyProfile;
};

export type CommentCapabilities = {
  role: ResourceRole;
  can_edit: boolean;
  can_comment: boolean;
  can_manage: boolean;
};

export type CommentMessage = {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  author: BoardyProfile;
  mentions?: Array<{
    profile: BoardyProfile;
    displayText: string;
  }>;
  attachment?: {
    id: string;
    name: string;
    mediaType: string;
    byteSize: number;
    status: string;
    url: string | null;
  } | null;
  reactions?: Array<{ emoji: string; count: number; reacted: boolean }>;
};

export type CommentAnchor = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  elementId?: string;
};

export type CommentThread = {
  id: string;
  scene_id: string;
  thread_number: number;
  created_by: string;
  anchor_kind: "point" | "region" | "element" | "general";
  anchor: CommentAnchor;
  version: number;
  resolved_at: string | null;
  last_activity_at: string;
  created_at: string;
  messages: CommentMessage[];
  unread: boolean;
};

export type CommentsResponse = {
  capabilities: CommentCapabilities;
  notificationPreference: CommentNotificationPreference;
  threads: CommentThread[];
};

export type CommentNotificationPreference =
  | "everything"
  | "mentions_replies"
  | "nothing";

export type CommentMention = {
  userId: string;
  displayText: string;
};
