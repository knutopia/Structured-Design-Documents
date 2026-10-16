// THROWAWAY capture/build script. Run from repository root after pnpm build.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { compileSource, loadBundle } from '../../../../dist/index.js';
import { projectView, projectDiagram } from '../../../../dist/projector/projectView.js';
import { buildUiContractsPresentationModel } from '../../../../dist/renderer/uiContractsPresentationModel.js';
import { buildUiContractsRendererScene } from '../../../../dist/renderer/staged/uiContracts.js';
import { UiContractsSceneBuilder } from '../../../../dist/renderer/staged/uiContractsPresentationScene.js';
import { runStagedRendererPipeline } from '../../../../dist/renderer/staged/pipeline.js';
import { renderPositionedSceneToSvg } from '../../../../dist/renderer/staged/svgBackend.js';
import { resolveRendererTheme } from '../../../../dist/renderer/staged/theme.js';
import { markerRoutingClearance } from '../../../../dist/renderer/staged/markerGeometry.js';
import { initialState, runExperiment } from './model.mjs';

const dir = new URL('./', import.meta.url);
const root = fileURLToPath(new URL('../../../../', dir));
const documentPath = 'aeb_help_center_de_astra.sdd';
const manifest = `${root}bundle/v0.2/manifest.yaml`;
const text = await readFile(`${root}${documentPath}`, 'utf8');
const bundle = await loadBundle(manifest);
const { graph } = compileSource({ path: documentPath, text }, bundle);
const viewId = 'ui_contracts'; // Architectural adapter being prototyped; semantics come from the loaded view.
const view = bundle.views.views.find(v => v.id === viewId);
const decorators = { id: 'type,id', showNodeType: true, showNodeId: true };
const projection = projectView(graph, bundle, viewId).projection;
const model = buildUiContractsPresentationModel(projection, graph, view, 'compact');
const sequence = model.scopes.find(s => s.id === 'scope:P-360005333058').sequences[0];
const index = new Map(sequence.nodes.map((node, i) => [node.id, i]));
const category = edge => edge.from === edge.to ? 'loop' : index.get(edge.from) > index.get(edge.to) ? 'return' : 'forward';
const builder = new UiContractsSceneBuilder('compact', decorators);
const measured = builder.measure(sequence.nodes.map(n => builder.node(n)));
const theme = resolveRendererTheme(builder.scene.themeId, 'routing').theme;
const seed = {
  nodes: sequence.nodes.map((node, i) => ({ id: node.id, semanticId: node.semanticId, title: node.title,
    width: measured[i].width, height: measured[i].height })),
  edges: sequence.edges.map(edge => ({ ...edge, category: category(edge),
    label: edge.label ? builder.labelMeasure({ text: edge.label, textStyleRole: 'edge_label' }, edge.id) : undefined })),
  markerClearance: markerRoutingClearance('arrow', theme.paint.arrowSize, theme.paint.edgeStrokeWidth),
  arrowSize: theme.paint.arrowSize, strokeWidth: theme.paint.edgeStrokeWidth,
  labelStyle: theme.textStyles.edge_label, edgeColor: theme.paint.palette.edge,
  labelPadding: theme.nodePrimitives.edge_label.padding.left,
  labelRadius: theme.paint.cornerRadii.node.edge_label
};
const captures = {};
for (const topology of ['mixed', 'pair', 'forward-loop', 'loop']) {
  const selected = structuredClone(sequence);
  selected.edges = selected.edges.filter(e => topology === 'mixed' || topology === 'pair' && category(e) !== 'loop'
    || topology === 'forward-loop' && category(e) !== 'return' || topology === 'loop' && category(e) === 'loop');
  if (topology === 'loop') selected.nodes = selected.nodes.filter(n => selected.edges.some(e => e.from === n.id));
  const adapter = new UiContractsSceneBuilder('compact', decorators);
  adapter.scene.root.children = [adapter.sequence(selected)];
  const result = await runStagedRendererPipeline(adapter.scene);
  const artifact = await renderPositionedSceneToSvg(result.positionedScene);
  captures[topology] = { sequence: selected, positioned: result.positionedScene, svg: artifact.svg,
    diagnostics: artifact.diagnostics };
  console.log(`Production capture ${topology}: ${artifact.diagnostics.length} diagnostics`);
}

console.log('Capturing actual named diagram DG-002…');
const diagramProjection = projectDiagram(graph, bundle, 'DG-002').projection;
const diagramModel = buildUiContractsPresentationModel(diagramProjection, graph, view, 'compact');
const diagramSequence = diagramModel.scopes.find(s => s.id === 'scope:P-360005333058').sequences[0];
const diagramScene = buildUiContractsRendererScene(diagramProjection, graph, view, { detailId: 'compact', nodeDecoratorMode: decorators });
const diagramResult = await runStagedRendererPipeline(diagramScene);
const diagramArtifact = await renderPositionedSceneToSvg(diagramResult.positionedScene);
function find(item, id) { return item.id === id ? item : item.children?.map(c => find(c, id)).find(Boolean); }
const region = find(diagramResult.positionedScene.root, `${diagramSequence.id}:return-region`);
if (!region) throw new Error('Named diagram transition region missing');
const crop = { x: region.x - 8, y: region.y - 8, width: region.width + 16, height: region.height + 16 };
// Only the SVG viewport changes: this is the actual full named-diagram rendering.
const croppedSvg = diagramArtifact.svg.replace(/width="[^"]+" height="[^"]+" viewBox="[^"]+"/,
  `width="${crop.width}" height="${crop.height}" viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}"`);
