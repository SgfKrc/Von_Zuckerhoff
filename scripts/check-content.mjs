// 校验内容引用：精灵 / 交互 / 脚本跳转 / 入场脚本
import fs from 'node:fs'

const read = p => fs.readFileSync(p, 'utf8')
const maps = read('src/game/world/maps.ts')
const sprites = read('src/game/art/sprites.ts')
const script = read('src/game/data/script.ts')
const events = read('src/game/world/events.ts')

// 精灵注册表
const spriteKeys = new Set()
for (const m of sprites.matchAll(/^\s{2}([A-Za-z0-9_]+):\s/gm)) spriteKeys.add(m[1])
// 角色自动生成的前缀
const charPrefixes = ['hero', 'emma', 'hermann', 'marta']
for (const p of charPrefixes) for (const d of ['down', 'up', 'left', 'right']) spriteKeys.add(p + '_' + d)

// 脚本 id
const scriptIds = new Set()
for (const m of script.matchAll(/^\s{2}([A-Za-z0-9_]+):\s\[/gm)) scriptIds.add(m[1])
// next 目标
const nextTargets = new Set()
for (const m of script.matchAll(/next:\s*'([^']+)'/g)) nextTargets.add(m[1])

// 实体
let errors = 0
for (const m of maps.matchAll(/sprite:\s*'([^']+)'/g)) {
  if (!spriteKeys.has(m[1])) { console.log(`[ERR] 未注册的精灵: ${m[1]}`); errors++ }
}

// 交互
const specials = new Set()
for (const m of events.matchAll(/^\s{2}([A-Za-z0-9_]+):\s\(\)\s*=>/gm)) specials.add(m[1])
for (const m of maps.matchAll(/interact:\s*'([^']+)'/g)) {
  const id = m[1]
  if (!scriptIds.has(id) && !specials.has(id)) { console.log(`[ERR] 交互没有处理器/脚本: ${id}`); errors++ }
}

// next 目标
for (const t of nextTargets) {
  if (!scriptIds.has(t)) { console.log(`[ERR] next 目标不存在: ${t}`); errors++ }
}

// 入场脚本
for (const m of events.matchAll(/'([A-Za-z0-9_]+)',?\s*$/gm)) {
  // 粗略跳过
}
const enterBlock = events.match(/const ENTER[\s\S]*?\n\}/)
if (enterBlock) {
  for (const m of enterBlock[0].matchAll(/:\s*'([^']+)'/g)) {
    if (!scriptIds.has(m[1])) { console.log(`[ERR] 入场脚本不存在: ${m[1]}`); errors++ }
  }
}

console.log('')
console.log('精灵数:', spriteKeys.size, '脚本数:', scriptIds.size)
console.log(errors === 0 ? 'OK：内容引用完整' : `共 ${errors} 个问题`)
process.exit(errors === 0 ? 0 : 1)
