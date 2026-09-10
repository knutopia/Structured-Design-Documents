import type { MarkdownRenderer } from 'vitepress'

type RepoLinkPosition = 'up' | 'inline'

interface ShowRepoLinkDirective {
  indentation: string
  repoPath: string
  displayName: string
  position?: RepoLinkPosition
}

const githubRepoTreeUrl =
  'https://github.com/knutopia/Structured-Design-Documents/tree/main/'
const directiveStartPattern = /^showRepoLink(?:[ \t]|$)/
const directivePattern =
  /^showRepoLink[ \t]+(?:([^\s{}]+(?:[ \t]+[^\s{}]+)*)[ \t]+)?([A-Za-z0-9._/-]+)(?:[ \t]+(.*?))?[ \t]*$/
const positionPattern = /^\{pos:[ \t]*(up|inline)\}$/
const fenceStartPattern = /^(`{3,}|~{3,})/

function directiveError(
  state: { env: { realPath?: string; path?: string } },
  line: number,
  message: string
): Error {
  const pagePath = state.env.realPath ?? state.env.path ?? '<unknown page>'
  return new Error(`[showRepoLink] ${pagePath}:${line + 1}: ${message}`)
}

function parseDirective(
  line: string,
  state: { env: { realPath?: string; path?: string } },
  lineNumber: number
): ShowRepoLinkDirective | undefined {
  const indentation = line.match(/^[ \t]*/)?.[0] ?? ''
  const directive = line.slice(indentation.length)

  if (!directiveStartPattern.test(directive)) {
    return undefined
  }

  const match = directivePattern.exec(directive)
  if (!match) {
    throw directiveError(
      state,
      lineNumber,
      'expected showRepoLink PATH or showRepoLink DISPLAY_NAME PATH, optionally followed by {pos: up} or {pos: inline}'
    )
  }

  const displayName = match[1] ?? 'Repo folder'
  const repoPath = match[2]
  const option = match[3]?.trim() ?? ''
  if (option === '') {
    return { indentation, repoPath, displayName }
  }
  const positionMatch = positionPattern.exec(option)
  if (positionMatch) {
    return { indentation, repoPath, displayName, position: positionMatch[1] as RepoLinkPosition }
  }

  throw directiveError(
    state,
    lineNumber,
    `invalid option ${option}; expected {pos: up} or {pos: inline}`
  )
}

function repoLinkHtml(
  repoPath: string,
  displayName: string,
  element: 'div' | 'span',
  className = 'link-right'
): string {
  const url = githubRepoTreeUrl + repoPath.replace(/^\/+/, '')
  const classAttribute = className ? ` class="${className}"` : ''
  return `<${element}${classAttribute}><a href="${url}" target="_blank" rel="noreferrer"><IconGitHub/>${displayName}</a></${element}>`
}

export function showRepoLinkMarkdownPlugin(md: MarkdownRenderer): void {
  // Delimited inline links work in prose and table cells. Let Markdown handle
  // code spans, fences and escapes, and avoid creating links inside other links.
  md.inline.ruler.before('escape', 'show_repo_link_inline', (state, silent) => {
    if (state.linkLevel > 0 || !state.src.startsWith('{{showRepoLink ', state.pos)) {
      return false
    }
    const end = state.src.indexOf('}}', state.pos + 2)
    if (end < 0) return false
    const source = state.src.slice(state.pos + 2, end).trim()
    if (/[\r\n{}]/.test(source)) return false
    const directive = parseDirective(source, state, 0)
    if (!directive) return false
    if (!silent) {
      const token = state.push('html_inline', '', 0)
      token.content = repoLinkHtml(
        directive.repoPath,
        `<code>${md.utils.escapeHtml(directive.displayName)}</code>`,
        'span',
        'repo-link-inline'
      )
    }
    state.pos = end + 2
    return true
  })

  md.core.ruler.before('block', 'show_repo_link', (state) => {
    const lines = state.src.split('\n')
    let fence:
      | {
          marker: '`' | '~'
          length: number
        }
      | undefined

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber]
      const content = line.trimStart()
      const fenceMatch = fenceStartPattern.exec(content)

      if (fence) {
        if (
          fenceMatch &&
          fenceMatch[1][0] === fence.marker &&
          fenceMatch[1].length >= fence.length &&
          content.slice(fenceMatch[1].length).trim() === ''
        ) {
          fence = undefined
        }
        continue
      }

      if (fenceMatch) {
        fence = {
          marker: fenceMatch[1][0] as '`' | '~',
          length: fenceMatch[1].length
        }
        continue
      }

      const directive = parseDirective(line, state, lineNumber)
      if (!directive) {
        continue
      }

      const { indentation, repoPath, displayName, position } = directive
      const escapedDisplayName = md.utils.escapeHtml(displayName)
      if (position === 'inline') {
        lines[lineNumber] = `${indentation}${repoLinkHtml(repoPath, escapedDisplayName, 'span', 'repo-link-inline')}`
        continue
      }

      lines[lineNumber] = position === 'up'
        ? `${indentation}${repoLinkHtml(repoPath, escapedDisplayName, 'span', 'link-right link-right-up')}\n${indentation}`
        : `${indentation}${repoLinkHtml(repoPath, escapedDisplayName, 'div')}\n${indentation}`
    }

    state.src = lines.join('\n')
  })
}
