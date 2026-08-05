import { dlopen, FFIType } from "bun:ffi";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { BassStreamProxy } from "./bass-stream-proxy";
import type {
  BassStatus,
  PlayerQueue,
  PlayerStatus,
  PlayerTrack,
} from "../shared/rpc";

const BASS_POS_BYTE = 0;
const BASS_ATTRIB_VOL = 2;
const BASS_CONFIG_NET_TIMEOUT = 11;
const BASS_CONFIG_NET_READTIMEOUT = 37;
const BASS_ACTIVE_STOPPED = 0;
const BASS_ACTIVE_PLAYING = 1;
const BASS_ACTIVE_STALLED = 2;
const BASS_ACTIVE_PAUSED = 3;
const BASS_QWORD_FAILED = 0xffffffffffffffffn;
const PREVIOUS_TRACK_THRESHOLD_SECONDS = 3;
const BASS_NETWORK_TIMEOUT_MS = 8_000;
const DEFAULT_MONITOR_INTERVAL_MS = 250;
const DEFAULT_STALL_TIMEOUT_MS = 8_000;

export type PlexStreamSource = {
  path: string;
  params?: Record<string, string>;
  /** Bun-only local path used for completed offline media. */
  localPath?: string;
};

export type StreamCandidate = {
  url: string;
  connectionUri: string;
  /** Bun-only local path; never sent through renderer RPC. */
  localPath?: string;
};

export type PlayableTrack = {
  track: PlayerTrack;
  source: PlexStreamSource;
};

export type StreamCandidateResolver = (
  source: PlexStreamSource,
  excludedConnectionUris: ReadonlySet<string>,
) => StreamCandidate[];
export type BassStopReason =
  | "manual"
  | "replaced"
  | "ended"
  | "remote"
  | "connection-failed";

export type BassPlaybackEvent =
  | {
      type: "track-started";
      track: PlayerTrack;
      position: number;
      duration: number;
    }
  | {
      type: "state-changed";
      state: "playing" | "paused";
      track: PlayerTrack;
      position: number;
      duration: number;
    }
  | {
      type: "seeked";
      track: PlayerTrack;
      position: number;
      duration: number;
      isPlaying: boolean;
    }
  | {
      type: "track-stopped";
      reason: BassStopReason;
      track: PlayerTrack;
      position: number;
      duration: number;
    };

export type BassPlaybackListener = (event: BassPlaybackEvent) => void;

export type BassLibrary = {
  symbols: {
    BASS_GetVersion: () => number;
    BASS_ErrorGetCode: () => number;
    BASS_Init: (
      device: number,
      frequency: number,
      flags: number,
      window: null,
      directSoundGuid: null,
    ) => boolean;
    BASS_SetConfig: (option: number, value: number) => boolean;
    BASS_Free: () => boolean;
    BASS_PluginLoad: (file: Uint8Array, flags: number) => number;
    BASS_PluginFree: (handle: number) => boolean;
    BASS_StreamCreateURL: (
      url: Uint8Array,
      offset: number,
      flags: number,
      downloadProc: null,
      user: null,
    ) => number;
    BASS_StreamCreateFile: (
      memory: boolean,
      file: Uint8Array,
      offset: bigint,
      length: bigint,
      flags: number,
    ) => number;
    BASS_StreamFree: (handle: number) => boolean;
    BASS_ChannelPlay: (handle: number, restart: boolean) => boolean;
    BASS_ChannelPause: (handle: number) => boolean;
    BASS_ChannelStop: (handle: number) => boolean;
    BASS_ChannelIsActive: (handle: number) => number;
    BASS_ChannelSetAttribute: (
      handle: number,
      attribute: number,
      value: number,
    ) => boolean;
    BASS_ChannelGetLength: (handle: number, mode: number) => bigint;
    BASS_ChannelGetPosition: (handle: number, mode: number) => bigint;
    BASS_ChannelSetPosition: (
      handle: number,
      position: bigint,
      mode: number,
    ) => boolean;
    BASS_ChannelBytes2Seconds: (handle: number, position: bigint) => number;
    BASS_ChannelSeconds2Bytes: (handle: number, position: number) => bigint;
  };
};

type BassManagerOptions = {
  library?: BassLibrary;
  streamProxy?: BassStreamProxy | null;
  monitorIntervalMs?: number;
  stallTimeoutMs?: number;
  now?: () => number;
};

