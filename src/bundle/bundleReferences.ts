import type { Bundle, BundleFieldReference, ProfileRule } from "./types.js";

const own = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

function artifactValue(bundle: Bundle, artifact: string): unknown {
  switch (artifact) {
    case "manifest":
      return bundle.manifest;
    case "vocab":
      return bundle.vocab;
    case "syntax":
      return bundle.syntax;
    case "schema":
      return bundle.schema;
    case "projection_schema":
      return bundle.projectionSchema;
    case "contracts":
      return bundle.contracts;
    case "views":
      return bundle.views;
    case "profiles":
      return bundle.profiles;
    case "authoring":
      return bundle.authoring;
    default:
      return undefined;
  }
}

export function resolveBundleFieldReference(bundle: Bundle, reference: BundleFieldReference): unknown {
  if (!reference || typeof reference.artifact !== "string" || typeof reference.selector !== "string" || !reference.selector) return undefined;
  if (reference.where && (typeof reference.where.selector !== "string" || !reference.where.selector
    || !["string", "number", "boolean"].includes(typeof reference.where.equals))) return undefined;
  const visit = (value: unknown, segments: string[]): unknown => {
    if (segments.length === 0) return value;
    const [segment, ...rest] = segments;
    if (segment === "*") {
      if (!Array.isArray(value)) return undefined;
      let selected = value;
      if (reference.where) {
        const predicates = value.map((entry) => {
          let candidate: unknown = entry;
          for (const key of reference.where!.selector.split(".")) {
            if (!candidate || typeof candidate !== "object" || Array.isArray(candidate) || !own(candidate, key)) return { found: false };
            candidate = (candidate as Record<string, unknown>)[key];
          }
          return { found: true, value: candidate };
        });
        if (value.length && predicates.every((predicate) => !predicate.found)) return undefined;
        selected = value.filter((_entry, index) => predicates[index]?.found && predicates[index]?.value === reference.where!.equals);
      }
      const results = selected.map((entry) => visit(entry, rest));
      return results.some((entry) => entry === undefined) ? undefined : results;
    }
    if (!segment || !value || typeof value !== "object" || Array.isArray(value) || !own(value, segment)) return undefined;
    return visit((value as Record<string, unknown>)[segment], rest);
  };
  return visit(artifactValue(bundle, reference.artifact), reference.selector.split("."));
}

export function resolveProfileRuleField<T = unknown>(bundle: Bundle, rule: ProfileRule, field: string): T | undefined {
  const hasInlineValue = own(rule, field);
  const reference = rule.bundle_refs?.[field];

  if (hasInlineValue && reference) {
    throw new Error(`Profile rule '${rule.id}' declares both inline '${field}' and bundle_refs.${field}`);
  }

  if (reference) {
    return resolveBundleFieldReference(bundle, reference) as T | undefined;
  }

  return hasInlineValue ? (rule[field] as T) : undefined;
}
