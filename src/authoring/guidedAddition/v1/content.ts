import type { GuidanceRelationshipRecord } from "../catalog.js";
import type { EndpointTripleV1, ExistingNodeRefV1 } from "./contracts.js";

export function nodeLabel(node: ExistingNodeRefV1): string {
  return `${node.node_id}: ${node.name}`;
}

export function relationshipSentence(
  relationship: GuidanceRelationshipRecord,
  triple: EndpointTripleV1,
  anchor: ExistingNodeRefV1,
  direction: "outgoing" | "incoming",
  remote?: ExistingNodeRefV1
): string {
  const remoteType = direction === "outgoing" ? triple.to_type : triple.from_type;
  const remoteName = remote?.name ?? `a ${remoteType}`;
  const sourceName = direction === "outgoing" ? anchor.name : remoteName;
  const targetName = direction === "outgoing" ? remoteName : anchor.name;
  switch (relationship.type) {
    case "CONTAINS":
      return direction === "outgoing"
        ? `Put ${remoteName} inside ${anchor.name}.`
        : `Put ${anchor.name} inside ${remoteName}.`;
    case "COMPOSED_OF":
      return `Make ${remoteName} part of ${anchor.name}.`;
    case "NAVIGATES_TO":
      return direction === "outgoing"
        ? `Navigate from ${anchor.name} to ${remoteName}.`
        : `Navigate from ${remoteName} to ${anchor.name}.`;
    case "CONSTRAINED_BY":
      return `Apply ${remoteName} to ${anchor.name}.`;
    default:
      return relationship.meaning ?? `${sourceName} connects to ${targetName}.`;
  }
}

export function joinedTypes(types: string[]): string {
  if (types.length < 2) return types[0] ?? "";
  if (types.length === 2) return `${types[0]} and ${types[1]}`;
  return `${types.slice(0, -1).join(", ")}, and ${types.at(-1)}`;
}
