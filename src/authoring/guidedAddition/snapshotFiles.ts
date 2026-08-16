import { readFile } from "node:fs/promises";
import type { Bundle } from "../../bundle/types.js";
import type { AuthoringWorkspace } from "../workspace.js";
import type { GuidedDocumentSnapshot } from "./sharedContracts.js";
import { createGuidedDocumentSnapshot } from "./snapshot.js";

export async function createGuidedDocumentSnapshotFromWorkspace(
  workspace: AuthoringWorkspace,
  bundle: Bundle,
  documentPath: string
): Promise<GuidedDocumentSnapshot> {
  const resolved = workspace.resolveDocumentPath(documentPath);
  const text = await readFile(resolved.absolutePath, "utf8");
  return createGuidedDocumentSnapshot(bundle, {
    document_ref: resolved.publicPath,
    path: resolved.publicPath,
    text
  });
}
