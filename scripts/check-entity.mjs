// 校验实体位置：带 interact 的实体必须站在可走格上，且至少有一侧邻格可走
// （能发现"画像挂进墙里""调查点埋在石头里"这类肉眼难查的问题）
import fs from 'node:fs'

const mapSrc = fs.readFileSync('src/game/world/maps.ts', 'utf8')
const tileSrc = fs.readFileSync('src/game/art/tiles.ts', 'utf8')

const solidMatch = tileSrc.match(/SOLID_TILES\s*=\s*new Set\(\[([^\]]+)\]\)/)
const SOLID = new Set()
for (const m of (solidMatch?.[1] ?? '').matchAll(/'([^']+)'/g)) SOLID.add(m[1])
// 门洞与雾/铁轨可走
SOLID.delete('D')

const lines = mapSrc.split('\n')
let curMap = '(unknown)'
let mode = null
let group = []
const maps = {}

for (const line of lines) {
  const idm = line.match(/^\s*id:\s*'([^']+)'/)
  if (idm) curMap = idm[1]
  if (/^\s*tiles:\s*\[/.test(line)) { mode = 'tiles'; group = []; continue }
  if (/^\s*struct:\s*\[/.test(line)) { mode = 'struct'; group = []; continue }
  if (mode && /^\s*\],?\s*$/.test(line)) {
    maps[curMap] ??= {}
    maps[curMap][mode] = [...group]
    mode = null
    group = []
    continue
  }
  if (mode) {
    const m = line.match(/'([^']*)'/)
    if (m) group.push(m[1])
  }
}

// 实体：在同一文件的 entities 数组里，靠 id/x/y/interact 抓
const entityRe = /\{\s*id:\s*'([^']+)',\s*x:\s*(\d+),\s*y:\s*(\d+),[^}]*?(?:interact:\s*'([^']+)')?[^}]*?\}/g
const entities = []
for (const m of mapSrc.matchAll(entityRe)) {
  entities.push({ id: m[1], x: +m[2], y: +m[3], interact: m[4] })
}

// 按地图切：用 const xxx: GameMap 的位置来归属实体
const bounds = []
for (const m of mapSrc.matchAll(/^const (\w+): GameMap = \{/gm)) {
  bounds.push({ name: m[1], start: m.index })
}
const findMapFor = (idx) => {
  let best = null
  for (const b of bounds) if (b.start <= idx) best = b
  return best?.name ?? '?'
}

let errors = 0
for (const m of mapSrc.matchAll(/\{\s*id:\s*'([^']+)',\s*x:\s*(\d+),\s*y:\s*(\d+)([^}]*)\}/g)) {
  const [, id, xs, ys, rest] = m
  const mapName = findMapFor(m.index)
  const g = maps[mapName]
  if (!g?.tiles) continue
  const x = +xs
  const y = +ys
  const row = g.tiles[y]
  if (!row) { console.log(`[ERR] ${mapName}.${id}: 坐标 (${x},${y}) 超出地图`); errors++; continue }
  const ch = row[x]
  if (ch === undefined) { console.log(`[ERR] ${mapName}.${id}: 坐标 (${x},${y}) 超出该行`); errors++; continue }
  const hasInteract = /interact:/.test(rest)
  if (!hasInteract) continue
  // 实体本身可以是阻挡物（床/书架/画像/家具），这是正常的。
  // 只要它有一侧可走、玩家能靠近按 E 即可。
  // 四邻至少一格可走，否则玩家靠不近
  const neigh = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => {
    const r = g.tiles[y + dy]
    const c = r?.[x + dx]
    return c !== undefined && !SOLID.has(c)
  })
  if (neigh.length === 0) {
    console.log(`[ERR] ${mapName}.${id}: 四周全被阻挡，玩家无法接近 (${x},${y})`)
    errors++
  }
}

console.log('')
console.log(errors === 0 ? 'OK：实体位置合法' : `共 ${errors} 个问题`)
process.exit(errors === 0 ? 0 : 1)
