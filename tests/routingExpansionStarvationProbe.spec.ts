// TEMPORARY PROBE — Item 3 "expansion starvation" verification.
//
// Purpose: determine WHY every observed `scenario_flow` failure on the frozen
// production fixture carries `expansionPasses: 0`. This is a measurement probe,
// NOT a conformance gate: it asserts only that the lifecycle ran, so it cannot
// go red on the known geometry defect it is investigating.
//
// It requires ZERO production changes. `preparationExpansionPasses` is not
// exported, but it is exactly recoverable from the context the adapter hands to
// the shared lifecycle:
//
//     preparationExpansionPasses = MAX_FINAL_ROUTING_ATTEMPTS - policy.maxExpansionPasses
//
// because scenarioFlowRouting.ts builds that policy as
// `maxExpansionPasses: MAX_FINAL_ROUTING_ATTEMPTS - preparationExpansionPasses`.
//
// `expansionPasses: 0` has four candidate causes, which this probe separates:
//   (a) budget starvation   — preparation consumed the whole shared ceiling
//   (b) deficit-model gap   — budget available, but the adapter's expand callback
//                             found no measured deficit and returned undefined
//   (c) repair exhausted    — candidate/revision budgets hit before the expansion gate
//   (d) no-op expansion     — callback returned a context that did not grow bounds
//
// RESULT (2026-09-18): (a) CONFIRMED. Measured on the frozen fixture:
//   preparationPasses 8, finalBudget 0, expandInvocations 0,
//   reason expansion_exhausted, repairRevisions 1/128, candidates 2306/4096.
// (b) and (d) are excluded because the callback was never invoked; (c) is excluded
// because neither the repair nor the candidate budget was near its cap.
// Full record: docs/routing_hardening/routing_triage_2026-09-18.md,
// "Item 3 verification record".
//
// Delete or convert this file once the Item 3 fix lands.
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compileSource, loadBundle, validateGraph } from "../src/index.js";
import { projectView } from "../src/projector/projectView.js";
import { renderScenarioFlowStagedSvg } from "../src/renderer/staged/scenarioFlow.js";
import * as core from "../src/renderer/staged/routingCore/index.js";

// Frozen copy of the production SDD-app document. Tests must not read the live
// `docs/sdd_app_planning/sdd_for_sdd.sdd`: it is work-in-progress, so coupling to
// it makes results change whenever the document is edited, independent of code.
const exact = "tests/fixtures/render/sdd_for_sdd_frozen.sdd";

// scenarioFlowRouting.ts `MAX_FINAL_ROUTING_ATTEMPTS`. Not yet exported; the
// agreed follow-up (Decision 1) exports it and repoints this literal.
const MAX_FINAL_ROUTING_ATTEMPTS = 8;

// One combination only — the failing cell. A single scenario_flow render of this
// fixture costs ~33s, and the full 8-way matrix adds no discriminating
// information for the starvation question.
const detailId = "detailed";
const decoratorId = "type,id";

interface ExpandInvocation {
  pass: number;
  violationCount: number;
  returnedContext: boolean;
}

type Verdict =
  | "(a) budget starvation CONFIRMED"
  | "(b) deficit-model gap"
  | "(c) repair/candidate budget exhausted first"
  | "(d) no-op expansion"
  | "not starved — expansion ran"
  | "inconclusive";

function classify(
  preparationPasses: number,
  result: core.FinalRoutingResult,
  expandInvocations: readonly ExpandInvocation[]
): Verdict {
  if (result.status === "resolved" || result.trace.expansionPasses > 0) {
    return "not starved — expansion ran";
  }
  const invoked = expandInvocations.length > 0;
  const anyReturnedContext = expandInvocations.some((call) => call.returnedContext);

  if (preparationPasses >= MAX_FINAL_ROUTING_ATTEMPTS) {
    // The lifecycle gate `expansionPasses >= maxExpansionPasses` (0 >= 0) breaks
    // BEFORE the callback is ever invoked, so the callback count must be zero.
    return invoked ? "inconclusive" : "(a) budget starvation CONFIRMED";
  }
  if (anyReturnedContext) {
    // Callback produced a context, yet no pass was credited: the lifecycle
    // rejected it as non-growing or canonical-identical.
    return "(d) no-op expansion";
  }
  if (invoked) {
    return "(b) deficit-model gap";
  }
  if (result.status === "failed" && (result.reason === "candidate_exhausted" || result.reason === "repair_exhausted")) {
    return "(c) repair/candidate budget exhausted first";
  }
  return "inconclusive";
}

