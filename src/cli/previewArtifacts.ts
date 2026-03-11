import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { DotPreviewStyle } from "../renderer/previewStyle.js";

type ResvgOptionsWithFontBuffers = NonNullable<ConstructorParameters<typeof Resvg>[1]> & {
  font?: NonNullable<NonNullable<ConstructorParameters<typeof Resvg>[1]>["font"]> & {
    fontBuffers?: Uint8Array[];
  };
};

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inferFontMimeType(fontPath: string): { mimeType: string; format: string } {
  if (fontPath.endsWith(".woff2")) {
    return {
      mimeType: "font/woff2",
      format: "woff2"
    };
  }

  if (fontPath.endsWith(".woff")) {
    return {
      mimeType: "font/woff",
      format: "woff"
    };
  }

  if (fontPath.endsWith(".otf")) {
    return {
      mimeType: "font/otf",
      format: "opentype"
    };
  }

  return {
    mimeType: "font/ttf",
    format: "truetype"
  };
}

async function withFontConfig<T>(style: DotPreviewStyle, run: (env: NodeJS.ProcessEnv) => Promise<T>): Promise<T> {
  if (!style.fontAssetPath) {
    return run(process.env);
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "sdd-fontconfig-"));
  const fontsConfPath = path.join(tempDir, "fonts.conf");
  const fontDir = path.dirname(style.fontAssetPath);
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

export async function renderDotToSvg(dot: string, style: DotPreviewStyle): Promise<string> {
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

export async function embedSvgFont(svg: string, style: DotPreviewStyle): Promise<string> {
  if (!style.fontAssetPath) {
    return svg;
  }

  const fontBuffer = await readFile(style.fontAssetPath);
  const { mimeType, format } = inferFontMimeType(style.fontAssetPath);
  const fontData = fontBuffer.toString("base64");
  const fontFaceBlock = `<style><![CDATA[
@font-face {
  font-family: '${style.fontFamily}';
  src: url("data:${mimeType};base64,${fontData}") format('${format}');
  font-style: normal;
  font-weight: 400;
}
]]></style>`;

  const svgOpenTagMatch = svg.match(/<svg\b[^>]*>/);
  if (!svgOpenTagMatch) {
    return svg;
  }

  const insertionOffset = svgOpenTagMatch.index! + svgOpenTagMatch[0].length;
  return `${svg.slice(0, insertionOffset)}\n${fontFaceBlock}\n${svg.slice(insertionOffset)}`;
}

export async function renderSvgToPng(svg: string, outputPath: string, style: DotPreviewStyle): Promise<void> {
  const fontBuffer = style.fontAssetPath ? new Uint8Array(await readFile(style.fontAssetPath)) : undefined;
  const resvgOptions: ResvgOptionsWithFontBuffers = {
    dpi: style.dpi,
    font: {
      ...(fontBuffer ? { fontBuffers: [fontBuffer] } : {}),
      loadSystemFonts: false,
      defaultFontFamily: style.fontFamily,
      sansSerifFamily: style.fontFamily,
      serifFamily: style.fontFamily,
      monospaceFamily: style.fontFamily
    }
  };
  // resvg-js supports `fontBuffers` at runtime, but this package version's Node typings
  // do not expose it, so we widen the options locally before constructing Resvg.
  const resvg = new Resvg(svg, resvgOptions as ConstructorParameters<typeof Resvg>[1]);

  await writeFile(path.resolve(outputPath), resvg.render().asPng());
}
