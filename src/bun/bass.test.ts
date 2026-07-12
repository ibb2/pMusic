import { describe, expect, test } from "bun:test";
import { BassManager, type BassLibrary, type PlexStreamSource } from "./bass";
import type { PlayerTrack } from "../shared/rpc";

const LOCAL = "http://local:32400";
const REMOTE = "https://remote:32400";
const source: PlexStreamSource = { path: "/library/parts/1/file.flac" };
const opusSource: PlexStreamSource = {
  path: "/music/:/transcode/universal/start",
  params: { musicBitrate: "320" },
};

describe("BASS Plex route recovery", () => {
  test("opens registered offline loopback files without the network proxy", () => {
    const fake = new FakeBassLibrary();
    let proxyCalls = 0;
    const bass = new BassManager({
      library: fake.library,
      streamProxy: {
        urlFor: () => {
          proxyCalls += 1;
          return "http://127.0.0.1:1/unreachable";
        },
        dispose() {},
      } as never,
      monitorIntervalMs: 0,
    });
    const offlineUrl = "http://127.0.0.1:54321/media/offline-track";
    fake.setReachable("http://127.0.0.1:54321", true);
    bass.setStreamResolver(() => [
      { connectionUri: "offline", url: offlineUrl },
    ]);

    bass.playTrack(track("offline"), { path: offlineUrl });

    expect(proxyCalls).toBe(0);
    expect(fake.createdUrls).toEqual([offlineUrl]);
    expect(bass.getPlaybackStatus().is_playing).toBe(true);
  });

  test("falls through to a remote route when initial stream creation fails", () => {
    const fake = new FakeBassLibrary();
    fake.setReachable(LOCAL, false);
    fake.setReachable(REMOTE, true);
    const { bass, selectedConnections } = manager(fake);

    bass.playTrack(track("one"), source);

    expect(fake.createdUrls.map((url) => new URL(url).origin)).toEqual([
      LOCAL,
      REMOTE,
    ]);
    expect(selectedConnections).toEqual([REMOTE]);
    expect(bass.getPlaybackStatus().connection_state).toBe("connected");
    expect(bass.getPlaybackStatus().duration).toBe(180);
  });

  test("resumes the same paused track and preserves history and queue", () => {
    const fake = new FakeBassLibrary();
    const { bass, selectedConnections } = manager(fake);
    const previous = track("previous");
    const current = track("current");
    const queued = track("queued");

    bass.playTrack(previous, source);
    bass.playTrack(current, source);
    bass.queueTrack(queued, source);
    fake.position = 42;
    bass.pause();

    fake.setReachable(LOCAL, false);
    fake.active = 0;
    bass.pollPlayback();

    const status = bass.getPlaybackStatus();
    expect(status.current_track?.ratingKey).toBe(current.ratingKey);
    expect(status.position).toBe(42);
    expect(status.is_playing).toBe(false);
    expect(status.queue_len).toBe(1);
    expect(bass.getQueue().previous_track?.ratingKey).toBe(previous.ratingKey);
    expect(bass.getQueue().tracks[0]?.ratingKey).toBe(queued.ratingKey);
    expect(selectedConnections.at(-1)).toBe(REMOTE);
  });

  test("replaces a paused source without losing position, history, or queue", () => {
    const fake = new FakeBassLibrary();
    const { bass } = manager(fake);
    const previous = track("previous");
    const current = track("current");
    const queued = track("queued");

    bass.playTrack(previous, source);
    bass.playTrack(current, source);
    bass.queueTrack(queued, source);
    fake.position = 42;
    bass.pause();

    expect(bass.replaceCurrentSource(opusSource)).toBe(true);
    expect(new URL(fake.createdUrls.at(-1)!).pathname).toBe(opusSource.path);
    expect(
      new URL(fake.createdUrls.at(-1)!).searchParams.get("musicBitrate"),
    ).toBe("320");

    const replaced = bass.getPlaybackStatus();
    expect(replaced.current_track?.ratingKey).toBe(current.ratingKey);
    expect(replaced.position).toBe(42);
    expect(replaced.is_playing).toBe(false);
    expect(replaced.queue_len).toBe(1);
    expect(bass.getQueue().previous_track?.ratingKey).toBe(previous.ratingKey);

    bass.resume();
    fake.position = 180;
    fake.active = 0;
    bass.pollPlayback();
    expect(bass.getPlaybackStatus().current_track?.ratingKey).toBe(
      queued.ratingKey,
    );
  });

  test("replaces a playing source without interrupting playback", () => {
    const fake = new FakeBassLibrary();
    const { bass } = manager(fake);
    const current = track("current");

    bass.playTrack(current, source);
    fake.position = 18;

    expect(bass.replaceCurrentSource(opusSource)).toBe(true);
    expect(bass.getPlaybackStatus().current_track?.ratingKey).toBe(
      current.ratingKey,
    );
    expect(bass.getPlaybackStatus().position).toBe(18);
    expect(bass.getPlaybackStatus().is_playing).toBe(true);
  });

  test("restores the previous source when a replacement cannot open", () => {
    const fake = new FakeBassLibrary();
    const { bass } = manager(fake);
    const current = track("current");

    bass.playTrack(current, source);
    fake.position = 27;
    fake.setPathReachable(opusSource.path, false);

    expect(bass.replaceCurrentSource(opusSource)).toBe(false);
    expect(new URL(fake.createdUrls.at(-1)!).pathname).toBe(source.path);
    expect(bass.getPlaybackStatus().current_track?.ratingKey).toBe(
      current.ratingKey,
    );
    expect(bass.getPlaybackStatus().position).toBe(27);
    expect(bass.getPlaybackStatus().is_playing).toBe(true);
    expect(bass.getPlaybackStatus().connection_state).toBe("connected");
  });

  test("recovers a stream after it remains stalled for eight seconds", () => {
    let now = 0;
    const fake = new FakeBassLibrary();
    const { bass } = manager(fake, () => now);
    const current = track("stalled");

    bass.playTrack(current, source);
    fake.active = 2;
    bass.pollPlayback();

    fake.setReachable(LOCAL, false);
    now = 7_999;
    bass.pollPlayback();
    expect(new URL(fake.createdUrls.at(-1)!).origin).toBe(LOCAL);

    now = 8_000;
    bass.pollPlayback();
    expect(new URL(fake.createdUrls.at(-1)!).origin).toBe(REMOTE);
    expect(bass.getPlaybackStatus().current_track?.ratingKey).toBe(
      current.ratingKey,
    );
  });

  test("stops after every remaining route fails without discarding the queue", () => {
    const fake = new FakeBassLibrary();
    const { bass } = manager(fake);

    bass.playTrack(track("current"), source);
    bass.queueTrack(track("queued"), source);
    fake.position = 10;
    fake.setReachable(LOCAL, false);
    fake.setReachable(REMOTE, false);
    fake.active = 0;
    bass.pollPlayback();

    const status = bass.getPlaybackStatus();
    expect(status.connection_state).toBe("failed");
    expect(status.connection_error).toBeTruthy();
    expect(status.current_track).toBeNull();
    expect(status.queue_len).toBe(1);
    expect(fake.createdUrls).toHaveLength(2);
  });
});

