import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import YAML from "yaml";
import { loadBundle } from "../src/bundle/loadBundle.js";
import type { Bundle } from "../src/bundle/types.js";
import { applyAuthoringIntent } from "../src/authoring/authoringIntents.js";
import { createDocument, applyChangeSet } from "../src/authoring/mutations.js";
import { inspectDocument } from "../src/authoring/inspect.js";
import { listDocumentDiagrams, projectDocument, validateDocument } from "../src/authoring/readServices.js";
import { renderPreview, AuthoringPreviewError } from "../src/authoring/preview.js";
import { undoChangeSet } from "../src/authoring/undo.js";
import { createAuthoringWorkspace } from "../src/authoring/workspace.js";
import { createGuidanceCatalog } from "../src/authoring/guidedAddition/catalog.js";
import { createNodeFieldDefinitions, normalizeAndValidateNodeFields } from "../src/authoring/guidedAddition/forms.js";
import { createGuidedDocumentSnapshot } from "../src/authoring/guidedAddition/snapshot.js";
import { getBundleResolvedContractSubjectDetail } from "../src/authoring/contractResolution.js";
import { getContractSubjectDetail } from "../src/authoring/contractMetadata.js";
import { runHelperCli } from "../src/cli/helperProgram.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let bundle: Bundle;
beforeAll(async () => { bundle = await loadBundle(path.join(repoRoot, "bundle/v0.2/manifest.yaml")); });

const source = [
  "SDD-TEXT 0.2",
  'Diagram DG-001 "Flow"', '  diagram_type=scenario_flow', "END",
  'Diagram DG-002 "Flow"', '  diagram_type=scenario_flow', "END",
  'ScenarioStep S-001 "Open"', '  PRECEDES S-002 "Finish" [open] {ready} / advance priority=high diagrams=DG-001 # keep edge comment', "END",
  'ScenarioStep S-002 "Finish"', "END",
  'ScenarioStep S-003 "Other"', '  diagrams=DG-002', "END", ""
].join("\n");

async function withDocument(run: (root: string, workspace: ReturnType<typeof createAuthoringWorkspace>) => Promise<void>, text = source): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "sdd-diagram-helper-"));
  try {
    await writeFile(path.join(root, "flows.sdd"), text, "utf8");
    await run(root, createAuthoringWorkspace(root));
  } finally { await rm(root, { recursive: true, force: true }); }
}

async function inspect(workspace: ReturnType<typeof createAuthoringWorkspace>) {
  const inspected = await inspectDocument(workspace, bundle, "flows.sdd");
  if (inspected.kind !== "sdd-inspected-document") throw new Error(JSON.stringify(inspected.diagnostics));
  return inspected;
}

function validateShape(subject: string, side: "input_shape" | "output_shape", value: unknown) {
  const detail = getContractSubjectDetail(subject as `helper.command.${string}`)!;
  const validate = new Ajv2020({ strict: false, allErrors: true }).compile(detail[side]!.schema);
  expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
}

