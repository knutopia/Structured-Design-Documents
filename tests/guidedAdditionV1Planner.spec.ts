import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBundle } from "../src/bundle/loadBundle.js";
import type { Bundle } from "../src/bundle/types.js";
import { createGuidanceCatalog } from "../src/authoring/guidedAddition/catalog.js";
import {
  createGuidedDocumentSnapshot,
  createNewGuidedDocumentSnapshot
} from "../src/authoring/guidedAddition/snapshot.js";
import { createGuidedAdditionRuntimeV1 } from "../src/authoring/guidedAddition/v1/planner.js";
import type {
  ExistingNodeRefV1,
  GuidedAdditionActionV1,
  GuidedAdditionResultV1,
  GuidedChoicePageKindV1,
  GuidedChoicePageV1,
  GuidedFormPageV1,
  GuidedFieldValueV1
} from "../src/authoring/guidedAddition/v1/contracts.js";
import type { GuidedDocumentSnapshot } from "../src/authoring/guidedAddition/sharedContracts.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "bundle/v0.1/manifest.yaml");
const fixturePath = path.join(repoRoot, "tests/fixtures/guided_addition_acceptance.sdd");

let bundle: Bundle;
let snapshot: GuidedDocumentSnapshot;

beforeAll(async () => {
  bundle = await loadBundle(manifestPath);
  snapshot = createGuidedDocumentSnapshot(bundle, {
    document_ref: "tests/fixtures/guided_addition_acceptance.sdd",
    path: "tests/fixtures/guided_addition_acceptance.sdd",
    text: fs.readFileSync(fixturePath, "utf8")
  });
});

function ref(id: string): ExistingNodeRefV1 {
  const node = snapshot.nodes.find((candidate) => candidate.node_id === id)!;
  return { kind: "existing_node", handle: node.handle, node_id: node.node_id, node_type: node.node_type, name: node.name };
}

function choicePage(result: GuidedAdditionResultV1, kind?: GuidedChoicePageKindV1): GuidedChoicePageV1 {
  expect(result.kind).toBe("sdd-guided-addition-step");
  const page = (result as Extract<GuidedAdditionResultV1, { kind: "sdd-guided-addition-step" }>).page;
  expect("choices" in page).toBe(true);
  if (kind) expect(page.page_kind).toBe(kind);
  return page as GuidedChoicePageV1;
}

function formPage(result: GuidedAdditionResultV1, kind?: GuidedFormPageV1["page_kind"]): GuidedFormPageV1 {
  expect(result.kind).toBe("sdd-guided-addition-step");
  const page = (result as Extract<GuidedAdditionResultV1, { kind: "sdd-guided-addition-step" }>).page;
  expect("fields" in page).toBe(true);
  if (kind) expect(page.page_kind).toBe(kind);
  return page as GuidedFormPageV1;
}

function choose(
  result: GuidedAdditionResultV1,
  predicate: (action: GuidedAdditionActionV1) => boolean
): GuidedAdditionResultV1 {
  const selected = choicePage(result).choices.find((candidate) => predicate(candidate.action));
  expect(selected, "expected offered v1 action").toBeDefined();
  return createGuidedAdditionRuntimeV1(bundle).advance(snapshot, result.state, selected!.action);
}

function route(direction: "outgoing" | "incoming", selection_order: "relationship_first" | "existing_node_first") {
  return (action: GuidedAdditionActionV1) => action.kind === "choose_relationship_route" &&
    action.direction === direction && action.selection_order === selection_order;
}

function begin(anchor = "P-100"): GuidedAdditionResultV1 {
  return createGuidedAdditionRuntimeV1(bundle).begin(snapshot, { workflow_version: "1.0", anchor: ref(anchor) });
}

function chooseTriple(result: GuidedAdditionResultV1, from: string, relationship: string, to: string) {
  return choose(result, (action) => action.kind === "choose_relationship_combination" &&
    action.triple.from_type === from && action.triple.relationship_type === relationship && action.triple.to_type === to);
}

function primaryValues(id: string, name: string, description: string): GuidedFieldValueV1[] {
  return [
    { field_id: "node_id", value_kind: "bare_value", raw_value: id },
    { field_id: "name", value_kind: "quoted_string", raw_value: name },
    { field_id: "node_property:description", value_kind: "quoted_string", raw_value: description }
  ];
}

function submitNewNode(result: GuidedAdditionResultV1, values: GuidedFieldValueV1[]): GuidedAdditionResultV1 {
  expect(result.kind).toBe("sdd-guided-addition-step");
  return createGuidedAdditionRuntimeV1(bundle).advance(snapshot, result.state, {
    kind: "submit_new_node_fields", local_node_id: "node_1", field_group: "primary", values
  });
}

function declineRelationshipDetails(result: GuidedAdditionResultV1): GuidedAdditionResultV1 {
  return choose(result, (action) => action.kind === "set_relationship_detail_disclosure" && !action.disclose);
}

