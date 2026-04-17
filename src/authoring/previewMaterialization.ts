import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PREVIEW_DISPLAY_COPY_ROOT = "/tmp/unique-previews";

export type PreviewMaterializationArtifact =
  | {
      format: "svg";
      mime_type: "image/svg+xml";
      text: string;
    }
  | {
      format: "png";
      mime_type: "image/png";
      base64: string;
    };

export class PreviewMaterializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreviewMaterializationError";
  }
}

function buildTimestampPrefix(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "-");
}

export function validateDisplayCopyName(
  displayCopyName: string,
  format: PreviewMaterializationArtifact["format"]
): string | undefined {
  if (displayCopyName.length === 0) {
    return "display_copy_name must be a non-empty basename.";
  }
  if (displayCopyName.includes("/") || displayCopyName.includes("\\")) {
    return "display_copy_name must be a basename without path separators.";
  }
  if (displayCopyName === "." || displayCopyName === ".." || displayCopyName.includes("..")) {
    return "display_copy_name must not contain '..'.";
  }

  const expectedExtension = `.${format}`;
  if (path.extname(displayCopyName).toLowerCase() !== expectedExtension) {
    return `display_copy_name must end with '${expectedExtension}' to match format '${format}'.`;
  }

  return undefined;
}

export async function materializePreviewDisplayCopy(
  artifact: PreviewMaterializationArtifact,
  displayCopyName: string,
  tempRoot: string = DEFAULT_PREVIEW_DISPLAY_COPY_ROOT
): Promise<string> {
  const validationError = validateDisplayCopyName(displayCopyName, artifact.format);
  if (validationError) {
    throw new PreviewMaterializationError(validationError);
  }

  await mkdir(tempRoot, { recursive: true });
  const materializationDir = await mkdtemp(path.join(tempRoot, `${buildTimestampPrefix(new Date())}-`));
  const displayCopyPath = path.join(materializationDir, displayCopyName);

  if (artifact.format === "svg") {
    await writeFile(displayCopyPath, artifact.text, "utf8");
  } else {
    await writeFile(displayCopyPath, Buffer.from(artifact.base64, "base64"));
  }

  return displayCopyPath;
}
