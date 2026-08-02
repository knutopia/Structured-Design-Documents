import type { MarkdownRenderer } from 'vitepress'

interface AccordionScrollExpanderTokenMeta {
  index?: number
}

interface HeadingIndex {
  token: any
  index: number
}

const containerName = 'accordionScrollExpander'
const markerCharacter = ':'
const minimumMarkerCount = 3

function directiveError(
  state: { env: { realPath?: string; path?: string } },
  line: number,
  message: string
): Error {
  const pagePath = state.env.realPath ?? state.env.path ?? '<unknown page>'
  return new Error(
    `[accordionScrollExpander] ${pagePath}:${line + 1}: ${message}`
  )
}

function markerCount(source: string, start: number, end: number): number {
  let position = start
  while (position < end && source[position] === markerCharacter) {
    position += 1
  }
  return position - start
}

function isAccordionScrollExpanderContainer(params: string): boolean {
  return new RegExp(`^[ \\t]*${containerName}[ \\t]*$`).test(params)
}

function createStructureToken(
  state: any,
  type: string,
  tag: string,
  nesting: 1 | 0 | -1,
  level: number,
  index?: number,
  map?: [number, number]
): any {
  const token = new state.Token(type, tag, nesting)
  token.block = true
  token.level = level
  token.map = map ?? null
  token.meta = { index } satisfies AccordionScrollExpanderTokenMeta
  return token
}

function accordionScrollExpanderContainerRule(
  state: any,
  startLine: number,
  endLine: number,
  silent: boolean
): boolean {
  let start = state.bMarks[startLine] + state.tShift[startLine]
  let end = state.eMarks[startLine]

  if (state.src[start] !== markerCharacter) {
    return false
  }

  const openingMarkerCount = markerCount(state.src, start, end)
  if (openingMarkerCount < minimumMarkerCount) {
    return false
  }

  if (
    !isAccordionScrollExpanderContainer(
      state.src.slice(start + openingMarkerCount, end)
    )
  ) {
    return false
  }
  if (silent) {
    return true
  }

  let nextLine = startLine
  let autoClosed = false
  let closingStart = start
  let closingEnd = start + openingMarkerCount

  for (;;) {
    nextLine += 1
    if (nextLine >= endLine) {
      break
    }

    start = state.bMarks[nextLine] + state.tShift[nextLine]
    end = state.eMarks[nextLine]
    if (start < end && state.sCount[nextLine] < state.blkIndent) {
      break
    }
    if (state.src[start] !== markerCharacter) {
      continue
    }
    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      continue
    }

    const count = markerCount(state.src, start, end)
    if (count < openingMarkerCount) {
      continue
    }
    if (state.src.slice(start + count, end).trim() !== '') {
      continue
    }

    autoClosed = true
    closingStart = start
    closingEnd = start + count
    break
  }

  const openToken = state.push(
    'accordion_scroll_expander_open',
    'AccordionScrollExpander',
    1
  )
  openToken.markup = state.src.slice(
    state.bMarks[startLine] + state.tShift[startLine],
    state.bMarks[startLine] + state.tShift[startLine] + openingMarkerCount
  )
  openToken.block = true
  openToken.map = [startLine, nextLine]

  const firstInnerTokenIndex = state.tokens.length
  const oldParentType = state.parentType
  const oldLineMax = state.lineMax
  state.parentType = 'accordionScrollExpander'
  state.lineMax = nextLine
  state.md.block.tokenize(state, startLine + 1, nextLine)
  state.parentType = oldParentType
  state.lineMax = oldLineMax

  const innerTokens = state.tokens.splice(firstInnerTokenIndex)
  const directLevel = openToken.level + 1
  const headingIndexes: HeadingIndex[] = innerTokens
    .map((token: any, index: number): HeadingIndex => ({ token, index }))
    .filter(
      ({ token }: HeadingIndex) =>
        token.type === 'heading_open' &&
        token.tag === 'h2' &&
        token.level === directLevel
    )

  if (headingIndexes.length === 0 || headingIndexes[0].index !== 0) {
    const firstToken = innerTokens[0]
    throw directiveError(
      state,
      firstToken?.map?.[0] ?? startLine,
      'content must start with a top-level ## heading'
    )
  }

  if (headingIndexes.length < 2) {
    throw directiveError(
      state,
      startLine,
      `an accordionScrollExpander requires at least two top-level ## sections; found ${headingIndexes.length}`
    )
  }

  headingIndexes.forEach(
    ({ token, index: headingIndex }: HeadingIndex, sectionIndex: number) => {
      const nextHeadingIndex =
        headingIndexes[sectionIndex + 1]?.index ?? innerTokens.length
      const headingCloseIndex = innerTokens.findIndex(
        (candidate: any, candidateIndex: number) =>
          candidateIndex > headingIndex &&
          candidate.type === 'heading_close' &&
          candidate.tag === 'h2' &&
          candidate.level === token.level
      )

      if (headingCloseIndex < 0 || headingCloseIndex >= nextHeadingIndex) {
        throw directiveError(
          state,
          token.map?.[0] ?? startLine,
          'could not determine the end of a top-level ## heading'
        )
      }

      const sectionStartLine = token.map?.[0] ?? startLine + 1
      const sectionEndLine =
        headingIndexes[sectionIndex + 1]?.token.map?.[0] ?? nextLine
      const headingTokens = innerTokens.slice(
        headingIndex,
        headingCloseIndex + 1
      )
      const contentTokens = innerTokens.slice(
        headingCloseIndex + 1,
        nextHeadingIndex
      )

      state.tokens.push(
        createStructureToken(
          state,
          'accordion_scroll_expander_item_open',
          'details',
          1,
          directLevel,
          sectionIndex,
          [sectionStartLine, sectionEndLine]
        ),
        createStructureToken(
          state,
          'accordion_scroll_expander_summary_open',
          'summary',
          1,
          directLevel + 1,
          sectionIndex
        ),
        ...headingTokens,
        createStructureToken(
          state,
          'accordion_scroll_expander_summary_close',
          'summary',
          -1,
          directLevel + 1,
          sectionIndex
        ),
        createStructureToken(
          state,
          'accordion_scroll_expander_content_open',
          'div',
          1,
          directLevel + 1,
          sectionIndex
        ),
        ...contentTokens,
        createStructureToken(
          state,
          'accordion_scroll_expander_content_close',
          'div',
          -1,
          directLevel + 1,
          sectionIndex
        ),
        createStructureToken(
          state,
          'accordion_scroll_expander_item_close',
          'details',
          -1,
          directLevel,
          sectionIndex
        )
      )
    }
  )

  const closeToken = state.push(
    'accordion_scroll_expander_close',
    'AccordionScrollExpander',
    -1
  )
  closeToken.markup = state.src.slice(closingStart, closingEnd)
  closeToken.block = true

  state.line = nextLine + (autoClosed ? 1 : 0)
  return true
}

