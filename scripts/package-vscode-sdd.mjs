import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionRoot = path.join(repoRoot, "editors/vscode-sdd");
const outputDirectory = path.join(repoRoot, ".local-tools");
const outputPath = path.join(outputDirectory, "sdd-language-0.1.0.vsix");
const vscePath = path.join(repoRoot, "node_modules/.bin/vsce");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit"
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("pnpm", ["run", "generate:textmate"], repoRoot);
await mkdir(outputDirectory, { recursive: true });
run(
  vscePath,
  ["package", "--no-dependencies", "--out", outputPath],
  extensionRoot
);
