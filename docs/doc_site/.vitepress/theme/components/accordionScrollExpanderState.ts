export interface AccordionScrollSelection {
  sectionCount: number
  trackTop: number
  trackHeight: number
  stageHeight: number
  activationLine: number
}

/**
 * Maps stable scroll-track progress to a section index. The track never
 * changes height when content changes, so selection cannot react to its own
 * rendering and the final segment always belongs to the final section.
 */
export function selectAccordionSection({
  sectionCount,
  trackTop,
  trackHeight,
  stageHeight,
  activationLine
}: AccordionScrollSelection): number {
  if (sectionCount <= 0 || trackTop >= activationLine) {
    return -1
  }

  const scrollableDistance = Math.max(trackHeight - stageHeight, 1)
  const consumedDistance = activationLine - trackTop
  const progress = Math.min(
    Math.max(consumedDistance / scrollableDistance, 0),
    1
  )

  return Math.min(Math.floor(progress * sectionCount), sectionCount - 1)
}
