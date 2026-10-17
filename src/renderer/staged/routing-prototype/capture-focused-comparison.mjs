// THROWAWAY third prototype. Run from the repo root after pnpm build.
// Reuses captures; never reruns the expensive failing routing pipeline.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { allocateOrderedPortPair, orderedPortPairHasTraversal } from '../../../../dist/renderer/staged/routingCore/orderedPortPair.js';
import { validateFinalRouteSet } from '../../../../dist/renderer/staged/routingCore/lifecycle.js';
import { DEFAULT_ROUTING_POLICY } from '../../../../dist/renderer/staged/routingCore/contracts.js';
import { readablePortPitch, readableRoutingClearance } from '../../../../dist/renderer/staged/routingCore/bounds.js';
import { buildPortCorridorSeed } from '../../../../dist/renderer/staged/routingCore/candidates.js';
import { compareRouteCosts, routeCost } from '../../../../dist/renderer/staged/routingCore/optimization.js';
import { assessConnectorLabels, auditConnectorLabels } from '../../../../dist/renderer/staged/connectorLabelLayout.js';
import { FIXED_LABEL_DISTANCE } from '../../../../dist/renderer/staged/connectorLabelPlacement.js';
import { auditPositionedSceneMarkers, buildEndpointMarkerRoutingBlockers } from '../../../../dist/renderer/staged/markerAudit.js';
import { auditIaPlaceMapFinalScene } from '../../../../dist/renderer/staged/iaPlaceMapRouting.js';
import { arrowMarkerFootprintBox } from '../../../../dist/renderer/staged/markerGeometry.js';
import { renderPositionedSceneToSvg } from '../../../../dist/renderer/staged/svgBackend.js';

const dir = new URL('./', import.meta.url);
const referencePath = 'docs/ia_place_map_hardening/manual_review_2_evidence/self-loop.compact';
const referenceText = await readFile(new URL(`../../../../${referencePath}.json`, dir), 'utf8');
const reference = JSON.parse(referenceText);
const referenceSvg = await readFile(new URL(`../../../../${referencePath}.svg`, dir), 'utf8');
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
const pitch = readablePortPitch(seed.arrowSize, seed.strokeWidth);
const clearance = readableRoutingClearance(seed.strokeWidth);
const bottom = node.y + node.height;

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
const fixedConnectors = captures.diagram.sequence.edges.map((edge, index) => completeConnector(edge, pairEdges, index));
const fixedEdges = fixedConnectors.map(connector => {
  const fragments = pairEdges.filter(edge => edge.id === connector.id || edge.id.startsWith(`${connector.id}:return:`));
  return { ...fragments[0], id: connector.id, to: fragments.at(-1).to, route: connector.route,
    markers: fragments.at(-1).markers, label: fragments.find(edge => edge.label)?.label };
});
const box = ({ id, x, y, width, height }) => ({ id, x, y, width, height });
const owner = find(named.root, 'scope:P-360005333058');
const baseBounds = { minX: owner.x, minY: nodes[0].y - 149.5,
  maxX: owner.x + owner.width, maxY: owner.y + owner.height };
const searchBudget = { candidates: 4096 };

