<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

const root = ref<HTMLElement>()

let items: HTMLDetailsElement[] = []
let animationFrame: number | undefined
let changingItems = false
let manualOverride = false
let manualScrollPosition = 0

function summaryFor(item: HTMLDetailsElement): HTMLElement | null {
  return item.querySelector(':scope > summary')
}

function setManualOverride(): void {
  manualOverride = true
  manualScrollPosition = window.scrollY
}

function releaseChangeGuard(callback?: () => void): void {
  nextTick(() => {
    requestAnimationFrame(() => {
      callback?.()
      requestAnimationFrame(() => {
        changingItems = false
      })
    })
  })
}

function setOpenItem(
  target: HTMLDetailsElement | null,
  preserveTargetPosition = false
): void {
  const summary = target ? summaryFor(target) : null
  const previousTop = preserveTargetPosition
    ? summary?.getBoundingClientRect().top
    : undefined

  if (
    items.every((item) => item.open === (target !== null && item === target))
  ) {
    return
  }

  changingItems = true
  for (const item of items) {
    item.open = target !== null && item === target
  }

  releaseChangeGuard(() => {
    if (summary && previousTop !== undefined) {
      const nextTop = summary.getBoundingClientRect().top
      const adjustment = nextTop - previousTop
      if (Math.abs(adjustment) >= 1) {
        window.scrollBy(0, adjustment)
      }
    }
  })
}

function activationLine(): number {
  const navBottom =
    document.querySelector<HTMLElement>('.VPNav')?.getBoundingClientRect()
      .bottom ?? 0
  return Math.max(navBottom + 24, window.innerHeight * 0.35)
}

function evaluateScrollPosition(): void {
  animationFrame = undefined
  if (changingItems || items.length === 0) {
    return
  }

  if (manualOverride) {
    if (Math.abs(window.scrollY - manualScrollPosition) <= 8) {
      return
    }
    manualOverride = false
  }

  const threshold = activationLine()
  let target: HTMLDetailsElement | null = null

  for (const item of items) {
    const summary = summaryFor(item)
    if (summary && summary.getBoundingClientRect().top <= threshold) {
      target = item
    } else {
      break
    }
  }

  setOpenItem(target, target !== null)
}

function scheduleScrollEvaluation(): void {
  if (animationFrame === undefined) {
    animationFrame = requestAnimationFrame(evaluateScrollPosition)
  }
}

function handleToggle(event: Event): void {
  if (changingItems) {
    return
  }

  const item = event.currentTarget as HTMLDetailsElement
  setManualOverride()
  if (item.open) {
    setOpenItem(item, true)
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
    setManualOverride()
    setOpenItem(target)
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
  if (!anchor || !item || !root.value?.contains(item)) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  setManualOverride()
  setOpenItem(item)

  if (window.location.hash === anchor.hash) {
    anchor.closest<HTMLElement>('h2[id]')?.scrollIntoView()
  } else {
    window.location.hash = anchor.hash
  }
}

onMounted(() => {
  items = Array.from(
    root.value?.querySelectorAll<HTMLDetailsElement>(
      ':scope > details[data-accordion-scroll-item]'
    ) ?? []
  )

  for (const item of items) {
    item.open = false
    item.addEventListener('toggle', handleToggle)
  }

  root.value?.addEventListener('click', handleClick, true)
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
  root.value?.removeEventListener('click', handleClick, true)
  window.removeEventListener('scroll', scheduleScrollEvaluation)
  window.removeEventListener('resize', scheduleScrollEvaluation)
  window.removeEventListener('hashchange', openHashTarget)
})
</script>

<template>
  <div
    ref="root"
    class="accordion-scroll-expander"
  >
    <slot />
  </div>
</template>

<style scoped>
.accordion-scroll-expander {
  margin: 32px 0;
  border-bottom: 1px solid var(--vp-c-divider);
}

.accordion-scroll-expander :deep(> .accordion-scroll-expander__item) {
  border-top: 1px solid var(--vp-c-divider);
}

.accordion-scroll-expander :deep(.accordion-scroll-expander__summary) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px;
  padding: 0 16px;
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
  padding: 18px 0;
  border-top: 0;
  color: inherit;
  font-size: 20px;
  line-height: 1.4;
}

.accordion-scroll-expander :deep(.accordion-scroll-expander__content) {
  padding: 4px 20px 24px;
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

@media (max-width: 767px) {
  .accordion-scroll-expander :deep(.accordion-scroll-expander__summary) {
    gap: 14px;
    padding: 0 12px;
  }

  .accordion-scroll-expander
    :deep(.accordion-scroll-expander__summary > h2) {
    padding: 16px 0;
    font-size: 18px;
  }

  .accordion-scroll-expander :deep(.accordion-scroll-expander__content) {
    padding: 4px 12px 20px;
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
