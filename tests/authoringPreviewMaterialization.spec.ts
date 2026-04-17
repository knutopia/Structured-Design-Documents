import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PREVIEW_DISPLAY_COPY_ROOT,
  materializePreviewDisplayCopy
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
  it("writes svg display copies under /tmp/unique-previews with the requested basename", async () => {
    const displayCopyPath = await materializePreviewDisplayCopy(
      {
        format: "svg",
        mime_type: "image/svg+xml",
        text: "<svg>preview</svg>"
      },
      "example.ia_place_map.strict.svg"
    );

    createdDirectories.add(path.dirname(displayCopyPath));

    expect(path.isAbsolute(displayCopyPath)).toBe(true);
    expect(displayCopyPath.startsWith(`${DEFAULT_PREVIEW_DISPLAY_COPY_ROOT}/`)).toBe(true);
    expect(path.basename(displayCopyPath)).toBe("example.ia_place_map.strict.svg");
    await expect(readFile(displayCopyPath, "utf8")).resolves.toBe("<svg>preview</svg>");
  });

  it("writes png display copies as binary files", async () => {
    const displayCopyPath = await materializePreviewDisplayCopy(
      {
        format: "png",
        mime_type: "image/png",
        base64: Buffer.from("89504e470d0a1a0a", "hex").toString("base64")
      },
      "example.ia_place_map.strict.png"
    );

    createdDirectories.add(path.dirname(displayCopyPath));

    const bytes = await readFile(displayCopyPath);
    expect(path.basename(displayCopyPath)).toBe("example.ia_place_map.strict.png");
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("creates a unique parent directory for repeated display-copy materialization", async () => {
    const firstPath = await materializePreviewDisplayCopy(
      {
        format: "svg",
        mime_type: "image/svg+xml",
        text: "<svg>one</svg>"
      },
      "example.ia_place_map.strict.svg"
    );
    const secondPath = await materializePreviewDisplayCopy(
      {
        format: "svg",
        mime_type: "image/svg+xml",
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
});
