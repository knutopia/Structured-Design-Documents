<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { selectAccordionSection } from './accordionScrollExpanderState'

const track = ref<HTMLElement>()
const stage = ref<HTMLElement>()

let items: HTMLDetailsElement[] = []
let animationFrame: number | undefined
let breakpoint: MediaQueryList | undefined
let changingItems = false

const desktopBreakpoint = '(min-width: 768px)'
const scrollDistancePerSectionVh = 70

function isDesktop(): boolean {
  return breakpoint?.matches ?? false
}

function setOpenItem(target: HTMLDetailsElement | null): void {
  if (
    items.every((item) => item.open === (target !== null && item === target))
  ) {
    return
  }

  changingItems = true
  for (const item of items) {
    item.open = target !== null && item === target
  }
  nextTick(() => {
    requestAnimationFrame(() => {
      changingItems = false
    })
  })
}

function activationLine(): number {
  const navBottom =
    document.querySelector<HTMLElement>('.VPNav')?.getBoundingClientRect()
      .bottom ?? 0
  return Math.max(navBottom + 16, window.innerHeight * 0.2)
}

function evaluateScrollPosition(): void {
  animationFrame = undefined
  if (
    changingItems ||
    !isDesktop() ||
    !track.value ||
    !stage.value ||
    items.length === 0
  ) {
    return
  }

  const nextIndex = selectAccordionSection({
    sectionCount: items.length,
    trackTop: track.value.getBoundingClientRect().top,
    trackHeight: track.value.offsetHeight,
    stageHeight: stage.value.offsetHeight,
    activationLine: activationLine()
  })

  setOpenItem(nextIndex >= 0 ? items[nextIndex] : null)
}

function scheduleScrollEvaluation(): void {
  if (animationFrame === undefined) {
    animationFrame = requestAnimationFrame(evaluateScrollPosition)
  }
}

function scrollToItem(item: HTMLDetailsElement): void {
  if (!isDesktop() || !track.value || !stage.value) {
    return
  }

  const index = items.indexOf(item)
  if (index < 0) {
    return
  }

  const trackDocumentTop =
    track.value.getBoundingClientRect().top + window.scrollY
  const scrollableDistance = Math.max(
    track.value.offsetHeight - stage.value.offsetHeight,
    1
  )
  const sectionProgress = (index + 0.5) / items.length
  window.scrollTo(
    0,
    trackDocumentTop +
      sectionProgress * scrollableDistance -
      activationLine()
  )
}

function handleToggle(event: Event): void {
  if (changingItems) {
    return
  }

  const item = event.currentTarget as HTMLDetailsElement
  if (item.open) {
    setOpenItem(item)
    scrollToItem(item)
  }
}

function itemForHash(): HTMLDetailsElement | null {
  let targetId: string
  try {
    targetId = decodeURIComponent(window.location.hash.slice(1))
  } catch {
    return null
  }
  if (!targetId) {
    return null
  }

  return (
    items.find((item) =>
      Array.from(item.querySelectorAll<HTMLElement>('h2[id]')).some(
        (heading) => heading.id === targetId
      )
    ) ?? null
  )
}

function openHashTarget(): void {
  const target = itemForHash()
  if (target) {
    setOpenItem(target)
    nextTick(() => scrollToItem(target))
  }
}

function handleClick(event: MouseEvent): void {
  const clickedElement = event.target
  if (!(clickedElement instanceof Element)) {
    return
  }

  const anchor = clickedElement.closest<HTMLAnchorElement>('a.header-anchor')
  const item = anchor?.closest<HTMLDetailsElement>(
    'details[data-accordion-scroll-item]'
  )
  if (!anchor || !item || !stage.value?.contains(item)) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  setOpenItem(item)
  scrollToItem(item)

  if (window.location.hash === anchor.hash) {
    anchor.closest<HTMLElement>('h2[id]')?.focus({ preventScroll: true })
  } else {
    window.history.pushState(null, '', anchor.hash)
  }
}

function handleBreakpointChange(): void {
  setOpenItem(null)
  scheduleScrollEvaluation()
}

onMounted(() => {
  items = Array.from(
    stage.value?.querySelectorAll<HTMLDetailsElement>(
      ':scope > details[data-accordion-scroll-item]'
    ) ?? []
  )

  track.value?.style.setProperty(
    '--accordion-scroll-track-height',
    `${(items.length + 1) * scrollDistancePerSectionVh}vh`
  )
  stage.value?.style.setProperty(
    '--accordion-section-count',
    String(items.length)
  )

  for (const item of items) {
    item.open = false
    item.addEventListener('toggle', handleToggle)
  }

  breakpoint = window.matchMedia(desktopBreakpoint)
  breakpoint.addEventListener('change', handleBreakpointChange)
  stage.value?.addEventListener('click', handleClick, true)
  window.addEventListener('scroll', scheduleScrollEvaluation, { passive: true })
  window.addEventListener('resize', scheduleScrollEvaluation, { passive: true })
  window.addEventListener('hashchange', openHashTarget)

  if (window.location.hash) {
    openHashTarget()
  }
})

