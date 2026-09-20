// Fixed-origin reverse proxy. No arbitrary upstream, cookies, or private board URLs.
const isPublicPath = (path: string) =>
  /^\/learn(?:\/[a-z0-9-]+(?:\.md)?)?$/.test(path) ||
  ["/ai", "/llms.txt", "/llms-full.txt", "/sitemap.xml"].includes(path);
const contentType = (path: string) => {
  if (path === "/ai" || path === "/mcp")
    return "application/json; charset=utf-8";
  if (path === "/sitemap.xml") return "application/xml; charset=utf-8";
  if (path.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (path.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "text/html; charset=utf-8";
};

export default {
  async fetch(request: Request) {
    const incoming = new URL(request.url);
    const path = incoming.searchParams.get("path") || "/learn";
    if (path !== "/mcp" && !isPublicPath(path))
      return new Response("Not found", { status: 404 });
    if (
      path === "/mcp"
        ? request.method !== "POST"
        : !["GET", "HEAD"].includes(request.method)
    )
      return new Response(null, {
        status: 405,
        headers: { Allow: path === "/mcp" ? "POST" : "GET, HEAD" },
      });
    const upstream = new URL(
      "https://hdrigcjadfaatdruyfza.supabase.co/functions/v1/discovery",
    );
    upstream.searchParams.set("path", path);
    if (/^\d{1,6}$/.test(incoming.searchParams.get("page") || ""))
      upstream.searchParams.set("page", incoming.searchParams.get("page")!);
    const headers = new Headers();
    for (const name of [
      "user-agent",
      "referer",
      "accept",
      "content-type",
      "origin",
      "dnt",
      "mcp-protocol-version",
    ]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    let body: string | undefined;
    if (request.method === "POST") {
      if (Number(request.headers.get("content-length") || 0) > 16384)
        return new Response(null, { status: 413 });
      body = await request.text();
      if (body.length > 16384) return new Response(null, { status: 413 });
    }
    try {
      const result = await fetch(upstream, {
        method: request.method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      // Supabase's default host intentionally normalizes HTML response types.
      // Restore HTML only for our allowlisted, owned documentation routes.
      const type =
        path === "/mcp" ? "application/json; charset=utf-8" : contentType(path);
      const responseHeaders = new Headers({
        "content-type": result.ok ? type : "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
        "content-security-policy":
          "default-src 'none'; style-src 'self'; img-src 'self' https://hdrigcjadfaatdruyfza.supabase.co; font-src 'self'; script-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      });
      if (path.endsWith(".md"))
        responseHeaders.set(
          "Link",
          `<https://boardy.sbs${path.slice(0, -3)}>; rel="canonical"`,
        );
      return new Response(result.body, {
        status: result.status,
        headers: responseHeaders,
      });
    } catch {
      return new Response(
        "Boardy documentation is temporarily unavailable. Please try again.",
        { status: 502, headers: { "cache-control": "no-store" } },
      );
    }
  },
};
