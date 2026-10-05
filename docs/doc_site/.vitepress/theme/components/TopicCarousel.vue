<script setup lang="ts">
import { inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vitepress'
import { topicCarouselKey } from './topicCarouselContext'
import type { TopicCarouselSelection } from './topicCarouselSelection'

const selection = inject<TopicCarouselSelection>(topicCarouselKey)!
const route = useRoute()
const root = ref<HTMLElement>()
const intro = ref<HTMLElement>()
const controls = ref<HTMLElement>()
const viewport = ref<HTMLElement>()
const collapsed = ref(false)
const viewportHeight = ref<number>()
const announcement = ref('')
let animations: Animation[] = []
let observer: ResizeObserver | undefined
let motion: MediaQueryList | undefined
let lastScroll = 0
let ignoreScroll = false
let frame = 0
let scrollFrame = 0
let stickyOffset = 0
let introHeight = 0
let controlsHeight = 0
let pageLocation = ''
const duration = 280
const easing = 'cubic-bezier(0.22, 1, 0.36, 1)'

function panel(index: number): HTMLElement | null {
  return viewport.value?.querySelector(`[data-topic-index="${index}"]`) ?? null
}

function measure() {
  if (!root.value) return
  const navbar = document.querySelector<HTMLElement>('.VPNav')
  const mobileNav = document.querySelector<HTMLElement>('.topic-navigation--mobile')
  stickyOffset = (navbar && getComputedStyle(navbar).position === 'fixed' ? navbar.getBoundingClientRect().height : 0)
    + (mobileNav?.getBoundingClientRect().height ?? 0)
  introHeight = intro.value?.getBoundingClientRect().height ?? 0
  controlsHeight = controls.value?.getBoundingClientRect().height ?? 0
  root.value.style.setProperty('--topic-sticky-offset', `${stickyOffset}px`)
  root.value.style.setProperty('--topic-intro-height', `${introHeight}px`)
  root.value.style.setProperty('--topic-controls-height', `${controlsHeight}px`)
  if (selection.transitioning) viewportHeight.value = panel(selection.active)?.offsetHeight
}

function cancelAnimations() {
  animations.forEach((animation) => animation.cancel())
  animations = []
}

function alignHeading() {
  const heading = document.getElementById(selection.topics[selection.active]?.id)
  if (!heading) return
  const offset = stickyOffset + controlsHeight + (collapsed.value ? 0 : introHeight) + 16
  window.scrollTo({ top: Math.max(0, heading.getBoundingClientRect().top + window.scrollY - offset), behavior: 'instant' })
  lastScroll = window.scrollY
}

function releaseScroll() {
  cancelAnimationFrame(scrollFrame)
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = requestAnimationFrame(() => { ignoreScroll = false; lastScroll = window.scrollY })
  })
}

async function transition() {
  cancelAnimations()
  cancelAnimationFrame(scrollFrame)
  const revision = selection.revision
  const { active, outgoing, source, direction } = selection
  if (outgoing === null) { viewportHeight.value = undefined; return }
  ignoreScroll = true
  const wasScrolled = root.value ? root.value.getBoundingClientRect().top < stickyOffset - 4 : false
  const historyAtTop = source === 'history' && !window.location.hash
  if (historyAtTop) collapsed.value = false
  else if (wasScrolled || source === 'history') collapsed.value = true
  if (source === 'control') {
    const url = new URL(window.location.href)
    url.hash = selection.topics[active].id
    history.pushState({ ...history.state, scrollPosition: 0 }, '', url)
    // Keep VitePress's route hash in sync without its vertical navigation path.
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }
  await nextTick()
  if (revision !== selection.revision || !viewport.value) return
  const incoming = panel(active)
  const leaving = panel(outgoing)
  if (!incoming) return
  measure()
  viewportHeight.value = incoming.offsetHeight
  if (historyAtTop) window.scrollTo({ top: 0, behavior: 'instant' })
  else if (wasScrolled || source === 'history') alignHeading()
  await nextTick()
  if (!motion?.matches && typeof incoming.animate === 'function') {
    const sign = direction === 'next' ? 1 : -1
    animations = [incoming.animate([
      { transform: `translateX(${sign * 100}%)` }, { transform: 'translateX(0)' }
    ], { duration, easing })]
    if (leaving) animations.push(leaving.animate([
      { transform: 'translateX(0)' }, { transform: `translateX(${-sign * 100}%)` }
    ], { duration, easing }))
    await Promise.allSettled(animations.map((animation) => animation.finished))
  }
  if (revision !== selection.revision) return
  selection.finish(revision)
  cancelAnimations()
  viewportHeight.value = undefined
  announcement.value = `Topic ${active + 1} of ${selection.topics.length}: ${selection.topics[active].title}`
  await nextTick()
  // Repeat after height settlement to avoid browser scroll clamping on shorter topics.
  if (historyAtTop) window.scrollTo({ top: 0, behavior: 'instant' })
  else if (wasScrolled || source === 'history') alignHeading()
  releaseScroll()
}

