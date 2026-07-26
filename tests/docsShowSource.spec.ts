import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createMarkdownRenderer,
  disposeMdItInstance,
  type MarkdownRenderer
} from 'vitepress'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'
import { showSourceMarkdownPlugin } from '../docs/doc_site/.vitepress/markdown/showSource'

interface RenderResult {
  html: string
  includes: string[]
}

let fixtureRoot: string
let pagePath: string
let sourcePath: string
let renderer: MarkdownRenderer

function sourceLine(line: number): string {
  return `const sourceLine${String(line).padStart(3, '0')} = ${line}`
}

async function render(markdown: string): Promise<RenderResult> {
  const includes: string[] = []
  const html = await renderer.renderAsync(markdown, {
    path: pagePath,
    realPath: pagePath,
    relativePath: 'page.md',
    cleanUrls: true,
    includes
  })
  return { html, includes }
}

function highlightedLineCount(html: string): number {
  return html.match(/class="line highlighted"/g)?.length ?? 0
}

function renderedLineNumbers(html: string): number[] {
  return [...html.matchAll(/class="line-number">(\d+)/g)]
    .map((match) => Number.parseInt(match[1], 10))
}

describe('showSource Markdown-it plugin', () => {
  beforeAll(async () => {
    fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'sdd-show-source-'))
    pagePath = path.join(fixtureRoot, 'page.md')
    sourcePath = path.join(fixtureRoot, 'sample.ts')
    await writeFile(pagePath, '# Fixture\n', 'utf8')
    await writeFile(
      sourcePath,
      `${Array.from({ length: 100 }, (_, index) => sourceLine(index + 1)).join('\n')}\n`,
      'utf8'
    )

    renderer = await createMarkdownRenderer(fixtureRoot, {
      config(md) {
        md.use(tabsMarkdownPlugin)
        md.use(showSourceMarkdownPlugin, { lineNumbers: true })
      }
    })
  })

  afterAll(async () => {
    disposeMdItInstance()
    await rm(fixtureRoot, { force: true, recursive: true })
  })

  it('preserves full-file rendering, filename labels, and dependency tracking', async () => {
    const result = await render('showSource ./sample.ts\n')
    const tokens = renderer.parse('showSource ./sample.ts\n', {
      path: pagePath,
      realPath: pagePath,
      relativePath: 'page.md',
      cleanUrls: true,
      includes: []
    })

    expect(result.html).toContain('source-scroll')
    expect(result.html).toContain('sourceLine001')
    expect(result.html).toContain('sourceLine100')
    expect(result.includes).toEqual([sourcePath])
    expect(tokens.find((token) => token.type === 'fence')?.info)
      .toContain('[sample.ts]')
    expect(renderedLineNumbers(result.html)[0]).toBe(1)
    expect(renderedLineNumbers(result.html).at(-1)).toBe(100)
  })

  it('supports single and spaced multi-range highlights', async () => {
    const single = await render('showSource ./sample.ts {15}\n')
    const multiple = await render(
      'showSource ./sample.ts {2-4, 8-10}\n'
    )

    expect(highlightedLineCount(single.html)).toBe(1)
    expect(highlightedLineCount(multiple.html)).toBe(6)
  })

  it.each([
    ['60-', 'sourceLine060', 'sourceLine100', 'sourceLine059'],
    ['60-70', 'sourceLine060', 'sourceLine070', 'sourceLine071'],
    ['-70', 'sourceLine001', 'sourceLine070', 'sourceLine071']
  ])(
    'supports the {lines %s} selection',
    async (selection, firstIncluded, lastIncluded, excluded) => {
      const result = await render(
        `showSource ./sample.ts {lines ${selection}}\n`
      )

      expect(result.html).toContain(firstIncluded)
      expect(result.html).toContain(lastIncluded)
      expect(result.html).not.toContain(excluded)
      const expectedStart = selection.startsWith('-')
        ? 1
        : Number.parseInt(selection.split('-')[0], 10)
      expect(renderedLineNumbers(result.html)[0]).toBe(expectedStart)
    }
  )

  it('clamps oversized ends and remaps original-file highlights', async () => {
    const result = await render(
      'showSource ./sample.ts {69-75,84-120} {lines 60-120}\n'
    )

    expect(result.html).not.toContain('sourceLine059')
    expect(result.html).toContain('sourceLine060')
    expect(result.html).toContain('sourceLine100')
    expect(highlightedLineCount(result.html)).toBe(24)
  })

  it('accepts the line selection before the highlight selection', async () => {
    const result = await render(
      'showSource ./sample.ts {lines 60-70} {69-70}\n'
    )

    expect(highlightedLineCount(result.html)).toBe(2)
  })

  it('renders inside an indented details container', async () => {
    const result = await render([
      '::: details Source',
      '  showSource ./sample.ts {2} {lines 2-3}',
      ':::'
    ].join('\n'))

    expect(result.html).toContain('<details')
    expect(result.html).toContain('source-scroll')
    expect(result.html).toContain('sourceLine002')
    expect(result.html).not.toContain('sourceLine001')
    expect(highlightedLineCount(result.html)).toBe(1)
  })

  it('renders inside a tab nested in a details container', async () => {
    const result = await render([
      ':::: details Source',
      '  :::tabs',
      '  == Preview',
      '  Preview content',
      '  == Source',
      '  showSource ./sample.ts {2} {lines 2-3}',
      '  :::',
      '::::'
    ].join('\n'))

    expect(result.html).toContain('<details')
    expect(result.html).toContain('<PluginTabs')
    expect(result.html).toContain('source-scroll')
    expect(result.html).toContain('sourceLine002')
    expect(result.html).not.toContain('sourceLine001')
    expect(highlightedLineCount(result.html)).toBe(1)
  })

  it('leaves showSource text inside fenced examples untouched', async () => {
    const result = await render([
      '```md',
      'showSource ./sample.ts {lines 60-}',
      '```'
    ].join('\n'))

    expect(result.html).not.toContain('source-scroll')
    expect(result.html).toContain('showSource')
    expect(result.includes).toEqual([])
  })

  it('does not add line numbers to ordinary fenced code blocks', async () => {
    const result = await render([
      '```ts',
      'const ordinaryFence = true',
      '```'
    ].join('\n'))

    expect(result.html).not.toContain('line-numbers-mode')
    expect(renderedLineNumbers(result.html)).toEqual([])
  })

  it.each([
    ['showSource ./missing.ts', 'source file not found'],
    ['showSource ./sample.ts {lines 0-10}', 'positive integers'],
    ['showSource ./sample.ts {lines 20-10}', 'reversed'],
    ['showSource ./sample.ts {lines 101-}', 'does not select any'],
    ['showSource ./sample.ts {lines nope}', 'line selection must use']
  ])('rejects invalid directive %s', async (directive, message) => {
    await expect(render(`${directive}\n`)).rejects.toThrow(message)
    await expect(render(`${directive}\n`)).rejects.toThrow(`${pagePath}:1`)
  })

  it('can disable showSource line numbers independently of VitePress', async () => {
    disposeMdItInstance()
    renderer = await createMarkdownRenderer(fixtureRoot, {
      lineNumbers: true,
      config(md) {
        md.use(tabsMarkdownPlugin)
        md.use(showSourceMarkdownPlugin, { lineNumbers: false })
      }
    })

    const result = await render('showSource ./sample.ts {lines 60-70}\n')

    expect(result.html).not.toContain('line-numbers-mode')
    expect(renderedLineNumbers(result.html)).toEqual([])
  })
})