describe("Guided Addition v1 new-document flow", () => {
  it("starts at node types, skips placement, and completes the only top-level node", () => {
    const newSnapshot = createNewGuidedDocumentSnapshot(bundle, {
      document_ref: "docs/new.sdd",
      path: "docs/new.sdd"
    });
    const runtime = createGuidedAdditionRuntimeV1(bundle);
    const advanceChoice = (
      result: GuidedAdditionResultV1,
      predicate: (action: GuidedAdditionActionV1) => boolean
    ): GuidedAdditionResultV1 => {
      const selected = choicePage(result).choices.find((candidate) => predicate(candidate.action));
      expect(selected).toBeDefined();
      return runtime.advance(newSnapshot, result.state, selected!.action);
    };

    let result = runtime.begin(newSnapshot, { workflow_version: "1.0" });
    expect(choicePage(result).page_kind).toBe("browse_standalone_node_type");
    expect(result.state.document_context.document_precondition).toBe("must_not_exist");
    expect(() => runtime.advance(newSnapshot, result.state, {
      kind: "choose_addition_kind",
      addition_kind: "relationship"
    })).toThrowError(expect.objectContaining({ code: "guided_addition.choice_unavailable" }));
    expect(() => runtime.advance(newSnapshot, result.state, {
      kind: "choose_same_level_order",
      order: { kind: "top_level_first" }
    })).toThrowError(expect.objectContaining({ code: "guided_addition.choice_unavailable" }));

    result = advanceChoice(result, (action) => action.kind === "choose_standalone_node_type" && action.node_type === "Place");
    expect(formPage(result).page_kind).toBe("edit_new_node");
    result = runtime.advance(newSnapshot, result.state, {
      kind: "submit_new_node_fields",
      local_node_id: "node_1",
      field_group: "primary",
      values: primaryValues("P-001", "Home", "Starting place")
    });
    result = advanceChoice(result, (action) => action.kind === "set_node_detail_disclosure" && !action.disclose);
    expect(result.kind).toBe("sdd-guided-addition-complete");
    if (result.kind === "sdd-guided-addition-complete") {
      expect(result.proposal.document_context.document_precondition).toBe("must_not_exist");
      expect(result.proposal.node_organization).toEqual([{
        kind: "add_new_node_top_level",
        node: { kind: "new_node", local_node_id: "node_1" },
        order: { kind: "top_level_last" }
      }]);
      expect(result.review.lines.at(-1)).toBe("Place P-001 as the only top-level node");
    }
  });

  it("also skips placement after submitting optional details", () => {
    const newSnapshot = createNewGuidedDocumentSnapshot(bundle, { document_ref: "docs/detailed.sdd" });
    const runtime = createGuidedAdditionRuntimeV1(bundle);
    let result = runtime.begin(newSnapshot, { workflow_version: "1.0" });
    const select = (predicate: (action: GuidedAdditionActionV1) => boolean): void => {
      const action = choicePage(result).choices.find((candidate) => predicate(candidate.action))!.action;
      result = runtime.advance(newSnapshot, result.state, action);
    };
    select((action) => action.kind === "choose_standalone_node_type" && action.node_type === "Place");
    result = runtime.advance(newSnapshot, result.state, {
      kind: "submit_new_node_fields",
      local_node_id: "node_1",
      field_group: "primary",
      values: primaryValues("P-001", "Home", "Starting place")
    });
    select((action) => action.kind === "set_node_detail_disclosure" && action.disclose);
    result = runtime.advance(newSnapshot, result.state, {
      kind: "submit_new_node_fields",
      local_node_id: "node_1",
      field_group: "additional",
      values: []
    });
    expect(result.kind).toBe("sdd-guided-addition-complete");
  });
});

