<script setup lang="ts">
import { inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import { topicCarouselKey } from './topicCarouselContext'
import type { TopicCarouselSelection } from './topicCarouselSelection'

const props = defineProps<{ mobile?: boolean }>()
const selection = inject<TopicCarouselSelection>(topicCarouselKey)!
const { theme } = useData()
const open = ref(false)
const root = ref<HTMLElement>()
const toggle = ref<HTMLButtonElement>()

function close(restoreFocus = false) {
  open.value = false
  if (restoreFocus) nextTick(() => toggle.value?.focus({ preventScroll: true }))
}

function choose(event: MouseEvent, index: number) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  if (selection.transitioning) return
  selection.select(index)
  close(props.mobile)
}

function outside(event: MouseEvent) {
  if (!root.value?.contains(event.target as Node)) close()
}

function escape(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) close(true)
}

function returnToTop(event: MouseEvent) {
  event.preventDefault()
  close(true)
  window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
}

watch(() => selection.topics, () => close())
onMounted(() => {
  document.addEventListener('click', outside)
  document.addEventListener('keydown', escape)
})
onUnmounted(() => {
  document.removeEventListener('click', outside)
  document.removeEventListener('keydown', escape)
})
</script>

<template>
  <nav ref="root" class="topic-navigation vp-raw" :class="{ 'topic-navigation--mobile': mobile }" aria-label="Topic navigation">
    <button v-if="mobile" ref="toggle" class="topic-navigation__toggle" :aria-expanded="open" aria-controls="topic-navigation-mobile-list" @click="open = !open">
      {{ theme.outlineTitle || 'On this page' }}
      <span class="vpi-chevron-right" :class="{ open }" aria-hidden="true" />
    </button>
    <div v-else class="topic-navigation__title">{{ theme.outlineTitle || 'On this page' }}</div>
    <Transition name="topic-menu">
      <div v-if="!mobile || open" :id="mobile ? 'topic-navigation-mobile-list' : undefined" class="topic-navigation__items">
        <a v-if="mobile" class="topic-navigation__top" href="#" @click="returnToTop">{{ theme.returnToTopLabel || 'Return to top' }}</a>
        <ul>
          <li v-for="(topic, index) in selection.topics" :key="topic.id">
            <a class="topic-navigation__link" :href="`#${topic.id}`" :aria-current="selection.active === index ? 'true' : undefined" :aria-disabled="selection.transitioning || undefined" @click="choose($event, index)">{{ topic.title }}</a>
          </li>
        </ul>
      </div>
    </Transition>
  </nav>
</template>

<style scoped>
.topic-navigation { border-left: 1px solid var(--vp-c-divider); padding-left: 16px; font-size: 14px; font-weight: 500; }
.topic-navigation__title { line-height: 32px; font-weight: 600; }
.topic-navigation ul { margin: 0; padding: 0; list-style: none; }
.topic-navigation__link { position: relative; display: block; padding: 6px 0; line-height: 1.4; color: var(--vp-c-text-2); overflow-wrap: anywhere; transition: color 0.2s; }
.topic-navigation__link:hover, .topic-navigation__link[aria-current] { color: var(--vp-c-brand-1); }
.topic-navigation__link[aria-current]::before { content: ''; position: absolute; left: -17px; top: 6px; bottom: 6px; width: 2px; border-radius: 2px; background: var(--vp-c-brand-1); }
.topic-navigation a:focus-visible, .topic-navigation button:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; border-radius: 2px; }
.topic-navigation--mobile { position: sticky; top: 0; z-index: var(--vp-z-index-local-nav); border-left: 0; border-bottom: 1px solid var(--vp-c-gutter); padding: 0; background: var(--vp-local-nav-bg-color); }
.topic-navigation__toggle { display: flex; align-items: center; gap: 4px; padding: 12px 24px 11px; line-height: 24px; font-size: 12px; color: var(--vp-c-text-2); }
.topic-navigation__toggle .vpi-chevron-right { transition: transform 0.2s; }
.topic-navigation__toggle .open { transform: rotate(90deg); }
.topic-navigation--mobile .topic-navigation__items { position: absolute; top: 40px; left: 16px; right: 16px; max-height: calc(100dvh - 150px); overflow-y: auto; border: 1px solid var(--vp-c-border); border-radius: 8px; background: var(--vp-c-bg-soft); box-shadow: var(--vp-shadow-3); }
.topic-navigation--mobile ul { padding: 8px 16px; }
.topic-navigation--mobile .topic-navigation__link[aria-current]::before { left: -10px; }
.topic-navigation__top { display: block; padding: 0 16px; line-height: 48px; color: var(--vp-c-brand-1); border-bottom: 1px solid var(--vp-c-gutter); }
.topic-menu-enter-active { transition: opacity 0.2s ease-out, transform 0.2s ease-out; }
.topic-menu-leave-active { transition: opacity 0.15s ease-in, transform 0.15s ease-in; }
.topic-menu-enter-from, .topic-menu-leave-to { opacity: 0; transform: translateY(-16px); }
@media (min-width: 768px) { .topic-navigation__toggle { padding-left: 32px; padding-right: 32px; } }
@media (min-width: 960px) {
  .topic-navigation--mobile { top: var(--vp-nav-height); }
  .topic-navigation__toggle { font-size: 14px; }
  .topic-navigation--mobile .topic-navigation__items { left: 32px; right: auto; width: 320px; }
}
@media (min-width: 1280px) { .topic-navigation--mobile { display: none; } }
@media (prefers-reduced-motion: reduce) { .topic-navigation *, .topic-menu-enter-active, .topic-menu-leave-active { transition: none; } }
</style>
