import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const result = spawnSync("supabase", ["status", "-o", "env"], {
  cwd: process.cwd(), encoding: "utf8",
});
if (result.status !== 0) throw new Error("Local Supabase unavailable");
const values = Object.fromEntries(result.stdout.split("\n")
  .map((line) => line.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean)
  .map((match) => [match[1], match[2].replace(/^"|"$/g, "")]));
if (!values.API_URL?.includes("127.0.0.1")) throw new Error("Local only");
const client = createClient(values.API_URL, values.ANON_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await client.auth.signInWithPassword({
  email: "boardy-pro-qa-20260923@localhost.test",
  password: "BoardyProQA!2026-09-23",
});
if (error || !data.session) throw error || new Error("Auth failed");
const sceneId = "faa05d85-7b2c-4cce-bdcb-e9b9d8a244b1";
const call = async (fn, path, method, body) => {
  const response = await fetch(`${values.API_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      apikey: values.ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path, method, body }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${fn}/${path}: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
};
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL2LAAAAABJRU5ErkJggg==", "base64");
const intent = await call("scene-assets", "assets/intent", "POST", {
  sceneId, fileName: "qa-dot.png", mediaType: "image/png", byteSize: png.length,
});
const { error: uploadError } = await client.storage.from("scene-staging")
  .uploadToSignedUrl(intent.storagePath, intent.token, new Blob([png], { type: "image/png" }), { contentType: "image/png" });
if (uploadError) throw uploadError;
await call("scene-assets", `assets/${intent.assetId}/finalize`, "POST");
const comment = await call("workspace", `comments/${sceneId}`, "POST", {
  message: "QA image attachment", anchorKind: "general", anchor: {}, attachmentAssetId: intent.assetId,
});
const loaded = await call("workspace", `comments/${sceneId}`, "GET");
const attached = loaded.threads?.some((thread) => thread.messages?.some((message) => message.attachment?.id === intent.assetId));
if (!attached) throw new Error("Attachment missing from loaded comments");
console.log(JSON.stringify({ intent: true, upload: true, finalize: true, comment: true, attachmentVisible: true, threadId: comment.thread?.id || null }));
