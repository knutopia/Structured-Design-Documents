import type { PositionedScene } from "../src/renderer/staged/contracts.js";

export function buildPositionedSvgFixture(themeId = "default"): PositionedScene {
  return {
    viewId: "ia_place_map",
    profileId: "recommended",
    themeId,
    root: {
      kind: "container",
      id: "root",
      role: "diagram_root",
      primitive: "root",
      classes: ["diagram", "ia_place_map"],
      layout: {
        strategy: "stack",
        direction: "horizontal",
        gap: 24,
        crossAlignment: "start"
      },
      chrome: {
        padding: {
          top: 16,
          right: 16,
          bottom: 16,
          left: 16
        },
        gutter: 24,
        headerBandHeight: 0
      },
      headerContent: [],
      children: [
        {
          kind: "container",
          id: "area-A-001",
          role: "top_level_area",
          primitive: "cluster",
          classes: ["area"],
          layout: {
            strategy: "stack",
            direction: "vertical",
            gap: 12,
            crossAlignment: "stretch"
          },
          chrome: {
            padding: {
              top: 12,
              right: 12,
              bottom: 12,
              left: 12
            },
            gutter: 12,
            headerBandHeight: 28
          },
          headerContent: [
            {
              id: "area-title",
              kind: "text",
              textStyleRole: "title",
              lines: ["Checkout Area"],
              x: 12,
              y: 10,
              width: 110.832,
              height: 20,
              lineHeight: 20,
              region: "primary",
              priority: "primary"
            }
          ],
          children: [
            {
              kind: "node",
              id: "P-001",
              role: "place",
              primitive: "card",
              classes: ["place", "top_place"],
              widthPolicy: {
                preferred: "standard",
                allowed: ["standard", "wide"]
              },
              widthBand: "standard",
              overflowPolicy: {
                kind: "escalate_width_band",
                maxLines: 2
              },
              content: [
                {
                  id: "title",
                  kind: "text",
                  textStyleRole: "title",
                  lines: ["Checkout Billing"],
                  x: 12,
                  y: 12,
                  width: 122.352,
                  height: 20,
                  lineHeight: 20,
                  region: "primary",
                  priority: "primary"
                },
                {
                  id: "subtitle",
                  kind: "metadata",
                  textStyleRole: "subtitle",
                  lines: ["/checkout/billing"],
                  x: 12,
                  y: 38,
                  width: 102.434,
                  height: 16,
                  lineHeight: 16,
                  region: "primary",
                  priority: "secondary"
                }
              ],
              ports: [
                {
                  id: "east",
                  role: "primary_out",
                  side: "east",
                  x: 160,
                  y: 36
                }
              ],
              overflow: {
                status: "fits"
              },
              x: 48,
              y: 68,
              width: 160,
              height: 66
            },
            {
              kind: "node",
              id: "status-01",
              role: "status_badge",
              primitive: "badge",
              classes: ["status_chip"],
              widthPolicy: {
                preferred: "chip",
                allowed: ["chip"]
              },
              widthBand: "chip",
              overflowPolicy: {
                kind: "grow_height"
              },
              content: [
                {
                  id: "badge",
                  kind: "badge_text",
                  textStyleRole: "badge",
                  lines: ["Auth"],
                  x: 8,
                  y: 4,
                  width: 40,
                  height: 22,
                  lineHeight: 14,
                  region: "primary",
                  priority: "secondary"
                }
              ],
              ports: [],
              overflow: {
                status: "fits"
              },
              x: 48,
              y: 152,
              width: 88,
              height: 30
            },
            {
              kind: "node",
              id: "note-01",
              role: "annotation",
              primitive: "annotation_list",
              classes: ["annotations"],
              widthPolicy: {
                preferred: "narrow",
                allowed: ["narrow"]
              },
              widthBand: "narrow",
              overflowPolicy: {
                kind: "grow_height"
              },
              content: [
                {
                  id: "annotation",
                  kind: "metadata",
                  textStyleRole: "metadata",
                  lines: ["Uses saved", "card on file"],
                  x: 10,
                  y: 8,
                  width: 70,
                  height: 32,
                  lineHeight: 16,
                  region: "primary",
                  priority: "secondary"
                }
              ],
              ports: [],
              overflow: {
                status: "fits"
              },
              x: 152,
              y: 146,
              width: 96,
              height: 48
            }
          ],
          ports: [
            {
              id: "south",
              role: "primary_out",
              side: "south",
              x: 124,
              y: 184
            }
          ],
          x: 24,
          y: 24,
          width: 248,
          height: 184
        },
        {
          kind: "node",
          id: "P-003",
          role: "place",
          primitive: "card",
          classes: ["place", "top_level"],
          widthPolicy: {
            preferred: "standard",
            allowed: ["standard", "wide"]
          },
          widthBand: "standard",
          overflowPolicy: {
            kind: "clamp_with_ellipsis",
            maxLines: 2
          },
          content: [
            {
              id: "title",
              kind: "text",
              textStyleRole: "title",
              lines: ["Confirmation"],
              x: 12,
              y: 12,
              width: 96.368,
              height: 20,
              lineHeight: 20,
              region: "primary",
              priority: "primary"
            },
            {
              id: "badge",
              kind: "badge_text",
              textStyleRole: "badge",
              lines: ["Live"],
              x: 12,
              y: 38,
              width: 40,
              height: 22,
              lineHeight: 14,
              region: "primary",
              priority: "secondary"
            }
          ],
          ports: [
            {
              id: "west",
              role: "primary_in",
              side: "west",
              x: 0,
              y: 36
            }
          ],
          overflow: {
            status: "fits"
          },
          x: 320,
          y: 68,
          width: 192,
          height: 66
        },
        {
          kind: "node",
          id: "header-01",
          role: "context_header",
          primitive: "header",
          classes: ["context"],
          widthPolicy: {
            preferred: "standard",
            allowed: ["standard"]
          },
          widthBand: "standard",
          overflowPolicy: {
            kind: "grow_height"
          },
          content: [
            {
              id: "title",
              kind: "text",
              textStyleRole: "title",
              lines: ["Payment Step"],
              x: 12,
              y: 10,
              width: 104.4,
              height: 20,
              lineHeight: 20,
              region: "primary",
              priority: "primary"
            },
            {
              id: "subtitle",
              kind: "metadata",
              textStyleRole: "subtitle",
              lines: ["Secure checkout flow"],
              x: 12,
              y: 34,
              width: 118.22,
              height: 16,
              lineHeight: 16,
              region: "primary",
              priority: "secondary"
            }
          ],
          ports: [],
          overflow: {
            status: "fits"
          },
          x: 320,
          y: 164,
          width: 192,
          height: 56
        }
      ],
      ports: [],
      x: 0,
      y: 0,
      width: 560,
      height: 280
    },
    edges: [
      {
        id: "nav-001",
        role: "navigation",
        classes: ["primary_path"],
        from: {
          itemId: "P-001",
          portId: "east",
          x: 208,
          y: 104
        },
        to: {
          itemId: "P-003",
          portId: "west",
          x: 320,
          y: 104
        },
        route: {
          style: "orthogonal",
          points: [
            {
              x: 208,
              y: 104
            },
            {
              x: 248,
              y: 104
            },
            {
              x: 248,
              y: 136
            },
            {
              x: 320,
              y: 136
            },
            {
              x: 320,
              y: 104
            }
          ]
        },
        label: {
          lines: ["Primary path"],
          width: 88,
          height: 22,
          lineHeight: 14,
          textStyleRole: "edge_label",
          x: 224,
          y: 76
        },
        markers: {
          end: "arrow"
        },
        paintGroup: "edges"
      }
    ],
    diagnostics: [
      {
        phase: "backend",
        code: "renderer.backend.synthetic_fixture",
        severity: "info",
        message: "Synthetic positioned scene for staged SVG backend coverage.",
        targetId: "root"
      }
    ],
    decorations: [],
    paintOrder: ["chrome", "nodes", "labels", "edges", "edge_labels"]
  };
}