function onScroll() {
  if (ignoreScroll) { lastScroll = window.scrollY; return }
  const difference = window.scrollY - lastScroll
  if (window.scrollY <= 4) collapsed.value = false
  else if (Math.abs(difference) >= 4) collapsed.value = difference > 0
  if (Math.abs(difference) >= 4) lastScroll = window.scrollY
}

function syncHash() {
  const index = selection.indexForHash(window.location.hash)
  if (index >= 0) selection.select(index, 'history')
}

function onPopState(event: PopStateEvent) {
  if (`${location.pathname}${location.search}` !== pageLocation || selection.indexForHash(location.hash) < 0) return
  // The stock router also listens to popstate and schedules a vertical anchor
  // scroll. Own only this page's topic history, leaving all other routes alone.
  event.stopImmediatePropagation()
  syncHash()
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

function onTopicLink(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return
  const link = event.target.closest<HTMLAnchorElement>('a')
  if (!link) return
  const url = new URL(link.href)
  if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return
  const index = selection.indexForHash(url.hash)
  if (index < 0 || !url.hash) return
  event.preventDefault()
  if (index !== selection.active) selection.select(index)
  else if (!selection.transitioning) {
    history.replaceState(history.state, '', url)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }
}

function resize() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(measure)
}

function motionChanged() {
  if (motion?.matches) cancelAnimations()
}

