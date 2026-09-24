import { authenticate, response } from "../_shared/agentic.ts";
import {
  cloudErrorResponse,
  decodeScene,
  encodeScene,
  requireRequestId,
  requireUuid,
} from "../_shared/cloud.ts";
import { requireProAccess } from "../_shared/pro.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return response(request, 204, {});
  }
  try {
    const { admin, client, user } = await authenticate(request);
    const envelope = await request.json();
    const method = String(envelope.method || "GET").toUpperCase();
    const parts = String(envelope.path || "templates")
      .split("/")
      .filter(Boolean);
    const body = envelope.body || {};
    if (parts[0] !== "templates") {
      throw new Error("not_found");
    }

    if (method === "GET" && parts.length === 1) {
      const { data, error } = await client
        .from("personal_templates")
        .select(
          "id, name, description, category, status, current_revision_id, created_at, updated_at",
        )
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) {
        throw error;
      }
      return response(request, 200, {
        templates: (data || []).map((item) => ({
          id: item.id,
          title: item.name,
          category: item.category,
          elements: [],
          files: {},
        })),
      });
    }

    if (method === "POST" && parts.length === 1) {
      await requireProAccess(admin, user.id);
      requireRequestId(body.requestId);
      const encoded = await encodeScene(body.document);
      const templateId = crypto.randomUUID();
      const storagePath = `templates/${user.id}/${templateId}/${encoded.sha256}.json.gz`;
      const { data: existingBlob, error: lookupError } = await admin
        .from("scene_content_blobs")
        .select("id")
        .eq("sha256", encoded.sha256)
        .maybeSingle();
      if (lookupError) {
        throw lookupError;
      }
      let blob = existingBlob;
      if (!blob) {
        const { error: uploadError } = await admin.storage
          .from("scene-content")
          .upload(storagePath, encoded.compressed, {
            contentType: "application/vnd.excalidraw+json",
            upsert: false,
          });
        if (uploadError) {
          throw uploadError;
        }
        const { data: insertedBlob, error: blobError } = await admin
          .from("scene_content_blobs")
          .insert({
            sha256: encoded.sha256,
            storage_path: storagePath,
            byte_size: encoded.compressed.byteLength,
            uncompressed_byte_size: encoded.bytes.byteLength,
          })
          .select("id")
          .single();
        if (blobError) {
          throw blobError;
        }
        blob = insertedBlob;
      }
      const { error: templateError } = await admin
        .from("personal_templates")
        .insert({
          id: templateId,
          owner_id: user.id,
          name: String(body.name || "Untitled template")
            .trim()
            .slice(0, 240),
          description: String(body.description || "").slice(0, 2000),
          category: String(body.category || "Custom").slice(0, 100),
        });
      if (templateError) {
        throw templateError;
      }
      const { data: revision, error: revisionError } = await admin
        .from("personal_template_revisions")
        .insert({
          template_id: templateId,
          revision_number: 1,
          content_blob_id: blob.id,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (revisionError) {
        throw revisionError;
      }
      await admin
        .from("personal_templates")
        .update({ current_revision_id: revision.id })
        .eq("id", templateId)
        .eq("owner_id", user.id);
      return response(request, 201, {
        templateId,
        revisionId: revision.id,
        revisionNumber: 1,
      });
    }

    const templateId = requireUuid(parts[1]);
    const { data: template } = await client
      .from("personal_templates")
      .select(
        "id, owner_id, name, category, current_revision_id, status, personal_template_revisions!personal_templates_current_revision_fk(scene_content_blobs(storage_path))",
      )
      .eq("id", templateId)
      .maybeSingle();
    if (!template || template.owner_id !== user.id) {
      throw new Error("not_found");
    }

    if (method === "GET" && parts.length === 2) {
      const relation = Array.isArray(template.personal_template_revisions)
        ? template.personal_template_revisions[0]
        : template.personal_template_revisions;
      const blobRelation = relation?.scene_content_blobs;
      const blobPath = (
        Array.isArray(blobRelation) ? blobRelation[0] : blobRelation
      )?.storage_path;
      if (!blobPath) {
        throw new Error("not_found");
      }
      const { data: stored, error: downloadError } = await admin.storage
        .from("scene-content")
        .download(blobPath);
      if (downloadError || !stored) {
        throw downloadError || new Error("not_found");
      }
      const document = await decodeScene(stored);
      return response(request, 200, {
        template: {
          id: template.id,
          title: template.name,
          category: template.category,
          elements: document.elements || [],
          files: document.files || {},
        },
      });
    }

    if (method === "PATCH" && parts.length === 2) {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (body.action === "delete") {
        patch.status = "deleted";
        patch.deleted_at = new Date().toISOString();
      } else if (body.action === "restore") {
        patch.status = "active";
        patch.deleted_at = null;
      } else {
        if (typeof body.name === "string" && body.name.trim()) {
          patch.name = body.name.trim().slice(0, 240);
        }
        if (typeof body.description === "string") {
          patch.description = body.description.slice(0, 2000);
        }
        if (typeof body.category === "string" && body.category.trim()) {
          patch.category = body.category.trim().slice(0, 100);
        }
      }
      const { data, error } = await admin
        .from("personal_templates")
        .update(patch)
        .eq("id", templateId)
        .eq("owner_id", user.id)
        .select(
          "id, name, description, category, status, current_revision_id, updated_at",
        )
        .single();
      if (error) {
        throw error;
      }
      return response(request, 200, { template: data });
    }
    throw new Error("not_found");
  } catch (error) {
    return cloudErrorResponse(request, error);
  }
});
