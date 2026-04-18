import { access, mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PREVIEW_ARTIFACT_ROOT,
  materializePreviewArtifact
} from "../src/authoring/previewMaterialization.js";

const createdDirectories = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...createdDirectories].map(async (directoryPath) => {
      await rm(directoryPath, { recursive: true, force: true });
    })
  );
  createdDirectories.clear();
});

describe("authoring preview materialization", () => {
  it("writes svg preview artifacts under /tmp/unique-previews with the requested basename", async () => {
    const artifactPath = await materializePreviewArtifact(
      {
        format: "svg",
        text: "<svg>preview</svg>"
      },
      "example.ia_place_map.strict.svg"
    );

    createdDirectories.add(path.dirname(artifactPath));

    expect(path.isAbsolute(artifactPath)).toBe(true);
    expect(artifactPath.startsWith(`${DEFAULT_PREVIEW_ARTIFACT_ROOT}/`)).toBe(true);
    expect(path.basename(artifactPath)).toBe("example.ia_place_map.strict.svg");
    await expect(readFile(artifactPath, "utf8")).resolves.toBe("<svg>preview</svg>");
  });

  it("writes png preview artifacts as binary files", async () => {
    const artifactPath = await materializePreviewArtifact(
      {
        format: "png",
        bytes: Buffer.from("89504e470d0a1a0a", "hex")
      },
      "example.ia_place_map.strict.png"
    );

    createdDirectories.add(path.dirname(artifactPath));

    const bytes = await readFile(artifactPath);
    expect(path.basename(artifactPath)).toBe("example.ia_place_map.strict.png");
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("creates a unique parent directory for repeated preview artifact materialization", async () => {
    const firstPath = await materializePreviewArtifact(
      {
        format: "svg",
        text: "<svg>one</svg>"
      },
      "example.ia_place_map.strict.svg"
    );
    const secondPath = await materializePreviewArtifact(
      {
        format: "svg",
        text: "<svg>two</svg>"
      },
      "example.ia_place_map.strict.svg"
    );

    createdDirectories.add(path.dirname(firstPath));
    createdDirectories.add(path.dirname(secondPath));

    expect(path.basename(firstPath)).toBe("example.ia_place_map.strict.svg");
    expect(path.basename(secondPath)).toBe("example.ia_place_map.strict.svg");
    expect(path.dirname(firstPath)).not.toBe(path.dirname(secondPath));
  });

  it("prunes stale preview artifact directories without deleting fresh or current output", async () => {
    const tempRoot = await mkdtemp(path.join("/tmp", "sdd-preview-materialization-"));
    createdDirectories.add(tempRoot);
    const staleDir = path.join(tempRoot, "stale-preview");
    const freshDir = path.join(tempRoot, "fresh-preview");
    await mkdir(staleDir);
    await mkdir(freshDir);
    await writeFile(path.join(staleDir, "old.svg"), "<svg>old</svg>", "utf8");
    await writeFile(path.join(freshDir, "fresh.svg"), "<svg>fresh</svg>", "utf8");

    const now = new Date("2026-04-18T12:00:00.000Z");
    const staleTime = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    await utimes(staleDir, staleTime, staleTime);

    const artifactPath = await materializePreviewArtifact(
      {
        format: "svg",
        text: "<svg>current</svg>"
      },
      "example.ia_place_map.strict.svg",
      { tempRoot, now }
    );

    await expect(access(staleDir)).rejects.toThrow();
    await expect(access(freshDir)).resolves.toBeUndefined();
    await expect(readFile(artifactPath, "utf8")).resolves.toBe("<svg>current</svg>");
  });
});
