import type { ProjectionNodeAnnotation } from "../projector/types.js";
import type { ResolvedDetailDisplayPolicy } from "./detailDisplay.js";
import { readBooleanDetailDisplaySetting } from "./detailDisplay.js";

export interface ReferenceAttribute {
  groupId: string;
  label: string;
  value: string;
}

export function buildRelationshipReferenceAttributes(
  annotation: ProjectionNodeAnnotation | undefined,
  policy: ResolvedDetailDisplayPolicy
): ReferenceAttribute[] {
  return (annotation?.references ?? [])
    .filter((reference) => reference.detail_setting && readBooleanDetailDisplaySetting(policy, reference.detail_setting))
    .map((reference) => ({
      groupId: reference.group ?? reference.role,
      label: reference.label ?? reference.role,
      value: reference.target_name ? `${reference.target_name} (${reference.target_id})` : reference.target_id
    }));
}

export function referenceAttributeLabelLines(attributes: readonly ReferenceAttribute[]): string[] {
  return attributes.map((attribute) => `${attribute.label}: ${attribute.value}`);
}
