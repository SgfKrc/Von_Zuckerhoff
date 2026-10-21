// ============================================================
// 山路尽头 · 第一视角过场（雨中上山，尽头是聚斯霍芬堡）
// ------------------------------------------------------------
// 依据 docs/_research/novel-01.md 场景 2（L25–L38）：雾、马灯、水泡、血的袜子、
// 「它不是人类建造的」、旗帜像沉睡的巨兽在呼吸。
//
// 与 Montage.tsx 的分工：
//   · 骨架完全一样 —— renderFrame(g, t) 是纯函数，任意一秒都能直接画出来，
//     跳过 / 定帧调试都靠这条性质；播放器（ui/RoadEnd.tsx）只管 rAF 与声音。
//   · 但画法完全相反：蒙太奇是木刻（两色 fillRect、留白刻轮廓），
//     这一段是第一视角 —— 有透视、有镜头起伏、有雨有雾，只保留像素的笔触
//     （所有几何坐标取整、不做抗锯齿插值）。
//
// 七段时间轴（合计 16.2s）：
//   ① 0.0–2.0   全黑，只有雨。              （画面不给，留给声音）
//   ② 2.0–4.0   第一视角起步：泥泞的山路在脚下向远处延伸，两侧浓黑树影
//   ③ 4.0–6.0   继续走；呼吸开始粗，雨丝变长
//   ④ 6.0–8.0   路变陡、树变稀、雨更大（斜向长雨丝），步子沉下去
//   ⑤ 8.0–10.0  他走不动了：步子更慢、右脚磨出水泡，慢半拍
//   ⑥ 10.0–13.0 雾里浮出黑色轮廓：尖顶、塔楼、飞扶壁像一排肋骨，旗帜在动
//   ⑦ 13.0–16.2 轮廓占满画面（仰视），15.0 起淡出到黑
//
// 第一视角的三件事，全在 cameraAt() / footAt() 里：
//   · 每步画面整体下移 3px 再弹回（前 18% 快速落下去，之后慢慢回弹，不是匀速）；
//   · 左右 ±2px 摇晃，每步过零一次 —— 步子间隔不均匀，摇晃也不均匀；
//   · 步长不是固定值：[0.42, 0.58, 0.5, 0.66] 循环，6s 后整体变慢 ×1.38，
//     右脚（他磨出水泡的那只）再多 +0.13s 并往下沉得更深 —— 深一脚浅一脚。
//
// 声音（播放器那边发，这里只给锚点）：
//   0.0  Snd.setScene('station') + setBgm(null) —— station 那一层是雨（1700Hz 噪声），
//        BGM 压掉；这是一整段里唯一的雨声来源（audio.ts 不归这一段管）。
//   每步  Snd.sfx('type') —— 18~25ms 的低沉敲击，正好是「踩进泥里」的那种闷响；
//   呼吸  每两步 Snd.sfx('door') —— 88Hz 的一个短促低音，听感是一声粗重的呼气；
//   11.2  Snd.sfx('bell') —— 轮廓浮出时那一声低沉的钟；
//   13.6  Snd.setScene('night') —— 收掉雨声，只留极低频的一点空气。
// ============================================================

type Ctx = CanvasRenderingContext2D

export const ROADEND_W = 384
export const ROADEND_H = 216

/** 全片时长（秒） */
export const ROADEND_TOTAL = 16.2

/** 跳过时落到的时刻：轮廓已经占满画面、还没开始淡出 */
export const ROADEND_SKIP_AT = 14.9

/** 那一声低沉的钟：轮廓浮出到一半的时候 */
export const ROAD_END_BELL_AT = 11.2

/** 雨声收掉、只留空气的时刻 */
export const ROAD_END_SILENT_AT = 13.6

// ------------------------------------------------------------
// 时间轴
// ------------------------------------------------------------

const TL = {
  /** ① 黑场结束 */
  black: 2.0,
  /** ② 起步结束 */
  walk1: 4.0,
  /** ③ 走稳 */
  walk2: 6.0,
  /** ④ 上坡、树稀、雨大 */
  climb: 8.0,
  /** ⑤ 走不动了 */
  drag: 10.0,
  /** ⑥ 轮廓浮出（雾里） */
  appear: 13.0,
  /** ⑦ 仰视、占满画面 */
  tilt: 15.0,
  /** 淡出到黑 */
  total: 16.2,
} as const

/** 每一步的基础时长（秒）—— 不均匀是刻意的，均匀的步子读起来像节拍器 */
const STEP_CYCLE = [0.42, 0.58, 0.5, 0.66]

/** 画面构图：地平线（路的灭点）与路的远近宽度 */
const HZ = 104
const VP_X = 192
/** 路在画面底缘（略低于 216，镜头一抖不会露出底）向外张开的半宽 */
const NEAR_Y = 246
const NEAR_HALF = 208
/** 路在灭点处的半宽 */
const FAR_HALF = 9

// ------------------------------------------------------------
// 小工具
// ------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function clamp01(v: number): number {
  return clamp(v, 0, 1)
}

/** 平滑插值（0..1）：用来做淡入淡出与浮现，不要线性 */
function smooth(a: number, b: number, v: number): number {
  const t = clamp01((v - a) / Math.max(1e-6, b - a))
  return t * t * (3 - 2 * t)
}

function easeOutQuad(p: number): number {
  const q = clamp01(p)
  return 1 - (1 - q) * (1 - q)
}

