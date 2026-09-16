import type { MarkdownRenderer } from 'vitepress'

/**
 * VitePress containers whose opening token renders a visible title element.
 *
 * `v-pre`, `raw`, and `code-group` are intentionally excluded: their renderers
 * either ignore the authored info string or consume it as tab labels.
 */
const titledContainerTypes = new Set([
  'container_info_open',
  'container_tip_open',
  'container_warning_open',
  'container_danger_open',
  'container_details_open'
])

const coreRuleName = 'container_title_options'
const containerPrefix = 'container_'
const openSuffix = '_open'

/** An option group must be the first thing after the container keyword. */
const leadingOptionPattern = /^[ \t]+\{([^{}]*)\}[ \t]*/
const optionSeparatorPattern = /[ \t,]+/

/**
 * Options that may restyle a container title. Each supported option maps to a
 * `custom-block-title-<option>` class on the container element. The visual
 * result lives entirely in `../theme/title-font.css`, so supporting a new
 * option means listing it here plus adding the matching CSS rule.
 */
const supportedTitleOptions = new Set(['h4'])

const supportedOptionList = [...supportedTitleOptions]
  .map((option) => `{${option}}`)
  .join(' or ')

function directiveError(
  state: { env: { realPath?: string; path?: string } },
  line: number,
  message: string
): Error {
  const pagePath = state.env.realPath ?? state.env.path ?? '<unknown page>'
  return new Error(`[containerTitle] ${pagePath}:${line + 1}: ${message}`)
}

function containerKeyword(tokenType: string): string {
  return tokenType.slice(containerPrefix.length, -openSuffix.length)
}

/**
 * A core rule is used instead of overriding VitePress's container renderer
 * rules. VitePress derives the title text from `token.info` and emits the
 * container's own attributes through `renderAttrs(token)`, so rewriting the
 * info string and joining a class here is enough: the stock renderer then
 * produces the title paragraph without any duplicated VitePress internals.
 *
 * Running after the `block` core rule also means fenced authoring examples are
 * never touched, because their content stays inside a single `fence` token.
 */
function containerTitleCoreRule(state: any): void {
  for (const token of state.tokens) {
    if (!titledContainerTypes.has(token.type)) {
      continue
    }

    const keyword = containerKeyword(token.type)
    const info = String(token.info ?? '').trim()
    if (!info.startsWith(keyword)) {
      continue
    }

    const afterKeyword = info.slice(keyword.length)
    const match = leadingOptionPattern.exec(afterKeyword)
    if (!match) {
      continue
    }

    const line = token.map?.[0] ?? 0
    const options = match[1]
      .split(optionSeparatorPattern)
      .filter((option: string) => option !== '')

    if (options.length === 0) {
      throw directiveError(
        state,
        line,
        `empty container title option {}; expected ${supportedOptionList}`
      )
    }

    for (const option of options) {
      if (!supportedTitleOptions.has(option)) {
        throw directiveError(
          state,
          line,
          `invalid container title option {${option}}; expected ${supportedOptionList}`
        )
      }
    }

    // Leave only the keyword and the authored title for VitePress's container
    // renderer, which slices the keyword off `token.info` to build the title.
    token.info = `${keyword} ${afterKeyword.slice(match[0].length)}`.trimEnd()

    for (const option of options) {
      token.attrJoin('class', `custom-block-title-${option}`)
    }
  }
}

export function containerTitleMarkdownPlugin(md: MarkdownRenderer): void {
  md.core.ruler.after('block', coreRuleName, containerTitleCoreRule)
}
