# General Approach: How to Use Elkjs for Design Diagrams

`elkjs` (the JavaScript port of the Eclipse Layout Kernel) is significantly more powerful than Graphviz for design-centric diagrams because it treats **layout** as a purely mathematical problem and leaves **styling/rendering** to you.

While Graphviz (DOT) tries to do both, `elkjs` provides the raw coordinates for nodes and edges, allowing you to use CSS, SVG, or Canvas for the "design" layer.

### 1. Key Advantages for Design-Centric IA

To match common design conventions (like those found in Figma or Miro), `elkjs` offers several capabilities that DOT lacks:

* **Orthogonal Edge Routing:** Unlike DOT's splines, which can look "messy" in complex flows, `elkjs` supports clean, 90-degree "Manhattan" routing. This is the gold standard for site maps and flowcharts.
* **Exact Port Constraints:** You can specify exactly where a line enters or exits a node (e.g., "at 20px from the top on the left side"). In DOT, ports are often limited to compass points.
* **Fixed Node Dimensions:** In `elkjs`, you provide the `width` and `height` of every node as input. The layout engine respects these exactly, allowing you to create uniform grid-based IA diagrams regardless of the text length inside.
* **Compound Graphs (Nested UI):** `elkjs` handles "nodes within nodes" natively. This is perfect for "Swimlanes" in journey maps or "Folders/Sections" in information architecture.

### 2. Implementation: Mapping DOT to ELK

Because your repo uses **Structured Design Documents**, you likely already have a data-driven approach. To move to `elkjs`, you would transition from generating a `.dot` string to generating an **ELK JSON** object.

#### Comparison: DOT vs. ELK JSON

| Feature | Graphviz (DOT) | elkjs (JSON) |
| --- | --- | --- |
| **Logic** | `A -> B [label="link"]` | `{ id: 'A', width: 100, height: 50 }` |
| **Routing** | `splines=ortho` (often unstable) | `elk.edgeRouting: 'ORTHOGONAL'` (robust) |
| **Grouping** | `subgraph cluster_0 { ... }` | `children: [{ id: 'child1', ... }]` |
| **Spacing** | `nodesep=0.5` | `elk.spacing.nodeNode: 40` (pixel-perfect) |

### 3. Achieving "Design Conventions" with Layout Options

To make your output look like a professional design document, you would use these specific `layoutOptions`:

```javascript
const layoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT', // Flow for Journey Maps
  'elk.edgeRouting': 'ORTHOGONAL', // Clean 90-degree lines
  'elk.layered.spacing.nodeNodeBetweenLayers': '100', // Gutter width
  'elk.spacing.nodeNode': '40', // Vertical spacing
  'elk.padding': '[top=50,left=50,bottom=50,right=50]', // Container padding
};

```

### 4. Recommended Rendering Stack

Since `elkjs` only calculates `x`, `y`, `width`, and `height`, you need a renderer. For Static/SVG (Closest to Graphviz workflow): use **D3.js** or a simple SVG template generator. This allows generating a static SVG file that looks exactly like a Figma export, with full control over typography and border-radius.

### 5. Application to Your Specific Use Cases

* **Journey Maps:** Use `elk.algorithm: 'layered'` with `direction: 'RIGHT'`. Set your "Persona Actions" as child nodes within "Phase" parent nodes (Swimlanes).
* **Information Architecture:** Use `direction: 'DOWN'`. Assign specific `ports` to the bottom of parent pages and the top of child pages to ensure lines never cross through node labels.
* **Scenario Flows:** Use the `stress` or `force` algorithms if the flow is non-linear, which handles complex cross-linking better than DOT's `neato` or `fdp`.

## EXAMPLE APPROACH: Using Elkjs Compared to an Existing DOT Output

Here is an existing DOT example that could be improved by elkjs:
- the DOT file: <real_world_exploration/state_of_rendering_031326/billSage_all_views_simple_recommended/billSage_simple_structure.ia_place_map.simple.dot>
- the resulting PNG: <real_world_exploration/state_of_rendering_031326/billSage_all_views_simple_recommended/billSage_simple_structure.ia_place_map.simple.png>
- the content structure: 6 top-level nodes, of which one is a "Place" and 5 are "Areas" containing one or more "Places". As you can see in the .png (rendered from the DOT) the typical "horizontal top level nodes" layout is mangled and the typical "vertical 2nd level nodes" is absent (also horizontal and mangled.) 