export class BassManager {
  private library: BassLibrary | null = null;
  private loadError: string | null = null;
  private initialized = false;
  private streamHandle = 0;
  private pluginHandles: number[] = [];
  private pluginStatuses: Array<{
    name: string;
    path: string;
    loaded: boolean;
    error: string | null;
  }> = [];
  private previousPlayables: PlayableTrack[] = [];
  private currentPlayable: PlayableTrack | null = null;
  private currentTrack: PlayerTrack | null = null;
  private queue: PlayableTrack[] = [];
  private volume = 1;
  private volumeBeforeMute = 1;
  private monitor: Timer | null = null;
  private manuallyStopping = false;
  private recovering = false;
  private stalledAt: number | null = null;
  private currentConnectionUri: string | null = null;
  private playbackIntent: "playing" | "paused" = "playing";
  private connectionState: PlayerStatus["connection_state"] = "connected";
  private connectionError: string | null = null;
  private streamResolver: StreamCandidateResolver | null = null;
  private connectionChanged: ((connectionUri: string) => void) | null = null;
  private listeners = new Set<BassPlaybackListener>();
  private readonly libraryPath: string | null;
  private readonly monitorIntervalMs: number;
  private readonly stallTimeoutMs: number;
  private readonly now: () => number;
  private readonly streamProxy: BassStreamProxy | null;

  constructor(options: BassManagerOptions = {}) {
    this.monitorIntervalMs =
      options.monitorIntervalMs ?? DEFAULT_MONITOR_INTERVAL_MS;
    this.stallTimeoutMs = options.stallTimeoutMs ?? DEFAULT_STALL_TIMEOUT_MS;
    this.now = options.now ?? Date.now;
    this.streamProxy =
      options.streamProxy === undefined
        ? new BassStreamProxy()
        : options.streamProxy;

    if (options.library) {
      this.libraryPath = null;
      this.library = options.library;
      this.initialized = true;
      return;
    }

    this.libraryPath = this.resolveLibraryPath();
    this.load();
  }

  getStatus(): BassStatus {
    return {
      available: Boolean(this.library),
      version: this.library
        ? this.formatVersion(this.library.symbols.BASS_GetVersion())
        : null,
      libraryPath: this.libraryPath,
      plugins: this.pluginStatuses,
      error: this.loadError,
    };
  }

  getPlaybackStatus(): PlayerStatus {
    return {
      is_playing: this.isPlaying(),
      current_track: this.currentTrack,
      queue_len: this.queue.length,
      position: this.getPosition(),
      duration: this.getDuration(),
      volume: this.volume,
      connection_state: this.connectionState,
      connection_error: this.connectionError,
    };
  }

  getQueue(): PlayerQueue {
    return {
      previous_track: this.previousPlayables.at(-1)?.track ?? null,
      current_track: this.currentTrack,
      tracks: this.queue.map((item) => item.track),
    };
  }

