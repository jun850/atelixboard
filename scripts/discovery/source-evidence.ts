import { lookup } from "node:dns/promises";
import { request } from "node:https";
export const normalizedQuote = (text: string) =>
  text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .toLowerCase()
    .trim();
const publicV4 = (ip: string) => {
  const [a, b] = ip.split(".").map(Number);
  return (
    ![0, 10, 127].includes(a) &&
    a < 224 &&
    !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && b === 168) &&
    !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 198 && (b === 18 || b === 19))
  );
};
export async function fetchEvidence(
  url: string,
  redirects = 0,
): Promise<string> {
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443") ||
    redirects > 3
  ) {
    throw Error("Unsafe evidence URL");
  }
  const addresses = await lookup(u.hostname, { family: 4, all: true });
  if (!addresses.length || addresses.some((a) => !publicV4(a.address))) {
    throw Error("Evidence must use a public website");
  }
  return new Promise((resolve, reject) => {
    const req = request(
      u,
      {
        headers: {
          "user-agent": "BoardyEvidenceVerifier/1.0",
          accept: "text/html,text/plain",
        },
        lookup: (_host, options: any, callback: any) =>
          options.all
            ? callback(null, [addresses[0]])
            : callback(null, addresses[0].address, 4),
      },
      (res) => {
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode || 0) &&
          res.headers.location
        ) {
          res.resume();
          resolve(
            fetchEvidence(new URL(res.headers.location, u).href, redirects + 1),
          );
          return;
        }
        if (
          res.statusCode !== 200 ||
          !/text\/(html|plain)/.test(res.headers["content-type"] || "")
        ) {
          res.resume();
          reject(Error("Source unavailable for verification"));
          return;
        }
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          text += chunk;
          if (text.length > 1500000) {
            req.destroy(Error("Evidence page too large"));
          }
        });
        res.on("end", () => resolve(text));
        res.on("error", reject);
      },
    );
    req.setTimeout(15000, () =>
      req.destroy(Error("Evidence request timed out")),
    );
    req.on("error", reject);
    req.end();
  });
}
export async function verifyPromptEvidence(
  result: any,
  fetcher = fetchEvidence,
  signal?: AbortSignal,
) {
  const cache = new Map<string, string>();
  for (const p of result.prompts || []) {
    signal?.throwIfAborted();
    if (!Array.isArray(p.evidence) || !p.evidence.length) {
      throw Error("Each prompt needs a retrieved buyer-language quote");
    }
    for (const source of p.sources || []) {
      signal?.throwIfAborted();
      const evidence = p.evidence.find((e: any) => e.url === source);
      const quote = normalizedQuote(String(evidence?.quote || ""));
      if (quote.length < 25 || quote.length > 1000) {
        throw Error("Missing or invalid source quote");
      }
      if (!cache.has(source)) {
        cache.set(source, normalizedQuote(await fetcher(source)));
      }
      if (!cache.get(source)!.includes(quote)) {
        throw Error(
          "Buyer evidence quote could not be verified. Review the source and retry.",
        );
      }
      evidence.verifiedAt = new Date().toISOString();
    }
  }
  return result;
}
