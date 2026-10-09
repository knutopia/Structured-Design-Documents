import type { SyntaxTokenSource } from "./types.js";

export function tokenDeprecationErrors(
  config: SyntaxTokenSource,
  acceptedTokens: string[],
  caseSensitive: boolean
): string[] {
  const deprecated = config.deprecated_tokens;
  if (deprecated === undefined) return [];
  if (!deprecated || typeof deprecated !== "object" || Array.isArray(deprecated)) {
    return ["deprecated_tokens must be an object"];
  }
  const normalize = (token: string) => caseSensitive ? token : token.toLowerCase();
  const accepted = new Set(acceptedTokens.map(normalize));
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const [token, diagnostic] of Object.entries(deprecated)) {
    if (!token || /\s/.test(token)) errors.push(`Invalid deprecated token '${token}'`);
    if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)
      || typeof diagnostic.code !== "string" || !diagnostic.code.trim()
      || typeof diagnostic.message !== "string" || !diagnostic.message.trim()) {
      errors.push(`Deprecated token '${token}' must have a non-empty diagnostic code and message`);
    }
    const normalized = normalize(token);
    if (accepted.has(normalized)) errors.push(`Deprecated token '${token}' is also accepted`);
    if (seen.has(normalized)) errors.push(`Deprecated token '${token}' is ambiguous under the casing policy`);
    seen.add(normalized);
  }
  return errors;
}
