import { spawnSync } from "node:child_process";

function isWsl() {
  return process.platform === "linux" && Boolean(process.env.WSL_DISTRO_NAME);
}

function isWindowsMountedPath(path) {
  return /^\/mnt\/[a-z]\//i.test(path);
}

function installHint() {
  if (isWsl()) {
    const locationHint = isWindowsMountedPath(process.cwd())
      ? "This workspace is on a Windows-mounted path, but VS Code Remote - WSL and workspace scripts still resolve `dot` inside WSL."
      : "This workspace is running inside WSL, so VS Code Remote - WSL and workspace scripts resolve `dot` inside WSL.";

    return [
      locationHint,
      "Install Graphviz inside WSL so VS Code Remote - WSL and workspace scripts can resolve `dot`:",
      "  sudo apt update",
      "  sudo apt install graphviz",
      "Install Graphviz on Windows only if you also need a Windows-side app or extension to invoke `dot.exe` directly.",
    ].join("\n");
  }

  if (process.platform === "linux") {
    return [
      "Install Graphviz with your distro package manager. On Ubuntu/Debian:",
      "  sudo apt update",
      "  sudo apt install graphviz",
    ].join("\n");
  }

  if (process.platform === "win32") {
    return [
      "Install Graphviz on Windows and ensure `dot.exe` is on PATH.",
      "If you work in VS Code Remote - WSL for this repo, install Graphviz inside WSL instead.",
    ].join("\n");
  }

  return "Install Graphviz for your platform and ensure the `dot` command is available on PATH.";
}

const result = spawnSync("dot", ["-V"], {
  encoding: "utf8",
});

if (result.status === 0) {
  const version = (result.stderr || result.stdout).trim();
  console.log(`Graphviz detected: ${version}`);
  process.exit(0);
}

const failure = (result.error && result.error.code === "ENOENT")
  ? "Graphviz is not installed or `dot` is not on PATH."
  : `Graphviz check failed${result.error ? `: ${result.error.message}` : "."}`;

console.error(failure);
console.error("");
console.error("Graphviz is optional for core build/test work, but required for DOT-to-SVG preview flows, SVG-first PNG export, and editors that shell out to `dot`.");
console.error(installHint());
console.error("");
console.error("Verify the installation with:");
console.error("  dot -V");

process.exit(1);
