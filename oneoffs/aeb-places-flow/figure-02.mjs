/** DG-011: two independently readable downward routes with repeated Home. */
import { loadDiagram, measureNode, measureLabel, createPainter } from './common.mjs';

const diagram = await loadDiagram('DG-011');
const nodesById = new Map(diagram.nodes.map((node) => [node.id, node]));
const outgoing = (id) => diagram.edges.filter((edge) => edge.source === id);
const roots = diagram.nodes.filter((node) => !diagram.edges.some((edge) => edge.target === node.id));
if (roots.length !== 1) throw new Error('Figure 2 requires one shared entry Place.');
const root = roots[0];
const routes = outgoing(root.id).map((first) => {
  const nodes = [root, nodesById.get(first.target)];
  const edges = [first];
  let next = outgoing(first.target);
  while (next.length) {
    if (next.length !== 1 || nodes.some((node) => node.id === next[0].target)) {
      throw new Error('Figure 2 route must be an acyclic chain after the shared entry.');
    }
    edges.push(next[0]);
    nodes.push(nodesById.get(next[0].target));
    next = outgoing(next[0].target);
  }
  return { nodes, edges };
}).sort((a, b) => b.nodes.length - a.nodes.length);
if (routes.length !== 2 || routes[0].nodes.length !== 5 || routes[1].nodes.length !== 4
  || diagram.nodes.length !== 8 || diagram.edges.length !== 7) {
  throw new Error('DG-011 proof-case membership changed; revisit the composition.');
}

const cardWidth = 336;
const margin = 32;
const columnGap = 88;
const connectorGap = 72;
const top = 76;
const routeHeight = (route) => route.nodes.reduce((sum, node) => sum + measureNode(node, cardWidth).height, 0)
  + (route.nodes.length - 1) * connectorGap;
const painter = createPainter({
  diagram,
  width: margin * 2 + cardWidth * 2 + columnGap,
  height: top + Math.max(...routes.map(routeHeight)) + margin,
  title: 'Figure 2 — Product help and glossary paths',
  description: 'Two selected navigation routes from the AEB Help Center. Home is repeated at the top of each route for readability; both occurrences represent the same Place P-001. Event capsules preserve the full source labels.',
});

for (const [index, route] of routes.entries()) {
  const x = margin + index * (cardWidth + columnGap);
  painter.text({ text: ['Product help', 'Glossary'][index], x, y: 28, size: 18, weight: 600 });
  let y = top;
  const placed = route.nodes.map((node) => {
    const result = painter.placeNode({ id: node.id, occurrenceId: `${node.id}:route-${index + 1}`, x, y, width: cardWidth });
    y += result.height + connectorGap;
    return result;
  });
  route.edges.forEach((edge, i) => {
    const source = placed[i];
    const target = placed[i + 1];
    const centerX = x + cardWidth / 2;
    const sourceY = source.y + source.height;
    const labelSize = measureLabel(edge.label, 150);
    painter.edge({ id: edge.id, sourceOccurrenceId: source.occurrenceId,
      targetOccurrenceId: target.occurrenceId,
      points: [{ x: centerX, y: sourceY }, { x: centerX, y: target.y }] });
    painter.placeLabel({ edgeId: edge.id, text: edge.label, x: centerX + 16,
      y: sourceY + (connectorGap - labelSize.height) / 2, maxWidth: 150 });
  });
}

const outputs = await painter.save('figure-02-places-flow');
console.log(JSON.stringify(outputs));
