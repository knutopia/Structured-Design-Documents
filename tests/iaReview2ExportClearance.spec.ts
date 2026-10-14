import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import YAML from 'yaml';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { loadBundle } from '../src/bundle/loadBundle.js';
import type { Bundle } from '../src/bundle/types.js';
import { compileSource } from '../src/compiler/compileSource.js';
import { projectView } from '../src/projector/projectView.js';
import { buildIaPlaceMapRendererScene } from '../src/renderer/staged/iaPlaceMap.js';
import { runIaPlaceMapRendererPipeline, auditIaPlaceMapFinalScene } from '../src/renderer/staged/iaPlaceMapRouting.js';
import { renderPositionedSceneToSvg, renderPositionedSceneToPng } from '../src/renderer/staged/svgBackend.js';
import { RendererArtifactError } from '../src/renderer/staged/diagnostics.js';
import { getRendererTheme, registerRendererTheme } from '../src/renderer/staged/theme.js';
import { measurePaintedExportDeficits } from '../src/renderer/staged/exportPaint.js';
import type { PositionedScene } from '../src/renderer/staged/contracts.js';

let bundle: Bundle, original: Bundle, text: string, temporary: string;
const fixture = 'tests/fixtures/render/ia_parallel_navigation_v02.sdd';
const first = '    NAVIGATES_TO P-002 [E-001] {workspace selected} diagrams="DG-001,DG-002"';
const cache = new Map<string, Promise<PositionedScene>>();
beforeAll(async () => {
  temporary = await mkdtemp('/tmp/ia-review2-export-');
  await cp('bundle/v0.2', temporary + '/v0.2', { recursive: true });
  const viewsPath = temporary + '/v0.2/core/views.yaml';
  const views = YAML.parse(await readFile(viewsPath, 'utf8'));
  const policy = views.views.find((v: { id: string ;}) => v.id === 'ia_place_map').conventions.renderer_defaults.ia_place_map;
  delete policy.navigation.routing_preferences;

  policy.routing_scope.export_clearance = 'readable_gap';
  await writeFile(viewsPath, YAML.stringify(views));
  bundle = await loadBundle(temporary + '/v0.2/manifest.yaml');
  delete policy.routing_scope.export_clearance;
  await writeFile(viewsPath, YAML.stringify(views));
  original = await loadBundle(temporary + '/v0.2/manifest.yaml');
  text = await readFile(fixture, 'utf8');
});
afterAll(async () => { await rm(temporary, { recursive: true, force: true }); });
function proof(detailId: string, name: string, useBundle = bundle) {
  const key = [detailId, name, useBundle === bundle].join('/');
  if (!cache.has(key)) cache.set(key, (async () => {
    let source = text;
    if (name === 'self-loop') source = source.replace(first, first + '\n    NAVIGATES_TO P-001 [E-001] {refresh workspace} diagrams=DG-001');
    if (name === 'multiple-incoming') source = source.replace('    route_or_key=/workspace/settings', '    NAVIGATES_TO P-002 [E-001] {settings saved} diagrams=DG-001\n    route_or_key=/workspace/settings');
    const graph = compileSource({ path: fixture, text: source }, useBundle).graph!;
    const view = useBundle.views.views.find(v => v.id === 'ia_place_map')!;
    const projection = projectView(graph, useBundle, view.id, name.startsWith('DG-') ? { diagramId: name } : undefined).projection!;
    const result = (await runIaPlaceMapRendererPipeline(buildIaPlaceMapRendererScene(projection, graph, view, { detailId }, useBundle))).positionedScene;
    await writeFile(`/tmp/ia-review2-export.${detailId}.${name}.${useBundle === bundle}.json`, JSON.stringify(result, null, 2));
    return result;
  })());
  return cache.get(key)!;
}
// Independent centreline/stroke and label-box inequalities; marker coordinates below
// independently reconstruct the actual arrow triangle rather than using the audit.
function assertPaintedMargins(scene: PositionedScene) {
  const { paint } = getRendererTheme(scene.themeId);
  const bounds = scene.root;
  const check = (x: number, y: number, right: number, bottom: number) => {
    expect(x - bounds.x).toBeGreaterThanOrEqual(15.5);
    expect(y - bounds.y).toBeGreaterThanOrEqual(15.5);
    expect(bounds.x + bounds.width - right).toBeGreaterThanOrEqual(15.5);
    expect(bounds.y + bounds.height - bottom).toBeGreaterThanOrEqual(15.5);
  };
  for (const edge of scene.edges) {
    for (const point of edge.route.points) check(point.x - paint.edgeStrokeWidth / 2, point.y - paint.edgeStrokeWidth / 2,
      point.x + paint.edgeStrokeWidth / 2, point.y + paint.edgeStrokeWidth / 2);
    if (edge.label) check(edge.label.x - paint.strokeWidth / 2, edge.label.y - paint.strokeWidth / 2,
      edge.label.x + edge.label.width + paint.strokeWidth / 2, edge.label.y + edge.label.height + paint.strokeWidth / 2);
    for (const end of ['start', 'end'] as const) if (edge.markers?.[end] === 'arrow') {
      const tip = end === 'start' ? edge.route.points[0]! : edge.route.points.at(-1)!;
      const neighbor = end === 'start' ? edge.route.points[1]! : edge.route.points.at(-2)!;
      const length = Math.hypot(tip.x - neighbor.x, tip.y - neighbor.y);
      const dx = (tip.x - neighbor.x) / length, dy = (tip.y - neighbor.y) / length;
      const base = { x: tip.x - dx * (paint.arrowSize - 1), y: tip.y - dy * (paint.arrowSize - 1) };
      const points = [{ x: tip.x + dx, y: tip.y + dy },
      { x: base.x - dy * paint.arrowSize / 2, y: base.y + dx * paint.arrowSize / 2 },
      { x: base.x + dy * paint.arrowSize / 2, y: base.y - dx * paint.arrowSize / 2 }];
      const half = paint.edgeStrokeWidth / 2;
      check(Math.min(...points.map(p => p.x)) - half, Math.min(...points.map(p => p.y)) - half,
        Math.max(...points.map(p => p.x)) + half, Math.max(...points.map(p => p.y)) + half);
    }
  }
}
describe.each(['compact', 'detailed'])('review 2 export clearance: %s', detail => {
  it.each(['parallel', 'self-loop', 'multiple-incoming', 'DG-001', 'DG-002', 'DG-003'])('audits complete paint and convergence for %s', async name => {
    const scene = await proof(detail, name);
    expect(scene.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
    expect(auditIaPlaceMapFinalScene(scene)).toEqual([]);
    assertPaintedMargins(scene);
    if (name === 'DG-002' || name === 'DG-003') expect(scene.edges[0]!.route.points).toHaveLength(2);
    expect(scene.routingEvidence!.candidates).toBeLessThanOrEqual(4096);
    expect(scene.routingEvidence!.repairs).toBeLessThanOrEqual(128);
    expect(Math.max(...scene.routingEvidence!.revisions.map(r => r.pass))).toBeLessThanOrEqual(4);
  });
  it('observably follows export policy removal', async () => {
    const on = await proof(detail, 'parallel'), off = await proof(detail, 'parallel', original);
    assertPaintedMargins(on);
    expect(measurePaintedExportDeficits(off).size).toBeGreaterThan(0);
    expect([on.root.width, on.root.height]).not.toEqual([off.root.width, off.root.height]);
  });
  it('withholds SVG and derived PNG for lost policy or painted margin corruption', async () => {
    const accepted = await proof(detail, 'parallel');
    for (const mutation of ['policy', 'paint']) {
      const scene = structuredClone(accepted);
      if (mutation === 'policy') delete scene.root.viewMetadata!.iaPlaceMap;
      else {
        const edge = scene.edges.find(e => e.route.points.length > 3)!;
        const point = edge.route.points.find(p => p.x === Math.max(...edge.route.points.map(p => p.x)))!;
        point.x = scene.root.x + scene.root.width - 2;
      }
      expect(auditIaPlaceMapFinalScene(scene).some(d => d.severity === 'error')).toBe(true);
      await expect(renderPositionedSceneToSvg(scene)).rejects.toBeInstanceOf(RendererArtifactError);
      await expect(renderPositionedSceneToPng(scene)).rejects.toBeInstanceOf(RendererArtifactError);
    }
  });
});

it('includes label strokes and larger marker/stroke footprints in deficits', async () => {
  const accepted = await proof('compact', 'DG-002');
  const scene = structuredClone(accepted);
  const theme = structuredClone(getRendererTheme(scene.themeId));
  theme.id = 'review2-paint-deficit';
  theme.paint.edgeStrokeWidth = 8;
  theme.paint.strokeWidth = 6;
  theme.paint.arrowSize = 22;
  scene.themeId = registerRendererTheme(theme);
  const label = scene.edges[0]!.label!;
  label.x = scene.root.x + 17;
  const deficits = measurePaintedExportDeficits(scene);
  expect(deficits.get('west')).toBeCloseTo(2);
  expect(auditIaPlaceMapFinalScene(scene).some(d => d.code === 'renderer.routing.export_clearance')).toBe(true);
});
