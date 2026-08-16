import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createGuidedDocumentSnapshot,
  createGuidedDocumentSnapshotFromWorkspace,
  GuidedAdditionV1DomainError,
  loadBundle
} from "../src/index.js";
import type { Bundle } from "../src/bundle/types.js";
import { getContractSubjectDetail } from "../src/authoring/contractMetadata.js";
import { createAuthoringWorkspace } from "../src/authoring/workspace.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");

const source = [
  'Place P-001 "Parent"',
  '  description="Parent place"',
  '  CONTAINS VS-001 "Default"',
  '  NAVIGATES_TO P-002 "Destination"',
  '  + ViewState VS-001 "Default"',
  "  END",
  "END",
  'Place P-002 "Destination"',
  '  NAVIGATES_TO P-001 "Parent"',
  "END",
  ""
].join("\n");

let bundle: Bundle;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
});

function cloneBundle(): Bundle {
  return structuredClone(bundle) as Bundle;
}

function captureDomainError(action: () => unknown): GuidedAdditionV1DomainError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(GuidedAdditionV1DomainError);
    return error as GuidedAdditionV1DomainError;
  }
  throw new Error("Expected GuidedAdditionV1DomainError");
}

describe("guided document snapshot", () => {
  it("combines revision-bound structure with literal compiled graph semantics in source order", () => {
    const snapshot = createGuidedDocumentSnapshot(bundle, {
      document_ref: "docs/proof.sdd",
      path: "docs/proof.sdd",
      text: source
    });

    expect(snapshot).toMatchObject({
      kind: "sdd-guided-document-snapshot",
      document_ref: "docs/proof.sdd",
      path: "docs/proof.sdd",
      revision: expect.stringMatching(/^rev_[a-f0-9]{64}$/),
      bundle_fingerprint: expect.stringMatching(/^bnd_[a-f0-9]{64}$/),
      effective_version: "0.1",
      diagnostics: []
    });
    expect(snapshot.nodes.map((node) => [node.node_id, node.source_order])).toEqual([
      ["P-001", 0],
      ["VS-001", 1],
      ["P-002", 2]
    ]);
    expect(snapshot.nodes[1].parent_handle).toBe(snapshot.nodes[0].handle);
    expect(snapshot.edges.map((edge) => [edge.from, edge.type, edge.to, edge.source_order])).toEqual([
      ["P-001", "CONTAINS", "VS-001", 0],
      ["P-001", "NAVIGATES_TO", "P-002", 1],
      ["P-002", "NAVIGATES_TO", "P-001", 2]
    ]);
    expect(snapshot.top_level_order).toEqual([snapshot.nodes[0].handle, snapshot.nodes[2].handle]);
    expect(snapshot.body_order_by_parent[snapshot.nodes[0].handle]).toEqual(
      expect.arrayContaining([snapshot.edges[0].handle, snapshot.edges[1].handle, snapshot.nodes[1].handle])
    );
    expect(snapshot.body_order_by_parent[snapshot.nodes[2].handle]).toEqual([snapshot.edges[2].handle]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.nodes)).toBe(true);
    expect(Object.isFrozen(snapshot.nodes[0])).toBe(true);
    expect(JSON.stringify(snapshot)).not.toMatch(/nodesBy|incomingBy|outgoingBy|usedNodeIds|handleIndex/);
  });

  it("is byte-identical across repeated construction and newline normalization", () => {
    const input = { document_ref: "docs/proof.sdd", path: "docs/proof.sdd", text: source };
    const first = createGuidedDocumentSnapshot(bundle, input);
    const second = createGuidedDocumentSnapshot(bundle, input);
    const crlf = createGuidedDocumentSnapshot(bundle, { ...input, text: source.replaceAll("\n", "\r\n") });

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(JSON.stringify(crlf)).toBe(JSON.stringify(first));
  });

  it("changes only revision-bound identity when source changes", () => {
    const first = createGuidedDocumentSnapshot(bundle, { document_ref: "docs/proof.sdd", text: source });
    const changed = createGuidedDocumentSnapshot(bundle, {
      document_ref: "docs/proof.sdd",
      text: source.replace('"Destination"', '"Changed destination"')
    });

    expect(changed.revision).not.toBe(first.revision);
    expect(changed.bundle_fingerprint).toBe(first.bundle_fingerprint);
    expect(changed.nodes[0].handle).not.toBe(first.nodes[0].handle);
  });

  it("changes only bundle identity when bundle semantics change", () => {
    const first = createGuidedDocumentSnapshot(bundle, { document_ref: "docs/proof.sdd", text: source });
    const cloned = cloneBundle();
    cloned.authoring!.node_id_suggestions.prefix_by_type.Place = "PX";
    const changed = createGuidedDocumentSnapshot(cloned, { document_ref: "docs/proof.sdd", text: source });

    expect(changed.revision).toBe(first.revision);
    expect(changed.bundle_fingerprint).not.toBe(first.bundle_fingerprint);
    expect(changed.nodes).toEqual(first.nodes);
    expect(changed.edges).toEqual(first.edges);
  });

  it("does not require validation-profile completeness", () => {
    const snapshot = createGuidedDocumentSnapshot(bundle, {
      document_ref: "docs/incomplete-governance.sdd",
      text: 'Place P-001 "Draft"\nEND\n'
    });
    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("blocks parse failures with a stable authoring-domain diagnostic", () => {
    const error = captureDomainError(() =>
      createGuidedDocumentSnapshot(bundle, {
        document_ref: "docs/parse-error.sdd",
        text: 'Place P-001 "Missing end"\n'
      })
    );
    expect(error.code).toBe("guided_addition.document_unavailable");
    expect(error.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: "authoring", code: "guided_addition.document_unavailable", severity: "error" }),
        expect.objectContaining({ stage: "parse", severity: "error" })
      ])
    );
  });

  it("blocks duplicate IDs and compile failures", () => {
    const error = captureDomainError(() =>
      createGuidedDocumentSnapshot(bundle, {
        document_ref: "docs/duplicate.sdd",
        text: ['Place P-001 "First"', "END", 'Place P-001 "Second"', "END", ""].join("\n")
      })
    );
    expect(error.code).toBe("guided_addition.document_unavailable");
    expect(error.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: "compile", code: "compile.duplicate_node_id", severity: "error" })
      ])
    );
  });

  it("reports unsupported bundles without substituting defaults", () => {
    const cloned = cloneBundle();
    delete cloned.authoring;
    delete cloned.manifest.core.authoring;
    const error = captureDomainError(() =>
      createGuidedDocumentSnapshot(cloned, { document_ref: "docs/unsupported.sdd", text: source })
    );
    expect(error.code).toBe("guided_addition.unsupported_bundle");
    expect(error.diagnostics).toEqual([
      expect.objectContaining({ stage: "authoring", code: "guided_addition.unsupported_bundle", severity: "error" })
    ]);
  });

  it("normalizes file-backed document_ref and path through the workspace adapter", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "guided-snapshot-"));
    try {
      await writeFile(path.join(tempRoot, "proof.sdd"), source, "utf8");
      const snapshot = await createGuidedDocumentSnapshotFromWorkspace(
        createAuthoringWorkspace(tempRoot),
        bundle,
        "./proof.sdd"
      );
      expect(snapshot.document_ref).toBe("proof.sdd");
      expect(snapshot.path).toBe("proof.sdd");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("keeps catalog and snapshot modules free of write-side and client imports", async () => {
    const files = [
      "src/authoring/guidedAddition/catalog.ts",
      "src/authoring/guidedAddition/sharedContracts.ts",
      "src/authoring/guidedAddition/v1/contracts.ts",
      "src/authoring/guidedAddition/snapshot.ts"
    ];
    for (const file of files) {
      const text = await readFile(path.join(repoRoot, file), "utf8");
      expect(text).not.toMatch(/from\s+["'][^"']*(mutations|journal|workspace|cli|helper)[^"']*["']/);
      expect(text).not.toMatch(/from\s+["']node:fs(?:\/promises)?["']/);
    }

    const adapterText = await readFile(
      path.join(repoRoot, "src/authoring/guidedAddition/snapshotFiles.ts"),
      "utf8"
    );
    expect(adapterText).toContain('import { readFile } from "node:fs/promises"');
    expect(adapterText).not.toMatch(/\b(writeFile|appendFile|rm|rename|unlink|mkdir)\b/);
    expect(adapterText).not.toMatch(/from\s+["'][^"']*(mutations|journal|cli|helper)[^"']*["']/);
  });

  it("exposes the authoring diagnostic stage through machine-readable diagnostic metadata", () => {
    const detail = getContractSubjectDetail("helper.command.inspect");
    const schemaText = JSON.stringify(detail?.output_shape?.schema);
    expect(schemaText).toContain('"authoring"');
    expect(schemaText).toContain('"bundle"');
    expect(schemaText).toContain('"compile"');
  });
});
