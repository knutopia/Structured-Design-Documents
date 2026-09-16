import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createMarkdownRenderer,
  disposeMdItInstance,
  type MarkdownRenderer
} from 'vitepress'
import { containerTitleMarkdownPlugin } from '../docs/doc_site/.vitepress/markdown/containerTitle'
import { sideBySideMarkdownPlugin } from '../docs/doc_site/.vitepress/markdown/sideBySide'

let renderer: MarkdownRenderer
const pagePath = path.resolve('docs/doc_site/strategic_potential/test-page.md')

async function render(markdown: string): Promise<string> {
  return renderer.renderAsync(markdown, {
    path: pagePath,
    realPath: pagePath,
    relativePath: 'strategic_potential/test-page.md',
    cleanUrls: true,
    includes: []
  })
}

describe('containerTitle Markdown-it plugin', () => {
  beforeAll(async () => {
    renderer = await createMarkdownRenderer('docs/doc_site', {
      config(md) {
        md.use(sideBySideMarkdownPlugin)
        md.use(containerTitleMarkdownPlugin)
      }
    })
  })

  afterAll(() => {
    disposeMdItInstance()
  })

  it('adds the h4 title class without emitting a heading element', async () => {
    const html = await render([
      '::: info {h4} Impact on Product Decisions',
      'Body text.',
      ':::'
    ].join('\n'))

    expect(html).toContain('custom-block-title-h4')
    expect(html).toContain(
      '<p class="custom-block-title">Impact on Product Decisions</p>'
    )
    expect(html).not.toContain('<h4>')
    expect(html).not.toContain('{h4}')
  })

  it('keeps the default title class when no option is authored', async () => {
    const html = await render([
      '::: info Impact on LLM Output',
      'Body text.',
      ':::'
    ].join('\n'))

    expect(html).not.toContain('custom-block-title-h4')
    expect(html).toContain(
      '<p class="custom-block-title">Impact on LLM Output</p>'
    )
  })

  it('keeps the default label when an untitled container has no title text', async () => {
    const html = await render(['::: info', 'Body text.', ':::'].join('\n'))

    expect(html).toContain('custom-block-title-default')
    expect(html).toContain('>INFO</p>')
  })

  it('applies the option to an untitled container', async () => {
    const html = await render(['::: tip {h4}', 'Body text.', ':::'].join('\n'))

    expect(html).toContain('custom-block-title-h4')
    expect(html).toContain('custom-block-title-default')
    expect(html).toContain('>TIP</p>')
  })

  it('supports the details container summary', async () => {
    const html = await render([
      '::: details {h4} Example source',
      'Body text.',
      ':::'
    ].join('\n'))

    expect(html).toContain('custom-block-title-h4')
    expect(html).toContain('<summary>Example source</summary>')
  })

  it('renders inline Markdown in an opted-in title', async () => {
    const html = await render([
      '::: warning {h4} **Bold** and `code`',
      'Body text.',
      ':::'
    ].join('\n'))

    expect(html).toContain('custom-block-title-h4')
    expect(html).toContain(
      '<p class="custom-block-title"><strong>Bold</strong> and <code>code</code></p>'
    )
  })

  it('works inside a sideBySide column', async () => {
    const html = await render([
      ':::: sideBySide',
      '::: info {h4} Left title',
      'Left body.',
      ':::',
      '==',
      '::: info Right title',
      'Right body.',
      ':::',
      '::::'
    ].join('\n'))

    const leftSlot = html.slice(
      html.indexOf('<template #left>'),
      html.indexOf('</template>')
    )
    const rightSlot = html.slice(html.indexOf('<template #right>'))

    expect(leftSlot).toContain('custom-block-title-h4')
    expect(leftSlot).toContain('>Left title</p>')
    expect(rightSlot).not.toContain('custom-block-title-h4')
    expect(rightSlot).toContain('>Right title</p>')
  })

  it('leaves fenced authoring examples untouched', async () => {
    const html = await render([
      '```md',
      '::: info {h4} Title',
      'Body text.',
      ':::',
      '```'
    ].join('\n'))

    expect(html).toContain('{h4}')
    expect(html).not.toContain('custom-block-title-h4')
  })

  it('ignores a brace group that is not the first title token', async () => {
    const html = await render([
      '::: info Impact {h4} on Product',
      'Body text.',
      ':::'
    ].join('\n'))

    expect(html).not.toContain('custom-block-title-h4')
    expect(html).toContain('>Impact {h4} on Product</p>')
  })

  it.each([
    ['::: info {} Title', 'empty container title option {}', 1],
    ['::: info {h3} Title', 'invalid container title option {h3}', 1],
    ['::: info {h4, h3} Title', 'invalid container title option {h3}', 1],
    ['::: details {H4} Title', 'invalid container title option {H4}', 1]
  ])(
    'rejects an invalid title option with page and line context',
    async (markdown, message, line) => {
      await expect(render(`${markdown}\nBody.\n:::`)).rejects.toThrow(message)
      await expect(render(`${markdown}\nBody.\n:::`)).rejects.toThrow(
        `${pagePath}:${line}`
      )
    }
  )
})
