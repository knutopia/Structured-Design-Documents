export interface CarouselTopic {
  id: string
  title: string
}

export type TopicSelectionSource = 'control' | 'history' | 'initial'

/** DOM-independent selection rules, shared by every carousel control. */
export class TopicCarouselSelection {
  topics: CarouselTopic[] = []
  active = 0
  outgoing: number | null = null
  direction: 'next' | 'previous' = 'next'
  source: TopicSelectionSource = 'initial'
  transitioning = false
  revision = 0

  reset(topics: CarouselTopic[]): void {
    this.topics = topics
    this.active = 0
    this.outgoing = null
    this.source = 'initial'
    this.transitioning = false
    this.revision += 1
  }

  select(index: number, source: TopicSelectionSource = 'control'): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= this.topics.length ||
        index === this.active || (source === 'control' && this.transitioning)) return false
    this.direction = index > this.active ? 'next' : 'previous'
    this.outgoing = source === 'initial' ? null : this.active
    this.active = index
    this.source = source
    this.transitioning = source !== 'initial'
    this.revision += 1
    return true
  }

  finish(revision: number): void {
    // An interrupted animation must not unlock a newer selection.
    if (revision !== this.revision) return
    this.outgoing = null
    this.transitioning = false
  }

  indexForHash(hash: string): number {
    if (!hash || hash === '#') return 0
    try {
      const id = decodeURIComponent(hash.slice(1))
      return this.topics.findIndex((topic) => topic.id === id)
    } catch {
      return -1
    }
  }
}