export function accordionScrollExpanderMarkdownPlugin(
  md: MarkdownRenderer
): void {
  md.block.ruler.before(
    'fence',
    'accordion_scroll_expander_container',
    accordionScrollExpanderContainerRule,
    {
      alt: ['paragraph', 'reference', 'blockquote', 'list']
    }
  )

  md.renderer.rules.accordion_scroll_expander_open = () =>
    '<AccordionScrollExpander>\n'
  md.renderer.rules.accordion_scroll_expander_close = () =>
    '</AccordionScrollExpander>\n'
  md.renderer.rules.accordion_scroll_expander_item_open = (tokens, index) => {
    const meta = tokens[index].meta as AccordionScrollExpanderTokenMeta
    return `<details class="accordion-scroll-expander__item" data-accordion-scroll-item data-accordion-scroll-index="${meta.index}">\n`
  }
  md.renderer.rules.accordion_scroll_expander_item_close = () =>
    '</details>\n'
  md.renderer.rules.accordion_scroll_expander_summary_open = () =>
    '<summary class="accordion-scroll-expander__summary">\n'
  md.renderer.rules.accordion_scroll_expander_summary_close = () =>
    '</summary>\n'
  md.renderer.rules.accordion_scroll_expander_content_open = () =>
    '<div class="accordion-scroll-expander__content">\n<div class="accordion-scroll-expander__content-inner">\n'
  md.renderer.rules.accordion_scroll_expander_content_close = () =>
    '</div>\n</div>\n'
}
