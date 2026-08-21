export function normalizeStage3SceneProfileMetadata<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeStage3SceneProfileMetadata(entry)) as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "profileId")
        .map(([key, entry]) => [key, normalizeStage3SceneProfileMetadata(entry)])
    ) as T;
  }
  return value;
}

export function normalizeStage3SvgProfileMetadata(svg: string): string {
  return svg
    .replace(/\sdata-profile-id="[^"]*"/g, "")
    .replace(/class="([^"]*)"/g, (_match, classes: string) => {
      const retained = classes.split(/\s+/).filter((token) => token && !token.startsWith("profile-"));
      return `class="${retained.join(" ")}"`;
    });
}