describe("Guided Addition v1 route identity and constraint propagation", () => {
  it("reserves page prompts for semantic questions", () => {
    expect(choicePage(begin(), "choose_relationship_route").content.prompt).toBeUndefined();
  });

  it("preserves four distinct route-first pages", () => {
    const expected = [
      ["outgoing", "relationship_first", "browse_relationship_combination"],
      ["outgoing", "existing_node_first", "browse_existing_endpoint"],
      ["incoming", "relationship_first", "browse_relationship_combination"],
      ["incoming", "existing_node_first", "browse_existing_endpoint"]
    ] as const;
    for (const [direction, order, pageKind] of expected) {
      const result = choose(begin(), route(direction, order));
      expect(choicePage(result).page_kind).toBe(pageKind);
      expect(result.state.progress).toMatchObject({ route: { direction, selection_order: order } });
    }
  });

  it("runs relationship-first to an exactly constrained existing endpoint", () => {
    let result = choose(begin(), route("outgoing", "relationship_first"));
    result = chooseTriple(result, "Place", "NAVIGATES_TO", "Place");
    const endpoints = choicePage(result, "browse_relationship_endpoint");
    expect(endpoints.choices.map((item) => item.display)).toEqual([
      "P-210: Projects Overview (Place)",
      "P-300: Reports (Place)",
      "Create a new Place"
    ]);
    result = choose(result, (action) => action.kind === "choose_existing_endpoint" && action.node.node_id === "P-300");
    result = declineRelationshipDetails(result);
    expect(result.kind).toBe("sdd-guided-addition-complete");
    if (result.kind === "sdd-guided-addition-complete") {
      expect(result.proposal.intent).toEqual({
        addition_kind: "relationship", direction: "outgoing", selection_order: "relationship_first"
      });
      expect(result.proposal.node_organization).toEqual([{ kind: "keep_existing_node", node: ref("P-300") }]);
    }
  });

  it("shows a named node before exact relationship disambiguation", () => {
    let result = choose(begin(), route("outgoing", "existing_node_first"));
    const browse = choicePage(result, "browse_existing_endpoint");
    expect(browse.choices.map((item) => item.display)).toContain(
      "P-100 CONTAINS / NAVIGATES_TO P-210: Projects Overview (Place)"
    );
    result = choose(result, (action) => action.kind === "choose_existing_endpoint" &&
      action.node.node_id === "P-210" && action.triple === undefined);
    const relationships = choicePage(result, "choose_relationship_for_endpoint");
    expect(relationships.choices.map((item) => item.display)).toEqual([
      "P-100 CONTAINS P-210 — Put Projects Overview inside Dashboard.",
      "P-100 NAVIGATES_TO P-210 — Navigate from Dashboard to Projects Overview."
    ]);
    result = choose(result, (action) => action.kind === "choose_relationship_for_endpoint" &&
      action.triple.relationship_type === "NAVIGATES_TO");
    result = declineRelationshipDetails(result);
    expect(result.kind).toBe("sdd-guided-addition-complete");
    expect(result.state.progress).toMatchObject({ draft: { route: { selection_order: "existing_node_first" } } });
  });

  it("auto-progresses a single exact node-first relationship", () => {
    let result = choose(begin(), route("outgoing", "existing_node_first"));
    result = choose(result, (action) => action.kind === "choose_existing_endpoint" && action.node.node_id === "VS-100");
    expect(choicePage(result).page_kind).toBe("choose_existing_target_organization");
    result = choose(result, (action) => action.kind === "choose_existing_target_organization" &&
      action.organization === "leave_current");
    expect(result.kind).toBe("sdd-guided-addition-complete");
  });
});