### 1. Analysis of Existing DOT Output

The "mangling" you are seeing in the Graphviz output is a classic symptom of DOT’s struggle with **nested directionality**. In DOT, `rankdir=LR` is a global setting; while you can try to force subgraphs to behave differently using invisible edges, the engine ultimately tries to satisfy a single global layout logic.

By moving to `elkjs`, you can treat each "Area" as a container with its own local layout rules. This allows the top level to flow **horizontally** while the content inside each cluster flows **vertically**.

### 2. The "Nested Direction" Solution

To fix your layout, you can assign different `elk.direction` values to different levels of the hierarchy.

* **Root Level:** Set to `RIGHT` (to align Dashboard, Projections, Current Bills, etc., in a row).
* **Cluster/Area Level:** Set to `DOWN` (to ensure the "Places" inside each area stack vertically).

### 3. Matching ELK JSON

Here is how that specific structure looks in the ELK format. Notice how we define the layout options for the parent separately from the children.

This schema uses a Layered algorithm. It sets the root direction to RIGHT (to align your Areas horizontally) and the cluster direction to DOWN (to stack the Places vertically).

There are included "properties" fields in the JSON. While ELK ignores these during layout, the renderer can use them to apply the CSS classes discussed in the next section.

```json
{
  "id": "root",
  "layoutOptions": {
    "elk.algorithm": "layered",
    "elk.direction": "RIGHT",
    "elk.spacing.nodeNode": "80",
    "elk.layered.spacing.nodeNodeBetweenLayers": "100",
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.padding": "[top=50,left=50,bottom=50,right=50]"
  },
  "children": [
    { "id": "P-100", "width": 180, "height": 80, "labels": [{ "text": "Dashboard" }], "properties": { "class": "primary-nav" } },
    { "id": "P-110", "width": 180, "height": 60, "labels": [{ "text": "Report View" }] },
    {
      "id": "cluster_A_200",
      "labels": [{ "text": "Projections" }],
      "layoutOptions": { "elk.direction": "DOWN", "elk.spacing.nodeNode": "40" },
      "children": [
        { "id": "P-210", "width": 180, "height": 80, "labels": [{ "text": "Projections Overview" }], "properties": { "class": "primary-nav" } },
        { "id": "P-220", "width": 180, "height": 60, "labels": [{ "text": "Projection" }] },
        { "id": "P-221", "width": 180, "height": 60, "labels": [{ "text": "Fee Schedule Details" }] },
        { "id": "P-222", "width": 180, "height": 60, "labels": [{ "text": "Funding Scenario Details" }] },
        { "id": "P-230", "width": 180, "height": 60, "labels": [{ "text": "Create New Projection" }] }
      ]
    },
    {
      "id": "cluster_A_300",
      "labels": [{ "text": "Current Bills" }],
      "layoutOptions": { "elk.direction": "DOWN" },
      "children": [{ "id": "P-310", "width": 180, "height": 80, "labels": [{ "text": "Current Bills" }], "properties": { "class": "primary-nav" } }]
    },
    {
      "id": "cluster_A_400",
      "labels": [{ "text": "Review" }],
      "layoutOptions": { "elk.direction": "DOWN" },
      "children": [{ "id": "P-410", "width": 180, "height": 80, "labels": [{ "text": "Review Past Bills" }], "properties": { "class": "primary-nav" } }]
    },
    {
      "id": "cluster_A_500",
      "labels": [{ "text": "Accounts" }],
      "layoutOptions": { "elk.direction": "DOWN" },
      "children": [{ "id": "P-510", "width": 180, "height": 80, "labels": [{ "text": "Manage Accounts" }], "properties": { "class": "primary-nav" } }]
    },
    {
      "id": "cluster_A_600",
      "labels": [{ "text": "Fee Schedules" }],
      "layoutOptions": { "elk.direction": "DOWN" },
      "children": [{ "id": "P-610", "width": 180, "height": 80, "labels": [{ "text": "Manage Fee Schedules" }], "properties": { "class": "primary-nav" } }]
    }
  ],
  "edges": [
    { "id": "e1", "sources": ["P-100"], "targets": ["P-110"] },
    { "id": "e2", "sources": ["P-210"], "targets": ["P-220"] },
    { "id": "e3", "sources": ["P-210"], "targets": ["P-230"] },
    { "id": "e4", "sources": ["P-220"], "targets": ["P-221"] },
    { "id": "e5", "sources": ["P-220"], "targets": ["P-222"] },
    { "id": "e6", "sources": ["P-221"], "targets": ["P-220"] },
    { "id": "e7", "sources": ["P-222"], "targets": ["P-220"] },
    { "id": "e8", "sources": ["P-230"], "targets": ["P-220"] }
  ]
}
```