  onPlaybackEvent(listener: BassPlaybackListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setStreamResolver(
    resolver: StreamCandidateResolver,
    onConnectionChanged?: (connectionUri: string) => void,
  ): void {
    this.streamResolver = resolver;
    this.connectionChanged = onConnectionChanged ?? null;
  }

  playTrack(track: PlayerTrack, source: PlexStreamSource): void {
    this.rememberCurrentTrack();
    this.stopCurrent("replaced");
    this.queue = [];
    this.playStream({ track, source });
  }

  playTracks(tracks: PlayableTrack[]): void {
    this.rememberCurrentTrack();
    this.stopCurrent("replaced");
    this.queue = tracks;
    this.playNext();
  }

  queueTrack(track: PlayerTrack, source: PlexStreamSource): void {
    this.queueTracks([{ track, source }]);
  }

  queueTracks(tracks: PlayableTrack[]): void {
    if (tracks.length === 0) return;
    if (!this.currentTrack && !this.streamHandle) {
      this.playTracks(tracks);
      return;
    }

    this.queue.push(...tracks);
  }

  replaceQueue(tracks: PlayableTrack[]): void {
    this.playTracks(tracks);
  }

  replaceCurrentSource(source: PlexStreamSource): boolean {
    if (
      !this.library ||
      !this.initialized ||
      !this.currentPlayable ||
      !this.currentTrack
    )
      return false;

    const previousPlayable = this.currentPlayable;
    const track = this.currentTrack;
    const position = this.getPosition();
    const duration = this.getDuration();
    const shouldPlay = this.playbackIntent === "playing";
    const replacement = { ...previousPlayable, source };

    this.releaseCurrentStream(false);
    const replaced = this.openPlayable(replacement, {
      excludedConnectionUris: new Set(),
      position,
      shouldPlay,
    });

    if (replaced) {
      this.emitPlaybackEvent({
        type: "state-changed",
        state: shouldPlay ? "playing" : "paused",
        track,
        position: this.getPosition(),
        duration: this.getDuration() || duration,
      });
      return true;
    }

    const replacementError =
      this.connectionError || "The requested playback source could not open";
    const restored = this.openPlayable(previousPlayable, {
      excludedConnectionUris: new Set(),
      position,
      shouldPlay,
    });

    if (restored) {
      this.loadError = replacementError;
      this.emitPlaybackEvent({
        type: "state-changed",
        state: shouldPlay ? "playing" : "paused",
        track,
        position: this.getPosition(),
        duration: this.getDuration() || duration,
      });
      return false;
    }

    this.currentPlayable = null;
    this.currentTrack = null;
    this.emitPlaybackEvent({
      type: "track-stopped",
      reason: "connection-failed",
      track,
      position,
      duration,
    });
    return false;
  }

  clearQueue(): void {
    this.queue = [];
  }

  private rememberCurrentTrack(): void {
    if (!this.currentPlayable) return;
    const previousPlayable = this.previousPlayables.at(-1);
    if (
      previousPlayable?.track.ratingKey === this.currentPlayable.track.ratingKey
    )
      return;
    this.previousPlayables.push(this.currentPlayable);
  }

  resume(): void {
    if (!this.library || !this.streamHandle) return;
    this.playbackIntent = "playing";
    const resumed = this.library.symbols.BASS_ChannelPlay(
      this.streamHandle,
      false,
    );
    if (resumed && this.currentTrack) {
      this.emitPlaybackEvent({
        type: "state-changed",
        state: "playing",
        track: this.currentTrack,
        position: this.getPosition(),
        duration: this.getDuration(),
      });
      return;
    }

    this.recoverCurrentPlayback();
  }

  pause(): void {
    if (!this.library || !this.streamHandle) return;
    const position = this.getPosition();
    const duration = this.getDuration();
    const paused = this.library.symbols.BASS_ChannelPause(this.streamHandle);
    if (paused && this.currentTrack) {
      this.playbackIntent = "paused";
      this.emitPlaybackEvent({
        type: "state-changed",
        state: "paused",
        track: this.currentTrack,
        position,
        duration,
      });
    }
  }

  stop(): void {
    this.stopCurrent("manual");
  }

  stopFromRemote(): void {
    this.queue = [];
    this.stopCurrent("remote");
  }

  playNext(): void {
    const next = this.queue.shift();
    if (!next) {
      this.stop();
      return;
    }
    this.playStream(next);
  }

  playPrev(): void {
    if (this.getPosition() > PREVIOUS_TRACK_THRESHOLD_SECONDS) {
      this.seek(0);
      return;
    }

    const previous = this.previousPlayables.pop();
    if (!previous) {
      this.seek(0);
      return;
    }

    if (this.currentPlayable) {
      this.queue.unshift(this.currentPlayable);
    }
    this.playStream(previous, false);
  }

  seek(position: number): void {
    if (!this.library || !this.streamHandle) return;
    const duration = this.getDuration();
    const safePosition = Math.max(
      0,
      duration > 0 ? Math.min(position, duration) : position,
    );
    if (!this.setPosition(safePosition)) return;

    if (this.currentTrack) {
      this.emitPlaybackEvent({
        type: "seeked",
        track: this.currentTrack,
        position: safePosition,
        duration: this.getDuration(),
        isPlaying: this.isPlaying(),
      });
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (!this.library || !this.streamHandle) return;
    this.library.symbols.BASS_ChannelSetAttribute(
      this.streamHandle,
      BASS_ATTRIB_VOL,
      this.volume,
    );
  }

  setMuted(muted: boolean): void {
    if (muted) {
      this.volumeBeforeMute = this.volume;
      this.setVolume(0);
      return;
    }

    this.setVolume(this.volumeBeforeMute || 1);
    this.volumeBeforeMute = 1;
  }

  free(): void {
    this.stop();
    this.streamProxy?.dispose();
    this.pluginHandles.forEach((handle) => {
      this.library?.symbols.BASS_PluginFree(handle);
    });
    this.pluginHandles = [];
    if (this.library && this.initialized) {
      this.library.symbols.BASS_Free();
      this.initialized = false;
    }
  }

  private load(): void {
    if (!this.libraryPath) {
      this.loadError =
        "No BASS library is available for this platform or architecture.";
      return;
    }

    try {
      this.library = dlopen(this.libraryPath, {
        BASS_GetVersion: {
          args: [],
          returns: FFIType.u32,
        },
        BASS_ErrorGetCode: {
          args: [],
          returns: FFIType.i32,
        },
        BASS_Init: {
          args: [
            FFIType.i32,
            FFIType.u32,
            FFIType.u32,
            FFIType.ptr,
            FFIType.ptr,
          ],
          returns: FFIType.bool,
        },
        BASS_SetConfig: {
          args: [FFIType.u32, FFIType.u32],
          returns: FFIType.bool,
        },
        BASS_Free: {
          args: [],
          returns: FFIType.bool,
        },
        BASS_PluginLoad: {
          args: [FFIType.cstring, FFIType.u32],
          returns: FFIType.u32,
        },
        BASS_PluginFree: {
          args: [FFIType.u32],
          returns: FFIType.bool,
        },
        BASS_StreamCreateURL: {
          args: [
            FFIType.cstring,
            FFIType.u32,
            FFIType.u32,
            FFIType.ptr,
            FFIType.ptr,
          ],
          returns: FFIType.u32,
        },
        BASS_StreamCreateFile: {
          args: [
            FFIType.bool,
            FFIType.cstring,
            FFIType.u64,
            FFIType.u64,
            FFIType.u32,
          ],
          returns: FFIType.u32,
        },
        BASS_StreamFree: {
          args: [FFIType.u32],
          returns: FFIType.bool,
        },
        BASS_ChannelPlay: {
          args: [FFIType.u32, FFIType.bool],
          returns: FFIType.bool,
        },
        BASS_ChannelPause: {
          args: [FFIType.u32],
          returns: FFIType.bool,
        },
        BASS_ChannelStop: {
          args: [FFIType.u32],
          returns: FFIType.bool,
        },
        BASS_ChannelIsActive: {
          args: [FFIType.u32],
          returns: FFIType.u32,
        },
        BASS_ChannelSetAttribute: {
          args: [FFIType.u32, FFIType.u32, FFIType.f32],
          returns: FFIType.bool,
        },
        BASS_ChannelGetLength: {
          args: [FFIType.u32, FFIType.u32],
          returns: FFIType.u64,
        },
        BASS_ChannelGetPosition: {
          args: [FFIType.u32, FFIType.u32],
          returns: FFIType.u64,
        },
        BASS_ChannelSetPosition: {
          args: [FFIType.u32, FFIType.u64, FFIType.u32],
          returns: FFIType.bool,
        },
        BASS_ChannelBytes2Seconds: {
          args: [FFIType.u32, FFIType.u64],
          returns: FFIType.f64,
        },
        BASS_ChannelSeconds2Bytes: {
          args: [FFIType.u32, FFIType.f64],
          returns: FFIType.u64,
        },
      });

      this.initialized = this.library.symbols.BASS_Init(
        -1,
        44100,
        0,
        null,
        null,
      );
      if (!this.initialized) {
        this.loadError = `BASS_Init failed with error ${this.library.symbols.BASS_ErrorGetCode()}`;
        return;
      }

      this.library.symbols.BASS_SetConfig(
        BASS_CONFIG_NET_TIMEOUT,
        BASS_NETWORK_TIMEOUT_MS,
      );
      this.library.symbols.BASS_SetConfig(
        BASS_CONFIG_NET_READTIMEOUT,
        BASS_NETWORK_TIMEOUT_MS,
      );

      this.loadPlugins();
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : String(error);
    }
  }

  private loadPlugins(): void {
    if (!this.library) return;

    this.pluginStatuses = this.pluginCandidates().map((plugin) => {
      if (!existsSync(plugin.path)) {
        return {
          ...plugin,
          loaded: false,
          error: "Plugin library was not found.",
        };
      }

      const handle = this.library!.symbols.BASS_PluginLoad(
        this.toCString(plugin.path),
        0,
      );
      if (!handle) {
        return {
          ...plugin,
          loaded: false,
          error: `BASS_PluginLoad failed with error ${this.library!.symbols.BASS_ErrorGetCode()}`,
        };
      }

      this.pluginHandles.push(handle);
      return {
        ...plugin,
        loaded: true,
        error: null,
      };
    });
  }

  private playStream(playable: PlayableTrack, rememberCurrent = true): void {
    if (!this.library || !this.initialized) return;

    if (rememberCurrent) {
      this.rememberCurrentTrack();
    }
    this.stopCurrent("replaced");
    const opened = this.openPlayable(playable, {
      excludedConnectionUris: new Set(),
      position: 0,
      shouldPlay: true,
    });

    if (!opened) return;
    this.emitPlaybackEvent({
      type: "track-started",
      track: playable.track,
      position: this.getPosition(),
      duration: this.getDuration(),
    });
  }

  private startMonitor(): void {
    this.stopMonitor();
    if (this.monitorIntervalMs <= 0) return;
    this.monitor = setInterval(
      () => this.pollPlayback(),
      this.monitorIntervalMs,
    );
  }

  private stopMonitor(): void {
    if (!this.monitor) return;
    clearInterval(this.monitor);
    this.monitor = null;
  }

  pollPlayback(): void {
    if (
      !this.library ||
      !this.streamHandle ||
      !this.currentTrack ||
      this.manuallyStopping
    )
      return;

    const active = this.library.symbols.BASS_ChannelIsActive(this.streamHandle);

    if (active === BASS_ACTIVE_STALLED) {
      this.stalledAt ??= this.now();
      if (this.now() - this.stalledAt >= this.stallTimeoutMs) {
        this.recoverCurrentPlayback();
      }
      return;
    }

    this.stalledAt = null;
    if (active !== BASS_ACTIVE_STOPPED) return;

    const position = this.getPosition();
    const duration =
      this.getDuration() || (this.currentTrack.duration ?? 0) / 1_000;
    const reachedEnd = duration > 0 && position >= Math.max(0, duration - 0.75);

    if (reachedEnd) {
      this.stopCurrent("ended");
      this.playNext();
      return;
    }

    this.recoverCurrentPlayback();
  }

  private openPlayable(
    playable: PlayableTrack,
    {
      excludedConnectionUris,
      position,
      shouldPlay,
    }: {
      excludedConnectionUris: Set<string>;
      position: number;
      shouldPlay: boolean;
    },
  ): boolean {
    if (!this.library || !this.streamResolver) {
      this.failConnection("No Plex stream resolver is available");
      return false;
    }

    let candidates: StreamCandidate[];
    let lastCandidateError: string | null = null;
    try {
      candidates = this.streamResolver(playable.source, excludedConnectionUris);
    } catch (error) {
      this.failConnection(
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }

    for (const candidate of candidates) {
      if (excludedConnectionUris.has(candidate.connectionUri)) continue;

      const streamCreateOperation = candidate.localPath
        ? "BASS_StreamCreateFile"
        : "BASS_StreamCreateURL";
      let handle = candidate.localPath
        ? this.library.symbols.BASS_StreamCreateFile(
            false,
            this.toCString(candidate.localPath),
            0n,
            0n,
            0,
          )
        : 0;

      if (!candidate.localPath) {
        for (const url of this.playbackUrls(candidate)) {
          handle = this.library.symbols.BASS_StreamCreateURL(
            this.toCString(url),
            0,
            0,
            null,
            null,
          );
          if (handle) break;
          lastCandidateError = `${streamCreateOperation} error ${this.library.symbols.BASS_ErrorGetCode()}`;
        }
      }

      if (!handle) {
        lastCandidateError ??= `${streamCreateOperation} error ${this.library.symbols.BASS_ErrorGetCode()}`;
        excludedConnectionUris.add(candidate.connectionUri);
        continue;
      }

      this.streamHandle = handle;
      this.setVolume(this.volume);

      const started = this.library.symbols.BASS_ChannelPlay(handle, true);
      if (!started) {
        lastCandidateError = `BASS_ChannelPlay error ${this.library.symbols.BASS_ErrorGetCode()}`;
        this.library.symbols.BASS_StreamFree(handle);
        this.streamHandle = 0;
        excludedConnectionUris.add(candidate.connectionUri);
        continue;
      }

      if (position > 0 && !this.setPosition(position)) {
        this.library.symbols.BASS_ChannelStop(handle);
        this.library.symbols.BASS_StreamFree(handle);
        this.streamHandle = 0;
        excludedConnectionUris.add(candidate.connectionUri);
        continue;
      }
      if (!shouldPlay) {
        this.library.symbols.BASS_ChannelPause(handle);
      }

      this.currentPlayable = playable;
      this.currentTrack = playable.track;
      this.currentConnectionUri = candidate.connectionUri;
      this.playbackIntent = shouldPlay ? "playing" : "paused";
      this.connectionState = "connected";
      this.connectionError = null;
      this.loadError = null;
      this.stalledAt = null;
      try {
        this.connectionChanged?.(candidate.connectionUri);
      } catch (error) {
        this.loadError = error instanceof Error ? error.message : String(error);
      }
      this.startMonitor();
      return true;
    }

    this.failConnection(
      lastCandidateError
        ? `No reachable Plex audio stream was found (${lastCandidateError})`
        : "No reachable Plex audio stream was found",
    );
    return false;
  }

  private playbackUrls(candidate: StreamCandidate): string[] {
    if (candidate.connectionUri === "offline" || !this.streamProxy) {
      return [candidate.url];
    }

    const proxied = this.streamProxy.urlFor(candidate.url);
    return hasAudioExtension(candidate.url)
      ? [candidate.url, proxied]
      : [proxied];
  }

  private recoverCurrentPlayback(): void {
    if (
      this.recovering ||
      !this.library ||
      !this.currentPlayable ||
      !this.currentTrack
    )
      return;

    this.recovering = true;
    try {
      this.connectionState = "reconnecting";
      this.connectionError = null;

      const playable = this.currentPlayable;
      const track = this.currentTrack;
      const position = this.getPosition();
      const duration = this.getDuration();
      const wasPaused = this.playbackIntent === "paused";
      const excludedConnectionUris = new Set<string>();
      if (this.currentConnectionUri) {
        excludedConnectionUris.add(this.currentConnectionUri);
      }

      this.releaseCurrentStream(false);
      const recovered = this.openPlayable(playable, {
        excludedConnectionUris,
        position,
        shouldPlay: !wasPaused,
      });

      if (recovered) {
        this.emitPlaybackEvent({
          type: "state-changed",
          state: wasPaused ? "paused" : "playing",
          track,
          position: this.getPosition(),
          duration: this.getDuration() || duration,
        });
      } else {
        this.currentPlayable = null;
        this.currentTrack = null;
        this.emitPlaybackEvent({
          type: "track-stopped",
          reason: "connection-failed",
          track,
          position,
          duration,
        });
      }
    } finally {
      this.recovering = false;
    }
  }

  private failConnection(message: string): void {
    this.connectionState = "failed";
    this.connectionError = message;
    this.loadError = message;
    this.stopMonitor();
    this.streamHandle = 0;
    this.currentConnectionUri = null;
  }

  private stopCurrent(reason: BassStopReason): void {
    if (!this.library) return;

    const stoppedTrack = this.currentTrack;
    const stoppedPosition = stoppedTrack ? this.getPosition() : 0;
    const stoppedDuration = stoppedTrack ? this.getDuration() : 0;

    this.releaseCurrentStream(true);

    if (stoppedTrack) {
      this.emitPlaybackEvent({
        type: "track-stopped",
        reason,
        track: stoppedTrack,
        position: stoppedPosition,
        duration: stoppedDuration,
      });
    }
  }

  private releaseCurrentStream(clearCurrent: boolean): void {
    if (!this.library) return;

    this.manuallyStopping = true;
    this.stopMonitor();
    if (this.streamHandle) {
      this.library.symbols.BASS_ChannelStop(this.streamHandle);
      this.library.symbols.BASS_StreamFree(this.streamHandle);
    }
    this.streamHandle = 0;
    this.currentConnectionUri = null;
    this.stalledAt = null;
    if (clearCurrent) {
      this.currentPlayable = null;
      this.currentTrack = null;
    }
    this.manuallyStopping = false;
  }

  private setPosition(position: number): boolean {
    if (!this.library || !this.streamHandle) return false;
    const bytes = this.library.symbols.BASS_ChannelSeconds2Bytes(
      this.streamHandle,
      position,
    );
    if (bytes === BASS_QWORD_FAILED) {
      this.loadError = `BASS_ChannelSeconds2Bytes failed with error ${this.library.symbols.BASS_ErrorGetCode()}`;
      return false;
    }
    const seeked = this.library.symbols.BASS_ChannelSetPosition(
      this.streamHandle,
      bytes,
      BASS_POS_BYTE,
    );

    if (!seeked) {
      this.loadError = `BASS_ChannelSetPosition failed with error ${this.library.symbols.BASS_ErrorGetCode()}`;
    }
    return seeked;
  }

  private emitPlaybackEvent(event: BassPlaybackEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        this.loadError = error instanceof Error ? error.message : String(error);
      }
    });
  }

