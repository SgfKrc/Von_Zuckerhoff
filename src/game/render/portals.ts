// ============================================================
// 传送点（出口）标注
// ------------------------------------------------------------
// portals 在 world/maps.ts 里一直是纯数据（{ x, y, to, tx, ty, dir, lockFlag? }），
// 渲染层原先完全不知道它们存在 —— 这一层补上"知道"。
//
// 画什么：
//   常驻   格子中心偏下的 5×5 细线向下箭头（V 头 + 短竖干，1px 线，不是实心三角）。
//          呼吸 0.6–0.8Hz，alpha 0.30 ↔ 0.55 —— 只让人觉得"这里的空气在动"，
//          不亮到被误认为可拾取物。
//   锁定   neverOpen 或 lockFlag 未立：同一支箭头换成 C.bloodDark，
//          外圈压一层 1px 近黑暗边（暗红落在暗红地毯上只剩明度差可读），
//          透明度固定 0.7、不呼吸（静止 = 过不去）。
//   靠近   2 格内：格内朝 dir 那一侧多一支更小的 chevron，指向走过去之后的朝向；
//          dir === 'down' 时与主标记同向，不再叠第二支；标记下方 10px
//          一行 9px 宋体目标地图名，深色描边 + 逐字排版（3.33 倍非整数缩放不糊），
//          随距离 0.2 → 0.8 渐显。
//          锁着时改显示 lockMsg 的短句（取到第一个句号为止，最多 8 个字）。
//
// 画在哪：由 renderer 的 drawScene 在瓦片与实体之后、玩家之前调用 ——
// 因此早于光照 / 雾 / 暗角，标记不会被压暗到看不见。
// 图纸模式整层跳过：图纸有自己的结构符号，再叠一层出口会读乱。
// ============================================================
import { world } from '../engine/engine'
import { useGame } from '../store'
import { MAPS } from '../world/maps'
import { TILE } from '../art/build'
import { C } from '../art/tiles'
import { VIEW_W, VIEW_H } from '../constants'
import type { Dir, Portal } from '../types'

/**
 * 画布上的中文字体：与 renderer.ts 的 SERIF_FONT 是同一条衬线栈。
 * 这里另写一份而不是从 renderer 导入 —— renderer 又要 import 本模块，
 * 让两个模块在顶层互相 import 同一个常量没有好处，字体串抄一份最省事。
 */
const SERIF_FONT = '"Songti SC", "SimSun", "Noto Serif SC", serif'

/** 呼吸频率（Hz）：0.7 落在 0.6–0.8 的中段，比心跳慢、比烛火稳 */
const BREATH_HZ = 0.7
/** 呼吸的透明度两端：幅度很小，只够读出"在动" */
const BREATH_MIN = 0.3
const BREATH_MAX = 0.55
/** 锁死时固定在这一档（比呼吸上限略高，但颜色本身很暗，不亮） */
const LOCKED_ALPHA = 0.7
/**
 * 锁定标记的深色描边：C.bloodDark 落在同色调的暗红地毯上（列车车厢）只剩色相差，
 * 描边给的是明度差 —— 任何底色上都读得出形状，又不比金色标记更亮。
 */
const LOCKED_OUTLINE = 'rgba(6,5,8,0.85)'
/** 靠近时那个名字所在的字色：骨白 / 锁着时浅暖红（都比深色描边亮，红毯上也不糊） */
const LABEL_COLOR = '#ece2c8'
const LABEL_LOCKED_COLOR = '#e7c9bb'
/** 名字与朝向箭头从几格开始出现 */
const NEAR_TILES = 2
/** 名字随距离渐显的两端 */
const LABEL_MIN_A = 0.2
const LABEL_MAX_A = 0.8
/** 名字字号（逻辑像素，规范要求 8–9px。画布 384×216 会被 CSS 放大 3.33 倍） */
const LABEL_SIZE = 9

/**
 * 常驻主标记：5×5 的细线向下箭头（不是实心三角）—— 七像素、1px 线。
 * 一支 V 头接一段短竖干，比纯粹的 V 更明确地读作"箭头 / 出口"，
 * 又比实心三角轻得多，不会被当成可拾取物。
 */
const MARK_ARROW: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [4, 0],
  [1, 1], [3, 1],
  [2, 2],
  [2, 3],
  [2, 4],
]

/**
 * 靠近时那个方向箭头：4×2 的短 chevron（和主标记同族，但不带竖干、缩小一档）。
 * 它比常驻主标记小一圈、又贴在格子最靠边的地方 —— 读作主标记的注脚，
 * 不会和主标记合成一个对称图形。
 */
