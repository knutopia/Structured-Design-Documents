// THROWAWAY third prototype. Run from the repo root after pnpm build.
// Reuses captures; never reruns the expensive failing routing pipeline.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { allocateOrderedPortPair, orderedPortPairHasTraversal } from '../../../../dist/renderer/staged/routingCore/orderedPortPair.js';
import { validateFinalRouteSet } from '../../../../dist/renderer/staged/routingCore/lifecycle.js';
import { DEFAULT_ROUTING_POLICY } from '../../../../dist/renderer/staged/routingCore/contracts.js';
import { arrowMarkerFootprintBox } from '../../../../dist/renderer/staged/markerGeometry.js';
import { renderPositionedSceneToSvg } from '../../../../dist/renderer/staged/svgBackend.js';

const dir = new URL('./', import.meta.url);
const evidenceText = await readFile(new URL('evidence.json', dir), 'utf8');
const evidence = JSON.parse(evidenceText);
const namedSvg = await readFile(new URL('dg002.svg', dir), 'utf8');
const { seed, captures } = evidence;
const failure = captures.mixed.positioned;
const named = captures.diagram.positioned;
const find = (item, id) => item.id === id ? item : item.children?.map(child => find(child, id)).find(Boolean);
const nodes = seed.nodes.map(node => find(named.root, node.id));
const failedNodes = seed.nodes.map(node => find(failure.root, node.id));
const pairEdges = named.edges.filter(edge => edge.id.startsWith(captures.diagram.sequence.id));
const pairSnapshot = JSON.stringify(pairEdges);
const loopSemantic = seed.edges.find(edge => edge.category === 'loop');
const node = nodes.find(item => item.id === loopSemantic.from);
const minimumLeg = Math.max(DEFAULT_ROUTING_POLICY.minTerminalLeg, seed.markerClearance);
const gap = Math.max(DEFAULT_ROUTING_POLICY.minSeparation, seed.markerClearance);

// The requested prototype constraint owns this south/negative trial. It is not
// a new UI Contracts bundle convention. Allocate endpoints BEFORE route points.
// Reserve label width between the legs, and marker/label clearance below the card.
const allocation = allocateOrderedPortPair({
  sideLength: node.width, minInset: minimumLeg,
  minSeparation: loopSemantic.label.width + 2 * gap,
  direction: 'negative', placement: 'nearest_feasible',
  occupiedOffsets: [], otherArrivalOffsets: []
});
assert(allocation, 'The measured card cannot accommodate this local loop.');
const bottom = node.y + node.height;
const source = { nodeId: node.id, side: 'south', minLeg: minimumLeg,
  point: { x: node.x + allocation.departure, y: bottom } };
const target = { nodeId: node.id, side: 'south', minLeg: minimumLeg,
  point: { x: node.x + allocation.arrival, y: bottom } };
const depth = loopSemantic.label.height + 2 * gap;
const loop = {
  id: loopSemantic.id, role: 'transition', classes: [], paintGroup: 'edges',
  from: { itemId: node.id, portId: 'prototype-loop-departure', ...source.point },
  to: { itemId: node.id, portId: 'prototype-loop-arrival', ...target.point },
  route: { style: 'orthogonal', points: [
    { ...source.point }, { x: source.point.x, y: bottom + depth },
    { x: target.point.x, y: bottom + depth }, { ...target.point }
  ] },
  label: { ...structuredClone(loopSemantic.label),
    x: (source.point.x + target.point.x - loopSemantic.label.width) / 2, y: bottom + gap },
  markers: { end: 'arrow' }
};

// Join captured return fragments without changing any point. Endpoint contracts
// come from measured node ports, independently of those route points.
function completeConnector(semantic, edges, priority) {
  const fragments = edges.filter(edge => edge.id === semantic.id || edge.id.startsWith(`${semantic.id}:return:`));
  assert(fragments.length);
  const bind = endpoint => {
    const owner = nodes.find(item => item.id === endpoint.itemId);
    const port = owner.ports.find(port => port.id === endpoint.portId);
    return { nodeId: owner.id, side: port.side, minLeg: minimumLeg,
      point: { x: owner.x + port.x, y: owner.y + port.y } };
  };
  const points = [];
  for (const fragment of fragments) for (const point of fragment.route.points) {
    if (JSON.stringify(point) !== JSON.stringify(points.at(-1))) points.push({ ...point });
  }
  return { id: semantic.id, priority, source: bind(fragments[0].from), target: bind(fragments.at(-1).to),
    route: { style: 'orthogonal', points } };
}
const connectors = captures.diagram.sequence.edges.map((edge, index) => completeConnector(edge, pairEdges, index));
connectors.push({ id: loop.id, priority: connectors.length, source, target, route: loop.route });
const labels = [...pairEdges, loop].filter(edge => edge.label).map(edge => ({ id: edge.id, ...edge.label }));
const box = ({ id, x, y, width, height }) => ({ id, x, y, width, height });
const bounds = { minX: nodes[0].x - 34, minY: nodes[0].y - 149.5,
  maxX: node.x + node.width + 34, maxY: bottom + depth + 24 };
