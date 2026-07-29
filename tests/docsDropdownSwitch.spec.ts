import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createMarkdownRenderer,
  disposeMdItInstance,
  type MarkdownRenderer
} from 'vitepress'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'
import { loadBundle } from '../src/bundle/loadBundle.js'
import type {
  RelationshipContract,
  ViewSpec
} from '../src/bundle/types.js'
import { getViewRenderCapability } from '../src/renderer/viewRenderers.js'
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

interface DirectionGroup {
  direction: 'Outgoing' | 'Incoming'
  relationship: string
  counterparts: string[]
}

function directionGroups(
  view: ViewSpec,
  nodeType: string,
  relationships: RelationshipContract[]
): DirectionGroup[] {
  const groups: DirectionGroup[] = []

  function add(
    direction: DirectionGroup['direction'],
    relationship: string,
    counterpart: string
  ): void {
    let group = groups.find(
      (candidate) =>
        candidate.direction === direction &&
        candidate.relationship === relationship
    )
    if (!group) {
      group = { direction, relationship, counterparts: [] }
      groups.push(group)
    }
    if (!group.counterparts.includes(counterpart)) {
      group.counterparts.push(counterpart)
    }
  }

  for (const relationship of relationships) {
    if (!view.projection.include_edge_types.includes(relationship.type)) {
      continue
    }
    for (const endpoint of relationship.allowed_endpoints) {
      if (endpoint.from === nodeType) {
        add('Outgoing', relationship.type, endpoint.to)
      }
      if (endpoint.to === nodeType) {
        add('Incoming', relationship.type, endpoint.from)
      }
    }
  }

  return groups
}

function choiceSections(markdown: string): Map<string, string> {
  const matches = [...markdown.matchAll(/^== (.+)$/gm)]
  return new Map(
    matches.map((match, index) => [
      match[1],
      markdown.slice(
        match.index! + match[0].length,
        matches[index + 1]?.index ?? markdown.lastIndexOf('\n:::')
      )
    ])
  )
}

function sddCodeBlock(markdown: string): string {
  const matches = [...markdown.matchAll(/```sdd\n([\s\S]*?)\n```/g)]
  expect(matches).toHaveLength(1)
  return matches[0][1]
}

function sddNodeSections(source: string): Map<string, string> {
  const matches = [
    ...source.matchAll(
      /^([A-Za-z]+) [A-Z]{1,3}-[0-9]{3,}(?:[a-z][a-z0-9]*)? "[^"]+"\n([\s\S]*?)^END$/gm
    )
  ]
  return new Map(
    matches.map((match) => [
      match[1],
      match[2]
    ])
  )
}

describe('dropdownSwitch diagram-type sample', () => {
  it('tracks staged renderer views and their bundle-owned endpoint contracts', async () => {
    const [bundle, markdown, diagramTypesIndex] = await Promise.all([
      loadBundle('bundle/v0.1/manifest.yaml'),
      readFile(
        'docs/doc_site/diagram_types/dropdown_switch_example.md',
        'utf8'
      ),
      readFile('docs/doc_site/diagram_types/index.md', 'utf8')
    ])
    const stagedViews = bundle.views.views.filter((view) =>
      getViewRenderCapability(view.id)?.previewArtifacts.some(
        (artifact) => artifact.backendClass === 'staged'
      )
    )
    const sections = choiceSections(markdown)
    const indexHeadings = [...diagramTypesIndex.matchAll(/^## (.+)$/gm)].map(
      (match) => match[1]
    )
    const indexOrderedViewNames = indexHeadings.flatMap((heading) => {
      const headingTokens = new Set(
        heading.toLowerCase().match(/[a-z0-9]+/g) ?? []
      )
      const view = stagedViews.find((candidate) =>
        (candidate.name.toLowerCase().match(/[a-z0-9]+/g) ?? []).every(
          (token) => headingTokens.has(token)
        )
      )
      return view ? [view.name] : []
    })

    expect(indexOrderedViewNames).toHaveLength(stagedViews.length)
    expect([...sections.keys()]).toEqual(indexOrderedViewNames)

    for (const view of stagedViews) {
      const section = sections.get(view.name)!
      const source = sddCodeBlock(section)
      const nodes = sddNodeSections(source)
      const nodeList = view.projection.include_node_types
        .map((nodeType) => `\`${nodeType}\``)
        .join(', ')
      expect(section).toContain(`Available node types: ${nodeList}`)
      expect(section).not.toMatch(/^### /m)

      const expectedIncomingComments: string[] = []

      for (const nodeType of view.projection.include_node_types) {
        const groups = directionGroups(
          view,
          nodeType,
          bundle.contracts.relationships
        )
        const outgoing = groups.filter(
          (group) => group.direction === 'Outgoing'
        )
        const incoming = groups.filter(
          (group) => group.direction === 'Incoming'
        )

        const nodeSection = nodes.get(nodeType)
        expect(nodeSection).toBeDefined()
        const actualEdges = nodeSection!
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const match = line.match(
              /^([A-Z_]+) [A-Z]{1,3}-[0-9]{3,}(?:[a-z][a-z0-9]*)? "(?:a|an) ([A-Za-z]+)"$/
            )
            expect(match, `invalid minimal edge line: ${line}`).not.toBeNull()
            return `${match![1]} ${match![2]}`
          })
        const expectedEdges = outgoing.flatMap((group) =>
          group.counterparts.map(
            (counterpart) => `${group.relationship} ${counterpart}`
          )
        )
        expect(actualEdges).toEqual(expectedEdges)

        if (incoming.length > 0) {
          const incomingHeader = `# Incoming edges for ${nodeType}:`
          expectedIncomingComments.push(incomingHeader)
          expectedIncomingComments.push(
            ...incoming.map(
              (group) =>
                `# ${group.counterparts.join(', ')} ${group.relationship} ${nodeType}`
            )
          )
          expect(source).toMatch(
            new RegExp(
              `^${nodeType} [^\\n]+\\n(?:  [^\\n]+\\n)*END\\n\\n${incomingHeader}`,
              'm'
            )
          )
        }
      }

      const actualIncomingComments = source
        .split('\n')
        .filter((line) => line.startsWith('#'))
      expect(actualIncomingComments).toEqual(expectedIncomingComments)
    }
  })
})
