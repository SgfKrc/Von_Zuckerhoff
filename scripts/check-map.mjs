// 校验 maps.ts 的网格与传送门：
// 1) 每张图 tiles 每行等宽  2) struct 与 tiles 尺寸一致
// 3) tiles 用到的字符都在瓦片注册表里
// 4) 传送门自身所在格必须可走（否则永远触发不了）
// 5) 传送落点必须在地图内且可走（否则玩家会卡进墙里）
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const mapFile = path.join(root, 'src/game/world/maps.ts')
const tileFile = path.join(root, 'src/game/art/tiles.ts')

const src = fs.readFileSync(mapFile, 'utf8')
const lines = src.split('\n')

// ---- 按 const X: GameMap = { 的位置切分，用于认定每个传送门属于哪张图 ----
const bounds = []
for (const m of src.matchAll(/^const (\w+): GameMap = \{/gm)) {
  bounds.push({ name: m[1], start: m.index })
}
for (let i = 0; i < bounds.length; i++) {
  bounds[i].end = i + 1 < bounds.length ? bounds[i + 1].start : src.length
}

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
    else if (/^\s*'/.test(line) || line.includes('.slice(')) {
      console.log(`[WARN] ${curMap} ${mode} 第 ${i + 1} 行不是纯字符串字面量`)
    }
  }
}

const tileSrc = fs.readFileSync(tileFile, 'utf8')
const solidMatch = tileSrc.match(/SOLID_TILES\s*=\s*new Set\(\[([^\]]+)\]\)/)
const SOLID = new Set()
for (const m of (solidMatch?.[1] ?? '').matchAll(/'([^']+)'/g)) SOLID.add(m[1])

const tileKeys = new Set()
for (const m of tileSrc.matchAll(/^\s*'([^']{1,2})':\s*make\(/gm)) tileKeys.add(m[1])
tileKeys.add(' ')

let errors = 0
const byMap = {}
for (const g of maps) {
  byMap[g.map] ??= {}
  byMap[g.map][g.mode] = g.group
}

function tileAt(mapName, x, y) {
  const g = byMap[mapName]
  if (!g?.tiles) return undefined
  const row = g.tiles[y]
  if (!row) return undefined
  return row[x]
}

function walkable(mapName, x, y) {
  const ch = tileAt(mapName, x, y)
  if (ch === undefined) return { ok: false, why: '越界' }
  if (SOLID.has(ch)) return { ok: false, why: `瓦片 '${ch}' 是阻挡` }
  return { ok: true }
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
  const bad = new Set()
  for (const row of t) for (const ch of row) if (!tileKeys.has(ch)) bad.add(ch)
  if (bad.size) { console.log(`[ERR] ${map}: 未知瓦片字符 ${[...bad].join(' ')}`); errors++ }
}

// ---- 传送门：自身位置 + 落点，都必须可走 ----
const portalRe = /\{\s*x:\s*(\d+),\s*y:\s*(\d+),\s*to:\s*'([^']+)',\s*tx:\s*(\d+),\s*ty:\s*(\d+)/g
for (const b of bounds) {
  const seg = src.slice(b.start, b.end)
  for (const m of seg.matchAll(portalRe)) {
    const [, x, y, to, tx, ty] = m
    const from = b.name
    const selfCh = tileAt(from, +x, +y)
    if (selfCh === undefined) {
      console.log(`[ERR] ${from}: 传送门 (${x},${y}) 超出地图`)
      errors++
    } else if (SOLID.has(selfCh)) {
      console.log(`[ERR] ${from}: 传送门 (${x},${y}) 落在阻挡瓦片 '${selfCh}' 上 → 永远触发不了`)
      errors++
    }
    const target = byMap[to]
    if (!target?.tiles) { console.log(`[ERR] 传送门目标地图不存在: ${to}`); errors++; continue }
    const tw = target.tiles[0].length
    const th = target.tiles.length
    if (+tx < 0 || +tx >= tw || +ty < 0 || +ty >= th) {
      console.log(`[ERR] ${from}→${to}: 落点 (${tx},${ty}) 越界，目标地图 ${tw}x${th}`)
      errors++
      continue
    }
        // 落点不能正好压在目标地图的**任何**传送门上 —— 否则站住不动就被弹回去。
    // 注意：不能用 q.to !== from 排除「回程门」，那正是最容易来回弹的情况
    // （A→B 的落点正好是 B→A 的门）。之前就是这么漏掉的，5 处一起错了。
    const targetPortals = target.portals ?? []
    const clash = targetPortals.find(q => q.x === +tx && q.y === +ty)
    if (clash) {
      console.log(`[ERR] ${from}→${to}: 落点 (${tx},${ty}) 压在 ${to}→${clash.to} 的传送门上 → 站住不动会被弹回`)
      errors++
    }
const land = walkable(to, +tx, +ty)
    if (!land.ok) {
      console.log(`[ERR] ${from}→${to}: 落点 (${tx},${ty}) ${land.why} → 玩家会卡进墙里`)
      errors++
    }
  }
}

console.log('')
if (errors === 0) console.log('OK：所有地图网格与传送门合法')
else console.log(`共 ${errors} 个问题`)
process.exit(errors === 0 ? 0 : 1)