const context = { connectors, boxes: nodes.map(box),
  blockers: labels.map(label => ({ ...box(label), id: `label:${label.id}`, clearance: seed.strokeWidth / 2 })),
  bounds, policy: { ...DEFAULT_ROUTING_POLICY, crossingTreatment: 'forbid' } };
const violations = validateFinalRouteSet(context);
assert.deepEqual(violations, [], 'Stop: adding the local loop conflicts with the fixed working pair.');
assert(orderedPortPairHasTraversal(source.point.x, target.point.x, 'negative'));
assert(orderedPortPairHasTraversal(loop.route.points[1].x, loop.route.points[2].x, 'negative'));
assert.equal(source.point.y, bottom);
assert.equal(target.point.y, bottom);
assert(source.point.x < node.x + node.width && target.point.x > node.x);
assert.equal(JSON.stringify(pairEdges), pairSnapshot);
assert.equal(connectors.length, 3);
assert.deepEqual(loop.label.lines, loopSemantic.label.lines);

const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x
  && a.y < b.y + b.height && a.y + a.height > b.y;
const markerBoxes = connectors.map(connector => ({ id: connector.id,
  ...arrowMarkerFootprintBox(connector.route.points.at(-1), connector.route.points.at(-2), seed.arrowSize, seed.strokeWidth) }));
const clearanceIssues = [];
for (const label of labels) {
  for (const obstacle of [...nodes, ...labels.filter(other => other.id !== label.id), ...markerBoxes]) {
    if (intersects(label, obstacle)) clearanceIssues.push(`Label ${label.id} intersects ${obstacle.id}`);
  }
  assert(label.x >= bounds.minX && label.y >= bounds.minY
    && label.x + label.width <= bounds.maxX && label.y + label.height <= bounds.maxY);
}
for (const [index, marker] of markerBoxes.entries()) {
  for (const other of markerBoxes.slice(index + 1)) if (intersects(marker, other)) clearanceIssues.push('Markers overlap');
  for (const other of nodes.filter(item => item.id !== connectors[index].target.nodeId)) {
    if (intersects(marker, other)) clearanceIssues.push('Marker intersects unrelated node');
  }
}
assert.deepEqual(clearanceIssues, []);

