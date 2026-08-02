import { onMounted, onUnmounted } from 'vue'

type OutlineNavigationDirection = 'up' | 'down'

interface PendingOutlineTransition {
  direction: OutlineNavigationDirection
  pathname: string
  search: string
  targetId: string
}

const outlineLinkSelector = [
  '.VPDocAsideOutline a.outline-link',
  '.VPLocalNavOutlineDropdown a.outline-link'
].join(', ')

const movementThreshold = 4
const transitionDistance = '2rem'
const transitionDuration = 200

function decodeTargetId(hash: string): string | null {
  if (!hash.startsWith('#') || hash.length === 1) {
    return null
  }

  try {
    return decodeURIComponent(hash.slice(1))
  } catch {
    return null
  }
}

export function useOutlineNavigationTransition() {
  let pendingTransition: PendingOutlineTransition | null = null
  let animationFrame = 0
  let runningAnimation: Animation | null = null

  const recordOutlineNavigation = (link: HTMLAnchorElement) => {
    const targetUrl = new URL(link.href, window.location.href)

    if (
      targetUrl.origin !== window.location.origin ||
      targetUrl.pathname !== window.location.pathname ||
      targetUrl.search !== window.location.search
    ) {
      return
    }

    const targetId = decodeTargetId(targetUrl.hash)
    const target = targetId ? document.getElementById(targetId) : null

    if (!target) {
      return
    }

    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = 0
    }

    runningAnimation?.cancel()

    const targetTop = target.getBoundingClientRect().top + window.scrollY
    const scrollMarginTop =
      Number.parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0
    const movement = targetTop - scrollMarginTop - window.scrollY

    if (Math.abs(movement) <= movementThreshold) {
      pendingTransition = null
      return
    }

    pendingTransition = {
      direction: movement > 0 ? 'up' : 'down',
      pathname: targetUrl.pathname,
      search: targetUrl.search,
      targetId
    }
  }

  const recordPointerOutlineNavigation = (event: PointerEvent) => {
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.metaKey ||
      !(event.target instanceof Element)
    ) {
      return
    }

    const link = event.target.closest<HTMLAnchorElement>(outlineLinkSelector)

    if (link) {
      recordOutlineNavigation(link)
    }
  }

  const recordKeyboardOutlineNavigation = (event: KeyboardEvent) => {
    if (
      event.key !== 'Enter' ||
      event.repeat ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.metaKey ||
      !(event.target instanceof Element)
    ) {
      return
    }

    const link = event.target.closest<HTMLAnchorElement>(outlineLinkSelector)

    if (link) {
      recordOutlineNavigation(link)
    }
  }

  const animatePendingOutlineNavigation = () => {
    const transition = pendingTransition
    pendingTransition = null

    if (
      !transition ||
      transition.pathname !== window.location.pathname ||
      transition.search !== window.location.search ||
      decodeTargetId(window.location.hash) !== transition.targetId ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame)
    }

    animationFrame = window.requestAnimationFrame(() => {
      animationFrame = 0

      const content = document.querySelector<HTMLElement>('.VPDoc .vp-doc')

      if (
        !content ||
        typeof content.animate !== 'function' ||
        !document.getElementById(transition.targetId)
      ) {
        return
      }

      runningAnimation?.cancel()

      const offset =
        transition.direction === 'up'
          ? transitionDistance
          : `-${transitionDistance}`
      const animation = content.animate(
        [
          { opacity: 0.7, transform: `translateY(${offset})` },
          { opacity: 1, transform: 'translateY(0)' }
        ],
        {
          duration: transitionDuration,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
        }
      )

      runningAnimation = animation

      const clearAnimation = () => {
        if (runningAnimation === animation) {
          runningAnimation = null
        }
      }

      animation.addEventListener('finish', clearAnimation, { once: true })
      animation.addEventListener('cancel', clearAnimation, { once: true })
    })
  }

  onMounted(() => {
    document.addEventListener('pointerdown', recordPointerOutlineNavigation, true)
    document.addEventListener('keydown', recordKeyboardOutlineNavigation, true)
  })

  onUnmounted(() => {
    document.removeEventListener(
      'pointerdown',
      recordPointerOutlineNavigation,
      true
    )
    document.removeEventListener(
      'keydown',
      recordKeyboardOutlineNavigation,
      true
    )
    pendingTransition = null

    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = 0
    }

    runningAnimation?.cancel()
    runningAnimation = null
  })

  return { animatePendingOutlineNavigation }
}
