import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { loadBundle } from '../src/bundle/loadBundle.js'
import type {
  RelationshipContract,
  ViewSpec
} from '../src/bundle/types.js'
import { getViewRenderCapability } from '../src/renderer/viewRenderers.js'

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

describe('diagram type node-and-edge reference', () => {
  it('tracks staged renderer views and their bundle-owned endpoint contracts', async () => {
    const [bundle, markdown, diagramTypesIndex] = await Promise.all([
      loadBundle('bundle/v0.1/manifest.yaml'),
      readFile(
        'docs/doc_site/diagram_types/node_edge_reference.md',
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
              /^([A-Z_]+) [A-Z]{1,3}-[0-9]{3,}(?:[a-z][a-z0-9]*)? "(?:a|an) ([A-Za-z]+)"(?: # \((?:hidden|shown with strict profile)\))?$/
            )
            expect(match, `invalid edge reference line: ${line}`).not.toBeNull()
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
