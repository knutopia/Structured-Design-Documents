import { describe, expect, it } from 'vitest'
import { selectAccordionSection } from '../docs/doc_site/.vitepress/theme/components/accordionScrollExpanderState'

const defaults = {
  sectionCount: 5,
  trackHeight: 5000,
  stageHeight: 700,
  activationLine: 200
}

describe('accordion scroll-track selection', () => {
  it('keeps every section closed before the track reaches the stage', () => {
    expect(
      selectAccordionSection({
        ...defaults,
        trackTop: 200
      })
    ).toBe(-1)
  })

  it('opens the first section when the track enters the stage', () => {
    expect(
      selectAccordionSection({
        ...defaults,
        trackTop: 199
      })
    ).toBe(0)
  })

  it('maps equal track segments to consecutive sections', () => {
    expect(
      selectAccordionSection({
        ...defaults,
        trackTop: 200 - (5000 - 700) * 0.45
      })
    ).toBe(2)
  })

  it('keeps the penultimate section reachable near the track end', () => {
    expect(
      selectAccordionSection({
        ...defaults,
        trackTop: 200 - (5000 - 700) * 0.7
      })
    ).toBe(3)
  })

  it('assigns the end of the track to the final section', () => {
    expect(
      selectAccordionSection({
        ...defaults,
        trackTop: 200 - (5000 - 700)
      })
    ).toBe(4)
  })
})
