import { randomUUID } from "node:crypto";
import { extname } from "node:path";

export interface RegisteredLocalFile {
  id: string;
  url: string;
}

interface LocalFileTarget {
  path: string;
  contentType?: string;
  extension: string;
}

const OPAQUE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Exposes only explicitly registered files to native audio decoders. File paths
 * never form part of the URL and cannot be supplied by a caller.
 */
export class LocalPlaybackServer {
  private readonly targets = new Map<string, LocalFileTarget>();
  private readonly server: ReturnType<typeof Bun.serve>;
  private disposed = false;

  constructor() {
    this.server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: (request) => this.handle(request),
    });
  }

  register(path: string, contentType?: string): RegisteredLocalFile {
    this.assertRunning();
    const id = randomUUID();
    const extension = formatExtension(path, contentType);
    this.targets.set(id, { path, contentType, extension });
    return {
      id,
      url: `http://127.0.0.1:${this.server.port}/media/${id}${extension}`,
    };
  }

  unregister(id: string): boolean {
    this.assertRunning();
    return this.targets.delete(id);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.targets.clear();
    void this.server.stop(true);
  }

  private async handle(request: Request): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    const url = new URL(request.url);
    const match = /^\/media\/([0-9a-f-]+)(\.[a-z0-9]+)?$/i.exec(url.pathname);
    const id = match?.[1];
    if (!id || !OPAQUE_ID.test(id)) return new Response(null, { status: 404 });

    const target = this.targets.get(id);
    if (!target || (match?.[2] ?? "") !== target.extension)
      return new Response(null, { status: 404 });
    const file = Bun.file(target.path);
    if (!(await file.exists())) return new Response(null, { status: 404 });

    const size = file.size;
    const contentType =
      (target.contentType ?? file.type) || "application/octet-stream";
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Content-Type": contentType,
    });
    const range = request.headers.get("range");

    if (!range) {
      headers.set("Content-Length", String(size));
      return new Response(request.method === "HEAD" ? null : file, { headers });
    }

    const parsed = parseSingleRange(range, size);
    if (!parsed) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    const { start, end } = parsed;
    headers.set("Content-Length", String(end - start + 1));
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    return new Response(
      request.method === "HEAD" ? null : file.slice(start, end + 1),
      { status: 206, headers },
    );
  }

  private assertRunning(): void {
    if (this.disposed) throw new Error("Local playback server is disposed");
  }
}

/**
 * Native stream decoders use the URL suffix as a format hint before reading
 * response bytes. Keep the registered URL opaque, but retain a conservative
 * audio extension so plugins such as BASSFLAC can select the right decoder.
 */
function formatExtension(path: string, contentType?: string): string {
  const fromPath = extname(path).toLowerCase();
  if (/^\.[a-z0-9]{1,10}$/.test(fromPath)) return fromPath;

  const normalizedType = contentType?.split(";", 1)[0]?.trim().toLowerCase();
  const byContentType: Record<string, string> = {
    "audio/flac": ".flac",
    "audio/x-flac": ".flac",
    "audio/ogg": ".ogg",
    "audio/opus": ".opus",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/aac": ".aac",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
  };
  return normalizedType ? (byContentType[normalizedType] ?? "") : "";
}

function parseSingleRange(
  value: string,
  size: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || size === 0) return null;
  const [, startText, endText] = match;
  if (!startText && !endText) return null;

  if (!startText) {
    const suffix = Number(endText);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(startText);
  const requestedEnd = endText ? Number(endText) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    requestedEnd < start ||
    start >= size
  )
    return null;
  return { start, end: Math.min(requestedEnd, size - 1) };
}
