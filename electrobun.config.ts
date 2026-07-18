import type { ElectrobunConfig } from "electrobun";

type BuildEnvironment = "dev" | "canary" | "stable";

function getBuildEnvironment(): BuildEnvironment {
  const requestedEnvironment = process.argv
    .find((argument) => argument.startsWith("--env="))
    ?.slice("--env=".length);

  if (requestedEnvironment === "canary" || requestedEnvironment === "stable") {
    return requestedEnvironment;
  }

  return "dev";
}

const buildEnvironment = getBuildEnvironment();
const appIdentifier =
  buildEnvironment === "stable"
    ? "com.ib.rayna"
    : `com.ib.rayna.${buildEnvironment}`;

const config: ElectrobunConfig = {
  app: {
    name: "Rayna",
    identifier: appIdentifier,
    version: "1.0.0-preview.1",
    description: "Rayna",
    urlSchemes: ["rayna"],
  },
  build: {
    buildFolder: "build/electrobun",
    artifactFolder: "dist/electrobun",
    bunVersion: "1.3.11",
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    copy: {
      "out/renderer": "views/main",
      "vendor/bass": "vendor/bass",
      "src/bun/bass-stream-proxy-worker.ts": "bun/bass-stream-proxy-worker.ts",
    },
    watch: ["src/bun", "src/shared", "src/renderer", "vendor/bass"],
    mac: {
      codesign: true,
      createDmg: true,
      notarize: false,
      icons: "resources/Rayna-New.icon",
      bundleCEF: true,
      entitlements: {
        "com.apple.security.cs.allow-jit": true,
        "com.apple.security.cs.allow-unsigned-executable-memory": true,
        "com.apple.security.cs.disable-library-validation": true,
        "com.apple.security.network.client": true,
      },
    },
    win: {
      icon: "resources/Rayna-New-macOS-Default-1024x1024@1x.png",
    },
    linux: {
      icon: "resources/Rayna-New-macOS-Default-1024x1024@1x.png",
    },
  },
  scripts: {
    postWrap: "scripts/patch-macos-wrapper.ts",
  },
  release: {
    baseUrl: "",
    generatePatch: false,
  },
};

export default config;
