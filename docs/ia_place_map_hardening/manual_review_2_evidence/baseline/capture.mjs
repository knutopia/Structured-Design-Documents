import {readFile,writeFile} from 'node:fs/promises';
const dir=process.cwd();
const {loadBundle}=await import(dir+'/dist/bundle/loadBundle.js');
const {compileSource}=await import(dir+'/dist/compiler/compileSource.js');
const {projectView}=await import(dir+'/dist/projector/projectView.js');
const {buildIaPlaceMapRendererScene}=await import(dir+'/dist/renderer/staged/iaPlaceMap.js');
const {runIaPlaceMapRendererPipeline}=await import(dir+'/dist/renderer/staged/iaPlaceMapRouting.js');
const bundle=await loadBundle('bundle/v0.2/manifest.yaml');
const first='    NAVIGATES_TO P-002 [E-001] {workspace selected} diagrams="DG-001,DG-002"';
for(const detailId of ['compact','detailed']) for(const name of ['billsage','parallel','self-loop','multiple-incoming','DG-001','DG-002','DG-003']) {
const path=name==='billsage'?'tests/fixtures/render/billSage_structure.sdd':'tests/fixtures/render/ia_parallel_navigation_v02.sdd';
let text=await readFile(path,'utf8');
if(name==='self-loop') text=text.replace(first,first+'\n    NAVIGATES_TO P-001 [E-001] {refresh workspace} diagrams=DG-001');
if(name==='multiple-incoming') text=text.replace('    route_or_key=/workspace/settings','    NAVIGATES_TO P-002 [E-001] {settings saved} diagrams=DG-001\n    route_or_key=/workspace/settings');
const graph=compileSource({path,text},bundle).graph;
const view=bundle.views.views.find(v=>v.id==='ia_place_map');
const projection=projectView(graph,bundle,view.id,name.startsWith('DG-')?{diagramId:name}:undefined).projection;
const result=await runIaPlaceMapRendererPipeline(buildIaPlaceMapRendererScene(projection,graph,view,{detailId},bundle));
await writeFile(`/tmp/ia-review2-baseline/${name}.${detailId}.json`,JSON.stringify(result.positionedScene,null,2));
console.log(name,detailId,result.positionedScene.edges.length,result.positionedScene.diagnostics.filter(d=>d.severity==='error').length);
}