const CHEVRON_SMALL: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [3, 0],
  [1, 1], [2, 1],
]

/**
 * 朝向箭头在格子里的落点（相对格子左上角）。
 * 贴到格子对应的那一条边、离主标记最远：主标记在下半（行 9..13），
 * up 的方向箭头就贴到最上一行 —— 两支箭头之间留出整片空地。
 * down 不在表里：主标记本身就是一支向下的箭头，再叠一支同向的只会糊成一团。
 */
const DIR_MARK: Record<Exclude<Dir, 'down'>, { x: number; y: number }> = {
  up: { x: 6, y: 0 },
  left: { x: 0, y: 6 },
  right: { x: 14, y: 6 },
}

/** `#rrggbb` + alpha → `rgba(...)`：颜色仍只从 tiles.ts 的调色板取 */
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return `rgba(${r},${g},${b},${a.toFixed(3)})`
}

/**
 * 铺一组 1px 像素点。outline 给了就先在四个方向各偏移 1px 铺一层深色底（锁定态用）。
 */
function plotPixels(
  ctx: CanvasRenderingContext2D,
  px: number[],
  py: number[],
  color: string,
  outline?: string,
): void {
  if (outline) {
    ctx.fillStyle = outline
    for (let i = 0; i < px.length; i++) {
      const x = px[i]
      const y = py[i]
      ctx.fillRect(x - 1, y, 1, 1)
      ctx.fillRect(x + 1, y, 1, 1)
      ctx.fillRect(x, y - 1, 1, 1)
      ctx.fillRect(x, y + 1, 1, 1)
    }
  }
  ctx.fillStyle = color
  for (let i = 0; i < px.length; i++) ctx.fillRect(px[i], py[i], 1, 1)
}

/** 常驻主标记：一支 5×5 的细线向下箭头，left/top 是包围盒左上角 */
function drawMark(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  color: string,
  outline?: string,
): void {
  const px: number[] = []
  const py: number[] = []
  for (const [x, y] of MARK_ARROW) {
    px.push(left + x)
    py.push(top + y)
  }
  plotPixels(ctx, px, py, color, outline)
}

/**
 * 方向箭头（4×2 / 旋转后 2×4 的细线 chevron），left/top 是包围盒左上角。
 * 主标记不参与旋转：它是一支固定的"出口"箭头；方向信息只由这一支小箭头承担。
 */
function drawDirChevron(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  dir: Dir,
  color: string,
  outline?: string,
): void {
  const px: number[] = []
  const py: number[] = []
  for (const [x, y] of CHEVRON_SMALL) {
    let dx: number
    let dy: number
    if (dir === 'down') {
      dx = x; dy = y
    } else if (dir === 'up') {
      dx = x; dy = 1 - y
    } else if (dir === 'left') {
      dx = 1 - y; dy = x
    } else {
      dx = y; dy = x
    }
    px.push(left + dx)
    py.push(top + dy)
  }
  plotPixels(ctx, px, py, color, outline)
}

/** 与 engine.ts 的传送门判定同一套：neverOpen 或缺 flag 都算过不去 */
function isLocked(p: Portal, flags: Record<string, boolean | number>): boolean {
  return !!p.neverOpen || (!!p.lockFlag && !flags[p.lockFlag])
}

/**
 * 锁着时那行字的短句：取 lockMsg 到第一个句号为止，最多 8 个字。
 * 没有 lockMsg 就写「锁着」。
 * （「车门锁着。列车还在走。」读成「车门锁着。」比硬截 8 字自然。）
 */
function lockedLabel(p: Portal): string {
  const msg = (p.lockMsg ?? '').trim()
  if (!msg) return '锁着'
  const cut = msg.search(/[。！？…]/)
  const head = cut >= 0 ? msg.slice(0, cut + 1) : msg
  return Array.from(head).slice(0, 8).join('')
}

/** 当前这一帧的呼吸透明度（0.30 ↔ 0.55） */
function breathAlpha(): number {
  // 用真实时间而不是 world.t 帧计数：60Hz 屏上两者等价，但 120Hz 屏会让
  // world.t 一帧加一的节奏翻倍、呼吸变成 1.4Hz —— 用 performance.now 才是稳的 0.7Hz。
  // 也不用 world.clock：那个累计值每 120 秒会被重置（甜度衰减），相位会跳。
  const sec = performance.now() / 1000
  const s = 0.5 + 0.5 * Math.sin(sec * BREATH_HZ * Math.PI * 2)
  return BREATH_MIN + (BREATH_MAX - BREATH_MIN) * s
}