afterEach(() => vi.restoreAllMocks());

describe("Item 3 probe: scenario_flow expansion starvation", () => {
  it(`measures preparation vs final expansion budget on ${exact} / ${detailId} / ${decoratorId}`, async () => {
    const bundle = await loadBundle("bundle/v0.1/manifest.yaml");
    const input = { path: exact, text: await readFile(exact, "utf8") };
    const compiled = compileSource(input, bundle);
    const graph = compiled.graph!;
    expect(validateGraph(graph, bundle, "simple").diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const projection = projectView(graph, bundle, "scenario_flow").projection!;
    const view = bundle.views.views.find((v) => v.id === "scenario_flow")!;

    // Wrap the adapter's expand callback so invocation count and undefined
    // returns are observable. This is what separates causes (a)/(c) — callback
    // never reached — from (b)/(d) — callback reached.
    const actual = core.runRoutingLifecycle;
    const expandInvocations: ExpandInvocation[] = [];
    const observedPolicies: (number | undefined)[] = [];
    const spy = vi.spyOn(core, "runRoutingLifecycle").mockImplementation((context, options) => {
      observedPolicies.push(context.policy?.maxExpansionPasses);
      const inner = options?.expand;
      return actual(context, {
        ...options,
        expand: inner
          ? (expandedContext, violations, pass) => {
              const returned = inner(expandedContext, violations, pass);
              expandInvocations.push({ pass, violationCount: violations.length, returnedContext: returned !== undefined });
              return returned;
            }
          : undefined
      });
    });

    const rendered = await renderScenarioFlowStagedSvg(projection, graph, view, {
      detailId,
      nodeDecoratorMode: { id: decoratorId, showNodeType: true, showNodeId: true }
    });

    // The only assertion: the lifecycle ran, so the measurement is real. This
    // probe deliberately does NOT assert routing success — the geometry defect
    // it investigates is expected to be present.
    expect(spy).toHaveBeenCalled();

    const initial = spy.mock.calls[0]![0];
    const result = spy.mock.results.at(-1)!.value as core.FinalRoutingResult;
    const maxExpansionPasses = initial.policy?.maxExpansionPasses;
    const preparationPasses = maxExpansionPasses === undefined ? Number.NaN : MAX_FINAL_ROUTING_ATTEMPTS - maxExpansionPasses;
    const verdict = classify(preparationPasses, result, expandInvocations);

    const violationKinds = result.status === "failed"
      ? [...new Set(result.violations.map((violation) => violation.kind))].sort()
      : [];
    const emittedRoutingErrors = rendered.diagnostics
      .filter((diagnostic) => diagnostic.severity === "error" && diagnostic.code.includes("routing"))
      .map((diagnostic) => diagnostic.code);

    const row = {
      lifecycleCalls: spy.mock.calls.length,
      preparationPasses,
      finalBudget: maxExpansionPasses,
      status: result.status,
      reason: result.status === "failed" ? result.reason : "-",
      expansionPasses: result.trace.expansionPasses,
      expandInvocations: expandInvocations.length,
      expandReturnedCtx: expandInvocations.filter((call) => call.returnedContext).length,
      validations: result.trace.validations,
      candidates: result.trace.candidates,
      repairRevisions: result.trace.repairRevisions,
      repeatedStates: result.trace.repeatedStates,
      verdict
    };

    // eslint-disable-next-line no-console
    console.log("\n=== Item 3 expansion-starvation probe ===");
    // eslint-disable-next-line no-console
    console.table([row]);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      verdict,
      decisionTableRow: row,
      violationKinds,
      emittedRoutingErrors: [...new Set(emittedRoutingErrors)].sort(),
      expandInvocations,
      observedPolicies,
      interpretation: {
        "(a)": "preparation consumed the whole shared ceiling; lifecycle.ts gate `expansionPasses >= maxExpansionPasses` (0 >= 0) breaks before the callback is invoked",
        "(b)": "budget was available but the adapter's expand callback found no measured deficit (scenarioFlowRouting.ts `hasNonZeroExpansion` guard) and returned undefined",
        "(c)": "candidate/repair budgets were exhausted before the expansion gate was reached",
        "(d)": "callback returned a context the lifecycle rejected as non-growing or canonical-identical"
      }
    }, null, 2));

    expect(Number.isFinite(preparationPasses)).toBe(true);
  });
});
