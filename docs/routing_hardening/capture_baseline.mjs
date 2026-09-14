/** Evidence capture, not acceptance: build dist first. Output stays outside tracked goldens. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { compileSource, loadBundle, validateGraph } from '../../dist/index.js';
import { projectView } from '../../dist/projector/projectView.js';
import { renderOutcomeOpportunityMapStagedSvg } from '../../dist/renderer/staged/outcomeOpportunityMap.js';
import { renderServiceBlueprintStagedSvg } from '../../dist/renderer/staged/serviceBlueprint.js';
import { renderScenarioFlowStagedSvg } from '../../dist/renderer/staged/scenarioFlow.js';
import { renderPositionedSceneToPng } from '../../dist/renderer/staged/svgBackend.js';
import { validatePositionedSceneRouting } from '../../dist/renderer/staged/routingCore/sceneValidation.js';

const root = process.cwd();
const output = process.argv[2] ?? '/tmp/sdd-routing-hardening/baseline';
await mkdir(output, { recursive: true });
const bundle = await loadBundle(path.join(root, 'bundle/v0.1/manifest.yaml'));
const renderers = { outcome_opportunity_map: renderOutcomeOpportunityMapStagedSvg, service_blueprint: renderServiceBlueprintStagedSvg, scenario_flow: renderScenarioFlowStagedSvg };
const cases = Object.keys(renderers).map(view => ({ name: 'sdd_for_sdd', source: 'docs/sdd_app_planning/sdd_for_sdd.sdd', view })).concat([
  { name: 'multiple_outcomes', source: 'bundle/v0.1/examples/multiple_outcomes.sdd', view: 'outcome_opportunity_map' },
  { name: 'service_blueprint_slice', source: 'bundle/v0.1/examples/service_blueprint_slice.sdd', view: 'service_blueprint' },
  { name: 'scenario_branching', source: 'bundle/v0.1/examples/scenario_branching.sdd', view: 'scenario_flow' }
]);
const counts = entries => entries.reduce((acc, entry) => { const key = entry.kind ?? entry.code; acc[key] = (acc[key] ?? 0) + 1; return acc; }, {});
const flatten = item => [item, ...(item.children ?? []).flatMap(flatten)];

// Independent oracle: no production geometry, segment extraction, validator, or solver calls.
// Raw sharing observations intentionally retain all overlaps pending explicit scoped policy audit.
export function independentGeometry(scene) {
  const violations = [], segments = [], boxes = flatten(scene.root).filter(item => item.kind === 'node');
  for (const edge of scene.edges) {
    const points = edge.route.points;
    for (const [actual, expected, end] of [[points[0], edge.from, 'source'], [points.at(-1), edge.to, 'target']]) {
      if (!actual || Math.abs(actual.x - expected.x) > .5 || Math.abs(actual.y - expected.y) > .5) violations.push({ kind: 'endpoint_mismatch', edge: edge.id, end });
    }
    for (let index = 0; index < points.length - 1; index++) {
      const a = points[index], b = points[index + 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) <= .5) continue;
      const axis = Math.abs(a.y - b.y) <= .5 ? 'h' : Math.abs(a.x - b.x) <= .5 ? 'v' : undefined;
      if (!axis) { violations.push({ kind: 'non_orthogonal_segment', edge: edge.id, index }); continue; }
      const segment = { edge: edge.id, index, axis, coordinate: axis === 'h' ? a.y : a.x, low: axis === 'h' ? Math.min(a.x,b.x) : Math.min(a.y,b.y), high: axis === 'h' ? Math.max(a.x,b.x) : Math.max(a.y,b.y) };
      segments.push(segment);
      for (const box of boxes) {
        const transverseLow = axis === 'h' ? box.y : box.x;
        const transverseHigh = transverseLow + (axis === 'h' ? box.height : box.width);
        const spanLow = axis === 'h' ? box.x : box.y;
        const spanHigh = spanLow + (axis === 'h' ? box.width : box.height);
        if (segment.coordinate > transverseLow + .5 && segment.coordinate < transverseHigh - .5 && Math.min(segment.high, spanHigh - .5) > Math.max(segment.low, spanLow + .5)) {
          violations.push({ kind: box.id === edge.from.itemId || box.id === edge.to.itemId ? 'endpoint_intrusion' : 'node_intersection', edge: edge.id, index, box: box.id });
        }
      }
    }
  }
  const crossings = [];
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const a = segments[i], b = segments[j];
    if (a.edge === b.edge) continue;
    if (a.axis === b.axis) {
      const overlap = Math.min(a.high,b.high) - Math.max(a.low,b.low), separation = Math.abs(a.coordinate-b.coordinate);
      if (overlap > .5 && separation < 15.5) violations.push({ kind: separation <= .5 ? 'collinear_overlap' : 'track_separation', a, b, overlap, separation });
    } else {
      const h = a.axis === 'h' ? a : b, v = a.axis === 'v' ? a : b;
      if (v.coordinate > h.low + .5 && v.coordinate < h.high - .5 && h.coordinate > v.low + .5 && h.coordinate < v.high - .5) crossings.push({ a, b });
    }
  }
  return { violations, crossings, segmentCount: segments.length };
}

const sourceFiles = (await readFile('/tmp/sdd-routing-hardening-baseline-files.txt', 'utf8')).trim().split('\n').sort();
const hash = createHash('sha256');
for (const file of sourceFiles) hash.update(file).update('\0').update(await readFile(file));
const fingerprint = { capturedAt: new Date().toISOString(), gitHead: (await readFile('/tmp/sdd-routing-hardening-baseline-head.txt', 'utf8')).trim(), sourceSha256: hash.digest('hex'), sourceFingerprintMethod: 'sha256(sorted src and bundle/v0.1 paths + NUL + file bytes)', profile: 'simple', output };
await writeFile(path.join(output, 'fingerprint.json'), JSON.stringify(fingerprint, null, 2));
const rows = [];
for (const entry of cases.filter(entry => !process.argv[3] || entry.view === process.argv[3])) {
  const compiled = compileSource({path:path.join(root,entry.source), text:await readFile(entry.source,'utf8')}, bundle);
  if (!compiled.graph) throw new Error(JSON.stringify(compiled.diagnostics));
  const graphValidation = validateGraph(compiled.graph, bundle, 'simple');
  const projected = projectView(compiled.graph, bundle, entry.view);
  if (!projected.projection) throw new Error(JSON.stringify(projected.diagnostics));
  const view = bundle.views.views.find(view => view.id === entry.view);
  for (const detail of ['compact','detailed']) for (const decorators of ['none','type','id','type,id']) {
    const key = `${entry.name}.${entry.view}.${detail}.${decorators.replace(',','-')}`;
    const rendered = await renderers[entry.view](projected.projection, compiled.graph, view, {detailId:detail, nodeDecoratorMode:{id:decorators,showNodeType:decorators.includes('type'),showNodeId:decorators.includes('id')}});
    const scene = rendered.positionedScene;
    const shared = validatePositionedSceneRouting(scene, {includeEdgeInteractions:true,policy:{minTerminalLeg:0,crossingTreatment:'allow'}});
    const terminalAudit = validatePositionedSceneRouting(scene, {includeEdgeInteractions:true,policy:{minTerminalLeg:12,crossingTreatment:'allow'}}).filter(v => v.kind === 'terminal_leg_too_short');
    const independent = independentGeometry(scene);
    const evidence = {entry,detail,decorators,profile:'simple',graphValidation,emittedDiagnostics:rendered.diagnostics,sharedViolations:shared,terminalAudit,independent};
    await writeFile(path.join(output,`${key}.scene.json`),JSON.stringify(scene,null,2));
    await writeFile(path.join(output,`${key}.evidence.json`),JSON.stringify(evidence,null,2));
    await writeFile(path.join(output,`${key}.svg`),rendered.svg);
    const png = await renderPositionedSceneToPng(scene);
    await writeFile(path.join(output,`${key}.png`),png.png);
    const row = { key, nodeCount:flatten(scene.root).filter(i=>i.kind==='node').length,edgeCount:scene.edges.length,emitted:counts(rendered.diagnostics.filter(d=>d.severity==='error')),shared:counts(shared),terminalAudit:counts(terminalAudit),independent:counts(independent.violations),crossings:independent.crossings.length };
    rows.push(row); console.log(JSON.stringify(row));
  }
}
await writeFile(path.join(output,'matrix.json'),JSON.stringify({fingerprint,rows},null,2));
// Preserve exact proof stage geometry without treating rejected diagnostic artifacts as previews.
const exact = cases[0];
const exactCompiled = compileSource({path:path.join(root,exact.source),text:await readFile(exact.source,'utf8')},bundle);
const exactProjection = projectView(exactCompiled.graph,bundle,exact.view).projection;
const exactView = bundle.views.views.find(view=>view.id===exact.view);
const { renderOutcomeOpportunityMapRoutingDebugArtifacts, renderOutcomeOpportunityMapPreRoutingArtifacts } = await import('../../dist/renderer/staged/outcomeOpportunityMap.js');
const exactSettings = {detailId:'detailed',nodeDecoratorMode:{id:'type,id',showNodeType:true,showNodeId:true}};
const debug = await renderOutcomeOpportunityMapRoutingDebugArtifacts(exactProjection,exactCompiled.graph,exactView,exactSettings);
const pre = await renderOutcomeOpportunityMapPreRoutingArtifacts(exactProjection,exactCompiled.graph,exactView,exactSettings);
for (const stage of ['preRouting','step2','step3']) {
  const artifact = stage === 'preRouting' ? pre : debug;
  await writeFile(path.join(output,`exact-outcome.${stage}.scene.json`),JSON.stringify(artifact[`${stage}PositionedScene`],null,2));
  await writeFile(path.join(output,`exact-outcome.${stage}.svg`),artifact[`${stage}Svg`]);
  await writeFile(path.join(output,`exact-outcome.${stage}.png`),artifact[`${stage}Png`]);
}
