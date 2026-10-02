import type { JourneyRenderStep } from "./journeyMapRenderModel.js";

export function buildLegacyJourneyStepLabelLines(step: JourneyRenderStep): string[] {
  return [
    step.title,
    ...step.references.map((reference) => reference.relationshipReference ? `${reference.label}: ${reference.value}` : `[${reference.value}]`)
  ];
}