// These two prototype trials implement the user's requested comparison, not a
// production UI Contracts policy. Both start from the same frozen geometry.
// Shared pitch and clearance determine the loop; its label sits OUTSIDE it.
function assessSide(side, preference) {
  const occupied = fixedConnectors.flatMap(connector => [connector.source, connector.target])
    .filter(endpoint => endpoint.nodeId === node.id && endpoint.side === side);
  const arrivals = fixedConnectors.map(connector => connector.target)
    .filter(endpoint => endpoint.nodeId === node.id && endpoint.side === side);
  const allocation = allocateOrderedPortPair({ sideLength: node.width, minInset: minimumLeg,
    minSeparation: pitch, direction: 'negative',
    placement: side === 'south' ? 'before_other_arrivals' : 'nearest_feasible',
    occupiedOffsets: occupied.map(endpoint => endpoint.point.x - node.x),
    otherArrivalOffsets: arrivals.map(endpoint => endpoint.point.x - node.x) });
  if (!allocation) return { side, accepted: false, reason: 'No reserved port capacity' };
  const y = side === 'south' ? bottom : node.y;
  const source = { nodeId: node.id, side, minLeg: minimumLeg,
    point: { x: node.x + allocation.departure, y } };
  const target = { nodeId: node.id, side, minLeg: minimumLeg,
    point: { x: node.x + allocation.arrival, y } };
  const connector = { id: loopSemantic.id, priority: fixedConnectors.length, source, target,
    route: { style: 'orthogonal', points: [] } };
  connector.route = buildPortCorridorSeed(connector, clearance);
  assert(connector.route);
  const rail = connector.route.points[1].y;
  const label = { ...structuredClone(loopSemantic.label),
    x: (source.point.x + target.point.x - loopSemantic.label.width) / 2,
    y: side === 'south' ? rail + FIXED_LABEL_DISTANCE : rail - FIXED_LABEL_DISTANCE - loopSemantic.label.height };
  const loop = { id: connector.id, role: 'transition', classes: [], paintGroup: 'edges',
    from: { itemId: node.id, portId: `prototype-loop-${side}-departure`, ...source.point },
    to: { itemId: node.id, portId: `prototype-loop-${side}-arrival`, ...target.point },
    route: connector.route, label, markers: { end: 'arrow' } };
  // Record the exterior capacity demand, rather than hiding it in a larger crop.
  // Only the trial's outward side can grow; cards and fixed routes never move.
  const bounds = { ...baseBounds,
    minY: side === 'north' ? Math.min(baseBounds.minY, label.y - clearance) : baseBounds.minY,
    maxY: side === 'south' ? Math.max(baseBounds.maxY, label.y + label.height + clearance) : baseBounds.maxY };
  const scene = { ...failure, diagnostics: [], decorations: [], edges: [...fixedEdges, loop],
    root: { ...failure.root, x: bounds.minX, y: bounds.minY,
      width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY, children: nodes } };
  const input = { scene, expectedLabels: new Map(scene.edges.filter(edge => edge.label).map(edge => [edge.id, edge.label])),
    searchConnectorIds: new Set([loop.id]), rejectAmbiguousAssociation: true,
    requireAdjacentLabels: true, eventBasedHorizontalSearch: true,
    unrelatedRouteClearance: clearance, searchBudget };
  const placement = assessConnectorLabels(input);
  loop.label = placement.labels.get(loop.id);
  const labelProblems = auditConnectorLabels(input).problems;
  const connectors = [...fixedConnectors, connector];
  const labels = scene.edges.filter(edge => edge.label).map(edge => ({ id: edge.id, ...edge.label }));
  const context = { connectors, boxes: nodes.map(box),
    blockers: [...labels.map(label => ({ ...box(label), id: `label:${label.id}`, clearance: seed.strokeWidth / 2 })),
      ...buildEndpointMarkerRoutingBlockers(connectors, new Map(scene.edges.map(edge => [edge.id, edge.markers])), seed.arrowSize, seed.strokeWidth)],
    bounds, policy: { ...DEFAULT_ROUTING_POLICY, crossingTreatment: 'forbid' } };
  const violations = validateFinalRouteSet(context);
  const markerProblems = auditPositionedSceneMarkers(scene, { unrelatedRouteClearance: clearance });
  const enlargement = bounds.maxY - baseBounds.maxY + baseBounds.minY - bounds.minY;
  const [crossings, bends, length] = routeCost(connectors);
  return { side, allocation, source, target, loop, context, labels, bounds, enlargement,
    violations, labelProblems, markerProblems,
    accepted: !violations.length && !labelProblems.length && !markerProblems.length,
    cost: [crossings, bends, enlargement, preference, length] };
}
const trials = ['south', 'north'].map(assessSide);
const chosen = trials.filter(trial => trial.accepted).sort((a, b) => compareRouteCosts(a.cost, b.cost))[0];
assert(chosen, 'Stop: neither compact side trial passes with the captured working pair fixed.');
const { allocation, source, target, loop, context, labels, bounds, violations } = chosen;
const { connectors } = context;
const depth = Math.abs(loop.route.points[1].y - source.point.y);
assert.equal(allocation.departure - allocation.arrival, pitch);
assert.equal(depth, clearance);
const referencePoints = reference.edges.find(edge => edge.from.itemId === edge.to.itemId).route.points;
assert.equal(referencePoints[0].x - referencePoints.at(-1).x, pitch);
assert.equal(Math.abs(referencePoints[0].y - referencePoints[1].y), depth);
const referenceFindings = auditIaPlaceMapFinalScene(reference);
assert.deepEqual(referenceFindings, []);
assert(orderedPortPairHasTraversal(source.point.x, target.point.x, 'negative'));
assert(orderedPortPairHasTraversal(loop.route.points[1].x, loop.route.points[2].x, 'negative'));
assert.equal(source.side, target.side);
assert.equal(source.point.y, chosen.side === 'south' ? bottom : node.y);
assert.equal(target.point.y, source.point.y);
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
const proposedHeight = bounds.maxY - baseBounds.minY;
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
    caption: `Compact backward loop on the ${chosen.side === 'south' ? 'bottom' : 'top'} edge, with its full label outside.`,
    status: `Routes, labels and markers pass. Forward/back pair unchanged.`,
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
  question: 'Can the existing compact-loop construction coexist with the fixed working DG-002 pair?',
  verdict: 'Compact loop accepted for this captured region. Full-sheet capacity/reflow and arbitrary graphs are not established.',
  sources: { captures: { path: 'evidence.json', sha256: sha256(evidenceText) },
    visualReference: { path: `${referencePath}.svg`, sha256: sha256(referenceSvg),
      positionedSceneSha256: sha256(referenceText), connectorCount: reference.edges.length, findings: referenceFindings },
    namedSvg: { path: 'dg002.svg', sha256: sha256(namedSvg) }, document: evidence.provenance.source,
    documentSha256: evidence.provenance.sourceSha256 },
  allocation, depth, pitch, clearance, selectedSide: chosen.side, enlargement: chosen.enlargement,
  trials: trials.map(({ side, allocation, enlargement, cost, accepted, violations, labelProblems, markerProblems }) =>
    ({ side, allocation, enlargement, cost, accepted, violations, labelProblems, markerProblems })),
  context, labels, markerBoxes,
  validation: { completeRouteViolations: violations, labelMarkerConflicts: clearanceIssues,
    labelAssociationProblems: chosen.labelProblems, markerProblems: chosen.markerProblems,
    sameSide: true, negativeTraversal: true, pairUnchanged: true, cardDimensionsUnchanged: true },
  crop: { translation: { dx, dy }, width, heights: [243, 227, proposedHeight], unitsPerPixel: 1 },
  artifactSha256: sha256(html)
};
await writeFile(new URL('focused-comparison-prototype.html', dir), html);
await writeFile(new URL('focused-comparison-evidence.json', dir), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: 'focused-comparison-prototype.html', allocation, depth,
  selectedSide: chosen.side, trials: report.trials, validation: report.validation, width, proposedHeight }, null, 2));
