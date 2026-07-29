import type { MarkdownRenderer } from 'vitepress'

interface DropdownSwitchOption {
  label: string
  value: string
}

interface DropdownSwitchTokenMeta {
  groupId: string
  label?: string
  options?: DropdownSwitchOption[]
  value?: string
}

interface DropdownSwitchContext {
  groupId: string
}

interface DropdownSwitchState {
  dropdownSwitchStack?: DropdownSwitchContext[]
}

const containerName = 'dropdownSwitch'
const defaultLabel = 'Select an option'
const markerCharacter = ':'
const minimumMarkerCount = 3
const optionPattern = /^==(?:[ \t]+(.*?))?[ \t]*$/

function directiveError(
  state: { env: { realPath?: string; path?: string } },
  line: number,
  message: string
): Error {
  const pagePath = state.env.realPath ?? state.env.path ?? '<unknown page>'
  return new Error(`[dropdownSwitch] ${pagePath}:${line + 1}: ${message}`)
}

function parseContainerLabel(params: string): string | undefined {
  const match = new RegExp(
    `^[ \\t]*${containerName}(?:[ \\t]+(.*?))?[ \\t]*$`
  ).exec(params)

  return match ? (match[1]?.trim() || defaultLabel) : undefined
}

function markerCount(source: string, start: number, end: number): number {
  let position = start
  while (position < end && source[position] === markerCharacter) {
    position += 1
  }
  return position - start
}

/**
 * A dedicated container rule is used instead of markdown-it-container because
 * vitepress-plugin-tabs treats `==` inside every generic container as a tab.
 * The custom parent type lets the two authoring syntaxes coexist safely.
 */
function dropdownSwitchContainerRule(
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

  const label = parseContainerLabel(
    state.src.slice(start + openingMarkerCount, end)
  )
  if (!label) {
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

    const remainder = state.src.slice(start + count, end).trim()
    if (remainder !== '') {
      continue
    }

    autoClosed = true
    closingStart = start
    closingEnd = start + count
    break
  }

  const groupId = `dropdown-switch-${startLine}-${state.tokens.length}`

  for (let lineNumber = startLine + 1; lineNumber < nextLine; lineNumber += 1) {
    const contentStart = state.bMarks[lineNumber] + state.tShift[lineNumber]
    const contentEnd = state.eMarks[lineNumber]
    const content = state.src.slice(contentStart, contentEnd)
    if (content.trim() === '') {
      continue
    }
    if (!optionPattern.test(content)) {
      throw directiveError(
        state,
        lineNumber,
        'content must follow a == Choice label'
      )
    }
    break
  }

  const openToken = state.push('dropdown_switch_open', 'DropdownSwitch', 1)
  openToken.markup = state.src.slice(
    state.bMarks[startLine] + state.tShift[startLine],
    state.bMarks[startLine] + state.tShift[startLine] + openingMarkerCount
  )
  openToken.block = true
  openToken.info = label
  openToken.map = [startLine, nextLine]
  openToken.meta = {
    groupId,
    label
  } satisfies DropdownSwitchTokenMeta

  const firstInnerTokenIndex = state.tokens.length
  const oldParentType = state.parentType
  const oldLineMax = state.lineMax
  const extendedState = state as typeof state & DropdownSwitchState
  const stack = extendedState.dropdownSwitchStack ?? []
  extendedState.dropdownSwitchStack = stack

  stack.push({ groupId })
  state.parentType = 'dropdownSwitch'
  state.lineMax = nextLine
  state.md.block.tokenize(state, startLine + 1, nextLine)
  state.parentType = oldParentType
  state.lineMax = oldLineMax
  stack.pop()

  const innerTokens = state.tokens.slice(firstInnerTokenIndex)
  const optionTokens = innerTokens.filter(
    (token: any) =>
      token.type === 'dropdown_switch_option_open' &&
      (token.meta as DropdownSwitchTokenMeta | undefined)?.groupId === groupId
  )

  const firstOptionIndex = innerTokens.findIndex(
    (token: any) =>
      token.type === 'dropdown_switch_option_open' &&
      (token.meta as DropdownSwitchTokenMeta | undefined)?.groupId === groupId
  )
  if (firstOptionIndex > 0) {
    const firstContentToken = innerTokens.find(
      (token: any, index: number) => index < firstOptionIndex && token.map
    )
    throw directiveError(
      state,
      firstContentToken?.map?.[0] ?? startLine + 1,
      'content must follow a == Choice label'
    )
  }

  if (optionTokens.length < 2) {
    throw directiveError(
      state,
      startLine,
      'a dropdownSwitch requires at least two choices'
    )
  }

  const labels = optionTokens.map(
    (token: any) => (token.meta as DropdownSwitchTokenMeta).label!
  )
  const duplicateLabel = labels.find(
    (candidate: string, index: number) => labels.indexOf(candidate) !== index
  )
  if (duplicateLabel) {
    const duplicateToken = optionTokens.find(
      (token: any, index: number) =>
        (token.meta as DropdownSwitchTokenMeta).label === duplicateLabel &&
        labels.indexOf(duplicateLabel) !== index
    )
    throw directiveError(
      state,
      duplicateToken?.map?.[0] ?? startLine,
      `duplicate choice label "${duplicateLabel}"`
    )
  }

  const openMeta = openToken.meta as DropdownSwitchTokenMeta
  openMeta.options = optionTokens.map((token: any) => {
    const meta = token.meta as DropdownSwitchTokenMeta
    return {
      label: meta.label!,
      value: meta.value!
    }
  })

  const closeToken = state.push('dropdown_switch_close', 'DropdownSwitch', -1)
  closeToken.markup = state.src.slice(closingStart, closingEnd)
  closeToken.block = true
  closeToken.meta = { groupId } satisfies DropdownSwitchTokenMeta

  state.line = nextLine + (autoClosed ? 1 : 0)
  return true
}

