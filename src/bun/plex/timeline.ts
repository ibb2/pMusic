import { hostname, platform, release } from "node:os";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  BassManager,
  BassPlaybackEvent,
  BassStopReason,
} from "../bass";
import type Authentication from "./authentication";
import type { PlaybackSettings, PlayerTrack } from "../../shared/rpc";
import type { PlexServer } from "../../shared/types";

type TimelineState = "playing" | "paused" | "stopped";

type ActiveTimelineSession = {
  sessionId: string;
  track: PlayerTrack;
  state: TimelineState;
  pausedTicks: number;
};

type TimelineResponse = {
  MediaContainer?: {
    terminationCode?: unknown;
    terminationText?: unknown;
  };
  rawText?: string;
  terminationCode?: unknown;
  terminationText?: unknown;
};

const PLEX_TIMELINE_TIMEOUT_MS = 8_000;
const PLAYING_HEARTBEAT_MS = 10_000;
const PAUSED_HEARTBEAT_TICKS = 6;
const RAYNA_VERSION = readPackageVersion();

export class PlexTimelineReporter {
  private activeBaseUrl: string | null = null;
  private activeSession: ActiveTimelineSession | null = null;
  private heartbeat: Timer | null = null;
  private unsubscribe: (() => void) | null = null;
  private handlingTermination = false;

