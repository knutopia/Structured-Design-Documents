import type { MarkdownRenderer } from 'vitepress'

interface SideBySideTokenMeta {
  slot?: 'left' | 'right'
}

const containerName = 'sideBySide'
const markerCharacter = ':'
const minimumMarkerCount = 3
const dividerPattern = /^==[ \t]*$/

function directiveError(
  state: { env: { realPath?: string; path?: string } },
  line: number,
  message: string
): Error {
  const pagePath = state.env.realPath ?? state.env.path ?? '<unknown page>'
  return new Error(`[sideBySide] ${pagePath}:${line + 1}: ${message}`)
}

function markerCount(source: string, start: number, end: number): number {
  let position = start
  while (position < end && source[position] === markerCharacter) {
    position += 1
  }
  return position - start
}

function isSideBySideContainer(params: string): boolean {
  return new RegExp(`^[ \\t]*${containerName}[ \\t]*$`).test(params)
}

function findDividerLines(
  state: any,
  startLine: number,
  endLine: number
): number[] {
  const dividerLines: number[] = []
  let fence: { marker: '`' | '~'; length: number } | undefined

  for (let line = startLine; line < endLine; line += 1) {
    const start = state.bMarks[line] + state.tShift[line]
    const end = state.eMarks[line]
    const content = state.src.slice(start, end)
    const fenceMatch = /^(`{3,}|~{3,})(.*)$/.exec(content)

    if (fence) {
      if (
        fenceMatch &&
        fenceMatch[1][0] === fence.marker &&
        fenceMatch[1].length >= fence.length &&
        fenceMatch[2].trim() === ''
      ) {
        fence = undefined
      }
      continue
    }

    if (state.sCount[line] === state.blkIndent && fenceMatch) {
      fence = {
        marker: fenceMatch[1][0] as '`' | '~',
        length: fenceMatch[1].length
      }
      continue
    }

    if (
      state.sCount[line] === state.blkIndent &&
      dividerPattern.test(content)
    ) {
      dividerLines.push(line)
    }
  }

  return dividerLines
}

function tokenizeSlot(
  state: any,
  slot: 'left' | 'right',
  startLine: number,
  endLine: number
): void {
  const openToken = state.push('side_by_side_slot_open', 'template', 1)
  openToken.map = [startLine, endLine]
  openToken.meta = { slot } satisfies SideBySideTokenMeta

  const oldParentType = state.parentType
  const oldLineMax = state.lineMax
  state.parentType = 'sideBySideColumn'
  state.lineMax = endLine
  state.md.block.tokenize(state, startLine, endLine)
  state.parentType = oldParentType
  state.lineMax = oldLineMax

  const closeToken = state.push('side_by_side_slot_close', 'template', -1)
  closeToken.meta = { slot } satisfies SideBySideTokenMeta
}

function sideBySideContainerRule(
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

  if (!isSideBySideContainer(state.src.slice(start + openingMarkerCount, end))) {
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

  const dividerLines = findDividerLines(state, startLine + 1, nextLine)
  if (dividerLines.length !== 1) {
    throw directiveError(
      state,
      dividerLines[1] ?? startLine,
      `a sideBySide container requires exactly one == divider; found ${dividerLines.length}`
    )
  }

  const dividerLine = dividerLines[0]
  const openToken = state.push('side_by_side_open', 'SideBySide', 1)
  openToken.markup = state.src.slice(
    state.bMarks[startLine] + state.tShift[startLine],
    state.bMarks[startLine] + state.tShift[startLine] + openingMarkerCount
  )
  openToken.block = true
  openToken.map = [startLine, nextLine]

  tokenizeSlot(state, 'left', startLine + 1, dividerLine)
  tokenizeSlot(state, 'right', dividerLine + 1, nextLine)

  const closeToken = state.push('side_by_side_close', 'SideBySide', -1)
  closeToken.markup = state.src.slice(closingStart, closingEnd)
  closeToken.block = true

  state.line = nextLine + (autoClosed ? 1 : 0)
  return true
}

export function sideBySideMarkdownPlugin(md: MarkdownRenderer): void {
  md.block.ruler.before(
    'fence',
    'side_by_side_container',
    sideBySideContainerRule,
    {
      alt: ['paragraph', 'reference', 'blockquote', 'list']
    }
  )
  md.renderer.rules.side_by_side_open = () => '<SideBySide>\n'
  md.renderer.rules.side_by_side_close = () => '</SideBySide>\n'
  md.renderer.rules.side_by_side_slot_open = (tokens, index) => {
    const meta = tokens[index].meta as SideBySideTokenMeta
    return `<template #${meta.slot}>\n`
  }
  md.renderer.rules.side_by_side_slot_close = () => '</template>\n'
}
