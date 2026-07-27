import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createMarkdownRenderer,
  disposeMdItInstance,
  type MarkdownRenderer
} from 'vitepress'
import { showRepoLinkMarkdownPlugin } from '../docs/doc_site/.vitepress/markdown/showRepoLink'
import { showSourceMarkdownPlugin } from '../docs/doc_site/.vitepress/markdown/showSource'

let fixtureRoot: string
let pagePath: string
let sourcePath: string
let renderer: MarkdownRenderer

async function render(markdown: string): Promise<string> {
  return renderer.renderAsync(markdown, {
    path: pagePath,
    realPath: pagePath,
    relativePath: 'page.md',
    cleanUrls: true,
    includes: []
  })
}

describe('showRepoLink Markdown-it plugin', () => {
  beforeAll(async () => {
    fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'sdd-show-repo-link-'))
    pagePath = path.join(fixtureRoot, 'page.md')
    sourcePath = path.join(fixtureRoot, 'sample.ts')
    await writeFile(pagePath, '# Fixture\n', 'utf8')
    await writeFile(sourcePath, 'const sample = true\n', 'utf8')

    renderer = await createMarkdownRenderer(fixtureRoot, {
      config(md) {
        md.use(showSourceMarkdownPlugin)
        md.use(showRepoLinkMarkdownPlugin)
      }
    })
  })

  afterAll(async () => {
    disposeMdItInstance()
    await rm(fixtureRoot, { force: true, recursive: true })
  })

  it('preserves the standalone right-aligned link', async () => {
    const html = await render(
      'showRepoLink /docs/doc_site/small_app_example/\n'
    )

    expect(html).toContain('<div class="link-right">')
    expect(html).not.toContain('link-right-up')
    expect(html).toContain(
      'href="https://github.com/knutopia/Structured-Design-Documents/tree/main/docs/doc_site/small_app_example/"'
    )
    expect(html).toContain('target="_blank" rel="noreferrer"')
  })

  it('places {pos: up} in the preceding prose paragraph', async () => {
    const html = await render([
      'Information architecture content',
      'showRepoLink docs/doc_site/small_app_example {pos: up}'
    ].join('\n'))

    expect(html).toMatch(
      /<p>Information architecture content\s+<span class="link-right link-right-up">/
    )
    expect(html).toContain(
      'href="https://github.com/knutopia/Structured-Design-Documents/tree/main/docs/doc_site/small_app_example"'
    )
    expect(html).not.toContain('<div class="link-right">')
  })

  it('keeps a following showSource directive as a separate block', async () => {
    const html = await render([
      'Information architecture content',
      'showRepoLink docs/example {pos: up}',
      'showSource ./sample.ts'
    ].join('\n'))

    expect(html).toMatch(
      /<p>Information architecture content\s+<span class="link-right link-right-up">.*?<\/span><\/p>/s
    )
    expect(html).toContain('source-scroll')
    expect(html).toContain(' sample')
    expect(html).not.toContain('showSource ./sample.ts')
  })

  it('works when indented inside a details container', async () => {
    const html = await render([
      '::: details Source',
      '  Source details',
      '  showRepoLink docs/example {pos: up}',
      '  showSource ./sample.ts',
      ':::'
    ].join('\n'))

    expect(html).toContain('<details')
    expect(html).toMatch(
      /<p>Source details\s+<span class="link-right link-right-up">/
    )
    expect(html).toContain('source-scroll')
    expect(html).toContain(' sample')
  })

  it.each([
    ['showRepoLink', 'expected showRepoLink PATH'],
    ['showRepoLink docs/example {pos: down}', 'expected {pos: up}'],
    ['showRepoLink docs/example {pos up}', 'expected {pos: up}'],
    ['showRepoLink https://example.com {pos: up}', 'expected showRepoLink PATH']
  ])('rejects invalid directive %s', async (directive, message) => {
    await expect(render(`Intro\n${directive}\n`)).rejects.toThrow(message)
    await expect(render(`Intro\n${directive}\n`)).rejects.toThrow(
      `${pagePath}:2`
    )
  })

  it('leaves showRepoLink text inside fenced examples untouched', async () => {
    const html = await render([
      '```md',
      'showRepoLink docs/example {pos: down}',
      '```'
    ].join('\n'))

    expect(html).toContain('showRepoLink')
    expect(html).not.toContain('link-right')
  })
})