describe("Guided Addition v1 scoped filtering", () => {
  it("selects, changes, and clears the relationship-first filter without changing route", () => {
    let result = choose(begin(), route("outgoing", "relationship_first"));
    result = choose(result, (action) => action.kind === "open_diagram_filter");
    result = choose(result, (action) => action.kind === "set_diagram_filter" && action.diagram_id === "ia_place_map");
    let page = choicePage(result, "browse_relationship_combination");
    expect(page.choices[0].display).toBe("[Filter relationships by diagram type: IA Place Map]");
    expect(page.choices.slice(1, 3).map((item) => item.display)).toEqual([
      "P-100 CONTAINS Place — Put a Place inside Dashboard.",
      "P-100 NAVIGATES_TO Place — Navigate from Dashboard to a Place."
    ]);
    expect(page.choices.slice(3).every((item) => item.display.endsWith("Cross-diagram connection"))).toBe(true);
    result = choose(result, (action) => action.kind === "open_diagram_filter");
    expect(choicePage(result).choices.find((item) => item.action.kind === "set_diagram_filter" &&
      item.action.diagram_id === "ia_place_map")?.description).toBe("Includes Area and Place nodes.");
    result = choose(result, (action) => action.kind === "set_diagram_filter" && action.diagram_id === "ui_contracts");
    expect(choicePage(result).choices.map((item) => item.display)).toEqual([
      "[Filter relationships by diagram type: UI Contracts]",
      "P-100 CONTAINS ViewState — Put a ViewState inside Dashboard.",
      "P-100 COMPOSED_OF Component — Make a Component part of Dashboard.",
      "P-100 CONTAINS Place — Put a Place inside Dashboard.",
      "P-100 NAVIGATES_TO Place — Cross-diagram connection",
      "P-100 CONSTRAINED_BY Policy — Cross-diagram connection"
    ]);
    result = choose(result, (action) => action.kind === "open_diagram_filter");
    result = choose(result, (action) => action.kind === "clear_diagram_filter");
    expect(choicePage(result).choices[0].display).toBe("[Filter relationships by diagram type: All diagram types]");
    expect(result.state.progress).toMatchObject({ route: { direction: "outgoing", selection_order: "relationship_first" } });
  });

  it("splits bridge relationships into annotated node-first options", () => {
    let result = choose(begin(), route("outgoing", "existing_node_first"));
    result = choose(result, (action) => action.kind === "open_diagram_filter");
    result = choose(result, (action) => action.kind === "set_diagram_filter" && action.diagram_id === "ui_contracts");
    const displays = choicePage(result).choices.map((item) => item.display);
    expect(displays).toEqual([
      "[Filter nodes by diagram type: UI Contracts]",
      "P-100 CONTAINS P-210: Projects Overview (Place)",
      "P-100 NAVIGATES_TO P-210: Projects Overview (Place) — Cross-diagram connection",
      "P-100 CONTAINS P-300: Reports (Place)",
      "P-100 NAVIGATES_TO P-300: Reports (Place) — Cross-diagram connection",
      "P-100 CONTAINS VS-100: Summary (ViewState)",
      "P-100 COMPOSED_OF C-100: Status Card (Component)",
      "P-100 COMPOSED_OF C-200: Global Navigation (Component)"
    ]);
  });

  it("filters standalone node types and starting nodes by bundle diagram scope", () => {
    let result = createGuidedAdditionRuntimeV1(bundle).begin(snapshot, { workflow_version: "1.0" });
    result = choose(result, (action) => action.kind === "choose_addition_kind" && action.addition_kind === "standalone_node");
    result = choose(result, (action) => action.kind === "open_diagram_filter");
    result = choose(result, (action) => action.kind === "set_diagram_filter" && action.diagram_id === "ia_place_map");
    expect(choicePage(result).choices.slice(1).map((item) => item.display.split(" — ")[0])).toEqual(["Area", "Place"]);
    result = choose(result, (action) => action.kind === "open_diagram_filter");
    result = choose(result, (action) => action.kind === "set_diagram_filter" && action.diagram_id === "ui_contracts");
    expect(choicePage(result).choices.slice(1).map((item) => item.display.split(" — ")[0])).toEqual([
      "Place", "ViewState", "Component", "State", "Event", "DataEntity", "SystemAction"
    ]);
    result = choose(result, (action) => action.kind === "open_diagram_filter");
    result = choose(result, (action) => action.kind === "clear_diagram_filter");
    expect(choicePage(result).choices).toHaveLength(17);

    result = createGuidedAdditionRuntimeV1(bundle).begin(snapshot, { workflow_version: "1.0" });
    result = choose(result, (action) => action.kind === "choose_addition_kind" && action.addition_kind === "relationship");
    expect(choicePage(result).choices.map((choice) => choice.display)).toEqual([
      "[Filter nodes by diagram type: All diagram types]",
      "P-100: Dashboard (Place)",
      "C-100: Status Card (Component)",
      "A-200: Projects (Area)",
      "P-210: Projects Overview (Place)",
      "P-300: Reports (Place)",
      "VS-100: Summary (ViewState)",
      "C-200: Global Navigation (Component)",
      "O-100: Improve project visibility (Outcome)"
    ]);
    result = choose(result, (action) => action.kind === "open_diagram_filter");
    result = choose(result, (action) => action.kind === "set_diagram_filter" && action.diagram_id === "ia_place_map");
    expect(choicePage(result).choices.slice(1).map((item) => item.action).every((action) =>
      action.kind === "choose_starting_node" && ["Area", "Place"].includes(action.node.node_type))).toBe(true);
    result = choose(result, (action) => action.kind === "open_diagram_filter");
    result = choose(result, (action) => action.kind === "set_diagram_filter" && action.diagram_id === "ui_contracts");
    expect(choicePage(result).choices.slice(1).every((item) => item.action.kind === "choose_starting_node" &&
      ["Place", "ViewState", "Component", "State", "Event", "DataEntity", "SystemAction"].includes(item.action.node.node_type))).toBe(true);
    result = choose(result, (action) => action.kind === "open_diagram_filter");
    result = choose(result, (action) => action.kind === "clear_diagram_filter");
    expect(choicePage(result).choices).toHaveLength(snapshot.nodes.length + 1);
  });

  it("preserves both incoming browse identities while selecting, changing, and clearing filters", () => {
    for (const selectionOrder of ["relationship_first", "existing_node_first"] as const) {
      let result = choose(begin(), route("incoming", selectionOrder));
      const browseKind = selectionOrder === "relationship_first"
        ? "browse_relationship_combination"
        : "browse_existing_endpoint";
      expect(choicePage(result).page_kind).toBe(browseKind);
      result = choose(result, (action) => action.kind === "open_diagram_filter");
      result = choose(result, (action) => action.kind === "set_diagram_filter" && action.diagram_id === "ia_place_map");
      expect(result.state.progress).toMatchObject({ route: { direction: "incoming", selection_order: selectionOrder } });
      result = choose(result, (action) => action.kind === "open_diagram_filter");
      result = choose(result, (action) => action.kind === "set_diagram_filter" && action.diagram_id === "ui_contracts");
      expect(choicePage(result).page_kind).toBe(browseKind);
      result = choose(result, (action) => action.kind === "open_diagram_filter");
      result = choose(result, (action) => action.kind === "clear_diagram_filter");
      expect(choicePage(result).choices[0].display).toContain("All diagram types");
    }
  });
});

