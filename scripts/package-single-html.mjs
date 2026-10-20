import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'

const rootDirectory = process.cwd()
const distDirectory = join(rootDirectory, 'dist')
const releaseDirectory = join(rootDirectory, 'release')
const packageData = JSON.parse(await readFile(join(rootDirectory, 'package.json'), 'utf8'))
const targetName = process.argv[2] ?? 'main'
const targets = {
  main: {
    entryName: 'index.html',
    outputName: `Von Zuckerhoff 宝石 ${packageData.version} 单文件网页版.html`,
  },
  sequel: {
    entryName: 'sequel.html',
    outputName: 'sequel.html',
  },
}
const target = targets[targetName]

if (!target) {
  throw new Error(`Unknown single-HTML target: ${targetName}`)
}

function resolveAsset(reference) {
  const cleanReference = reference.split(/[?#]/, 1)[0].replace(/^\.\//, '').replace(/^\//, '')
  const assetPath = resolve(distDirectory, cleanReference)
  const assetRelativePath = relative(distDirectory, assetPath)

  if (assetRelativePath.startsWith('..') || isAbsolute(assetRelativePath)) {
    throw new Error(`Refusing to inline an asset outside dist/: ${reference}`)
  }

  return assetPath
}

function escapeClosingTag(content, tagName) {
  return content.replace(new RegExp(`</${tagName}`, 'gi'), `<\\/${tagName}`)
}

const imageMimeTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

// public/ 里的远景图会被 Vite 原样复制到 dist 根目录，但单文件 HTML 在离线
// file:// 下拿不到旁边目录里的图片。这里把对 ./bg/*.png 的引用（样式表或脚本
// 里的字符串）统统换成 base64 data URI，保证单文件自带背景图。
const publicImageReferencePattern = /(?:\.\/|\/)(?:bg|portraits)\/[A-Za-z0-9._-]+\.(?:png|jpe?g|webp|gif)/gi
const inlinedImageCache = new Map()

async function inlinePublicImageReferences(text, sourceLabel) {
  const matches = [...text.matchAll(publicImageReferencePattern)]
  if (matches.length === 0) return text

  const parts = []
  let cursor = 0
  for (const match of matches) {
    const reference = match[0]
    let dataUri = inlinedImageCache.get(reference)
    if (!dataUri) {
      const assetPath = resolveAsset(reference)
      const mimeType = imageMimeTypes[extname(assetPath).toLowerCase()]
      if (!mimeType) {
        throw new Error(`Cannot inline ${reference} referenced by ${sourceLabel}: unsupported image type`)
      }
      const bytes = await readFile(assetPath).catch(() => {
        throw new Error(`Cannot inline ${reference} referenced by ${sourceLabel}: file missing from dist`)
      })
      dataUri = `data:${mimeType};base64,${bytes.toString('base64')}`
      inlinedImageCache.set(reference, dataUri)
    }
    parts.push(text.slice(cursor, match.index))
    parts.push(dataUri)
    cursor = match.index + reference.length
  }
  parts.push(text.slice(cursor))
  return parts.join('')
}

let html = await readFile(join(distDirectory, target.entryName), 'utf8')

const stylesheetPattern = /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/gi
const scriptPattern = /<script\b(?=[^>]*\bsrc=["']([^"']+)["'])[^>]*><\/script>/gi
const stylesheets = [...html.matchAll(stylesheetPattern)]
const scripts = [...html.matchAll(scriptPattern)]

if (stylesheets.length === 0 || scripts.length === 0) {
  throw new Error('Expected the Vite build to contain at least one stylesheet and one script')
}

for (const match of stylesheets) {
  const stylesheet = await readFile(resolveAsset(match[1]), 'utf8')
  const css = await inlinePublicImageReferences(stylesheet, 'stylesheet')
  const cssReferences = [...css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)].map(reference => reference[2])
  const externalCssReference = cssReferences.find(reference => !/^(?:data:|#)/i.test(reference))
  if (externalCssReference) {
    throw new Error(`The stylesheet still references an external asset: ${externalCssReference}`)
  }
  html = html.replace(match[0], () => `<style>\n${escapeClosingTag(css, 'style')}\n</style>`)
}

for (const match of scripts) {
  const script = await readFile(resolveAsset(match[1]), 'utf8')
  const javascript = await inlinePublicImageReferences(script, 'script')
  html = html.replace(match[0], () => `<script type="module">\n${escapeClosingTag(javascript, 'script')}\n</script>`)
}

const htmlShell = html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
const remainingExternalAsset = /<(?:script|img|audio|video|source)\b[^>]*\bsrc=["'][^"']+["']|<link\b[^>]*\bhref=["'][^"']+["']/i
if (remainingExternalAsset.test(htmlShell)) {
  throw new Error('The generated HTML still contains an external asset reference')
}

await mkdir(releaseDirectory, { recursive: true })
const outputPath = join(releaseDirectory, target.outputName)
await writeFile(outputPath, html, 'utf8')

const sizeInKiB = Math.ceil(Buffer.byteLength(html, 'utf8') / 1024)
console.log(`Standalone HTML: ${outputPath} (${sizeInKiB} KiB)`)