  private isPlaying(): boolean {
    if (!this.library || !this.streamHandle) return false;
    const active = this.library.symbols.BASS_ChannelIsActive(this.streamHandle);
    return active === BASS_ACTIVE_PLAYING || active === BASS_ACTIVE_STALLED;
  }

  private getPosition(): number {
    if (!this.library || !this.streamHandle) return 0;
    const position = this.library.symbols.BASS_ChannelGetPosition(
      this.streamHandle,
      BASS_POS_BYTE,
    );
    if (position === BASS_QWORD_FAILED) return 0;
    const seconds = this.library.symbols.BASS_ChannelBytes2Seconds(
      this.streamHandle,
      position,
    );
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  }

  private getDuration(): number {
    const trackDuration = this.currentTrack?.duration
      ? this.currentTrack.duration / 1000
      : 0;
    if (!this.library || !this.streamHandle) return trackDuration;
    const length = this.library.symbols.BASS_ChannelGetLength(
      this.streamHandle,
      BASS_POS_BYTE,
    );
    if (length === BASS_QWORD_FAILED || length === 0n) return trackDuration;
    const seconds = this.library.symbols.BASS_ChannelBytes2Seconds(
      this.streamHandle,
      length,
    );
    return Number.isFinite(seconds) && seconds >= 1
      ? Math.max(seconds, trackDuration)
      : trackDuration;
  }