/** 确定性伪随机：同一帧每次画出来必须一模一样，否则整个画面会闪 */
function hash(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

/** 只画整数矩形：像素画不能出现半像素的灰边 */
function fill(g: Ctx, x: number, y: number, w: number, h: number): void {
  const x0 = Math.round(x)
  const y0 = Math.round(y)
  const w0 = Math.round(w)
  const h0 = Math.round(h)
  if (w0 <= 0 || h0 <= 0) return
  g.fillRect(x0, y0, w0, h0)
}

function px(g: Ctx, x: number, y: number, col: string): void {
  g.fillStyle = col
  g.fillRect(Math.round(x), Math.round(y), 1, 1)
}

/** `#rrggbb` / `rgb(...)` → 三个通道（mixHex 的输入可能已经是 rgb(...)） */
function parseColor(col: string): [number, number, number] {
  if (col[0] === '#') {
    const n = parseInt(col.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const m = col.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const parts = m[1].split(',').map(s => parseFloat(s))
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
  }
  return [0, 0, 0]
}

/**
 * 两种颜色之间插值（渐变逐行画的时候用）。
 * 输入可以是 #rrggbb，也可以是上一次 mixHex 的产物 rgb(...) ——
 * 只认 #rrggbb 的话，二层混色会算出 NaN，fillStyle 被静默丢弃，
 * 整块画面就留在底色上（这个坑踩过一次）。
 */
function mixHex(a: string, b: string, p: number): string {
  const [ar, ag, ab] = parseColor(a)
  const [br, bg, bb] = parseColor(b)
  const q = clamp01(p)
  const r = Math.round(ar + (br - ar) * q)
  const gg = Math.round(ag + (bg - ag) * q)
  const bl = Math.round(ab + (bb - ab) * q)
  return `rgb(${r},${gg},${bl})`
}

/**
 * 地平线在某一秒的高度。
 * 13–15s 镜头抬起来（仰视）：地平线往下走 44px —— 天占得更多、路退到画面下缘，
 * 那座城堡才有"压下来"的高度。
 */
function horizonAt(t: number): number {
  return HZ + smooth(TL.appear, TL.tilt, t) * 44
}

/** 路在某一行的半宽（p = 0 远、1 近）：1.7 次幂让近处张得快，透视才对 */
function trailHalfAt(y: number, hz: number): number {
  const p = clamp01((y - hz) / (NEAR_Y - hz))
  return FAR_HALF + (NEAR_HALF - FAR_HALF) * Math.pow(p, 1.7)
}

// ------------------------------------------------------------
// 步伐：一张固定的表，模块加载时算一次
// ------------------------------------------------------------

interface FootStep {
  /** 这一步踩下去的时刻 */
  t0: number
  dur: number
  /** 0 = 左脚，1 = 右脚（磨出水泡的那只，后半段慢半拍） */
  foot: 0 | 1
  /** 这一步把画面压下去多少像素：深一脚浅一脚 */
  depth: number
  /** 0..1：他有多走不动（6s 起爬到 1） */
  drag: number
}

/**
 * 从 2s 走到 10s，把每一步都排出来。
 * 表是固定的：renderFrame 是纯函数，步子不能依赖「上一帧」。
 */
function buildSteps(): FootStep[] {
  const out: FootStep[] = []
  let t = TL.black
  let i = 0
  while (t < TL.drag - 0.02 && i < 40) {
    const drag = clamp01((t - TL.walk2) / (TL.drag - TL.walk2))
    const foot = (i % 2) as 0 | 1
    // 6s 起整体变慢；右脚（水泡）从 7s 起再慢半拍
    let dur = STEP_CYCLE[i % STEP_CYCLE.length] * (1 + drag * 0.34)
    if (foot === 1 && t > 7.0) dur += 0.12 + drag * 0.05
    // 深一脚：右脚每次都更深一档；每三步偶尔再来一下重的
    const depth = (foot === 1 ? 3.2 : 2.2) + (i % 3 === 0 ? 0.9 : 0) + drag * 0.5
    out.push({ t0: t, dur, foot, depth, drag })
    t += dur
    i++
  }
  return out
}

const STEPS = buildSteps()

/**
 * 每一步落地的时刻（给播放器发脚步声用；画面那边用的是同一张表）。
 * 导出成纯数字，播放器就不需要知道 FootStep 的内部结构。
 */
export const ROAD_END_FOOTSTEPS: ReadonlyArray<{ t0: number; foot: 0 | 1 }> =
  STEPS.map(s => ({ t0: s.t0, foot: s.foot }))

/**
 * 呼吸：每两步一次，落在第二步的回弹中途（吸气的拍子在他把重量压下去之后）。
 * 播放器用它发一声很短的低声（audio.ts 的 'door'）。
 */
export const ROAD_END_BREATHS: ReadonlyArray<number> =
  STEPS.filter((_, i) => i % 2 === 0).map(s => s.t0 + s.dur * 0.55)

/** 这一秒落在哪一步的第几成（找不到就返回 null —— 还没起步 / 已经停下） */
function stepAt(t: number): { i: number; u: number; step: FootStep } | null {
  if (t < TL.black || STEPS.length === 0) return null
  for (let i = 0; i < STEPS.length; i++) {
    const s = STEPS[i]
    if (t < s.t0 + s.dur) return { i, u: clamp01((t - s.t0) / s.dur), step: s }
  }
  // 最后一步之后：停在最后一帧的姿态上（他站在雾里，不再往前）
  const last = STEPS[STEPS.length - 1]
  return { i: STEPS.length - 1, u: 1, step: last }
}

// ------------------------------------------------------------
// 镜头：起伏 + 摇晃
// ------------------------------------------------------------

interface Cam {
  /** 横向摇晃（±2px） */
  x: number
  /** 纵向起伏（0..~5px，向下为正） */
  y: number
  /** 步相位（第几步 + 步内进度）：摇晃与脚印都用它 */
  phase: number
}

/**
 * 镜头抖动的全部来源。
 *
 * 下移：每一步的前 18% 快速落下去（重量砸到前脚掌），之后按 easeOut 慢慢弹回 ——
 * 匀速的上下会读成「电梯」，而真实的重心是「落得快、起得慢」。
 * 摇：sin(相位 × π) 每步过零一次，即重心换到另一只脚；幅度 ±2px。
 * 另外叠一个很慢的 ±0.5px 漂移：走久了人会有点晃。
 */
function cameraAt(t: number): Cam {
  const s = stepAt(t)
  if (!s) return { x: 0, y: 0, phase: 0 }
  const { i, u, step } = s
  const DOWN = 0.18
  const dip = u < DOWN
    ? u / DOWN
    : 1 - easeOutQuad((u - DOWN) / (1 - DOWN)) * 0.94
  const phase = i + u
  const sway = Math.sin(phase * Math.PI) * 2
  const drift = Math.sin(t * 0.83 + 1.2) * 0.5
  return {
    x: Math.round(sway + drift),
    y: Math.round(step.depth * dip),
    phase,
  }
}

// ------------------------------------------------------------
// ①–⑤ 天空 / 树影 / 路
// ------------------------------------------------------------

/** 夜空：从顶上的近黑，一路压到地平线上的一线冷光（雨夜的云把天光反了下来） */
function paintSky(g: Ctx, t: number): void {
  const hz = horizonAt(t)
  const bright = smooth(TL.walk1, TL.appear, t) * 0.55
  for (let y = 0; y < hz + 30; y += 2) {
    const p = clamp01(y / hz)
    // 颜色：天顶 #101823 → 地平线 #2c4256。雨夜的天空不是纯黑 ——
    // 云把月光反下来，地平线那一带必须亮得出来，路才有"尽头"。
    const top = mixHex('#101823', '#151f2e', bright)
    const bot = mixHex('#2c4256', '#38536b', bright)
    g.fillStyle = mixHex(top, bot, Math.pow(p, 0.85))
    fill(g, 0, y, ROADEND_W, 2)
  }
  // 雨云的底边：三道很淡的横向暗带（只在天空区，落到地平线为止）
  for (let i = 0; i < 3; i++) {
    const y = 12 + i * 16
    g.fillStyle = `rgba(4,6,10,${(0.10 + i * 0.04).toFixed(3)})`
    for (let x = 0; x < ROADEND_W; x += 4) {
      const w = Math.sin((x / ROADEND_W) * Math.PI * 4 + i * 1.7) * 0.5 + 0.5
      if (w > 0.46) fill(g, x, y + Math.round(w * 5), 4, 2 + Math.round(w * 3))
    }
  }
}

/**
 * 泥泞的山路：一条从脚下向灭点收拢的梯形。
 * 逐行画：远处的土是雾蓝灰的（被雾洗过），近处是被踩烂的湿泥（泛褐）。
 * 车辙、水洼、脚印都按行落在同一条梯形里，所以它们自动跟着透视走。
 */
function paintTrail(g: Ctx, t: number): void {
  const hz = horizonAt(t)
  const steep = smooth(TL.walk2, TL.climb, t)      // 6s 后开始上坡（路面更暗更湿）
  for (let y = hz; y < NEAR_Y; y++) {
    const p = clamp01((y - hz) / (NEAR_Y - hz))
    const half = trailHalfAt(y, hz)
    const x0 = VP_X - half
    const w = half * 2
    // 土色：远 = 冷灰蓝（#2a313b），中 = 湿土（#3d3626），近 = 泥（#524530）
    const far = mixHex('#2a313b', '#313b47', steep)
    const near = mixHex('#524530', '#5b4d36', steep)
    const mid = mixHex('#3d3626', '#463e2c', steep)
    const col = p < 0.45
      ? mixHex(far, mid, p / 0.45)
      : mixHex(mid, near, (p - 0.45) / 0.55)
    g.fillStyle = col
    fill(g, x0, y, w, 1)

    // 路心：被踩了几十年的那一条，比两边亮一档（人走的就是这里）
    const coreHalf = half * 0.44
    g.fillStyle = p < 0.45 ? 'rgba(96,104,118,0.10)' : 'rgba(150,134,98,0.13)'
    fill(g, VP_X - coreHalf, y, coreHalf * 2, 1)
    // 土斑：每 4 行一块，深浅不一 —— 平涂的梯形会读成一条带子
    const patch = Math.floor(y / 4) * 31 + 5
    if (hash(patch) > 0.5) {
      const bx = x0 + 3 + Math.round(hash(patch + 17) * (w - 10))
      const bw = 2 + Math.round(p * 7)
      g.fillStyle = hash(patch + 29) > 0.5 ? 'rgba(18,16,11,0.20)' : 'rgba(120,110,86,0.10)'
      fill(g, bx, y, bw, 1)
    }

    // 路面上的湿光：越近越亮的两三条断续反光（雨水积在坑里）
    const band = Math.floor(y / 3)
    if (hash(band * 17 + 5) > 0.62) {
      const lx = x0 + 2 + Math.round(hash(band * 7 + 1) * (w - 6))
      const lw = Math.max(1, Math.round(1 + p * 3))
      g.fillStyle = `rgba(154,166,184,${(0.06 + p * 0.16).toFixed(3)})`
      fill(g, lx, y, lw, 1)
    }
    // 车辙：两条从远到近张开的暗线（山路被车压过）
    const rut = Math.round(half * 0.34)
    g.fillStyle = `rgba(8,9,12,${(0.16 + p * 0.22).toFixed(3)})`
    fill(g, VP_X - rut, y, Math.max(1, Math.round(1 + p * 3)), 1)
    fill(g, VP_X + rut, y, Math.max(1, Math.round(1 + p * 3)), 1)
  }
  // 路面上的水洼：几处扁平的冷色反光，位置固定
  for (let i = 0; i < 7; i++) {
    const p = 0.25 + hash(i * 13 + 3) * 0.7
    const y = hz + (NEAR_Y - hz) * p
    const half = trailHalfAt(y, hz)
    const cx = VP_X + (hash(i * 29 + 7) - 0.5) * half * 1.3
    const w = Math.round((6 + hash(i * 31 + 11) * 22) * (0.4 + p))
    const h = Math.round(2 + p * 3)
    g.fillStyle = 'rgba(18,26,35,0.72)'
    fill(g, cx - w / 2, y, w, h)
    g.fillStyle = 'rgba(154,166,184,0.20)'
    fill(g, cx - w / 2 + 1, y, w - 2, 1)
    // 雨点打在水面上的涟漪
    const rp = Math.round(((t * 0.9 + i * 0.37) % 1) * 4)
    px(g, cx - 1 + rp, y + 1, 'rgba(216,221,229,0.34)')
  }
  // 脚印：一串已经踩过去的湿印，从近处往雾里越来越小
  for (let i = 0; i < 9; i++) {
    const p = 0.15 + i * 0.09
    const y = hz + (NEAR_Y - hz) * p
    const half = trailHalfAt(y, hz)
    const side = i % 2 === 0 ? -1 : 1
    const cx = VP_X + side * half * 0.22
    g.fillStyle = 'rgba(9,10,13,0.42)'
    fill(g, cx - 1, y, Math.max(1, Math.round(1 + p * 2)), Math.max(1, Math.round(1 + p * 2)))
  }
}

/**
 * 两侧的树影。三层叠出来，才不是两块黑砖：
 *   ① 整片底黑：从画面边缘一直铺到路的边，边缘按 18px 一段做「大锯齿」
 *      （每 4 行一个小锯齿会读成虚线，一丛一丛的轮廓才读成树冠）；
 *   ② 树干：每侧两三根，根在画面下方、梢伸到画面顶端，根部粗梢细，
 *      颜色比底黑亮一点点 —— 在黑块里刚好能认得出来；
 *   ③ 树冠：从画面上缘垂下来的枝杈，随风雨轻摆。
 * 6s 之后树越来越稀：底黑的内缘往画面外侧退，树干变细、根数减少。
 */
function paintTrees(g: Ctx, t: number): void {
  const thin = smooth(TL.walk2, TL.drag, t)   // 0 = 密林，1 = 只剩稀树
  const hz = horizonAt(t)
  const TOP = hz - 46

  // 路的左 / 右边界（大锯齿：每 18px 一段，段内不动）
  const edgeAt = (side: -1 | 1, y: number): number => {
    const p = clamp01((y - TOP) / (NEAR_Y - TOP))
    const half = trailHalfAt(Math.max(hz, y), hz)
    const base = side < 0 ? VP_X - half : VP_X + half
    const seg = Math.floor(y / 18) * (side < 0 ? 1 : 3) + 11
    const reach = (9 + p * 52) * (1 - thin * 0.70)
    const jag = Math.round(hash(seg * 13 + 7) * reach)
    return side < 0 ? base - jag : base + jag
  }

  // ① 底黑
  //    注意顶部那 40px：黑块的内缘随高度迅速往画面外侧收，
  //    于是画面上缘只被树冠咬住两个角、中间是开阔的夜空 ——
  //    不收的话，两条竖直的黑边会把画面读成「隧道」而不是「山路」。
  g.fillStyle = '#0a1015'
  for (let y = TOP; y < NEAR_Y; y++) {
    const p = clamp01((y - TOP) / (NEAR_Y - TOP))
    // 顶部收 118px，再按每 11px 一段做参差 —— 树的边缘是树冠，不是圆弧
    const jagTop = Math.floor(y / 11)
    const openL = (1 - p) * (1 - p) * (118 + hash(jagTop * 7 + 3) * 30)
    const openR = (1 - p) * (1 - p) * (118 + hash(jagTop * 11 + 9) * 30)
    const el = edgeAt(-1, y) - openL
    const er = edgeAt(1, y) + openR
    fill(g, -24, y, el + 24, 1)
    fill(g, er, y, ROADEND_W + 24 - er, 1)
    // 内缘的一道极暗冷光：树的轮廓才从夜色里切得出来
    g.fillStyle = 'rgba(44,58,72,0.50)'
    fill(g, el - 1, y, 1, 1)
    fill(g, er, y, 1, 1)
    g.fillStyle = '#0a1015'
  }
  // 树影的上部被雾洗淡一点（远处的树在雾里，不是一块黑）
  for (let y = TOP; y < TOP + 70; y++) {
    const a = (1 - (y - TOP) / 70) * 0.10
    if (a <= 0.004) continue
    g.fillStyle = `rgba(96,116,140,${a.toFixed(3)})`
    fill(g, 0, y, ROADEND_W, 1)
  }

  // ② 树干：根在画面下方，梢伸进树冠里。
  //    四根故意不对称（左一根粗近、一根细远；右同）——
  //    对称的四根会读成「隧道口的两排柱子」。
  const trunks = [
    { cx: 22, w: 30, lean: -0.26, seed: 1 },
    { cx: 112, w: 12, lean: 0.20, seed: 2 },
    { cx: 306, w: 14, lean: -0.16, seed: 3 },
    { cx: 366, w: 32, lean: 0.22, seed: 4 },
  ]
  const shown = Math.round(trunks.length * (1 - thin * 0.5))
  for (let i = 0; i < shown; i++) {
    const tr = trunks[i]
    const sideIsLeft = tr.cx < VP_X
    for (let k = 0; k < 258; k++) {
      const yy = NEAR_Y - k
      if (yy < TOP) break                      // 树梢到黑块的上缘就断，上面是树冠
      const p = k / 258                        // 0 根 → 1 梢
      const ww = tr.w * (1 - p * 0.62)
      const xx = tr.cx + tr.lean * k
      // 只画在底黑里（画到路面上会挡住路 —— 树长在路外）
      const py = clamp01((yy - TOP) / (NEAR_Y - TOP))
      const jagTop = Math.floor(yy / 11)
      const openUp = (1 - py) * (1 - py) *
        (118 + hash(jagTop * (sideIsLeft ? 7 : 11) + (sideIsLeft ? 3 : 9)) * 30)
      const lim = edgeAt(sideIsLeft ? -1 : 1, yy) + (sideIsLeft ? -openUp : openUp)
      if (sideIsLeft ? xx > lim : xx < lim) continue
      g.fillStyle = '#0b1116'
      fill(g, xx - ww / 2, yy, ww, 1)
      // 左上受光的一道窄边：树是湿的，反一点雨光
      g.fillStyle = 'rgba(40,54,68,0.55)'
      fill(g, xx - ww / 2, yy, 1, 1)
      // 每隔几行一道树皮的暗裂
      if (k % 9 === 0) {
        g.fillStyle = '#05080b'
        fill(g, xx - ww / 2 + 2, yy, Math.max(1, ww - 4), 1)
      }
    }
  }

  // ③ 树冠：从画面上缘垂下来的枝杈（6s 后一根一根退掉）
  const canopy = Math.round(9 * (1 - thin * 0.8))
  for (let i = 0; i < canopy; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const seed = i * 37 + 5
    const baseX = side < 0
      ? 4 + hash(seed) * 66
      : ROADEND_W - 4 - hash(seed) * 66
    const sway = Math.sin(t * 0.8 + i * 1.3) * 2
    const len = 40 + hash(seed + 1) * 74
    const lean = side * (0.55 + hash(seed + 2) * 0.6)
    g.fillStyle = '#0a1015'
    for (let k = 0; k < len; k++) {
      const xx = baseX + sway + lean * k * 0.42
      const w = 2 + Math.round(hash(seed + k * 3) * 4) + (k < 12 ? 4 : 0)
      fill(g, xx - w / 2, k, w, 1)
    }
    // 两三根更细的枝
    for (let b = 0; b < 3; b++) {
      const by = 6 + hash(seed + b * 11) * (len * 0.6)
      const dir = hash(seed + b * 13) > 0.5 ? 1 : -1
      const bl = 12 + Math.round(hash(seed + b * 17) * 26)
      for (let k = 0; k < bl; k++) {
        fill(g, baseX + sway + lean * by * 0.42 + dir * k, by + k * 0.35, 1, 1)
      }
    }
  }

  // 近景的一丛草：画面底缘两侧，是"脚下"的最后一道参照
  for (let i = 0; i < 26; i++) {
    const side = i % 2 === 0 ? 0 : 1
    const x = side === 0
      ? Math.round(hash(i * 7 + 2) * 54)
      : ROADEND_W - 1 - Math.round(hash(i * 7 + 2) * 54)
    const y = 172 + Math.round(hash(i * 11 + 5) * 60)
    const h = 3 + Math.round(hash(i * 13 + 9) * 7)
    g.fillStyle = i % 3 === 0 ? '#1e2a1a' : '#131c12'
    for (let k = 0; k < h; k++) {
      fill(g, x + Math.round(Math.sin(k * 0.7 + i) * 1.5), y - k, 1, 1)
    }
  }
}

/**
 * 贴地的雾：横在路的尽头，把地平线那一线光冲淡。
 * 6s 之后越来越厚（雨更大、雾更浓），13s 之后又薄下去（近处看清了）。
 */
function paintHaze(g: Ctx, t: number): void {
  // 13s 之后雾要退下去：镜头抬起来了，看的是塔尖，不是脚下的地面雾
  const thick = smooth(TL.walk2, TL.drag, t) * (1 - smooth(TL.appear, TL.tilt, t) * 0.62)
  const base = horizonAt(t) - 18 + Math.round(smooth(TL.black, TL.appear, t) * 8)
  for (let y = base - 26; y < base + 62; y++) {
    const p = (y - (base - 26)) / 88
    const band = Math.exp(-Math.pow((p - 0.5) * 2.2, 2))
    const drift = Math.sin((y / 88) * Math.PI * 3 + t * 0.35) * 0.10
    const a = band * (0.10 + thick * 0.16) * (1 + drift)
    if (a <= 0.006) continue
    g.fillStyle = `rgba(120,134,150,${a.toFixed(3)})`
    fill(g, 0, y, ROADEND_W, 1)
  }
}

// ------------------------------------------------------------
// ⑥⑦ 聚斯霍芬堡的轮廓
// ------------------------------------------------------------

/** 轮廓在这一秒的样子：多黑、多大、底部落在哪 */
interface CastleFrame {
  alpha: number
  scale: number
  baseY: number
}

/**
 * 城堡是**从雾里长出来的**：
 *   10s 起（climb 结束）它的顶部先露出来，底部还埋在雾与山脊里；
 *   13s 占满画面；13–15s 镜头抬起来（仰视）—— 整座城堡继续放大、底边沉出画面。
 * 放大时以 "底边" 为原点向上长，所以塔尖始终指向上方。
 */
function castleAt(t: number): CastleFrame | null {
  // 10s 才从雾里开始露头：6–10s 这一段全部让给「上坡」与雨
  if (t < TL.climb + 1.8) return null
  const rise = smooth(TL.climb + 1.8, TL.appear, t)  // 9.8→13：从雾里浮出来
  const tilt = smooth(TL.appear, TL.tilt, t)         // 13→15：仰视
  // 「浮现」靠雾退，不靠透明度：10.2→11.4 就基本不透明了 ——
  // 半透明的黑只能读出「灰色的建筑」，读不出「一座压在雾里的城堡」。
  const alpha = smooth(TL.climb + 2.0, TL.climb + 3.4, t)
  if (alpha <= 0.01) return null
  return {
    alpha,
    // 0.46 → 0.98 → 1.42
    scale: 0.46 + rise * 0.52 + tilt * 0.44,
    // 底边：骑在地平线上，仰视时整座城堡沉下去，塔尖冲向上缘
    baseY: horizonAt(t) + 8 + tilt * 92,
  }
}

/**
 * 一座骨感的城堡：全部是 fillRect 的纯黑剪影。
 * 结构（设计坐标，以 (0, baseY) 为底、中心线为 0）：
 *   主楼 -66..66 / 高 62        ← 墙面上不画窗、不画石缝：它在雾里只是一个轮廓
 *   中央高塔 -17..17 / 高 148   ← 最高的尖顶，旗就插在这上面
 *   左塔 -104..-68 / 高 116，右塔 68..104 / 高 110
 *   飞扶壁：从塔身斜到主楼的四级阶梯（那是"肋骨"的斜线）
 *   主楼顶上还有一排高低不一的细尖（像一排肋骨，参差不齐）
 */
function paintCastleSilhouette(g: Ctx, f: CastleFrame, t: number): void {
  const cx = VP_X
  const b = f.baseY
  const s = f.scale
  /** 设计坐标 → 屏幕坐标 */
  const X = (x: number): number => cx + x * s
  const Y = (h: number): number => b - h * s
  const W = (w: number): number => w * s
  const H = (h: number): number => h * s

  g.fillStyle = `rgba(0,0,0,${f.alpha.toFixed(3)})`

  // ---- 主楼 ----
  fill(g, X(-66), Y(62), W(132), H(62))
  // 主楼顶的雉堞：一排小齿（齿高 5，间隔 12）
  for (let i = 0; i < 11; i++) {
    fill(g, X(-62 + i * 12), Y(68), W(6), H(7))
  }

  // ---- 一排肋骨似的细尖：高低不一，从主楼顶刺上去 ----
  const ribs: [number, number, number][] = [
    [-52, 16, 7], [-38, 27, 6], [-24, 19, 8], [-8, 33, 6],
    [7, 22, 7], [22, 30, 6], [37, 17, 8], [51, 25, 6],
  ]
  for (const [dx, h, w] of ribs) {
    // 每根从主楼顶（62）往上长 h；顶端再收窄一档，于是八根尖是参差的
    fill(g, X(dx - w / 2), Y(62 + h), W(w), H(h))
    fill(g, X(dx - w / 2 + 1), Y(62 + h + 7), W(Math.max(2, w - 2)), H(7))
    // 顶上再收成一根 1~2px 的针
    fill(g, X(dx - 1), Y(62 + h + 12), W(2), H(5))
  }

  // ---- 左塔 + 尖顶 ----
  fill(g, X(-104), Y(116), W(36), H(116))
  // 尖顶：逐行收窄（像素台阶），每两级换一次宽度 —— 边缘因此是断的
  for (let i = 0; i < 34; i += 2) {
    const w = Math.max(2, Math.round(36 * (1 - i / 34)))
    fill(g, X(-86) - W(w / 2), Y(116 + i * 2), W(w), H(4))
  }
  // 右塔
  fill(g, X(68), Y(110), W(36), H(110))
  for (let i = 0; i < 30; i += 2) {
    const w = Math.max(2, Math.round(36 * (1 - i / 30)))
    fill(g, X(86) - W(w / 2), Y(110 + i * 2), W(w), H(4))
  }

  // ---- 中央高塔：全画面最高的一根 ----
  fill(g, X(-17), Y(148), W(34), H(148))
  for (let i = 0; i < 46; i += 2) {
    const w = Math.max(2, Math.round(34 * (1 - i / 46)))
    fill(g, X(0) - W(w / 2), Y(148 + i * 2), W(w), H(4))
  }

  // ---- 飞扶壁：从两座塔身斜到主楼的四级阶梯，中间是空的 ----
  for (let i = 0; i < 7; i++) {
    const y = 74 - i * 8
    const lx = -68 - i * 4
    fill(g, X(lx), Y(y), W(18 - i), H(5))
    const rx = 68 + i * 4
    fill(g, X(rx - 18 + i), Y(y - 6), W(18 - i), H(5))
  }
  // 扶壁下面的支柱：两根斜柱，把塔和主楼拉住
  for (let i = 0; i < 12; i++) {
    fill(g, X(-66 - i * 2), Y(52 + i * 2), W(5), H(3))
    fill(g, X(63 + i * 2), Y(48 + i * 2), W(5), H(3))
  }

  // ---- 旗：最高的塔顶，每帧偏移 1px 的正弦 ----
  const poleH = 16
  fill(g, X(-1), Y(148 + 34 + poleH), W(2), H(poleH))
  const wind = Math.round(Math.sin(t * 2.6) * 1)
  for (let row = 0; row < 7; row++) {
    // 每行的横向偏移都不同 —— 旗面在风里是波浪，不是一块挂布
    const flap = Math.round(Math.sin(t * 3.1 + row * 0.55) * 2)
    const w = 10 - Math.abs(row - 3)
    fill(g, X(1) + wind + flap, Y(148 + 34 + poleH - row), W(w), H(1))
  }

  // ---- 轮廓外缘的一线雾光：把纯黑从夜空里切出来 ----
  g.fillStyle = `rgba(42,54,70,${(f.alpha * 0.35).toFixed(3)})`
  fill(g, X(-104) - 1, Y(116), 1, H(116))
  fill(g, X(104) + 1, Y(110), 1, H(110))
  fill(g, X(-17) - 1, Y(148), 1, H(148))
  fill(g, X(17) + 1, Y(148), 1, H(148))
}

// ------------------------------------------------------------
// 雨
// ------------------------------------------------------------

/** 这一秒的雨有多大、斜多少（6–10s 最大，13s 之后收掉） */
function rainAt(t: number): { intensity: number; slant: number; long: number } {
  let intensity = 0.34
  let slant = 0.30
  let long = 0
  if (t >= TL.walk2 && t < TL.drag) {
    const p = (t - TL.walk2) / (TL.drag - TL.walk2)
    intensity = 0.5 + p * 0.16
    slant = 0.34 + p * 0.05
    long = p
  } else if (t >= TL.drag && t < TL.appear) {
    intensity = 0.74
    slant = 0.40
    long = 1
  } else if (t >= TL.appear) {
    const p = smooth(TL.appear, TL.tilt, t)
    intensity = 0.74 - p * 0.5
    slant = 0.40 - p * 0.06
    long = 1 - p * 0.7
  }
  return { intensity, slant, long }
}

/**
 * 斜雨：1px 宽的短线，风从右边来，所以往左下斜。
 * 越近的雨丝越长越亮（雨离镜头越近，落得越快、看得越清）。
 */
function paintRain(g: Ctx, t: number): void {
  const { intensity, slant, long } = rainAt(t)
  const COUNT = Math.round(70 + intensity * 190)
  for (let i = 0; i < COUNT; i++) {
    const seed = i * 13 + 7
    const near = i % 3 !== 0
    const speed = (near ? 330 : 200) + hash(seed) * 140
    const len = Math.round((near ? 4 : 2) + hash(seed + 1) * (near ? 7 : 3) + long * (near ? 9 : 4))
    const x0 = hash(seed + 2) * (ROADEND_W + 150) - 75
    const y0 = hash(seed + 3) * (ROADEND_H + 190)
    const y = ((y0 + t * speed) % (ROADEND_H + 190)) - 95
    const x = x0 - y * slant
    const a = near
      ? (0.14 + hash(seed + 4) * 0.20) * intensity
      : (0.05 + hash(seed + 4) * 0.10) * intensity
    g.fillStyle = `rgba(168,182,200,${a.toFixed(3)})`
    for (let k = 0; k < len; k += 2) {
      fill(g, x + k * slant * 0.9, y + k, 1, 2)
    }
  }
  // 近处几道打在镜头上的粗雨：长、淡、一闪而过（贴脸的雨）
  for (let i = 0; i < 5; i++) {
    const seed = 900 + i * 17
    const x0 = hash(seed) * ROADEND_W
    const y0 = hash(seed + 1) * ROADEND_H
    const y = ((y0 + t * 520) % (ROADEND_H + 120)) - 60
    const x = x0 - y * 0.34
    g.fillStyle = `rgba(178,192,210,${(0.09 * intensity).toFixed(3)})`
    for (let k = 0; k < 18; k += 2) {
      fill(g, x + k * 0.34, y + k, 1, 2)
    }
  }
}

// ------------------------------------------------------------
// 第一视角的那双脚
// ------------------------------------------------------------

/**
 * 一只磨破的黑皮鞋（32×22，鞋尖朝画面里）。
 *
 * 第一视角看到的是鞋头和鞋带，不是鞋跟 —— 所以轮廓是"上窄下宽"：
 * 鞋尖朝上（y0），鞋身在中间，鞋跟在最下。
 * 磨破的地方在鞋头两侧：两粒露出内衬的浅灰，一只鞋只有一处。
 */
function paintShoe(g: Ctx, cx: number, bottomY: number, lift: number, right: boolean, drag: number): void {
  const W = 32
  const H = 22
  const left = Math.round(cx - W / 2)
  // 抬起时向上（画面里是向着镜头）
  const top = Math.round(bottomY - H - lift * 7)
  const squash = lift > 0.05 ? 0 : Math.round(drag * 1.4)
  // 鞋底的落影：只有踩实的那只脚才有（抬起来的那只下面会露一小片亮）
  if (lift <= 0.05) {
    g.fillStyle = 'rgba(4,5,8,0.60)'
    fill(g, left - 3, bottomY - 2, W + 6, 5)
  }
  // 鞋身：逐行宽度（鞋尖在上、窄；鞋身宽；鞋跟在下、再收一点）
  const rows = [10, 7, 5, 4, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 4, 4, 5, 5]
  for (let i = 0; i < rows.length; i++) {
    const y = top + i
    g.fillStyle = i > 15 ? '#17141d' : '#221e28'
    fill(g, left + rows[i], y, W - rows[i] * 2, 1)
  }
  // 鞋底：最下两行压到近黑（鞋跟踩进泥里，永远背光）
  g.fillStyle = '#0d0b10'
  fill(g, left + 4, top + 20, W - 8, 2)
  // 鞋头的圆角与鞋口的一道暗线
  g.fillStyle = '#0d0b10'
  fill(g, left + 10, top, 12, 1)
  fill(g, left + 7, top + 3, 18, 1)
  // 受光：左侧的一道窄边（鞋面是打湿的皮，反一点雨光）
  g.fillStyle = '#4a4350'
  fill(g, left + 3, top + 5, 2, 12)
  g.fillStyle = '#8a94a6'
  fill(g, left + 3, top + 6, 1, 6)
  fill(g, left + 5, top + 4, 5, 1)
  // 鞋带：三道短横（只有靠镜头这一侧才看得见）
  g.fillStyle = '#3a3442'
  fill(g, left + 11, top + 6, 10, 1)
  fill(g, left + 12, top + 9, 8, 1)
  fill(g, left + 12, top + 12, 8, 1)
  px(g, left + 11, top + 6, '#7b8899')
  px(g, left + 12, top + 9, '#6f7a8c')
  // 磨破的地方：浅灰的内衬露出来（左右两只鞋破在不同的地方）
  const tearX = right ? left + 21 : left + 6
  g.fillStyle = '#b8c2d0'
  fill(g, tearX, top + 10, 2, 3)
  g.fillStyle = '#8a94a6'
  fill(g, tearX + 1, top + 13, 1, 1)
  // 泥点：鞋帮溅上来的湿地
  px(g, left + 5, top + 17, '#4a3f28')
  px(g, left + 25, top + 15, '#4a3f28')
  px(g, left + 14, top + 19, '#3b3526')
  // 踩下去的那一下，鞋跟边缘被泥吞掉 1px
  if (squash > 0) {
    g.fillStyle = 'rgba(58,50,34,0.9)'
    fill(g, left + 4, bottomY - squash, W - 8, squash)
  }
}

/**
 * 一条裤腿：从画面最底边长上来，被鞋挡住下半截。
 * 少了它，下面那两块黑就只是"两块黑"；有了它，第一视角才读成「我低头看自己的脚」。
 */
function paintTrouser(g: Ctx, cx: number, bottomY: number, w: number, h: number, lift: number): void {
  const top = Math.round(bottomY - h - lift * 3)
  for (let y = top; y < bottomY; y++) {
    const p = (bottomY - y) / h           // 0 底 → 1 顶
    // 裤管上窄下宽（裤脚堆在鞋口上）
    const ww = w * (0.70 + p * 0.30)
    g.fillStyle = '#181c28'
    fill(g, cx - ww / 2, y, ww, 1)
    // 左侧受光
    g.fillStyle = '#252b3a'
    fill(g, cx - ww / 2 + 1, y, 2, 1)
    // 两道褶：竖向的暗线
    g.fillStyle = '#10121a'
    if (y % 7 < 5) fill(g, cx + Math.round(ww * 0.16), y, 1, 1)
    if (y % 9 < 4) fill(g, cx - Math.round(ww * 0.22), y, 1, 1)
    // 裤脚：最下 3px 压暗（布折进去了）
    g.fillStyle = 'rgba(8,9,13,0.55)'
    if (y > bottomY - 4) fill(g, cx - ww / 2, y, ww, 1)
  }
}

/**
 * 脚：画面下方三分之一。
 * 每步一只脚抬起、另一只踩实；抬起的脚向上、略缩小一点。
 * 右脚（foot = 1）从 7s 起慢半拍：它的抬落相位比左脚的步节拍晚 0.09 ——
 * 这就是"他磨出水泡了"在画面上的全部表达，不需要一句台词。
 */
function paintFeet(g: Ctx, t: number): void {
  const s = stepAt(t)
  const groundY = 210
  const LX = 146
  const RX = 238
  let liftL = 0
  let liftR = 0
  let drag = 0
  if (s) {
    const { u, step } = s
    drag = step.drag
    const lift = Math.sin(clamp01(u) * Math.PI)
    if (step.foot === 0) {
      liftL = lift
    } else {
      // 右脚慢半拍：抬起的相位往后拖 0.09
      liftR = Math.sin(clamp01(u - 0.09) * Math.PI)
    }
  }
  // 两只脚都有一点极慢的呼吸（站着不动时它们也不是死的）
  const breathe = Math.sin(t * 1.1) * 0.12
  const dyL = groundY + Math.round(liftL * 2) + Math.round(breathe * 2)
  const dyR = groundY + Math.round(liftR * 2) + Math.round(breathe * 2)
  // 先裤腿（在鞋后面），再鞋 —— 「自己的脚」靠这两条裤腿才立得住
  paintTrouser(g, LX, dyL - 2, 42, 26, liftL)
  paintTrouser(g, RX, dyR - 2, 42, 26, liftR)
  paintShoe(g, LX, dyL, liftL, false, drag)
  paintShoe(g, RX, dyR, liftR, true, drag)
}

/**
 * 贴地的雾：横在画面下半部，脚就走在雾里。
 * 比远处那条雾带淡，但它把"路"与"脚"接在了一起 —— 少了它，脚像贴在画面上。
 */
function paintGroundFog(g: Ctx, t: number): void {
  for (let y = 150; y < ROADEND_H; y++) {
    const p = (y - 150) / (ROADEND_H - 150)          // 0 上 → 1 底
    const band = Math.sin(p * Math.PI * 0.9) * (1 - p * 0.45)
    const drift = 0.5 + 0.5 * Math.sin(t * 0.42 + y * 0.07)
    const a = band * (0.020 + drift * 0.030)
    if (a <= 0.004) continue
    g.fillStyle = `rgba(122,138,156,${a.toFixed(3)})`
    fill(g, 0, y, ROADEND_W, 1)
  }
}

// ------------------------------------------------------------
// 暗角 / 黑场
// ------------------------------------------------------------

/**
 * 边缘压暗：雾 + 夜。中心不是画面正中，而是**路的灭点** ——
 * 于是整块画面的亮部就只有中间那一条路（验收里那句「只有中间一条路是亮的」）。
 */
function paintVignette(g: Ctx): void {
  g.save()
  // 只留中间那条路：以灭点为中心压一个椭圆。
  // 强度要克制 —— 这里的每一格都被后面那层夜压过一次了：
  // 0.85 半径内几乎不压，只有四角到 0.62。压到 0.9 会把天空与树影一起吃掉。
  const grad = g.createRadialGradient(VP_X, HZ + 54, 40, VP_X, HZ + 54, 266)
  grad.addColorStop(0, 'rgba(4,6,10,0)')
  grad.addColorStop(0.55, 'rgba(4,6,10,0.06)')
  grad.addColorStop(0.85, 'rgba(4,6,10,0.28)')
  grad.addColorStop(1, 'rgba(3,4,7,0.62)')
  g.fillStyle = grad
  g.fillRect(0, 0, ROADEND_W, ROADEND_H)
  // 上下两道：天空顶与画面底缘也要沉下去（椭圆的上下缘其实还亮着）
  const corner = g.createLinearGradient(0, 0, 0, ROADEND_H)
  corner.addColorStop(0, 'rgba(3,4,7,0.30)')
  corner.addColorStop(0.32, 'rgba(3,4,7,0)')
  corner.addColorStop(1, 'rgba(3,4,7,0.26)')
  g.fillStyle = corner
  g.fillRect(0, 0, ROADEND_W, ROADEND_H)
  // 雨夜的整体冷调：一层很淡的蓝压在整幅画上
  g.fillStyle = 'rgba(18,30,52,0.08)'
  g.fillRect(0, 0, ROADEND_W, ROADEND_H)
  g.restore()
}

/** 这一秒的黑场有多黑：开头 1.9s 全黑，2.4s 亮起来；15s 起再淡出去 */
function blackLevel(t: number): number {
  if (t <= 1.9) return 1
  if (t < 2.4) return 1 - (t - 1.9) / 0.5
  if (t < TL.tilt) return 0
  return smooth(TL.tilt, TL.total, t)
}

// ------------------------------------------------------------
// 纯函数：任意一秒的那一帧
// ------------------------------------------------------------

/**
 * 把某一时刻的整幅画面画到 canvas 上（纯函数）。
 * 跳过靠它落到最后一帧、定帧调试靠它停在某一秒 —— 它不读任何外部状态。
 */
export function renderFrame(g: Ctx, t: number): void {
  const tt = clamp(t, 0, ROADEND_TOTAL)
  g.save()
  g.imageSmoothingEnabled = false

  // 底：比纯黑略冷一点的夜（黑场期间它被下一层盖住，露不出来）
  g.fillStyle = '#04060a'
  g.fillRect(0, 0, ROADEND_W, ROADEND_H)

  const cam = cameraAt(tt)

  if (tt >= TL.black - 0.4) {
    g.save()
    g.translate(cam.x, cam.y)
    paintSky(g, tt)
    if ((window as unknown as { __RE_ONLY_SKY?: boolean }).__RE_ONLY_SKY) {
      g.restore()
      paintVignette(g)
      g.restore()
      return
    }
    // ⑥⑦ 城堡：先画（它在最远的一层），雾再压上去
    const castle = castleAt(tt)
    if (castle) paintCastleSilhouette(g, castle, tt)
    paintHaze(g, tt)
    paintTrail(g, tt)
    paintTrees(g, tt)
    paintGroundFog(g, tt)
    paintRain(g, tt)
    paintFeet(g, tt)
    g.restore()
  }

  paintVignette(g)

  // 黑场：开头与结尾
  const black = blackLevel(tt)
  if (black > 0.002) {
    g.fillStyle = `rgba(3,4,7,${black.toFixed(3)})`
    g.fillRect(0, 0, ROADEND_W, ROADEND_H)
  }

  g.restore()
}
