import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const result = spawnSync("supabase", ["status", "-o", "env"], {
  cwd: process.cwd(),
  encoding: "utf8",
});
if (result.status !== 0) {
  throw new Error("Local Supabase is unavailable.");
}
const values = Object.fromEntries(
  result.stdout
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^"|"$/g, "")]),
);
const url = values.API_URL;
const serviceKey = values.SERVICE_ROLE_KEY;
if (!url?.includes("127.0.0.1") || !serviceKey) {
  throw new Error("Refusing to create a QA account outside local Supabase.");
}
const email = "boardy-free-qa-20260923@localhost.test";
const password = "BoardyFreeQA!2026-09-23";
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Boardy Free QA" },
});
if (createError && !createError.message.includes("already been registered")) {
  throw createError;
}
const anon = createClient(url, values.ANON_KEY, {
  auth: { persistSession: false },
});
const { data: login, error: loginError } = await anon.auth.signInWithPassword({
  email,
  password,
});
if (loginError || !login.user) {
  throw loginError || new Error("Local sign-in failed.");
}
const { data: allowlist } = await admin
  .from("boardy_subscription_allowlist")
  .select("user_id")
  .eq("user_id", login.user.id)
  .maybeSingle();
if (allowlist) {
  throw new Error("QA account is allowlisted for Pro; expected free.");
}
console.log(JSON.stringify({
  email,
  password,
  userId: login.user.id,
  created: Boolean(created.user),
  signInVerified: true,
  proAllowlisted: false,
}));