function manager(fake: FakeBassLibrary, now: () => number = Date.now) {
  const bass = new BassManager({
    library: fake.library,
    streamProxy: null,
    monitorIntervalMs: 0,
    stallTimeoutMs: 8_000,
    now,
  });
  const selectedConnections: string[] = [];
  bass.setStreamResolver(
    (playableSource, excluded) =>
      [LOCAL, REMOTE]
        .filter((connectionUri) => !excluded.has(connectionUri))
        .map((connectionUri) => ({
          connectionUri,
          url: streamUrl(playableSource, connectionUri),
        })),
    (connectionUri) => selectedConnections.push(connectionUri),
  );
  return { bass, selectedConnections };
}

function track(ratingKey: string): PlayerTrack {
  return {
    title: ratingKey,
    artist: "Artist",
    artistRatingKey: "artist",
    album: "Album",
    albumRatingKey: "album",
    ratingKey,
    duration: 180_000,
  };
}

class FakeBassLibrary {
  active = 0;
  position = 0;
  duration = 180;
  createdUrls: string[] = [];
  private nextHandle = 1;
  private unreachablePaths = new Set<string>();
  private reachable = new Map<string, boolean>([
    [LOCAL, true],
    [REMOTE, true],
  ]);

  readonly library: BassLibrary = {
    symbols: {
      BASS_GetVersion: () => 0x02040000,
      BASS_ErrorGetCode: () => 40,
      BASS_Init: () => true,
      BASS_SetConfig: () => true,
      BASS_Free: () => true,
      BASS_PluginLoad: () => 1,
      BASS_PluginFree: () => true,
      BASS_StreamCreateURL: (value) => {
        const url = new TextDecoder().decode(value).replace(/\0.*$/, "");
        this.createdUrls.push(url);
        const parsed = new URL(url);
        if (
          this.unreachablePaths.has(parsed.pathname) ||
          !this.reachable.get(parsed.origin)
        )
          return 0;
        this.active = 0;
        this.position = 0;
        return this.nextHandle++;
      },
      BASS_StreamFree: () => true,
      BASS_ChannelPlay: (_handle, restart) => {
        if (restart) this.position = 0;
        this.active = 1;
        return true;
      },
      BASS_ChannelPause: () => {
        this.active = 3;
        return true;
      },
      BASS_ChannelStop: () => {
        this.active = 0;
        return true;
      },
      BASS_ChannelIsActive: () => this.active,
      BASS_ChannelSetAttribute: () => true,
      BASS_ChannelGetLength: () => BigInt(this.duration * 1_000),
      BASS_ChannelGetPosition: () => BigInt(this.position * 1_000),
      BASS_ChannelSetPosition: (_handle, position) => {
        this.position = Number(position) / 1_000;
        return true;
      },
      BASS_ChannelBytes2Seconds: (_handle, position) =>
        Number(position) / 1_000,
      BASS_ChannelSeconds2Bytes: (_handle, position) =>
        BigInt(Math.round(position * 1_000)),
    },
  };

  setReachable(connectionUri: string, reachable: boolean): void {
    this.reachable.set(connectionUri, reachable);
  }

  setPathReachable(path: string, reachable: boolean): void {
    if (reachable) {
      this.unreachablePaths.delete(path);
      return;
    }
    this.unreachablePaths.add(path);
  }
}

function streamUrl(
  playableSource: PlexStreamSource,
  connectionUri: string,
): string {
  const url = new URL(playableSource.path, connectionUri);
  Object.entries(playableSource.params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}