describe("named diagram helper integration", () => {
  it("creates a Diagram and members through the normal authoring lifecycle", async () => {
    await withDocument(async (_root, workspace) => {
      const created = await createDocument(workspace, bundle, { path: "created.sdd" });
      const authored = await applyAuthoringIntent(workspace, bundle, {
        path: "created.sdd", base_revision: created.revision, mode: "commit", validate_profile: "simple", projection_diagrams: ["DG-010"],
        intents: [
          { kind: "insert_node_scaffold", local_id: "diagram", placement: { mode: "last" }, node: {
            node_type: "Diagram", node_id: "DG-010", name: "Created flow", props: [{ key: "diagram_type", value_kind: "bare_value", raw_value: "scenario_flow" }]
          } },
          { kind: "insert_node_scaffold", local_id: "open", placement: { mode: "last" }, node: {
            node_type: "ScenarioStep", node_id: "S-010", name: "Open", edges: [{ local_id: "edge", rel_type: "PRECEDES", to: "S-011", props: { diagrams: "DG-010" } }]
          } },
          { kind: "insert_node_scaffold", local_id: "finish", placement: { mode: "last" }, node: { node_type: "ScenarioStep", node_id: "S-011", name: "Finish" } }
        ]
      });
      expect(authored.status, JSON.stringify(authored.diagnostics)).toBe("applied");
      expect(authored.change_set.projection_results).toMatchObject([{ view_id: "scenario_flow", diagram_id: "DG-010", diagram_name: "Created flow", projection: { nodes: expect.any(Array), edges: expect.any(Array) } }]);
      const inventory = await listDocumentDiagrams(workspace, bundle, { path: "created.sdd", details: true });
      expect(inventory.diagrams).toMatchObject([{ diagram_id: "DG-010", node_ids: ["S-010", "S-011"], node_count: 2, edge_count: 1 }]);
      const validated = await validateDocument(workspace, bundle, { path: "created.sdd", profile_id: "simple" });
      expect(validated.report?.error_count, JSON.stringify(validated.diagnostics)).toBe(0);
      const projected = await projectDocument(workspace, bundle, { path: "created.sdd", diagram_id: "DG-010" });
      expect(projected.projection).toEqual(authored.change_set.projection_results?.[0]?.projection);
      const previewed = await renderPreview(workspace, bundle, { path: "created.sdd", diagram_id: "DG-010", profile_id: "simple", detail_id: "compact", format: "svg" });
      expect(previewed).toMatchObject({ view_id: "scenario_flow", diagram_id: "DG-010", diagram_name: "Created flow" });
      expect(path.basename(previewed.artifact_path)).toContain(".scenario_flow.diagram-DG-010.compact.");
      validateShape("helper.command.preview", "output_shape", previewed);
      expect(await readFile(previewed.artifact_path, "utf8")).toContain("Created flow");
    });
  });

  it("edits one exact edge property, preserves fields and comments, normalizes lists, and undoes the edit", async () => {
    await withDocument(async (root, workspace) => {
      const current = await inspect(workspace);
      const edge = current.resource.body_items.find((item) => item.kind === "edge_line")!;
      const changed = await applyChangeSet(workspace, bundle, {
        path: "flows.sdd", base_revision: current.resource.revision, mode: "commit", projection_views: ["scenario_flow"], projection_diagrams: ["DG-001", "DG-002"],
        operations: [{ kind: "set_edge_property", edge_handle: edge.handle, key: "diagrams", value_kind: "quoted_string", raw_value: " DG-002, DG-001,DG-002 " }]
      });
      expect(changed.status, JSON.stringify(changed.diagnostics)).toBe("applied");
      expect(changed.summary.edge_property_changes).toMatchObject([{ edge_handle: edge.handle, key: "diagrams", from: "DG-001", to: "DG-001,DG-002" }]);
      expect(changed.projection_results?.map((entry) => entry.diagram_id)).toEqual([undefined, "DG-001", "DG-002"]);
      const updated = await inspect(workspace);
      expect(updated.resource.body_items.find((item) => item.kind === "edge_line")?.edge).toMatchObject({
        rel_type: "PRECEDES", to: "S-002", to_name: "Finish", event: "open", guard: "ready", effect: "advance", props: { diagrams: "DG-001,DG-002", priority: "high" }
      });
      expect(await readFile(path.join(root, "flows.sdd"), "utf8")).toContain("# keep edge comment");
      const named = await projectDocument(workspace, bundle, { path: "flows.sdd", diagram_id: "DG-002" });
      expect((named.projection as { edges: unknown[] }).edges).toHaveLength(1);
      expect(named.uri).toContain("/projection/scenario_flow/diagram/DG-002");
      const undone = await undoChangeSet(workspace, bundle, { change_set_id: changed.change_set_id, mode: "commit" });
      expect(undone.status).toBe("applied");
      expect(await readFile(path.join(root, "flows.sdd"), "utf8")).toBe(source);
      validateShape("helper.command.apply", "output_shape", changed);
    });
  });

  it("removes membership in place and leaves legal empty declarations discoverable without preview fallback", async () => {
    await withDocument(async (root, workspace) => {
      const current = await inspect(workspace);
      const edge = current.resource.body_items.find((item) => item.kind === "edge_line")!;
      const changed = await applyChangeSet(workspace, bundle, { path: "flows.sdd", base_revision: current.resource.revision, mode: "commit", operations: [{ kind: "remove_edge_property", edge_handle: edge.handle, key: "diagrams" }] });
      expect(changed.status).toBe("applied");
      expect(await readFile(path.join(root, "flows.sdd"), "utf8")).toContain("priority=high # keep edge comment");
      const listed = await listDocumentDiagrams(workspace, bundle, { path: "flows.sdd" });
      expect(listed.diagrams[0]).toMatchObject({ diagram_id: "DG-001", node_count: 0, edge_count: 0 });
      expect(listed.diagnostics.some((item) => item.severity === "warn")).toBe(true);
      const projection = await projectDocument(workspace, bundle, { path: "flows.sdd", diagram_id: "DG-001" });
      expect(projection.projection).toMatchObject({ nodes: [], edges: [] });
      await expect(renderPreview(workspace, bundle, { path: "flows.sdd", diagram_id: "DG-001", profile_id: "simple", detail_id: "compact", format: "svg" })).rejects.toBeInstanceOf(AuthoringPreviewError);
    });
  });

  it("preserves unrelated property occurrences, quoting, and order during an edge edit", async () => {
    const original = source.replace("priority=high", 'priority="high" priority=low');
    await withDocument(async (root, workspace) => {
      const current = await inspect(workspace);
      const edge = current.resource.body_items.find((item) => item.kind === "edge_line")!;
      const changed = await applyChangeSet(workspace, bundle, { path: "flows.sdd", base_revision: current.resource.revision, mode: "commit", operations: [{ kind: "set_edge_property", edge_handle: edge.handle, key: "diagrams", value_kind: "quoted_string", raw_value: "DG-002" }] });
      expect(changed.status, JSON.stringify(changed.diagnostics)).toBe("applied");
      expect(await readFile(path.join(root, "flows.sdd"), "utf8")).toBe(original.replace("diagrams=DG-001", 'diagrams="DG-002"'));
    }, original);
  });

  it("rejects invalid membership and stale edge handles atomically", async () => {
    await withDocument(async (root, workspace) => {
      const current = await inspect(workspace);
      const edge = current.resource.body_items.find((item) => item.kind === "edge_line")!;
      for (const raw_value of ["DG-999", "S-002", "", "DG-001,,DG-002"]) {
        const rejected = await applyChangeSet(workspace, bundle, { path: "flows.sdd", base_revision: current.resource.revision, mode: "commit", operations: [{ kind: "set_edge_property", edge_handle: edge.handle, key: "diagrams", value_kind: "quoted_string", raw_value }] });
        expect(rejected.status, raw_value).toBe("rejected");
        expect(rejected.undo_eligible).toBe(false);
        expect(await readFile(path.join(root, "flows.sdd"), "utf8")).toBe(source);
      }
      const rejected = await applyChangeSet(workspace, bundle, { path: "flows.sdd", base_revision: "stale", mode: "commit", operations: [{ kind: "remove_edge_property", edge_handle: edge.handle, key: "diagrams" }] });
      expect(rejected.diagnostics.some((item) => item.code === "sdd.revision_mismatch")).toBe(true);
      const sourceNode = current.resource.nodes.find((node) => node.node_id === "S-001")!;
      const incompatible = await applyChangeSet(workspace, bundle, { path: "flows.sdd", base_revision: current.resource.revision, mode: "commit", operations: [
        { kind: "set_node_property", node_handle: current.resource.nodes.find((node) => node.node_id === "DG-002")!.handle, key: "diagram_type", value_kind: "bare_value", raw_value: "journey_map" },
        { kind: "set_node_property", node_handle: sourceNode.handle, key: "diagrams", value_kind: "bare_value", raw_value: "DG-002" }
      ] });
      expect(incompatible.status).toBe("rejected");
      expect(await readFile(path.join(root, "flows.sdd"), "utf8")).toBe(source);
    });
  });

  it("rejects parse and compile failures in generic edge-property candidates without writing", async () => {
    await withDocument(async (root, workspace) => {
      const current = await inspect(workspace);
      const edge = current.resource.body_items.find((item) => item.kind === "edge_line")!;
      const malformed = await applyChangeSet(workspace, bundle, {
        path: "flows.sdd", base_revision: current.resource.revision, mode: "commit",
        operations: [{ kind: "set_edge_property", edge_handle: edge.handle, key: "priority", value_kind: "bare_value", raw_value: "two words" }]
      });
      expect(malformed.status).toBe("rejected");
      expect(malformed.undo_eligible).toBe(false);
      expect(malformed.diagnostics.some((diagnostic) => diagnostic.stage === "parse" && diagnostic.severity === "error")).toBe(true);
      expect(await readFile(path.join(root, "flows.sdd"), "utf8")).toBe(source);

      for (const operation of [
        { kind: "set_edge_property" as const, edge_handle: edge.handle, key: "priority", value_kind: "quoted_string" as const, raw_value: "two words" },
        { kind: "remove_edge_property" as const, edge_handle: edge.handle, key: "priority" }
      ]) {
        const duplicate = await applyChangeSet(workspace, bundle, {
          path: "flows.sdd", base_revision: current.resource.revision, mode: "commit",
          operations: [operation, { kind: "insert_node_block", node_type: "ScenarioStep", node_id: "S-002", name: "Duplicate", placement: { mode: "last", stream: "top_level" } }]
        });
        expect(duplicate.status).toBe("rejected");
        expect(duplicate.undo_eligible).toBe(false);
        expect(duplicate.diagnostics.some((diagnostic) => diagnostic.code === "compile.duplicate_node_id")).toBe(true);
        expect(await readFile(path.join(root, "flows.sdd"), "utf8")).toBe(source);
      }
    });
  });

  it("follows the bundle delimiter and metadata form choices", async () => {
    await withDocument(async (root, workspace) => {
      const bundleRoot = path.join(root, "bundle");
      await cp(path.dirname(bundle.manifestPath), bundleRoot, { recursive: true });
      const contractsPath = path.join(bundleRoot, bundle.manifest.core.contracts);
      const contracts = YAML.parse(await readFile(contractsPath, "utf8")) as Bundle["contracts"];
      contracts.diagram_membership!.references.delimiter = ";";
      await writeFile(contractsPath, YAML.stringify(contracts));
      const viewsPath = path.join(bundleRoot, bundle.manifest.core.views);
      const views = YAML.parse(await readFile(viewsPath, "utf8")) as Bundle["views"];
      views.views.find((view) => view.id === "journey_map")!.projection.named_diagrams!.enabled = false;
      await writeFile(viewsPath, YAML.stringify(views));
      const changedBundle = await loadBundle(path.join(bundleRoot, "manifest.yaml"));
      const current = await inspect(workspace);
      const edge = current.resource.body_items.find((item) => item.kind === "edge_line")!;
      const changed = await applyChangeSet(workspace, changedBundle, { path: "flows.sdd", base_revision: current.resource.revision, mode: "commit", operations: [{ kind: "set_edge_property", edge_handle: edge.handle, key: "diagrams", value_kind: "quoted_string", raw_value: "DG-002;DG-001;DG-002" }] });
      expect(changed.status).toBe("applied");
      expect(await readFile(path.join(root, "flows.sdd"), "utf8")).toContain('diagrams="DG-001;DG-002"');
      const catalog = createGuidanceCatalog(changedBundle);
      const metadata = changedBundle.contracts.diagram_membership!;
      const diagramType = catalog.getNodeType(metadata.declaration_type)!;
      const field = createNodeFieldDefinitions(catalog, diagramType).find((field) => field.property === metadata.type_property)!;
      expect(field).toMatchObject({ required: true, format: "enum" });
      expect(field.allowed_values).toEqual(changedBundle.views.views.filter((view) => view.projection.named_diagrams?.enabled).map((view) => view.id));
      const resolved = getBundleResolvedContractSubjectDetail("helper.command.apply", changedBundle)!;
      expect(resolved.authoring_format_card?.lines.join("\n")).toContain('";"');
    });
  });

  it("rejects empty membership elements during node form validation", () => {
    const catalog = createGuidanceCatalog(bundle);
    const snapshot = createGuidedDocumentSnapshot(bundle, { document_ref: "flows.sdd", text: source });
    const metadata = bundle.contracts.diagram_membership!;
    for (const raw_value of ["DG-001,", ",DG-001", "DG-001,,DG-002"]) {
      const validated = normalizeAndValidateNodeFields(catalog, snapshot, catalog.getNodeType("ScenarioStep")!, {
        node_id: "S-010", name: "New", properties: [{ key: metadata.membership_property, value_kind: "quoted_string", raw_value }]
      });
      expect(validated.diagnostics.some((diagnostic) => diagnostic.code === "guided_addition.invalid_field_value" && diagnostic.message.includes("unavailable node reference ''")), raw_value).toBe(true);
    }
    const valid = normalizeAndValidateNodeFields(catalog, snapshot, catalog.getNodeType("ScenarioStep")!, {
      node_id: "S-010", name: "New", properties: [{ key: metadata.membership_property, value_kind: "quoted_string", raw_value: "DG-001,DG-002" }]
    });
    expect(valid.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  });

  it("keeps invalid declarations discoverable without fabricated counts and reports unsupported bundles", async () => {
    await withDocument(async (_root, workspace) => {
      const listed = await listDocumentDiagrams(workspace, bundle, { path: "flows.sdd", details: true });
      const invalid = listed.diagrams.find((diagram) => diagram.diagram_id === "DG-001")!;
      expect(invalid.view_id).toBeUndefined();
      expect(invalid.node_count).toBeUndefined();
      expect(invalid.edge_count).toBeUndefined();
      expect(invalid.diagnostics.some((diagnostic) => diagnostic.severity === "error")).toBe(true);
      validateShape("helper.command.diagrams", "output_shape", listed);
      await expect(renderPreview(workspace, bundle, { path: "flows.sdd", diagram_id: "DG-001", profile_id: "simple", detail_id: "compact", format: "svg" })).rejects.toBeInstanceOf(AuthoringPreviewError);
    }, source.replace("diagram_type=scenario_flow", "diagram_type=unknown_view"));
    const legacy = await loadBundle(path.join(repoRoot, "bundle/v0.1/manifest.yaml"));
    await withDocument(async (_root, workspace) => {
      const listed = await listDocumentDiagrams(workspace, legacy, { path: "flows.sdd" });
      expect(listed.diagrams).toEqual([]);
      expect(listed.diagnostics.some((diagnostic) => diagnostic.severity === "error" && diagnostic.message.includes("does not support named diagrams"))).toBe(true);
      const projected = await projectDocument(workspace, legacy, { path: "flows.sdd", diagram_id: "DG-001" });
      expect(projected.projection).toBeUndefined();
    }, 'SDD-TEXT 0.1\nPlace P-001 "Home"\nEND\n');
  });

  it("exposes named selection through helper discovery and commands, including selector errors", async () => {
    await withDocument(async (root) => {
      const call = async (args: string[]) => {
        const output: string[] = [];
        const result = await runHelperCli(["node", "sdd-helper", "--bundle", bundle.manifestPath, ...args], {
          cwd: () => root, findRepoRoot: async () => root, loadBundle: async () => bundle, stdout: (text) => output.push(text)
        });
        return { ...result, payload: JSON.parse(output.join("")) };
      };
      const listed = await call(["diagrams", "flows.sdd"]);
      expect(listed.exitCode).toBe(0);
      expect(listed.payload.diagrams.map((diagram: { diagram_id: string }) => diagram.diagram_id)).toEqual(["DG-001", "DG-002"]);
      expect(listed.payload).toMatchObject({ effective_version: "0.2", bundle: { version: "0.2", fingerprint: expect.any(String) } });
      expect(listed.payload.diagrams[0]).not.toHaveProperty("node_ids");
      expect(listed.payload.diagrams[0]).toHaveProperty("diagnostics");
      validateShape("helper.command.diagrams", "output_shape", listed.payload);
      const detailed = await call(["diagrams", "flows.sdd", "--details"]);
      expect(detailed.payload.diagrams[0].node_ids).toEqual(["S-001", "S-002"]);
      expect(detailed.payload.diagrams[0].inclusions).toEqual(expect.arrayContaining([{ node_id: "S-001", reasons: ["assigned_edge_endpoint"] }]));
      validateShape("helper.command.diagrams", "output_shape", detailed.payload);
      const projected = await call(["project", "flows.sdd", "--diagram", "DG-001"]);
      expect(projected.payload).toMatchObject({ view_id: "scenario_flow", diagram_id: "DG-001", diagram_name: "Flow" });
      expect(projected.payload.projection.edges).toHaveLength(1);
      validateShape("helper.command.project", "input_shape", { path: "flows.sdd", diagram_id: "DG-001" });
      for (const args of [["--diagram", "DG-404"], ["--diagram", "DG-001", "--view", "journey_map"]]) {
        const failed = await call(["project", "flows.sdd", ...args]);
        expect(failed.payload.projection).toBeUndefined();
        expect(failed.payload.assessment.can_render).toBe(false);
      }
      for (const args of [[], ["--diagram", "all"], ["--view", "all"]]) {
        const failed = await call(["project", "flows.sdd", ...args]);
        expect(failed.exitCode).toBe(1);
        expect(failed.payload.kind).toBe("sdd-helper-error");
      }
      const supported = await call(["contract", "helper.command.project", "--resolve", "bundle"]);
      expect(supported.payload.constraints.some((constraint: { kind: string }) => constraint.kind === "resolved_diagram_selection")).toBe(true);
    });
  });
});
