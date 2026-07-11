import { existsSync } from "node:fs";
import { resolve } from "node:path";

const executable = resolve(
  "node_modules/electrobun/bin",
  process.platform === "win32" ? "electrobun.exe" : "electrobun",
);

if (!existsSync(executable)) {
  const download = Bun.spawnSync(["bunx", "electrobun", "--help"], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  if (download.exitCode !== 0 || !existsSync(executable)) {
    console.error("Failed to install the Electrobun CLI executable.");
    process.exit(download.exitCode || 1);
  }
}

// Electrobun 1.18.0's downloaded arm64 CLI can be rejected by macOS after
// installation. Re-applying an ad-hoc signature makes the local executable
// valid and prevents its Node launcher from hiding a signal-killed process.
if (process.platform === "darwin") {
  const signing = Bun.spawnSync(
    ["codesign", "--force", "--sign", "-", executable],
    {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    },
  );

  if (signing.exitCode !== 0) {
    process.exit(signing.exitCode);
  }
}

const child = Bun.spawn([executable, ...Bun.argv.slice(2)], {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
  env: {
    ...process.env,
    ...macCodeSigningEnvironment(),
  },
});

process.exit(await child.exited);

function macCodeSigningEnvironment(): Record<string, string> {
  if (process.platform !== "darwin" || process.env.ELECTROBUN_DEVELOPER_ID) {
    return {};
  }

  const identities = Bun.spawnSync(
    ["security", "find-identity", "-v", "-p", "codesigning"],
    { stdout: "pipe", stderr: "pipe" },
  );

  if (identities.exitCode !== 0) {
    return {};
  }

  const output = identities.stdout.toString();
  const match = output.match(/^\s*\d+\)\s+[A-F0-9]+\s+"([^"]+)"/m);

  return match ? { ELECTROBUN_DEVELOPER_ID: match[1] } : {};
}