/**
 * 传送点标注。调用点在 renderer 的 drawScene 里、相机 translate 之内，
 * 所以这里一律用世界坐标（camX/camY 只用来做视口裁剪与文字水平方向的不出屏夹取）。
 */
export function drawPortals(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
  const g = useGame.getState()
  // 图纸模式不画：图纸有自己的结构符号，再叠一层出口标记会读乱
  if (g.blueprint) return

  const portals = world.map.portals
  if (!portals.length) return

  const breath = breathAlpha()
  const flags = g.flags

  for (const p of portals) {
    const left = p.x * TILE
    const top = p.y * TILE
    const cx = left + TILE / 2
    const cy = top + TILE / 2
    const sx = cx - camX
    const sy = cy - camY
    // 视口外（连标签一起）不画；文字可能往下多占十几像素，纵向多留一点
    if (sx < -32 || sx > VIEW_W + 32 || sy < -40 || sy > VIEW_H + 40) continue

    const locked = isLocked(p, flags)
    // 锁着 = 静止：透明度钉死，连呼吸都不给
    const alpha = locked ? LOCKED_ALPHA : breath
    const color = locked ? C.bloodDark : C.gold
    const outline = locked ? LOCKED_OUTLINE : undefined

    // 常驻主标记：格子中心偏下（行 9..13），1px 细线，让开瓦片中心的细节
    drawMark(ctx, left + 6, top + 9, withAlpha(color, alpha), outline)

    // 靠近：距离按格算（玩家脚部到格子中心）
    const d = Math.hypot((world.px - cx) / TILE, (world.py - cy) / TILE)
    const nearT = Math.max(0, Math.min(1, (NEAR_TILES - d) / NEAR_TILES))
    if (nearT <= 0) continue

    // 朝向箭头：走过去之后朝哪边。dir === 'down' 时与主标记同向，省略
    if (p.dir !== 'down') {
      const m = DIR_MARK[p.dir]
      drawDirChevron(ctx, left + m.x, top + m.y, p.dir, withAlpha(color, alpha * 0.7), outline)
    }

    // 目标地图名 / 锁着的提示
    const target = MAPS[p.to]
    const label = locked ? lockedLabel(p) : (target?.name ?? '')
    if (!label) continue

    const labelAlpha = LABEL_MIN_A + (LABEL_MAX_A - LABEL_MIN_A) * nearT
    // 逐字排版：字距固定 step（比字号宽 1px），整串宽度 = step × 字数。
    // 居中与夹取都按这个实际宽度算 —— 用 measureText 的整串宽度会偏窄，
    // 靠近画布边缘时字会溢出。
    const chars = Array.from(label)
    // 步进要比字号宽出 3px：中文在 9px 下的字形几乎填满 em 框，
    // 只留 1px 会在 3.33 倍缩放后糊成一团（实测过）。
    const step = LABEL_SIZE + 3
    const total = step * chars.length

    ctx.save()
    ctx.font = `${LABEL_SIZE}px ${SERIF_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    // 水平方向夹取在画布内：靠地图边缘的门（列车右端、桥南端）名字才不会被切掉
    const half = total / 2
    const lx = Math.max(half + 4, Math.min(VIEW_W - half - 4, sx))
    const ly = Math.max(10, Math.min(VIEW_H - LABEL_SIZE - 3, sy + 14))
    // 世界坐标 = 屏幕坐标 + 相机
    const startX = Math.round(lx + camX - total / 2)
    const wy = Math.round(ly + camY)

    ctx.globalAlpha = labelAlpha
    // 逐字绘制：384 逻辑宽放大到 1280 是 3.33 倍的**非整数**缩放，
    // 整串 fillText 在亚像素上会把相邻汉字挤在一起（实测糊成一团）。
    // 逐字摆放、每字占一个取整的步进，缩放后每个字才落在整数像素上。
    // 深色描边走 strokeText，落在字形外侧 —— 木地板 / 红毯 / 石板都读得出来。
    ctx.strokeStyle = '#05060b'
    ctx.lineWidth = 2.4
    ctx.lineJoin = 'round'
    for (let i = 0; i < chars.length; i++) {
      ctx.strokeText(chars[i], Math.round(startX + i * step + LABEL_SIZE / 2), wy)
    }
    // 字身：骨白（正常）/ 浅暖红（过不去）
    ctx.fillStyle = locked ? LABEL_LOCKED_COLOR : LABEL_COLOR
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], Math.round(startX + i * step + LABEL_SIZE / 2), wy)
    }
    ctx.restore()
  }
}
