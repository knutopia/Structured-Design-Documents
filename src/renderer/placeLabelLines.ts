import type { ResolvedDetailDisplayPolicy } from "./detailDisplay.js";
import { readBooleanDetailDisplaySetting } from "./detailDisplay.js";

export interface PlaceLabelMetadata {
  key: string;
  value: string;
}

export interface PlaceLabelParts {
  name: string;
  subtitle?: string;
  badge?: string;
  metadata?: PlaceLabelMetadata[];
}

export interface PlaceLabelOptions {
  includeSubtitle?: boolean;
  includeBadge?: boolean;
  includeMetadata?: boolean;
  displayPolicy: ResolvedDetailDisplayPolicy;
}

export interface ResolvedPlaceLabelDisplayOptions {
  showPlaceRouteOrKey: boolean;
  showPlaceAccess: boolean;
  showPlaceEntryPoints: boolean;
  showPlacePrimaryNav: boolean;
}

export function resolvePlaceLabelDisplayOptions(
  policy: ResolvedDetailDisplayPolicy
): ResolvedPlaceLabelDisplayOptions {
  return {
    showPlaceRouteOrKey: readBooleanDetailDisplaySetting(policy, "show_place_route_or_key"),
    showPlaceAccess: readBooleanDetailDisplaySetting(policy, "show_place_access"),
    showPlaceEntryPoints: readBooleanDetailDisplaySetting(policy, "show_place_entry_points"),
    showPlacePrimaryNav: readBooleanDetailDisplaySetting(policy, "show_place_primary_nav")
  };
}

function shouldIncludeMetadata(
  metadata: PlaceLabelMetadata,
  displayOptions: ResolvedPlaceLabelDisplayOptions
): boolean {
  switch (metadata.key) {
    case "entry_points":
      return displayOptions.showPlaceEntryPoints;
    case "primary_nav":
      return displayOptions.showPlacePrimaryNav;
    default:
      return true;
  }
}

export function buildIaStylePlaceLabelLines(
  parts: PlaceLabelParts,
  options: PlaceLabelOptions
): string[] {
  const displayOptions = resolvePlaceLabelDisplayOptions(options.displayPolicy);
  const lines = [parts.name];

  if (options.includeSubtitle !== false && displayOptions.showPlaceRouteOrKey && parts.subtitle) {
    lines.push(parts.subtitle);
  }

  if (options.includeBadge !== false && displayOptions.showPlaceAccess && parts.badge) {
    lines.push(`[${parts.badge}]`);
  }

  if (options.includeMetadata !== false) {
    for (const metadata of (parts.metadata ?? []).filter((entry) => shouldIncludeMetadata(entry, displayOptions))) {
      lines.push(`${metadata.key}: ${metadata.value}`);
    }
  }

  return lines;
}