function dropdownSwitchOptionRule(
  state: any,
  startLine: number,
  endLine: number,
  silent: boolean
): boolean {
  if (state.parentType !== 'dropdownSwitch') {
    return false
  }

  const start = state.bMarks[startLine] + state.tShift[startLine]
  const end = state.eMarks[startLine]
  const line = state.src.slice(start, end)
  if (!line.startsWith('==')) {
    return false
  }

  const match = optionPattern.exec(line)
  if (!match) {
    return false
  }
  if (silent) {
    return true
  }

  const label = match[1]?.trim()
  if (!label) {
    throw directiveError(state, startLine, 'choice labels cannot be blank')
  }

  const extendedState = state as typeof state & DropdownSwitchState
  const context = extendedState.dropdownSwitchStack?.at(-1)
  if (!context) {
    return false
  }

  let nextLine = startLine + 1
  for (; nextLine < endLine; nextLine += 1) {
    const nextStart = state.bMarks[nextLine] + state.tShift[nextLine]
    const nextEnd = state.eMarks[nextLine]

    if (nextStart < nextEnd && state.sCount[nextLine] < state.blkIndent) {
      break
    }

    const nextText = state.src.slice(nextStart, nextEnd)
    if (optionPattern.test(nextText)) {
      break
    }
  }

  const optionIndex = state.tokens.filter(
    (token: any) =>
      token.type === 'dropdown_switch_option_open' &&
      (token.meta as DropdownSwitchTokenMeta | undefined)?.groupId ===
        context.groupId
  ).length
  const value = `option-${optionIndex}`

  const openToken = state.push(
    'dropdown_switch_option_open',
    'template',
    1
  )
  openToken.markup = '=='
  openToken.block = true
  openToken.info = label
  openToken.map = [startLine, nextLine]
  openToken.meta = {
    groupId: context.groupId,
    label,
    value
  } satisfies DropdownSwitchTokenMeta

  const oldParentType = state.parentType
  const oldLineMax = state.lineMax
  state.parentType = 'dropdownSwitchOption'
  state.lineMax = nextLine
  state.md.block.tokenize(state, startLine + 1, nextLine)
  state.parentType = oldParentType
  state.lineMax = oldLineMax

  const closeToken = state.push(
    'dropdown_switch_option_close',
    'template',
    -1
  )
  closeToken.markup = '=='
  closeToken.block = true
  closeToken.meta = {
    groupId: context.groupId,
    value
  } satisfies DropdownSwitchTokenMeta

  state.line = nextLine
  return true
}

export function dropdownSwitchMarkdownPlugin(md: MarkdownRenderer): void {
  md.block.ruler.before(
    'fence',
    'dropdown_switch_container',
    dropdownSwitchContainerRule,
    {
      alt: ['paragraph', 'reference', 'blockquote', 'list']
    }
  )
  md.block.ruler.before(
    'paragraph',
    'dropdown_switch_option',
    dropdownSwitchOptionRule
  )

  md.renderer.rules.dropdown_switch_open = (tokens, index) => {
    const meta = tokens[index].meta as DropdownSwitchTokenMeta
    const options = md.utils.escapeHtml(JSON.stringify(meta.options))
    const label = md.utils.escapeHtml(meta.label ?? defaultLabel)
    return `<DropdownSwitch :options="${options}" label="${label}">\n`
  }
  md.renderer.rules.dropdown_switch_close = () => '</DropdownSwitch>\n'
  md.renderer.rules.dropdown_switch_option_open = (tokens, index) => {
    const meta = tokens[index].meta as DropdownSwitchTokenMeta
    return `<template #${meta.value}>\n`
  }
  md.renderer.rules.dropdown_switch_option_close = () => '</template>\n'
}
