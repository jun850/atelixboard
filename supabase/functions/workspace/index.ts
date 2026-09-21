import { authenticate, response } from "../_shared/agentic.ts";

import {
  cloudErrorResponse,
  decodeScene,
  requireUuid,
} from "../_shared/cloud.ts";

type AdminClient = Awaited<ReturnType<typeof authenticate>>["admin"];

declare const EdgeRuntime:
  | { waitUntil: (promise: Promise<unknown>) => void }
  | undefined;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "workspace";

const requestId = () => crypto.randomUUID().replaceAll("-", "");

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

type InvitationEmailStatus = "not_requested" | "sent" | "failed" | "suppressed";

type InvitationEmailDelivery = {
  status: InvitationEmailStatus;
  retryable: boolean;
};

type InvitationEmailRecord = {
  id: string;
  workspace_id: string;
  collection_id: string | null;
  scene_id: string | null;
  created_by: string;
  token_hash: string;
  recipient_email: string | null;
  resource_role: "editor" | "commenter" | "viewer" | null;
  expires_at: string;
  email_attempt_count: number;
};

const normalizeInvitationEmail = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("invalid_email");
  }
  const email = value.trim().toLowerCase();
  if (
    !email ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("invalid_email");
  }
  return email;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const persistInvitationDelivery = async (
  admin: AdminClient,
  invitationId: string,
  patch: Record<string, unknown>,
) => {
  const { error } = await admin
    .from("boardy_invitations")
    .update({ ...patch, email_last_error: patch.email_last_error ?? null })
    .eq("id", invitationId);
  if (error) {
    console.error("invitation delivery status update failed", {
      invitationId,
      message: error.message,
    });
  }
};

const sendInvitationEmail = async ({
  admin,
  invitation,
  token,
}: {
  admin: AdminClient;
  invitation: InvitationEmailRecord;
  token: string;
}): Promise<InvitationEmailDelivery> => {
  if (!invitation.recipient_email) {
    return { status: "not_requested", retryable: false };
  }

  const attemptCount = Math.min(invitation.email_attempt_count + 1, 12);
  await persistInvitationDelivery(admin, invitation.id, {
    email_status: "pending",
    email_attempt_count: attemptCount,
  });

  const { data: suppressed, error: suppressionError } = await admin
    .from("boardy_email_suppressions")
    .select("email")
    .eq("email", invitation.recipient_email)
    .maybeSingle();
  if (suppressionError) {
    await persistInvitationDelivery(admin, invitation.id, {
      email_status: "failed",
      email_attempt_count: attemptCount,
      email_last_error: "suppression_check_failed",
    });
    return { status: "failed", retryable: true };
  }
  if (suppressed) {
    await persistInvitationDelivery(admin, invitation.id, {
      email_status: "suppressed",
      email_attempt_count: attemptCount,
    });
    return { status: "suppressed", retryable: false };
  }

  const [{ data: inviter }, targetResult] = await Promise.all([
    admin
      .from("boardy_profiles")
      .select("display_name")
      .eq("user_id", invitation.created_by)
      .maybeSingle(),
    invitation.scene_id
      ? admin
          .from("scenes")
          .select("title")
          .eq("id", invitation.scene_id)
          .maybeSingle()
      : invitation.collection_id
      ? admin
          .from("boardy_collections")
          .select("name")
          .eq("id", invitation.collection_id)
          .maybeSingle()
      : admin
          .from("boardy_workspaces")
          .select("name")
          .eq("id", invitation.workspace_id)
          .maybeSingle(),
  ]);
  const target = targetResult.data as { title?: string; name?: string } | null;
  const inviterName = inviter?.display_name || "A teammate";
  const targetName = target?.title || target?.name || "a Boardy workspace";
  const targetKind = invitation.scene_id
    ? "whiteboard"
    : invitation.collection_id
    ? "collection"
    : "workspace";
  const permission = invitation.resource_role || "member";
  const appUrl = (
    Deno.env.get("BOARDY_APP_URL") || "https://boardy.sbs"
  ).replace(/\/$/, "");
  const invitationUrl = `${appUrl}/invite/${token}`;
  const expiresOn = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(invitation.expires_at));
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    await persistInvitationDelivery(admin, invitation.id, {
      email_status: "failed",
      email_attempt_count: attemptCount,
      email_last_error: "email_not_configured",
    });
    return { status: "failed", retryable: true };
  }

  try {
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${resendKey}`,
        "content-type": "application/json",
        "idempotency-key": `boardy-invite-${invitation.id}`,
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        from:
          Deno.env.get("BOARDY_INVITATION_FROM") ||
          "Boardy <notifications@atelix.app>",
        to: [invitation.recipient_email],
        subject: `${inviterName} invited you to ${targetName}`,
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#1d2533"><h2 style="font-size:20px">You’re invited to ${escapeHtml(
          targetName,
        )}</h2><p style="line-height:1.6;color:#4a5568">${escapeHtml(
          inviterName,
        )} invited you to this Boardy ${targetKind} as a ${escapeHtml(
          permission,
        )}.</p><p><a href="${escapeHtml(
          invitationUrl,
        )}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#2f6ce5;color:white;text-decoration:none">Open ${targetKind}</a></p><p style="line-height:1.6;color:#4a5568">Sign in or create a Boardy account with this email address. You do not need a separate subscription. This invitation expires ${escapeHtml(
          expiresOn,
        )}.</p></div>`,
      }),
    });
    const responseBody = (await result.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (result.ok) {
      await persistInvitationDelivery(admin, invitation.id, {
        email_status: "sent",
        email_attempt_count: attemptCount,
        email_sent_at: new Date().toISOString(),
        email_provider_message_id: String(responseBody.id || "") || null,
      });
      return { status: "sent", retryable: false };
    }
    await persistInvitationDelivery(admin, invitation.id, {
      email_status: "failed",
      email_attempt_count: attemptCount,
      email_last_error: String(
        responseBody.message || `HTTP ${result.status}`,
      ).slice(0, 500),
    });
    return { status: "failed", retryable: true };
  } catch (error) {
    await persistInvitationDelivery(admin, invitation.id, {
      email_status: "failed",
      email_attempt_count: attemptCount,
      email_last_error: (error instanceof Error
        ? error.message
        : "timeout"
      ).slice(0, 500),
    });
    return { status: "failed", retryable: true };
  }
};

