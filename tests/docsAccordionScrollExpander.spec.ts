import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createMarkdownRenderer,
  disposeMdItInstance,
  type MarkdownRenderer
} from 'vitepress'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'
import { accordionScrollExpanderMarkdownPlugin } from '../docs/doc_site/.vitepress/markdown/accordionScrollExpander'
import { dropdownSwitchMarkdownPlugin } from '../docs/doc_site/.vitepress/markdown/dropdownSwitch'
import { sideBySideMarkdownPlugin } from '../docs/doc_site/.vitepress/markdown/sideBySide'

let renderer: MarkdownRenderer
const pagePath = path.resolve(
  'docs/doc_site/practical_applications/test-page.md'
)

async function render(markdown: string): Promise<string> {
  return renderer.renderAsync(markdown, {
    path: pagePath,
    realPath: pagePath,
    relativePath: 'practical_applications/test-page.md',
    cleanUrls: true,
    includes: []
  })
}

describe('accordionScrollExpander Markdown-it plugin', () => {
  beforeAll(async () => {
    renderer = await createMarkdownRenderer('docs/doc_site', {
      config(md) {
        md.use(tabsMarkdownPlugin)
        md.use(dropdownSwitchMarkdownPlugin)
        md.use(sideBySideMarkdownPlugin)
        md.use(accordionScrollExpanderMarkdownPlugin)
      }
    })
  })

  afterAll(() => {
    disposeMdItInstance()
  })

  it('renders ordered native details sections inside the Vue component', async () => {
    const html = await render([
      '::: accordionScrollExpander',
      '## First section',
      '**First** content with a [link](https://example.com).',
      '',
      '## Second section',
      'Second content.',
      ':::'
    ].join('\n'))

    expect(html).toContain('<AccordionScrollExpander>')
    expect(html).toContain('data-accordion-scroll-index="0"')
    expect(html).toContain('data-accordion-scroll-index="1"')
    expect(html).toContain('<summary class="accordion-scroll-expander__summary">')
    expect(html).toContain('<strong>First</strong> content')
    expect(html).toContain('<a href="https://example.com"')
    expect(html).toContain('</AccordionScrollExpander>')
    expect(html.indexOf('First section')).toBeLessThan(
      html.indexOf('Second section')
    )
  })

  it('preserves VitePress H2 IDs and permalink anchors', async () => {
    const html = await render([
      '::: accordionScrollExpander',
      '## First section',
      'First.',
      '## Second section',
      'Second.',
      ':::'
    ].join('\n'))

    expect(html).toContain('<h2 id="first-section"')
    expect(html).toContain('href="#first-section"')
    expect(html).toContain('<h2 id="second-section"')
    expect(html).toContain('href="#second-section"')
  })

  it('supports lower headings and nested Markdown containers', async () => {
    const html = await render([
      ':::: accordionScrollExpander',
      '## First section',
      '### Nested heading',
      '::: info More',
      'Nested content.',
      ':::',
      '## Second section',
      'Other content.',
      '::::'
    ].join('\n'))

    expect(html).toContain('<h3 id="nested-heading"')
    expect(html).toContain('class="info custom-block"')
    expect(html).toContain('<p>Nested content.</p>')
    expect(html).toContain('data-accordion-scroll-index="1"')
  })

  it('leaves fenced authoring examples untouched', async () => {
    const html = await render([
      '```md',
      '::: accordionScrollExpander',
      '## First section',
      'First.',
      '## Second section',
      'Second.',
      ':::',
      '```'
    ].join('\n'))

    expect(html).not.toContain('<AccordionScrollExpander>')
    expect(html).toContain('accordionScrollExpander')
    expect(html).toContain('First section')
  })

  it('coexists with tabs and dropdownSwitch when all plugins are registered', async () => {
    const html = await render([
      '::: accordionScrollExpander',
      '## First section',
      'First.',
      '## Second section',
      'Second.',
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

    expect(html).toContain('<AccordionScrollExpander>')
    expect(html).toContain('<PluginTabs')
    expect(html).toContain('<DropdownSwitch')
  })

  it.each([
    [
      [
        '::: accordionScrollExpander',
        'Intro.',
        '## First',
        'One.',
        '## Second',
        'Two.',
        ':::'
      ].join('\n'),
      'content must start with a top-level ## heading',
      2
    ],
    [
      [
        '::: accordionScrollExpander',
        '## Only one',
        'Content.',
        ':::'
      ].join('\n'),
      'requires at least two top-level ## sections; found 1',
      1
    ],
    [
      [
        '::: accordionScrollExpander',
        '### Wrong level',
        'One.',
        '## Second',
        'Two.',
        ':::'
      ].join('\n'),
      'content must start with a top-level ## heading',
      2
    ],
    [
      [
        '::: accordionScrollExpander',
        'Paragraph only.',
        ':::'
      ].join('\n'),
      'content must start with a top-level ## heading',
      2
    ]
  ])(
    'rejects invalid section structure with page and line context',
    async (markdown, message, line) => {
      await expect(render(markdown as string)).rejects.toThrow(message as string)
      await expect(render(markdown as string)).rejects.toThrow(
        `${pagePath}:${line as number}`
      )
    }
  )
})
