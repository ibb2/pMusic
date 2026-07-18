import { describe, expect, test } from "bun:test";
import Authentication from "./authentication";
import type { PlexServer } from "../../shared/types";

const server = (id: string, uri: string) =>
  ({
    clientIdentifier: id,
    name: id,
    accessToken: "token",
    connections: [
      {
        uri,
        protocol: "https",
        address: "host",
        port: 443,
        local: false,
        relay: false,
        IPv6: false,
      },
    ],
  }) as PlexServer;

function authentication(selectedServer: PlexServer) {
  const values = new Map<string, unknown>([
    ["selectedServer", selectedServer],
    ["selectedLibraries", ["music"]],
  ]);
  const auth = Object.create(Authentication.prototype) as Authentication;
  Object.assign(auth, {
    selectedServer,
    selectedLibraries: ["music"],
    plexUserAccessToken: "token",
    store: {
      get: (key: string) => values.get(key),
      set: (key: string, value: unknown) => values.set(key, value),
      delete: (key: string) => values.delete(key),
    },
  });
  return { auth, values };
}

describe("atomic Plex server changes", () => {
  test("validates before stopping playback and commits a cleared library selection", async () => {
    const oldServer = server("old", "https://old");
    const destination = server("new", "https://new");
    const { auth, values } = authentication(oldServer);
    auth.getConnectionCandidates = () => destination.connections;
    (auth as any).canReachConnection = async () => true;
    const events: string[] = [];

    const result = await auth.changeServer(destination, "auto", () => {
      events.push("reset");
      expect(auth.selectedServer).toBe(oldServer);
    });

    expect(events).toEqual(["reset"]);
    expect(result.changed).toBe(true);
    expect(auth.selectedServer).toBe(destination);
    expect(auth.selectedLibraries).toBeNull();
    expect(values.get("selectedServer")).toBe(destination);
    expect(values.has("selectedLibraries")).toBe(false);
  });

  test("leaves server, libraries, and playback untouched when validation fails", async () => {
    const oldServer = server("old", "https://old");
    const destination = server("new", "https://new");
    const { auth, values } = authentication(oldServer);
    auth.getConnectionCandidates = () => destination.connections;
    (auth as any).canReachConnection = async () => false;
    let reset = false;

    const result = await auth.changeServer(destination, "auto", () => {
      reset = true;
    });

    expect(result.changed).toBe(false);
    expect(reset).toBe(false);
    expect(auth.selectedServer).toBe(oldServer);
    expect(auth.selectedLibraries).toEqual(["music"]);
    expect(values.get("selectedServer")).toBe(oldServer);
  });

  test("rolls back when the playback reset cannot complete", async () => {
    const oldServer = server("old", "https://old");
    const destination = server("new", "https://new");
    const { auth, values } = authentication(oldServer);
    auth.getConnectionCandidates = () => destination.connections;
    (auth as any).canReachConnection = async () => true;

    const result = await auth.changeServer(destination, "auto", () => {
      throw new Error("reset failed");
    });

    expect(result).toMatchObject({ changed: false, error: "reset failed" });
    expect(auth.selectedServer).toBe(oldServer);
    expect(auth.selectedLibraries).toEqual(["music"]);
    expect(values.get("selectedServer")).toBe(oldServer);
  });
});
