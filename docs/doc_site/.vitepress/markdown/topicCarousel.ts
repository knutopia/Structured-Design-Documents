import type { MarkdownRenderer } from 'vitepress'

/** Opt-in only: Markdown remains the source for both topic content and navigation. */
export function topicCarouselMarkdownPlugin(md: MarkdownRenderer): void {
  // VitePress's anchor rule has already assigned canonical, unique heading IDs.
  md.core.ruler.push('topic_carousel', (state) => {
    if (state.env.frontmatter?.topicCarousel !== true) return

    const tokens = state.tokens
    const starts = tokens.flatMap((token, index) =>
      token.type === 'heading_open' && token.tag === 'h2' && token.level === 0
        ? [index]
        : []
    )
    if (starts.length < 2) {
      throw new Error(`[topicCarousel] ${state.env.realPath ?? state.env.path}: requires at least two top-level ## topics`)
    }

    const topics = starts.map((index) => ({
      id: tokens[index].attrGet('id')!,
      title: tokens[index + 1].content
    }))
    state.env.frontmatter.topicCarouselTopics = topics
    state.env.frontmatter.pageClass = [state.env.frontmatter.pageClass, 'topic-carousel-page']
      .filter(Boolean).join(' ')
    // Outline scroll tracking cannot represent horizontally selected topics.
    state.env.frontmatter.outline = false

    // Let the carousel handle its own same-page topic links before the SPA router.
    const topicHashes = new Set(topics.map((topic) => `#${topic.id}`))
    for (const token of tokens) {
      for (const child of token.children ?? []) {
        if (child.type === 'link_open' && topicHashes.has(child.attrGet('href') ?? '')) {
          child.attrJoin('class', 'vp-raw')
        }
      }
    }

    const html = (content: string) => {
      const token = new state.Token('html_block', '', 0)
      token.content = `${content}\n`
      return token
    }
    const grouped = [html('<TopicCarousel>'), html('<template #header>'),
      ...tokens.slice(0, starts[0]), html('</template>')]
    starts.forEach((start, index) => {
      grouped.push(html(`<template #topic-${index}>`),
        ...tokens.slice(start, starts[index + 1] ?? tokens.length), html('</template>'))
    })
    grouped.push(html('</TopicCarousel>'))
    state.tokens = grouped
  })
}
