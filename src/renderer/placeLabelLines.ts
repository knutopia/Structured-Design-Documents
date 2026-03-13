import type { ResolvedProfileDisplayPolicy } from "./profileDisplay.js";
import { readBooleanProfileDisplaySetting } from "./profileDisplay.js";

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
  displayPolicy?: ResolvedProfileDisplayPolicy;
}

export interface ResolvedPlaceLabelDisplayOptions {
  showPlaceRouteOrKey: boolean;
  showPlaceAccess: boolean;
  showPlaceEntryPoints: boolean;
  showPlacePrimaryNav: boolean;
}

export function resolvePlaceLabelDisplayOptions(
  policy: ResolvedProfileDisplayPolicy = {}
): ResolvedPlaceLabelDisplayOptions {
  return {
    showPlaceRouteOrKey: readBooleanProfileDisplaySetting(policy, "show_place_route_or_key", true),
    showPlaceAccess: readBooleanProfileDisplaySetting(policy, "show_place_access", true),
    showPlaceEntryPoints: readBooleanProfileDisplaySetting(policy, "show_place_entry_points", true),
    showPlacePrimaryNav: readBooleanProfileDisplaySetting(policy, "show_place_primary_nav", true)
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
  options: PlaceLabelOptions = {}
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
