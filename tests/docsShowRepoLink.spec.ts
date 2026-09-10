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

  it('renders multiple delimited links in a table cell without breaking rows', async () => {
    const html = await render([
      '| Responsibility | Source |',
      '| --- | --- |',
      '| Policy | {{showRepoLink bundle/v0.1/core/views.yaml /bundle/v0.1/core/views.yaml}}, {{showRepoLink model src/renderer/uiContractsPresentationModel.ts}} |'
    ].join('\n'))
    expect(html).toContain('<table')
    expect(html.match(/<tr>/g)).toHaveLength(2)
    expect(html.match(/<td>/g)).toHaveLength(2)
    expect(html.match(/class="repo-link-inline"/g)).toHaveLength(2)
    expect(html).toContain('<IconGitHub/><code>bundle/v0.1/core/views.yaml</code></a>')
    expect(html).toContain('href="https://github.com/knutopia/Structured-Design-Documents/tree/main/src/renderer/uiContractsPresentationModel.ts"')
    expect(html).not.toContain('{{showRepoLink')
  })

  it('renders delimited links within prose with default and escaped multiword labels', async () => {
    const html = await render('Before {{showRepoLink /docs}} and {{showRepoLink <Views & Details> /bundle/v0.1/core/views.yaml}} after.')
    expect(html).toContain('<p>Before <span')
    expect(html).toContain('<IconGitHub/><code>Repo folder</code></a>')
    expect(html).toContain('<IconGitHub/><code>&lt;Views &amp; Details&gt;</code></a>')
    expect(html).toContain('</span> after.</p>')
  })

  it('leaves delimited syntax literal in code, escaped text, and existing links', async () => {
    const html = await render([
      '`{{showRepoLink /docs}}`',
      '',
      '```md',
      '{{showRepoLink /docs}}',
      '```',
      '',
      String.raw`\{{showRepoLink /docs}}`,
      '',
      '[{{showRepoLink /docs}}](https://example.com)'
    ].join('\n'))
    expect(html).not.toContain('repo-link-inline')
    expect(html).not.toContain('github.com/knutopia')
  })

  it('preserves the standalone right-aligned link', async () => {
    const html = await render(
      'showRepoLink /docs/doc_site/small_app_example/\n'
    )

    expect(html).toContain('<IconGitHub/>Repo folder</a>')
    expect(html).toContain('<div class="link-right">')
    expect(html).not.toContain('link-right-up')
    expect(html).toContain(
      'href="https://github.com/knutopia/Structured-Design-Documents/tree/main/docs/doc_site/small_app_example/"'
    )
    expect(html).toContain('target="_blank" rel="noreferrer"')
  })

  it.each(['', ' {pos: up}'])('renders a custom file label with option %s', async (option) => {
    const html = await render(`Source\nshowRepoLink fileDisplayName /bundle/v0.1/core/views.yaml${option}\n`)

    expect(html).toContain('<IconGitHub/>fileDisplayName</a>')
    expect(html).toContain('href="https://github.com/knutopia/Structured-Design-Documents/tree/main/bundle/v0.1/core/views.yaml"')
    expect(html).toContain('target="_blank" rel="noreferrer"')
    expect(html).toContain(option ? '<span class="link-right link-right-up">' : '<div class="link-right">')
    expect(html).not.toContain('Repo folder')
  })

  it.each([
    ['fileDisplayName ', 'fileDisplayName'],
    ['', 'Repo folder']
  ])('flows an inline link with label %s between surrounding text', async (label, expectedLabel) => {
    const html = await render([
      'before',
      `showRepoLink ${label}/bundle/v0.1/core/views.yaml {pos: inline}`,
      'after'
    ].join('\n'))

    expect(html).toBe(
      `<p>before\n<span class="repo-link-inline"><a href="https://github.com/knutopia/Structured-Design-Documents/tree/main/bundle/v0.1/core/views.yaml" target="_blank" rel="noreferrer"><IconGitHub/>${expectedLabel}</a></span>\nafter</p>\n`
    )
  })

  it('preserves explicit paragraph boundaries around inline links', async () => {
    const html = await render('before\n\nshowRepoLink views.yaml /bundle/v0.1/core/views.yaml {pos: inline}\n\nafter')
    expect(html).toContain('<p>before</p>')
    expect(html).toContain('<p><span class="repo-link-inline"><a ')
    expect(html).toContain('</span></p>')
    expect(html).toContain('<p>after</p>')
    expect(html).not.toContain('link-right')
  })

  it.each(['', ' {pos: up}', ' {pos: inline}'])('supports a multiword display name with option %s', async (option) => {
    const html = await render(`before\nshowRepoLink presentation model src/renderer/uiContractsPresentationModel.ts${option}\nafter`)
    expect(html).toContain('<IconGitHub/>presentation model</a>')
    expect(html).toContain('href="https://github.com/knutopia/Structured-Design-Documents/tree/main/src/renderer/uiContractsPresentationModel.ts"')
    if (option === ' {pos: inline}') {
      expect(html).toMatch(/<p>before\s+<span class="repo-link-inline">.*<\/span>\s+after<\/p>/s)
    }
  })

  it('escapes custom labels as literal text', async () => {
    const html = await render('showRepoLink <Views&Details> /bundle/v0.1/core/views.yaml')
    expect(html).toContain('<IconGitHub/>&lt;Views&amp;Details&gt;</a>')
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
      'showRepoLink views.yaml /bundle/v0.1/core/views.yaml {pos: inline}',
      '```'
    ].join('\n'))

    expect(html).toContain('showRepoLink')
    expect(html).not.toContain('link-right')
  })
})
