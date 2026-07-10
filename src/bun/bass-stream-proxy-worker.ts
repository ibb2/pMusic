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
const PLEX_TRANSCODE_DECISION_TIMEOUT_MS = 8_000;
const PLEX_TRANSCODE_DECISION_CACHE_MS = 30_000;

const targets = new Map<string, string>();
const transcodePreparations = new Map<string, Promise<void>>();
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
  transcodePreparations.clear();
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
    await preparePlexTranscode(targetUrl, headers);
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

async function preparePlexTranscode(
  targetUrl: string,
  requestHeaders: Headers,
): Promise<void> {
  const decisionUrl = plexTranscodeDecisionUrl(targetUrl);
  if (!decisionUrl) return;

  let preparation = transcodePreparations.get(targetUrl);
  if (!preparation) {
    preparation = requestPlexTranscodeDecision(decisionUrl, requestHeaders);
    transcodePreparations.set(targetUrl, preparation);
    void preparation.then(
      () => {
        setTimeout(() => {
          if (transcodePreparations.get(targetUrl) === preparation) {
            transcodePreparations.delete(targetUrl);
          }
        }, PLEX_TRANSCODE_DECISION_CACHE_MS);
      },
      () => {},
    );
  }

  try {
    await preparation;
  } catch (error) {
    transcodePreparations.delete(targetUrl);
    throw error;
  }
}

function plexTranscodeDecisionUrl(targetUrl: string): string | null {
  const url = new URL(targetUrl);
  if (url.pathname !== "/music/:/transcode/universal/start") return null;
  url.pathname = "/music/:/transcode/universal/decision";
  return url.toString();
}

async function requestPlexTranscodeDecision(
  decisionUrl: string,
  requestHeaders: Headers,
): Promise<void> {
  const headers = new Headers(requestHeaders);
  headers.set("Accept", "application/json");
  const response = await fetch(decisionUrl, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(PLEX_TRANSCODE_DECISION_TIMEOUT_MS),
    redirect: "follow",
  });
  await response.body?.cancel();
  if (!response.ok) {
    throw new Error(`Plex transcode decision failed: ${response.status}`);
  }
}
