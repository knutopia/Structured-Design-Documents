import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMarkdownRenderer, disposeMdItInstance, type MarkdownRenderer } from 'vitepress'
import { topicCarouselMarkdownPlugin } from '../docs/doc_site/.vitepress/markdown/topicCarousel'
import { TopicCarouselSelection } from '../docs/doc_site/.vitepress/theme/components/topicCarouselSelection'

let renderer: MarkdownRenderer
const pagePath = path.resolve('docs/doc_site/practical_applications/index.md')

async function render(source: string) {
  const env: any = { path: pagePath, realPath: pagePath, relativePath: 'practical_applications/index.md' }
  return { html: await renderer.renderAsync(source, env), env }
}

describe('topic carousel Markdown opt-in', () => {
  beforeAll(async () => {
    renderer = await createMarkdownRenderer('docs/doc_site', {
      config: (md) => { md.use(topicCarouselMarkdownPlugin) }
    })
  })
  afterAll(() => disposeMdItInstance())

  it('preserves the full eight-topic source, order, IDs, and previous-page link', async () => {
    const source = await readFile(pagePath, 'utf8')
    const plain = await render(source.replace('topicCarousel: true\n', ''))
    const carousel = await render(source)
    const topics = carousel.env.frontmatter.topicCarouselTopics
    expect(topics).toHaveLength(8)
    expect(topics.map((topic: { id: string }) => topic.id)).toEqual(
      [...plain.html.matchAll(/<h2 id="([^"]+)"/g)].map((match) => match[1])
    )
    expect(carousel.env.frontmatter.prev).toEqual(plain.env.frontmatter.prev)
    expect(carousel.html.match(/<template #topic-/g)).toHaveLength(8)
    const unwrapped = carousel.html
      .replace(/<\/?TopicCarousel>\n|<template #[^>]+>\n|<\/template>\n/g, '')
      .replace(/class="header-anchor vp-raw"/g, 'class="header-anchor"')
    expect(unwrapped).toBe(plain.html)
  })

  it('leaves the backup and ordinary pages as their original vertical content', async () => {
    const source = await readFile(path.resolve('docs/doc_site/practical_applications/index_bup.md'), 'utf8')
    const backup = await render(source)
    expect(backup.html).not.toContain('<TopicCarousel>')
    expect(backup.html.match(/<h2 /g)).toHaveLength(8)
    expect(backup.env.frontmatter.pageClass).toBe('wide-sidebar')
    expect(backup.env.frontmatter.outline).toBeUndefined()
    expect(backup.env.frontmatter.topicCarouselTopics).toBeUndefined()
    expect((await render('# Ordinary\n\n## First\n\n## Second')).html).not.toContain('<TopicCarousel>')
  })

  it('uses VitePress unique IDs and ignores nested headings and fenced examples', async () => {
    const result = await render('---\ntopicCarousel: true\n---\n# Title\nIntro.\n\n## Same\n> ## Nested\n\n```md\n## Fenced\n```\n\n## Same\nBody.')
    expect(result.env.frontmatter.topicCarouselTopics).toEqual([
      { id: 'same', title: 'Same' }, { id: 'same-1', title: 'Same' }
    ])
    expect(result.html).toContain('<template #header>')
    expect(result.html).toContain('<blockquote>')
    expect(result.html).toContain('Nested')
    expect(result.html).toContain('Fenced')
  })

  it('rejects opted-in pages without multiple top-level topics', async () => {
    await expect(render('---\ntopicCarousel: true\n---\n# Title\n## Only')).rejects.toThrow('requires at least two top-level ## topics')
  })
})

describe('shared topic selection', () => {
  function selection() {
    const state = new TopicCarouselSelection()
    state.reset(Array.from({ length: 8 }, (_, index) => ({ id: `topic-${index}`, title: `Topic ${index}` })))
    return state
  }

  it('stops at either end and ignores the current topic and invalid indexes', () => {
    const state = selection()
    for (const index of [-1, 0, 8, 0.5, NaN]) expect(state.select(index)).toBe(false)
    expect(state.active).toBe(0)
    expect(state.select(7)).toBe(true)
    state.finish(state.revision)
    expect(state.select(8)).toBe(false)
    expect(state.select(7)).toBe(false)
  })

  it('gives direct jumps the correct direction and locks rapid control interactions', () => {
    const state = selection()
    expect(state.select(6)).toBe(true)
    expect(state.direction).toBe('next')
    expect(state.outgoing).toBe(0)
    expect(state.select(7)).toBe(false)
    state.finish(state.revision)
    expect(state.select(2)).toBe(true)
    expect(state.direction).toBe('previous')
    expect(state.outgoing).toBe(6)
  })

  it('allows history to supersede a transition and ignores stale animation completion', () => {
    const state = selection()
    state.select(5)
    const revision = state.revision
    expect(state.select(1, 'history')).toBe(true)
    state.finish(revision)
    expect(state.active).toBe(1)
    expect(state.transitioning).toBe(true)
    state.finish(state.revision)
    expect(state.transitioning).toBe(false)
    expect(state.outgoing).toBeNull()
  })

  it('resolves initial/reload/history hashes and handles malformed or unknown IDs', () => {
    const state = selection()
    expect(state.indexForHash('')).toBe(0)
    expect(state.indexForHash('#')).toBe(0)
    expect(state.indexForHash('#topic-%33')).toBe(3)
    expect(state.indexForHash('#%')).toBe(-1)
    expect(state.indexForHash('#unknown')).toBe(-1)
    state.select(state.indexForHash('#topic-4'), 'initial')
    expect(state.active).toBe(4)
    expect(state.transitioning).toBe(false)
    expect(state.outgoing).toBeNull()
    state.reset([])
    expect(state.active).toBe(0)
    expect(state.topics).toEqual([])
  })
})