describe("Guided Addition v1 forms and semantic organization", () => {
  function reachNewStructural(anchor: string, direction: "outgoing" | "incoming", from: string, to: string) {
    let result = choose(begin(anchor), route(direction, "relationship_first"));
    result = chooseTriple(result, from, "CONTAINS", to);
    result = choose(result, (action) => action.kind === "create_new_endpoint");
    return result;
  }

  it("nests a new structural target and asks order only when siblings exist", () => {
    let result = reachNewStructural("P-100", "outgoing", "Place", "Place");
    result = submitNewNode(result, primaryValues("P-301", "Settings", "Configuration and preferences"));
    result = choose(result, (action) => action.kind === "set_node_detail_disclosure" && !action.disclose);
    expect(choicePage(result).page_kind).toBe("choose_new_target_organization");
    result = choose(result, (action) => action.kind === "choose_new_target_organization" && action.organization === "nested");
    expect(choicePage(result).page_kind).toBe("choose_sibling_order");
    result = choose(result, (action) => action.kind === "choose_sibling_order" && action.order === "last");
    expect(result.kind).toBe("sdd-guided-addition-complete");
    if (result.kind === "sdd-guided-addition-complete") {
      expect(result.proposal.node_organization).toMatchObject([{ kind: "add_new_node_nested", order: "last" }]);
      expect(JSON.stringify(result.proposal)).not.toMatch(/stream|edge_placement|reason_code/);
    }
  });

  it("auto-records only-child order for an empty structural parent", () => {
    let result = reachNewStructural("P-300", "outgoing", "Place", "Place");
    result = submitNewNode(result, primaryValues("P-301", "Settings", "Configuration and preferences"));
    result = choose(result, (action) => action.kind === "set_node_detail_disclosure" && !action.disclose);
    result = choose(result, (action) => action.kind === "choose_new_target_organization" && action.organization === "nested");
    expect(result.kind).toBe("sdd-guided-addition-complete");
    if (result.kind === "sdd-guided-addition-complete") {
      expect(result.proposal.node_organization).toMatchObject([{ kind: "add_new_node_nested", order: "only" }]);
    }
  });

  it("wraps an existing target in a new incoming structural source only after exact confirmation", () => {
    let result = reachNewStructural("P-100", "incoming", "Area", "Place");
    result = submitNewNode(result, primaryValues("A-201", "Dashboard Workspace", "Area containing the dashboard"));
    result = choose(result, (action) => action.kind === "set_node_detail_disclosure" && !action.disclose);
    result = choose(result, (action) => action.kind === "choose_new_source_organization" && action.organization === "wrap_target");
    const confirmation = choicePage(result, "confirm_material_effect");
    expect(confirmation.content.prompt).toBe("Move this node?");
    expect(confirmation.content.lines).toEqual([
      "From top level",
      "To within A-201: Dashboard Workspace, as its only child",
      "A-201: Dashboard Workspace will take P-100's current top-level position.",
      "Existing relationships and nested content remain unchanged."
    ]);
    result = choose(result, (action) => action.kind === "confirm_material_effect");
    expect(result.kind).toBe("sdd-guided-addition-complete");
    if (result.kind === "sdd-guided-addition-complete") {
      expect(result.proposal.node_organization.map((item) => item.kind)).toEqual([
        "place_new_source_at_target_position", "move_existing_node"
      ]);
      expect(result.proposal.accepted_material_effects).toHaveLength(1);
    }
  });

  it("leaves an existing target and offers graph-consistent new-source order", () => {
    let result = reachNewStructural("P-100", "incoming", "Area", "Place");
    result = submitNewNode(result, primaryValues("A-201", "Dashboard Workspace", "Area containing the dashboard"));
    result = choose(result, (action) => action.kind === "set_node_detail_disclosure" && !action.disclose);
    result = choose(result, (action) => action.kind === "choose_new_source_organization" && action.organization === "leave_target_current");
    const order = choicePage(result, "choose_same_level_order");
    expect(order.choices[0].action).toMatchObject({
      kind: "choose_same_level_order", order: { kind: "before_existing", node: ref("P-100") }
    });
    result = createGuidedAdditionRuntimeV1(bundle).advance(snapshot, result.state, order.choices[0].action);
    expect(result.kind).toBe("sdd-guided-addition-complete");
  });

  it("moves an existing structural target only after order and exact confirmation", () => {
    let result = choose(begin(), route("outgoing", "relationship_first"));
    result = chooseTriple(result, "Place", "CONTAINS", "Place");
    result = choose(result, (action) => action.kind === "choose_existing_endpoint" && action.node.node_id === "P-210");
    result = choose(result, (action) => action.kind === "choose_existing_target_organization" &&
      action.organization === "move_under_source");
    expect(choicePage(result).page_kind).toBe("choose_sibling_order");
    result = choose(result, (action) => action.kind === "choose_sibling_order" && action.order === "last");
    expect(choicePage(result).content.lines).toEqual([
      "From within A-200: Projects",
      "To within P-100: Dashboard, after C-100: Status Card",
      "Existing relationships remain unchanged."
    ]);
    expect(result.state.accepted_material_effects).toEqual([]);
    result = choose(result, (action) => action.kind === "confirm_material_effect");
    expect(result.kind).toBe("sdd-guided-addition-complete");
    if (result.kind === "sdd-guided-addition-complete") {
      expect(result.proposal.accepted_material_effects).toEqual([
        expect.objectContaining({ node: ref("P-210"), from_parent: ref("A-200"), destination_parent: ref("P-100"), accepted: true })
      ]);
    }
  });

  it("completes a no-anchor standalone node without synthesizing relationship state", () => {
    let result = createGuidedAdditionRuntimeV1(bundle).begin(snapshot, { workflow_version: "1.0" });
    result = choose(result, (action) => action.kind === "choose_addition_kind" && action.addition_kind === "standalone_node");
    result = choose(result, (action) => action.kind === "choose_standalone_node_type" && action.node_type === "Place");
    result = submitNewNode(result, primaryValues("P-301", "Settings", "Configuration and preferences"));
    result = choose(result, (action) => action.kind === "set_node_detail_disclosure" && !action.disclose);
    result = choose(result, (action) => action.kind === "choose_same_level_order" && action.order.kind === "top_level_last");
    expect(result.kind).toBe("sdd-guided-addition-complete");
    if (result.kind === "sdd-guided-addition-complete") {
      expect(result.state.anchor).toBeUndefined();
      expect(result.state.progress.kind).toBe("standalone.ready");
      expect(result.proposal.intent).toEqual({ addition_kind: "standalone_node" });
      expect(Object.isFrozen(result)).toBe(true);
      expect(result.review.lines).toEqual([
        "Add Place P-301: Settings",
        "Description: Configuration and preferences",
        "Place P-301 at top level, last"
      ]);
    }
  });

  it("offers top-level organization for a new structural target and graph-consistent order for new behavioral nodes", () => {
    let structural = reachNewStructural("P-100", "outgoing", "Place", "Place");
    structural = submitNewNode(structural, primaryValues("P-301", "Settings", "Configuration and preferences"));
    structural = choose(structural, (action) => action.kind === "set_node_detail_disclosure" && !action.disclose);
    structural = choose(structural, (action) => action.kind === "choose_new_target_organization" && action.organization === "top_level");
    expect(choicePage(structural).choices[0].action).toMatchObject({
      kind: "choose_same_level_order", order: { kind: "after_existing", node: ref("P-100") }
    });
    structural = choose(structural, (action) => action.kind === "choose_same_level_order" && action.order.kind === "after_existing");
    expect(structural.kind).toBe("sdd-guided-addition-complete");

    let incoming = choose(begin(), route("incoming", "relationship_first"));
    incoming = chooseTriple(incoming, "Place", "NAVIGATES_TO", "Place");
    incoming = choose(incoming, (action) => action.kind === "create_new_endpoint");
    incoming = submitNewNode(incoming, primaryValues("P-301", "Settings", "Configuration and preferences"));
    incoming = choose(incoming, (action) => action.kind === "set_node_detail_disclosure" && !action.disclose);
    incoming = declineRelationshipDetails(incoming);
    expect(choicePage(incoming).choices[0].action).toMatchObject({
      kind: "choose_same_level_order", order: { kind: "before_existing", node: ref("P-100") }
    });
    incoming = choose(incoming, (action) => action.kind === "choose_same_level_order" && action.order.kind === "before_existing");
    expect(incoming.kind).toBe("sdd-guided-addition-complete");
  });

  it("leaves an existing structural target in place without order or confirmation", () => {
    let result = choose(begin(), route("outgoing", "relationship_first"));
    result = chooseTriple(result, "Place", "CONTAINS", "Place");
    result = choose(result, (action) => action.kind === "choose_existing_endpoint" && action.node.node_id === "P-210");
    result = choose(result, (action) => action.kind === "choose_existing_target_organization" && action.organization === "leave_current");
    expect(result.kind).toBe("sdd-guided-addition-complete");
    if (result.kind === "sdd-guided-addition-complete") {
      expect(result.proposal.node_organization).toEqual([{ kind: "keep_existing_node", node: ref("P-210") }]);
      expect(result.proposal.accepted_material_effects).toEqual([]);
    }
  });

  it("uses exact optional node and relationship forms and normalizes blank optional values away", () => {
    let result = choose(begin(), route("outgoing", "relationship_first"));
    result = chooseTriple(result, "Place", "NAVIGATES_TO", "Place");
    expect(choicePage(result).choices.at(-1)).toMatchObject({
      display: "Create a new Place",
      chosen: "Chosen: P-100 NAVIGATES_TO new Place"
    });
    result = choose(result, (action) => action.kind === "create_new_endpoint");
    expect(formPage(result).fields.map((field) => field.field_id)).toEqual([
      "node_id", "name", "node_property:description"
    ]);
    result = submitNewNode(result, primaryValues("P-301", "Settings", "Configuration and preferences"));
    result = choose(result, (action) => action.kind === "set_node_detail_disclosure" && action.disclose);
    const optionalNode = formPage(result);
    expect(optionalNode.fields.map((field) => field.field_id)).toEqual([
      "node_property:owner", "node_property:surface", "node_property:route_or_key",
      "node_property:access", "node_property:entry_points", "node_property:primary_nav"
    ]);
    result = createGuidedAdditionRuntimeV1(bundle).advance(snapshot, result.state, {
      kind: "submit_new_node_fields",
      local_node_id: "node_1",
      field_group: "additional",
      values: optionalNode.fields.map((field) => ({ field_id: field.field_id, value_kind: field.value_kind, raw_value: "" }))
    });
    result = choose(result, (action) => action.kind === "set_relationship_detail_disclosure" && action.disclose);
    expect(formPage(result, "edit_relationship_details").fields.map((field) => field.field_id)).toEqual([
      "edge_annotation:event", "edge_annotation:guard"
    ]);
    result = createGuidedAdditionRuntimeV1(bundle).advance(snapshot, result.state, {
      kind: "submit_relationship_fields",
      local_edge_id: "edge_1",
      field_group: "additional",
      values: [
        { field_id: "edge_annotation:event", value_kind: "quoted_string", raw_value: "Open settings" },
        { field_id: "edge_annotation:guard", value_kind: "quoted_string", raw_value: "" }
      ]
    });
    result = choose(result, (action) => action.kind === "choose_same_level_order" && action.order.kind === "after_existing");
    expect(result.kind).toBe("sdd-guided-addition-complete");
    if (result.kind === "sdd-guided-addition-complete" && result.proposal.addition.kind === "relationship") {
      expect(result.proposal.addition.new_node!.fields.map((field) => field.field_id)).toEqual([
        "node_id", "name", "node_property:description"
      ]);
      expect(result.proposal.addition.relationship.fields).toEqual([
        { field_id: "edge_annotation:event", value_kind: "quoted_string", raw_value: "Open settings" }
      ]);
    }
  });

  it("rejects form submissions whose identity or fields do not match the current page", () => {
    let result = choose(begin(), route("outgoing", "relationship_first"));
    result = chooseTriple(result, "Place", "NAVIGATES_TO", "Place");
    result = choose(result, (action) => action.kind === "create_new_endpoint");
    expect(() => createGuidedAdditionRuntimeV1(bundle).advance(snapshot, result.state, {
      kind: "submit_new_node_fields",
      local_node_id: "forged" as "node_1",
      field_group: "primary",
      values: primaryValues("P-301", "Settings", "Configuration and preferences")
    })).toThrowError(expect.objectContaining({ code: "guided_addition.choice_unavailable" }));
    expect(() => createGuidedAdditionRuntimeV1(bundle).advance(snapshot, result.state, {
      kind: "submit_new_node_fields",
      local_node_id: "node_1",
      field_group: "primary",
      values: [...primaryValues("P-301", "Settings", "Configuration and preferences"), {
        field_id: "node_property:owner", value_kind: "quoted_string", raw_value: "Someone"
      }]
    })).toThrowError(expect.objectContaining({ code: "guided_addition.choice_unavailable" }));
  });
});

