import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createMarkdownRenderer,
  disposeMdItInstance,
  type MarkdownRenderer
} from 'vitepress'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'
import { dropdownSwitchMarkdownPlugin } from '../docs/doc_site/.vitepress/markdown/dropdownSwitch'

let renderer: MarkdownRenderer
const pagePath = path.resolve('docs/doc_site/diagram_types/test-page.md')

async function render(markdown: string): Promise<string> {
  return renderer.renderAsync(markdown, {
    path: pagePath,
    realPath: pagePath,
    relativePath: 'diagram_types/test-page.md',
    cleanUrls: true,
    includes: []
  })
}

describe('dropdownSwitch Markdown-it plugin', () => {
  beforeAll(async () => {
    renderer = await createMarkdownRenderer('docs/doc_site', {
      config(md) {
        md.use(tabsMarkdownPlugin)
        md.use(dropdownSwitchMarkdownPlugin)
      }
    })
  })

  afterAll(() => {
    disposeMdItInstance()
  })

  it('renders ordered options and named Markdown slots', async () => {
    const html = await render([
      '::: dropdownSwitch Diagram type',
      '== First choice',
      '**First** content.',
      '== Second choice',
      'Second content.',
      ':::'
    ].join('\n'))

    expect(html).toContain(
      '<DropdownSwitch :options="[{&quot;label&quot;:&quot;First choice&quot;,&quot;value&quot;:&quot;option-0&quot;},{&quot;label&quot;:&quot;Second choice&quot;,&quot;value&quot;:&quot;option-1&quot;}]" label="Diagram type">'
    )
    expect(html).toContain('<template #option-0>')
    expect(html).toContain('<p><strong>First</strong> content.</p>')
    expect(html).toContain('<template #option-1>')
    expect(html).toContain('<p>Second content.</p>')
    expect(html).toContain('</DropdownSwitch>')
  })

  it('uses the default selector label and escapes authored labels', async () => {
    const html = await render([
      '::: dropdownSwitch',
      '== One & "two"',
      'First.',
      '== <Three>',
      'Second.',
      ':::'
    ].join('\n'))

    expect(html).toContain('label="Select an option"')
    expect(html).toContain('&quot;One &amp; \\&quot;two\\&quot;&quot;')
    expect(html).toContain('&quot;&lt;Three&gt;&quot;')
  })

  it('supports nested Markdown containers with longer outer markers', async () => {
    const html = await render([
      ':::: dropdownSwitch Example',
      '== First',
      '::: details More',
      'Nested content.',
      ':::',
      '== Second',
      'Other content.',
      '::::'
    ].join('\n'))

    expect(html).toContain('<details')
    expect(html).toContain('<summary>More</summary>')
    expect(html).toContain('<p>Nested content.</p>')
    expect(html).toContain('<template #option-1>')
  })

  it('coexists with conventional tabs on the same page', async () => {
    const html = await render([
      '::: dropdownSwitch Example',
      '== First',
      'Dropdown one.',
      '== Second',
      'Dropdown two.',
      ':::',
      '',
      ':::tabs',
      '== Tab one',
      'Tab content.',
      '== Tab two',
      'Other tab content.',
      ':::'
    ].join('\n'))

    expect(html).toContain('<DropdownSwitch')
    expect(html).toContain('<template #option-0>')
    expect(html).toContain('<PluginTabs')
    expect(html).toContain('<PluginTabsTab label="Tab one">')
  })

  it('leaves fenced authoring examples untouched', async () => {
    const html = await render([
      '```md',
      '::: dropdownSwitch Example',
      '== First',
      'One.',
      '== Second',
      'Two.',
      ':::',
      '```'
    ].join('\n'))

    expect(html).not.toContain('<DropdownSwitch')
    expect(html).toContain('dropdownSwitch')
    expect(html).toContain('== First')
  })

  it.each([
    [
      ['::: dropdownSwitch', '== Only', 'Content.', ':::'].join('\n'),
      'at least two choices',
      1
    ],
    [
      ['::: dropdownSwitch', '==', 'Content.', '== Second', 'Other.', ':::'].join('\n'),
      'choice labels cannot be blank',
      2
    ],
    [
      ['::: dropdownSwitch', '== Same', 'One.', '== Same', 'Two.', ':::'].join('\n'),
      'duplicate choice label "Same"',
      4
    ],
    [
      ['::: dropdownSwitch', 'Intro.', '== First', 'One.', '== Second', 'Two.', ':::'].join('\n'),
      'content must follow a == Choice label',
      2
    ]
  ])(
    'rejects invalid authored groups with page and line context',
    async (markdown, message, line) => {
      await expect(render(markdown as string)).rejects.toThrow(message as string)
      await expect(render(markdown as string)).rejects.toThrow(
        `${pagePath}:${line as number}`
      )
    }
  )
})