onUnmounted(() => {
  if (animationFrame !== undefined) {
    cancelAnimationFrame(animationFrame)
  }
  for (const item of items) {
    item.removeEventListener('toggle', handleToggle)
  }
  breakpoint?.removeEventListener('change', handleBreakpointChange)
  stage.value?.removeEventListener('click', handleClick, true)
  window.removeEventListener('scroll', scheduleScrollEvaluation)
  window.removeEventListener('resize', scheduleScrollEvaluation)
  window.removeEventListener('hashchange', openHashTarget)
})
</script>

<template>
  <div
    ref="track"
    class="accordion-scroll-expander__track"
  >
    <div
      ref="stage"
      class="accordion-scroll-expander"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.accordion-scroll-expander__track {
  margin: 32px 0;
}

.accordion-scroll-expander {
  border-bottom: 1px solid var(--vp-c-divider);
}

.accordion-scroll-expander :deep(> .accordion-scroll-expander__item) {
  border-top: 1px solid var(--vp-c-divider);
}

.accordion-scroll-expander :deep(.accordion-scroll-expander__summary) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 0 12px;
  color: var(--vp-c-text-1);
  cursor: pointer;
  list-style: none;
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

.accordion-scroll-expander
  :deep(.accordion-scroll-expander__summary::-webkit-details-marker) {
  display: none;
}

.accordion-scroll-expander :deep(.accordion-scroll-expander__summary::after) {
  width: 9px;
  height: 9px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  content: '';
  transform: translateY(-2px) rotate(45deg);
  transition: transform 0.2s ease;
}

.accordion-scroll-expander
  :deep(.accordion-scroll-expander__item[open] > .accordion-scroll-expander__summary::after) {
  transform: translateY(2px) rotate(225deg);
}

.accordion-scroll-expander
  :deep(.accordion-scroll-expander__summary:hover) {
  color: var(--vp-c-brand-1);
  background-color: var(--vp-c-default-soft);
}

.accordion-scroll-expander
  :deep(.accordion-scroll-expander__summary:focus-visible) {
  position: relative;
  z-index: 1;
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -2px;
}

.accordion-scroll-expander
  :deep(.accordion-scroll-expander__item[open] > .accordion-scroll-expander__summary) {
  color: var(--vp-c-brand-1);
  background-color: var(--vp-c-brand-soft);
}

.accordion-scroll-expander
  :deep(.accordion-scroll-expander__summary > h2) {
  min-width: 0;
  margin: 0;
  padding: 16px 0;
  border-top: 0;
  color: inherit;
  font-size: 18px;
  line-height: 1.4;
}

.accordion-scroll-expander :deep(.accordion-scroll-expander__content) {
  padding: 4px 12px 20px;
  background-color: var(--vp-c-bg-soft);
}

.accordion-scroll-expander
  :deep(.accordion-scroll-expander__content-inner > :first-child) {
  margin-top: 0;
}

.accordion-scroll-expander
  :deep(.accordion-scroll-expander__content-inner > :last-child) {
  margin-bottom: 0;
}

@media (min-width: 768px) {
  .accordion-scroll-expander__track {
    height: var(--accordion-scroll-track-height);
  }

  .accordion-scroll-expander {
    position: sticky;
    top: calc(var(--vp-nav-height) + 16px);
    display: grid;
    grid-template-columns: minmax(15rem, 0.8fr) minmax(0, 1.2fr);
    grid-template-rows: repeat(var(--accordion-section-count), auto);
    column-gap: 32px;
    align-content: center;
    height: calc(100dvh - var(--vp-nav-height) - 32px);
    max-height: 760px;
    border-bottom: 0;
  }

  .accordion-scroll-expander :deep(> .accordion-scroll-expander__item) {
    display: contents;
  }

  .accordion-scroll-expander :deep(.accordion-scroll-expander__summary) {
    grid-column: 1;
    min-height: 48px;
    border-top: 1px solid var(--vp-c-divider);
  }

  .accordion-scroll-expander
    :deep(.accordion-scroll-expander__item:last-child > .accordion-scroll-expander__summary) {
    border-bottom: 1px solid var(--vp-c-divider);
  }

  .accordion-scroll-expander
    :deep(.accordion-scroll-expander__summary > h2) {
    padding: 11px 0;
    font-size: 16px;
  }

  .accordion-scroll-expander :deep(.accordion-scroll-expander__content) {
    grid-row: 1 / -1;
    grid-column: 2;
    align-self: center;
    overflow-y: auto;
    max-height: 100%;
    padding: 24px 28px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .accordion-scroll-expander :deep(.accordion-scroll-expander__summary),
  .accordion-scroll-expander
    :deep(.accordion-scroll-expander__summary::after) {
    transition: none;
  }
}
</style>
