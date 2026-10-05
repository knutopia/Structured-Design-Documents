import type { Bundle } from "../bundle/types.js";
import type {
  ContractBindingSpec,
  ContractPurpose,
  ContractResolvedAllowedValue,
  ContractSubjectDetail,
  ContractSubjectId
} from "./contracts.js";
import { createApplyFormatCard, createAuthoringFormatCard } from "./authoringFormat.js";
import { resolveBundleFieldReference } from "../bundle/bundleReferences.js";
import { getContractSubjectDetail, selectContractSubjectDetailForPurpose } from "./contractMetadata.js";

function expectSelector(binding: ContractBindingSpec, expectedSelector: string): void {
  if (binding.bundle_source.selector !== expectedSelector) {
    throw new Error(
      `Contract binding '${binding.binding_id}' expected selector '${expectedSelector}' for artifact '${binding.bundle_source.artifact}', got '${binding.bundle_source.selector}'.`
    );
  }
}

function resolveAllowedValues(
  binding: ContractBindingSpec,
  bundle: Bundle
): ContractResolvedAllowedValue[] {
  switch (binding.bundle_source.artifact) {
    case "syntax_yaml": {
      const value = resolveBundleFieldReference(bundle, {
        artifact: "syntax",
        selector: binding.bundle_source.selector
      });
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Contract binding '${binding.binding_id}' expected a nonempty string at syntax selector '${binding.bundle_source.selector}'.`);
      }
      return [{ value }];
    }
    case "manifest_profiles":
      expectSelector(binding, "profiles");
      return bundle.manifest.profiles.map((profile) => ({
        value: profile.id,
        metadata: {
          intent: profile.intent
        }
      }));

    case "manifest_render_details":
      expectSelector(binding, "render_details");
      return bundle.manifest.render_details.map((detail) => ({
        value: detail.id,
        metadata: {
          intent: detail.intent
        }
      }));

    case "views_yaml":
      expectSelector(binding, "views");
      return bundle.views.views.map((view) => ({
        value: view.id,
        label: view.name,
        metadata: {
          status: view.status,
          ...(bundle.contracts?.diagram_membership ? { named_diagrams_enabled: view.projection?.named_diagrams?.enabled === true } : {})
        }
      }));

    case "vocab_node_types":
      expectSelector(binding, "node_types");
      return bundle.vocab.node_types.map((entry) => ({
        value: entry.token,
        label: entry.description,
        metadata: entry.group ? { group: entry.group } : undefined
      }));

    case "vocab_relationship_types":
      expectSelector(binding, "relationship_types");
      return bundle.vocab.relationship_types.map((entry) => ({
        value: entry.token,
        label: entry.description,
        metadata: entry.group ? { group: entry.group } : undefined
      }));

    default:
      throw new Error(
        `Contract binding '${binding.binding_id}' uses unsupported bundle artifact '${binding.bundle_source.artifact}'.`
      );
  }
}

export function getBundleResolvedContractSubjectDetail(
  subjectId: ContractSubjectId,
  bundle: Bundle
): ContractSubjectDetail | undefined {
  const detail = getContractSubjectDetail(subjectId);
  if (!detail) {
    return undefined;
  }

  detail.bindings = detail.bindings.map((binding) => ({
    ...binding,
    resolved_values: resolveAllowedValues(binding, bundle)
  }));
  detail.resolution = {
    mode: "bundle_resolved",
    bundle_name: bundle.manifest.bundle_name,
    bundle_version: bundle.manifest.bundle_version,
    manifest_path: bundle.manifestPath,
    language_version: bundle.manifest.language_version
  };
  if (subjectId === "helper.command.author") {
    detail.authoring_format_card = createAuthoringFormatCard(bundle);
  } else if (subjectId === "helper.command.apply") {
    detail.authoring_format_card = createApplyFormatCard(bundle);
  }
  const membership = bundle.contracts?.diagram_membership;
  if (membership && detail.authoring_format_card) {
    detail.authoring_format_card.lines.push(
      `Named metadata declarations use ${membership.declaration_type}; required ${membership.type_property} selects an enabled bundle view.`,
      `Assign nodes or exact edge declarations through ${membership.membership_property}. Separate multiple references with ${JSON.stringify(membership.references.delimiter)}; edited lists are sorted and unique. Remove the property to clear membership.`,
      "Use set_edge_property/remove_edge_property on the current revision's edge handle. Invalid assignments reject the entire candidate without writing."
    );
  }

  return detail;
}

export function getBundleResolvedContractSubjectDetailForPurpose(
  subjectId: ContractSubjectId,
  bundle: Bundle,
  purpose: ContractPurpose
): ContractSubjectDetail | undefined {
  const detail = getBundleResolvedContractSubjectDetail(subjectId, bundle);
  return detail ? selectContractSubjectDetailForPurpose(detail, purpose) : undefined;
}
