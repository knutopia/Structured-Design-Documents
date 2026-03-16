import { EventEmitter } from "node:events";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

const { spawnMock, ResvgMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  ResvgMock: vi.fn()
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock
}));

vi.mock("@resvg/resvg-js", () => ({
  Resvg: ResvgMock
}));

const repoRoot = "/home/knut/projects/sdd";

describe("legacyGraphvizPreviewBackend helpers", () => {
  afterEach(() => {
    spawnMock.mockReset();
    ResvgMock.mockReset();
  });

  it("renders SVG without passing a Graphviz DPI override", async () => {
    spawnMock.mockImplementation(() => {
      const child = new EventEmitter() as EventEmitter & {
        stdin: PassThrough;
        stdout: PassThrough;
        stderr: PassThrough;
      };
      child.stdin = new PassThrough();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();

      queueMicrotask(() => {
        child.stdout.write("<svg>ok</svg>");
        child.stdout.end();
        child.emit("close", 0);
      });

      return child;
    });

    const { renderLegacyDotToSvg } = await import("../src/renderer/legacyGraphvizPreviewBackend.js");
    await expect(renderLegacyDotToSvg("digraph G {}", { fontFamily: "Public Sans", dpi: 192 })).resolves.toBe("<svg>ok</svg>");
    expect(spawnMock).toHaveBeenCalledWith(
      "dot",
      ["-Tsvg"],
      expect.objectContaining({
        stdio: ["pipe", "pipe", "pipe"]
      })
    );
  });

  it("injects an embedded Public Sans font face into SVG output", async () => {
    const { embedLegacySvgFont } = await import("../src/renderer/legacyGraphvizPreviewBackend.js");
    const result = await embedLegacySvgFont(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text font-family="Public Sans">Hello</text></svg>',
      {
        fontFamily: "Public Sans",
        svgFontAssetPath: path.join(repoRoot, "bundle/v0.1/assets/fonts/PublicSans-Regular.woff"),
        pngFontAssetPath: path.join(repoRoot, "bundle/v0.1/assets/fonts/PublicSans-Regular.otf"),
        dpi: 192
      }
    );

    expect(result).toContain("@font-face");
    expect(result).toContain("Public Sans");
    expect(result).toContain("data:font/woff;base64,");
  });

  it("passes the desktop font asset to Resvg via fontFiles for PNG rendering", async () => {
    ResvgMock.mockImplementation(() => ({
      render: () => ({
        asPng: () => Buffer.from("png")
      })
    }));

    const { renderLegacySvgToPng } = await import("../src/renderer/legacyGraphvizPreviewBackend.js");
    const png = await renderLegacySvgToPng(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text font-family="Public Sans">Hello</text></svg>',
      {
        fontFamily: "Public Sans",
        svgFontAssetPath: path.join(repoRoot, "bundle/v0.1/assets/fonts/PublicSans-Regular.woff"),
        pngFontAssetPath: path.join(repoRoot, "bundle/v0.1/assets/fonts/PublicSans-Regular.otf"),
        dpi: 192
      }
    );

    expect(ResvgMock).toHaveBeenCalledTimes(1);
    const options = ResvgMock.mock.calls[0][1];
    expect(options).toMatchObject({
      dpi: 192,
      font: {
        loadSystemFonts: false,
        defaultFontFamily: "Public Sans",
        sansSerifFamily: "Public Sans",
        serifFamily: "Public Sans",
        monospaceFamily: "Public Sans"
      }
    });
    expect(options.font.fontFiles).toEqual([
      path.join(repoRoot, "bundle/v0.1/assets/fonts/PublicSans-Regular.otf")
    ]);
    expect(options.font.fontFiles).not.toContain(
      path.join(repoRoot, "bundle/v0.1/assets/fonts/PublicSans-Regular.woff")
    );
    expect(Buffer.from(png)).toEqual(Buffer.from("png"));
  });
});
