/// <reference types="vite/client" />

import { PlexServer } from "./types";

interface Window {
  api: {
    db: {
      get: (key: string) => Promise<any>;
      set: (key: string, value: any) => Promise<void>;
    };
    auth: {
      isUserSignedIn: () => Promise<boolean>;
      logout: () => Promise<boolean>;
      generateClientIdentifier: () => Promise<string>;
      generateKeyPair: () => Promise<[string, string]>;
      generatePin: () => Promise<any>;
      checkPin: () => Promise<{
        authUrl: string;
        plexId: string;
        plexCode: string;
      }>;
      checkPinStatus: (id: string) => Promise<any>;
      getServers: () => Promise<PlexServer[]>;
      selectServer: (server: PlexServer) => Promise<void>;
      selectLibraries: (libraries) => Promise<void>;
      resolveSelectedServer: (mode: string) => Promise<string>;
      isServerSelected: () => boolean;
      getUserSelectedServer: () => Promise<PlexServer | null>;
      getUserSelectedLibraries: () => Promise<any | null>;
      getUserAccessToken: () => Promise<string>;
    };
    server: {
      getStatus: () => Promise<string>;
      getLogs: () => Promise<string>;
    };
  };
}
