import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { MeasuredItem, RendererScene, SceneItem } from "../../../../src/renderer/staged/contracts.js";
import { runStagedRendererPipeline } from "../../../../src/renderer/staged/pipeline.js";
import { assessUiContractsGeometry } from "../../../../tests/uiContractsB5Acceptance.js";

// Bounded diagnostic experiment. Production acceptance remains strict.
// From repo root: TMPDIR=/tmp node --import tsx docs/hierarchical_ui_contracts/implementation_evidence/stage6/port_probe.ts
const directory = new URL("./", import.meta.url);
await mkdir("/tmp/sdd-b5-topology", { recursive: true });
for (const name of ["branch", "merge", "diamond"]) {
  const record = JSON.parse(await readFile(new URL(`${name}.json`, directory), "utf8"));
  const scene: RendererScene = structuredClone(record.rendererScene);
  const walk = <T extends SceneItem | MeasuredItem>(item: T): Array<SceneItem | MeasuredItem> => [item, ...(item.kind === "container" ? item.children.flatMap(child => walk(child)) : [])];
  const items = new Map(walk(scene.root).map(item => [item.id, item]));
  for (const end of ["from", "to"] as const) for (const item of items.values()) {
    const edges = scene.edges.filter(edge => edge[end].itemId === item.id);
    if (edges.length < 2) continue;
    const measured = record.measuredScene.root;
    const measuredItem = walk(measured).find(node => node.id === item.id)!;
    edges.forEach((edge, index) => {
      const portId = `probe:${end}:${index}`;
      item.ports.push({ id: portId, role: "transition", side: end === "from" ? "east" : "west",
        offset: measuredItem.height / 2 + (index - (edges.length - 1) / 2) * 16 });
      edge[end].portId = portId;
    });
  }
  const result = await runStagedRendererPipeline(scene);
  const issues = assessUiContractsGeometry(result.positionedScene);
  await writeFile(`/tmp/sdd-b5-topology/${name}.distinct-ports.json`, JSON.stringify({ issues, ...result }, null, 2));
  console.log(`${name}: ${issues.length} acceptance failures; output in /tmp/sdd-b5-topology/`);
}
