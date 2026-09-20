import { describe, it, expect, vi, afterEach } from "vitest";
import {
  articles,
  publicContent,
  classifyTraffic,
  markdown,
} from "../../supabase/functions/_shared/discovery-content";
import { mcpResult } from "../../supabase/functions/_shared/discovery-mcp";
import proxy from "../../api/discovery";
afterEach(() => vi.unstubAllGlobals());
describe("public discovery", () => {
  it("serves the same factual content in HTML and markdown with canonical URLs", () => {
    for (const a of articles) {
      const html = publicContent(`/learn/${a.slug}`);
      expect(html.type).toContain("text/html");
      expect(html.body).toContain(
        `<link rel="canonical" href="https://boardy.sbs/learn/${a.slug}">`,
      );
      for (const [heading] of a.sections) expect(html.body).toContain(heading);
      expect(publicContent(`/learn/${a.slug}.md`).body).toBe(markdown(a));
    }
  });
  it("rejects missing/private paths instead of returning the SPA", () => {
    for (const path of [
      "/learn/unknown",
      "/app/boards/secret",
      "/learn/../app",
      "https://evil.test",
    ])
      expect(publicContent(path).status).toBe(404);
  });
  it("sitemap includes guides and excludes private routes", () => {
    const xml = publicContent("/sitemap.xml").body;
    expect(xml).toContain("https://boardy.sbs/learn/what-is-boardy-ai");
    expect(xml).not.toContain("/app");
  });
  it("distinguishes bots, referrals, unknown traffic and lookalike domains", () => {
    expect(classifyTraffic("OAI-SearchBot", "https://chatgpt.com")).toEqual({
      kind: "crawler",
      source: "OpenAI search",
    });
    expect(classifyTraffic("Mozilla", "https://chatgpt.com/c/foo").kind).toBe(
      "ai_referral",
    );
    expect(
      classifyTraffic("Mozilla", "https://chatgpt.com.evil.test").kind,
    ).toBe("page_request");
    expect(classifyTraffic("Mozilla", "").source).toBe("Direct or unknown");
    expect(classifyTraffic("GPTBot", "").source).toBe("OpenAI training");
  });
});
describe("MCP", () => {
  const call = (method: string, params?: unknown) =>
    mcpResult({ jsonrpc: "2.0", id: 1, method, params });
  it("announces only public read-only capabilities", () => {
    expect(call("initialize")).toHaveProperty(
      "result.protocolVersion",
      "2025-06-18",
    );
    const result = JSON.stringify(call("tools/list"));
    expect(result).toContain("get_boardy_facts");
    expect(result).not.toContain("create_board");
  });
  it("reads and searches owned docs without accepting remote resource URLs", () => {
    expect(
      JSON.stringify(call("tools/call", { name: "get_boardy_facts" })),
    ).toContain("Boardy");
    expect(
      JSON.stringify(
        call("tools/call", {
          name: "search_boardy_docs",
          arguments: { query: "flowchart" },
        }),
      ),
    ).toContain("flowchart");
    expect(call("resources/read", { uri: "https://evil.test" })).toHaveProperty(
      "error.code",
      -32602,
    );
  });
  it("handles notifications, unknown tools, invalid JSON-RPC and invalid queries", () => {
    expect(
      mcpResult({ jsonrpc: "2.0", method: "notifications/initialized" }),
    ).toBeNull();
    expect(call("tools/call", { name: "delete_board" })).toHaveProperty(
      "error.code",
      -32602,
    );
    expect(mcpResult(null)).toHaveProperty("error.code", -32600);
    expect(
      call("tools/call", {
        name: "search_boardy_docs",
        arguments: { query: {} },
      }),
    ).toHaveProperty("error.code", -32602);
  });
});
describe("fixed-origin proxy", () => {
  it("does not fetch arbitrary paths or allow writes to documentation", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(
      (
        await proxy.fetch(
          new Request(
            "https://boardy.sbs/api/discovery?path=https://evil.test",
          ),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await proxy.fetch(
          new Request("https://boardy.sbs/api/discovery?path=/learn", {
            method: "POST",
          }),
        )
      ).status,
    ).toBe(405);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("strips credentials, preserves attribution, restores owned HTML, and refuses redirect following", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response("owned HTML", {
        headers: { "content-type": "text/plain" },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const result = await proxy.fetch(
      new Request("https://boardy.sbs/api/discovery?path=/learn", {
        headers: {
          cookie: "private",
          authorization: "Bearer secret",
          "user-agent": "OAI-SearchBot",
          referer: "https://chatgpt.com/",
        },
      }),
    );
    expect(result.headers.get("content-type")).toContain("text/html");
    const [url, options] = fetcher.mock.calls[0];
    expect(url.hostname).toBe("hdrigcjadfaatdruyfza.supabase.co");
    expect(options.redirect).toBe("error");
    expect(options.headers.has("authorization")).toBe(false);
    expect(options.headers.has("cookie")).toBe(false);
    expect(options.headers.get("user-agent")).toBe("OAI-SearchBot");
  });
  it("fails clearly without caching upstream failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await proxy.fetch(
      new Request("https://boardy.sbs/api/discovery?path=/learn"),
    );
    expect(result.status).toBe(502);
    expect(result.headers.get("cache-control")).toBe("no-store");
  });
});
