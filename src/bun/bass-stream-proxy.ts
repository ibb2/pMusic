import { randomUUID } from "node:crypto";

const WORKER_START_TIMEOUT_MS = 5_000;
const TARGET_REGISTRATION_TIMEOUT_MS = 2_000;

export class BassStreamProxy {
  private readonly idsByTarget = new Map<string, string>();
  private readonly worker: Worker;
  private readonly port: number;

  constructor() {
    const ready = new Int32Array(
      new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2),
    );
    this.worker = new Worker(
      new URL("bass-stream-proxy-worker.ts", import.meta.url).href,
    );
    this.worker.postMessage({ type: "start", ready: ready.buffer });

    if (Atomics.wait(ready, 0, 0, WORKER_START_TIMEOUT_MS) === "timed-out") {
      this.worker.terminate();
      throw new Error("BASS stream proxy worker did not start");
    }

    this.port = Atomics.load(ready, 1);
    if (!this.port) {
      this.worker.terminate();
      throw new Error("BASS stream proxy worker failed to bind a port");
    }
  }

  urlFor(targetUrl: string): string {
    let id = this.idsByTarget.get(targetUrl);
    if (!id) {
      id = randomUUID();
      this.idsByTarget.set(targetUrl, id);
      this.registerTarget(id, targetUrl);
    }
    return `http://127.0.0.1:${this.port}/${id}`;
  }

  dispose(): void {
    this.idsByTarget.clear();
    this.worker.postMessage({ type: "stop" });
    this.worker.terminate();
  }

  private registerTarget(id: string, targetUrl: string): void {
    const ready = new Int32Array(
      new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT),
    );
    this.worker.postMessage({
      type: "register",
      id,
      targetUrl,
      ready: ready.buffer,
    });
    if (
      Atomics.wait(ready, 0, 0, TARGET_REGISTRATION_TIMEOUT_MS) === "timed-out"
    ) {
      throw new Error("BASS stream proxy target registration timed out");
    }
  }
}
