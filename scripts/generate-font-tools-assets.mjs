import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..')
const fontDirectory = path.join(repoRoot, 'docs/doc_site/public/font_tools/fonts')
const outputDirectory = path.join(repoRoot, 'docs/doc_site/public/font_tools')
const sourceFile = path.join(outputDirectory, 'font-sources.txt')
const supportedFormats = new Set(['woff2', 'woff', 'opentype', 'truetype', 'css'])
const supportedKinds = new Set(['local', 'font', 'css'])

function cssString(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function cssUrl(value) {
  return String(value).replaceAll('\\', '/').replaceAll(' ', '%20').replaceAll('"', '%22')
}

function formatFromFile(file) {
  const extension = path.extname(file).toLowerCase()
  if (extension === '.woff2') return 'woff2'
  if (extension === '.woff') return 'woff'
  if (extension === '.ttf') return 'truetype'
  if (extension === '.otf') return 'opentype'
  return null
}

function cssFormat(format) {
  return format === 'truetype' ? 'truetype' : format
}

function parseSources() {
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Font source file does not exist: ${sourceFile}`)
  }

  const records = []
  let current = null
  const lines = fs.readFileSync(sourceFile, 'utf8').split(/\r?\n/)

  function finishRecord() {
    if (!current) return
    if (!current.name) throw new Error('Each [font] block needs a name.')
    if (!current.kind) throw new Error(`Font ${current.name} needs a kind.`)
    if (!supportedKinds.has(current.kind)) {
      throw new Error(`Font ${current.name} has unsupported kind: ${current.kind}`)
    }
    if (!current.faces?.length) throw new Error(`Font ${current.name} needs at least one face.`)
    records.push(current)
    current = null
  }

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) return
    if (line === '[font]') {
      finishRecord()
      current = { fallback: 'sans-serif', faces: [] }
      return
    }
    if (!current) throw new Error(`Line ${lineNumber} is outside a [font] block.`)

    const separator = line.indexOf('=')
    if (separator < 0) throw new Error(`Line ${lineNumber} must use key = value syntax.`)
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (key === 'face') {
      const match = value.match(/^(100|200|250|300|400|500|600|700|800|900)\s+(normal|italic)(?:\s+(.+))?$/)
      if (!match) throw new Error(`Line ${lineNumber} has an invalid face: ${value}`)
      current.faces.push({
        weight: Number(match[1]),
        style: match[2],
        asset: match[3] || null,
        lineNumber
      })
      return
    }
    if (!['name', 'fallback', 'kind', 'format', 'url'].includes(key)) {
      throw new Error(`Line ${lineNumber} has an unknown key: ${key}`)
    }
    current[key] = value
  })

  finishRecord()

  const seenNames = new Set()
  const faces = []
  records.forEach(record => {
    if (seenNames.has(record.name)) throw new Error(`Duplicate font family: ${record.name}`)
    seenNames.add(record.name)
    if (!record.format || !supportedFormats.has(record.format)) {
      throw new Error(`Font ${record.name} needs a supported format.`)
    }
    const seenFaces = new Set()
    record.faces.forEach(face => {
      const faceKey = `${face.weight}:${face.style}`
      if (seenFaces.has(faceKey)) throw new Error(`Duplicate face ${faceKey} in ${record.name}`)
      seenFaces.add(faceKey)

      const asset = face.asset || record.url
      if (!asset) throw new Error(`Face ${faceKey} in ${record.name} needs a URL or local file.`)
      if (record.kind === 'local') {
        if (!asset.startsWith('fonts/')) {
          throw new Error(`Local face ${faceKey} in ${record.name} must be under fonts/.`)
        }
        const localPath = path.join(outputDirectory, asset)
        if (!fs.existsSync(localPath)) throw new Error(`Missing local font file: ${asset}`)
        const detectedFormat = formatFromFile(localPath)
        if (!detectedFormat) throw new Error(`Unsupported local font file: ${asset}`)
        if (record.format !== 'css' && record.format !== detectedFormat) {
          throw new Error(`Format mismatch for ${asset}: expected ${record.format}, found ${detectedFormat}`)
        }
      } else if (!/^https:\/\//i.test(asset)) {
        throw new Error(`Remote face ${faceKey} in ${record.name} must use HTTPS.`)
      }
      faces.push({ ...face, asset, family: record.name, fallback: record.fallback, kind: record.kind, format: record.format })
    })
  })

  return { records, faces }
}

const { records, faces } = parseSources()
const manifest = records
  .sort((left, right) => left.name.localeCompare(right.name, 'en', { sensitivity: 'base' }))
  .map(record => {
    const familyFaces = faces.filter(face => face.family === record.name)
    return {
      name: record.name,
      family: record.name,
      fallback: record.fallback,
      styles: [...new Set(familyFaces.map(face => face.style))],
      weights: [...new Set(familyFaces.map(face => face.weight))].sort((left, right) => left - right),
      faces: familyFaces.map(face => ({
        style: face.style,
        weight: face.weight,
        kind: face.kind,
        format: face.format,
        url: face.asset
      })),
      files: familyFaces
        .filter(face => face.kind === 'local')
        .map(face => ({ file: face.asset.slice('fonts/'.length), style: face.style, weight: face.weight }))
    }
  })

const imports = [...new Set(faces
  .filter(face => face.kind === 'css')
  .map(face => face.asset))]
  .sort((left, right) => left.localeCompare(right))
  .map(url => `@import url("${cssUrl(url)}");`)

const fontFaceRules = faces
  .filter(face => face.kind !== 'css')
  .map(face => [
    '@font-face {',
    `  font-family: "${cssString(face.family)}";`,
    `  font-style: ${face.style};`,
    `  font-weight: ${face.weight};`,
    '  font-display: swap;',
    `  src: url("${cssUrl(face.asset)}") format("${cssFormat(face.format)}");`,
    '}',
    ''
  ].join('\n'))

const manifestSource = `window.SDD_FONT_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`
const css = [
  '/* Generated by scripts/generate-font-tools-assets.mjs from font-sources.txt. */',
  ...imports,
  imports.length ? '' : null,
  ...fontFaceRules
].filter(line => line !== null).join('\n')

fs.writeFileSync(path.join(outputDirectory, 'font-manifest.js'), manifestSource)
fs.writeFileSync(path.join(outputDirectory, 'fonts.css'), `${css}\n`)
console.log(`Generated ${manifest.length} families and ${faces.length} faces from font-sources.txt.`)
