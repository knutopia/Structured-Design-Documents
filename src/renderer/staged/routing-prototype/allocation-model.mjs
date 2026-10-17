// THROWAWAY geometry owner. Experimental policy, never imported by production.
// DOM-free. The offline page and evidence capture execute this same module.
import { allocatePortOffsets } from '../../../../dist/renderer/staged/routingCore/portCapacity.js';
import { allocateOrderedPortPair } from '../../../../dist/renderer/staged/routingCore/orderedPortPair.js';
import { readablePortPitch } from '../../../../dist/renderer/staged/routingCore/bounds.js';
import { markerRoutingClearance } from '../../../../dist/renderer/staged/markerGeometry.js';
import { DEFAULT_ROUTING_POLICY } from '../../../../dist/renderer/staged/routingCore/contracts.js';
import { runRoutingLifecycle, validateFinalRouteSet } from '../../../../dist/renderer/staged/routingCore/lifecycle.js';
import { measureRoutingCorridorDeficits } from '../../../../dist/renderer/staged/routingCore/capacity.js';
import { buildRoutingSegments } from '../../../../dist/renderer/staged/routingCore/geometry.js';
import { assessConnectorLabels, auditConnectorLabels, measureConnectorLabelCapacity, wrappedLabelPreservesText } from '../../../../dist/renderer/staged/connectorLabelLayout.js';

export const LIMITS = Object.freeze({ expansions: 4, candidates: 4096, repairs: 128 });
export const POLICY = Object.freeze({ name: 'EXPERIMENTAL, not a bundle convention', loopSides: ['south', 'north'], loopTraversal: 'negative', inset: 12, labelDistance: 12, margin: 24 });
export const CASES = {
  original: { title: 'All three transitions', description: 'Automatically reserve attachments for the original forward, return and self-loop. The return is complete; the loop prefers the lower side and travels backward to the left.' },
  crowded: { title: 'Competing ports', description: 'Four parallel transitions, two loops and a fixed support-port reservation exceed natural card capacity. Ask for measured minimum dimensions and rebuild.' },
  expansion: { title: 'Too little room', description: 'A genuinely narrow gap and shallow corridors cannot hold the measured text. Try both loop sides before enlarging the layout.' },
  north: { title: 'Use the upper side', description: 'The lower corridor cannot hold the loop. The upper corridor already fits, so no enlargement should occur.' },
  branch: { title: 'Branch and return', description: 'Keep one physical fork and one merge bar, directed relationship paths and a complete return to the first card.' },
  repair: { title: 'Shared search', description: 'An intentionally short prepared return terminal invokes the real shared repair search. Inspect whether search actually changes the routes.' },
  labels: { title: 'Recover a label', description: 'Start with a forward label inside a card. Shared label assessment must move the full text to its own route using the same candidate allowance.' },
  exhaustion: { title: 'Exhaust the search', description: 'Conflicting parallel terminal routes consume the same bounded search allowance. A failed search must remain a failure.' },
  repeated: { title: 'Repeated layout', description: 'Inject a rebuilding owner that ignores a real capacity request. Unchanged geometry must stop recovery without consuming an effective expansion.' },
  endpoint: { title: 'Wrong endpoint', description: 'Move only the drawn endpoint. Independently resolved endpoint requirements stay fixed and must reject it.' },
  shared: { title: 'Shared attachment', description: 'Accidentally reuse a physical port for parallel transitions. Matching node IDs grant no overlap permission.' }
};
const p = (x,y) => ({x,y});
const clone = value => structuredClone(value);
const num = value => Math.round(value * 1000) / 1000;
const geometryKey = layout => JSON.stringify({boxes:[...layout.nodes,...layout.junctions].map(({id,x,y,width,height})=>({id,x,y,width,height})),bounds:layout.bounds});
const req = (resource, current, required, cause, ids=[]) => ({resource, current: num(current), required: num(required), cause, connectorIds: ids});
const merge = requests => [...requests.reduce((m,r) => {
  const old=m.get(r.resource); if(!old || r.required>old.required) m.set(r.resource,r); return m;
},new Map()).values()].sort((a,b)=>a.resource.localeCompare(b.resource));

