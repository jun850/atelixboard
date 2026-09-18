import { authenticate, response } from "../_shared/agentic.ts";
import {
  cloudErrorResponse,
  requireRequestId,
  requireUuid,
} from "../_shared/cloud.ts";

const allowedMediaType =
  /^(image\/(png|jpeg|gif|webp|avif|svg\+xml)|video\/(mp4|webm|quicktime)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|text\/(plain|csv)|application\/(json|zip))$/;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return response(request, 204, {});
  }
  try {
    const { admin, client, user } = await authenticate(request);
    const envelope = await request.json();
    const method = String(envelope.method || "POST").toUpperCase();
    const parts = String(envelope.path || "assets")
      .split("/")
      .filter(Boolean);
    const body = envelope.body || {};
    if (parts[0] !== "assets") {
      throw new Error("not_found");
    }

    if (method === "POST" && parts[1] === "intent") {
      const sceneId = requireUuid(body.sceneId);
      const byteSize = Number(body.byteSize);
      const mediaType = String(body.mediaType || "").toLowerCase();
      if (
        !Number.isSafeInteger(byteSize) ||
        byteSize < 1 ||
        byteSize > 500 * 1024 * 1024 ||
        !allowedMediaType.test(mediaType)
      ) {
        throw new Error("limit");
      }
      const { data: scene } = await client
        .from("scenes")
        .select("id")
        .eq("id", sceneId)
        .eq("status", "active")
        .maybeSingle();
      if (!scene) {
        throw new Error("forbidden");
      }
      const assetId = crypto.randomUUID();
      const extension =
        String(body.fileName || "file")
          .split(".")
          .pop()
          ?.replace(/[^a-z0-9]/gi, "")
          .slice(0, 12) || "bin";
      const storagePath = `${sceneId}/${assetId}/original.${extension}`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const { error: assetError } = await admin.from("scene_assets").insert({
        id: assetId,
        scene_id: sceneId,
        owner_id: user.id,
        source_kind: "upload",
        original_name: String(body.fileName || "file").slice(0, 512),
        media_type: mediaType,
        byte_size: byteSize,
        storage_path: storagePath,
        status: "pending",
      });
      if (assetError) {
        throw assetError;
      }
      const { data: intent, error: intentError } = await admin
        .from("scene_upload_intents")
        .insert({
          scene_id: sceneId,
          asset_id: assetId,
          user_id: user.id,
          storage_path: storagePath,
          expected_byte_size: byteSize,
          expected_media_type: mediaType,
          expires_at: expiresAt,
        })
        .select("id")
        .single();
      if (intentError) {
        throw intentError;
      }
      const { data: signed, error: signedError } = await admin.storage
        .from("scene-staging")
        .createSignedUploadUrl(storagePath);
      if (signedError) {
        throw signedError;
      }
      return response(request, 201, {
        assetId,
        intentId: intent.id,
        storagePath,
        expiresAt,
        token: signed.token,
        signedUrl: signed.signedUrl,
      });
    }

    if (method === "POST" && parts[1] === "import-url") {
      const sceneId = requireUuid(body.sceneId);
      const sourceUrl = new URL(String(body.url || ""));
      if (!["http:", "https:"].includes(sourceUrl.protocol)) {
        throw new Error("invalid_url");
      }
      const { data: scene } = await client
        .from("scenes")
        .select("id")
        .eq("id", sceneId)
        .eq("status", "active")
        .maybeSingle();
      if (!scene) {
        throw new Error("forbidden");
      }
      const { data: asset, error } = await admin
        .from("scene_assets")
        .insert({
          scene_id: sceneId,
          owner_id: user.id,
          source_kind: body.sourceKind === "cdn" ? "cdn" : "url",
          source_url: sourceUrl.toString(),
          media_type: "application/octet-stream",
          status: "pending",
        })
        .select("id")
        .single();
      if (error) {
        throw error;
      }
      await admin.from("scene_processing_jobs").insert({
        scene_id: sceneId,
        asset_id: asset.id,
        job_kind: "import_url",
      });
      await admin.from("scene_audit_events").insert({
        scene_id: sceneId,
        actor_id: user.id,
        action: "asset.add",
        request_id: requireRequestId(body.requestId),
        details: {
          assetId: asset.id,
          sourceKind: body.sourceKind === "cdn" ? "cdn" : "url",
        },
      });
      return response(request, 202, { assetId: asset.id, status: "pending" });
    }

    const assetId = requireUuid(parts[1]);
    const { data: asset } = await client
      .from("scene_assets")
      .select("id, scene_id, storage_path, status")
      .eq("id", assetId)
      .maybeSingle();
    if (!asset) {
      throw new Error("not_found");
    }

    if (method === "POST" && parts[2] === "finalize") {
      const { data: objects, error: listError } = await admin.storage
        .from("scene-staging")
        .list(`${asset.scene_id}/${assetId}`, { limit: 10 });
      if (listError || !objects?.length) {
        throw listError || new Error("not_found");
      }
      const file = objects.find((item) => !item.id?.endsWith("/"));
      if (!file) {
        throw new Error("not_found");
      }
      const stagedPath = `${asset.scene_id}/${assetId}/${file.name}`;
      const finalPath = asset.storage_path;
      const { data: blob, error: downloadError } = await admin.storage
        .from("scene-staging")
        .download(stagedPath);
      if (downloadError || !blob) {
        throw downloadError || new Error("not_found");
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const sha256 = [...new Uint8Array(digest)]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
      const { error: finalUploadError } = await admin.storage
        .from("scene-assets")
        .upload(finalPath, bytes, {
          contentType: blob.type || "application/octet-stream",
          upsert: false,
        });
      if (
        finalUploadError &&
        !finalUploadError.message.toLowerCase().includes("exist")
      ) {
        throw finalUploadError;
      }
      await admin
        .from("scene_assets")
        .update({
          sha256,
          byte_size: bytes.byteLength,
          status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", assetId);
      await admin
        .from("scene_upload_intents")
        .update({ status: "uploaded" })
        .eq("asset_id", assetId)
        .eq("user_id", user.id);
      await admin.from("scene_processing_jobs").insert({
        scene_id: asset.scene_id,
        asset_id: assetId,
        job_kind: "inspect",
      });
      await admin.storage.from("scene-staging").remove([stagedPath]);
      return response(request, 202, { assetId, status: "processing", sha256 });
    }

    if (method === "GET" && parts[2] === "access") {
      const [{ data: original }, { data: variants }] = await Promise.all([
        admin.storage
          .from("scene-assets")
          .createSignedUrl(asset.storage_path, 300),
        admin
          .from("scene_asset_variants")
          .select(
            "variant_kind, media_type, byte_size, width, height, storage_path",
          )
          .eq("asset_id", assetId),
      ]);
      const signedVariants = await Promise.all(
        (variants || []).map(async (variant) => ({
          ...variant,
          url: (
            await admin.storage
              .from("scene-assets")
              .createSignedUrl(variant.storage_path, 300)
          ).data?.signedUrl,
        })),
      );
      return response(request, 200, {
        assetId,
        status: asset.status,
        originalUrl: original?.signedUrl,
        variants: signedVariants,
        expiresIn: 300,
      });
    }
    throw new Error("not_found");
  } catch (error) {
    return cloudErrorResponse(request, error);
  }
});