  private resolveLibraryPath(): string | null {
    const candidates = this.libraryCandidates();
    return candidates.find((candidate) => existsSync(candidate)) || null;
  }

  private libraryCandidates(): string[] {
    const roots = [
      resolve(process.cwd(), "vendor", "bass"),
      resolve(import.meta.dir, "..", "vendor", "bass"),
    ];

    return roots.map((root) => {
      if (process.platform === "darwin") {
        return join(root, "macos", "libbass.dylib");
      }

      if (process.platform === "win32") {
        return join(
          root,
          "win32",
          process.arch === "ia32" ? "ia32" : "x64",
          "bass.dll",
        );
      }

      const linuxArch =
        process.arch === "arm64"
          ? "aarch64"
          : process.arch === "arm"
            ? "armhf"
            : process.arch === "ia32"
              ? "x86"
              : "x86_64";

      return join(root, "linux", "libs", linuxArch, "libbass.so");
    });
  }

  private pluginCandidates(): Array<{ name: string; path: string }> {
    const roots = [
      resolve(process.cwd(), "vendor", "bass"),
      resolve(import.meta.dir, "..", "vendor", "bass"),
    ];
    const pluginNames = ["flac", "hls", "opus"];

    return pluginNames.map((name) => {
      const candidates = roots.map((root) => {
        if (process.platform === "darwin")
          return join(root, "macos", `libbass${name}.dylib`);

        if (process.platform === "win32") {
          return join(
            root,
            "win32",
            process.arch === "ia32" ? "ia32" : "x64",
            `bass${name}.dll`,
          );
        }

        const linuxArch =
          process.arch === "arm64"
            ? "aarch64"
            : process.arch === "arm"
              ? "armhf"
              : process.arch === "ia32"
                ? "x86"
                : "x86_64";

        return join(root, "linux", "libs", linuxArch, `libbass${name}.so`);
      });

      return {
        name,
        path:
          candidates.find((candidate) => existsSync(candidate)) ||
          candidates[0],
      };
    });
  }

  private toCString(value: string): Uint8Array {
    return new TextEncoder().encode(`${value}\0`);
  }

  private formatVersion(version: number): string {
    return [
      (version >>> 24) & 0xff,
      (version >>> 16) & 0xff,
      (version >>> 8) & 0xff,
      version & 0xff,
    ].join(".");
  }
}

function hasAudioExtension(url: string): boolean {
  try {
    return /\.(?:aac|flac|m4a|mp3|ogg|opus|wav)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}