watch(() => selection.revision, transition)
watch(() => route.hash, () => { if (root.value) syncHash() })
onMounted(async () => {
  pageLocation = `${location.pathname}${location.search}`
  motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  motion.addEventListener('change', motionChanged)
  measure()
  lastScroll = window.scrollY
  observer = new ResizeObserver(resize)
  for (const element of [intro.value, controls.value, viewport.value,
    document.querySelector('.VPNav'), document.querySelector('.topic-navigation--mobile')]) {
    if (element) observer.observe(element)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', resize, { passive: true })
  window.addEventListener('hashchange', syncHash)
  window.addEventListener('popstate', onPopState, true)
  const initial = selection.indexForHash(window.location.hash)
  if (initial >= 0) selection.select(initial, 'initial')
  await nextTick()
  if (initial >= 0 && window.location.hash) {
    ignoreScroll = true
    collapsed.value = true
    await nextTick()
    measure()
    alignHeading()
    releaseScroll()
  }
})
onUnmounted(() => {
  cancelAnimations()
  observer?.disconnect()
  motion?.removeEventListener('change', motionChanged)
  cancelAnimationFrame(frame)
  cancelAnimationFrame(scrollFrame)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', resize)
  window.removeEventListener('hashchange', syncHash)
  window.removeEventListener('popstate', onPopState, true)
})
</script>

<template>
  <div ref="root" class="topic-carousel" @click="onTopicLink">
    <header class="topic-carousel__header" :class="{ 'is-collapsed': collapsed }">
      <div ref="intro" class="topic-carousel__intro" :inert="collapsed || undefined" :aria-hidden="collapsed || undefined"><slot name="header" /></div>
      <nav ref="controls" class="topic-carousel__controls" aria-label="Topic carousel">
        <button class="topic-carousel__arrow" :disabled="selection.active === 0 || selection.transitioning" @click="selection.select(selection.active - 1)"><span aria-hidden="true">←</span> Previous</button>
        <div class="topic-carousel__dots">
          <button v-for="(topic, index) in selection.topics" :key="topic.id" class="topic-carousel__dot" :aria-label="`Topic ${index + 1} of ${selection.topics.length}: ${topic.title}`" :aria-current="selection.active === index ? 'true' : undefined" :disabled="selection.transitioning" @click="selection.select(index)"><span aria-hidden="true" /></button>
        </div>
        <button class="topic-carousel__arrow topic-carousel__arrow--next" :disabled="selection.active === selection.topics.length - 1 || selection.transitioning" @click="selection.select(selection.active + 1)">Next <span aria-hidden="true">→</span></button>
      </nav>
    </header>
    <div ref="viewport" class="topic-carousel__viewport" :style="{ height: viewportHeight === undefined ? undefined : `${viewportHeight}px` }" :aria-busy="selection.transitioning">
      <section v-for="(topic, index) in selection.topics" v-show="selection.active === index || selection.outgoing === index" :key="topic.id" class="topic-carousel__panel" :class="{ 'is-outgoing': selection.outgoing === index }" :data-topic-index="index" :aria-labelledby="topic.id" :aria-hidden="selection.active !== index || undefined" :inert="selection.active !== index || undefined"><slot :name="`topic-${index}`" /></section>
    </div>
    <p class="topic-carousel__announcement" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
  </div>
</template>

<style scoped>
.topic-carousel { --topic-sticky-offset: 64px; --topic-intro-height: 0px; --topic-controls-height: 53px; }
.topic-carousel__header { position: sticky; top: var(--topic-sticky-offset); z-index: 10; background: var(--vp-c-bg); transition: top 180ms cubic-bezier(0.22, 1, 0.36, 1); }
.topic-carousel__header.is-collapsed { top: calc(var(--topic-sticky-offset) - var(--topic-intro-height)); }
.topic-carousel__intro { display: flow-root; padding-bottom: 8px; transition: opacity 180ms; }
.is-collapsed .topic-carousel__intro { opacity: 0; pointer-events: none; }
.topic-carousel__controls { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--vp-c-divider); background: var(--vp-c-bg); }
.topic-carousel__arrow { display: flex; align-items: center; gap: 8px; justify-self: start; font-size: 14px; line-height: 28px; color: var(--vp-c-text-1); }
.topic-carousel__arrow--next { justify-self: end; }
.topic-carousel__arrow span { font-size: 20px; }
.topic-carousel__arrow:disabled { color: var(--vp-c-text-3); cursor: default; }
.topic-carousel__arrow:not(:disabled):hover { color: var(--vp-c-brand-1); }
.topic-carousel__dots { display: flex; }
.topic-carousel__dot { display: grid; place-items: center; width: 28px; height: 28px; }
.topic-carousel__dot span { width: 8px; height: 8px; border: 1px solid var(--vp-c-text-2); border-radius: 50%; }
.topic-carousel__dot[aria-current] span { background: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); }
.topic-carousel__dot:not(:disabled):hover span { border-color: var(--vp-c-brand-1); }
.topic-carousel__controls button:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; border-radius: 3px; }
.topic-carousel__viewport { position: relative; overflow: hidden; min-height: calc(100dvh - var(--topic-sticky-offset) - var(--topic-controls-height) - 32px); }
.topic-carousel__panel { display: flow-root; width: 100%; }
.topic-carousel__panel :deep([id]) { scroll-margin-top: calc(var(--topic-sticky-offset) + var(--topic-controls-height) + 16px); }
.topic-carousel__panel.is-outgoing { position: absolute; top: 0; left: 0; }
.topic-carousel__panel :deep(> h2:first-child) { margin-top: 24px; padding-top: 0; border-top: 0; }
.topic-carousel__announcement { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 479px) {
  .topic-carousel__dot { width: 18px; }
  .topic-carousel__arrow { gap: 4px; font-size: 12px; }
  .topic-carousel__arrow span { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) { .topic-carousel__header, .topic-carousel__intro { transition: none; } }
</style>
