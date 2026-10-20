/**
 * Figure 8: an editorial composition of the exact DG-026 IA projection.
 *
 * Illustration-specific IDs select placement only. All visible semantic text
 * and the complete set of navigation occurrences come from loadDiagram().
 * See ARCHITECTURE.md for the content authority and acceptance invariants.
 */
import { fileURLToPath } from 'node:url';
import {
  createPainter,
  loadDiagram,
  measureLabel,
  measureNode,
} from './common.mjs';

const diagram = await loadDiagram('DG-026');
const ids = {
  community: 'P-003',
  topic: 'P-6348376033553',
  posts: ['P-51981098991505', 'P-51940955473041'],
  signIn: 'P-005',
};
const byId = new Map(diagram.nodes.map(node => [node.id, node]));
const destinations = [...ids.posts, ids.signIn];
const orderedIds = [ids.community, ids.topic, ...destinations];
if (diagram.nodes.length !== 5 || diagram.edges.length !== 4 ||
    orderedIds.some(id => !byId.has(id))) {
  throw new Error('DG-026 must retain its five selected Places and four navigation occurrences.');
}
const edgeBetween = (source, target) => {
  const matches = diagram.edges.filter(edge => edge.source === source && edge.target === target);
  if (matches.length !== 1) throw new Error(`Expected exactly one source navigation ${source} → ${target}.`);
  return matches[0];
};
const entry = edgeBetween(ids.community, ids.topic);
const branches = destinations.map(id => edgeBetween(ids.topic, id));
if (new Set([entry.id, ...branches.map(edge => edge.id)]).size !== diagram.edges.length) {
  throw new Error('Editorial placement must cover every selected navigation exactly once.');
}

// MeasuredScene: expand the two long-title columns, without changing typography.
const widths = { community: 224, topic: 300, destination: 336 };
const measured = new Map(orderedIds.map(id => [id,
  measureNode(byId.get(id), id === ids.community ? widths.community :
    id === ids.topic ? widths.topic : widths.destination),
]));
const labelSizes = new Map(diagram.edges.map(edge => [edge.id, measureLabel(edge.label, 420)]));
const margin = 28;
const entryGap = Math.ceil(labelSizes.get(entry.id).width) + 32;
// The extra 96px is accounted for by the farther 48px outer track, 16px
// label/track clearance and at least 32px to the destination card.
const branchGap = Math.ceil(Math.max(...branches.map(edge => labelSizes.get(edge.id).width))) + 96;
const xCommunity = margin;
const xTopic = xCommunity + widths.community + entryGap;
const xDestination = xTopic + widths.topic + branchGap;
const destinationTop = 90;
const destinationGap = 52;
const destinationY = [destinationTop];
for (let i = 1; i < destinations.length; i++) {
  destinationY.push(destinationY[i - 1] + measured.get(destinations[i - 1]).height + destinationGap);
}
const middleCenter = destinationY[1] + measured.get(destinations[1]).height / 2;
const width = xDestination + widths.destination + margin;
const captionY = destinationY[2] + measured.get(ids.signIn).height + 42;
const height = captionY + 24;
const painter = createPainter({
  diagram,
  width,
  height,
  title: 'Community: reading and participation',
  description: 'The exact five Places and four navigations selected by DG-026. Public posts and sign-in are alternative terminal destinations.',
});

// PositionedScene: right-column stacking makes the three alternatives explicit.
const nodes = new Map();
nodes.set(ids.community, painter.placeNode({
  id: ids.community,
  x: xCommunity,
  y: middleCenter - measured.get(ids.community).height / 2,
  width: widths.community,
}));
nodes.set(ids.topic, painter.placeNode({
  id: ids.topic,
  x: xTopic,
  y: middleCenter - measured.get(ids.topic).height / 2,
  width: widths.topic,
}));
destinations.forEach((id, i) => nodes.set(id, painter.placeNode({
  id,
  x: xDestination,
  y: destinationY[i],
  width: widths.destination,
})));
const centerY = node => node.y + node.height / 2;
const topicRight = xTopic + widths.topic;
const entryPoints = [
  { x: xCommunity + widths.community, y: middleCenter },
  { x: xTopic, y: middleCenter },
];
painter.edge({
  id: entry.id,
  sourceOccurrenceId: ids.community,
  targetOccurrenceId: ids.topic,
  points: entryPoints,
});
painter.placeLabel({
  edgeId: entry.id,
  text: entry.label,
  x: xCommunity + widths.community + 16,
  y: middleCenter - labelSizes.get(entry.id).height - 8,
  maxWidth: 420,
});

branches.forEach((edge, i) => {
  const target = nodes.get(destinations[i]);
  const targetY = centerY(target);
  // The two outer routes travel away from the middle route, each on its
  // own track and its own topic port. No route uses a shared trunk.
  const portY = middleCenter + (i - 1) * 18;
  const trackX = topicRight + (i === 0 ? 24 : 48);
  const points = i === 1 ? [
    { x: topicRight, y: middleCenter },
    { x: xDestination, y: targetY },
  ] : [
    { x: topicRight, y: portY },
    { x: trackX, y: portY },
    { x: trackX, y: targetY },
    { x: xDestination, y: targetY },
  ];
  painter.edge({
    id: edge.id,
    sourceOccurrenceId: ids.topic,
    targetOccurrenceId: edge.target,
    points,
  });
  painter.placeLabel({
    edgeId: edge.id,
    text: edge.label,
    x: xDestination - 24 - labelSizes.get(edge.id).width,
    y: targetY - labelSizes.get(edge.id).height - 8,
    maxWidth: 420,
  });
});

// These are editorial headings/caption, outside the semantic node set.
painter.text({ text: 'Community: reading and participation', x: margin, y: 30, size: 20, weight: 600 });
painter.text({ text: 'Community', x: xCommunity, y: 65, size: 12, weight: 600, color: '#475569' });
painter.text({ text: 'Public topic', x: xTopic, y: 65, size: 12, weight: 600, color: '#475569' });
painter.text({ text: 'Alternative destinations', x: xDestination, y: 65, size: 12, weight: 600, color: '#475569' });
painter.text({
  text: 'The two posts can be read publicly. Creating a post or following leads to sign-in.',
  x: margin,
  y: captionY,
  size: 12,
  weight: 400,
  color: '#475569',
});
await painter.save(fileURLToPath(new URL('./figure-08-places-flow', import.meta.url)));
console.log(`Figure 8: ${width} × ${height}; five Places, four distinct navigation routes.`);