describe("Guided Addition v1 route convergence", () => {
  it("uses exact zero, singular, and plural existing-relationship wording", () => {
    const original = fs.readFileSync(fixturePath, "utf8");
    const relationshipLine = '  NAVIGATES_TO P-100 "Dashboard"\n';
    const sources = [
      original.replace(relationshipLine, ""),
      original,
      original.replace(relationshipLine, relationshipLine.repeat(2))
    ];
    const expected = [
      "P-210: Projects Overview (Place)",
      "P-210: Projects Overview (Place) — 1 matching relationship already exists",
      "P-210: Projects Overview (Place) — 2 matching relationships already exist"
    ];
    sources.forEach((text, index) => {
      const localSnapshot = createGuidedDocumentSnapshot(bundle, {
        document_ref: `plurality-${index}.sdd`,
        path: `plurality-${index}.sdd`,
        text
      });
      const runtime = createGuidedAdditionRuntimeV1(bundle);
      const anchorNode = localSnapshot.nodes.find((node) => node.node_id === "P-100")!;
      let result = runtime.begin(localSnapshot, {
        workflow_version: "1.0",
        anchor: {
          kind: "existing_node",
          handle: anchorNode.handle,
          node_id: anchorNode.node_id,
          node_type: anchorNode.node_type,
          name: anchorNode.name
        }
      });
      const chooseLocal = (predicate: (action: GuidedAdditionActionV1) => boolean): void => {
        const selected = choicePage(result).choices.find((choice) => predicate(choice.action))!;
        result = runtime.advance(localSnapshot, result.state, selected.action);
      };
      chooseLocal((action) => action.kind === "choose_relationship_route" &&
        action.direction === "incoming" && action.selection_order === "relationship_first");
      chooseLocal((action) => action.kind === "choose_relationship_combination" &&
        action.triple.from_type === "Place" && action.triple.relationship_type === "NAVIGATES_TO" && action.triple.to_type === "Place");
      expect(choicePage(result).choices.find((choice) => choice.display.startsWith("P-210:"))?.display).toBe(expected[index]);
    });
  });

  function completeOutgoingNavigation(selectionOrder: "relationship_first" | "existing_node_first") {
    let result = choose(begin(), route("outgoing", selectionOrder));
    if (selectionOrder === "relationship_first") {
      result = chooseTriple(result, "Place", "NAVIGATES_TO", "Place");
      result = choose(result, (action) => action.kind === "choose_existing_endpoint" && action.node.node_id === "P-300");
    } else {
      result = choose(result, (action) => action.kind === "choose_existing_endpoint" &&
        action.node.node_id === "P-300" && action.triple === undefined);
      result = choose(result, (action) => action.kind === "choose_relationship_for_endpoint" &&
        action.triple.relationship_type === "NAVIGATES_TO");
    }
    result = declineRelationshipDetails(result);
    expect(result.kind).toBe("sdd-guided-addition-complete");
    return result as Extract<GuidedAdditionResultV1, { kind: "sdd-guided-addition-complete" }>;
  }

  it("returns equivalent semantic additions through distinct selection-order routes", () => {
    const relationshipFirst = completeOutgoingNavigation("relationship_first");
    const nodeFirst = completeOutgoingNavigation("existing_node_first");
    expect(relationshipFirst.proposal.addition).toEqual(nodeFirst.proposal.addition);
    expect(relationshipFirst.proposal.node_organization).toEqual(nodeFirst.proposal.node_organization);
    expect(relationshipFirst.proposal.intent.selection_order).toBe("relationship_first");
    expect(nodeFirst.proposal.intent.selection_order).toBe("existing_node_first");
    expect(relationshipFirst.proposal.proposal_id).not.toBe(nodeFirst.proposal.proposal_id);
  });

  it("converges incoming routes without inversion and returns the accepted existing-node review", () => {
    const complete = (selectionOrder: "relationship_first" | "existing_node_first") => {
      let result = choose(begin(), route("incoming", selectionOrder));
      if (selectionOrder === "relationship_first") {
        result = chooseTriple(result, "Place", "NAVIGATES_TO", "Place");
        expect(choicePage(result).choices[0].display).toBe(
          "P-210: Projects Overview (Place) — 1 matching relationship already exists"
        );
        result = choose(result, (action) => action.kind === "choose_existing_endpoint" && action.node.node_id === "P-210");
      } else {
        result = choose(result, (action) => action.kind === "choose_existing_endpoint" &&
          action.node.node_id === "P-210" && action.triple === undefined);
        result = choose(result, (action) => action.kind === "choose_relationship_for_endpoint" &&
          action.triple.relationship_type === "NAVIGATES_TO");
      }
      result = declineRelationshipDetails(result);
      expect(result.kind).toBe("sdd-guided-addition-complete");
      return result as Extract<GuidedAdditionResultV1, { kind: "sdd-guided-addition-complete" }>;
    };
    const relationshipFirst = complete("relationship_first");
    const nodeFirst = complete("existing_node_first");
    expect(relationshipFirst.proposal.addition).toEqual(nodeFirst.proposal.addition);
    expect(relationshipFirst.review.lines).toEqual([
      "Add relationship: P-210: Projects Overview NAVIGATES_TO P-100: Dashboard",
      "Leave both existing nodes where they are"
    ]);
  });
});

