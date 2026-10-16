// THROWAWAY. Two-state routing proof, not a general layout strategy.
// DOM-free: the browser and capture script call exactly the same functions.
import { runRoutingLifecycle, validateFinalRouteSet } from '../../../../dist/renderer/staged/routingCore/lifecycle.js';
import { DEFAULT_ROUTING_POLICY } from '../../../../dist/renderer/staged/routingCore/contracts.js';

export const initialState = () => ({ panel: 'failure', productionTopology: 'mixed', topology: 'mixed', capacity: 'measured', fault: 'none', ports: false });
export function reduce(state, action) {
  if (action.type === 'reset') return initialState();
  if (action.type === 'panel') return { ...state, panel: action.value };
  if (action.type === 'production-case') return { ...state, panel: 'failure', productionTopology: action.value };
  if (action.type === 'ports') return { ...state, ports: !state.ports };
  if (action.type === 'case') return { ...state, panel: 'candidate', topology: action.value, capacity: 'measured', fault: 'none' };
  if (action.type === 'capacity') return { ...state, panel: 'candidate', capacity: action.value, fault: 'none' };
  if (action.type === 'fault') return { ...state, panel: 'candidate', capacity: 'measured', fault: action.value };
  return state;
}

const rank = edge => edge.category === 'return' ? -1 : edge.category === 'loop' ? 1 : 0;
const point = (x, y) => ({ x, y });

/** Allocate geometry and endpoint requirements BEFORE constructing route candidates.
 * E/W is the existing transition adapter convention, not inferred from polylines.
 * The three roles are topological comparisons of the projected node order.
 * Reservations use the full inventory, so toggling an edge doesn't shift other ports.
 */
export function allocate(seed, state) {
  const spacing = DEFAULT_ROUTING_POLICY.minSeparation;
  const terminal = Math.max(DEFAULT_ROUTING_POLICY.minTerminalLeg, seed.markerClearance);
  const margin = 24;
  const sideRoom = state.capacity === 'tight' ? 6 : Math.max(margin, terminal + 8);
  const returnLabel = seed.edges.find(e => e.category === 'return')?.label;
  const forwardLabel = seed.edges.find(e => e.category === 'forward')?.label;
  const loopLabel = seed.edges.find(e => e.category === 'loop')?.label;
  const upperTrack = margin + (returnLabel?.height ?? 0) + 12;
  const nodeY = upperTrack + 40;
  // Room for a complete self-loop label and both terminal legs, as well as the forward label.
  const gap = Math.max((forwardLabel?.width ?? 0) + 2 * margin, 2 * sideRoom + spacing,
    ((loopLabel?.width ?? 0) - seed.nodes.at(-1).width) / 2 + 2 * margin);
  let nextX = margin + Math.max(sideRoom, margin);
  const nodes = seed.nodes.map(node => {
    const placed = { ...node, x: nextX, y: nodeY };
    nextX += node.width + gap;
    return placed;
  });
  const byId = new Map(nodes.map(n => [n.id, n]));
  const bottom = Math.max(...nodes.map(n => n.y + n.height));
  const lowerTrack = bottom + 40;
  const bounds = { minX: 0, minY: 0, maxX: nextX - gap + Math.max(sideRoom, margin) + margin,
    maxY: lowerTrack + 12 + (loopLabel?.height ?? 0) + margin };
  const edges = seed.edges.filter(e => state.topology === 'mixed'
    || (state.topology === 'pair' && e.category !== 'loop')
    || (state.topology === 'forward' && e.category === 'forward')
    || (state.topology === 'forward-loop' && e.category !== 'return')
    || (state.topology === 'loop' && e.category === 'loop'));
  const endpoints = new Map(edges.map(edge => {
    const from = byId.get(edge.from), to = byId.get(edge.to);
    const offset = state.fault === 'shared-ports' ? 0 : rank(edge) * spacing;
    const y = nodeY + Math.min(...nodes.map(n => n.height)) / 2 + offset;
    return [edge.id, {
      source: { nodeId: from.id, side: 'east', point: point(from.x + from.width, y), minLeg: terminal },
      target: { nodeId: to.id, side: 'west', point: point(to.x, y), minLeg: terminal }
    }];
  }));
  return { nodes: state.topology === 'loop' ? nodes.filter(n => edges.some(e => e.from === n.id)) : nodes,
    edges, endpoints, sideRoom, upperTrack, lowerTrack, gap, bounds, spacing, terminal };
}

