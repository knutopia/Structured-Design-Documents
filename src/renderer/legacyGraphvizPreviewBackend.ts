import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Bundle, ViewSpec } from "../bundle/types.js";
import type { PreviewFormat, TextRenderFormat } from "./renderArtifacts.js";
import type { LegacyDotPreviewStyle } from "./previewStyle.js";
import { resolveLegacyDotPreviewStyle } from "./previewStyle.js";
import { embedSvgFontFace, renderSvgToPng } from "./svgArtifacts.js";

export const LEGACY_GRAPHVIZ_PREVIEW_BACKEND_ID = "legacy_graphviz_preview";
export const LEGACY_GRAPHVIZ_PREVIEW_SOURCE_FORMAT: TextRenderFormat = "dot";

export interface LegacyGraphvizPreviewRequest {
  bundle: Bundle;
  view: ViewSpec;
  format: PreviewFormat;
  sourceText: string;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function withFontConfig<T>(style: LegacyDotPreviewStyle, run: (env: NodeJS.ProcessEnv) => Promise<T>): Promise<T> {
  if (!style.svgFontAssetPath) {
    return run(process.env);
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdd-fontconfig-"));
  const fontsConfPath = path.join(tempDir, "fonts.conf");
  const fontDir = path.dirname(style.svgFontAssetPath);
  const fontCacheDir = path.join(tempDir, "cache");
  const fontsConfig = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${escapeXml(fontDir)}</dir>
  <cachedir>${escapeXml(fontCacheDir)}</cachedir>
</fontconfig>
`;

  await writeFile(fontsConfPath, fontsConfig, "utf8");

  try {
    return await run({
      ...process.env,
      FONTCONFIG_FILE: fontsConfPath
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function legacyGraphvizInstallHint(): string {
  const lines = [
    "Graphviz is required for the current legacy SVG and PNG preview flows because the legacy Graphviz preview backend shells out to `dot` for DOT-to-SVG layout."
  ];

  if (process.platform === "linux" && process.env.WSL_DISTRO_NAME) {
    lines.push("Install Graphviz inside WSL and verify it with `dot -V` or `pnpm run check:graphviz`.");
  } else if (process.platform === "linux") {
    lines.push("Install Graphviz with your distro package manager and verify it with `dot -V`.");
  } else if (process.platform === "win32") {
    lines.push("Install Graphviz on Windows, ensure `dot.exe` is on PATH, and verify it with `dot -V`.");
  } else {
    lines.push("Install Graphviz for your platform and verify it with `dot -V`.");
  }

  return lines.join(" ");
}

export function assertLegacyGraphvizPreviewAvailable(): void {
  const result = spawnSync("dot", ["-V"], {
    encoding: "utf8"
  });

  if (result.status === 0) {
    return;
  }

  const details = (result.stderr || result.stdout || "").trim();
  throw new Error(`${details || "Graphviz is not installed or `dot` is not on PATH."} ${legacyGraphvizInstallHint()}`);
}

export async function renderLegacyDotToSvg(dot: string, style: LegacyDotPreviewStyle): Promise<string> {
  return withFontConfig(style, async (env) => {
    return new Promise<string>((resolve, reject) => {
      const child = spawn("dot", ["-Tsvg"], {
        env,
        stdio: ["pipe", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });
      child.on("error", (error) => {
        reject(error);
      });
      child.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
          return;
        }
        reject(new Error(stderr.trim() || `Graphviz exited with code ${code ?? "unknown"}`));
      });

      child.stdin.end(dot);
    });
  });
}

export async function embedLegacySvgFont(svg: string, style: LegacyDotPreviewStyle): Promise<string> {
  return embedSvgFontFace(svg, {
    fontFamily: style.fontFamily,
    fontAssetPath: style.svgFontAssetPath
  });
}

export async function renderLegacySvgToPng(svg: string, style: LegacyDotPreviewStyle): Promise<Uint8Array> {
  return renderSvgToPng(svg, {
    dpi: style.dpi,
    fontFamily: style.fontFamily,
    pngFontAssetPath: style.pngFontAssetPath
  });
}

export async function renderLegacyGraphvizPreview(request: LegacyGraphvizPreviewRequest): Promise<string | Uint8Array> {
  const style = resolveLegacyDotPreviewStyle(request.bundle, request.view);
  const rawSvg = await renderLegacyDotToSvg(request.sourceText, style);
  const svg = await embedLegacySvgFont(rawSvg, style);

  if (request.format === "svg") {
    return svg;
  }

  return renderLegacySvgToPng(svg, style);
}
