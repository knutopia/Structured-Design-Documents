import fs from 'node:fs'
import path from 'node:path'
import type { MarkdownRenderer } from 'vitepress'
import { normalizePath } from 'vite'

interface LineRange {
  start: number
  end: number
}

interface LineSelection {
  start?: number
  end?: number
}

interface ShowSourceDirective {
  sourcePath: string
  highlightedLines: LineRange[]
  selection?: LineSelection
}

export interface ShowSourceMarkdownOptions {
  lineNumbers?: boolean
}

const directiveStartPattern = /^showSource(?:[ \t]|$)/
const directivePattern =
  /^showSource[ \t]+([^{}\s]+)((?:[ \t]+\{[^{}\r\n]*\})*)[ \t]*$/
const optionPattern = /\{([^{}\r\n]*)\}/g
const highlightedLinesPattern =
  /^\d+(?:-\d+)?(?:[ \t]*,[ \t]*\d+(?:-\d+)?)*$/
const lineSelectionPattern = /^lines[ \t]+(\d*)[ \t]*-[ \t]*(\d*)$/

function parsePositiveInteger(value: string, optionName: string): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${optionName} line numbers must be positive integers`)
  }
  return parsed
}

function parseHighlightedLines(value: string): LineRange[] {
  return value.split(',').map((part) => {
    const [rawStart, rawEnd] = part.trim().split('-')
    const start = parsePositiveInteger(rawStart, 'highlight')
    const end = rawEnd === undefined
      ? start
      : parsePositiveInteger(rawEnd, 'highlight')

    if (start > end) {
      throw new Error(`highlight range ${part.trim()} is reversed`)
    }

    return { start, end }
  })
}

function parseLineSelection(value: string): LineSelection {
  const match = lineSelectionPattern.exec(value)
  if (!match || (!match[1] && !match[2])) {
    throw new Error(
      'line selection must use {lines START-END}, {lines START-}, or {lines -END}'
    )
  }

  const start = match[1]
    ? parsePositiveInteger(match[1], 'selection')
    : undefined
  const end = match[2]
    ? parsePositiveInteger(match[2], 'selection')
    : undefined

  if (start !== undefined && end !== undefined && start > end) {
    throw new Error(`line selection ${start}-${end} is reversed`)
  }

  return { start, end }
}

function parseShowSourceDirective(line: string): ShowSourceDirective | undefined {
  if (!directiveStartPattern.test(line)) {
    return undefined
  }

  const match = directivePattern.exec(line)
  if (!match) {
    throw new Error('invalid showSource directive syntax')
  }

  const sourcePath = match[1]
  let highlightedLines: LineRange[] = []
  let selection: LineSelection | undefined

  for (const optionMatch of match[2].matchAll(optionPattern)) {
    const option = optionMatch[1].trim()
    if (option.startsWith('lines')) {
      if (selection) {
        throw new Error('showSource accepts only one line selection')
      }
      selection = parseLineSelection(option)
      continue
    }

    if (highlightedLinesPattern.test(option)) {
      if (highlightedLines.length > 0) {
        throw new Error('showSource accepts only one highlight selection')
      }
      highlightedLines = parseHighlightedLines(option)
      continue
    }

    throw new Error(`invalid showSource option {${option}}`)
  }

  return { sourcePath, highlightedLines, selection }
}

function sourceLines(content: string): {
  lines: string[]
  trailingNewline: boolean
} {
  const normalized = content.replace(/\r\n?/g, '\n')
  const trailingNewline = normalized.endsWith('\n')
  const lines = normalized === '' ? [] : normalized.split('\n')

  if (trailingNewline) {
    lines.pop()
  }

  return { lines, trailingNewline }
}

function selectSource(
  content: string,
  selection: LineSelection | undefined
): {
  content: string
  start: number
  end: number
  lineCount: number
} {
  const { lines, trailingNewline } = sourceLines(content)
  const lineCount = lines.length

  if (!selection) {
    return {
      content: content.replace(/\r\n?/g, '\n'),
      start: 1,
      end: lineCount,
      lineCount
    }
  }

  const start = selection.start ?? 1
  const requestedEnd = selection.end ?? lineCount
  const end = Math.min(requestedEnd, lineCount)

  if (lineCount === 0 || start > lineCount || start > end) {
    const range = `${selection.start ?? ''}-${selection.end ?? ''}`
    throw new Error(`line selection ${range} does not select any source lines`)
  }

  const selectedLines = lines.slice(start - 1, end)
  let selectedContent = selectedLines.join('\n')
  if (end === lineCount && trailingNewline) {
    selectedContent += '\n'
  }

  return { content: selectedContent, start, end, lineCount }
}

function remapHighlightedLines(
  ranges: LineRange[],
  selectedStart: number,
  selectedEnd: number,
  lineCount: number
): string {
  const mapped: string[] = []

  for (const range of ranges) {
    const start = Math.max(range.start, selectedStart)
    const end = Math.min(range.end, selectedEnd, lineCount)
    if (start > end) {
      continue
    }

    const relativeStart = start - selectedStart + 1
    const relativeEnd = end - selectedStart + 1
    mapped.push(
      relativeStart === relativeEnd
        ? String(relativeStart)
        : `${relativeStart}-${relativeEnd}`
    )
  }

  return mapped.join(',')
}

function directiveError(
  state: { env: { realPath?: string; path?: string } },
  startLine: number,
  message: string
): Error {
  const pagePath = state.env.realPath ?? state.env.path ?? '<unknown page>'
  return new Error(
    `[showSource] ${pagePath}:${startLine + 1}: ${message}`
  )
}

export function showSourceMarkdownPlugin(
  md: MarkdownRenderer,
  { lineNumbers = false }: ShowSourceMarkdownOptions = {}
): void {
  md.block.ruler.before(
    'fence',
    'show_source',
    (state, startLine, _endLine, silent) => {
      if (state.sCount[startLine] - state.blkIndent >= 4) {
        return false
      }

      const start = state.bMarks[startLine] + state.tShift[startLine]
      const end = state.eMarks[startLine]
      const line = state.src.slice(start, end)

      if (!directiveStartPattern.test(line)) {
        return false
      }
      if (silent) {
        return true
      }

      let directive: ShowSourceDirective
      try {
        directive = parseShowSourceDirective(line)!
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw directiveError(state, startLine, message)
      }

      const pagePath = state.env.realPath ?? state.env.path
      if (!pagePath) {
        throw directiveError(
          state,
          startLine,
          'cannot resolve the containing Markdown file'
        )
      }

      const resolvedSourcePath = path.resolve(
        path.dirname(pagePath),
        directive.sourcePath
      )
      if (
        !fs.existsSync(resolvedSourcePath) ||
        !fs.statSync(resolvedSourcePath).isFile()
      ) {
        throw directiveError(
          state,
          startLine,
          `source file not found: ${directive.sourcePath}`
        )
      }

      let selected: ReturnType<typeof selectSource>
      try {
        selected = selectSource(
          fs.readFileSync(resolvedSourcePath, 'utf8'),
          directive.selection
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw directiveError(state, startLine, message)
      }

      const highlightedLines = remapHighlightedLines(
        directive.highlightedLines,
        selected.start,
        selected.end,
        selected.lineCount
      )
      const language = directive.sourcePath.endsWith('.sdd') ? 'sdd' : 'ts'
      const title = path.basename(directive.sourcePath)
      const lineNumberMode = lineNumbers
        ? `:line-numbers=${selected.start}`
        : ':no-line-numbers'

      const markerToken = state.push('html_block', '', 0)
      markerToken.content = '<div class="source-scroll"></div>\n'
      markerToken.map = [startLine, startLine + 1]

      const fenceToken = state.push('fence', 'code', 0)
      fenceToken.content = selected.content
      fenceToken.info =
        `${language}${lineNumberMode}${highlightedLines ? `{${highlightedLines}}` : ''}[${title}]`
      fenceToken.markup = '```'
      fenceToken.map = [startLine, startLine + 1]

      state.env.includes ??= []
      const normalizedSourcePath = normalizePath(resolvedSourcePath)
      if (!state.env.includes.includes(normalizedSourcePath)) {
        state.env.includes.push(normalizedSourcePath)
      }

      state.line = startLine + 1
      return true
    }
  )
}
