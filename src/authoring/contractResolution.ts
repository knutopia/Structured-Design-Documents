import type { Bundle } from "../bundle/types.js";
import type {
  ContractBindingSpec,
  ContractResolvedAllowedValue,
  ContractSubjectDetail,
  ContractSubjectId
} from "./contracts.js";
import { getContractSubjectDetail } from "./contractMetadata.js";

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
    case "manifest_profiles":
      expectSelector(binding, "profiles");
      return bundle.manifest.profiles.map((profile) => ({
        value: profile.id,
        metadata: {
          intent: profile.intent
        }
      }));

    case "views_yaml":
      expectSelector(binding, "views");
      return bundle.views.views.map((view) => ({
        value: view.id,
        label: view.name,
        metadata: {
          status: view.status
        }
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
    bundle_version: bundle.manifest.bundle_version
  };

  return detail;
}
