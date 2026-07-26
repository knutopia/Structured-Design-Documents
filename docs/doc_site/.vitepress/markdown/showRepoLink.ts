import type { MarkdownRenderer } from 'vitepress'

type RepoLinkPosition = 'up'

interface ShowRepoLinkDirective {
  indentation: string
  repoPath: string
  position?: RepoLinkPosition
}

const githubRepoTreeUrl =
  'https://github.com/knutopia/Structured-Design-Documents/tree/main/'
const directiveStartPattern = /^showRepoLink(?:[ \t]|$)/
const directivePattern =
  /^showRepoLink[ \t]+([A-Za-z0-9._/-]+)(?:[ \t]+(.*?))?[ \t]*$/
const positionUpPattern = /^\{pos:[ \t]*up\}$/
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
      'expected showRepoLink PATH or showRepoLink PATH {pos: up}'
    )
  }

  const repoPath = match[1]
  const option = match[2]?.trim() ?? ''
  if (option === '') {
    return { indentation, repoPath }
  }
  if (positionUpPattern.test(option)) {
    return { indentation, repoPath, position: 'up' }
  }

  throw directiveError(
    state,
    lineNumber,
    `invalid option ${option}; expected {pos: up}`
  )
}

function repoLinkHtml(
  repoPath: string,
  element: 'div' | 'span',
  extraClass = ''
): string {
  const url = githubRepoTreeUrl + repoPath.replace(/^\/+/, '')
  const className = `link-right${extraClass}`
  return `<${element} class="${className}"><a href="${url}" target="_blank" rel="noreferrer"><IconGitHub/>Repo folder</a></${element}>`
}

export function showRepoLinkMarkdownPlugin(md: MarkdownRenderer): void {
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

      const { indentation, repoPath, position } = directive
      lines[lineNumber] = position === 'up'
        ? `${indentation}${repoLinkHtml(repoPath, 'span', ' link-right-up')}\n${indentation}`
        : `${indentation}${repoLinkHtml(repoPath, 'div')}\n${indentation}`
    }

    state.src = lines.join('\n')
  })
}
