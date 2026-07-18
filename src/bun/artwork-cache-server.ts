import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

type ArtworkTarget = { cachePath: string; remoteUrl: string };

export class ArtworkCacheServer {
  private readonly targets = new Map<string, ArtworkTarget>();
  private readonly server: ReturnType<typeof Bun.serve>;

  constructor(private readonly directory: string) {
    mkdirSync(directory, { recursive: true });
    this.server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: (request) => this.handle(request),
    });
  }

  register(serverId: string, remoteUrl: string): string {
    const safeServerId = safeSegment(serverId);
    const serverDirectory = join(this.directory, safeServerId);
    mkdirSync(serverDirectory, { recursive: true });
    const hash = createHash("sha256").update(remoteUrl).digest("hex");
    const id = `${safeServerId}/${hash}`;
    this.targets.set(id, {
      cachePath: join(serverDirectory, hash),
      remoteUrl,
    });
    return this.url(id);
  }

  revive(cachedUrl: string): string {
    try {
      const match = /^\/artwork\/([^/]+\/[0-9a-f]{64})$/i.exec(
        new URL(cachedUrl).pathname,
      );
      return match ? this.url(match[1]) : cachedUrl;
    } catch {
      return cachedUrl;
    }
  }

  dispose(): void {
    this.targets.clear();
    void this.server.stop(true);
  }

  private async handle(request: Request): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405 });
    }
    const id = /^\/artwork\/([^/]+\/[0-9a-f]{64})$/i.exec(
      new URL(request.url).pathname,
    )?.[1];
    if (!id) return new Response(null, { status: 404 });
    const [serverId, hash] = id.split("/");
    const target = this.targets.get(id);
    const cachePath = target?.cachePath || join(this.directory, serverId, hash);

    let file = Bun.file(cachePath);
    if (!(await file.exists())) {
      if (!target) return new Response(null, { status: 404 });
      try {
        const response = await fetch(target.remoteUrl, {
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok)
          return new Response(null, { status: response.status });
        await Bun.write(cachePath, await response.arrayBuffer());
        file = Bun.file(cachePath, {
          type: response.headers.get("content-type") || "image/jpeg",
        });
      } catch {
        return new Response(null, { status: 503 });
      }
    }
    return new Response(request.method === "HEAD" ? null : file, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(file.size),
        "Content-Type": file.type || "image/jpeg",
      },
    });
  }

  private url(id: string): string {
    return `http://127.0.0.1:${this.server.port}/artwork/${id}`;
  }
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100) || "server";
}
