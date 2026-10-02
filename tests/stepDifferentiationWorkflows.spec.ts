import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadBundle, compileSource, createGuidanceCatalog, createGuidedAdditionRuntimeV1, createGuidedDocumentSnapshot, applyAdditionProposalV1 } from "../src/index.js";
import type { GuidedAdditionActionV1, GuidedAdditionResultV1 } from "../src/authoring/guidedAddition/v1/contracts.js";
import { createAuthoringWorkspace } from "../src/authoring/workspace.js";
import { inspectDocument } from "../src/authoring/inspect.js";
import { projectDocument, validateDocument } from "../src/authoring/readServices.js";
import { renderPreview } from "../src/authoring/preview.js";
import { suggestNodeId } from "../src/authoring/guidedAddition/forms.js";
import { renderSourcePreview } from "../src/renderer/previewWorkflow.js";

const sourcePath = "bundle/v0.2/examples/step_differentiation.sdd";

describe("differentiated Step workflows", () => {
  it.each(["forward", "reverse"])("offers and applies the %s mapping without a reciprocal warning or automatic edge", async direction => {
    const bundle = await loadBundle("bundle/v0.2/manifest.yaml");
    const catalog = createGuidanceCatalog(bundle);
    const text = (await readFile(sourcePath, "utf8")).replace(direction === "reverse" ? /^\s+MAPS_TO J-001\n/m : /^\s+MAPS_TO BP-001\n/m, "");
    const root = await mkdtemp("/tmp/sdd-step-workflow-");
    try {
      const documentPath = "proof.sdd";
      await writeFile(path.join(root, documentPath), text);
      const workspace = createAuthoringWorkspace(root);
      const snapshot = createGuidedDocumentSnapshot(bundle, { path: documentPath, document_ref: documentPath, text });
      for (const [type, id] of [["JourneyStep", "J-003"], ["BlueprintStep", "BP-003"], ["ScenarioStep", "S-004"]]) {
        expect(suggestNodeId(snapshot, catalog.getNodeType(type)!)).toBe(id);
        expect(catalog.getNodeType(type)?.form.type_fields.map(p => p.property)).toEqual(expect.arrayContaining(["actor", "intent", "success_criteria", "opportunity_refs", "kind"]));
      }
      const anchorId = direction === "reverse" ? "BP-001" : "J-001";
      const targetId = direction === "reverse" ? "J-001" : "BP-001";
      const anchor = snapshot.nodes.find(node => node.node_id === anchorId)!;
      const runtime = createGuidedAdditionRuntimeV1(bundle);
      let result = runtime.begin(snapshot, { workflow_version: "1.0", anchor: { kind: "existing_node", handle: anchor.handle, node_id: anchor.node_id, node_type: anchor.node_type, name: anchor.name } });
      const select = (predicate: (action: GuidedAdditionActionV1) => boolean) => {
        if (result.kind !== "sdd-guided-addition-step" || !("choices" in result.page)) throw new Error("Expected a choice page");
        const choice = result.page.choices.find(candidate => predicate(candidate.action));
        expect(choice).toBeDefined();
        result = runtime.advance(snapshot, result.state, choice!.action);
      };
      select(action => action.kind === "choose_relationship_route" && action.direction === "outgoing" && action.selection_order === "relationship_first");
      select(action => action.kind === "choose_relationship_combination" && action.triple.relationship_type === "MAPS_TO");
      select(action => action.kind === "choose_existing_endpoint" && action.node.node_id === targetId);
      if (result.kind === "sdd-guided-addition-step") select(action => action.kind === "set_relationship_detail_disclosure" && !action.disclose);
      expect(result.kind).toBe("sdd-guided-addition-complete");
      if (result.kind !== "sdd-guided-addition-complete") return;
      const dry = await applyAdditionProposalV1(workspace, bundle, { proposal: result.proposal, mode: "dry_run", validate_profile: "strict" });
      expect(dry.status).toBe("applied");
      expect(dry.warning_review).toBeUndefined();
      expect(dry.diagnostics).toEqual([]);
      expect(await readFile(path.join(root, documentPath), "utf8")).toBe(text);
      const committed = await applyAdditionProposalV1(workspace, bundle, { proposal: result.proposal, mode: "commit", validate_profile: "strict" });
      expect(committed.status).toBe("applied");
      const inspected = await inspectDocument(workspace, bundle, documentPath);
      expect(inspected.resource.diagnostics).toEqual([]);
      expect((await validateDocument(workspace, bundle, { path: documentPath, profile_id: "strict" })).diagnostics).toEqual([]);
      const after = compileSource({ path: documentPath, text: await readFile(path.join(root, documentPath), "utf8") }, bundle).graph!;
      expect(after.edges.filter(edge => edge.type === "MAPS_TO")).toHaveLength(4);
      for (const view of ["journey_map", "service_blueprint", "scenario_flow"]) {
        const projected = await projectDocument(workspace, bundle, { path: documentPath, view_id: view });
        expect(projected.diagnostics).toEqual([]);
        const preview = await renderPreview(workspace, bundle, { path: documentPath, view_id: view, format: "svg", profile_id: "strict", detail_id: "detailed" });
        expect(preview.diagnostics.filter(d => d.severity === "error")).toEqual([]);
        expect(preview.mime_type).toBe("image/svg+xml");
      }
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("renders the canonical proof identically for forward, reverse and reciprocal declarations in SVG and PNG", async () => {
    const bundle = await loadBundle("bundle/v0.2/manifest.yaml");
    const text = await readFile(sourcePath, "utf8");
    const variants = [text.replace(/^\s+MAPS_TO J-001\n/m, ""), text.replace(/^\s+MAPS_TO BP-001\n/m, ""), text];
    for (const viewId of ["journey_map", "service_blueprint", "scenario_flow"]) for (const detailId of ["compact", "detailed"]) for (const format of ["svg", "png"] as const) {
      const outputs = [];
      for (const variant of variants) {
        const result = await renderSourcePreview({ path: sourcePath, text: variant }, bundle, { viewId, detailId, format, profileId: "strict" });
        expect(result.diagnostics.filter(d => d.severity === "error")).toEqual([]);
        expect(result.artifact?.format).toBe(format);
        outputs.push(result.artifact?.format === "svg" ? result.artifact.text : result.artifact?.format === "png" ? result.artifact.bytes : undefined);
      }
      expect(outputs[0]).toEqual(outputs[1]);
      expect(outputs[0]).toEqual(outputs[2]);
    }
  });
});
