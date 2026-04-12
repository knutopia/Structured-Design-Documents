import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

export function normalizeTextToLf(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

export function computeDocumentRevision(text: string): string {
  const canonicalText = normalizeTextToLf(text);
  const digest = createHash("sha256").update(canonicalText, "utf8").digest("hex");
  return `rev_${digest}`;
}

export function stringifyCanonicalJson(value: unknown): string {
  return `${normalizeTextToLf(JSON.stringify(value, null, 2))}\n`;
}

export async function writeCanonicalLfText(filePath: string, text: string): Promise<string> {
  const canonicalText = normalizeTextToLf(text);
  await writeFile(filePath, canonicalText, "utf8");
  return canonicalText;
}
