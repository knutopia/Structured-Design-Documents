/** Independent semantic, geometric and artifact verification of two editorial proofs. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.SDD_REPO ?? path.resolve(directory, '../..');
const sourcePath = process.env.AEB_SDD_SOURCE ?? '/home/knut/projects/aeb_sdd/aeb_help_center_de.sdd';
const importRuntime = (relative) => import(pathToFileURL(path.join(repoRoot, relative)).href);
// Deliberately do not import common.mjs or either figure implementation.
const [runtime, ia, themes] = await Promise.all([
  importRuntime('dist/index.js'), importRuntime('dist/renderer/iaPlaceMapRenderModel.js'),
  importRuntime('dist/renderer/staged/theme.js'),
]);
const require = createRequire(path.join(repoRoot, 'package.json'));
const fontkit = require('fontkit');
const { Resvg } = require('@resvg/resvg-js');
const theme = themes.getRendererTheme('default');
const fontCache = new Map();
const measure = (text, weight, size, spacing = 0) => {
  if (!fontCache.has(weight)) {
    const face = theme.fontFaces.find((face) => face.fontWeight === weight);
    assert.ok(face, `No vendored font face for weight ${weight}`);
    fontCache.set(weight, fontkit.openSync(face.measurementFontAssetPath));
  }
  const font = fontCache.get(weight);
  const layout = font.layout(text);
  return layout.positions.reduce((sum, position) => sum + position.xAdvance, 0) * size / font.unitsPerEm
    + Math.max(0, layout.glyphs.length - 1) * spacing;
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const originalBytes = await readFile(sourcePath);
const bundle = await runtime.loadBundle(path.join(repoRoot, 'bundle/v0.2/manifest.yaml'));
const compilation = runtime.compileSource({ path: sourcePath, text: originalBytes.toString('utf8') }, bundle);
assert.deepEqual(compilation.diagnostics, [], 'Original source compilation diagnostics');
const validation = runtime.validateGraph(compilation.graph, bundle, 'simple');
assert.deepEqual(validation.diagnostics, [], 'Original source Simple validation diagnostics');
const EPS = 0.002;
const close = (a, b) => Math.abs(a - b) <= EPS;
const eqPoint = (a, b) => close(a.x, b.x) && close(a.y, b.y);
const norm = (text) => text.trim().replace(/\s+/gu, ' ');
const inside = (p, box) => p.x > box.x + EPS && p.x < box.x + box.width - EPS
  && p.y > box.y + EPS && p.y < box.y + box.height - EPS;
const within = (inner, outer) => inner.x >= outer.x - EPS && inner.y >= outer.y - EPS
  && inner.x + inner.width <= outer.x + outer.width + EPS
  && inner.y + inner.height <= outer.y + outer.height + EPS;
const overlap = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > EPS
  && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > EPS;
const segments = (edge) => edge.points.slice(1).map((to, i) => ({ from: edge.points[i], to, edge, index: i }));
const horizontal = (s) => close(s.from.y, s.to.y);
const interval = (a, b) => [Math.min(a, b), Math.max(a, b)];
const rangeIncludes = (range, value) => value >= range[0] - EPS && value <= range[1] + EPS;
// Includes both positive-length collinear overlap and point crossings/touches.
function segmentIntersection(a, b) {
  const ah = horizontal(a), bh = horizontal(b);
  if (ah === bh) {
    const fixedA = ah ? a.from.y : a.from.x;
    const fixedB = bh ? b.from.y : b.from.x;
    if (!close(fixedA, fixedB)) return null;
    const ar = interval(ah ? a.from.x : a.from.y, ah ? a.to.x : a.to.y);
    const br = interval(bh ? b.from.x : b.from.y, bh ? b.to.x : b.to.y);
    const length = Math.min(ar[1], br[1]) - Math.max(ar[0], br[0]);
    return length > EPS ? 'collinear overlap' : length >= -EPS ? 'touch' : null;
  }
  const h = ah ? a : b, v = ah ? b : a;
  return rangeIncludes(interval(h.from.x, h.to.x), v.from.x)
    && rangeIncludes(interval(v.from.y, v.to.y), h.from.y) ? 'crossing' : null;
}
function segmentInBox(segment, box) {
  if (horizontal(segment)) {
    return segment.from.y > box.y + EPS && segment.from.y < box.y + box.height - EPS
      && Math.min(Math.max(segment.from.x, segment.to.x), box.x + box.width)
      - Math.max(Math.min(segment.from.x, segment.to.x), box.x) > EPS;
  }
  return segment.from.x > box.x + EPS && segment.from.x < box.x + box.width - EPS
    && Math.min(Math.max(segment.from.y, segment.to.y), box.y + box.height)
    - Math.max(Math.min(segment.from.y, segment.to.y), box.y) > EPS;
}
function onBoundary(p, box) {
  return !inside(p, box) && p.x >= box.x - EPS && p.x <= box.x + box.width + EPS
    && p.y >= box.y - EPS && p.y <= box.y + box.height + EPS
    && (close(p.x, box.x) || close(p.x, box.x + box.width)
      || close(p.y, box.y) || close(p.y, box.y + box.height));
}
const decode = (text) => text.replace(/&quot;/gu, '"').replace(/&gt;/gu, '>').replace(/&lt;/gu, '<').replace(/&amp;/gu, '&');
const textLines = (xml) => [...xml.matchAll(/<tspan\b[^>]*>([^<]*)<\/tspan>/gu)].map((m) => decode(m[1]));
const xmlAttribute = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function svgGroup(svg, attribute, value) {
  const attributeText = `${attribute}="${xmlAttribute(value)}"`;
  const attributeIndex = svg.indexOf(attributeText);
  assert.ok(attributeIndex >= 0, `Missing SVG ${attribute}=${value}`);
  const start = svg.lastIndexOf('<g', attributeIndex);
  assert.ok(start >= 0 && !svg.slice(start, attributeIndex).includes('>'), `Attribute outside a group: ${attribute}=${value}`);
  const end = svg.indexOf('</g>', start);
  assert.ok(end > start, `Unclosed SVG group ${value}`);
  return svg.slice(start, end + 4);
}
function assertArrayEqual(actual, expected, message) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), message);
}
// A verifier that misses collinear overlap cannot establish the route invariant.
assert.equal(segmentIntersection({ from: { x: 0, y: 0 }, to: { x: 20, y: 0 } },
  { from: { x: 10, y: 0 }, to: { x: 30, y: 0 } }), 'collinear overlap');
assert.equal(segmentIntersection({ from: { x: 0, y: 0 }, to: { x: 20, y: 0 } },
  { from: { x: 10, y: -10 }, to: { x: 10, y: 10 } }), 'crossing');
assert.equal(segmentInBox({ from: { x: 10, y: -10 }, to: { x: 10, y: 30 } },
  { x: 0, y: 0, width: 20, height: 20 }), true);

const cases = [
  { number: '02', id: 'DG-011', uniqueNodes: 8, occurrences: 9, edges: 7 },
  { number: '08', id: 'DG-026', uniqueNodes: 5, occurrences: 5, edges: 4 },
];
async function artifacts() {
  const map = new Map();
  for (const item of cases) for (const extension of ['svg', 'png', 'geometry.json']) {
    const filename = `figure-${item.number}-places-flow.${extension}`;
    map.set(filename, await readFile(path.join(directory, filename)));
  }
  return map;
}
function generate() {
  for (const item of cases) {
    const result = spawnSync(process.execPath, [path.join(directory, `figure-${item.number}.mjs`)], {
      cwd: repoRoot, encoding: 'utf8', env: { ...process.env, TMPDIR: '/tmp', SDD_REPO: repoRoot, AEB_SDD_SOURCE: sourcePath },
    });
    assert.equal(result.status, 0, `Figure ${item.number} regeneration failed: ${result.stderr}\n${result.stdout}`);
  }
}
// Regeneration is part of verification: two independent processes must emit identical bytes.
generate();
const first = await artifacts();
generate();
const second = await artifacts();
for (const [name, bytes] of first) assert.ok(bytes.equals(second.get(name)), `Non-deterministic ${name}`);
const evidence = {
  source: { path: sourcePath, sha256: hash(originalBytes), validationProfile: 'simple', diagnostics: [] },
  independentVerifier: 'verify.mjs imports existing SDD runtime and fontkit; neither editorial painter nor figure modules are imported.',
  determinism: { executions: 2, svgPngAndGeometryByteIdentical: true },
  figures: [],
  visualReview: { status: 'required', limitation: 'Automated geometry checks do not judge balance, reading effort or text appearance. Inspect index.html at report width and both PNGs before visual acceptance.' },
};
for (const item of cases) {
  const basename = `figure-${item.number}-places-flow`;
  const geometry = JSON.parse(second.get(`${basename}.geometry.json`).toString('utf8'));
  const svg = second.get(`${basename}.svg`).toString('utf8');
  const png = second.get(`${basename}.png`);
  const result = runtime.projectView(compilation.graph, bundle, 'ia_place_map', { diagramId: item.id });
  assert.deepEqual(result.diagnostics, [], `Projection diagnostics for ${item.id}`);
  const projection = result.projection;
  const view = bundle.views.views.find((view) => view.id === projection.view_id);
  const config = view.conventions.renderer_defaults.ia_place_map;
  const model = ia.buildIaPlaceMapRenderModel(projection, compilation.graph, view.projection.hierarchy_edges ?? [],
    runtime.resolveDetailDisplayPolicy(view, 'compact'), config, 'compact', ia.resolveIaPlaceMapRelationshipRuntime(bundle, config));
  const expectedNodes = projection.nodes;
  const expectedEdges = model.edges;
  assert.equal(geometry.diagramId, item.id);
  assert.equal(geometry.sourceHash, hash(originalBytes));
  assert.equal(expectedNodes.length, item.uniqueNodes);
  assert.equal(expectedEdges.length, item.edges);
  assert.equal(geometry.nodes.length, item.occurrences);
  assert.equal(geometry.edges.length, item.edges);
  assert.equal(geometry.labels.length, item.edges);
  assertArrayEqual(new Set(geometry.nodes.map((node) => node.id)), expectedNodes.map((node) => node.id), 'Exact selected Place coverage');
  assert.equal(new Set(geometry.nodes.map((node) => node.occurrenceId)).size, item.occurrences);
  assertArrayEqual(geometry.edges.map((edge) => edge.sourceEdgeId), projection.edges.map((edge) => edge.source_edge_id), 'Exact source-edge occurrence coverage');
  assertArrayEqual(geometry.edges.map((edge) => edge.id), expectedEdges.map((edge) => edge.id), 'Exact IA navigation occurrence coverage');
  const canvas = { x: 0, y: 0, width: geometry.width, height: geometry.height };
  for (const node of geometry.nodes) {
    const expected = expectedNodes.find((expected) => expected.id === node.id);
    assert.equal(node.title, expected.name, `Title ${node.id}`);
    assert.equal(node.kind, expected.type, `Decorator kind ${node.id}`);
    assert.equal(norm(node.lines.join(' ')), norm(expected.name), `Whitespace-only full-title wrapping ${node.id}`);
    assert.equal(node.titleFontSize, 16, `Readable title font ${node.id}`);
    assert.ok(within(node, canvas), `Node clipped by viewport: ${node.id}`);
    assert.ok(within(node.titleBox, node), `Title box clipped by node: ${node.id}`);
    const style = theme.textStyles[theme.sharedNode.titleTextStyleRole];
    for (const line of node.lines) assert.ok(measure(line, style.fontWeight, node.titleFontSize, style.letterSpacing ?? 0) <= node.titleBox.width + EPS, `Title overflow: ${node.id}: ${line}`);
    for (const word of node.title.split(/\s+/u)) assert.ok(measure(word, style.fontWeight, node.titleFontSize, style.letterSpacing ?? 0) <= node.titleBox.width + EPS, `Word cannot fit: ${word}`);
    for (const box of node.textBoxes) assert.ok(within(box, node.titleBox), `Clipped title line: ${node.id}`);
    for (const box of node.decoratorTextBoxes) assert.ok(within(box, node), `Clipped decorator: ${node.id}`);
    for (const [i, box] of node.decoratorTextBoxes.entries()) for (const other of node.decoratorTextBoxes.slice(i + 1)) assert.ok(!overlap(box, other), `Overlapping decorators: ${node.id}`);
    const visible = textLines(svgGroup(svg, 'data-occurrence-id', node.occurrenceId));
    assert.deepEqual(visible, [node.kind, node.id, ...node.lines], `Visible SVG node content ${node.id}`);
  }
  for (const [i, node] of geometry.nodes.entries()) for (const other of geometry.nodes.slice(i + 1)) assert.ok(!overlap(node, other), `Overlapping nodes: ${node.id}, ${other.id}`);
  for (const edge of geometry.edges) {
    const expected = expectedEdges.find((expected) => expected.id === edge.id);
    assert.equal(edge.source, expected.from, `Source ${edge.id}`);
    assert.equal(edge.target, expected.to, `Target ${edge.id}`);
    assert.equal(edge.label, expected.label ?? '', `Full event ${edge.id}`);
    const source = geometry.nodes.find((node) => node.occurrenceId === edge.sourceOccurrenceId);
    const target = geometry.nodes.find((node) => node.occurrenceId === edge.targetOccurrenceId);
    assert.equal(source?.id, edge.source); assert.equal(target?.id, edge.target);
    assert.ok(edge.points.length >= 2);
    assert.ok(onBoundary(edge.points[0], source), `Source endpoint ${edge.id}`);
    assert.ok(onBoundary(edge.points.at(-1), target), `Target endpoint ${edge.id}`);
    const route = segments(edge);
    for (const segment of route) {
      assert.ok(!eqPoint(segment.from, segment.to), `Zero-length route segment ${edge.id}`);
      assert.ok(horizontal(segment) || close(segment.from.x, segment.to.x), `Non-orthogonal route ${edge.id}`);
      for (const node of geometry.nodes) assert.ok(!segmentInBox(segment, node), `Edge intersects node: ${edge.id} / ${node.id}`);
    }
    for (const [i, segment] of route.entries()) for (const other of route.slice(i + 2)) assert.equal(segmentIntersection(segment, other), null, `Route self-intersection ${edge.id}`);
    const label = geometry.labels.find((label) => label.edgeId === edge.id);
    assert.equal(label.text, edge.label);
    assert.equal(norm(label.lines.join(' ')), norm(edge.label));
    assert.ok(within(label, canvas), `Clipped event capsule ${edge.id}`);
    const labelStyle = theme.textStyles.edge_label;
    const padding = theme.nodePrimitives.edge_label.padding;
    for (const line of label.lines) assert.ok(measure(line, labelStyle.fontWeight, label.fontSize, labelStyle.letterSpacing ?? 0) <= label.width - padding.left - padding.right + EPS, `Event label overflow ${edge.id}`);
    for (const box of label.textBoxes) assert.ok(within(box, label), `Clipped label text ${edge.id}`);
    assert.deepEqual(textLines(svgGroup(svg, 'data-label-edge-id', edge.id)), label.lines, `Visible full event ${edge.id}`);
    for (const node of geometry.nodes) assert.ok(!overlap(label, node), `Event capsule intersects node: ${edge.id} / ${node.id}`);
    const polyline = [...svg.matchAll(/<polyline\b[^>]*>/gu)].find((match) => match[0].includes(`data-edge-id="${xmlAttribute(edge.id)}"`))?.[0];
    assert.ok(polyline?.includes('marker-end="url(#arrow)"'), `Missing terminal arrow ${edge.id}`);
    const points = /\bpoints="([^"]*)"/u.exec(polyline)?.[1].split(' ').map((pair) => { const [x, y] = pair.split(',').map(Number); return { x, y }; });
    assert.equal(points.length, edge.points.length);
    points.forEach((point, i) => assert.ok(eqPoint(point, edge.points[i]), `SVG route differs from checked geometry ${edge.id}`));
  }
  const allSegments = geometry.edges.flatMap(segments);
  for (const [i, segment] of allSegments.entries()) for (const other of allSegments.slice(i + 1)) if (segment.edge !== other.edge) assert.equal(segmentIntersection(segment, other), null, `Routes ${segment.edge.id} and ${other.edge.id} intersect`);
  for (const [i, label] of geometry.labels.entries()) {
    for (const other of geometry.labels.slice(i + 1)) assert.ok(!overlap(label, other), `Event capsules overlap: ${label.edgeId}, ${other.edgeId}`);
    for (const segment of allSegments) if (segment.edge.id !== label.edgeId) assert.ok(!segmentInBox(segment, label), `Event capsule intersects another route: ${label.edgeId}, ${segment.edge.id}`);
  }
  for (const text of geometry.texts) {
    assert.ok(within(text, canvas), `Editorial text clipped: ${text.text}`);
    for (const node of geometry.nodes) assert.ok(!overlap(text, node), `Editorial text intersects node: ${text.text}`);
    for (const label of geometry.labels) assert.ok(!overlap(text, label), `Editorial text intersects event: ${text.text}`);
    for (const segment of allSegments) assert.ok(!segmentInBox(segment, text), `Editorial text intersects route: ${text.text}`);
  }
  assert.ok(svg.includes('markerUnits="userSpaceOnUse" orient="auto"'), 'Arrowheads must follow terminal segment direction');
  assert.ok(svg.includes('src:url(data:font/woff;base64,'), 'Portable embedded vendored font');
  assert.ok(!/url\((?:https?:|file:)/u.test(svg), 'External SVG resources');
  assert.ok(!svg.includes('\r'), 'SVG uses canonical LF newlines');
  const rerasterized = new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: theme.fontFaces.map((face) => face.pngFontAssetPath), defaultFontFamily: theme.fontFamily }, fitTo: { mode: 'zoom', value: 2 } }).render().asPng();
  assert.ok(png.equals(rerasterized), 'PNG is derived directly from saved SVG with vendored fonts');
  assert.equal(png.readUInt32BE(16), geometry.width * 2);
  assert.equal(png.readUInt32BE(20), geometry.height * 2);
  if (item.number === '02') {
    assert.equal(geometry.nodes.filter((node) => node.id === 'P-001').length, 2, 'Only Home repeats');
    assert.equal(new Set(geometry.nodes.map((node) => node.x)).size, 2, 'Two distinct aligned columns');
    assertArrayEqual([...new Set(geometry.nodes.map((node) => node.x))].map((x) => geometry.nodes.filter((node) => node.x === x).length), [5, 4], 'Product and glossary route lengths');
    for (const edge of geometry.edges) {
      assert.equal(edge.points.length, 2, 'Figure 2 arrows stay straight');
      assert.ok(close(edge.points[0].x, edge.points[1].x) && edge.points[1].y > edge.points[0].y, 'Figure 2 reads downward');
    }
  } else {
    const topic = geometry.nodes.find((node) => node.id === 'P-6348376033553');
    const branches = geometry.edges.filter((edge) => edge.source === topic.id);
    assert.equal(branches.length, 3, 'Three alternatives');
    assert.equal(new Set(branches.map((edge) => edge.points[0].y)).size, 3, 'Distinct outgoing topic ports');
    const terminals = branches.map((edge) => geometry.nodes.find((node) => node.id === edge.target));
    assert.equal(new Set(terminals.map((node) => node.x)).size, 1, 'Aligned destination column');
    assert.equal(terminals.toSorted((a, b) => a.y - b.y).at(-1).id, 'P-005', 'Sign-in is the final alternative');
    for (const edge of geometry.edges) assert.ok(edge.points.at(-1).x > edge.points[0].x, 'Figure 8 reads left to right');
  }
  evidence.figures.push({ figure: Number(item.number), diagramId: item.id, uniquePlaces: item.uniqueNodes,
    displayedPlaceOccurrences: geometry.nodes.length, exactNavigationOccurrences: geometry.edges.length,
    viewBox: { width: geometry.width, height: geometry.height },
    checks: { exactIdentityTitleAndEventCoverage: true, whitespaceOnlyWrapping: true, independentlyMeasuredTextFits: true,
      routeCrossings: 0, collinearOverlaps: 0, routeNodeIntersections: 0, crossRouteLabelIntersections: 0,
      labelNodeIntersections: 0, clippedTextBoxes: 0, exactEndpointAttachmentAndTerminalArrows: true,
      pngDerivedFromSvg: true, embeddedVendoredFonts: true },
    artifacts: Object.fromEntries(['svg', 'png', 'geometry.json'].map((extension) => [extension, { file: `${basename}.${extension}`, sha256: hash(second.get(`${basename}.${extension}`)) }])) });
}
const html = await readFile(path.join(directory, 'index.html'), 'utf8');
const linkedFiles = [...html.matchAll(/(?:src|href)="([^"]+)"/gu)].map((match) => match[1]);
assert.equal(linkedFiles.length, 6, 'Review page has two images and four downloads');
for (const linked of linkedFiles) {
  assert.ok(!linked.includes('/') && /^figure-(?:02|08)-places-flow\.(?:svg|png)$/u.test(linked), `Review link must be a local artifact: ${linked}`);
  await readFile(path.join(directory, linked));
}
assert.ok(html.includes('.picture{margin:26px auto 20px;text-align:center;overflow:auto}'));
assert.ok(html.includes('.figure-two img{min-width:650px}.figure-eight img{min-width:1040px}'));
evidence.reviewPage = { localImageAndDownloadLinks: true, responsiveReadability: '800px Figure 2 and1200px Figure 8 maximum widths;650px and1040px minimum image widths with horizontal scrolling', browserTested: false };
try {
  const review = JSON.parse(await readFile(path.join(directory, 'visual-review.json'), 'utf8'));
  const hashesMatch = evidence.figures.every((figure) => ['svg', 'png'].every((extension) => review.artifactHashes?.[figure.artifacts[extension].file] === figure.artifacts[extension].sha256));
  evidence.visualReview = hashesMatch ? review : { status: 'required', limitation: 'Saved visual review does not match the current SVG/PNG artifact hashes.' };
} catch (error) { if (error.code !== 'ENOENT') throw error; }
assert.ok(originalBytes.equals(await readFile(sourcePath)), 'Original source changed during verification');
await writeFile(path.join(directory, 'verification.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Verified both original projections, semantic fidelity, geometry, font metrics, endpoint arrows, local review links and two deterministic SVG/PNG generations. Visual review: ${evidence.visualReview.status}.`);
