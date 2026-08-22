import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..')
const fontDirectory = path.join(repoRoot, 'docs/doc_site/public/font_tools/fonts')
const sourceFile = path.join(repoRoot, 'docs/doc_site/public/font_tools/font-sources.txt')
const supportedExtensions = new Set(['.otf', '.ttf', '.woff', '.woff2'])

const sourceText = fs.readFileSync(sourceFile, 'utf8')
const referenced = new Set(
  [...sourceText.matchAll(/^face\s*=\s*\S+\s+\S+\s+(fonts\/\S+)\s*$/gm)]
    .map(match => match[1])
)

const unused = fs.readdirSync(fontDirectory)
  .filter(file => supportedExtensions.has(path.extname(file).toLowerCase()))
  .filter(file => !referenced.has(`fonts/${file}`))
  .sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }))

unused.forEach(file => fs.unlinkSync(path.join(fontDirectory, file)))
console.log(`Removed ${unused.length} unreferenced local font files.`)
