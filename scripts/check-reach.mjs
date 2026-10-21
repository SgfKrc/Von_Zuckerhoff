// 可达性校验：从每个入口出发做 BFS，检查
//   1) 每个传送门本身是否走得到（走不到 = 那个出口形同虚设）
//   2) 每个带 interact 的实体旁边是否有可达格（走不到 = 永远按不到 E）
//   3) 每个传送落点是否可达（落进去就困住 = 软锁）
// 这一步能抓住「实体把通道堵死」「传送门在死角」这类截图看不出来的问题。
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const src = fs.readFileSync(path.join(root, 'src/game/world/maps.ts'), 'utf8')
const tileSrc = fs.readFileSync(path.join(root, 'src/game/art/tiles.ts'), 'utf8')

const SOLID = new Set()
for (const m of (tileSrc.match(/SOLID_TILES\s*=\s*new Set\(\[([^\]]+)\]\)/)?.[1] ?? '').matchAll(/'([^']+)'/g)) SOLID.add(m[1])

// 宽实体：与 engine 的 entTileW 保持一致
const WIDE = { portrait: 2, bigPainting: 2, bed: 2, fireplace: 2, table: 2, piano: 2, bookshelfWall: 2, graveRow: 2, gearBig: 2 }

const blocks = [...src.matchAll(/const (\w+): GameMap = \{([\s\S]*?)\n\}\n/g)].map(m => ({ name: m[1], body: m[2] }))

const maps = {}
for (const b of blocks) {
  const tm = b.body.match(/tiles:\s*\[([\s\S]*?)\n  \],/)
  if (!tm) continue
  const tiles = [...tm[1].matchAll(/'([^']*)'/g)].map(m => m[1])
  if (!tiles.length) continue
  const ents = [...b.body.matchAll(/\{ id: '([^']+)', x: (\d+), y: (\d+)([^}]*)\}/g)].map(m => ({
    id: m[1], x: +m[2], y: +m[3], rest: m[4],
    solid: /solid:\s*true/.test(m[4]),
    interact: /interact:/.test(m[4]),
    sprite: (m[4].match(/sprite:\s*'([^']+)'/) ?? [])[1] ?? '',
  }))
  const portals = [...b.body.matchAll(/\{ x: (\d+), y: (\d+), to: '([^']+)', tx: (\d+), ty: (\d+)/g)].map(m => ({
    x: +m[1], y: +m[2], to: m[3], tx: +m[4], ty: +m[5],
  }))
  maps[b.name] = { tiles, ents, portals }
}

// const 名与 id 可能不同：用 body 里的 id 兜一层，并把旧 key 删掉免得重复分析
for (const b of blocks) {
  const idm = b.body.match(/^\s*id:\s*'([^']+)'/m)
  if (!idm || !maps[b.name]) continue
  if (idm[1] !== b.name) {
    maps[idm[1]] = maps[b.name]
    delete maps[b.name]
  }
}

let errors = 0

function analyze(name, m) {
  const H = m.tiles.length
  const W = m.tiles[0].length
  // 1) 静态阻挡：瓦片 + solid 实体
  const blocked = Array.from({ length: H }, () => new Array(W).fill(false))
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (SOLID.has(m.tiles[y][x])) blocked[y][x] = true
    }
  }
  for (const e of m.ents) {
    if (!e.solid) continue
    const w = WIDE[e.sprite] ?? 1
    for (let i = 0; i < w; i++) {
      const x = e.x + i, y = e.y
      if (y >= 0 && y < H && x >= 0 && x < W) blocked[y][x] = true
    }
  }
  // 2) 入口集合：所有 portal 的落点（来自其它地图）
  const entries = []
  for (const [from, fm] of Object.entries(maps)) {
    for (const p of fm.portals) {
      if (p.to === name) entries.push([p.tx, p.ty, `从 ${from}`])
    }
  }
  entries.push([Math.floor(W / 2), Math.floor(H / 2), '地图中心兜底'])
  // 3) 从所有可达入口 BFS（多源，取并集 —— 只要能从任一入口走到就算通）
  const seen = Array.from({ length: H }, () => new Array(W).fill(false))
  const q = []
  for (const [x, y, label] of entries) {
    if (x < 0 || y < 0 || x >= W || y >= H) { continue }
    if (blocked[y][x]) { console.log(`[ERR] ${name}: 入口 (${x},${y}) [${label}] 落在阻挡格上 → 进来就卡住`); errors++; continue }
    if (!seen[y][x]) { seen[y][x] = true; q.push([x, y]) }
  }
  for (let head = 0; head < q.length; head++) {
    const [x, y] = q[head]
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      if (seen[ny][nx] || blocked[ny][nx]) continue
      seen[ny][nx] = true
      q.push([nx, ny])
    }
  }
  // 4) 传送门可达
  for (const p of m.portals) {
    if (!seen[p.y]?.[p.x]) {
      console.log(`[ERR] ${name}: 传送门 (${p.x},${p.y})→${p.to} 走不到（被实体或墙堵死）`)
      errors++
    }
  }
  // 5) 可交互实体旁边是否有可达格
  for (const e of m.ents) {
    if (!e.interact) continue
    const w = WIDE[e.sprite] ?? 1
    let ok = false
    for (let i = 0; i < w && !ok; i++) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = e.x + i + dx, ny = e.y + dy
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && seen[ny][nx]) { ok = true; break }
      }
    }
    if (!ok) { console.log(`[ERR] ${name}: 交互点 ${e.id} (${e.x},${e.y}) 四周没有可达格 → 永远按不到 E`); errors++ }
  }
}

for (const [name, m] of Object.entries(maps)) {
  if (!m.portals.length) continue
  analyze(name, m)
}

console.log('')
if (errors === 0) console.log('OK：所有传送门与交互点都走得到')
else console.log(`共 ${errors} 个可达性问题`)
process.exit(errors === 0 ? 0 : 1)
