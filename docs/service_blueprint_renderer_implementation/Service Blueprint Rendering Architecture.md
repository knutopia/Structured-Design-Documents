# **Possible Architecture: Service Blueprint Rendering Pipeline**

## **1\. Executive Summary**

This document outlines the rendering pipeline for the service\_blueprint diagram type within the Structured Design Documents (SDD) project. The solution uses elkjs (Eclipse Layout Kernel) to transform intermediate YAML structures into fully routed, highly structured SVG service blueprints.  
**Core Philosophy:** Following the "Hybrid Blueprint Grid" strategy, we must recognize that ELK optimizes directed graphs, not strict row-and-column grids. We cannot treat ELK as a magic swimlane engine. Instead, SDD conventions own the grid assignments (lanes as absolute Y-coordinate rows), while ELK owns the left-to-right chronological ordering, crossing minimization, and orthogonal path geometry.  
The strategy relies on the ELK layered algorithm using a **Flat Graph Topology**, heavily constrained by **In-Layer Alignment Constraints** (for vertical synchronization), **Model Ordering**, and **Strict Port Configurations**.

## **2\. Pipeline Orchestration**

The rendering pipeline orchestrates the YAML-to-SVG transformation in four distinct phases:

1. **Graph Ingestion & Normalization:** Parse the YAML projection. Resolve aliases (e.g., customer-visible \-\> frontstage). Determine the intended horizontal lane for each Node, translating these into target Y-coordinate bands for post-layout snapping or semi-interactive hints.  
2. **Concurrency Band Alignment:** Traverse the graph to identify nodes that happen simultaneously (e.g., a backstage Process supporting a specific customer Step). Use ELK's inLayerPredOf or inLayerSuccOf constraints to lock them into the same vertical column.  
3. **ELK Graph Construction:** Build a flat elkjs graph object (all visible nodes as direct children of the root). Inject in-layer constraints, detailed FIXED\_ORDER port definitions, and edge routing priorities based on edge families (PRECEDES vs support edges).  
4. **SVG Assembly & Grid Snapping:** Iterate over the finalized ELK layout using ROOT coordinates. Apply a blueprint-specific pass to snap nodes into their designated horizontal lane rows (preserving ELK's X-coordinates and routing paths as much as possible), draw the background lane rectangles, render the nodes, and draw text labels.

## **3\. ELK Layout Strategy & Core Configuration**

To force ELK into a consistent left-to-right flow while allowing for custom lane rows during rendering, the root node utilizes a flat topology with model-order preservation.

### **3.1 Root Graph Configuration**

const rootGraph \= {  
  id: "root",  
  layoutOptions: {  
    "elk.algorithm": "layered",  
    "elk.direction": "RIGHT", // Primary flow is left to right  
      
    // Coordinate System (Crucial for easy SVG rendering)  
    "elk.json.shapeCoords": "ROOT",  
    "elk.json.edgeCoords": "ROOT",  
      
    // Model Order Preservation (Honor the YAML author's intent)  
    "elk.layered.considerModelOrder.strategy": "NODES\_AND\_EDGES",  
    "elk.layered.crossingMinimization.forceNodeModelOrder": "true",  
    "elk.layered.considerModelOrder.portModelOrder": "true",  
    "elk.layered.nodePlacement.favorStraightEdges": "true",  
      
    // Semi-Interactive Hinting (Allows passing expected Y-positions)  
    "elk.layered.crossingMinimization.semiInteractive": "true",  
      
    // Global Topology  
    "elk.separateConnectedComponents": "false", // Keep orphans in the main grid  
      
    // Spacing, Padding, and Margins  
    "elk.padding": "\[left=24,top=24,right=24,bottom=24\]",  
    "elk.spacing.nodeNode": "24",  
    "elk.layered.spacing.nodeNodeBetweenLayers": "72",  
    "elk.spacing.edgeNode": "18",  
    "elk.layered.spacing.edgeNodeBetweenLayers": "18",  
    "elk.spacing.edgeEdge": "12",  
      
    // Edge & Port Routing  
    "elk.edgeRouting": "ORTHOGONAL",  
    "elk.portConstraints": "FIXED\_ORDER" // Forces ELK to respect precise port indexing  
  },  
  children: \[\], // Flat graph: all nodes are placed here  
  edges: \[\]  
};

### **3.2 Resolving Lanes via Position Hints**

Because ELK's 1D partitioning splits along the layout direction (creating columns when direction=RIGHT), we cannot use partitioning for horizontal lanes. Instead, map nodes to a Y-coordinate hint to guide ELK's crossing minimization.  
const resolveLaneAlias \= (laneRaw: string, yamlConfig: any): string \=\> {  
  const aliases \= yamlConfig.conventions.renderer\_defaults.aliases || {};  
  return aliases\[laneRaw\] || laneRaw;  
};

// Map lanes to roughly expected Y coordinates (e.g., 100px per lane)  
const laneYMap \= {  
  "customer": 100,  
  "frontstage": 200,  
  "backstage": 300,  
  "support": 400,  
  "system": 500,  
  "policy": 600  
};

When constructing ELK nodes, supply the target Y position:  
const elkNode \= {  
  id: node.id,  
  width: 150,  
  height: 60,  
  layoutOptions: {  
    // Hint to the semiInteractive crossing minimizer about desired row  
    "elk.position": \`(0, ${laneYMap\[resolveLaneAlias(node.lane, yamlConfig)\]})\`  
  }  
};

## **4\. Vertical Synchronization (Concurrency Bands)**

To ensure that related actions across different lanes stack cleanly in the same column (rather than drifting left or right based on edge weights), use ELK's in-layer constraints.

### **The In-Layer Chaining Algorithm**

Instead of trying to force output layer IDs as inputs, chain related nodes together:

1. Identify the primary timeline nodes (usually the Step nodes connected by PRECEDES). Let ELK layer these naturally.  
2. For any support node (Process, SystemAction) connected via REALIZED\_BY or DEPENDS\_ON, force it into the same layout column as its parent step.

// If 'backstage\_process\_1' supports 'customer\_step\_1':  
const elkNodeSupport \= {  
  id: "backstage\_process\_1",  
  width: 150,  
  height: 60,  
  layoutOptions: {  
    "elk.layered.crossingMinimization.inLayerSuccOf": "customer\_step\_1"  
  }  
};

*Result: ELK guarantees that backstage\_process\_1 sits in the exact same vertical concurrency band as customer\_step\_1.*

## **5\. Connector Routing, Ports, and Edge Families**

Different edge families (PRECEDES vs READS) must be treated differently to prevent spaghetti diagrams.

### **5.1 Explicit Port Definitions**

Primary flow is not "just another edge". Cross-lane support edges should not fight for the same anonymous node boundary. We use FIXED\_ORDER with explicit indices.  
const elkNode \= {  
  id: node.id,  
  // ... dimensions and layout options ...  
  ports: \[  
    {   
      id: \`${node.id}:flow-in\`,   
      layoutOptions: { "elk.port.side": "WEST", "elk.port.index": "0" }   
    },  
    {   
      id: \`${node.id}:flow-out\`,   
      layoutOptions: { "elk.port.side": "EAST", "elk.port.index": "1" }   
    },  
    {   
      id: \`${node.id}:up\`,   
      layoutOptions: { "elk.port.side": "NORTH", "elk.port.index": "2" }   
    },  
    {   
      id: \`${node.id}:down\`,   
      layoutOptions: {   
        "elk.port.side": "SOUTH",   
        "elk.port.index": "3",  
        "elk.layered.allowNonFlowPortsToSwitchSides": "false"   
      }   
    }  
  \]  
};

### **5.2 Edge-to-Port Logic & Priorities**

Map edges to ports based on their semantic meaning, and assign routing priorities:

* **Sequence Edges (PRECEDES):** Connect flow-out (East) to flow-in (West). Give them maximum priority so they stay short and straight.  
  * elk.layered.priority.shortness: 10  
  * elk.layered.priority.straightness: 10  
* **Cross-Lane / Data Dependencies (REALIZED\_BY, READS, WRITES):** Connect down (South) or up (North). Allow them to dogleg orthogonally around the primary flow.  
  * elk.layered.priority.shortness: 1  
  * elk.layered.priority.straightness: 1

*Note: Keep elk.layered.mergeEdges: false by default so distinct semantic edges (READS vs WRITES) remain visibly separate.*

### **5.3 Edge Label Placement**

ELK **does not** estimate text size for you. The label's placement options must be nested inside the specific label object, not on the edge itself.  
const elkEdge \= {  
  id: \`e\_${source.id}\_${target.id}\`,  
  sources: \[\`${source.id}:${sourcePort}\`\],  
  targets: \[\`${target.id}:${targetPort}\`\],  
  labels: config.show\_secondary\_edge\_labels ? \[  
    {   
      text: edge.type,   
      width: estimateTextWidth(edge.type),   
      height: 14,  
      layoutOptions: {  
        "elk.edgeLabels.placement": "CENTER"   
      }  
    }  
  \] : \[\]  
};

## **6\. SVG Rendering & Visual Alignment**

Because we requested "elk.json.shapeCoords": "ROOT" and "elk.json.edgeCoords": "ROOT", elk.layout(rootGraph) returns absolute global coordinates for everything.

### **6.1 Drawing the Background Lanes & Snapping**

Since we rely on a Flat Graph with Y-hints, the renderer owns the final lane geometry:

1. **Calculate Fixed Rows:** Define rigid horizontal rows for each lane based on the maximum node height and desired padding.  
2. **Draw SVG Lanes:** Draw full-width \<rect\> elements using these calculated fixed bounds.  
3. **Snap Nodes (Optional but Recommended):** While ELK handles the X-coordinates beautifully, its calculated Y-coordinates might float slightly. Simply override the node's y coordinate to the vertical center of its designated rigid lane during SVG generation.  
4. **Draw Edges:** Extract sections and bendPoints from the ELK edge objects. Path geometry remains valid even after minor Y-snapping, allowing you to draw orthogonal Manhattan-style paths.

## **7\. ELK Configuration Cheat Sheet**

| Property | Applied To | Value | Purpose |
| :---- | :---- | :---- | :---- |
| elk.algorithm | Root | layered | Enables sequential flow layout |
| elk.json.shapeCoords | Root | ROOT | Simplifies SVG rendering |
| elk.layered.crossingMinimization.semiInteractive | Root | true | Allows elk.position to hint desired rows |
| elk.layered.considerModelOrder.strategy | Root | NODES\_AND\_EDGES | Preserves YAML author order |
| elk.edgeRouting | Root | ORTHOGONAL | Generates clean dogleg lines |
| elk.portConstraints | Root/Node | FIXED\_ORDER | Forces strict use of N/S/E/W ports |
| elk.position | Node | (x, y) | Hints the target horizontal lane |
| elk.layered.crossingMinimization.inLayerSuccOf | Node | \[nodeId\] | Forces node into same vertical column as peer |
| elk.port.side | Port | NORTH/SOUTH/EAST/WEST | Defines anchor sides |
| elk.port.index | Port | \[integer\] | Explicit ordering of ports on a node |
| elk.layered.priority.straightness | Edge | 1-10 | Higher value \= straighter line (use for PRECEDES) |
| elk.edgeLabels.placement | Label | CENTER | Positions label nicely on the route |

