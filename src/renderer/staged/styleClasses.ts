function tokenizeStyle(style: string | undefined): string[] {
  return (style ?? "")
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
}

export function buildChromeStyleClasses(style: string | undefined): string[] {
  const tokens = tokenizeStyle(style);
  const classes: string[] = [];

  if (tokens.includes("dashed")) {
    classes.push("chrome-dashed");
  }
  if (tokens.includes("dotted")) {
    classes.push("chrome-dotted");
  }

  return classes;
}

export function buildEdgeStyleClasses(style: string | undefined): string[] {
  const tokens = tokenizeStyle(style);
  const classes: string[] = [];

  if (tokens.includes("dashed")) {
    classes.push("edge-dashed");
  }
  if (tokens.includes("dotted")) {
    classes.push("edge-dotted");
  }

  return classes;
}