  constructor(
    private readonly auth: Authentication,
    private readonly bass: BassManager,
    private readonly getPlaybackSettings: () => PlaybackSettings,
  ) {}

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.bass.onPlaybackEvent((event) =>
      this.handlePlaybackEvent(event),
    );
  }

  dispose(): void {
    this.stopHeartbeat();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.activeSession = null;
  }

  private handlePlaybackEvent(event: BassPlaybackEvent): void {
    if (!this.isEnabled()) {
      this.stopHeartbeat();
      this.activeSession = null;
      return;
    }

    if (this.handlingTermination) {
      if (event.type === "track-stopped" && event.reason === "remote") {
        this.stopHeartbeat();
        this.activeSession = null;
      }
      return;
    }

    if (event.type === "track-started") {
      this.startSession(event.track, event.position, event.duration);
      return;
    }

    if (event.type === "state-changed") {
      this.reportSessionState(
        event.track,
        event.state,
        event.position,
        event.duration,
      );
      return;
    }

    if (event.type === "seeked") {
      this.reportSessionState(
        event.track,
        event.isPlaying ? "playing" : "paused",
        event.position,
        event.duration,
      );
      return;
    }

    this.stopSession(event.reason, event.track, event.position, event.duration);
  }

  private startSession(
    track: PlayerTrack,
    position: number,
    duration: number,
  ): void {
    this.stopHeartbeat();
    this.activeSession = {
      sessionId: this.generateSessionId(),
      track,
      state: "playing",
      pausedTicks: 0,
    };
    void this.report("playing", track, position, duration);
    this.startHeartbeat();
  }

  private reportSessionState(
    track: PlayerTrack,
    state: "playing" | "paused",
    position: number,
    duration: number,
  ): void {
    const session = this.ensureSession(track);
    session.state = state;
    session.pausedTicks = 0;
    void this.report(state, track, position, duration);
    this.startHeartbeat();
  }

  private stopSession(
    reason: BassStopReason,
    track: PlayerTrack,
    position: number,
    duration: number,
  ): void {
    const session = this.activeSession;
    if (!session || session.track.ratingKey !== track.ratingKey) return;

    this.stopHeartbeat();
    this.activeSession = null;

    if (reason === "remote") return;
    void this.report("stopped", track, position, duration, session.sessionId);
  }

  private ensureSession(track: PlayerTrack): ActiveTimelineSession {
    if (this.activeSession?.track.ratingKey === track.ratingKey) {
      return this.activeSession;
    }

    this.activeSession = {
      sessionId: this.generateSessionId(),
      track,
      state: "playing",
      pausedTicks: 0,
    };
    return this.activeSession;
  }

  private startHeartbeat(): void {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => {
      const session = this.activeSession;
      if (!session || !this.isEnabled()) {
        this.stopHeartbeat();
        this.activeSession = null;
        return;
      }

      if (session.state === "paused") {
        session.pausedTicks += 1;
        if (session.pausedTicks < PAUSED_HEARTBEAT_TICKS) return;
        session.pausedTicks = 0;
      }

      const status = this.bass.getPlaybackStatus();
      void this.report(
        session.state,
        session.track,
        status.position,
        status.duration,
      );
    }, PLAYING_HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (!this.heartbeat) return;
    clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private async report(
    state: TimelineState,
    track: PlayerTrack,
    positionSeconds: number,
    durationSeconds: number,
    sessionIdOverride?: string,
  ): Promise<void> {
    if (!this.isEnabled()) return;

    const sessionId = sessionIdOverride || this.activeSession?.sessionId;
    if (!sessionId || !track.ratingKey) return;

    try {
      const response = await this.fetchTimeline(
        track,
        state,
        positionSeconds,
        durationSeconds || secondsFromMilliseconds(track.duration),
        sessionId,
      );

      if (this.isTerminationResponse(response)) {
        await this.handleRemoteTermination(track, sessionId);
      }
    } catch {
      // Timeline reporting must not interrupt local playback.
    }
  }

  private async fetchTimeline(
    track: PlayerTrack,
    state: TimelineState,
    positionSeconds: number,
    durationSeconds: number,
    sessionId: string,
  ): Promise<TimelineResponse | null> {
    const server = await this.getSelectedServer();
    const token = this.getServerToken(server);
    const connections = this.orderConnections(server);
    let lastError: unknown = null;

    for (const connection of connections) {
      try {
        const url = new URL("/:/timeline", connection.uri);
        const params = this.timelineParams(
          track,
          state,
          positionSeconds,
          durationSeconds,
        );

        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
        Object.entries(this.identityParams(sessionId)).forEach(
          ([key, value]) => {
            url.searchParams.set(key, value);
          },
        );
        url.searchParams.set("X-Plex-Token", token);

        const response = await fetch(url, {
          method: "GET",
          signal: AbortSignal.timeout(PLEX_TIMELINE_TIMEOUT_MS),
          headers: this.playbackHeaders(token, sessionId),
        });

        if (!response.ok) {
          lastError = new Error(
            `Plex timeline failed at ${connection.uri}: ${response.status}`,
          );
          continue;
        }

        this.activeBaseUrl = connection.uri;
        return await this.parseResponse(response);
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(
      `Plex timeline failed${lastError instanceof Error ? `: ${lastError.message}` : ""}`,
    );
  }

  private timelineParams(
    track: PlayerTrack,
    state: TimelineState,
    positionSeconds: number,
    durationSeconds: number,
  ): Record<string, string> {
    const ratingKey = track.ratingKey;
    const time = String(secondsToMilliseconds(positionSeconds));
    const duration = String(secondsToMilliseconds(durationSeconds));

    return {
      type: "music",
      key: `/library/metadata/${ratingKey}`,
      ratingKey,
      state,
      time,
      playbackTime: time,
      duration,
      context: "source:content.library",
      hasMDE: "1",
    };
  }

  private playbackHeaders(
    token: string,
    sessionId: string,
  ): Record<string, string> {
    const identity = this.identityParams(sessionId);

    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Plex-Token": token,
      ...identity,
    };
  }

  private identityParams(sessionId: string): Record<string, string> {
    return {
      "X-Plex-Client-Identifier": this.auth.plexClientId,
      "X-Plex-Session-Identifier": sessionId,
      "X-Plex-Product": this.auth.plexProduct,
      "X-Plex-Version": RAYNA_VERSION,
      "X-Plex-Platform": platformName(),
      "X-Plex-Platform-Version": release(),
      "X-Plex-Device-Name": deviceName(),
    };
  }

  private async parseResponse(
    response: Response,
  ): Promise<TimelineResponse | null> {
    const text = await response.text();
    if (!text.trim()) return null;

    try {
      return JSON.parse(text) as TimelineResponse;
    } catch {
      return { rawText: text };
    }
  }

  private isTerminationResponse(response: TimelineResponse | null): boolean {
    const container = response?.MediaContainer || response || null;
    if (!container) return false;

    if (
      typeof response?.rawText === "string" &&
      /\btermination(Code|Text)\b/i.test(response.rawText)
    ) {
      return true;
    }

    return (
      container.terminationCode !== undefined ||
      container.terminationText !== undefined
    );
  }

  private async handleRemoteTermination(
    track: PlayerTrack,
    sessionId: string,
  ): Promise<void> {
    if (this.handlingTermination) return;

    this.handlingTermination = true;
    this.stopHeartbeat();
    const status = this.bass.getPlaybackStatus();
    this.bass.stopFromRemote();
    try {
      await this.fetchTimeline(
        track,
        "stopped",
        status.position,
        status.duration || secondsFromMilliseconds(track.duration),
        sessionId,
      );
    } catch {
      // The server may already have terminated the session; local stop still wins.
    }
    this.activeSession = null;
    this.handlingTermination = false;
  }

  private orderConnections(server: PlexServer): PlexServer["connections"] {
    const connections = server.connections.filter(
      (connection) => connection.uri,
    );

    return [
      ...connections.filter(
        (connection) => connection.uri === this.activeBaseUrl,
      ),
      ...connections.filter(
        (connection) =>
          connection.uri !== this.activeBaseUrl &&
          connection.local &&
          !connection.relay,
      ),
      ...connections.filter(
        (connection) =>
          connection.uri !== this.activeBaseUrl &&
          !connection.local &&
          !connection.relay,
      ),
      ...connections.filter(
        (connection) =>
          connection.uri !== this.activeBaseUrl && connection.relay,
      ),
    ];
  }

  private async getSelectedServer(): Promise<PlexServer> {
    const server = await this.auth.getUserSelectedServer();
    if (!server?.connections?.[0]?.uri) {
      throw new Error("No Plex server is selected");
    }
    return server;
  }

  private getServerToken(server: PlexServer): string {
    return server.accessToken || this.auth.plexUserAccessToken;
  }

  private isEnabled(): boolean {
    return this.getPlaybackSettings().enableTimelineReporting !== false;
  }

  private generateSessionId(): string {
    return randomUUID().replaceAll("-", "");
  }
}

function secondsToMilliseconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.max(0, Math.floor(seconds * 1000));
}

function secondsFromMilliseconds(milliseconds: number | undefined): number {
  if (!milliseconds || !Number.isFinite(milliseconds)) return 0;
  return milliseconds / 1000;
}

function platformName(): string {
  if (process.platform === "darwin") return "macOS";
  if (process.platform === "win32") return "Windows";
  if (process.platform === "linux") return "Linux";
  return process.platform;
}

function deviceName(): string {
  const name = hostname();
  return name ? `Rayna on ${name}` : "Rayna";
}

function readPackageVersion(): string {
  try {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as { version?: unknown };
    return typeof packageJson.version === "string" ? packageJson.version : "0";
  } catch {
    return "0";
  }
}
