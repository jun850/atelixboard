import type { authenticate } from "./agentic.ts";

type AdminClient = Awaited<ReturnType<typeof authenticate>>["admin"];

const ENTITLEMENT = "boardybyatelix_pro";

export const syncProAccess = async (admin: AdminClient, userId: string) => {
  const { data: allowlisted, error: allowlistError } = await admin
    .from("boardy_subscription_allowlist")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (allowlistError) {
    throw allowlistError;
  }

  let active = Boolean(allowlisted);
  if (!active) {
    const { data: cached, error: cacheError } = await admin
      .from("boardy_pro_verifications")
      .select("verified_until")
      .eq("user_id", userId)
      .maybeSingle();
    if (cacheError) {
      throw cacheError;
    }
    if (cached && new Date(cached.verified_until).getTime() > Date.now()) {
      return true;
    }
    const secret = Deno.env.get("REVENUECAT_SECRET_API_KEY");
    if (secret) {
      const result = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
        {
          headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
          signal: AbortSignal.timeout(6000),
        },
      );
      if (!result.ok && result.status !== 404) {
        throw new Error("billing_unavailable");
      }
      if (result.ok) {
        const payload = await result.json();
        const entitlement = payload?.subscriber?.entitlements?.[ENTITLEMENT];
        const expiresAt = entitlement?.expires_date;
        active = Boolean(
          entitlement &&
            (expiresAt === null ||
              (typeof expiresAt === "string" &&
                new Date(expiresAt).getTime() > Date.now())),
        );
      }
    }
  }

  if (active) {
    const { error } = await admin.from("boardy_pro_verifications").upsert({
      user_id: userId,
      verified_until: new Date(Date.now() + 60_000).toISOString(),
    });
    if (error) {
      throw error;
    }
  } else {
    const { error } = await admin
      .from("boardy_pro_verifications")
      .delete()
      .eq("user_id", userId);
    if (error) {
      throw error;
    }
  }
  return active;
};

export const requireProAccess = async (admin: AdminClient, userId: string) => {
  if (!(await syncProAccess(admin, userId))) {
    throw new Error("pro_required");
  }
};