captures.diagram = { sequence: diagramSequence, crop, svg: croppedSvg, fullSvg: diagramArtifact.svg,
  diagnostics: diagramArtifact.diagnostics, positioned: diagramResult.positionedScene };
console.log(`DG-002: ${diagramSequence.edges.length} transitions in proof region, ${diagramArtifact.diagnostics.length} diagnostics`);

// Retain the production node painting, including bundled fonts, in the live candidate.
for (const node of seed.nodes) {
  const base = captures.mixed.positioned;
  const positionedNode = { ...find(base.root, node.id), x: 0, y: 0 };
  node.svg = (await renderPositionedSceneToSvg({ ...base, diagnostics: [], decorations: [], edges: [],
    root: { ...base.root, x: 0, y: 0, width: node.width, height: node.height, children: [positionedNode], ports: [] } })).svg;
}

const reports = [];
for (const topology of ['mixed', 'pair', 'forward', 'forward-loop', 'loop']) {
  const state = { ...initialState(), panel: 'candidate', topology };
  const result = runExperiment(seed, state);
  if (!result.accepted) throw new Error(`Candidate ${topology} failed: ${JSON.stringify(result.violations)} ${result.labelIssues}`);
  const repeat = runExperiment(seed, state);
  if (JSON.stringify(result) !== JSON.stringify(repeat)) throw new Error('Nondeterministic candidate');
  reports.push({ state, result });
}
for (const overrides of [{ capacity: 'tight' }, { fault: 'shared-ports' }, { fault: 'wrong-attachment' }]) {
  const state = { ...initialState(), panel: 'candidate', ...overrides };
  const result = runExperiment(seed, state);
  if (result.accepted || !result.violations.length) throw new Error('Negative control unexpectedly accepted');
  reports.push({ state, result });
}
// Confirm the comparison inventories against projection, not guessed statement lists.
if (sequence.edges.length !== 3 || !sequence.edges.some(e => e.from === e.to)
  || diagramSequence.edges.length !== 2 || diagramSequence.edges.some(e => e.from === e.to)
  || !captures.mixed.diagnostics.some(d => d.severity === 'error') || diagramArtifact.diagnostics.some(d => d.severity === 'error'))
  throw new Error('The captured evidence no longer matches the intended proof case');

const provenance = {
  source: documentPath, sourceSha256: createHash('sha256').update(text).digest('hex'),
  baseCommit: (await promisify(execFile)('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim(),
  manifest: 'bundle/v0.2/manifest.yaml', detail: 'compact', decorators: 'type,id',
  question: 'Can complete connectors with independently allocated attachments and measured routing space preserve all three transitions?',
  scope: 'Two-state transition region only; production adoption and arbitrary graphs are unproven.'
};
await writeFile(new URL('evidence.json', dir), JSON.stringify({ provenance, seed,
  captures: Object.fromEntries(Object.entries(captures).map(([key, capture]) => [key,
    { sequence: capture.sequence, crop: capture.crop, positioned: capture.positioned, diagnostics: capture.diagnostics }])), reports },
  (key, value) => key === 'svg' ? undefined : value, 2) + '\n');
await writeFile(new URL('dg002.svg', dir), diagramArtifact.svg + '\n');
const browserData = { provenance, seed, captures: Object.fromEntries(Object.entries(captures).map(([key, c]) => [key,
  { svg: c.svg, fullSvg: c.fullSvg, diagnostics: c.diagnostics, sequence: c.sequence,
    sceneEdgeCount: c.positioned.edges.filter(e => key !== 'diagram' || e.id.startsWith(diagramSequence.id)).length,
    geometry: c.positioned.edges.filter(e => key !== 'diagram' || e.id.startsWith(diagramSequence.id)) }])),
  fontDefs: captures.mixed.svg.match(/<defs>([\s\S]*?)<\/defs>/)[1] };
const require = createRequire(import.meta.url);
const tsxRequire = createRequire(require.resolve('tsx/package.json'));
const { build } = await import(tsxRequire.resolve('esbuild'));
// Build-time only: embed the actual shared validator in one offline HTML artifact.
const runtime = await build({ entryPoints: [fileURLToPath(new URL('model.mjs', dir))], bundle: true,
  write: false, format: 'iife', globalName: 'RoutingPrototype', platform: 'browser', target: 'es2022' });
const template = await readFile(new URL('shell.html', dir), 'utf8');
const html = template.replace('/* INLINE_MODEL */', runtime.outputFiles[0].text)
  .replace('/* INLINE_EVIDENCE */', `const DATA = ${JSON.stringify(browserData).replaceAll('<', '\\u003c')};`);
await writeFile(new URL('prototype.html', dir), html);
console.log(`Captured ${reports.length} candidate/negative-control states. Open ${fileURLToPath(new URL('prototype.html', dir))}`);
