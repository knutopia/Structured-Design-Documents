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
}

export function buildIaStylePlaceLabelLines(
  parts: PlaceLabelParts,
  options: PlaceLabelOptions = {}
): string[] {
  const lines = [parts.name];

  if (options.includeSubtitle !== false && parts.subtitle) {
    lines.push(parts.subtitle);
  }

  if (options.includeBadge !== false && parts.badge) {
    lines.push(`[${parts.badge}]`);
  }

  if (options.includeMetadata !== false) {
    for (const metadata of parts.metadata ?? []) {
      lines.push(`${metadata.key}: ${metadata.value}`);
    }
  }

  return lines;
}
