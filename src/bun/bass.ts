import { dlopen, FFIType } from "bun:ffi";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { BassStatus, PlayerStatus, PlayerTrack } from "../shared/rpc";

const BASS_POS_BYTE = 0;
const BASS_ATTRIB_VOL = 2;
const BASS_ACTIVE_STOPPED = 0;
const BASS_ACTIVE_PLAYING = 1;
const BASS_ACTIVE_STALLED = 2;
const BASS_ACTIVE_PAUSED = 3;

type BassLibrary = {
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
  private currentTrack: PlayerTrack | null = null;
  private queue: Array<{ track: PlayerTrack; streamUrl: string }> = [];
  private volume = 1;
  private volumeBeforeMute = 1;
  private monitor: Timer | null = null;
  private manuallyStopping = false;
  private readonly libraryPath: string | null;

  constructor() {
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
    };
  }

  playTrack(track: PlayerTrack, streamUrl: string): void {
    this.stop();
    this.queue = [];
    this.playStream(track, streamUrl);
  }

  playTracks(tracks: Array<{ track: PlayerTrack; streamUrl: string }>): void {
    this.stop();
    this.queue = tracks;
    this.playNext();
  }

  resume(): void {
    if (!this.library || !this.streamHandle) return;
    this.library.symbols.BASS_ChannelPlay(this.streamHandle, false);
  }

  pause(): void {
    if (!this.library || !this.streamHandle) return;
    this.library.symbols.BASS_ChannelPause(this.streamHandle);
  }

  stop(): void {
    if (!this.library) return;
    this.manuallyStopping = true;
    this.stopMonitor();
    if (this.streamHandle) {
      this.library.symbols.BASS_ChannelStop(this.streamHandle);
      this.library.symbols.BASS_StreamFree(this.streamHandle);
    }
    this.streamHandle = 0;
    this.currentTrack = null;
    this.manuallyStopping = false;
  }

  playNext(): void {
    const next = this.queue.shift();
    if (!next) {
      this.stop();
      return;
    }
    this.playStream(next.track, next.streamUrl);
  }

  playPrev(): void {
    this.seek(0);
  }

  seek(position: number): void {
    if (!this.library || !this.streamHandle) return;
    const duration = this.getDuration();
    const safePosition = Math.max(
      0,
      duration > 0 ? Math.min(position, duration) : position,
    );
    const bytes = this.library.symbols.BASS_ChannelSeconds2Bytes(
      this.streamHandle,
      safePosition,
    );
    const seeked = this.library.symbols.BASS_ChannelSetPosition(
      this.streamHandle,
      bytes,
      BASS_POS_BYTE,
    );

    if (!seeked) {
      this.loadError = `BASS_ChannelSetPosition failed with error ${this.library.symbols.BASS_ErrorGetCode()}`;
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

  private playStream(track: PlayerTrack, streamUrl: string): void {
    if (!this.library || !this.initialized) return;

    this.manuallyStopping = true;
    this.stopMonitor();
    if (this.streamHandle) {
      this.library.symbols.BASS_ChannelStop(this.streamHandle);
      this.library.symbols.BASS_StreamFree(this.streamHandle);
    }
    this.manuallyStopping = false;

    this.streamHandle = this.library.symbols.BASS_StreamCreateURL(
      this.toCString(streamUrl),
      0,
      0,
      null,
      null,
    );

    if (!this.streamHandle) {
      this.loadError = `BASS_StreamCreateURL failed with error ${this.library.symbols.BASS_ErrorGetCode()}`;
      this.currentTrack = null;
      return;
    }

    this.currentTrack = track;
    this.setVolume(this.volume);
    const started = this.library.symbols.BASS_ChannelPlay(
      this.streamHandle,
      true,
    );
    if (!started) {
      this.loadError = `BASS_ChannelPlay failed with error ${this.library.symbols.BASS_ErrorGetCode()}`;
      this.library.symbols.BASS_StreamFree(this.streamHandle);
      this.streamHandle = 0;
      this.currentTrack = null;
      this.playNext();
      return;
    }

    this.startMonitor();
  }

  private startMonitor(): void {
    this.stopMonitor();
    this.monitor = setInterval(() => this.checkPlayback(), 250);
  }

  private stopMonitor(): void {
    if (!this.monitor) return;
    clearInterval(this.monitor);
    this.monitor = null;
  }

  private checkPlayback(): void {
    if (
      !this.library ||
      !this.streamHandle ||
      !this.currentTrack ||
      this.manuallyStopping
    )
      return;

    const active = this.library.symbols.BASS_ChannelIsActive(this.streamHandle);
    if (active !== BASS_ACTIVE_STOPPED) return;

    const position = this.getPosition();
    const duration = this.getDuration();
    const reachedEnd =
      duration <= 0 || position >= Math.max(0, duration - 0.75);

    if (reachedEnd) {
      this.stopMonitor();
      this.playNext();
    }
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
    if (position < 0n) return 0;
    return this.library.symbols.BASS_ChannelBytes2Seconds(
      this.streamHandle,
      position,
    );
  }

  private getDuration(): number {
    if (!this.library || !this.streamHandle) return 0;
    const length = this.library.symbols.BASS_ChannelGetLength(
      this.streamHandle,
      BASS_POS_BYTE,
    );
    if (length < 0n) return 0;
    return this.library.symbols.BASS_ChannelBytes2Seconds(
      this.streamHandle,
      length,
    );
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
    const pluginNames = ["flac", "hls"];

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