export function inventory(seed, scenario) {
  const nodes=clone(seed.nodes), edges=clone(seed.edges);
  if(scenario==='north') return {nodes, edges: edges.filter(e=>e.category==='loop'), paths:[]};
  if(['crowded','shared','exhaustion'].includes(scenario)) {
    const forward=edges.find(e=>e.category==='forward'), loop=edges.find(e=>e.category==='loop');
    return {nodes, edges: [0,1,2,3].map(i=>({...clone(forward),id:`parallel-${i+1}`,relationshipId:`synthetic:parallel-${i+1}`, label:clone(seed.extraLabels[`parallel${i+1}`]), labelText:`Choose filter ${i+1}`}))
      .concat([edges.find(e=>e.category==='return'),loop, {...clone(loop), id:'second-loop',relationshipId:'synthetic:second-loop',label:clone(seed.extraLabels.retry),labelText:'Retry'}]), paths:[]};
  }
  if(scenario==='branch') {
    const [a,b]=nodes;
    const c={...clone(b),id:'branch-c',semanticId:'C',title:'Alternate filter',svg:undefined}, d={...clone(b),id:'branch-d',semanticId:'D',title:'Results ready',svg:undefined};
    const edge=(id,from,to,category='forward',labelKey)=>({id,relationshipId:`synthetic:${id}`,from,to,category,label:labelKey?clone(seed.extraLabels[labelKey]):undefined,labelText:labelKey?seed.extraTexts[labelKey]:undefined});
    return {nodes:[a,b,c,d],edges:[edge('stem',a.id,'fork','junction'),edge('choose-b','fork',b.id,'branch','yes'),edge('choose-c','fork',c.id,'branch','no'),edge('merge-b',b.id,'merge','branch','done'),edge('merge-c',c.id,'merge','branch','done'),edge('finish','merge',d.id,'junction'),edge('restart',d.id,a.id,'return','restart')],
      paths:[{id:'A→B',from:a.id,to:b.id,physical:['stem','choose-b'],junctions:['fork']},{id:'A→C',from:a.id,to:c.id,physical:['stem','choose-c'],junctions:['fork']},{id:'B→D',from:b.id,to:d.id,physical:['merge-b','finish'],junctions:['merge']},{id:'C→D',from:c.id,to:d.id,physical:['merge-c','finish'],junctions:['merge']},{id:'D→A',from:d.id,to:a.id,physical:['restart'],junctions:[]}]};
  }
  return {nodes,edges,paths:[]};
}
export function createExperiment(seed, scenario='original') {
  const inv=inventory(seed,scenario);
  const natural=Object.fromEntries(inv.nodes.map(n=>[n.id,{width:n.width,height:n.height}]));
  const compact=['expansion','repeated'].includes(scenario);
  const resources={gap:compact?28:260,top:compact?16:132,bottom:scenario==='north'?8:compact?12:132,
    ...Object.fromEntries(inv.nodes.flatMap(n=>[[`card:${n.id}:width`,n.width],[`card:${n.id}:height`,n.height]]))};
  return {scenario, natural, resources, baseline:clone(resources), used:{candidates:0,repairs:0,expansions:0}, ledger:[], history:[], revision:0,side:'south',phase:'attempt',status:'ready',attempts:[],requests:[],current:null,stop:null,rebuildAttempts:0};
}
export function rebuildLayout(seed,state) {
  const inv=inventory(seed,state.scenario), {resources:r}=state;
  const nodes=inv.nodes.map(n=>({...n,width:r[`card:${n.id}:width`],height:r[`card:${n.id}:height`]}));
  let x=64;
  if(state.scenario==='branch') {
    const [a,b,c,d]=nodes, middleY=r.top+125;
    Object.assign(a,{x,y:middleY+(Math.max(b.height,c.height)-a.height)/2});
    Object.assign(b,{x:x+a.width+r.gap*2+12,y:r.top});
    Object.assign(c,{x:b.x,y:r.top+b.height+250});
    Object.assign(d,{x:b.x+Math.max(b.width,c.width)+r.gap*2+12,y:a.y});
    const fork={id:'fork',kind:'junction',title:'Fork',x:x+a.width+r.gap,y:b.y+b.height/2-4,width:6,height:c.y+c.height/2-(b.y+b.height/2)+8};
    const join={...fork,id:'merge',title:'Merge',x:b.x+Math.max(b.width,c.width)+r.gap};
    const junctions=[fork,join].map(j=>({...j,ownerId:j.id,relationshipIds:inv.paths.filter(path=>path.junctions.includes(j.id)).map(path=>path.id)}));
    return {...inv,nodes,junctions,bounds:{minX:0,minY:0,maxX:d.x+d.width+64,maxY:c.y+c.height+r.bottom}};
  }
  for(const n of nodes) {Object.assign(n,{x,y:r.top});x+=n.width+r.gap;}
  return {...inv,nodes,junctions:[],bounds:{minX:0,minY:0,maxX:x-r.gap+64,maxY:r.top+Math.max(...nodes.map(n=>n.height))+r.bottom}};
}
function endpoint(node,side,offset,minLeg) {
  return {nodeId:node.id,side,minLeg,point:side==='east'?p(node.x+node.width,node.y+offset):side==='west'?p(node.x,node.y+offset):side==='north'?p(node.x+offset,node.y):p(node.x+offset,node.y+node.height)};
}

