/** One-off editorial painter. Semantic data stays in the loaded SDD projection. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const outputDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = process.env.SDD_REPO ?? path.resolve(outputDirectory, '../..');
export const sourcePath = process.env.AEB_SDD_SOURCE ?? '/home/knut/projects/aeb_sdd/aeb_help_center_de.sdd';
const fromRepo = (relative) => import(pathToFileURL(path.join(repoRoot, relative)).href);
const [runtime, iaRuntime, themeRuntime, measurementRuntime] = await Promise.all([
  fromRepo('dist/index.js'), fromRepo('dist/renderer/iaPlaceMapRenderModel.js'),
  fromRepo('dist/renderer/staged/theme.js'), fromRepo('dist/renderer/staged/textMeasurement.js'),
]);
const require = createRequire(path.join(repoRoot, 'package.json'));
const { Resvg } = require('@resvg/resvg-js');
export const theme = themeRuntime.getRendererTheme('default');
const measurement = measurementRuntime.createTextMeasurementService(theme.fontFaces);
const titleStyle = theme.textStyles[theme.sharedNode.titleTextStyleRole];
const decoratorStyle = theme.textStyles[theme.sharedNode.decorator.textStyleRole];
const labelStyle = theme.textStyles.edge_label;
let documentPromise;

async function loadDocument() {
  const [bundle, source] = await Promise.all([
    runtime.loadBundle(path.join(repoRoot, 'bundle/v0.2/manifest.yaml')),
    readFile(sourcePath, 'utf8'),
  ]);
  const compiled = runtime.compileSource({ path: sourcePath, text: source }, bundle);
  if (!compiled.graph || compiled.diagnostics.some((d) => d.severity === 'error')) {
    throw new Error(JSON.stringify(compiled.diagnostics));
  }
  return { bundle, graph: compiled.graph, sourceHash: createHash('sha256').update(source).digest('hex') };
}

export async function loadDiagram(id) {
  documentPromise ??= loadDocument();
  const { bundle, graph, sourceHash } = await documentPromise;
  const result = runtime.projectDiagram(graph, bundle, id);
  if (!result.projection || result.diagnostics.some((d) => d.severity === 'error')) {
    throw new Error(JSON.stringify(result.diagnostics));
  }
  const projection = result.projection;
  const view = bundle.views.views.find((v) => v.id === projection.view_id);
  const rendererConfig = view.conventions.renderer_defaults.ia_place_map;
  const model = iaRuntime.buildIaPlaceMapRenderModel(
    projection, graph, view.projection.hierarchy_edges ?? [],
    runtime.resolveDetailDisplayPolicy(view, 'compact'), rendererConfig, 'compact',
    iaRuntime.resolveIaPlaceMapRelationshipRuntime(bundle, rendererConfig),
  );
  const nodes = [];
  const collect = (items) => items.forEach((item) => {
    if (item.kind === 'place') nodes.push({ id: item.id, title: item.title, kind: 'Place' });
    collect(item.items);
  });
  collect(model.rootItems);
  const edges = model.edges.map((e) => ({
    id: e.id, source: e.from, target: e.to, label: e.label ?? '', sourceEdgeId: e.source_edge_id,
  }));
  return { id, nodes, edges, projection, sourcePath, sourceHash };
}

export const measureText = (text, style = titleStyle) => measurement.measureText(text, style);
function wrap(text, maxWidth, style) {
  const words = text.split(/\s+/u).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (measureText(word, style) > maxWidth) throw new Error(`Unbreakable word exceeds ${maxWidth}px: ${word}`);
    const candidate = line ? `${line} ${word}` : word;
    if (line && measureText(candidate, style) > maxWidth) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}
export function measureNode(node, width = 336) {
  const shared = theme.sharedNode;
  const lines = wrap(node.title, width - shared.body.padding.left - shared.body.padding.right, titleStyle);
  return { width, height: Math.max(shared.minHeight, shared.decorator.height + shared.body.padding.top
    + lines.length * titleStyle.lineHeight + shared.body.padding.bottom), lines };
}
export function measureLabel(text, maxWidth = 240) {
  const padding = theme.nodePrimitives.edge_label.padding;
  const lines = wrap(text, maxWidth - padding.left - padding.right, labelStyle);
  return { width: Math.ceil(Math.max(0, ...lines.map((line) => measureText(line, labelStyle)))) + padding.left + padding.right,
    height: Math.max(theme.nodePrimitives.edge_label.minHeight, lines.length * labelStyle.lineHeight + padding.top + padding.bottom), lines };
}
const xml = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const num = (n) => String(Math.round(n * 1000) / 1000);
const box = (x, y, width, height) => ({ x, y, width, height });

export function createPainter({ diagram, width, height, title, description = '' }) {
  const geometry = { diagramId: diagram.id, width, height, title, description, sourcePath: diagram.sourcePath,
    sourceHash: diagram.sourceHash, themeId: theme.id, themeRevision: theme.revision,
    nodes: [], labels: [], edges: [], texts: [] };
  const layers = { edges: [], nodes: [], labels: [], texts: [] };
  function textBlock(lines, x, y, style, extra = '') {
    const baseline = measurementRuntime.calculateAlphabeticBaselineOffset(measurement.getVerticalMetrics(style), style.lineHeight);
    return `<text x="${num(x)}" y="${num(y + baseline)}" font-family="${xml(style.fontFamily)}" font-size="${style.fontSize}" font-weight="${style.fontWeight}" letter-spacing="${style.letterSpacing ?? 0}" fill="${theme.sharedNode.text}" ${extra}>`
      + lines.map((line, i) => `<tspan x="${num(x)}" dy="${i ? style.lineHeight : 0}">${xml(line)}</tspan>`).join('') + '</text>';
  }
  function lineBoxes(lines, x, y, style) {
    return lines.map((text, i) => ({ text, ...box(x, y + i * style.lineHeight, measureText(text, style), style.lineHeight) }));
  }
  return {
    geometry,
    placeNode({ id, occurrenceId = id, x, y, width: nodeWidth = 336 }) {
      const node = diagram.nodes.find((n) => n.id === id);
      if (!node) throw new Error(`Unknown Place ${id}`);
      const size = measureNode(node, nodeWidth);
      const s = theme.sharedNode;
      const titleX = x + s.body.padding.left;
      const titleY = y + s.decorator.height + s.body.padding.top;
      const decoratorX = x + s.decorator.padding.left;
      const decoratorY = y + (s.decorator.height - decoratorStyle.lineHeight) / 2;
      const decoratorIdX = decoratorX + measureText(node.kind, decoratorStyle) + s.decorator.gap;
      const titleBox = box(titleX, titleY, size.width - s.body.padding.left - s.body.padding.right, size.lines.length * titleStyle.lineHeight);
      const placed = { ...node, occurrenceId, x, y, ...size, titleFontSize: titleStyle.fontSize,
        titleLineHeight: titleStyle.lineHeight, titleInset: s.body.padding.left, titleBox,
        textBoxes: lineBoxes(size.lines, titleX, titleY, titleStyle),
        decoratorTextBoxes: [
          ...lineBoxes([node.kind], decoratorX, decoratorY, decoratorStyle),
          ...lineBoxes([id], decoratorIdX, decoratorY, decoratorStyle),
        ] };
      geometry.nodes.push(placed);
      const radius = s.cornerRadius;
      const clipId = `card-${geometry.nodes.length}`;
      const inset = s.strokeWidth / 2;
      layers.nodes.push(`<g data-node-id="${xml(id)}" data-occurrence-id="${xml(occurrenceId)}">`
        + `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${size.width}" height="${size.height}" rx="${radius}"/></clipPath></defs>`
        + `<rect x="${x}" y="${y}" width="${size.width}" height="${size.height}" rx="${radius}" fill="${s.fill}"/>`
        + `<rect x="${x}" y="${y}" width="${size.width}" height="${s.decorator.height}" fill="${s.decorator.fill}" clip-path="url(#${clipId})"/>`
        + textBlock([node.kind], decoratorX, decoratorY, decoratorStyle)
        + textBlock([id], decoratorIdX, decoratorY, decoratorStyle)
        + textBlock(size.lines, titleX, titleY, titleStyle)
        + `<rect x="${num(x + inset)}" y="${num(y + inset)}" width="${num(size.width - s.strokeWidth)}" height="${num(size.height - s.strokeWidth)}" rx="${num(radius - inset)}" fill="none" stroke="${s.stroke}" stroke-width="${s.strokeWidth}"/></g>`);
      return placed;
    },
    placeLabel({ edgeId, text, x, y, maxWidth = 240 }) {
      const semantic = diagram.edges.find((e) => e.id === edgeId);
      if (!semantic || text !== semantic.label) throw new Error(`Label must equal selected source label: ${edgeId}`);
      const size = measureLabel(text, maxWidth);
      const p = theme.nodePrimitives.edge_label.padding;
      const placed = { edgeId, text, x, y, ...size, fontSize: labelStyle.fontSize,
        textBoxes: lineBoxes(size.lines, x + p.left, y + p.top, labelStyle) };
      geometry.labels.push(placed);
      layers.labels.push(`<g data-label-edge-id="${xml(edgeId)}"><rect x="${x}" y="${y}" width="${size.width}" height="${size.height}" rx="${theme.paint.cornerRadii.node.edge_label}" fill="${theme.paint.palette.edgeLabelFill}" stroke="${theme.paint.palette.edgeLabelStroke}" stroke-width="${theme.paint.strokeWidth}"/>`
        + textBlock(size.lines, x + p.left, y + p.top, labelStyle) + '</g>');
      return placed;
    },
    edge({ id, sourceOccurrenceId, targetOccurrenceId, points }) {
      const semantic = diagram.edges.find((e) => e.id === id);
      if (!semantic) throw new Error(`Unknown selected edge ${id}`);
      geometry.edges.push({ ...semantic, sourceOccurrenceId, targetOccurrenceId, points });
      layers.edges.push(`<polyline data-edge-id="${xml(id)}" points="${points.map((p) => `${num(p.x)},${num(p.y)}`).join(' ')}" fill="none" stroke="${theme.paint.palette.edge}" stroke-width="${theme.paint.edgeStrokeWidth}" stroke-linejoin="round" marker-end="url(#arrow)"/>`);
    },
    text({ text, x, y, size = 16, weight = 600, color = theme.paint.palette.secondaryText }) {
      const style = { ...theme.textStyles.label, fontSize: size, fontWeight: weight, lineHeight: size * 1.25 };
      geometry.texts.push({ text, ...box(x, y, measureText(text, style), style.lineHeight), fontSize: size });
      layers.texts.push(`<g style="fill:${color}">` + textBlock([text], x, y, style, `style="fill:${color}"`) + '</g>');
    },
    async save(stem) {
      const outputStem = path.isAbsolute(stem) ? stem : path.join(outputDirectory, stem);
      await mkdir(path.dirname(outputStem), { recursive: true });
      const fontCss = await Promise.all(theme.fontFaces.map(async (face) => `@font-face{font-family:'${theme.fontFamily}';font-style:normal;font-weight:${face.fontWeight};src:url(data:font/woff;base64,${(await readFile(face.svgFontAssetPath)).toString('base64')}) format('woff');}`));
      for (const edge of geometry.edges) {
        const label = geometry.labels.find((l) => l.edgeId === edge.id);
        if (label) { edge.labelBox = box(label.x, label.y, label.width, label.height); edge.labelLines = label.lines; }
      }
      const a = theme.paint.arrowSize;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="figure-title figure-desc">\n<title id="figure-title">${xml(title)}</title>\n<desc id="figure-desc">${xml(description)}</desc>\n<defs><style>${fontCss.join('\n')}</style><marker id="arrow" viewBox="0 0 ${a} ${a}" refX="${a}" refY="${a / 2}" markerWidth="${a}" markerHeight="${a}" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0 L${a} ${a / 2} L0 ${a} Z" fill="${theme.paint.palette.edge}"/></marker></defs>\n<rect width="${width}" height="${height}" fill="#ffffff"/>\n${Object.values(layers).map((layer) => layer.join('\n')).join('\n')}\n</svg>\n`;
      const png = new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: theme.fontFaces.map((f) => f.pngFontAssetPath), defaultFontFamily: theme.fontFamily }, fitTo: { mode: 'zoom', value: 2 } }).render().asPng();
      await writeFile(`${outputStem}.svg`, svg);
      await writeFile(`${outputStem}.png`, png);
      await writeFile(`${outputStem}.geometry.json`, JSON.stringify(geometry, null, 2) + '\n');
      return { svg: `${outputStem}.svg`, png: `${outputStem}.png`, geometry: `${outputStem}.geometry.json` };
    },
  };
}