export function construct(allocation) {
  const { edges, endpoints, sideRoom, upperTrack, lowerTrack } = allocation;
  const labels = [];
  const connectors = edges.map((edge, priority) => {
    const { source, target } = endpoints.get(edge.id);
    const s = source.point, t = target.point;
    let points;
    if (edge.category === 'forward') points = [s, t];
    else {
      const track = edge.category === 'loop' ? lowerTrack : upperTrack;
      points = [s, point(s.x + sideRoom, s.y), point(s.x + sideRoom, track),
        point(t.x - sideRoom, track), point(t.x - sideRoom, t.y), t];
    }
    if (edge.label) {
      const track = edge.category === 'loop' ? lowerTrack : edge.category === 'return' ? upperTrack : s.y;
      labels.push({ ...edge.label, id: edge.id, x: (s.x + t.x - edge.label.width) / 2,
        y: edge.category === 'loop' ? track + 12 : track - edge.label.height - 12 });
    }
    return { id: edge.id, priority, source: structuredClone(source), target: structuredClone(target),
      route: { style: 'orthogonal', points: points.map(p => ({ ...p })) } };
  });
  return { connectors, labels };
}

export function runExperiment(seed, state) {
  const allocation = allocate(seed, state);
  const { connectors, labels } = construct(allocation);
  // Negative control: corrupt geometry only; independent endpoint requirements stay fixed.
  if (state.fault === 'wrong-attachment') {
    const connector = connectors.find(c => seed.edges.find(e => e.id === c.id)?.category === 'loop') ?? connectors[0];
    connector.route.points.at(-1).x += 8;
  }
  const context = {
    connectors,
    boxes: allocation.nodes.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })),
    blockers: labels.map(({ id, x, y, width, height }) => ({ id: `label:${id}`, x, y, width, height })),
    bounds: allocation.bounds,
    // Same separation/tolerance and stricter crossing treatment. No sharing exemptions.
    policy: { ...DEFAULT_ROUTING_POLICY, crossingTreatment: 'forbid' }
  };
  const violations = validateFinalRouteSet(context);
  // One coordinator certifies a valid prepared set. Rejected experiments are displayed
  // unchanged, with errors, rather than silently repaired into a different experiment.
  const result = violations.length ? undefined : runRoutingLifecycle(context);
  const accepted = result?.status === 'resolved';
  const finalContext = accepted ? result.context : context;
  const finalViolations = accepted ? validateFinalRouteSet(finalContext) : violations;
  const labelIssues = [];
  for (const label of labels) {
    if (label.x < context.bounds.minX || label.y < context.bounds.minY
      || label.x + label.width > context.bounds.maxX || label.y + label.height > context.bounds.maxY)
      labelIssues.push('A label leaves the allocated canvas.');
    for (const box of [...context.boxes, ...labels.filter(other => other.id !== label.id)]) {
      if (label.x < box.x + box.width && label.x + label.width > box.x
        && label.y < box.y + box.height && label.y + label.height > box.y)
        labelIssues.push('A label overlaps a node or another label.');
    }
  }
  return { allocation: { ...allocation, endpoints: Object.fromEntries(allocation.endpoints) },
    context: finalContext, labels, violations: finalViolations, labelIssues,
    accepted: accepted && !finalViolations.length && !labelIssues.length,
    trace: result?.trace ?? null,
    segments: finalContext.connectors.reduce((sum, c) => sum + c.route.points.length - 1, 0) };
}
