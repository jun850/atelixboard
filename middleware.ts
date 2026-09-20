import { next, waitUntil } from "@vercel/functions";

// Observe only the public home page, including clients that do not execute JS.
// Private workspace and authentication traffic never enters discovery telemetry.
export default function middleware(request: Request) {
  if (request.method === "GET" && request.headers.get("dnt") !== "1") {
    const headers = new Headers();
    for (const name of ["user-agent", "referer"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    waitUntil(
      fetch(
        "https://hdrigcjadfaatdruyfza.supabase.co/functions/v1/discovery?path=/traffic",
        { headers, signal: AbortSignal.timeout(3000) },
      )
        .then((result) => {
          if (!result.ok)
            console.error("Discovery homepage counter unavailable");
        })
        .catch(() => console.error("Discovery homepage counter unavailable")),
    );
  }
  return next();
}
export const config = { matcher: ["/"], runtime: "edge" };
