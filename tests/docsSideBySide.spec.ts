import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createMarkdownRenderer,
  disposeMdItInstance,
  type MarkdownRenderer
} from 'vitepress'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'
import { dropdownSwitchMarkdownPlugin } from '../docs/doc_site/.vitepress/markdown/dropdownSwitch'
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

describe('sideBySide Markdown-it plugin', () => {
  beforeAll(async () => {
    renderer = await createMarkdownRenderer('docs/doc_site', {
      config(md) {
        md.use(tabsMarkdownPlugin)
        md.use(dropdownSwitchMarkdownPlugin)
        md.use(sideBySideMarkdownPlugin)
      }
    })
  })

  afterAll(() => {
    disposeMdItInstance()
  })

  it('renders arbitrary Markdown content in named component slots', async () => {
    const html = await render([
      '::: sideBySide',
      '**First** content with a [link](https://example.com).',
      '',
      '==',
      '',
      'Second content.',
      ':::'
    ].join('\n'))

    expect(html).toContain('<SideBySide>')
    expect(html).toContain('<template #left>')
    expect(html).toContain('<template #right>')
    expect(html).toContain('<strong>First</strong> content')
    expect(html).toContain('<a href="https://example.com"')
    expect(html).toContain('>link</a>')
    expect(html).toContain('</SideBySide>')
  })

  it('preserves VitePress heading IDs and anchors', async () => {
    const html = await render([
      '::: sideBySide',
      '### First heading',
      'First.',
      '==',
      '### Second heading',
      'Second.',
      ':::'
    ].join('\n'))

    expect(html).toContain('<h3 id="first-heading"')
    expect(html).toContain('href="#first-heading"')
    expect(html).toContain('<h3 id="second-heading"')
    expect(html).toContain('href="#second-heading"')
  })

  it('includes leading content and nested containers in the left column', async () => {
    const html = await render([
      ':::: sideBySide',
      'Leading content.',
      '',
      '::: info',
      '### First heading',
      'First.',
      ':::',
      '',
      '==',
      '',
      '### Second heading',
      'Second.',
      '::::'
    ].join('\n'))

    const leftSlot = html.slice(
      html.indexOf('<template #left>'),
      html.indexOf('</template>')
    )
    expect(leftSlot).toContain('<p>Leading content.</p>')
    expect(leftSlot).toContain('class="info custom-block"')
    expect(leftSlot).toContain('<h3 id="first-heading"')
    expect(html.indexOf('<template #right>')).toBeLessThan(
      html.indexOf('<h3 id="second-heading"')
    )
  })

  it('leaves fenced authoring examples untouched', async () => {
    const html = await render([
      '```md',
      '::: sideBySide',
      '### First heading',
      'First.',
      '==',
      '### Second heading',
      'Second.',
      ':::',
      '```'
    ].join('\n'))

    expect(html).not.toContain('<SideBySide>')
    expect(html).toContain('sideBySide')
    expect(html).toContain('First heading')
  })

  it('coexists with existing tabs and dropdown containers', async () => {
    const html = await render([
      '::: sideBySide',
      '### Left',
      'Left content.',
      '==',
      '### Right',
      'Right content.',
      ':::',
      '',
      ':::tabs',
      '== Tab one',
      'Tab content.',
      '== Tab two',
      'Other tab content.',
      ':::',
      '',
      '::: dropdownSwitch Example',
      '== Choice one',
      'Choice content.',
      '== Choice two',
      'Other choice content.',
      ':::'
    ].join('\n'))

    expect(html).toContain('<SideBySide>')
    expect(html).toContain('<PluginTabs')
    expect(html).toContain('<DropdownSwitch')
  })

  it('does not treat a divider inside fenced content as the column boundary', async () => {
    const html = await render([
      '::: sideBySide',
      '```text',
      '==',
      '```',
      '==',
      'Right.',
      ':::'
    ].join('\n'))

    const leftSlot = html.slice(
      html.indexOf('<template #left>'),
      html.indexOf('</template>')
    )
    expect(leftSlot).toContain('class="language-text"')
    expect(leftSlot).toContain('<span>==</span>')
    expect(html).toContain('<template #right>')
  })

  it.each([
    [
      ['::: sideBySide', 'Content without a divider.', ':::'].join('\n'),
      'requires exactly one == divider; found 0',
      1
    ],
    [
      ['::: sideBySide', 'Left.', '==', 'Middle.', '==', 'Right.', ':::'].join('\n'),
      'requires exactly one == divider; found 2',
      5
    ]
  ])(
    'rejects an invalid divider count with page and line context',
    async (markdown, message, line) => {
      await expect(render(markdown as string)).rejects.toThrow(message as string)
      await expect(render(markdown as string)).rejects.toThrow(
        `${pagePath}:${line as number}`
      )
    }
  )
})