const publicProfile = (row: Record<string, unknown>) => ({
  userId: row.user_id,
  displayName: row.display_name,
  email: row.email,
  avatarUrl: row.avatar_url || null,
});

const addAvatarUrls = async (
  admin: AdminClient,
  profiles: Record<string, unknown>[],
) => {
  const paths = profiles
    .map((profile) => profile.avatar_path)
    .filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    );
  if (!paths.length) {
    return profiles;
  }
  const { data } = await admin.storage
    .from("boardy-avatars")
    .createSignedUrls(paths, 3600);
  const urls = new Map(
    (data || []).map((item) => [item.path, item.signedUrl] as const),
  );
  return profiles.map((profile) => ({
    ...profile,
    avatar_url:
      typeof profile.avatar_path === "string"
        ? urls.get(profile.avatar_path) || null
        : null,
  }));
};

const ensureAccount = async (
  admin: AdminClient,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
) => {
  const email = user.email || "Unknown email";
  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";
  const fallbackName = email.split("@")[0] || "Boardy member";
  const { error: profileError } = await admin.from("boardy_profiles").upsert(
    {
      user_id: user.id,
      display_name: metadataName || fallbackName,
      email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id", ignoreDuplicates: true },
  );
  if (profileError) {
    throw profileError;
  }

  const { data: memberships, error: membershipError } = await admin
    .from("boardy_workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1);
  if (membershipError) {
    throw membershipError;
  }
  if (memberships?.length) {
    return memberships[0].workspace_id as string;
  }

  const base = `${slugify(metadataName || fallbackName)}-${user.id.slice(
    0,
    8,
  )}`;
  const { data: workspace, error: workspaceError } = await admin
    .from("boardy_workspaces")
    .upsert(
      {
        name: `${metadataName || fallbackName}'s workspace`,
        slug: base,
        sponsor_user_id: user.id,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (workspaceError) {
    throw workspaceError;
  }
  const workspaceId = workspace.id as string;
  const { error: memberError } = await admin
    .from("boardy_workspace_members")
    .upsert(
      { workspace_id: workspaceId, user_id: user.id, role: "admin" },
      { onConflict: "workspace_id,user_id" },
    );
  if (memberError) {
    throw memberError;
  }
  const { data: collection, error: collectionError } = await admin
    .from("boardy_collections")
    .upsert(
      {
        workspace_id: workspaceId,
        owner_id: user.id,
        name: "My whiteboards",
        visibility: "private",
      },
      { onConflict: "workspace_id,normalized_name" },
    )
    .select("id")
    .single();
  if (collectionError) {
    throw collectionError;
  }
  await admin
    .from("scenes")
    .update({ workspace_id: workspaceId, collection_id: collection.id })
    .eq("owner_id", user.id)
    .is("workspace_id", null);
  return workspaceId;
};

const requireWorkspaceRole = async (
  admin: AdminClient,
  workspaceId: string,
  userId: string,
  roles: string[],
) => {
  const { data, error } = await admin
    .from("boardy_workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data || !roles.includes(data.role)) {
    throw new Error("forbidden");
  }
  return data.role as "admin" | "staff" | "external";
};

const sceneRole = async (
  client: Awaited<ReturnType<typeof authenticate>>["client"],
  sceneId: string,
) => {
  const { data, error } = await client.rpc("boardy_scene_capabilities", {
    target_scene_id: sceneId,
  });
  if (error || !data) {
    throw error || new Error("forbidden");
  }
  return data as {
    role: "owner" | "editor" | "commenter" | "viewer";
    can_edit: boolean;
    can_comment: boolean;
    can_manage: boolean;
  };
};

const requireInvitationManagement = async ({
  admin,
  client,
  userId,
  workspaceId,
  sceneId,
  collectionId,
}: {
  admin: AdminClient;
  client: Awaited<ReturnType<typeof authenticate>>["client"];
  userId: string;
  workspaceId: string;
  sceneId?: string | null;
  collectionId?: string | null;
}) => {
  if (sceneId) {
    const capabilities = await sceneRole(client, requireUuid(sceneId));
    if (!capabilities.can_manage) {
      throw new Error("forbidden");
    }
    return;
  }
  if (collectionId) {
    const membershipRole = await requireWorkspaceRole(
      admin,
      workspaceId,
      userId,
      ["admin", "staff"],
    );
    const { data: collection, error } = await admin
      .from("boardy_collections")
      .select("owner_id")
      .eq("id", requireUuid(collectionId))
      .eq("workspace_id", workspaceId)
      .single();
    if (
      error ||
      !collection ||
      (membershipRole !== "admin" && collection.owner_id !== userId)
    ) {
      throw error || new Error("forbidden");
    }
    return;
  }
  await requireWorkspaceRole(admin, workspaceId, userId, ["admin"]);
};

const validatedMentionIds = async (
  client: Awaited<ReturnType<typeof authenticate>>["client"],
  sceneId: string,
  input: unknown,
  actorId: string,
) => {
  const requested = Array.isArray(input)
    ? [...new Set(input.map(String))]
        .filter((id) => id !== actorId)
        .slice(0, 20)
    : [];
  if (!requested.length) {
    return [];
  }
  const { data, error } = await client.rpc("boardy_filter_scene_mentions", {
    target_scene_id: sceneId,
    target_user_ids: requested,
  });
  if (error) {
    throw error;
  }
  const allowed = Array.isArray(data) ? data.map(String) : [];
  if (allowed.length !== requested.length) {
    throw new Error("forbidden");
  }
  return allowed;
};

const mentionDisplayText = (input: unknown, userId: string) => {
  if (!Array.isArray(input)) {
    return null;
  }
  const match = input.find(
    (item) =>
      item &&
      typeof item === "object" &&
      String((item as Record<string, unknown>).userId || "") === userId,
  ) as Record<string, unknown> | undefined;
  const value = String(match?.displayText || "").trim();
  return value.startsWith("@") && value.length <= 121 ? value : null;
};

const validateAttachment = async (
  admin: AdminClient,
  sceneId: string,
  assetId: unknown,
  userId: string,
) => {
  if (!assetId) {
    return null;
  }
  const id = requireUuid(assetId);
  const { data, error } = await admin
    .from("scene_assets")
    .select(
      "id,scene_id,owner_id,media_type,byte_size,storage_path,status,original_name",
    )
    .eq("id", id)
    .eq("scene_id", sceneId)
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .single();
  if (
    error ||
    !data ||
    !/^image\/(png|jpeg|gif|webp)$/.test(data.media_type) ||
    !data.byte_size ||
    data.byte_size > 5 * 1024 * 1024 ||
    !data.storage_path ||
    !["processing", "ready"].includes(data.status)
  ) {
    throw error || new Error("limit");
  }
  return data;
};

const createCommentNotifications = async ({
  admin,
  sceneId,
  threadId,
  messageId,
  actorId,
  mentionIds,
  isReply,
  bodyText,
  hasAttachment,
}: {
  admin: AdminClient;
  sceneId: string;
  threadId: string;
  messageId: string;
  actorId: string;
  mentionIds: string[];
  isReply: boolean;
  bodyText: string;
  hasAttachment: boolean;
}) => {
  const { data: allRecipientIds } = await admin.rpc(
    "boardy_comment_recipient_ids",
    { target_scene_id: sceneId },
  );
  const allIds = Array.isArray(allRecipientIds)
    ? allRecipientIds.map(String).filter((id) => id !== actorId)
    : [];
  if (!allIds.length) {
    return;
  }

  const [
    { data: preferences },
    { data: participantMessages },
    { data: thread },
  ] = await Promise.all([
    admin
      .from("boardy_comment_notification_preferences")
      .select("user_id,mode")
      .eq("scene_id", sceneId)
      .in("user_id", allIds),
    isReply
      ? admin
          .from("boardy_comment_messages")
          .select("author_id")
          .eq("thread_id", threadId)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] as Array<{ author_id: string }> }),
    admin
      .from("boardy_comment_threads")
      .select("created_by")
      .eq("id", threadId)
      .single(),
  ]);
  const modeByUser = new Map(
    (preferences || []).map((item) => [item.user_id, item.mode] as const),
  );
  const replyRecipients = new Set([
    ...mentionIds,
    ...(participantMessages || []).map((item) => item.author_id),
    ...(thread?.created_by ? [thread.created_by] : []),
  ]);
  const recipients = allIds.filter((id) => {
    const mode = modeByUser.get(id) || "mentions_replies";
    if (mode === "nothing") {
      return false;
    }
    return mode === "everything" || replyRecipients.has(id);
  });
  if (!recipients.length) {
    return;
  }

  const { data: notifications, error: notificationError } = await admin
    .from("boardy_notifications")
    .insert(
      recipients.map((recipientId) => ({
        user_id: recipientId,
        scene_id: sceneId,
        thread_id: threadId,
        actor_id: actorId,
        kind: mentionIds.includes(recipientId) ? "mention" : "reply",
      })),
    )
    .select("id,user_id");
  if (notificationError) {
    throw notificationError;
  }
  const [{ data: profiles }, { data: scene }, { data: actor }] =
    await Promise.all([
      admin
        .from("boardy_profiles")
        .select("user_id,email")
        .in("user_id", recipients),
      admin.from("scenes").select("title").eq("id", sceneId).single(),
      admin
        .from("boardy_profiles")
        .select("display_name")
        .eq("user_id", actorId)
        .single(),
    ]);
  const emailByUser = new Map(
    (profiles || []).map((item) => [item.user_id, item.email] as const),
  );
  const notificationByUser = new Map(
    (notifications || []).map((item) => [item.user_id, item.id] as const),
  );
  const rows = recipients
    .map((recipientId) => {
      const email = emailByUser.get(recipientId);
      if (!email) {
        return null;
      }
      return {
        notification_id: notificationByUser.get(recipientId),
        scene_id: sceneId,
        thread_id: threadId,
        message_id: messageId,
        recipient_user_id: recipientId,
        recipient_email: email,
        payload: {
          actorName: actor?.display_name || "A teammate",
          sceneTitle: scene?.title || "Whiteboard",
          excerpt: bodyText.slice(0, 280),
          hasAttachment,
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (rows.length) {
    const { error } = await admin
      .from("boardy_comment_email_outbox")
      .upsert(rows, { onConflict: "message_id,recipient_user_id" });
    if (error) {
      throw error;
    }
    const secret = Deno.env.get("COMMENT_EMAIL_WORKER_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (secret && supabaseUrl && typeof EdgeRuntime !== "undefined") {
      EdgeRuntime.waitUntil(
        fetch(`${supabaseUrl}/functions/v1/comment-email`, {
          method: "POST",
          headers: { "x-boardy-worker-secret": secret },
        }).catch((wakeError) =>
          console.error("comment email wake failed", wakeError),
        ),
      );
    }
  }
};

const dashboard = async (
  admin: AdminClient,
  client: Awaited<ReturnType<typeof authenticate>>["client"],
  userId: string,
  workspaceId: string,
) => {
  const currentRole = await requireWorkspaceRole(admin, workspaceId, userId, [
    "admin",
    "staff",
    "external",
  ]);
  const [workspaceResult, membersResult, collectionsResult, scenesResult] =
    await Promise.all([
      admin
        .from("boardy_workspaces")
        .select("*")
        .eq("id", workspaceId)
        .single(),
      admin
        .from("boardy_workspace_members")
        .select("workspace_id,user_id,role,status,joined_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .order("joined_at"),
      client
        .from("boardy_collections")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .order("updated_at", { ascending: false }),
      client
        .from("scenes")
        .select(
          "id,owner_id,title,status,current_revision_number,thumbnail_asset_id,workspace_id,collection_id,created_at,updated_at,deleted_at",
        )
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false })
        .limit(250),
    ]);
  const firstError = [
    workspaceResult,
    membersResult,
    collectionsResult,
    scenesResult,
  ].find((result) => result.error)?.error;
  if (firstError) {
    throw firstError;
  }
  const visibleMembers =
    currentRole === "external"
      ? (membersResult.data || []).filter((item) => item.user_id === userId)
      : membersResult.data || [];
  const memberIds = visibleMembers.map((item) => item.user_id);
  const { data: rawProfiles, error: profilesError } = await admin
    .from("boardy_profiles")
    .select("user_id,display_name,email,avatar_path")
    .in("user_id", memberIds.length ? memberIds : [userId]);
  if (profilesError) {
    throw profilesError;
  }
  const profiles = await addAvatarUrls(admin, rawProfiles || []);
  const profilesById = Object.fromEntries(
    profiles.map((profile) => [profile.user_id, publicProfile(profile)]),
  );
  return {
    workspace: workspaceResult.data,
    membership: membersResult.data?.find((item) => item.user_id === userId),
    members: visibleMembers.map((member) => ({
      ...member,
      profile: profilesById[member.user_id],
    })),
    collections: collectionsResult.data || [],
    whiteboards: scenesResult.data || [],
    profile: profilesById[userId],
  };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return response(request, 204, {});
  }
  try {
    const { admin, client, user } = await authenticate(request);
    const envelope = await request.json();
    const method = String(envelope.method || "GET").toUpperCase();
    const parts = String(envelope.path || "bootstrap")
      .split("/")
      .filter(Boolean);
    const body = envelope.body || {};

    if (
      parts[0] === "invitations" &&
      parts[1] === "redeem" &&
      method === "POST"
    ) {
      const token = String(body.token || "");
      const tokenHash = await sha256(token);
      const { data, error } = await client.rpc("boardy_redeem_invitation", {
        p_token_hash: tokenHash,
      });
      if (error) {
        throw error;
      }
      return response(request, 200, data);
    }

    if (parts[0] === "access" && method === "GET") {
      const [membershipResult, allowlistResult] = await Promise.all([
        admin
          .from("boardy_workspace_members")
          .select("workspace_id,role")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1),
        admin
          .from("boardy_subscription_allowlist")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (membershipResult.error || allowlistResult.error) {
        throw membershipResult.error || allowlistResult.error;
      }
      const data = membershipResult.data;
      return response(request, 200, {
        hasWorkspaceAccess: Boolean(data?.length || allowlistResult.data),
        workspaceId: data?.[0]?.workspace_id || null,
        role: data?.[0]?.role || null,
        accessSource: data?.length
          ? "workspace"
          : allowlistResult.data
          ? "allowlist"
          : null,
      });
    }

    const defaultWorkspaceId = await ensureAccount(admin, user);
    const workspaceId = body.workspaceId
      ? requireUuid(body.workspaceId)
      : defaultWorkspaceId;

    if (
      parts[0] === "collaboration-key" &&
      parts.length === 1 &&
      method === "POST"
    ) {
      const sceneId = requireUuid(body.sceneId);
      const candidateRoomKey = String(body.candidateRoomKey || "");
      if (!/^[A-Za-z0-9_-]{22}$/.test(candidateRoomKey)) {
        throw new Error("invalid_collaboration_key");
      }
      const capabilities = await sceneRole(client, sceneId);
      if (!capabilities.can_manage) {
        throw new Error("forbidden");
      }
      const { data: scene, error: sceneError } = await admin
        .from("scenes")
        .select("id")
        .eq("id", sceneId)
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .single();
      if (sceneError || !scene) {
        throw sceneError || new Error("not_found");
      }
      const { data, error } = await admin.rpc(
        "boardy_get_or_create_scene_collaboration_key",
        {
          target_scene_id: sceneId,
          candidate_room_key: candidateRoomKey,
        },
      );
      const collaboration = Array.isArray(data) ? data[0] : data;
      if (error || !collaboration?.room_key) {
        throw error || new Error("collaboration_key_unavailable");
      }
      return response(request, 200, {
        roomKey: collaboration.room_key,
      });
    }

    if (
      (parts[0] === "bootstrap" || parts[0] === "dashboard") &&
      method === "GET"
    ) {
      return response(
        request,
        200,
        await dashboard(admin, client, user.id, workspaceId),
      );
    }

    if (parts[0] === "previews" && method === "GET") {
      await requireWorkspaceRole(admin, workspaceId, user.id, [
        "admin",
        "staff",
        "external",
      ]);
      const { data: scenes, error: scenesError } = await client
        .from("scenes")
        .select("id,current_revision_id")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .limit(100);
      if (scenesError) {
        throw scenesError;
      }
      const revisionIds = (scenes || [])
        .map((scene) => scene.current_revision_id)
        .filter(Boolean);
      const { data: revisions, error: revisionsError } = revisionIds.length
        ? await client
            .from("scene_revisions")
            .select(
              "id,scene_id,scene_content_blobs(storage_path,byte_size,uncompressed_byte_size)",
            )
            .in("id", revisionIds)
        : { data: [], error: null };
      if (revisionsError) {
        throw revisionsError;
      }
      const entries = await Promise.all(
        (revisions || []).map(async (revision) => {
          const blobInfo = Array.isArray(revision.scene_content_blobs)
            ? revision.scene_content_blobs[0]
            : revision.scene_content_blobs;
          if (!blobInfo?.storage_path) {
            return [revision.scene_id, null] as const;
          }
          const { data: stored, error } = await admin.storage
            .from("scene-content")
            .download(blobInfo.storage_path);
          if (error || !stored) {
            return [revision.scene_id, null] as const;
          }
          return [revision.scene_id, await decodeScene(stored)] as const;
        }),
      );
      return response(request, 200, { previews: Object.fromEntries(entries) });
    }

    if (parts[0] === "profile" && method === "PATCH") {
      const displayName = String(body.displayName || "").trim();
      if (!displayName || displayName.length > 120) {
        throw new Error("limit");
      }
      const patch: Record<string, unknown> = {
        display_name: displayName,
        email: user.email,
        updated_at: new Date().toISOString(),
      };
      if (body.avatarPath === null || typeof body.avatarPath === "string") {
        patch.avatar_path = body.avatarPath;
      }
      const { error } = await admin
        .from("boardy_profiles")
        .update(patch)
        .eq("user_id", user.id);
      if (error) {
        throw error;
      }
      return response(request, 200, { ok: true });
    }

    if (parts[0] === "settings" && method === "PATCH") {
      await requireWorkspaceRole(admin, workspaceId, user.id, ["admin"]);
      const name = String(body.name || "").trim();
      if (!name || name.length > 120) {
        throw new Error("limit");
      }
      const { error } = await admin
        .from("boardy_workspaces")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", workspaceId);
      if (error) {
        throw error;
      }
      return response(request, 200, { ok: true });
    }

    if (parts[0] === "collections" && parts.length === 1 && method === "POST") {
      await requireWorkspaceRole(admin, workspaceId, user.id, [
        "admin",
        "staff",
      ]);
      const name = String(body.name || "").trim();
      if (!name || name.length > 120) {
        throw new Error("limit");
      }
      const { data, error } = await admin
        .from("boardy_collections")
        .insert({
          workspace_id: workspaceId,
          owner_id: user.id,
          name,
          visibility: ["private", "workspace", "selected"].includes(
            body.visibility,
          )
            ? body.visibility
            : "private",
        })
        .select("*")
        .single();
      if (error) {
        throw error;
      }
      return response(request, 201, { collection: data });
    }

    if (
      parts[0] === "collections" &&
      parts.length === 2 &&
      method === "PATCH"
    ) {
      const collectionId = requireUuid(parts[1]);
      const role = await requireWorkspaceRole(admin, workspaceId, user.id, [
        "admin",
        "staff",
      ]);
      const { data: collection } = await admin
        .from("boardy_collections")
        .select("owner_id")
        .eq("id", collectionId)
        .eq("workspace_id", workspaceId)
        .single();
      if (
        !collection ||
        (role !== "admin" && collection.owner_id !== user.id)
      ) {
        throw new Error("forbidden");
      }
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (typeof body.name === "string") {
        patch.name = body.name.trim();
      }
      if (["private", "workspace", "selected"].includes(body.visibility)) {
        patch.visibility = body.visibility;
      }
      if (body.action === "delete") {
        patch.status = "deleted";
        patch.deleted_at = new Date().toISOString();
        await admin
          .from("scenes")
          .update({ status: "deleted", deleted_at: new Date().toISOString() })
          .eq("collection_id", collectionId);
      }
      const { error } = await admin
        .from("boardy_collections")
        .update(patch)
        .eq("id", collectionId);
      if (error) {
        throw error;
      }
      return response(request, 200, { ok: true });
    }

    if (
      parts[0] === "whiteboards" &&
      parts.length === 2 &&
      method === "PATCH"
    ) {
      const sceneId = requireUuid(parts[1]);
      const capabilities = await sceneRole(client, sceneId);
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (typeof body.title === "string") {
        if (
          !capabilities.can_manage &&
          !(capabilities.can_edit && body.internal === true)
        ) {
          throw new Error("forbidden");
        }
        const title = body.title.trim();
        if (!title || title.length > 160) {
          throw new Error("limit");
        }
        patch.title = title;
      }
      if (body.collectionId) {
        if (!capabilities.can_manage) {
          throw new Error("forbidden");
        }
        const targetCollectionId = requireUuid(body.collectionId);
        const { data: targetCollection, error: targetError } = await client
          .from("boardy_collections")
          .select("id,workspace_id")
          .eq("id", targetCollectionId)
          .eq("workspace_id", workspaceId)
          .eq("status", "active")
          .maybeSingle();
        if (targetError || !targetCollection) {
          throw targetError || new Error("forbidden");
        }
        patch.collection_id = targetCollectionId;
      }
      const { error } = await admin
        .from("scenes")
        .update(patch)
        .eq("id", sceneId);
      if (error) {
        throw error;
      }
      return response(request, 200, { ok: true });
    }

    if (parts[0] === "members" && parts.length === 2 && method === "PATCH") {
      await requireWorkspaceRole(admin, workspaceId, user.id, ["admin"]);
      const targetUserId = requireUuid(parts[1]);
      if (
        targetUserId === user.id &&
        (body.action === "remove" || body.role !== "admin")
      ) {
        throw new Error("forbidden");
      }
      if (body.action === "remove") {
        const { error } = await admin
          .from("boardy_workspace_members")
          .update({ status: "removed", removed_at: new Date().toISOString() })
          .eq("workspace_id", workspaceId)
          .eq("user_id", targetUserId);
        if (error) {
          throw error;
        }
      } else if (["admin", "staff", "external"].includes(body.role)) {
        const { error } = await admin
          .from("boardy_workspace_members")
          .update({ role: body.role })
          .eq("workspace_id", workspaceId)
          .eq("user_id", targetUserId);
        if (error) {
          throw error;
        }
      } else {
        throw new Error("forbidden");
      }
      return response(request, 200, { ok: true });
    }

    if (
      parts[0] === "invitations" &&
      parts.length === 3 &&
      parts[2] === "email" &&
      method === "POST"
    ) {
      const invitationId = requireUuid(parts[1]);
      const { data: invitation, error } = await admin
        .from("boardy_invitations")
        .select(
          "id,workspace_id,collection_id,scene_id,created_by,token_hash,recipient_email,resource_role,expires_at,email_attempt_count",
        )
        .eq("id", invitationId)
        .eq("workspace_id", workspaceId)
        .is("revoked_at", null)
        .single();
      if (
        error ||
        !invitation ||
        new Date(invitation.expires_at) <= new Date()
      ) {
        throw error || new Error("not_found");
      }
      await requireInvitationManagement({
        admin,
        client,
        userId: user.id,
        workspaceId,
        sceneId: invitation.scene_id,
        collectionId: invitation.collection_id,
      });
      const token = String(body.token || "");
      if (!token || (await sha256(token)) !== invitation.token_hash) {
        throw new Error("forbidden");
      }
      if (!invitation.recipient_email) {
        throw new Error("invalid_email");
      }
      if (invitation.email_attempt_count >= 12) {
        return response(request, 200, {
          emailDelivery: { status: "failed", retryable: false },
        });
      }
      const emailDelivery = await sendInvitationEmail({
        admin,
        invitation: invitation as InvitationEmailRecord,
        token,
      });
      return response(request, 200, { emailDelivery });
    }

    if (parts[0] === "invitations" && parts.length === 1 && method === "POST") {
      const sceneId = body.sceneId ? requireUuid(body.sceneId) : null;
      const collectionId = body.collectionId
        ? requireUuid(body.collectionId)
        : null;
      await requireInvitationManagement({
        admin,
        client,
        userId: user.id,
        workspaceId,
        sceneId,
        collectionId,
      });
      const recipientEmail = normalizeInvitationEmail(body.recipientEmail);
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll(
        "-",
        "",
      );
      const tokenHash = await sha256(token);
      const maxUses = Math.min(Math.max(Number(body.maxUses) || 1, 1), 1000);
      const expiresAt = new Date(
        Date.now() +
          Math.min(Math.max(Number(body.expiresInDays) || 7, 1), 30) * 86400000,
      ).toISOString();
      const { data, error } = await admin
        .from("boardy_invitations")
        .insert({
          workspace_id: workspaceId,
          collection_id: collectionId,
          scene_id: sceneId,
          created_by: user.id,
          token_hash: tokenHash,
          recipient_email: recipientEmail,
          workspace_role: body.workspaceRole || "external",
          resource_role: body.resourceRole || null,
          max_uses: maxUses,
          expires_at: expiresAt,
          email_status: recipientEmail ? "pending" : null,
        })
        .select(
          "id,workspace_id,collection_id,scene_id,created_by,token_hash,recipient_email,resource_role,expires_at,email_attempt_count,max_uses",
        )
        .single();
      if (error) {
        throw error;
      }
      const emailDelivery = await sendInvitationEmail({
        admin,
        invitation: data as InvitationEmailRecord,
        token,
      });
      return response(request, 201, {
        invitation: {
          id: data.id,
          expires_at: data.expires_at,
          max_uses: data.max_uses,
          email_status:
            emailDelivery.status === "not_requested"
              ? null
              : emailDelivery.status,
        },
        token,
        emailDelivery,
      });
    }

    if (parts[0] === "comments" && parts.length === 2 && method === "GET") {
      const sceneId = requireUuid(parts[1]);
      const capabilities = await sceneRole(client, sceneId);
      const { data: threads, error } = await admin
        .from("boardy_comment_threads")
        .select("*")
        .eq("scene_id", sceneId)
        .is("deleted_at", null)
        .order("last_activity_at", { ascending: false })
        .limit(200);
      if (error) {
        throw error;
      }
      const threadIds = (threads || []).map((thread) => thread.id);
      const { data: messages, error: messageError } = threadIds.length
        ? await admin
            .from("boardy_comment_messages")
            .select("*")
            .in("thread_id", threadIds)
            .order("created_at")
        : { data: [], error: null };
      if (messageError) {
        throw messageError;
      }
      const messageIds = (messages || []).map((message) => message.id);
      const [{ data: reactions }, { data: mentions }, { data: attachments }] =
        messageIds.length
          ? await Promise.all([
              admin
                .from("boardy_comment_reactions")
                .select("message_id,user_id,emoji")
                .in("message_id", messageIds),
              admin
                .from("boardy_comment_mentions")
                .select("message_id,user_id,display_text")
                .in("message_id", messageIds),
              admin
                .from("boardy_comment_attachments")
                .select("message_id,asset_id")
                .in("message_id", messageIds),
            ])
          : [{ data: [] }, { data: [] }, { data: [] }];
      const assetIds = (attachments || []).map((item) => item.asset_id);
      const { data: assets } = assetIds.length
        ? await admin
            .from("scene_assets")
            .select("id,original_name,media_type,byte_size,storage_path,status")
            .in("id", assetIds)
            .is("deleted_at", null)
        : { data: [] };
      const paths = (assets || [])
        .map((asset) => asset.storage_path)
        .filter((path): path is string => typeof path === "string");
      const { data: signedAssets } = paths.length
        ? await admin.storage.from("scene-assets").createSignedUrls(paths, 900)
        : { data: [] };
      const assetUrlByPath = new Map(
        (signedAssets || []).map(
          (item) => [item.path, item.signedUrl] as const,
        ),
      );
      const assetById = new Map(
        (assets || []).map(
          (asset) =>
            [
              asset.id,
              {
                id: asset.id,
                name: asset.original_name || "Image",
                mediaType: asset.media_type,
                byteSize: asset.byte_size,
                status: asset.status,
                url:
                  typeof asset.storage_path === "string"
                    ? assetUrlByPath.get(asset.storage_path) || null
                    : null,
              },
            ] as const,
        ),
      );
      const profileIds = [
        ...new Set([
          ...(messages || []).map((message) => message.author_id),
          ...(mentions || []).map((mention) => mention.user_id),
        ]),
      ];
      const { data: profileRows } = profileIds.length
        ? await admin
            .from("boardy_profiles")
            .select("user_id,display_name,email,avatar_path")
            .in("user_id", profileIds)
        : { data: [] };
      const profiles = await addAvatarUrls(admin, profileRows || []);
      const byUser = Object.fromEntries(
        profiles.map((profile) => [profile.user_id, publicProfile(profile)]),
      );
      const [{ data: reads }, { data: preference }] = await Promise.all([
        threadIds.length
          ? admin
              .from("boardy_comment_reads")
              .select("thread_id,read_through,manual_unread")
              .eq("user_id", user.id)
              .in("thread_id", threadIds)
          : Promise.resolve({ data: [] }),
        admin
          .from("boardy_comment_notification_preferences")
          .select("mode")
          .eq("scene_id", sceneId)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      const readByThread = new Map(
        (reads || []).map((item) => [item.thread_id, item] as const),
      );
      return response(request, 200, {
        capabilities,
        notificationPreference: preference?.mode || "mentions_replies",
        threads: (threads || []).map((thread) => ({
          ...thread,
          unread: (() => {
            const read = readByThread.get(thread.id);
            return (
              !read ||
              read.manual_unread ||
              new Date(thread.last_activity_at).getTime() >
                new Date(read.read_through).getTime()
            );
          })(),
          messages: (messages || [])
            .filter((message) => message.thread_id === thread.id)
            .map((message) => ({
              ...message,
              author: byUser[message.author_id],
              mentions: (mentions || [])
                .filter((item) => item.message_id === message.id)
                .map((item) => ({
                  profile: byUser[item.user_id],
                  displayText:
                    item.display_text ||
                    (byUser[item.user_id]
                      ? `@${byUser[item.user_id].displayName}`
                      : ""),
                }))
                .filter(Boolean),
              attachment: (() => {
                const match = (attachments || []).find(
                  (item) => item.message_id === message.id,
                );
                return match ? assetById.get(match.asset_id) || null : null;
              })(),
              reactions: Object.entries(
                (reactions || [])
                  .filter((item) => item.message_id === message.id)
                  .reduce((all, item) => {
                    const current = all[item.emoji] || {
                      count: 0,
                      reacted: false,
                    };
                    current.count += 1;
                    current.reacted ||= item.user_id === user.id;
                    all[item.emoji] = current;
                    return all;
                  }, {} as Record<string, { count: number; reacted: boolean }>),
              ).map(([emoji, value]) => ({ emoji, ...value })),
            })),
        })),
      });
    }

    if (parts[0] === "comments" && parts.length === 2 && method === "POST") {
      const sceneId = requireUuid(parts[1]);
      const capabilities = await sceneRole(client, sceneId);
      if (!capabilities.can_comment) {
        throw new Error("forbidden");
      }
      const bodyText = String(body.message || "").trim();
      const attachment = await validateAttachment(
        admin,
        sceneId,
        body.attachmentAssetId,
        user.id,
      );
      if ((!bodyText && !attachment) || bodyText.length > 10000) {
        throw new Error("limit");
      }
      const anchorKind = ["point", "region", "element", "general"].includes(
        body.anchorKind,
      )
        ? body.anchorKind
        : "general";
      const { data: thread, error } = await admin
        .from("boardy_comment_threads")
        .insert({
          scene_id: sceneId,
          created_by: user.id,
          anchor_kind: anchorKind,
          anchor: body.anchor || {},
        })
        .select("*")
        .single();
      if (error) {
        throw error;
      }
      const { data: message, error: messageError } = await admin
        .from("boardy_comment_messages")
        .insert({
          thread_id: thread.id,
          author_id: user.id,
          body: bodyText,
          request_id: body.requestId || requestId(),
        })
        .select("*")
        .single();
      if (messageError) {
        throw messageError;
      }
      if (attachment) {
        const { error: attachmentError } = await admin
          .from("boardy_comment_attachments")
          .insert({ message_id: message.id, asset_id: attachment.id });
        if (attachmentError) {
          throw attachmentError;
        }
      }
      const requestedMentionIds = Array.isArray(body.mentions)
        ? body.mentions.map((item: Record<string, unknown>) => item?.userId)
        : body.mentionUserIds;
      const mentionIds = await validatedMentionIds(
        client,
        sceneId,
        requestedMentionIds,
        user.id,
      );
      if (mentionIds.length) {
        await admin.from("boardy_comment_mentions").insert(
          mentionIds.map((mentionedUserId) => ({
            message_id: message.id,
            user_id: mentionedUserId,
            display_text: mentionDisplayText(body.mentions, mentionedUserId),
          })),
        );
      }
      await createCommentNotifications({
        admin,
        sceneId,
        threadId: thread.id,
        messageId: message.id,
        actorId: user.id,
        mentionIds,
        isReply: false,
        bodyText,
        hasAttachment: Boolean(attachment),
      });
      return response(request, 201, { thread, message });
    }

    if (
      parts[0] === "comments" &&
      parts[2] === "preference" &&
      parts.length === 3 &&
      method === "PUT"
    ) {
      const sceneId = requireUuid(parts[1]);
      await sceneRole(client, sceneId);
      const mode = String(body.mode || "");
      if (!["everything", "mentions_replies", "nothing"].includes(mode)) {
        throw new Error("limit");
      }
      const { error } = await admin
        .from("boardy_comment_notification_preferences")
        .upsert(
          {
            scene_id: sceneId,
            user_id: user.id,
            mode,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "scene_id,user_id" },
        );
      if (error) {
        throw error;
      }
      return response(request, 200, { mode });
    }

    if (
      parts[0] === "comments" &&
      parts[2] === "read" &&
      parts.length === 3 &&
      method === "POST"
    ) {
      const sceneId = requireUuid(parts[1]);
      await sceneRole(client, sceneId);
      const { data: threads, error: threadError } = await admin
        .from("boardy_comment_threads")
        .select("id,last_activity_at")
        .eq("scene_id", sceneId)
        .is("deleted_at", null);
      if (threadError) {
        throw threadError;
      }
      if (threads?.length) {
        const { error } = await admin.from("boardy_comment_reads").upsert(
          threads.map((thread) => ({
            thread_id: thread.id,
            user_id: user.id,
            read_through: thread.last_activity_at,
            manual_unread: false,
          })),
          { onConflict: "thread_id,user_id" },
        );
        if (error) {
          throw error;
        }
      }
      return response(request, 200, { ok: true });
    }

    if (
      parts[0] === "comments" &&
      parts[1] === "threads" &&
      parts[2] &&
      parts[3] === "read" &&
      method === "POST"
    ) {
      const threadId = requireUuid(parts[2]);
      const { data: thread, error: threadError } = await admin
        .from("boardy_comment_threads")
        .select("scene_id,last_activity_at")
        .eq("id", threadId)
        .is("deleted_at", null)
        .single();
      if (threadError || !thread) {
        throw threadError || new Error("not_found");
      }
      await sceneRole(client, thread.scene_id);
      const unread = Boolean(body.unread);
      const { error } = await admin.from("boardy_comment_reads").upsert(
        {
          thread_id: threadId,
          user_id: user.id,
          read_through: unread
            ? new Date(0).toISOString()
            : thread.last_activity_at,
          manual_unread: unread,
        },
        { onConflict: "thread_id,user_id" },
      );
      if (error) {
        throw error;
      }
      return response(request, 200, { unread });
    }

    if (
      parts[0] === "comments" &&
      parts[1] === "threads" &&
      parts[2] &&
      method === "POST"
    ) {
      const threadId = requireUuid(parts[2]);
      const { data: thread, error: threadError } = await admin
        .from("boardy_comment_threads")
        .select("scene_id")
        .eq("id", threadId)
        .single();
      if (threadError || !thread) {
        throw threadError || new Error("not_found");
      }
      const capabilities = await sceneRole(client, thread.scene_id);
      if (!capabilities.can_comment) {
        throw new Error("forbidden");
      }
      const messageText = String(body.message || "").trim();
      const attachment = await validateAttachment(
        admin,
        thread.scene_id,
        body.attachmentAssetId,
        user.id,
      );
      if ((!messageText && !attachment) || messageText.length > 10000) {
        throw new Error("limit");
      }
      const { data: message, error } = await admin
        .from("boardy_comment_messages")
        .insert({
          thread_id: threadId,
          author_id: user.id,
          body: messageText,
          request_id: body.requestId || requestId(),
        })
        .select("*")
        .single();
      if (error) {
        throw error;
      }
      if (attachment) {
        const { error: attachmentError } = await admin
          .from("boardy_comment_attachments")
          .insert({ message_id: message.id, asset_id: attachment.id });
        if (attachmentError) {
          throw attachmentError;
        }
      }
      const requestedMentionIds = Array.isArray(body.mentions)
        ? body.mentions.map((item: Record<string, unknown>) => item?.userId)
        : body.mentionUserIds;
      const mentionIds = await validatedMentionIds(
        client,
        thread.scene_id,
        requestedMentionIds,
        user.id,
      );
      if (mentionIds.length) {
        await admin.from("boardy_comment_mentions").insert(
          mentionIds.map((mentionedUserId) => ({
            message_id: message.id,
            user_id: mentionedUserId,
            display_text: mentionDisplayText(body.mentions, mentionedUserId),
          })),
        );
      }
      await admin
        .from("boardy_comment_threads")
        .update({
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", threadId);
      await createCommentNotifications({
        admin,
        sceneId: thread.scene_id,
        threadId,
        messageId: message.id,
        actorId: user.id,
        mentionIds,
        isReply: true,
        bodyText: messageText,
        hasAttachment: Boolean(attachment),
      });
      return response(request, 201, { message });
    }

    if (
      parts[0] === "comments" &&
      parts[1] === "threads" &&
      parts[2] &&
      method === "PATCH"
    ) {
      const threadId = requireUuid(parts[2]);
      const { data: thread, error } = await admin
        .from("boardy_comment_threads")
        .select("scene_id,created_by,version")
        .eq("id", threadId)
        .single();
      if (error || !thread) {
        throw error || new Error("not_found");
      }
      const capabilities = await sceneRole(client, thread.scene_id);
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        version: thread.version + 1,
      };
      if (body.action === "resolve" || body.action === "reopen") {
        if (!capabilities.can_edit && thread.created_by !== user.id) {
          throw new Error("forbidden");
        }
        patch.resolved_at =
          body.action === "resolve" ? new Date().toISOString() : null;
        patch.resolved_by = body.action === "resolve" ? user.id : null;
      } else if (body.action === "move") {
        if (!capabilities.can_manage && thread.created_by !== user.id) {
          throw new Error("forbidden");
        }
        patch.anchor_kind = body.anchorKind;
        patch.anchor = body.anchor;
      } else if (body.action === "delete") {
        if (!capabilities.can_manage && thread.created_by !== user.id) {
          throw new Error("forbidden");
        }
        patch.deleted_at = new Date().toISOString();
        patch.deleted_by = user.id;
      } else {
        throw new Error("forbidden");
      }
      const { error: updateError } = await admin
        .from("boardy_comment_threads")
        .update(patch)
        .eq("id", threadId)
        .eq("version", body.version || thread.version);
      if (updateError) {
        throw updateError;
      }
      return response(request, 200, { ok: true, version: thread.version + 1 });
    }

    if (
      parts[0] === "comments" &&
      parts[1] === "messages" &&
      parts[2] &&
      parts[3] === "reactions" &&
      method === "POST"
    ) {
      const messageId = requireUuid(parts[2]);
      const emoji = String(body.emoji || "").trim();
      if (!emoji || emoji.length > 32) {
        throw new Error("limit");
      }
      const { data: message, error } = await admin
        .from("boardy_comment_messages")
        .select("thread_id,boardy_comment_threads!inner(scene_id)")
        .eq("id", messageId)
        .single();
      if (error || !message) {
        throw error || new Error("not_found");
      }
      const sceneId = (
        message.boardy_comment_threads as unknown as { scene_id: string }
      ).scene_id;
      const capabilities = await sceneRole(client, sceneId);
      if (!capabilities.can_comment) {
        throw new Error("forbidden");
      }
      const existing = await admin
        .from("boardy_comment_reactions")
        .select("emoji")
        .eq("message_id", messageId)
        .eq("user_id", user.id)
        .eq("emoji", emoji)
        .maybeSingle();
      if (existing.data) {
        await admin
          .from("boardy_comment_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", user.id)
          .eq("emoji", emoji);
      } else {
        await admin
          .from("boardy_comment_reactions")
          .insert({ message_id: messageId, user_id: user.id, emoji });
      }
      return response(request, 200, { reacted: !existing.data });
    }

    throw new Error("not_found");
  } catch (error) {
    console.error("workspace request failed", error);
    return cloudErrorResponse(request, error);
  }
});
