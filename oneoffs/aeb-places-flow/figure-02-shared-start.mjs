/** DG-011 comparison: one shared Home, then two compact downward routes. */
import { loadDiagram, measureNode, measureLabel, createPainter, theme } from './common.mjs';

const diagram = await loadDiagram('DG-011');
const byId = new Map(diagram.nodes.map((node) => [node.id, node]));
const outgoing = (id) => diagram.edges.filter((edge) => edge.source === id);
const roots = diagram.nodes.filter((node) => !diagram.edges.some((edge) => edge.target === node.id));
if (roots.length !== 1) throw new Error('Shared-start Figure 2 requires one entry Place.');
const root = roots[0];
const routes = outgoing(root.id).map((first) => {
  const nodes = [byId.get(first.target)];
  const edges = [first];
  let next = outgoing(first.target);
  while (next.length) {
    if (next.length !== 1 || nodes.some((node) => node.id === next[0].target)) {
      throw new Error('Shared-start Figure 2 requires acyclic routes after the fork.');
    }
    edges.push(next[0]); nodes.push(byId.get(next[0].target)); next = outgoing(next[0].target);
  }
  return { nodes, edges };
}).sort((a, b) => b.nodes.length - a.nodes.length);
if (diagram.nodes.length !== 8 || diagram.edges.length !== 7 || routes.length !== 2
  || routes[0].nodes.length !== 4 || routes[1].nodes.length !== 3) {
  throw new Error('DG-011 membership changed; review the shared-start composition.');
}

const sizeFor = (node) => {
  try { return measureNode(node, theme.sharedNode.width); }
  catch (error) {
    if (!error.message.startsWith('Unbreakable word exceeds')) throw error;
    return measureNode(node, theme.widthBands.wide);
  }
};
const laneCenters = [160, 520];
const gap = 72;
const routeTop = 166;
const rootSize = sizeFor(root);
const rootCenter = (laneCenters[0] + laneCenters[1]) / 2;
const height = routeTop + Math.max(...routes.map((route) => route.nodes.reduce((sum, node) => sum + sizeFor(node).height, 0)
  + (route.nodes.length - 1) * gap)) + 32;
const painter = createPainter({ diagram, width: 706, height,
  title: 'Figure 2 — One shared start, two paths to an article',
  description: 'The AEB Help Center appears once. Two distinct navigation branches lead to product help and the glossary, then continue downward to their articles. All eight Places and seven full navigation events match DG-011. Cards use the regular SDD width, with only the long German glossary article widened to fit its unbroken word.',
});
const home = painter.placeNode({ id: root.id, x: rootCenter - rootSize.width / 2, y: 32, width: rootSize.width });

for (const [index, route] of routes.entries()) {
  const center = laneCenters[index];
  let y = routeTop;
  const placed = route.nodes.map((node) => {
    const size = sizeFor(node);
    const result = painter.placeNode({ id: node.id, x: center - size.width / 2, y, width: size.width });
    y += result.height + gap;
    return result;
  });
  const first = route.edges[0];
  const portX = rootCenter + (index ? 40 : -40);
  painter.edge({ id: first.id, sourceOccurrenceId: home.occurrenceId, targetOccurrenceId: placed[0].occurrenceId,
    points: [{ x: portX, y: home.y + home.height }, { x: portX, y: 130 },
      { x: center, y: 130 }, { x: center, y: placed[0].y }] });
  const forkLabelSize = measureLabel(first.label, 150);
  painter.placeLabel({ edgeId: first.id, text: first.label,
    x: (portX + center - forkLabelSize.width) / 2, y: 92, maxWidth: 150 });
  route.edges.slice(1).forEach((edge, i) => {
    const source = placed[i]; const target = placed[i + 1];
    const sourceY = source.y + source.height;
    painter.edge({ id: edge.id, sourceOccurrenceId: source.occurrenceId, targetOccurrenceId: target.occurrenceId,
      points: [{ x: center, y: sourceY }, { x: center, y: target.y }] });
    const labelSize = measureLabel(edge.label, 150);
    painter.placeLabel({ edgeId: edge.id, text: edge.label, x: center + 16,
      y: sourceY + (gap - labelSize.height) / 2, maxWidth: 150 });
  });
}
console.log(JSON.stringify(await painter.save('figure-02-shared-start-places-flow')));