// Copy intact SVG groups from the actual named-diagram artifact. Removing content
// outside this two-state region is a crop; no path/card/label is reconstructed.
function groupsFor(svg, attribute, ids) {
  const groups = [];
  const openings = /<g\b[^>]*>/g;
  for (const match of svg.matchAll(openings)) {
    const value = match[0].match(new RegExp(`${attribute}="([^"]+)"`))?.[1];
    if (!ids.has(value)) continue;
    const tags = /<\/?g\b[^>]*>/g;
    tags.lastIndex = match.index;
    let level = 0;
    for (let tag; (tag = tags.exec(svg));) {
      level += tag[0].startsWith('</') ? -1 : 1;
      if (!level) { groups.push(svg.slice(match.index, tags.lastIndex)); break; }
    }
  }
  return groups.join('\n');
}
const nodeIds = new Set(nodes.map(item => item.id));
function cropContent(svg, edges) {
  const content = groupsFor(svg, 'data-item-id', nodeIds) + '\n'
    + groupsFor(svg, 'data-edge-id', new Set(edges.map(edge => edge.id)));
  assert.equal((content.match(/class="scene-edge-label /g) ?? []).length, edges.filter(edge => edge.label).length);
  assert.equal((content.match(/marker-end=|data-arrow-end=/g) ?? []).length, edges.filter(edge => edge.markers?.end).length);
  return content;
}
const pairContent = cropContent(namedSvg, pairEdges);
const failureArtifact = await renderPositionedSceneToSvg(failure);
const failureContent = cropContent(failureArtifact.svg, failure.edges);
const loopScene = { ...failure, diagnostics: [], decorations: [], edges: [loop],
  root: { ...failure.root, x: bounds.minX, y: bounds.minY,
    width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY, children: nodes } };
const loopArtifact = await renderPositionedSceneToSvg(loopScene);
const loopContent = groupsFor(loopArtifact.svg, 'data-edge-id', new Set([loop.id]));
assert.equal((loopContent.match(/marker-end=|data-arrow-end=/g) ?? []).length, 1);

const dx = failedNodes[0].x - nodes[0].x;
const dy = failedNodes[0].y - nodes[0].y;
for (let index = 0; index < nodes.length; index++) {
  assert.equal(nodes[index].x + dx, failedNodes[index].x);
  assert.equal(nodes[index].y + dy, failedNodes[index].y);
  assert.equal(nodes[index].width, failedNodes[index].width);
  assert.equal(nodes[index].height, failedNodes[index].height);
}
const width = bounds.maxX - bounds.minX;
const proposedHeight = bounds.maxY - bounds.minY;
const classes = namedSvg.match(/<svg[^>]* class="([^"]+)"/)[1];
function panelSvg(id, content, defsSvg, height, translate = '') {
  const defs = defsSvg.match(/<defs>([\s\S]*?)<\/defs>/)[1];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${id}-heading" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="${classes}"><defs>${defs}</defs><g${translate ? ` transform="translate(${translate})"` : ''}>${content}</g></svg>`;
  // Distinct fragment IDs prevent one panel's markers/clips resolving in another.
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  for (const value of ids) svg = svg.replaceAll(`id="${value}"`, `id="${id}-${value}"`)
    .replaceAll(`url(#${value})`, `url(#${id}-${value})`);
  return svg;
}
const panels = [
  { id: 'failure', title: 'Current failure — three transitions',
    caption: 'Return paths overlap; the self-loop takes the long route across the sequence.',
    status: `Failed: ${captures.mixed.diagnostics.filter(item => item.severity === 'error').length} captured routing errors.`,
    svg: panelSvg('failure', failureContent, failureArtifact.svg, 243) },
  { id: 'working', title: 'Working DG-002 — two transitions',
    caption: 'This named diagram renders because its membership excludes the self-loop.',
    status: `Actual DG-002 output: ${captures.diagram.diagnostics.length} diagnostics.`,
    svg: panelSvg('working', pairContent, namedSvg, 227, `${dx} ${dy}`) },
  { id: 'proposed', title: 'Proposed solution — all three transitions',
    caption: 'The self-loop leaves and returns on the same bottom edge, travelling right to left.',
    status: `Geometry passed: ${violations.length} route violations; ${clearanceIssues.length} label/marker conflicts. Forward/back pair unchanged.`,
    svg: panelSvg('proposed', pairContent + '\n' + loopContent, namedSvg, proposedHeight, `${dx} ${dy}`) }
];
const html = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>UI Contracts — focused comparison, prototype 3</title>
<style>
* { box-sizing: border-box; }
body { margin: 0; padding: 24px; color: #17212c; background: #fff; font: 14px/1.5 system-ui, sans-serif; }
main { width: ${width}px; }
.note { margin: 0 0 22px; color: #56616d; font-size: 13px; }
section { margin: 0 0 28px; padding: 0 0 20px; border-bottom: 1px solid #dce1e5; }
section:last-child { border: 0; margin-bottom: 0; }
h2 { font-size: 18px; line-height: 1.4; margin: 0 0 4px; font-weight: 650; }
p { margin: 0; }
.status { font-size: 12px; color: #536170; margin: 5px 0 8px; }
#failure .status { color: #a32525; }
#proposed .status { color: #17633a; }
svg { display: block; max-width: none; }
</style>
<main>
<p class="note">Throwaway prototype 3 · same scale throughout: 1 SVG unit = 1 screen pixel.</p>
${panels.map(panel => `<section id="${panel.id}"><h2 id="${panel.id}-heading">${panel.title}</h2><p>${panel.caption}</p><p class="status">${panel.status}</p>${panel.svg}</section>`).join('\n')}
</main></html>\n`;
assert.equal((html.match(/<svg\b/g) ?? []).length, 3);
assert(!/<script\b|<button\b|<input\b/.test(html));
const sha256 = text => createHash('sha256').update(text).digest('hex');
const report = {
  question: 'Can a local south-edge backward loop coexist with the actual working DG-002 pair without moving it?',
  verdict: 'Yes for this captured two-state case; production routing and other graphs are unproven.',
  sources: { captures: { path: 'evidence.json', sha256: sha256(evidenceText) },
    namedSvg: { path: 'dg002.svg', sha256: sha256(namedSvg) }, document: evidence.provenance.source,
    documentSha256: evidence.provenance.sourceSha256 },
  allocation, depth, gap, context, labels, markerBoxes,
  validation: { completeRouteViolations: violations, labelMarkerConflicts: clearanceIssues,
    sameSouthSide: true, negativeTraversal: true, pairUnchanged: true, cardDimensionsUnchanged: true },
  crop: { translation: { dx, dy }, width, heights: [243, 227, proposedHeight], unitsPerPixel: 1 },
  artifactSha256: sha256(html)
};
await writeFile(new URL('focused-comparison-prototype.html', dir), html);
await writeFile(new URL('focused-comparison-evidence.json', dir), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: 'focused-comparison-prototype.html', allocation, depth,
  validation: report.validation, width, proposedHeight }, null, 2));