### 4. Why This Matches Real-World Design Conventions

By using `elkjs`, you gain the following "Design-First" features that your current PNG is missing:

* **Orthogonal Edge Routing:** Instead of the curved, overlapping splines seen in your PNG (like the messy lines around `P-220`), `elkjs` will draw clean, 90-degree paths that travel around nodes rather than through them.

* **Port Constraints:** You can force all "primary nav" links to exit from the bottom of a node and enter the top of the next, preventing the "line soup" where edges enter nodes from random angles.

* **Fixed Padding:** You can set `elk.padding: "[top=40,left=20,bottom=20,right=20]"` on your clusters to ensure the "Area" labels (like "Projections") always have a consistent, designed gutter around the inner nodes.

* **Elimination of "Invis" Edges:** You no longer need `style=invis` to hack the layout order. You can use `elk.priority` or simply rely on the hierarchical engine to recognize the natural sequence of your nodes.

### 5. Comparison Table: Visual Improvements

| Issue in your PNG | Graphviz (Current) | ELKJS (Proposed) |
| --- | --- | --- |
| **Top-level alignment** | Mangled due to cluster size variance. | `alignment: CENTER` ensures all clusters sit on a single horizontal axis. |
| **Inner node flow** | Horizontal and messy. | `direction: DOWN` creates a clean, vertical site-map stack inside each area. |
| **Line Style** | Curved splines that cross labels. | `ORTHOGONAL` routing keeps lines in the "gutters" between nodes. |
| **Spacing** | Inconsistent gaps. | Pixel-perfect `nodeNode` and `nodeNodeBetweenLayers` spacing. |

### 6. Best Way to Apply Visual Formatting: CSS

Since your goal is **SVG-based output**, the best way to handle formatting is to decouple the **Structure** (ELK) from the **Skin** (CSS).

#### 6.1 The Workflow

1. **Layout:** Run `elkjs` to get the `x, y, width, height` for every node and edge.
2. **Generate SVG:** Use a simple script (or a tool like D3.js) to create `<rect>` elements for nodes and `<path>` or `<polyline>` elements for edges based on those coordinates.
3. **Inject Classes:** While generating the SVG, check the `properties` field in your ELK JSON and add those as CSS classes to the SVG elements (e.g., `<rect class="node primary-nav" ... />`).
4. **Apply CSS:** Reference an external CSS file or embed a `<style>` block directly inside the SVG.

#### 6.2 Leveraging CSS for "Design" Conventions

SVG is just XML with CSS support. You can use standard CSS to achieve professional design results that Graphviz cannot:

```css
/* Styling the Containers (Areas) */
.cluster {
  fill: #f9f9f9;
  stroke: #d1d1d1;
  stroke-dasharray: 4; /* Dashed border for areas */
  rx: 8; /* Rounded corners! */
}

/* Styling the Places (Screens) */
.node {
  fill: white;
  stroke: #333;
  stroke-width: 1.5px;
  rx: 4;
}

/* Specific formatting for Primary Nav nodes */
.primary-nav {
  fill: #eef2ff;
  stroke: #4f46e5;
  stroke-width: 2px;
}

/* Making edges look like "Design" lines */
.edge {
  fill: none;
  stroke: #94a3b8;
  stroke-width: 2px;
  marker-end: url(#arrowhead); /* Use SVG markers for clean arrows */
}

/* Typography control */
text {
  font-family: 'Public Sans', sans-serif;
  font-size: 14px;
  font-weight: 500;
  fill: #1e293b;
}

```
