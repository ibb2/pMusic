const FORWARDED_REQUEST_HEADERS = ["accept", "if-range", "range"];
const FORWARDED_RESPONSE_HEADERS = [
  "accept-ranges",
  "cache-control",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
];

const targets = new Map<string, string>();
let server: ReturnType<typeof Bun.serve> | null = null;

self.onmessage = (event: MessageEvent) => {
  const message = event.data as
    | { type: "start"; ready: SharedArrayBuffer }
    | {
        type: "register";
        id: string;
        targetUrl: string;
        ready: SharedArrayBuffer;
      }
    | { type: "stop" };

  if (message.type === "start") {
    const ready = new Int32Array(message.ready);
    try {
      server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: handle });
      Atomics.store(ready, 1, server.port ?? 0);
    } finally {
      Atomics.store(ready, 0, 1);
      Atomics.notify(ready, 0);
    }
    return;
  }

  if (message.type === "register") {
    targets.set(message.id, message.targetUrl);
    const ready = new Int32Array(message.ready);
    Atomics.store(ready, 0, 1);
    Atomics.notify(ready, 0);
    return;
  }

  targets.clear();
  void server?.stop(true);
  self.close();
};

async function handle(request: Request): Promise<Response> {
  const id = new URL(request.url).pathname.slice(1);
  const targetUrl = targets.get(id);
  if (!targetUrl) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      headers,
      signal: request.signal,
      redirect: "follow",
    });
    const responseHeaders = new Headers();
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Upstream request failed",
      { status: 502 },
    );
  }
}