describe("Guided Addition v1 integrity and bundle authority", () => {
  it("rejects legacy versions, stale state, and forged actions", () => {
    const runtime = createGuidedAdditionRuntimeV1(bundle);
    expect(() => runtime.begin(snapshot, { workflow_version: "0.1" } as any)).toThrowError(
      expect.objectContaining({ code: "guided_addition.unsupported_version" })
    );
    const result = begin();
    expect(() => runtime.advance(snapshot, result.state, {
      kind: "choose_standalone_node_type", node_type: "Place"
    })).toThrowError(expect.objectContaining({ code: "guided_addition.choice_unavailable" }));
    expect(() => runtime.advance(snapshot, {
      ...result.state,
      document_context: { ...result.state.document_context, revision: "rev_stale" as any }
    }, choicePage(result).choices[0].action)).toThrowError(expect.objectContaining({ code: "guided_addition.state_stale" }));
  });

  it("takes its default display profile and diagram description inputs from bundle data", () => {
    const catalog = createGuidanceCatalog(bundle);
    expect(catalog.default_display_profile_id).toBe("simple");
    expect(catalog.getView("ia_place_map")!.scope_description).toBe("Includes Area and Place nodes.");
    expect(catalog.resolveDisplay(
      "service_blueprint",
      { from: "Step", type: "REALIZED_BY", to: "Process" },
      catalog.default_display_profile_id
    ).rule.label).toBe("hidden");

    const changed = structuredClone(bundle);
    changed.authoring!.guided_addition.default_display_profile_id = "strict";
    changed.views.views.find((view) => view.id === "ia_place_map")!.projection.include_node_types.push("Component");
    const changedCatalog = createGuidanceCatalog(changed);
    expect(changedCatalog.default_display_profile_id).toBe("strict");
    expect(changedCatalog.resolveDisplay(
      "service_blueprint",
      { from: "Step", type: "REALIZED_BY", to: "Process" },
      changedCatalog.default_display_profile_id
    ).rule.label).toBe("visible");
    expect(changedCatalog.getView("ia_place_map")!.scope_description).toBe("Includes Area, Place, and Component nodes.");
  });
});