export function allocate(seed,state,layout) {
  const requests=[],findings=[],endpoints={},reservations=[],byId=new Map([...layout.nodes,...layout.junctions].map(n=>[n.id,n]));
  const marker=markerRoutingClearance('arrow',seed.arrowSize,seed.strokeWidth),pitch=readablePortPitch(seed.arrowSize,seed.strokeWidth);
  const groups=new Map();
  const add=(nodeId,side,id,role)=>{const key=`${nodeId}\0${side}`;if(!groups.has(key))groups.set(key,{node:byId.get(nodeId),side,items:[]});groups.get(key).items.push({id,role});};
  for(const e of layout.edges.filter(e=>e.category!=='loop')) {
    if(state.scenario==='branch' && e.category!=='return') continue;
    add(e.from,'east',e.id,'source');add(e.to,'west',e.id,'target');
  }
  const ordinaryPitch=Math.max(pitch,...layout.edges.filter(e=>e.category==='forward').map(e=>(e.label?.height??0)+POLICY.labelDistance*2+16));
  for(const g of groups.values()) {
    const ids=g.items.map(i=>`${i.id}:${i.role}`), separation=g.items.length>1?ordinaryPitch:pitch;
    const result=allocatePortOffsets({sideLength:g.node.height,minInset:POLICY.inset,minSeparation:separation,requestIds:ids});
    findings.push({helper:'allocatePortOffsets',node:g.node.id,side:g.side,result:result.status,requested:ids.length,available:result.availableSlots,separation});
    if(result.status!=='allocated') {requests.push(req(`card:${g.node.id}:height`,g.node.height,2*POLICY.inset+(ids.length-1)*separation,'measured port / adjacent-label pitch',g.items.map(i=>i.id)));continue;}
    for(const i of g.items) {endpoints[i.id]??={};endpoints[i.id][i.role]=endpoint(g.node,g.side,result.offsets.get(`${i.id}:${i.role}`),marker);}
  }
  if(state.scenario==='branch') {
    const [a,b,c,d]=layout.nodes,[fork,join]=layout.junctions;
    for(const e of layout.edges.filter(e=>e.category!=='return')) {
      const from=byId.get(e.from),to=byId.get(e.to),branchNode=[from,to].find(n=>n.id===b.id||n.id===c.id);
      const y=branchNode?branchNode.y+branchNode.height/2:a.y+a.height/2;
      endpoints[e.id]={source:endpoint(from,'east',y-from.y,from.kind==='junction'?0:marker),target:endpoint(to,'west',y-to.y,to.kind==='junction'?0:marker)};
    }
    // Return uses independent north attachments, leaving the junction network intact.
    const e=layout.edges.find(e=>e.category==='return');
    endpoints[e.id]={source:endpoint(d,'north',d.width/2,marker),target:endpoint(a,'north',a.width/2,marker)};
  }
  const loopGroups=new Map();
  for(const e of layout.edges.filter(e=>e.category==='loop')) {if(!loopGroups.has(e.from))loopGroups.set(e.from,[]);loopGroups.get(e.from).push(e);}
  for(const [id,loops] of loopGroups) {
    const n=byId.get(id),cells=new Map(loops.map(e=>[e.id,Math.max(2*POLICY.inset+pitch,(e.label?.width??0)+2*POLICY.labelDistance)]));
    const owner=`card:${id}:width`,corridor={owner,axis:'x',bounds:{x:0,y:0,width:n.width,height:1},connectorIds:loops.map(e=>e.id),margin:POLICY.inset};
    const claims=loops.map((e,priority)=>({owner,connectorId:e.id,priority,spanStart:0,spanEnd:1,thickness:cells.get(e.id)}));
    const deficits=measureConnectorLabelCapacity([corridor],claims,pitch);
    for(const d of deficits) requests.push(req(owner,n.width,d.requiredSize,'shared measured loop-label lane capacity',d.connectorIds));
    // Each lane owns one atomic pair. Label-sized lanes prevent one loop's label
    // from occupying another loop's terminal corridor; this sizing policy is experimental.
    const laneExtent=[...cells.values()].reduce((sum,v)=>sum+v,0)+(loops.length-1)*pitch;
    const occupied=(state.scenario==='crowded')?[POLICY.inset]:[];
    if(occupied.length)reservations.push({nodeId:id,side:state.side,offset:POLICY.inset,reason:'non-transition support port'});
    if(deficits.length) {findings.push({helper:'measureConnectorLabelCapacity',node:id,side:state.side,result:'capacity_exhausted',requested:loops.length,laneExtent});continue;}
    let laneStart=(n.width-laneExtent)/2;
    for(const e of loops) {
      const cell=cells.get(e.id),start=laneStart;laneStart+=cell+pitch;
      const pair=allocateOrderedPortPair({sideLength:cell,minInset:(cell-pitch)/2,minSeparation:pitch,direction:POLICY.loopTraversal,placement:'nearest_feasible',occupiedOffsets:occupied.map(o=>o-start),otherArrivalOffsets:[]});
      findings.push({helper:'allocateOrderedPortPair',id:e.id,node:id,side:state.side,direction:POLICY.loopTraversal,pair:pair?{departure:start+pair.departure,arrival:start+pair.arrival}:null,occupiedOffsets:[...occupied],cell});
      if(!pair) {requests.push(req(owner,n.width,n.width+pitch,'atomic loop pair blocked by reserved ports',[e.id]));continue;}
      const departure=start+pair.departure,arrival=start+pair.arrival;occupied.push(departure,arrival);
      endpoints[e.id]={source:endpoint(n,state.side,departure,marker),target:endpoint(n,state.side,arrival,marker)};
    }
  }
  if(['shared','exhaustion'].includes(state.scenario)) {
    const parallel=layout.edges.filter(e=>e.category==='forward');
    if(parallel.every(e=>endpoints[e.id])) for(const e of parallel.slice(1)) endpoints[e.id]=clone(endpoints[parallel[0].id]);
  }
  return {endpoints,requests:merge(requests),findings,reservations,pitch,marker};
}
function build(seed,state,layout,allocation) {
  const connectors=[],labels=[];
  for(const [priority,e] of layout.edges.entries()) {
    const ep=allocation.endpoints[e.id];if(!ep?.source||!ep.target)continue;
    const {source,target}=ep,s=source.point,t=target.point;
    let points;
    if(e.category==='loop') {const y=s.y+(state.side==='south'?24:-24);points=[s,p(s.x,y),p(t.x,y),t];}
    else if(e.category==='return') {
      const y=24+(e.label?.height??0)+12;
      if(state.scenario==='branch') points=[s,p(s.x,y),p(t.x,y),t];
      else {const flank=state.scenario==='repair'?4:32;points=[s,p(s.x+flank,s.y),p(s.x+flank,y),p(t.x-32,y),p(t.x-32,t.y),t];}
    } else points=[s,t];
    const c={id:e.id,priority,source:clone(source),target:clone(target),route:{style:'orthogonal',points:clone(points)}};
    if(state.scenario==='endpoint' && e.category==='loop')c.route.points.at(-1).x+=8;
    connectors.push(c);
    if(e.label) {
      const track=e.category==='return'?points[2].y:e.category==='loop'?points[1].y:s.y;
      labels.push({...clone(e.label),id:e.id,x:(s.x+t.x-e.label.width)/2,y:e.category==='loop'&&state.side==='south'?track+12:track-e.label.height-12});
    }
  }
  if(state.scenario==='labels'&&labels.length)Object.assign(labels[0],{x:layout.nodes[0].x+12,y:layout.nodes[0].y+8});
  return {connectors,labels};
}
function sceneFor(seed,layout,context,labels) {
  const byId=new Map(labels.map(l=>[l.id,l]));
  return {themeId:seed.themeId,root:{kind:'container',id:'experiment-owner',x:0,y:0,width:context.bounds.maxX,height:context.bounds.maxY,chrome:{},headerContent:[],children:[...layout.nodes,...layout.junctions].map(n=>({...n,kind:'node'}))},decorations:[],
    edges:context.connectors.map(c=>({id:c.id,route:c.route,label:byId.get(c.id),markers:{end:layout.junctions.some(j=>j.id===c.target.nodeId)?undefined:'arrow'}}))};
}
function labelInput(seed,layout,context,labels,budget) {
  return {scene:sceneFor(seed,layout,context,labels),expectedLabels:new Map(layout.edges.filter(e=>e.label).map(e=>[e.id,e.label])),requireAdjacentLabels:true,rejectAmbiguousAssociation:true,unrelatedRouteClearance:12,eventBasedHorizontalSearch:true,searchBudget:budget};
}
function capacity(state,layout,allocation,context) {
  const requests=[...allocation.requests],r=state.resources;
  const forward=layout.edges.filter(e=>['forward','branch'].includes(e.category));
  if(forward.length) {
    const owner='gap',needed=Math.max(...forward.map(e=>(e.label?.width??0)+48));
    // A shared physical corridor claim; each parallel row may reuse the X lane.
    const corridors=[{owner,axis:'x',bounds:{x:0,y:0,width:r.gap,height:forward.length*2},connectorIds:forward.map(e=>e.id),margin:24}];
    const claims=forward.map((e,i)=>({owner,connectorId:e.id,priority:i,spanStart:i*2,spanEnd:i*2+1,thickness:e.label?.width??0}));
    for(const d of measureConnectorLabelCapacity(corridors,claims,16))requests.push(req('gap',r.gap,Math.max(needed,d.requiredSize),'shared label capacity between cards',d.connectorIds));
  }
  for(const e of layout.edges) {
    if(e.category==='return') {const required=(e.label?.height??0)+12+40+24;if(r.top<required)requests.push(req('top',r.top,required,'return track, measured label and terminal room',[e.id]));}
    if(e.category==='loop') {const resource=state.side==='south'?'bottom':'top',required=24+12+(e.label?.height??0)+24;if(r[resource]<required)requests.push(req(resource,r[resource],required,'same-side loop track and measured label envelope',[e.id]));}
  }
  // Always expose the generic physical-wall capacity measurement, even if no deficit.
  const segments=context.connectors.flatMap(c=>buildRoutingSegments(c.id,c.route,{candidateId:'prepared',priority:c.priority}));
  const corridorDeficits=measureRoutingCorridorDeficits(segments,context.boxes,context.policy);
  for(const d of corridorDeficits)requests.push(req('gap',r.gap,r.gap+d.requiredSize-d.availableSize,'shared physical routing corridor',[d.beforeBoxId,d.afterBoxId]));
  return {requests:merge(requests),corridorDeficits};
}
function coverage(layout,context) {
  const byId=new Map(context.connectors.map(c=>[c.id,c])),issues=[];
  for(const e of layout.edges) if(!byId.has(e.id))issues.push(`Missing physical connector ${e.id}`);
  for(const path of layout.paths) {
    let current=path.from;
    for(const id of path.physical) {const c=byId.get(id);if(!c||c.source.nodeId!==current)issues.push(`Broken directed relationship ${path.id} at ${id}`);current=c?.target.nodeId;}
    if(current!==path.to)issues.push(`Wrong relationship destination ${path.id}`);
    for(const j of path.junctions)if(!layout.junctions.some(n=>n.id===j))issues.push(`Missing owned junction ${j}`);
  }
  return issues;
}
function charge(state,cause,candidates=0,repairs=0,expansions=0,extra={}) {
  state.used.candidates+=candidates;state.used.repairs+=repairs;state.used.expansions+=expansions;
  state.ledger.push({cause,revision:state.revision,side:state.side,candidates,repairs,expansions,total:clone(state.used),...extra});
}
function save(state,action) {
  state.history.push({action,revision:state.revision,side:state.side,status:state.status,stop:state.stop,used:clone(state.used),resources:clone(state.resources),requests:clone(state.requests),routeViolations:state.current?.violations??[],labelProblems:state.current?.labelProblems??[]});return state;
}
export function advance(seed,input) {
  const state=clone(input);
  if(['accepted','failed'].includes(state.status))return state;
  if(state.phase==='rebuild') {
    state.rebuildAttempts++;
    if(state.used.expansions>=LIMITS.expansions){state.status='failed';state.stop='expansion_exhausted';return save(state,'Expansion refused: allowance exhausted');}
    const resources=clone(state.resources);
    for(const r of state.requests)resources[r.resource]=Math.max(resources[r.resource]??0,r.required);
    const before=rebuildLayout(seed,state);
    const rebuilt=state.scenario==='repeated'?before:rebuildLayout(seed,{...state,resources});
    const beforeKey=geometryKey(before),afterKey=geometryKey(rebuilt);
    state.rebuildFindings={geometryChanged:beforeKey!==afterKey,requestedResources:resources};
    if(beforeKey===afterKey||(state.geometryHistory??[]).includes(afterKey)){state.status='failed';state.stop='repeated_state';return save(state,'Rebuild made no geometric progress');}
    state.geometryHistory=[...(state.geometryHistory??[beforeKey]),afterKey];
    state.resources=resources;state.revision++;state.side='south';state.phase='attempt';state.status='rebuilt';state.attempts=[];
    charge(state,'owner rebuild from stable natural measurements',0,0,1,{requirements:clone(state.requests)});
    state.current={layout:rebuilt,violations:[],labelProblems:[],findings:[],connectors:[],labels:[],endpoints:{},note:'New card sizes and positions; awaiting allocation and validation.'};
    return save(state,'Applied absolute measured capacity');
  }
  if(state.used.candidates>=LIMITS.candidates||state.used.repairs>=LIMITS.repairs){state.status='failed';state.stop=state.used.candidates>=LIMITS.candidates?'candidate_exhausted':'repair_exhausted';return save(state,'Search allowance exhausted');}
  const layout=rebuildLayout(seed,state),allocation=allocate(seed,state,layout),prepared=build(seed,state,layout,allocation);
  const context={connectors:prepared.connectors,boxes:[...layout.nodes,...layout.junctions].map(({id,x,y,width,height})=>({id,x,y,width,height})),bounds:layout.bounds,policy:{...DEFAULT_ROUTING_POLICY,maxExpansionPasses:0,crossingTreatment:state.scenario==='original'?'forbid':'penalize'}};
  charge(state,'complete prepared side candidate',1);
  const initialViolations=validateFinalRouteSet(context),measured=capacity(state,layout,allocation,context);
  let finalContext=context,labels=prepared.labels,trace=null,routingStatus=['endpoint','shared'].includes(state.scenario)?'negative control: read-only validation':'not called: measured capacity deficit';
  let violations=initialViolations;
  const remaining=LIMITS.candidates-state.used.candidates;
  if(!allocation.requests.length && !measured.requests.length && remaining>0 && !['endpoint','shared'].includes(state.scenario)) {
    const result=runRoutingLifecycle(context,{maxCandidates:remaining,maxRepairRevisions:LIMITS.repairs-state.used.repairs});
    trace=result.trace;routingStatus=result.status==='resolved'?'resolved':result.reason;
    charge(state,'shared routing lifecycle',trace.candidates,trace.repairRevisions,0,{validations:trace.validations,result:routingStatus});
    finalContext=result.status==='resolved'?result.context:{...context,connectors:result.debugConnectors};
    violations=validateFinalRouteSet(finalContext);
  }
  const budget={candidates:LIMITS.candidates-state.used.candidates};
  const before=budget.candidates;
  let assessment=auditConnectorLabels(labelInput(seed,layout,finalContext,labels,budget));
  const initialLabelProblems=clone(assessment.problems);
  // Rejected routes remain diagnostic geometry. Placement search starts only on route-valid revisions.
  if(!violations.length&&!allocation.requests.length)assessment=assessConnectorLabels(labelInput(seed,layout,finalContext,labels,budget));
  charge(state,'shared label assessment',before-budget.candidates);
  labels=[...assessment.labels].map(([id,label])=>({...label,id}));
  const textProblems=layout.edges.filter(e=>e.label).flatMap(e=>{
    const label=labels.find(l=>l.id===e.id);return !label||!wrappedLabelPreservesText(label.lines,e.labelText??seed.expectedText[e.id]??e.label.lines.join(' '))?[{connectorId:e.id,kind:'text_incomplete'}]:[];
  });
  const labelProblems=[...assessment.problems,...textProblems];
  // Final read-only audit uses exactly the independently allocated requirements and exact emitted labels.
  const auditContext={...finalContext,blockers:labels.map(l=>({...l,id:`label:${l.id}`}))};
  const finalViolations=validateFinalRouteSet(auditContext);
  const coverageIssues=coverage(layout,finalContext);
  const accepted=!finalViolations.length&&!labelProblems.length&&!coverageIssues.length&&!measured.requests.length&&routingStatus==='resolved';
  state.current={side:state.side,revision:state.revision,layout,endpoints:allocation.endpoints,preparedConnectors:clone(context.connectors),connectors:clone(finalContext.connectors),routesChanged:JSON.stringify(context.connectors.map(c=>c.route))!==JSON.stringify(finalContext.connectors.map(c=>c.route)),preparedLabels:prepared.labels,labels,labelsChanged:JSON.stringify(prepared.labels)!==JSON.stringify(labels),violations:finalViolations,initialViolations,initialLabelProblems,labelProblems,coverageIssues,findings:allocation.findings,reservations:allocation.reservations,corridorDeficits:measured.corridorDeficits,trace,routingStatus,context:auditContext};
  state.requests=measured.requests;state.attempts.push({side:state.side,requests:clone(state.requests),violations:clone(finalViolations),labelProblems:clone(labelProblems),used:clone(state.used)});
  if(accepted){state.status='accepted';state.stop='accepted';return save(state,'Accepted complete route and label set');}
  if(['endpoint','shared'].includes(state.scenario)&&!measured.requests.length){state.status='failed';state.stop='invalid_control';return save(state,'Negative control rejected');}
  if(state.used.candidates>=LIMITS.candidates||state.used.repairs>=LIMITS.repairs){state.status='failed';state.stop=state.used.candidates>=LIMITS.candidates?'candidate_exhausted':'repair_exhausted';return save(state,'Cumulative search exhausted');}
  if(state.side==='south'&&layout.edges.some(e=>e.category==='loop')) {state.side='north';state.status='trying upper side';return save(state,'Lower-side attempt rejected; try upper at current size');}
  const preferred=state.attempts.find(a=>a.side==='south')??state.attempts[0];
  state.requests=preferred.requests;
  if(state.requests.length){state.phase='rebuild';state.status='capacity needed';return save(state,'Both permitted sides assessed; capacity requested');}
  state.status='failed';state.stop='no_capacity_witness';return save(state,'No acceptable candidate and no measured rebuilding request');
}
export function complete(seed,input) {
  let state=input;
  for(let i=0;i<20&&!['accepted','failed'].includes(state.status);i++)state=advance(seed,state);
  return state;
}
