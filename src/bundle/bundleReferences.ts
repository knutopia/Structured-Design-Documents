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
  let value = artifactValue(bundle, reference.artifact);
  if (value === undefined) {
    return undefined;
  }

  for (const segment of reference.selector.split(".")) {
    if (!segment || !value || typeof value !== "object" || Array.isArray(value) || !own(value, segment)) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[segment];
  }

  return value;
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
