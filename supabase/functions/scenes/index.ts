import { authenticate, response } from "../_shared/agentic.ts";
import {
  cloudErrorResponse,
  decodeScene,
  encodeScene,
  requireRequestId,
  requireUuid,
} from "../_shared/cloud.ts";
import { requireProAccess } from "../_shared/pro.ts";

const selectScene =
  "id, owner_id, title, status, workspace_id, collection_id, current_revision_id, current_revision_number, thumbnail_asset_id, created_at, updated_at, deleted_at";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return response(request, 204, {});
  }
  try {
    const { admin, client, user } = await authenticate(request);
    const envelope = await request.json();
    const method = String(envelope.method || "GET").toUpperCase();
    const parts = String(envelope.path || "scenes")
      .split("/")
      .filter(Boolean);
    const body = envelope.body || {};

    if (parts[0] !== "scenes") {
      throw new Error("not_found");
    }

    if (method === "GET" && parts.length === 1) {
      const includeDeleted = body.includeDeleted === true;
      let query = client
        .from("scenes")
        .select(selectScene)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (!includeDeleted) {
        query = query.eq("status", "active");
      }
      const { data, error } = await query;
      if (error) {
        throw error;
      }
      return response(request, 200, { scenes: data || [] });
    }

    if (method === "POST" && parts.length === 1) {
      const requestId = requireRequestId(body.requestId);
      const { data: priorScenes, error: priorScenesError } = await admin
        .from("scenes")
        .select("id")
        .eq("owner_id", user.id)
        .limit(1);
      if (priorScenesError) {
        throw priorScenesError;
      }
      if (priorScenes?.length) {
        await requireProAccess(admin, user.id);
      }
      const workspaceId = body.workspaceId
        ? requireUuid(body.workspaceId)
        : null;
      const collectionId = body.collectionId
        ? requireUuid(body.collectionId)
        : null;
      if ((workspaceId && !collectionId) || (!workspaceId && collectionId)) {
        throw new Error("invalid_workspace_scope");
      }
      if (workspaceId && collectionId) {
        const { data: collection, error: collectionError } = await client
          .from("boardy_collections")
          .select("id,workspace_id")
          .eq("id", collectionId)
          .eq("workspace_id", workspaceId)
          .maybeSingle();
        if (collectionError) {
          throw collectionError;
        }
        if (!collection) {
          throw new Error("forbidden");
        }
      }
      const encoded = await encodeScene(body.document);
      const storagePath = `pending/${user.id}/${requestId}.json.gz`;
      const { error: uploadError } = await admin.storage
        .from("scene-content")
        .upload(storagePath, encoded.compressed, {
          contentType: "application/vnd.excalidraw+json",
          upsert: false,
        });
      if (uploadError && !uploadError.message.toLowerCase().includes("exist")) {
        throw uploadError;
      }
      const createSceneRpc =
        workspaceId && collectionId
          ? "boardy_create_scene"
          : "cloud_create_scene";
      const { data, error } = await client.rpc(createSceneRpc, {
        scene_title:
          typeof body.title === "string" ? body.title : "Untitled scene",
        ...(workspaceId && collectionId
          ? { workspace_id: workspaceId, collection_id: collectionId }
          : {}),
        blob_sha256: encoded.sha256,
        blob_storage_path: storagePath,
        blob_byte_size: encoded.compressed.byteLength,
        blob_uncompressed_byte_size: encoded.bytes.byteLength,
        actor_email: user.email || "Unknown user",
        request_id: requestId,
      });
      if (error) {
        throw error;
      }
      return response(request, 201, data);
    }

    const sceneId = requireUuid(parts[1]);
    const { data: scene, error: sceneError } = await client
      .from("scenes")
      .select(selectScene)
      .eq("id", sceneId)
      .maybeSingle();
    if (sceneError) {
      throw sceneError;
    }
    if (!scene) {
      throw new Error("not_found");
    }

    if (method === "GET" && parts.length === 2) {
      const { data: revision, error } = await client
        .from("scene_revisions")
        .select(
          "id, revision_number, change_kind, change_summary, element_count, created_at, scene_content_blobs(storage_path, byte_size, uncompressed_byte_size)",
        )
        .eq("id", scene.current_revision_id)
        .single();
      if (error) {
        throw error;
      }
      const blobInfo = Array.isArray(revision.scene_content_blobs)
        ? revision.scene_content_blobs[0]
        : revision.scene_content_blobs;
      const { data: stored, error: downloadError } = await admin.storage
        .from("scene-content")
        .download(blobInfo.storage_path);
      if (downloadError || !stored) {
        throw downloadError || new Error("not_found");
      }
      return response(request, 200, {
        scene,
        revision: { ...revision, scene_content_blobs: undefined },
        document: await decodeScene(stored),
      });
    }

    if (method === "PUT" && parts.length === 2) {
      const requestId = requireRequestId(body.requestId);
      const encoded = await encodeScene(body.document);
      const storagePath = `${sceneId}/${encoded.sha256}.json.gz`;
      const { error: uploadError } = await admin.storage
        .from("scene-content")
        .upload(storagePath, encoded.compressed, {
          contentType: "application/vnd.excalidraw+json",
          upsert: false,
        });
      if (uploadError && !uploadError.message.toLowerCase().includes("exist")) {
        throw uploadError;
      }
      const { data, error } = await client.rpc("cloud_commit_scene_revision", {
        target_scene_id: sceneId,
        expected_revision_number: body.expectedRevisionNumber,
        blob_sha256: encoded.sha256,
        blob_storage_path: storagePath,
        blob_byte_size: encoded.compressed.byteLength,
        blob_uncompressed_byte_size: encoded.bytes.byteLength,
        actor_email: user.email || "Unknown user",
        request_id: requestId,
        change_kind: body.changeKind || "edit",
        change_summary: body.changeSummary || null,
        element_count: Array.isArray(body.document?.elements)
          ? body.document.elements.length
          : 0,
        asset_ids: Array.isArray(body.assetIds) ? body.assetIds : [],
      });
      if (error) {
        throw error;
      }
      return response(request, 200, data);
    }

    if (method === "GET" && parts[2] === "history") {
      const { data: history, error: historyError } = await client.rpc(
        "cloud_scene_history",
        { target_scene_id: sceneId },
      );
      if (historyError) {
        throw historyError;
      }
      return response(request, 200, history);
    }

    if (method === "POST" && parts[2] === "restore-revision") {
      const { data, error } = await client.rpc("cloud_restore_scene_revision", {
        target_scene_id: sceneId,
        source_revision_id: requireUuid(body.revisionId),
        actor_email: user.email || "Unknown user",
        request_id: requireRequestId(body.requestId),
      });
      if (error) {
        throw error;
      }
      return response(request, 200, data);
    }

    if (method === "PATCH" && parts.length === 2) {
      if (scene.owner_id !== user.id && body.action !== "rename") {
        throw new Error("forbidden");
      }
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      let action = "scene.rename";
      if (body.action === "delete") {
        if (scene.status === "deleted") {
          throw new Error("invalid_action");
        }
        patch.status = "deleted";
        patch.deleted_at = new Date().toISOString();
        action = "scene.delete";
      } else if (body.action === "restore") {
        if (
          scene.status !== "deleted" ||
          !scene.deleted_at ||
          Date.now() - new Date(scene.deleted_at).getTime() >
            30 * 24 * 60 * 60 * 1000
        ) {
          throw new Error("restore_window_expired");
        }
        if (scene.collection_id) {
          const { data: collection, error: collectionError } = await admin
            .from("boardy_collections")
            .select("status")
            .eq("id", scene.collection_id)
            .single();
          if (collectionError) {
            throw collectionError;
          }
          if (collection.status !== "active") {
            const { data: fallback, error: fallbackError } = await admin
              .from("boardy_collections")
              .select("id")
              .eq("workspace_id", scene.workspace_id)
              .eq("owner_id", user.id)
              .eq("status", "active")
              .order("created_at")
              .limit(1)
              .maybeSingle();
            if (fallbackError || !fallback) {
              throw (
                fallbackError || new Error("restore_collection_unavailable")
              );
            }
            patch.collection_id = fallback.id;
          }
        }
        patch.status = "active";
        patch.deleted_at = null;
        action = "scene.restore";
      } else if (
        body.action === "rename" &&
        typeof body.title === "string" &&
        body.title.trim()
      ) {
        patch.title = body.title.trim().slice(0, 240);
      } else {
        throw new Error("invalid_action");
      }
      const { data, error } = await admin
        .from("scenes")
        .update(patch)
        .eq("id", sceneId)
        .select(selectScene)
        .single();
      if (error) {
        throw error;
      }
      await admin.from("scene_audit_events").insert({
        scene_id: sceneId,
        actor_id: user.id,
        action,
        request_id: requireRequestId(body.requestId),
        details: body.action === "rename" ? { title: patch.title } : {},
      });
      return response(request, 200, { scene: data });
    }
    throw new Error("not_found");
  } catch (error) {
    console.error("scenes request failed", error);
    return cloudErrorResponse(request, error);
  }
});
