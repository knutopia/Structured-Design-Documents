import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import YAML from 'yaml';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { loadBundle } from '../src/bundle/loadBundle.js';
import type { Bundle } from '../src/bundle/types.js';
import { compileSource } from '../src/compiler/compileSource.js';
import { projectView } from '../src/projector/projectView.js';
import { buildIaPlaceMapRendererScene } from '../src/renderer/staged/iaPlaceMap.js';
import { runIaPlaceMapRendererPipeline, auditIaPlaceMapFinalScene } from '../src/renderer/staged/iaPlaceMapRouting.js';
import { renderPositionedSceneToSvg, renderPositionedSceneToPng } from '../src/renderer/staged/svgBackend.js';
import { RendererArtifactError } from '../src/renderer/staged/diagnostics.js';
import type { PositionedScene } from '../src/renderer/staged/contracts.js';
let temporary: string, bundle: Bundle, removed: Bundle;
beforeAll(async () => {
  temporary = await mkdtemp('/tmp/ia-review2-forward-'); await cp('bundle/v0.2', temporary + '/v0.2', { recursive: true });
  const path = temporary + '/v0.2/core/views.yaml'; const data = YAML.parse(await readFile(path, 'utf8'));
  const config = data.views.find((v: { id: string ;}) => v.id === 'ia_place_map').conventions.renderer_defaults.ia_place_map;
  config.routing_scope.export_clearance = 'readable_gap';
  config.navigation.routing_preferences = { forward_shortcut: { scope: 'same_owner', progression: { axis: 'y', direction: 'positive' }, side_pairs: [{ source: 'south', target: 'west' }], source_offset: 'nearest_feasible', admission: 'fewer_scene_bends_without_extra_crossings_or_expansion' } };
  await writeFile(path, YAML.stringify(data)); bundle = await loadBundle(temporary + '/v0.2/manifest.yaml');
  delete config.navigation.routing_preferences.forward_shortcut;
  delete config.navigation.routing_preferences;
  await writeFile(path, YAML.stringify(data)); removed = await loadBundle(temporary + '/v0.2/manifest.yaml');
}, 60000);
afterAll(async () => { await rm(temporary, { recursive: true, force: true }); });
const sources = ['tests/fixtures/render/billSage_structure.sdd', 'real_world_exploration/billSage_example/billSage_simple_structure.sdd'];
const cache = new Map<string, Promise<PositionedScene>>();
function proof(path: string, detailId: string, decorator: string, use = bundle): Promise<PositionedScene> {
  const key = [path, detailId, decorator, use === bundle ? 'on' : 'off'].join('/');
  if (!cache.has(key)) cache.set(key, (async () => {
    const graph = compileSource({ path, text: await readFile(path, 'utf8') }, use).graph!;
    const view = use.views.views.find(v => v.id === 'ia_place_map')!;
    const projection = projectView(graph, use, view.id).projection!;
    const result = await runIaPlaceMapRendererPipeline(buildIaPlaceMapRendererScene(projection, graph, view, { detailId, ...(decorator === 'plain' ? {} : { nodeDecoratorMode: { id: decorator, showNodeType: true, showNodeId: true } }) }, use));
    await writeFile('/tmp/ia-forward.' + sources.indexOf(path) + '.' + detailId + '.' + decorator + '.' + (use === bundle ? 'on' : 'off') + '.json', JSON.stringify(result.positionedScene, null, 2));
    return result.positionedScene;
  })()); return cache.get(key)!;
}
function edge(scene: PositionedScene, target: string) { return scene.edges.find(e => e.from.itemId.includes('P-210') && e.to.itemId.includes(target))!; }
function crossings(scene: PositionedScene) {
  let count = 0; for (let i = 0; i < scene.edges.length; i++)for (let j = 0; j < i; j++) {
    const a = scene.edges[i]!.route.points, b = scene.edges[j]!.route.points;
    for (let x = 1; x < a.length; x++)for (let y = 1; y < b.length; y++) {
      const p = a[x - 1]!, q = a[x]!, r = b[y - 1]!, s = b[y]!;
      if ((p.y === q.y) === (r.y === s.y)) continue;
      const h = p.y === q.y ? [p, q] : [r, s], v = p.y === q.y ? [r, s] : [p, q];
      if (v[0]!.x > Math.min(h[0]!.x, h[1]!.x) + .5 && v[0]!.x < Math.max(h[0]!.x, h[1]!.x) - .5 && h[0]!.y > Math.min(v[0]!.y, v[1]!.y) + .5 && h[0]!.y < Math.max(v[0]!.y, v[1]!.y) - .5) count++;
    }  
} return count;
}
describe.each(['compact', 'detailed'])('forward proof %s', detail => {
  it.each(sources.flatMap(path => ['plain', 'type-id'].map(decorator => ({ path, decorator }))))('$path / $decorator selects the admitted shortcut and preserves the straight companion', async ({ path, decorator }) => {
    const scene = await proof(path, detail, decorator); expect(scene.diagnostics.filter(d => d.severity === 'error')).toEqual([]); expect(auditIaPlaceMapFinalScene(scene)).toEqual([]);
    expect(scene.edges).toHaveLength(8); const shortcut = edge(scene, 'P-230'), straight = edge(scene, 'P-220');
    expect(shortcut.route.points).toHaveLength(3); expect(straight.route.points).toHaveLength(2); expect(crossings(scene)).toBe(0);
    expect(shortcut.from.x).toBeLessThan(straight.from.x); expect(shortcut.route.points[0]!.x).toBe(shortcut.route.points[1]!.x); expect(shortcut.route.points[1]!.y).toBe(shortcut.route.points[2]!.y);
    expect(scene.forwardRoutingWitness).toBeDefined(); expect(scene.routingEvidence!.candidates).toBeLessThanOrEqual(4096); expect(scene.routingEvidence!.repairs).toBeLessThanOrEqual(128);
    const baseline = scene.forwardRoutingWitness!.baseline;
    expect([scene.root.width, scene.root.height]).toEqual([baseline.root.width, baseline.root.height]);
    const svg = await renderPositionedSceneToSvg(scene); await writeFile('/tmp/ia-forward.' + sources.indexOf(path) + '.' + detail + '.' + decorator + '.svg', svg.svg);
  }, 120000);
});
it('policy removal through the real loader restores ordinary allocation', async () => {
  const on = await proof(sources[0]!, 'compact', 'plain'), off = await proof(sources[0]!, 'compact', 'plain', removed);
  expect(edge(on, 'P-230').route.points).toHaveLength(3); expect(edge(off, 'P-230').route.points.length).toBeGreaterThan(3); expect(off.forwardRoutingWitness).toBeUndefined(); expect(auditIaPlaceMapFinalScene(off)).toEqual([]);
}, 120000);
it('SVG and derived PNG repeat acceptance withhold corrupt or deleted witnesses', async () => {
  const scene = await proof(sources[0]!, 'compact', 'plain'); expect(scene.forwardRoutingWitness).toBeDefined();
  for (const mutation of ['delete', 'baseline', 'labels', 'cost', 'recursive']) {
    const bad = structuredClone(scene);
    if (mutation === 'delete') delete bad.forwardRoutingWitness;
    else if (mutation === 'baseline') bad.forwardRoutingWitness!.baseline.root.width++;
    else if (mutation === 'labels') bad.forwardRoutingWitness!.baseline.edges[0]!.markers = { end: 'none' };
    else if (mutation === 'recursive') Object.assign(bad.forwardRoutingWitness!.baseline, { forwardRoutingWitness: bad.forwardRoutingWitness });
    else bad.forwardRoutingWitness!.shortcutIds = [];
    expect(auditIaPlaceMapFinalScene(bad).length, mutation).toBeGreaterThan(0);
    await expect(renderPositionedSceneToSvg(bad)).rejects.toThrow(mutation === 'recursive' ? /independent baseline/ : undefined);
    await expect(renderPositionedSceneToPng(bad)).rejects.toBeInstanceOf(RendererArtifactError);
  }
}, 120000);
