import { authenticate, response } from "../_shared/agentic.ts";
import { cloudErrorResponse, requireUuid } from "../_shared/cloud.ts";

type AdminClient = ReturnType<typeof import("../_shared/agentic.ts")["adminClient"]>;

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
    .filter((path): path is string => typeof path === "string" && path.length > 0);
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

  const base = `${slugify(metadataName || fallbackName)}-${user.id.slice(0, 8)}`;
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
      admin.from("boardy_workspaces").select("*").eq("id", workspaceId).single(),
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

    if (parts[0] === "invitations" && parts[1] === "redeem" && method === "POST") {
      const token = String(body.token || "");
      const tokenHash = await sha256(token);
      const { data: invitation, error } = await admin
        .from("boardy_invitations")
        .select("*")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (error) throw error;
      if (
        !invitation ||
        invitation.revoked_at ||
        new Date(invitation.expires_at) <= new Date() ||
        invitation.use_count >= invitation.max_uses ||
        (invitation.recipient_email &&
          invitation.recipient_email.toLowerCase() !== user.email?.toLowerCase())
      ) {
        throw new Error("forbidden");
      }
      const existing = await admin
        .from("boardy_invitation_redemptions")
        .select("invitation_id")
        .eq("invitation_id", invitation.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!existing.data) {
        const { error: redemptionError } = await admin
          .from("boardy_invitation_redemptions")
          .insert({ invitation_id: invitation.id, user_id: user.id });
        if (redemptionError) throw redemptionError;
        await admin
          .from("boardy_invitations")
          .update({ use_count: invitation.use_count + 1 })
          .eq("id", invitation.id)
          .eq("use_count", invitation.use_count);
      }
      await admin.from("boardy_workspace_members").upsert(
        {
          workspace_id: invitation.workspace_id,
          user_id: user.id,
          role: invitation.workspace_role || "external",
          status: "active",
          removed_at: null,
        },
        { onConflict: "workspace_id,user_id" },
      );
      if (invitation.collection_id) {
        await admin.from("boardy_collection_members").upsert(
          {
            collection_id: invitation.collection_id,
            user_id: user.id,
            role: invitation.resource_role || "viewer",
            created_by: invitation.created_by,
          },
          { onConflict: "collection_id,user_id" },
        );
      }
      if (invitation.scene_id) {
        await admin.from("scene_members").upsert(
          {
            scene_id: invitation.scene_id,
            user_id: user.id,
            role: invitation.resource_role || "viewer",
          },
          { onConflict: "scene_id,user_id" },
        );
      }
      return response(request, 200, {
        workspaceId: invitation.workspace_id,
        sceneId: invitation.scene_id,
        collectionId: invitation.collection_id,
      });
    }

    const defaultWorkspaceId = await ensureAccount(admin, user);
    const workspaceId = body.workspaceId
      ? requireUuid(body.workspaceId)
      : defaultWorkspaceId;

    if ((parts[0] === "bootstrap" || parts[0] === "dashboard") && method === "GET") {
      return response(
        request,
        200,
        await dashboard(admin, client, user.id, workspaceId),
      );
    }

    if (parts[0] === "profile" && method === "PATCH") {
      const displayName = String(body.displayName || "").trim();
      if (!displayName || displayName.length > 120) throw new Error("limit");
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
      if (error) throw error;
      return response(request, 200, { ok: true });
    }

    if (parts[0] === "collections" && parts.length === 1 && method === "POST") {
      await requireWorkspaceRole(admin, workspaceId, user.id, ["admin", "staff"]);
      const name = String(body.name || "").trim();
      if (!name || name.length > 120) throw new Error("limit");
      const { data, error } = await admin
        .from("boardy_collections")
        .insert({
          workspace_id: workspaceId,
          owner_id: user.id,
          name,
          visibility: ["private", "workspace", "selected"].includes(body.visibility)
            ? body.visibility
            : "private",
        })
        .select("*")
        .single();
      if (error) throw error;
      return response(request, 201, { collection: data });
    }

    if (parts[0] === "collections" && parts.length === 2 && method === "PATCH") {
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
      if (!collection || (role !== "admin" && collection.owner_id !== user.id)) {
        throw new Error("forbidden");
      }
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.name === "string") patch.name = body.name.trim();
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
      if (error) throw error;
      return response(request, 200, { ok: true });
    }

    if (parts[0] === "whiteboards" && parts.length === 2 && method === "PATCH") {
      const sceneId = requireUuid(parts[1]);
      const capabilities = await sceneRole(client, sceneId);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.title === "string") {
        if (!capabilities.can_manage && !(capabilities.can_edit && body.internal === true)) {
          throw new Error("forbidden");
        }
        patch.title = body.title.trim();
      }
      if (body.collectionId) {
        if (!capabilities.can_manage) throw new Error("forbidden");
        patch.collection_id = requireUuid(body.collectionId);
      }
      const { error } = await admin.from("scenes").update(patch).eq("id", sceneId);
      if (error) throw error;
      return response(request, 200, { ok: true });
    }

    if (parts[0] === "members" && parts.length === 2 && method === "PATCH") {
      await requireWorkspaceRole(admin, workspaceId, user.id, ["admin"]);
      const targetUserId = requireUuid(parts[1]);
      if (targetUserId === user.id && body.action === "remove") throw new Error("forbidden");
      if (body.action === "remove") {
        const { error } = await admin
          .from("boardy_workspace_members")
          .update({ status: "removed", removed_at: new Date().toISOString() })
          .eq("workspace_id", workspaceId)
          .eq("user_id", targetUserId);
        if (error) throw error;
      } else if (["admin", "staff", "external"].includes(body.role)) {
        const { error } = await admin
          .from("boardy_workspace_members")
          .update({ role: body.role })
          .eq("workspace_id", workspaceId)
          .eq("user_id", targetUserId);
        if (error) throw error;
      } else {
        throw new Error("forbidden");
      }
      return response(request, 200, { ok: true });
    }

    if (parts[0] === "invitations" && parts.length === 1 && method === "POST") {
      await requireWorkspaceRole(admin, workspaceId, user.id, ["admin"]);
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
      const tokenHash = await sha256(token);
      const maxUses = Math.min(Math.max(Number(body.maxUses) || 1, 1), 1000);
      const expiresAt = new Date(
        Date.now() + Math.min(Math.max(Number(body.expiresInDays) || 7, 1), 30) * 86400000,
      ).toISOString();
      const { data, error } = await admin
        .from("boardy_invitations")
        .insert({
          workspace_id: workspaceId,
          collection_id: body.collectionId || null,
          scene_id: body.sceneId || null,
          created_by: user.id,
          token_hash: tokenHash,
          recipient_email:
            typeof body.recipientEmail === "string"
              ? body.recipientEmail.trim().toLowerCase()
              : null,
          workspace_role: body.workspaceRole || "external",
          resource_role: body.resourceRole || null,
          max_uses: maxUses,
          expires_at: expiresAt,
        })
        .select("id,expires_at,max_uses")
        .single();
      if (error) throw error;
      return response(request, 201, { invitation: data, token });
    }

    if (parts[0] === "comments" && parts.length === 2 && method === "GET") {
      const sceneId = requireUuid(parts[1]);
      await sceneRole(client, sceneId);
      const { data: threads, error } = await admin
        .from("boardy_comment_threads")
        .select("*")
        .eq("scene_id", sceneId)
        .is("deleted_at", null)
        .order("last_activity_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const threadIds = (threads || []).map((thread) => thread.id);
      const { data: messages, error: messageError } = threadIds.length
        ? await admin
            .from("boardy_comment_messages")
            .select("*")
            .in("thread_id", threadIds)
            .order("created_at")
        : { data: [], error: null };
      if (messageError) throw messageError;
      const authorIds = [...new Set((messages || []).map((message) => message.author_id))];
      const { data: profileRows } = authorIds.length
        ? await admin
            .from("boardy_profiles")
            .select("user_id,display_name,email,avatar_path")
            .in("user_id", authorIds)
        : { data: [] };
      const profiles = await addAvatarUrls(admin, profileRows || []);
      const byUser = Object.fromEntries(
        profiles.map((profile) => [profile.user_id, publicProfile(profile)]),
      );
      return response(request, 200, {
        capabilities: await sceneRole(client, sceneId),
        threads: (threads || []).map((thread) => ({
          ...thread,
          messages: (messages || [])
            .filter((message) => message.thread_id === thread.id)
            .map((message) => ({ ...message, author: byUser[message.author_id] })),
        })),
      });
    }

    if (parts[0] === "comments" && parts.length === 2 && method === "POST") {
      const sceneId = requireUuid(parts[1]);
      const capabilities = await sceneRole(client, sceneId);
      if (!capabilities.can_comment) throw new Error("forbidden");
      const bodyText = String(body.message || "").trim();
      if (!bodyText || bodyText.length > 10000) throw new Error("limit");
      const anchorKind = ["point", "region", "element", "general"].includes(body.anchorKind)
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
      if (error) throw error;
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
      if (messageError) throw messageError;
      return response(request, 201, { thread, message });
    }

    if (parts[0] === "comments" && parts[1] === "threads" && parts[2] && method === "POST") {
      const threadId = requireUuid(parts[2]);
      const { data: thread, error: threadError } = await admin
        .from("boardy_comment_threads")
        .select("scene_id")
        .eq("id", threadId)
        .single();
      if (threadError || !thread) throw threadError || new Error("not_found");
      const capabilities = await sceneRole(client, thread.scene_id);
      if (!capabilities.can_comment) throw new Error("forbidden");
      const messageText = String(body.message || "").trim();
      if (!messageText || messageText.length > 10000) throw new Error("limit");
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
      if (error) throw error;
      await admin
        .from("boardy_comment_threads")
        .update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", threadId);
      return response(request, 201, { message });
    }

    if (parts[0] === "comments" && parts[1] === "threads" && parts[2] && method === "PATCH") {
      const threadId = requireUuid(parts[2]);
      const { data: thread, error } = await admin
        .from("boardy_comment_threads")
        .select("scene_id,created_by,version")
        .eq("id", threadId)
        .single();
      if (error || !thread) throw error || new Error("not_found");
      const capabilities = await sceneRole(client, thread.scene_id);
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        version: thread.version + 1,
      };
      if (body.action === "resolve" || body.action === "reopen") {
        if (!capabilities.can_edit && thread.created_by !== user.id) throw new Error("forbidden");
        patch.resolved_at = body.action === "resolve" ? new Date().toISOString() : null;
        patch.resolved_by = body.action === "resolve" ? user.id : null;
      } else if (body.action === "move") {
        if (!capabilities.can_manage && thread.created_by !== user.id) throw new Error("forbidden");
        patch.anchor_kind = body.anchorKind;
        patch.anchor = body.anchor;
      } else if (body.action === "delete") {
        if (!capabilities.can_manage && thread.created_by !== user.id) throw new Error("forbidden");
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
      if (updateError) throw updateError;
      return response(request, 200, { ok: true, version: thread.version + 1 });
    }

    throw new Error("not_found");
  } catch (error) {
    return cloudErrorResponse(request, error);
  }
});
