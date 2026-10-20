// 校验 maps.ts 的 tiles/struct 网格：
// 1) 每张图 tiles 每行等宽  2) struct 与 tiles 尺寸一致
// 3) 传送门坐标在地图内  4) tiles 用到的字符都在瓦片注册表里
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const mapFile = path.join(root, 'src/game/world/maps.ts')
const tileFile = path.join(root, 'src/game/art/tiles.ts')

const src = fs.readFileSync(mapFile, 'utf8')
const lines = src.split('\n')

let curMap = '(unknown)'
let mode = null
let group = []
const maps = []

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  const idm = line.match(/^\s*id:\s*'([^']+)'/)
  if (idm) { curMap = idm[1] }
  if (/^\s*tiles:\s*\[/.test(line)) { mode = 'tiles'; group = []; continue }
  if (/^\s*struct:\s*\[/.test(line)) { mode = 'struct'; group = []; continue }
  if (mode && /^\s*\],?\s*$/.test(line)) {
    maps.push({ map: curMap, mode, group: [...group] })
    mode = null
    group = []
    continue
  }
  if (mode) {
    const m = line.match(/'([^']*)'/)
    if (m) group.push(m[1])
    else if (/^\s*'/.test(line) || line.includes(".slice(")) {
      // 用了 .slice() 等表达式，报告出来人工处理
      console.log(`[WARN] ${curMap} ${mode} 第 ${i + 1} 行不是纯字符串字面量`)
    }
  }
}

// 瓦片注册表
const tileSrc = fs.readFileSync(tileFile, 'utf8')
const solidMatch = tileSrc.match(/SOLID_TILES\s*=\s*new Set\(\[([^\]]+)\]\)/)
const tileKeys = new Set()
for (const m of tileSrc.matchAll(/^\s*'([^']{1,2})':\s*make\(/gm)) tileKeys.add(m[1])
tileKeys.add(' ')
console.log('瓦片注册表:', [...tileKeys].join(' '))

let errors = 0
const byMap = {}
for (const g of maps) {
  byMap[g.map] ??= {}
  byMap[g.map][g.mode] = g.group
}

for (const [map, g] of Object.entries(byMap)) {
  const t = g.tiles || []
  const s = g.struct || []
  if (t.length === 0 || s.length === 0) {
    console.log(`[ERR] ${map}: 缺 tiles 或 struct`)
    errors++
    continue
  }
  const w = new Set(t.map(r => r.length))
  if (w.size > 1) {
    console.log(`[ERR] ${map}: tiles 行宽不一致 ${[...w].join(',')}`)
    t.forEach((r, i) => { if (r.length !== t[0].length) console.log(`       tiles[${i}] = ${r.length} 字符`) })
    errors++
  }
  if (t.length !== s.length) {
    console.log(`[ERR] ${map}: tiles ${t.length} 行 vs struct ${s.length} 行`)
    errors++
  }
  const wh = new Set(s.map(r => r.length))
  if (wh.size > 1) {
    console.log(`[ERR] ${map}: struct 行宽不一致 ${[...wh].join(',')}`)
    s.forEach((r, i) => { if (r.length !== s[0].length) console.log(`       struct[${i}] = ${r.length} 字符`) })
    errors++
  }
  if (t[0] && s[0] && t[0].length !== s[0].length) {
    console.log(`[ERR] ${map}: tiles 宽 ${t[0].length} != struct 宽 ${s[0].length}`)
    errors++
  }
  // 瓦片字符
  const bad = new Set()
  for (const row of t) for (const ch of row) if (!tileKeys.has(ch)) bad.add(ch)
  if (bad.size) { console.log(`[ERR] ${map}: 未知瓦片字符 ${[...bad].join(' ')}`); errors++ }
}

// 传送门坐标范围
const portalRe = /\{\s*x:\s*(\d+),\s*y:\s*(\d+),\s*to:\s*'([^']+)',\s*tx:\s*(\d+),\s*ty:\s*(\d+)/g
for (const m of src.matchAll(portalRe)) {
  const [, x, y, to, tx, ty] = m
  const target = byMap[to]
  if (!target) { console.log(`[ERR] 传送门目标地图不存在: ${to}`); errors++; continue }
  const tw = target.tiles[0].length
  const th = target.tiles.length
  if (+tx < 0 || +tx >= tw || +ty < 0 || +ty >= th) {
    console.log(`[ERR] 传送门 ${to} 目标坐标 (${tx},${ty}) 越界，地图 ${tw}x${th}`)
    errors++
  }
}

console.log('')
if (errors === 0) console.log('OK：所有地图网格合法')
else console.log(`共 ${errors} 个问题`)
process.exit(errors === 0 ? 0 : 1)
