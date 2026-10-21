// 校验内容引用：精灵 / 交互 / 脚本跳转 / 入场脚本
import fs from 'node:fs'

const read = p => fs.readFileSync(p, 'utf8')
const maps = read('src/game/world/maps.ts')
const sprites = read('src/game/art/sprites.ts')
const tiles = read('src/game/art/tiles.ts')
const script = read('src/game/data/script.ts')
const events = read('src/game/world/events.ts')

/**
 * 取一个对象字面量的内容：从 header 之后的第一个 '{' 起，数到配对的 '}'。
 * 注册表里只有函数调用与 `key: value`，没有别的花括号，按字符计括号层数足够。
 */
function objectBlock(src, header) {
  const i = src.indexOf(header)
  if (i < 0) return ''
  const start = src.indexOf('{', i)
  if (start < 0) return ''
  let depth = 0
  for (let j = start; j < src.length; j++) {
    const ch = src[j]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return src.slice(start + 1, j)
    }
  }
  return ''
}

// 精灵注册表：只认 sprites.ts 的 SPRITES 这一张表。
// 装饰精灵也在表里（用真实名字注册），所以这里数出来的就是全部精灵。
// 每个键都单列一行、行首两格缩进 —— 正则按这个格式收。
const spriteKeys = new Set()
for (const m of objectBlock(sprites, 'export const SPRITES').matchAll(/^\s{2}([A-Za-z0-9_]+):\s/gm)) {
  spriteKeys.add(m[1])
}
// 角色自动生成的前缀（buildCharSet：四方向 × 三帧，不是逐行写的）
const charPrefixes = ['hero', 'emma', 'hermann', 'marta']
for (const p of charPrefixes) for (const d of ['down', 'up', 'left', 'right']) spriteKeys.add(p + '_' + d)
// 彩蛋角色的行走图：loadCameoWalk() 异步写入，键名写在 CAMEO_WALK_ROW 里
for (const m of objectBlock(sprites, 'const CAMEO_WALK_ROW').matchAll(/^\s{2}([A-Za-z0-9_]+):\s/gm)) {
  spriteKeys.add(m[1])
}

// 技术债守卫：装饰精灵必须注册在 sprites.ts，tiles.ts 里不能又长出
// 第二张「按实体 id 取画」的装饰表（旧表名由两段拼出来，源码里不再出现那个标识符）。
const decorTableName = ['DECOR', 'SPRITES'].join('_')
let errors = 0
if (tiles.includes(decorTableName)) {
  console.log(`[ERR] tiles.ts 里还有 ${decorTableName}：装饰精灵应该注册在 sprites.ts 的 SPRITES 里`)
  errors++
}

// 脚本 id
const scriptIds = new Set()
for (const m of script.matchAll(/^\s{2}([A-Za-z0-9_]+):\s\[/gm)) scriptIds.add(m[1])
// next 目标
const nextTargets = new Set()
for (const m of script.matchAll(/next:\s*'([^']+)'/g)) nextTargets.add(m[1])

// 实体
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
