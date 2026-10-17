// THROWAWAY. Retains the first captured evidence unchanged; adds measured experiments.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { UiContractsSceneBuilder } from '../../../../dist/renderer/staged/uiContractsPresentationScene.js';
import { resolveRendererTheme } from '../../../../dist/renderer/staged/theme.js';
import { createExperiment, complete, advance, CASES, LIMITS, POLICY } from './allocation-model.mjs';
const dir=new URL('./',import.meta.url);
const originalHtml=await readFile(new URL('prototype.html',dir),'utf8');
const data=JSON.parse(originalHtml.match(/const DATA = ([\s\S]*?);\n<\/script>/)[1]);
const seed=structuredClone(data.seed),builder=new UiContractsSceneBuilder('compact',{id:'type,id',showNodeType:true,showNodeId:true});
seed.themeId=builder.scene.themeId;
seed.theme=resolveRendererTheme(seed.themeId,'routing').theme;
seed.extraTexts={parallel1:'Choose filter 1',parallel2:'Choose filter 2',parallel3:'Choose filter 3',parallel4:'Choose filter 4',retry:'Retry',yes:'Yes',no:'No',done:'Done',restart:'Start again'};
seed.extraLabels=Object.fromEntries(Object.entries(seed.extraTexts).map(([key,text])=>[key,builder.labelMeasure({text,textStyleRole:'edge_label'},key)]));
seed.expectedText=Object.fromEntries(data.captures.mixed.sequence.edges.map(e=>[e.id,e.label]));
const reports=[];
for(const scenario of Object.keys(CASES)) {
  const initial=createExperiment(seed,scenario),result=complete(seed,initial);
  const repeat=complete(seed,createExperiment(seed,scenario));
  if(JSON.stringify(result)!==JSON.stringify(repeat))throw new Error(`Nondeterminism: ${scenario}`);
  if(Object.keys(LIMITS).some(k=>result.used[k]>LIMITS[k]))throw new Error(`Allowance exceeded: ${scenario}`);
  if(result.status==='accepted') for(const c of result.current.connectors.filter(c=>c.source.nodeId===c.target.nodeId)) {
    const horizontal=c.route.points.slice(1).flatMap((to,i)=>Math.abs(to.y-c.route.points[i].y)<0.5&&Math.abs(to.x-c.route.points[i].x)>0.5?[to.x-c.route.points[i].x]:[]);
    if(c.source.point.x<=c.target.point.x||!horizontal.length||horizontal.some(dx=>dx>=0))throw new Error(`Self-loop must travel left: ${scenario} / ${c.id}`);
  }
  reports.push({scenario,result});
  console.log(JSON.stringify({scenario,status:result.status,stop:result.stop,used:result.used,violations:result.current?.violations.length,labels:result.current?.labelProblems.length}));
}
const sourceFiles=['allocation-model.mjs','allocation-shell.html','capture-allocation.mjs','../routingCore/portCapacity.ts','../routingCore/orderedPortPair.ts','../routingCore/lifecycle.ts','../routingCore/capacity.ts','../connectorLabelLayout.ts'];
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async path=>[path,createHash('sha256').update(await readFile(new URL(path,dir))).digest('hex')])));
const provenance={question:'Can complete-transition routing allocate attachments, grow measured capacity and recover routes and labels under one allowance?',firstPrototypeCommit:'f774d5bcb4213941e14d168724985b7e72a7cd68',productionBase:'4ae2de20621dcf0027f31414f59ca9255a54dc77',firstHtmlSha256:createHash('sha256').update(originalHtml).digest('hex'),sourceHashes,determinism:'Two complete executions of every fixture yield identical serialized state.',scope:'Throwaway geometry fixtures only; no production or bundle migration.',policy:POLICY,limits:LIMITS};
await writeFile(new URL('allocation-evidence/evidence.json',dir),JSON.stringify({provenance,seed:{...seed,nodes:seed.nodes.map(({svg,...n})=>n)},reports},(key,value)=>key==='svg'?undefined:value,2)+'\n');
const require=createRequire(import.meta.url),tsxRequire=createRequire(require.resolve('tsx/package.json'));
const {build}=await import(tsxRequire.resolve('esbuild'));
const runtime=await build({entryPoints:[fileURLToPath(new URL('allocation-model.mjs',dir))],bundle:true,write:false,format:'iife',globalName:'AllocationPrototype',platform:'browser',target:'es2022',plugins:[{name:'captured-measurements',setup(b){
  // Geometry/assessment code is the actual shared module. Only its Node-owned
  // theme/font-loading dependencies are adapted for offline premeasured fixtures.
  b.onResolve({filter:/\/theme\.js$/},()=>({path:'captured-theme',namespace:'offline'}));
  b.onResolve({filter:/\/textMeasurement\.js$/},()=>({path:'premeasured-text',namespace:'offline'}));
  b.onLoad({filter:/.*/,namespace:'offline'},args=>({contents:args.path==='captured-theme'?`export const resolveRendererTheme=()=>({theme:${JSON.stringify(seed.theme)}});`:
    'export const createTextMeasurementService=()=>({measureText(){throw new Error("Offline fixture accepts only premeasured text; no text decorations.");}});',loader:'js'}));
}}]});
const browserData={...data,seed,provenance};
const template=await readFile(new URL('allocation-shell.html',dir),'utf8');
await writeFile(new URL('allocation-prototype.html',dir),template.replace('/* INLINE_MODEL */',()=>runtime.outputFiles[0].text).replace('/* INLINE_EVIDENCE */',()=>`const DATA = ${JSON.stringify(browserData).replaceAll('<','\\u003c')};`));
console.log('Open src/renderer/staged/routing-prototype/allocation-prototype.html offline.');
