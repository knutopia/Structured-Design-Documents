import type { ContentBlock } from "./contracts.js";

interface LabelLineContentOptions {
  titleTextStyleRole?: string;
  defaultTextStyleRole?: string;
}

function normalizeLabelLine(line: string): string {
  return line.trim();
}

function buildBlockId(idPrefix: string, index: number): string {
  return `${idPrefix}__line_${index}`;
}

export function buildContentBlocksFromLabelLines(
  idPrefix: string,
  labelLines: readonly string[],
  options: LabelLineContentOptions = {}
): ContentBlock[] {
  const titleTextStyleRole = options.titleTextStyleRole ?? "title";
  const defaultTextStyleRole = options.defaultTextStyleRole ?? "label";

  return labelLines
    .map((line) => normalizeLabelLine(line))
    .filter((line) => line.length > 0)
    .map((line, index): ContentBlock => {
      if (index === 0) {
        return {
          id: buildBlockId(idPrefix, index),
          kind: "text",
          text: line,
          textStyleRole: titleTextStyleRole,
          priority: "primary"
        };
      }

      if (line.startsWith("[") && line.endsWith("]") && line.length > 2) {
        return {
          id: buildBlockId(idPrefix, index),
          kind: "badge_text",
          text: line.slice(1, -1),
          textStyleRole: "badge",
          priority: "secondary"
        };
      }

      if (line.startsWith("/")) {
        return {
          id: buildBlockId(idPrefix, index),
          kind: "text",
          text: line,
          textStyleRole: "subtitle",
          priority: "secondary"
        };
      }

      if (/^[^:=\s][^:=]*[:=]\s*.+$/.test(line)) {
        return {
          id: buildBlockId(idPrefix, index),
          kind: "metadata",
          text: line,
          textStyleRole: "metadata",
          priority: "secondary"
        };
      }

      return {
        id: buildBlockId(idPrefix, index),
        kind: "text",
        text: line,
        textStyleRole: defaultTextStyleRole,
        priority: "secondary"
      };
    });
}
