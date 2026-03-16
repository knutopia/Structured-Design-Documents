import type { RendererDiagnostic } from "./diagnostics.js";

export type SceneContainerPrimitive = "root" | "cluster" | "lane" | "stack" | "grid";
export type SceneNodePrimitive =
  | "card"
  | "header"
  | "badge"
  | "label"
  | "annotation_list"
  | "edge_label"
  | "connector_port";
export type LayoutStrategy = "stack" | "grid" | "lanes" | "elk_layered" | "manual";
export type LayoutDirection = "horizontal" | "vertical";
export type CrossAlignment = "start" | "center" | "stretch";
export type WidthBand = "chip" | "narrow" | "standard" | "wide";
export type OverflowPolicyKind =
  | "grow_height"
  | "escalate_width_band"
  | "clamp_with_ellipsis"
  | "secondary_area"
  | "diagnostic";
export type OverflowStatus = "fits" | "clamped" | "escalated_width_band" | "overflowed";
export type ContentBlockKind = "text" | "badge_text" | "metadata" | "edge_label";
export type ContentPriority = "primary" | "secondary";
export type ContentRegion = "primary" | "secondary";
export type PortSide = "north" | "south" | "east" | "west";
export type RoutingStyle = "orthogonal" | "straight" | "stepped";
export type PreferredAxis = "horizontal" | "vertical";
export type PaintGroup = "chrome" | "nodes" | "labels" | "edges" | "edge_labels";
export type EdgeMarkerKind = "none" | "arrow";

export interface BoxSpacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayoutIntent {
  strategy: LayoutStrategy;
  direction?: LayoutDirection;
  gap?: number;
  crossAlignment?: CrossAlignment;
  columns?: number;
}

export interface ChromeSpec {
  padding: BoxSpacing;
  gutter?: number;
  headerBandHeight?: number;
}

export interface WidthPolicy {
  preferred: WidthBand;
  allowed: WidthBand[];
}

export interface OverflowPolicy {
  kind: OverflowPolicyKind;
  maxLines?: number;
}

export interface ContentBlock {
  id: string;
  kind: ContentBlockKind;
  text: string;
  textStyleRole: string;
  priority?: ContentPriority;
}

export interface PortSpec {
  id: string;
  role: string;
  side: PortSide;
  offset?: number;
}

export interface SceneEdgeEndpoint {
  itemId: string;
  portId?: string;
}

export interface RoutingIntent {
  style: RoutingStyle;
  avoidNodeBoxes?: boolean;
  preferAxis?: PreferredAxis;
  sourcePortRole?: string;
  targetPortRole?: string;
}

export interface EdgeLabelSpec {
  text: string;
  textStyleRole: string;
}

export interface EdgeMarkers {
  start?: EdgeMarkerKind;
  end?: EdgeMarkerKind;
}

export interface SceneContainer {
  kind: "container";
  id: string;
  role: string;
  primitive: SceneContainerPrimitive;
  classes: string[];
  layout: LayoutIntent;
  chrome: ChromeSpec;
  children: SceneItem[];
  ports: PortSpec[];
}

export interface SceneNode {
  kind: "node";
  id: string;
  role: string;
  primitive: SceneNodePrimitive;
  classes: string[];
  widthPolicy: WidthPolicy;
  overflowPolicy: OverflowPolicy;
  content: ContentBlock[];
  ports: PortSpec[];
}

export type SceneItem = SceneContainer | SceneNode;

export interface SceneEdge {
  id: string;
  role: string;
  classes: string[];
  from: SceneEdgeEndpoint;
  to: SceneEdgeEndpoint;
  routing: RoutingIntent;
  label?: EdgeLabelSpec;
  markers?: EdgeMarkers;
}

export interface RendererScene {
  viewId: string;
  profileId: string;
  themeId: string;
  root: SceneContainer;
  edges: SceneEdge[];
  diagnostics: RendererDiagnostic[];
}

export interface MeasuredPort {
  id: string;
  role: string;
  side: PortSide;
  offset?: number;
  x: number;
  y: number;
}

export interface MeasuredContentBlock {
  id: string;
  kind: ContentBlockKind;
  textStyleRole: string;
  lines: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  lineHeight: number;
  region: ContentRegion;
  wasClamped?: boolean;
  priority?: ContentPriority;
}

export interface OverflowResult {
  status: OverflowStatus;
  detail?: string;
}

export interface MeasuredContainer {
  kind: "container";
  id: string;
  role: string;
  primitive: SceneContainerPrimitive;
  classes: string[];
  layout: LayoutIntent;
  chrome: ChromeSpec;
  children: MeasuredItem[];
  ports: MeasuredPort[];
  width: number;
  height: number;
}

export interface MeasuredNode {
  kind: "node";
  id: string;
  role: string;
  primitive: SceneNodePrimitive;
  classes: string[];
  widthPolicy: WidthPolicy;
  widthBand: WidthBand;
  overflowPolicy: OverflowPolicy;
  content: MeasuredContentBlock[];
  ports: MeasuredPort[];
  overflow: OverflowResult;
  width: number;
  height: number;
}

export type MeasuredItem = MeasuredContainer | MeasuredNode;

export interface MeasuredEdgeEndpoint {
  itemId: string;
  portId?: string;
  x: number;
  y: number;
}

export interface MeasuredEdgeLabel {
  lines: string[];
  width: number;
  height: number;
  lineHeight: number;
  textStyleRole: string;
}

export interface MeasuredEdge {
  id: string;
  role: string;
  classes: string[];
  from: MeasuredEdgeEndpoint;
  to: MeasuredEdgeEndpoint;
  routing: RoutingIntent;
  label?: MeasuredEdgeLabel;
  markers?: EdgeMarkers;
}

export interface MeasuredScene {
  viewId: string;
  profileId: string;
  themeId: string;
  root: MeasuredContainer;
  edges: MeasuredEdge[];
  diagnostics: RendererDiagnostic[];
}

export interface Point {
  x: number;
  y: number;
}

export interface PositionedContainer {
  kind: "container";
  id: string;
  role: string;
  primitive: SceneContainerPrimitive;
  classes: string[];
  layout: LayoutIntent;
  chrome: ChromeSpec;
  children: PositionedItem[];
  ports: MeasuredPort[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedNode {
  kind: "node";
  id: string;
  role: string;
  primitive: SceneNodePrimitive;
  classes: string[];
  widthPolicy: WidthPolicy;
  widthBand: WidthBand;
  overflowPolicy: OverflowPolicy;
  content: MeasuredContentBlock[];
  ports: MeasuredPort[];
  overflow: OverflowResult;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PositionedItem = PositionedContainer | PositionedNode;

export interface PositionedEdgeEndpoint {
  itemId: string;
  portId?: string;
  x: number;
  y: number;
}

export interface PositionedRoute {
  style: RoutingStyle;
  points: Point[];
}

export interface PositionedEdgeLabel {
  lines: string[];
  width: number;
  height: number;
  lineHeight: number;
  textStyleRole: string;
  x: number;
  y: number;
}

export interface PositionedEdge {
  id: string;
  role: string;
  classes: string[];
  from: PositionedEdgeEndpoint;
  to: PositionedEdgeEndpoint;
  route: PositionedRoute;
  label?: PositionedEdgeLabel;
  markers?: EdgeMarkers;
  paintGroup: PaintGroup;
}

export interface PositionedScene {
  viewId: string;
  profileId: string;
  themeId: string;
  root: PositionedContainer;
  edges: PositionedEdge[];
  diagnostics: RendererDiagnostic[];
  paintOrder: PaintGroup[];
}
