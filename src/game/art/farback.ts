// ============================================================
// 开场分镜远景：黑森林群山 / 冷杉林 / 铁轨 / 列车剪影 / 雾
// 全部 fillRect 逐像素程序化绘制，零外部素材。
// 色调是"黑"不是"灰"：夜色 C.night，山体近乎黑，雾是半透明 C.mist。
// 远景世界比视口高 CAM_END px：相机下移后山脚与铁轨才露出来。
//
// 两个镜头各用一套铁轨：
//   · 镜头 A（0–11.4s）纵向铁轨：双轨从画面下缘收束到消失点 (192,96)。
//   · 镜头 B（11.9s 后）横向铁轨：列车侧视自左向右驶过。
//   车头迎面用 drawLocoFront()（纯透视缩放），侧视用 drawTrain()。
// ============================================================
import { C } from './tiles'
import { VIEW_W, VIEW_H } from '../constants'

type Ctx = CanvasRenderingContext2D

/** 远景世界高度：比视口多出一截，用来做下移运镜 */
export const WORLD_H = 356
export const CAM_END = WORLD_H - VIEW_H

/** 列车停稳后，取景窗在屏幕上的位置（相机到底、尚未缩放时） */
export const HERO_X = 192
export const HERO_Y = 92

// ---- 列车几何：以「车头右端」为原点向左排 ----
const HEAD_W = 96
const CAR_W = 84
const CAR_GAP = 4
const CARS = 5

// ---- 车厢内窗与车身（世界 y） ----
const CAR_TOP = 216
const CAR_BOT = 262
const WIN_Y = 226
const WIN_W = 12
const WIN_H = 12
const WIN_INSET = 16
const WIN_STEP = 44
const WIN_COUNT = 2

const HERO_CAR = CARS - 1
const HERO_WIN = WIN_COUNT - 1
/** 取景窗中心到车头右端的水平距离 */
const HERO_WIN_OFFSET =
  HEAD_W + HERO_CAR * (CAR_W + CAR_GAP) + CAR_W - (WIN_INSET + HERO_WIN * WIN_STEP) - WIN_W / 2
const TRAIN_LEN = HEAD_W + CARS * (CAR_W + CAR_GAP) - CAR_GAP

// ---- 横向铁轨（世界 y）：镜头 B 侧视用 ----
const RAIL_FAR = 260
const RAIL_NEAR = 271
const BALLAST_TOP = 252
const BALLAST_BOT = 286

// ---- 纵向铁轨（镜头 A）：消失在谷地深处，近端铺到画面下缘 ----
/** 消失点的水平位置（也是车头迎面驶来的轴心） */
export const VP_X = 192
/** 消失点在世界坐标里的 y：相机到底时正好落在屏幕 y=96 */
export const VP_LINE = 236
/** 近端所在世界 y：相机到底（camY=CAM_END）时正好是画面下缘 y=216 */
const TRACK_NEAR_Y = 356
/** 近端半轨距：左轨 150、右轨 234（轨距 84px） */
const HALF_GAUGE = 42
/** 消失点→近端的纵深 */
const TRACK_SPAN = TRACK_NEAR_Y - VP_LINE

// ---- 镜头 B 列车运动：11.9s 从左驶入，13.3s 起减速，14.4s 停稳 ----
const T_DEPART = 11.9
const T_CRUISE_END = 13.3
const T_STOP = 14.4
const X_SPAWN = 120
const X_REST = HERO_X + HERO_WIN_OFFSET

// ---- 镜头 A 迎面车头：6.4s 远处一点 → 10.4s 逼近 → 11.4s 占满画面 ----
const T_FRONT = 6.4
const T_FRONT_HIT = 10.4
const T_COVER = 11.4
/** 车头正面的透视宽度（px）：18 → 380 → 1500 */
const FRONT_W0 = 18
const FRONT_W_HIT = 380
const FRONT_W_MAX = 1500

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function smoothstep(a: number, b: number, v: number): number {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** 确定性伪随机：同一次运行里每次刷新都一样，不会闪 */
function hash(a: number, b = 0): number {
  let x = Math.imul(a * 374761393 + b * 668265263, 1274126177)
  x = (x ^ (x >>> 13)) >>> 0
  x = Math.imul(x, 1103515245) >>> 0
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

function canvas(w = VIEW_W, h = WORLD_H): { c: HTMLCanvasElement; g: Ctx } {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  return { c, g }
}

/** 像素矩形：坐标一律取整，避免半透明边缘毁掉像素感 */
function r(g: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  const x0 = Math.round(x)
  const y0 = Math.round(y)
  const w0 = Math.round(w)
  const h0 = Math.round(h)
  if (w0 <= 0 || h0 <= 0) return
  g.fillStyle = col
  g.fillRect(x0, y0, w0, h0)
}

function px(g: Ctx, x: number, y: number, col: string): void {
  g.fillStyle = col
  g.fillRect(Math.round(x), Math.round(y), 1, 1)
}

/** 逐像素实心圆（车轮、月盘、灯芯） */
function disc(g: Ctx, cx: number, cy: number, rad: number, col: string): void {
  const x0 = Math.round(cx)
  const y0 = Math.round(cy)
  const rr = rad * rad + rad * 0.4
  for (let y = -rad; y <= rad; y++) {
    for (let x = -rad; x <= rad; x++) {
      if (x * x + y * y <= rr) px(g, x0 + x, y0 + y, col)
    }
  }
}

// ============================================================
// 1) 夜空：分段色带 + 极暗星点 + 雾中月（不画成白月，保持剪影调）
// ============================================================
function drawSky(): HTMLCanvasElement {
  const { c, g } = canvas()
  const bands = ['#05060a', '#07090d', '#0a0c11', '#0c0f15', '#0e1117']
  const bandH = 48
  for (let i = 0; i < bands.length; i++) r(g, 0, i * bandH, VIEW_W, bandH + 1, bands[i])

  for (let i = 0; i < 58; i++) {
    const x = Math.floor(hash(i, 1) * VIEW_W)
    const y = Math.floor(hash(i, 2) * 138) + 4
    const a = 0.07 + hash(i, 3) * 0.18
    px(g, x, y, `rgba(154,166,184,${a.toFixed(3)})`)
  }
  // 三颗略亮一点的星，位置固定
  for (const [i, x, y] of [[0, 58, 22], [1, 214, 15], [2, 172, 44]] as const) {
    px(g, x, y, `rgba(154,166,184,${(0.22 + i * 0.06).toFixed(3)})`)
    px(g, x - 1, y, `rgba(154,166,184,${(0.10 + i * 0.04).toFixed(3)})`)
  }

  const mx = 306
  const my = 46
  const mr = 7
  const halo = g.createRadialGradient(mx, my, 3, mx, my, 28)
  halo.addColorStop(0, 'rgba(111,122,140,0.15)')
  halo.addColorStop(1, 'rgba(111,122,140,0)')
  g.fillStyle = halo
  g.fillRect(mx - 30, my - 30, 60, 60)
  disc(g, mx, my, mr, '#151a22')
  disc(g, mx - 1, my - 1, mr - 2, '#1b212a')
  px(g, mx - 2, my + 2, '#151a22')
  px(g, mx + 2, my - 1, '#151a22')
  return c
}

// ============================================================
// 2) 山脊：逐列填充的山体 + 被月光擦亮的山顶边缘
//    最远近乎黑（#0e1116），中景再暗一档（#090c11）
// ============================================================
interface RidgeOpts {
  seed: number
  base: number
  amp: number
  body: string
  rim: string
  /** 山脊线以上的远处林尖颜色 */
  fringe?: string
  /** 月亮方向：只把靠月一侧的山脊擦亮 */
  glowX?: number
}

function ridgeHeight(x: number, o: RidgeOpts): number {
  const n =
    Math.sin((x + o.seed * 41) * 0.0138) * 0.52 +
    Math.sin((x + o.seed * 17) * 0.0311 + 1.9) * 0.3 +
    Math.sin((x + o.seed * 7) * 0.0742 + 0.6) * 0.18
  const jitter = (hash(x, o.seed) - 0.5) * 1.6
  return Math.round(o.base - o.amp * (0.5 + 0.5 * n) + jitter)
}

function drawRidge(o: RidgeOpts): HTMLCanvasElement {
  const { c, g } = canvas()
  const ys = new Array<number>(VIEW_W)
  for (let x = 0; x < VIEW_W; x++) {
    const y = ridgeHeight(x, o)
    ys[x] = y
    r(g, x, y, 1, WORLD_H - y, o.body)
    const lit = o.glowX != null ? Math.max(0.15, 1 - Math.abs(x - o.glowX) / 250) : 1
    if (hash(x, o.seed + 91) < 0.3 + 0.55 * lit) px(g, x, y, o.rim)
  }
  if (o.fringe) {
    for (let x = 1; x < VIEW_W - 1; x += 2) {
      const tip = 1 + Math.floor(hash(x, o.seed + 5) * 3)
      const y = ys[x]
      for (let k = 1; k <= tip; k++) px(g, x, y - k, o.fringe)
    }
  }
  return c
}

// ============================================================
// 3) 中景冷杉林：细高三角剪影，密排成林海
// ============================================================
function fir(g: Ctx, x: number, baseY: number, h: number, w: number, body: string, rim: string): void {
  const tiers = 3
  const th = Math.max(2, Math.round(h / tiers))
  for (let tier = 0; tier < tiers; tier++) {
    const y0 = baseY - h + tier * th
    const ww = Math.max(2, Math.round((w * (tier + 1)) / tiers))
    const rows = tier === tiers - 1 ? th + 2 : th
    for (let row = 0; row < rows; row++) {
      const rw = Math.max(1, Math.round((ww * (row + 1)) / rows))
      const x0 = x - (rw >> 1)
      r(g, x0, y0 + row, rw, 1, body)
      if (hash(x + row * 3, tier) > 0.72) px(g, x0, y0 + row, rim)
    }
    // 层底针叶锯齿
    for (let k = 0; k < ww; k += 2) px(g, x - (ww >> 1) + k, y0 + rows, body)
  }
  px(g, x, baseY - h, rim)
}

function drawForest(): HTMLCanvasElement {
  const { c, g } = canvas()
  const slope = (x: number): number =>
    178 + Math.round(8 * Math.sin(x * 0.0105 + 0.8) + 5 * Math.sin(x * 0.0271 + 2.3))

  for (let x = 0; x < VIEW_W; x++) r(g, x, slope(x), 1, WORLD_H - slope(x), '#070c09')

  // 远处林海（小、暗）
  for (let x = -3; x < VIEW_W + 3; x += 6) {
    const h = 9 + Math.floor(hash(x, 21) * 8)
    fir(g, x + Math.floor(hash(x, 22) * 5), slope(x) + 2, h, 9, '#0a120d', '#16211a')
  }
  // 中排
  for (let x = -3; x < VIEW_W + 3; x += 7) {
    const h = 16 + Math.floor(hash(x, 31) * 12)
    fir(g, x + Math.floor(hash(x, 32) * 5), slope(x) + 17, h, 13, '#08100b', '#121c14')
  }
  // 近排（更高，压住山脚）
  for (let x = -5; x < VIEW_W + 5; x += 9) {
    const h = 24 + Math.floor(hash(x, 41) * 16)
    fir(g, x + Math.floor(hash(x, 42) * 6), slope(x) + 38, h, 18, '#060b08', '#0d1610')
  }
  return c
}

// ============================================================
// 4a) 谷地底色：山脚下的草甸（两条铁轨共用同一块地）
// ============================================================
function paintValley(g: Ctx): void {
  for (let x = 0; x < VIEW_W; x++) {
    const y = 234 + Math.round(4 * Math.sin(x * 0.021 + 1.2))
    r(g, x, y, 1, WORLD_H - y, '#040605')
  }
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(hash(i, 51) * VIEW_W)
    const y = 236 + Math.floor(hash(i, 52) * 24)
    px(g, x, y, hash(i, 53) > 0.6 ? '#0a100c' : '#070c09')
  }
}

// ============================================================
// 4b) 横向铁轨：镜头 B 侧视用（双轨横贯画面，列车从左驶过）
// ============================================================
function drawRailSide(): HTMLCanvasElement {
  const { c, g } = canvas()

  paintValley(g)

  // 道砟：比夜还暗一档，只靠极稀疏的碎石点读出质地
  r(g, 0, BALLAST_TOP, VIEW_W, BALLAST_BOT - BALLAST_TOP, '#070a0d')
  for (let i = 0; i < 460; i++) {
    const x = Math.floor(hash(i, 61) * VIEW_W)
    const y = BALLAST_TOP + 1 + Math.floor(hash(i, 62) * (BALLAST_BOT - BALLAST_TOP - 2))
    px(g, x, y, hash(i, 63) > 0.9 ? C.graphite : C.shadow)
  }
  r(g, 0, BALLAST_TOP, VIEW_W, 1, '#050709')
  r(g, 0, BALLAST_BOT - 1, VIEW_W, 2, '#040605')

  // 枕木（竖向，每 12px 一根，压到几乎看不见）
  for (let x = -6; x < VIEW_W + 6; x += 12) {
    const o = Math.floor(hash(x, 71) * 3)
    r(g, x + o, 255, 5, 28, '#0a0703')
    r(g, x + o, 255, 5, 1, '#110d05')
    r(g, x + o + 4, 256, 1, 27, '#060401')
  }

  // 双轨：暗轨身 + 短短的月光反光（不做成贯穿的灰线）
  r(g, 0, RAIL_FAR - 1, VIEW_W, 1, '#10141a')
  r(g, 0, RAIL_FAR, VIEW_W, 2, '#1f252d')
  r(g, 0, RAIL_FAR + 1, VIEW_W, 1, '#0d1116')
  r(g, 0, RAIL_NEAR - 1, VIEW_W, 1, '#12171d')
  r(g, 0, RAIL_NEAR, VIEW_W, 2, '#232932')
  r(g, 0, RAIL_NEAR + 1, VIEW_W, 1, '#0e1217')

  for (let x = -10; x < VIEW_W; x += 56) {
    const len = 4 + Math.floor(hash(x, 81) * 7)
    r(g, x, RAIL_FAR, len, 1, '#2c333d')
    r(g, x + 20, RAIL_NEAR, len, 1, '#303843')
    px(g, x + 2, RAIL_FAR, '#4d5665')
    px(g, x + 22, RAIL_NEAR, '#4d5665')
    px(g, x + len - 2, RAIL_NEAR, '#3a424e')
  }
  for (let x = 4; x < VIEW_W; x += 60) {
    px(g, x, RAIL_FAR - 2, '#3a321c')
    px(g, x + 24, RAIL_NEAR - 2, '#3a321c')
  }
  r(g, 0, RAIL_FAR + 2, VIEW_W, 1, '#05070a')
  r(g, 0, RAIL_NEAR + 2, VIEW_W, 1, '#05070a')
  return c
}

// ============================================================
// 4c) 纵向铁轨：镜头 A 用。两条钢轨从画面下缘向谷地深处收束于一点。
//     透视：r = (世界 y - VP_LINE) / TRACK_SPAN 是「由远及近」的进深比；
//     半轨距 = HALF_GAUGE * r，道砟/枕木同比例变窄；
//     枕木按纵深等距排列（dz 等差）→ r = 1/(1+n·k)，越远越密。
// ============================================================
function drawRailVertical(): HTMLCanvasElement {
  const { c, g } = canvas()

  paintValley(g)

  // ---- 道砟带：逐行梯形，近端宽、远端收成一条线 ----
  for (let y = VP_LINE + 1; y <= TRACK_NEAR_Y; y++) {
    const rr = (y - VP_LINE) / TRACK_SPAN
    const hw = Math.round(66 * rr)
    if (hw <= 0) continue
    r(g, VP_X - hw, y, hw * 2 + 1, 1, '#070a0d')
    // 路肩：两侧各压一针更暗的边
    r(g, VP_X - hw, y, 1, 1, '#050709')
    r(g, VP_X + hw, y, 1, 1, '#050709')
  }
  // 道砟碎石：按 √rand 取样，天然近处多、远处少
  for (let i = 0; i < 620; i++) {
    const rr = Math.sqrt(hash(i, 61))
    const y = Math.round(VP_LINE + rr * TRACK_SPAN)
    const x = Math.round(VP_X + (hash(i, 62) - 0.5) * 2 * 64 * rr)
    px(g, x, y, hash(i, 63) > 0.92 ? C.graphite : C.shadow)
  }

  // ---- 枕木：dz 等距 → r = 1/(1+n·k)，逐根变窄变密 ----
  let lastY = TRACK_NEAR_Y + 8
  for (let n = 0; n < 64; n++) {
    const rr = 1 / (1 + n * 0.135)
    if (rr < 0.115) break
    const y = Math.round(VP_LINE + rr * TRACK_SPAN)
    if (y >= lastY) continue
    lastY = y
    const hw = Math.round((HALF_GAUGE + 22) * rr)
    const th = Math.max(1, Math.round(5 * rr))
    const fade = rr < 0.18 ? 0.45 : 1
    const prev = g.globalAlpha
    g.globalAlpha = prev * fade
    r(g, VP_X - hw, y - th + 1, hw * 2 + 1, th, '#0a0703')
    r(g, VP_X - hw, y - th + 1, hw * 2 + 1, 1, '#110d05')
    if (rr > 0.3) r(g, VP_X + hw - 2, y - th + 1, 2, th, '#060401')
    g.globalAlpha = prev
  }

  // ---- 双轨：逐行按透视收窄，暗轨身 + 断续的月光轨面 ----
  for (let y = VP_LINE + 1; y <= TRACK_NEAR_Y; y++) {
    const rr = (y - VP_LINE) / TRACK_SPAN
    const gap = Math.round(HALF_GAUGE * rr)
    const rw = Math.max(1, Math.round(3 * rr))
    for (const side of [-1, 1]) {
      const xc = VP_X + side * gap
      // 轨身（比轨面宽 1px，压出边缘）
      r(g, xc - rw - 1, y, rw + 2, 1, '#0d1116')
      // 轨面：每 13 行一段月光，近处更亮
      const lit = hash(y, 81) > 0.55 || (y % 13 < 2)
      r(g, xc - rw, y, rw, 1, lit ? '#2c333d' : '#1f252d')
      if (lit && rr > 0.55) px(g, xc, y, '#4d5665')
    }
  }
  // 轨枕扣件：近端几处黄铜色小点
  for (let n = 0; n < 14; n++) {
    const rr = 1 / (1 + n * 0.135)
    const y = Math.round(VP_LINE + rr * TRACK_SPAN)
    const gap = Math.round(HALF_GAUGE * rr)
    if (rr < 0.5) continue
    for (const side of [-1, 1]) px(g, VP_X + side * gap + 2, y, '#3a321c')
  }

  // 消失点：远处聚成一点，落在雾里
  r(g, VP_X - 2, VP_LINE - 1, 5, 2, '#05070a')
  px(g, VP_X, VP_LINE, 'rgba(154,166,184,0.10)')
  px(g, VP_X - 1, VP_LINE + 1, 'rgba(154,166,184,0.06)')

  return c
}

// ============================================================
// 5) 近景：左右两侧的暗坡与低矮冷杉
//    中间是铁轨走廊：坡顶凹到画面下缘以外，纵向铁轨才不会被挡住。
// ============================================================
function drawNear(): HTMLCanvasElement {
  const { c, g } = canvas()

  for (let x = 0; x < VIEW_W; x++) {
    const d = Math.abs(x - (VIEW_W >> 1))
    const t = clamp01((d - 70) / 78)
    const e = t * t * (3 - 2 * t)
    const wob = 6 * Math.sin(x * 0.011 + 2.4) + 3 * Math.sin(x * 0.037 + 1.1)
    const y = Math.min(WORLD_H, Math.round(356 - e * 58 + wob * e))
    r(g, x, y, 1, WORLD_H - y, '#050607')
    if (e > 0.06) px(g, x, y, '#0a100c')
  }

  // 左右下角的低矮冷杉：不进入画面中心，免得挡住铁轨与定格的车窗
  const firs: [number, number, number][] = [
    [14, 54, 340],
    [46, 38, 352],
    [354, 50, 342],
    [320, 34, 352],
  ]
  for (const [x, h, baseY] of firs) fir(g, x, baseY, h, h * 0.62, '#04070a', '#09100b')

  // 枯草与碎石（只在有坡的一侧）
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(hash(i, 121) * VIEW_W)
    const y = 306 + Math.floor(hash(i, 122) * 44)
    if (Math.abs(x - (VIEW_W >> 1)) < 86) continue
    if (hash(i, 123) < 0.35) continue
    px(g, x, y, hash(i, 124) > 0.5 ? '#0c130e' : '#090e0a')
  }
  return c
}

// ============================================================
// 6) 雾：可横向循环的雾片（半透明 C.mist，低频噪声，滚动无接缝）
// ============================================================
const MIST_W = 512
const MIST_H = 96

function drawMistSheet(): HTMLCanvasElement {
  const { c, g } = canvas(MIST_W, MIST_H)
  for (let y = 0; y < MIST_H; y += 2) {
    const ey = 1 - Math.abs((y - MIST_H * 0.5) / (MIST_H * 0.5))
    const env = Math.pow(Math.max(0, ey), 1.5)
    if (env <= 0.02) continue
    for (let x = 0; x < MIST_W; x += 2) {
      const n =
        0.5 +
        0.24 * Math.sin((x / MIST_W) * Math.PI * 2 * 3 + y * 0.05) +
        0.14 * Math.sin((x / MIST_W) * Math.PI * 2 * 7 - y * 0.03) +
        0.1 * Math.sin((x / MIST_W) * Math.PI * 2 * 13 + y * 0.11 + 1.7) +
        0.07 * hash(x, y)
      const a = env * Math.max(0, n - 0.28) * 0.5
      if (a < 0.014) continue
      g.fillStyle = n > 0.66
        ? `rgba(154,166,184,${a.toFixed(3)})`
        : `rgba(111,122,140,${a.toFixed(3)})`
      g.fillRect(x, y, 2, 2)
    }
  }
  return c
}

// ============================================================
// 7) 暗角：定格取景用（中心在取景窗，2×2 像素块，一次生成）
// ============================================================
function drawVignetteSheet(): HTMLCanvasElement {
  const { c, g } = canvas(VIEW_W, VIEW_H)
  const step = 2
  for (let y = 0; y < VIEW_H; y += step) {
    for (let x = 0; x < VIEW_W; x += step) {
      const dx = (x + 1 - HERO_X) / (VIEW_W * 0.34)
      const dy = (y + 1 - HERO_Y) / (VIEW_H * 0.38)
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy))
      const a = Math.pow(d, 1.7) * 0.95
      if (a < 0.015) continue
      g.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`
      g.fillRect(x, y, step, step)
    }
  }
  return c
}

// ============================================================
// 图层缓存
// ============================================================
export interface FarLayers {
  sky: HTMLCanvasElement
  ridgeFar: HTMLCanvasElement
  ridgeMid: HTMLCanvasElement
  forest: HTMLCanvasElement
  /** 横向铁轨（镜头 B 侧视） */
  rail: HTMLCanvasElement
  /** 纵向铁轨（镜头 A 迎面），消失在 VP_LINE */
  railV: HTMLCanvasElement
  near: HTMLCanvasElement
  mist: HTMLCanvasElement
  vignette: HTMLCanvasElement
}

let cached: FarLayers | null = null

export function farLayers(): FarLayers {
  if (cached) return cached
  cached = {
    sky: drawSky(),
    ridgeFar: drawRidge({
      seed: 3, base: 150, amp: 66, body: '#10141a', rim: '#232b37', glowX: 306,
    }),
    ridgeMid: drawRidge({
      seed: 11, base: 188, amp: 42, body: '#080b0f', rim: '#171e28',
      fringe: '#0b120d', glowX: 306,
    }),
    forest: drawForest(),
    rail: drawRailSide(),
    railV: drawRailVertical(),
    near: drawNear(),
    mist: drawMistSheet(),
    vignette: drawVignetteSheet(),
  }
  return cached
}

// ============================================================
// 列车
// ============================================================
/** 车头右端的世界 x（也是屏幕 x：画面不横向滚动） */
export function trainHeadX(t: number): number {
  if (t <= T_DEPART) return X_SPAWN
  if (t >= T_STOP) return X_REST
  // 先匀速、再匀减速停稳；速度由总位移反推，取景窗最终正好停在 HERO_X
  const dist = X_REST - X_SPAWN
  const cruiseT = T_CRUISE_END - T_DEPART
  const decelT = T_STOP - T_CRUISE_END
  const v = dist / (cruiseT + decelT / 2)
  if (t <= T_CRUISE_END) return X_SPAWN + v * (t - T_DEPART)
  const tau = t - T_CRUISE_END
  return X_SPAWN + v * cruiseT + v * tau - 0.5 * (v / decelT) * tau * tau
}

/** 一节车厢的窗：亮起由它进入画面的位置决定，逐扇亮 */
function drawCarWindow(g: Ctx, wx: number, wy: number, k: number): void {
  r(g, wx, wy, WIN_W, WIN_H, '#0d1015')
  if (k > 0.01) {
    const prev = g.globalAlpha
    g.globalAlpha = prev * k
    r(g, wx, wy, WIN_W, 3, C.brass)
    r(g, wx, wy + 3, WIN_W, WIN_H - 3, C.gold)
    r(g, wx + 1, wy + WIN_H - 4, WIN_W - 2, 1, C.brass)
    px(g, wx + 1, wy + 1, C.sugar)
    // 光晕：窗外一圈暖色，只有很淡
    g.globalAlpha = prev * k * 0.4
    g.fillStyle = 'rgb(200,160,64)'
    g.fillRect(wx - 1, wy, 1, WIN_H)
    g.fillRect(wx + WIN_W, wy, 1, WIN_H)
    g.fillRect(wx, wy - 1, WIN_W, 1)
    g.fillRect(wx, wy + WIN_H, WIN_W, 1)
    g.globalAlpha = prev
  }
  // 窗框
  r(g, wx, wy, WIN_W, 1, '#11151b')
  r(g, wx, wy + WIN_H - 1, WIN_W, 1, '#11151b')
  r(g, wx, wy, 1, WIN_H, '#11151b')
  r(g, wx + WIN_W - 1, wy, 1, WIN_H, '#11151b')
  r(g, wx + 5, wy, 1, WIN_H, '#11151b')
}

function drawCar(g: Ctx, x: number, sy: number, c: number): void {
  const top = CAR_TOP + sy
  const bot = CAR_BOT + sy
  // 车体：剪影，只有顶边与左缘有一线冷光
  r(g, x, top, CAR_W, bot - top, '#090b0e')
  r(g, x, top, CAR_W, 1, '#151a20')
  r(g, x, top, 1, bot - top, '#101419')
  r(g, x + CAR_W - 1, top, 1, bot - top, '#07090c')
  // 车顶弧
  r(g, x + 4, top - 2, CAR_W - 8, 2, '#0b0e12')
  r(g, x + 2, top - 1, 2, 1, '#0b0e12')
  r(g, x + CAR_W - 4, top - 1, 2, 1, '#0b0e12')
  r(g, x + 18, top - 4, 6, 2, '#0c1015')
  r(g, x + 52, top - 4, 8, 2, '#0c1015')
  // 底架
  r(g, x, bot - 3, CAR_W, 3, '#05070a')
  // 腰线
  r(g, x + 2, 246 + sy, CAR_W - 4, 1, '#0e1217')
  // 车窗：逐扇亮起
  for (let i = 0; i < WIN_COUNT; i++) {
    const wx = x + WIN_INSET + i * WIN_STEP
    const wy = WIN_Y + sy
    const jitter = hash(c * 17 + i * 29, 3) * 0.22
    const k = smoothstep(0, 1, clamp01((wx + 26) / 50 - jitter))
    drawCarWindow(g, wx, wy, k)
  }
  // 车门
  r(g, x + CAR_W - 15, 222 + sy, 10, 37, '#070a0d')
  r(g, x + CAR_W - 15, 222 + sy, 1, 37, '#11161c')
  r(g, x, bot + 1, CAR_W, 1, '#040608')
  // 连接处
  r(g, x + CAR_W, bot - 6, CAR_GAP, 3, '#05070a')
  // 车轮
  disc(g, x + 16, bot + 2, 4, '#05070a')
  disc(g, x + 40, bot + 2, 4, '#05070a')
  disc(g, x + 68, bot + 2, 4, '#05070a')
  px(g, x + 15, bot - 1, '#0d1116')
  px(g, x + 39, bot - 1, '#0d1116')
  px(g, x + 67, bot - 1, '#0d1116')
}

function drawLoco(g: Ctx, xh: number, sy: number, t: number): void {
  // 动轮（几乎全黑，只在顶部留一针冷光）
  const wheels: [number, number, number][] = [
    [xh - 18, 264, 6],
    [xh - 36, 266, 5],
    [xh - 52, 266, 5],
    [xh - 68, 266, 5],
  ]
  for (const [wx, wy, wr] of wheels) {
    disc(g, wx, wy + sy, wr, '#05070a')
    px(g, wx, wy + sy - wr, '#141a20')
    px(g, wx - 1, wy + sy - wr + 1, '#0e1217')
  }
  // 底架
  r(g, xh - 84, 254 + sy, 84, 6, '#05070a')
  // 锅炉
  r(g, xh - 84, 226 + sy, 62, 32, '#0a0d11')
  r(g, xh - 84, 226 + sy, 62, 1, '#151b22')
  r(g, xh - 84, 226 + sy, 1, 32, '#10151a')
  r(g, xh - 84, 254 + sy, 62, 1, '#070a0d')
  // 汽包
  r(g, xh - 72, 220 + sy, 12, 7, '#0c1015')
  r(g, xh - 72, 220 + sy, 12, 1, '#161c23')
  r(g, xh - 46, 222 + sy, 8, 5, '#0c1015')
  // 烟囱
  r(g, xh - 79, 206 + sy, 12, 21, '#080b0e')
  r(g, xh - 79, 206 + sy, 12, 1, '#12171d')
  r(g, xh - 81, 204 + sy, 16, 3, '#0a0e12')
  r(g, xh - 81, 204 + sy, 16, 1, '#141a20')
  r(g, xh - 77, 207 + sy, 8, 1, '#05070a')
  // 驾驶室
  r(g, xh - 22, 214 + sy, 22, 44, '#090c10')
  r(g, xh - 24, 212 + sy, 26, 3, '#0d1116')
  r(g, xh - 22, 214 + sy, 22, 1, '#151a21')
  r(g, xh - 22, 214 + sy, 1, 44, '#11161c')
  r(g, xh - 18, 220 + sy, 9, 7, '#11161c')
  r(g, xh - 17, 221 + sy, 7, 5, '#0a0d11')
  // 排障器
  g.fillStyle = '#06080b'
  g.beginPath()
  g.moveTo(xh - 2, 254 + sy)
  g.lineTo(xh + 13, 268 + sy)
  g.lineTo(xh + 13, 276 + sy)
  g.lineTo(xh - 2, 262 + sy)
  g.closePath()
  g.fill()
  // 车钩
  r(g, xh - 4, 250 + sy, 6, 3, '#0b0f13')
  // 车头灯：灯箱 + 灯玻璃 + 被雾散射的前照光
  r(g, xh - 11, 233 + sy, 9, 11, '#0c1014')
  r(g, xh - 10, 234 + sy, 7, 9, C.brass)
  r(g, xh - 10, 235 + sy, 7, 6, C.gold)
  px(g, xh - 9, 236 + sy, C.sugar)
  px(g, xh - 8, 236 + sy, C.sugar)
  const lx = xh - 6
  const ly = 239 + sy
  const glow = g.createRadialGradient(lx, ly, 2, lx, ly, 34)
  glow.addColorStop(0, 'rgba(232,176,88,0.22)')
  glow.addColorStop(0.45, 'rgba(232,176,88,0.06)')
  glow.addColorStop(1, 'rgba(232,176,88,0)')
  g.fillStyle = glow
  g.fillRect(lx - 36, ly - 36, 72, 72)
  drawSteam(g, xh, sy, t)
}

/** 车头烟囱冒出的蒸汽：一团团向后上方飘散 */
function drawSteam(g: Ctx, xh: number, sy: number, t: number): void {
  const prev = g.globalAlpha
  const stack = xh - 73
  for (let i = 0; i < 44; i++) {
    const phase = (t * 0.62 + i / 44) % 1
    const drift = phase * 38
    const sx = stack - drift - 3 * Math.sin(phase * 5.5 + i * 1.7)
    const sy2 = 203 + sy - phase * 26 - 5 * Math.sin(phase * 3 + i)
    const rad = Math.max(1, Math.round(1.5 + phase * 3.5))
    const a = (1 - phase) * (1 - phase) * 0.13
    if (a < 0.006) continue
    g.globalAlpha = prev * a
    disc(g, sx, sy2, rad, 'rgb(126,136,152)')
    if (i % 4 === 0) {
      g.globalAlpha = prev * Math.min(1, a * 1.2)
      disc(g, sx, sy2, Math.max(1, rad - 1), 'rgb(154,166,184)')
    }
  }
  g.globalAlpha = prev
}

export function drawTrain(g: Ctx, t: number, camY: number): void {
  if (t < T_DEPART) return
  const xh = trainHeadX(t)
  if (xh - TRAIN_LEN > VIEW_W + 8) return
  const sy = -camY
  for (let c = CARS - 1; c >= 0; c--) {
    drawCar(g, xh - HEAD_W - c * (CAR_W + CAR_GAP) - CAR_W, sy, c)
  }
  drawLoco(g, xh, sy, t)
}

// ============================================================
// 8) 正面车头（镜头 A）：沿纵向铁轨迎面驶来。
//    不是横移，而是纯透视缩放：正面宽度 w 按指数增长（近似匀速接近），
//    圆盘 / 车灯 / 排障器 / 动轮 / 蒸汽全部按 w/100 等比放大。
//    所有部件都是逐行 fillRect，并且裁剪到视口（贴脸时也只有 216 行）。
// ============================================================

/** 逐行椭圆：每行只发一次 fillRect，天然的像素阶梯；y 轴裁到视口 */
function ellRows(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  row: (y: number, hw: number) => void,
): void {
  if (rx < 0.5 || ry < 0.5) return
  const y0 = Math.max(0, Math.ceil(cy - ry))
  const y1 = Math.min(VIEW_H - 1, Math.floor(cy + ry))
  for (let y = y0; y <= y1; y++) {
    const dy = (y - cy) / ry
    const s = 1 - dy * dy
    if (s <= 0) continue
    row(y, Math.round(rx * Math.sqrt(s)))
  }
}

/** 车头正面宽度（px）：6.4s 18 → 10.4s 380 → 11.4s 1500（溢出画面） */
export function frontWidth(t: number): number {
  if (t < T_FRONT) return 0
  const k = Math.log(FRONT_W_MAX / FRONT_W0)
  const hit = Math.log(FRONT_W_HIT / FRONT_W0) / k
  if (t < T_FRONT_HIT) {
    const p = (t - T_FRONT) / (T_FRONT_HIT - T_FRONT)
    return FRONT_W0 * Math.exp(k * hit * p)
  }
  const q = clamp01((t - T_FRONT_HIT) / (T_COVER - T_FRONT_HIT))
  return FRONT_W0 * Math.exp(k * (hit + (1 - hit) * Math.pow(q, 0.7)))
}

/** 车头灯中心的屏幕 y。贴脸时固定住它，灯不会被推出画面 */
function frontLampY(t: number): number {
  if (t < T_FRONT_HIT) return 58.8
  return 58.8 + 37.2 * smoothstep(T_FRONT_HIT, T_COVER, t)
}

/** 车头几何中心 y：从消失点 96 缓慢下移到 150，贴脸后继续下压以留住车灯 */
export function frontCenterY(t: number): number {
  if (t < T_FRONT_HIT) return 96 + 54 * smoothstep(T_FRONT, T_FRONT_HIT, t)
  return frontLampY(t) + 0.24 * frontWidth(t)
}

/** 烟囱口的蒸汽：正面看是两股向上翻的白气（烟囱贴近画面上缘时交给画面外的烟） */
function drawSteamFront(g: Ctx, cx: number, cy: number, u: number, t: number): void {
  const top = cy - 58 * u
  if (top < 56 || top > VIEW_H + 10) return
  const prev = g.globalAlpha
  for (let i = 0; i < 26; i++) {
    const phase = (t * 0.55 + i / 26) % 1
    const rise = phase * 36 * u
    const side = i % 2 === 0 ? -1 : 1
    const sx = cx + side * (4 + phase * 20) * u + Math.sin(phase * 5.5 + i * 1.7) * 4 * u
    const sy = top - rise
    const rad = Math.max(1, (1.2 + phase * 3.2) * u)
    const a = (1 - phase) * (1 - phase) * 0.17
    if (a < 0.006) continue
    if (sy + rad < 0 || sy - rad > VIEW_H) continue
    g.globalAlpha = prev * a
    ellRows(sx, sy, rad, rad, (y, hw) => r(g, sx - hw, y, hw * 2 + 1, 1, '#7e8898'))
    // 错位叠一层更淡的，让烟团边缘毛一点，不是一串等大的圆点
    if (phase < 0.55) {
      g.globalAlpha = prev * a * 0.55
      ellRows(sx + 2 * u, sy - 2 * u, rad * 1.4, rad * 1.25, (y, hw) =>
        r(g, sx + 2 * u - hw, y, hw * 2 + 1, 1, '#9aa6b8'),
      )
    }
  }
  g.globalAlpha = prev
}

export function drawLocoFront(g: Ctx, t: number): void {
  if (t < T_FRONT) return
  const w = frontWidth(t)
  if (w < 2) return
  const u = w / 100
  // 铁轨颠簸：远处几乎不抖，贴脸时也只有 ±1px
  const wob = Math.round(Math.sin(t * 19) * Math.min(1, u * 0.6))
  const cx = VP_X + wob
  const cy = frontCenterY(t)
  const ly = t < T_FRONT_HIT ? cy - 24 * u : frontLampY(t)
  const diskCy = cy - 1 * u
  const diskR = 42 * u

  // ---- 烟囱：正面是一根粗短的筒子，被圆盘压住下半 ----
  {
    const top = cy - 58 * u
    const bot = cy - 34 * u
    const hw = 9 * u
    if (bot > 0 && top < VIEW_H) {
      r(g, cx - hw, top, hw * 2, bot - top, '#080b0e')
      r(g, cx - hw, top, hw * 2, Math.max(1, Math.round(1.4 * u)), '#12171d')
      r(g, cx - hw, top, Math.max(1, Math.round(1.2 * u)), bot - top, '#0d1116')
      ellRows(cx, top, hw + 3 * u, 3 * u, (y, ehw) => {
        r(g, cx - ehw, y, ehw * 2 + 1, 1, y < top ? '#141a20' : '#06080b')
      })
    }
  }

  // ---- 两侧动轮：正面只看得到车体两边的轮缘与辐条 ----
  {
    const wR = 11 * u
    const wy = cy + 39 * u
    if (wy + wR > 0 && wy - wR < VIEW_H) {
      for (const side of [-1, 1]) {
        const wx = cx + side * 45 * u
        ellRows(wx, wy, wR, wR, (y, hw) => r(g, wx - hw, y, hw * 2 + 1, 1, '#05070a'))
        // 上半圈的轮缘冷光
        ellRows(wx, wy, wR, wR, (y, hw) => {
          if (y > wy + wR * 0.15) return
          px(g, wx - hw, y, '#141a20')
          if (hw > 2) px(g, wx - hw + 1, y, '#0e1217')
        })
        // 辐条随车转动
        const a0 = t * 5.4
        for (let k = 0; k < 3; k++) {
          const a = a0 + (k * Math.PI * 2) / 3
          for (let s = 0.3; s < 0.95; s += 0.22) {
            const sx = wx + Math.cos(a) * wR * s
            const sy2 = wy + Math.sin(a) * wR * s
            const sz = Math.max(1, Math.round(1.5 * u))
            r(g, Math.round(sx - sz / 2), Math.round(sy2 - sz / 2), sz, sz, '#141a20')
          }
        }
      }
    }
  }

  // ---- 车架 / 缓冲梁 ----
  {
    const y0 = cy + 40 * u
    const hh = 8 * u
    if (y0 < VIEW_H && y0 + hh > 0) {
      r(g, cx - 49 * u, y0, 98 * u, hh, '#05070a')
      r(g, cx - 49 * u, y0, 98 * u, Math.max(1, Math.round(1.2 * u)), '#0d1116')
    }
  }

  // ---- 排障器：向下张开的梯形 + 栅条 ----
  {
    const top = cy + 45 * u
    const bot = cy + 64 * u
    const hgt = bot - top
    if (hgt > 0.5 && top < VIEW_H && bot > 0) {
      const ys = Math.max(0, Math.ceil(top))
      const ye = Math.min(VIEW_H - 1, Math.floor(bot))
      for (let y = ys; y <= ye; y++) {
        const q = (y - top) / hgt
        const hw = (38 + 20 * q) * u
        r(g, cx - hw, y, hw * 2, 1, '#06080b')
        // 两侧斜边：一线冷光把三角形的轮廓拉出来
        px(g, Math.round(cx - hw), y, '#10161d')
        px(g, Math.round(cx + hw), y, '#0a0e13')
      }
      const sn = Math.max(1, Math.round(1.2 * u))
      for (let k = -2; k <= 2; k++) {
        const x0 = cx + k * 16 * u
        const qa = Math.abs(k) / 2
        const yTop = top + qa * 7 * u
        const yBot = bot - qa * 11 * u
        r(g, x0 - sn / 2, yTop, sn, yBot - yTop, '#0e1319')
      }
      const th = Math.max(1, Math.round(1.4 * u))
      r(g, cx - 58 * u, bot - th, 116 * u, th, '#0a0e12')
    }
  }

  // ---- 锅炉前脸：上亮下暗的金属弧面 ----
  if (diskCy + diskR > 0 && diskCy - diskR < VIEW_H) {
    ellRows(cx, diskCy, diskR, diskR, (y, hw) => {
      const dy = (y - diskCy) / diskR
      const body =
        dy < -0.5 ? '#1a222b' : dy < -0.05 ? '#121820' : dy < 0.45 ? '#0d1218' : '#090d11'
      r(g, cx - hw, y, hw * 2 + 1, 1, body)
      if (hw > 1) {
        const rim = Math.max(1, Math.round(1.7 * u))
        r(g, cx - hw, y, rim, 1, '#28323e')
        r(g, cx + hw - Math.max(1, Math.round(0.9 * u)), y, Math.max(1, Math.round(1.1 * u)), 1, '#070a0d')
      }
    })
  }

  // ---- 前脸加强筋：一圈内环（贴脸时也留，作为锅炉的圆形读点）----
  {
    const ringR = 26 * u
    const ringW = Math.max(1, Math.round(2.2 * u))
    ellRows(cx, diskCy, ringR, ringR, (y, hw) => {
      r(g, cx - hw, y, ringW, 1, '#2a3440')
      r(g, cx + hw - ringW, y, ringW, 1, '#2a3440')
      // 环内侧压一针暗边，避免大尺寸时看起来像白描
      r(g, cx - hw + ringW, y, Math.max(1, Math.round(0.8 * u)), 1, '#080b0f')
      r(g, cx + hw - ringW - Math.max(1, Math.round(0.8 * u)), y, Math.max(1, Math.round(0.8 * u)), 1, '#080b0f')
    })
  }

  // ---- 放射短筋 + 边缘铆钉：只在还没贴脸时出现（贴脸会放大成色块）----
  if (w < 540) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.39
      for (let s = 0.62; s < 0.96; s += 0.03) {
        const sx = cx + Math.cos(a) * diskR * s
        const sy2 = diskCy + Math.sin(a) * diskR * s
        if (sy2 < 0 || sy2 > VIEW_H) continue
        const sz = Math.max(1, Math.round(1.0 * u))
        r(g, Math.round(sx - sz / 2), Math.round(sy2 - sz / 2), sz, sz, '#1b232d')
      }
    }
    const studs = 22
    const sz2 = Math.max(1, Math.round(1.2 * u))
    for (let i = 0; i < studs; i++) {
      const a = (i / studs) * Math.PI * 2 - 0.4
      const sy2 = diskCy + Math.sin(a) * 35 * u
      if (sy2 < -2 || sy2 > VIEW_H + 2) continue
      const sx = cx + Math.cos(a) * 35 * u
      r(g, Math.round(sx - sz2 / 2), Math.round(sy2 - sz2 / 2), sz2, sz2, '#2f3946')
    }
  }

  // ---- 前脸检修门 ----
  {
    const doorR = 16 * u
    const doorCy = diskCy + 3 * u
    if (doorCy + doorR > 0 && doorCy - doorR < VIEW_H) {
      ellRows(cx, doorCy, doorR + 2 * u, doorR + 2 * u, (y, hw) => {
        r(g, cx - hw, y, hw * 2 + 1, 1, '#1c242d')
      })
      ellRows(cx, doorCy, doorR, doorR, (y, hw) => {
        r(g, cx - hw, y, hw * 2 + 1, 1, '#0c1117')
      })
      const barH = Math.max(1, Math.round(1.4 * u))
      r(g, cx - doorR * 0.7, doorCy - 1 * u, doorR * 1.4, barH, '#2a3440')
      r(g, cx - doorR * 0.7, doorCy + 4 * u, doorR * 1.4, barH, '#1e2731')
      // 铰链
      r(g, cx + doorR * 0.78, doorCy - doorR * 0.55, Math.max(1, Math.round(1.2 * u)), doorR * 0.5, '#2a3440')
      r(g, cx + doorR * 0.78, doorCy + doorR * 0.1, Math.max(1, Math.round(1.2 * u)), doorR * 0.5, '#2a3440')
    }
  }

  // ---- 前脸两侧的扶手 ----
  {
    const bw = Math.max(1, Math.round(1.3 * u))
    for (const side of [-1, 1]) {
      const x0 = cx + side * 44 * u
      r(g, x0, cy - 4 * u, bw, 44 * u, '#232b36')
      r(g, x0, cy - 4 * u, bw + 1, 3 * u, '#35404d')
    }
  }

  // ---- 车头灯的白光：中心过曝，向外快速衰减 ----
  {
    const boost = 0.5 + 0.5 * clamp01((w - 20) / 260)
    const haloR = Math.max(26, 0.38 * w)
    const grad = g.createRadialGradient(cx, ly, 1, cx, ly, haloR)
    grad.addColorStop(0, `rgba(255,252,246,${(0.95 * boost).toFixed(3)})`)
    grad.addColorStop(0.07, `rgba(253,246,230,${(0.8 * boost).toFixed(3)})`)
    grad.addColorStop(0.2, `rgba(232,192,120,${(0.35 * boost).toFixed(3)})`)
    grad.addColorStop(0.45, `rgba(190,150,90,${(0.1 * boost).toFixed(3)})`)
    grad.addColorStop(1, 'rgba(120,96,48,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, VIEW_W, VIEW_H)
  }

  // ---- 车头灯：远处是铜圈金玻璃；贴脸时过曝成一团白光 ----
  {
    const lampR = Math.max(1.2, 8.6 * u)
    const over = clamp01((w - 420) / 300) // 0 → 1：灯被自身的亮度吃掉
    if (ly > -lampR * 2 && ly < VIEW_H + lampR * 2) {
      if (over < 0.9) {
        ellRows(cx, ly, lampR + 0.9 * u, lampR + 0.9 * u, (y, hw) => {
          r(g, cx - hw, y, hw * 2 + 1, 1, '#0c1014')
        })
        ellRows(cx, ly, lampR + 0.4 * u, lampR + 0.4 * u, (y, hw) => {
          r(g, cx - hw, y, hw * 2 + 1, 1, C.brass)
        })
        ellRows(cx, ly, lampR, lampR, (y, hw) => {
          r(g, cx - hw, y, hw * 2 + 1, 1, C.gold)
        })
      }
      // 白芯封顶：过曝也只是一个灯，不会把整屏烧成一团白
      const core = Math.min(34, lampR * (0.78 + 0.1 * over))
      ellRows(cx, ly, core, core, (y, hw) => {
        r(g, cx - hw, y, hw * 2 + 1, 1, over > 0.35 ? '#ffffff' : C.sugar)
      })
      // 灯芯高光
      const hw2 = Math.max(1, core * 0.5)
      r(g, cx - core * 0.2, ly - core * 0.45, hw2, hw2, '#ffffff')
    }
  }

  drawSteamFront(g, cx, cy, u, t)
}


/** 雾层：同一张雾片横向循环，两层不同速度 */
export function drawMist(g: Ctx, t: number, y: number, alpha: number, speed: number): void {
  const sheet = farLayers().mist
  const prev = g.globalAlpha
  const shift = ((t * speed) % MIST_W + MIST_W) % MIST_W
  g.globalAlpha = prev * alpha
  for (let k = -1; k <= 1; k++) g.drawImage(sheet, k * MIST_W - shift, y)
  g.globalAlpha = prev
}

/** 定格取景窗：镜头 B 停稳后重绘这扇窗（压暗之后再点亮） */
export function drawFocusWindow(g: Ctx, strength: number): void {
  const prev = g.globalAlpha
  const wx = HERO_X - WIN_W / 2
  const wy = HERO_Y - WIN_H / 2

  // 窗外暖光（雾里的散射）
  const halo = g.createRadialGradient(HERO_X, HERO_Y, 3, HERO_X, HERO_Y, 34)
  halo.addColorStop(0, `rgba(200,160,64,${(0.26 * strength).toFixed(3)})`)
  halo.addColorStop(0.45, `rgba(200,160,64,${(0.09 * strength).toFixed(3)})`)
  halo.addColorStop(1, 'rgba(200,160,64,0)')
  g.fillStyle = halo
  g.fillRect(HERO_X - 36, HERO_Y - 36, 72, 72)

  // 玻璃暖光
  r(g, wx, wy, WIN_W, WIN_H, C.brass)
  r(g, wx + 1, wy + 1, WIN_W - 2, WIN_H - 2, C.gold)
  r(g, wx + 1, wy + 1, WIN_W - 2, 3, C.brass)
  px(g, wx + 2, wy + 2, C.sugar)
  px(g, wx + 9, wy + 3, C.sugar)

  // 窗内两个剪影：靠窗坐着的一个（侧影），斜对面还有一个
  r(g, wx + 3, wy + 4, 2, 2, C.night)
  px(g, wx + 4, wy + 4, C.night)
  px(g, wx + 4, wy + 5, C.night)
  r(g, wx + 2, wy + 6, 4, 1, C.night)
  r(g, wx + 3, wy + 7, 3, 3, C.night)
  px(g, wx + 2, wy + 7, C.night)
  r(g, wx + 8, wy + 5, 2, 2, '#07090c')
  r(g, wx + 7, wy + 7, 4, 3, '#07090c')

  // 窗框与窗棂
  const frame = '#0b0e12'
  r(g, wx, wy, WIN_W, 1, frame)
  r(g, wx, wy + WIN_H - 1, WIN_W, 1, frame)
  r(g, wx, wy, 1, WIN_H, frame)
  r(g, wx + WIN_W - 1, wy, 1, WIN_H, frame)
  r(g, wx + 6, wy, 1, WIN_H, frame)
  // 窗台
  r(g, wx - 1, wy + WIN_H, WIN_W + 2, 1, '#0d1116')
  px(g, wx - 1, wy + WIN_H, '#3a321c')
  g.globalAlpha = prev
}

/** 暗角（2×2 像素块预渲染）。alpha 是最终不透明度，调用方自己乘淡入淡出 */
export function drawVignette(g: Ctx, alpha: number): void {
  if (alpha <= 0.004) return
  const prev = g.globalAlpha
  g.globalAlpha = Math.min(1, alpha)
  g.drawImage(farLayers().vignette, 0, 0)
  g.globalAlpha = prev
}

// ============================================================
// 9) 分镜字幕：地名卡（衬线 + 描边）/ 旁白（更小更暗）
//
//   全部画在同一张 384×216 的逻辑画布上：跟画面一起缩放，
//   跳过时也能在同一个 renderFrame() 里一帧画完，不依赖 React。
//
//   · 地名卡：一行主标题 + 一行注脚，居中偏下，压在暗山脊 / 谷地上。
//     18px 衬线，字距手工撑到 2px；1px 深描边 + 1px 落下阴影，
//     保证压在山脊的碎光上也读得出来。
//   · 旁白：14px、更暗、只有一层淡阴影，左下角左对齐；多行文本用 \n 断行。
//   · 不透明度由调用方按时间轴算好传进来，这里只负责「画」。
// ============================================================

/** 字幕的衬线字体：Georgia 打头，中文回退到宋体（Songti SC / 系统 serif） */
const SERIF = 'Georgia, "Songti SC", serif'

/** 地名主标题中心 y（逻辑坐标，居中偏下，不碰消失点与山脊） */
const CARD_TITLE_Y = 161
/** 注脚中心 y：主标题下方一行小字 */
const CARD_NOTE_Y = 181
/** 主标题字号 / 字距 */
const CARD_TITLE_SIZE = 18
const CARD_TITLE_GAP = 2
/** 注脚字号 / 字距：12px 是这层画布的底线，再小一档中文就糊成一团 */
const CARD_NOTE_SIZE = 12
const CARD_NOTE_GAP = 2

/** 旁白：14px，左对齐设在左下角，末行中心 y */
const NARR_SIZE = 14
const NARR_GAP = 1
const NARR_LEFT = 20
const NARR_LAST_Y = 196
const NARR_LINE_H = 19

export interface TitleCard {
  /** 地名主标题，例：巴伐利亚帝国 · 多特蒙德行省 */
  title: string
  /** 下一行小字（年代 / 注脚），可省 */
  note?: string
  /** 整体不透明度 0–1（时间轴的淡入淡出） */
  alpha: number
}

/** 逐字量宽：canvas 没有 letter-spacing，字距要自己算 */
function spacedWidth(g: Ctx, text: string, gap: number): number {
  const chars = Array.from(text)
  if (chars.length === 0) return 0
  let w = 0
  for (const ch of chars) w += g.measureText(ch).width + gap
  return Math.max(0, w - gap)
}

/** 逐字落笔：从 x 开始把整行铺开；stroke 非空时先描一圈再填 */
function paintSpaced(
  g: Ctx,
  text: string,
  x: number,
  y: number,
  gap: number,
  stroke: string | null,
): void {
  let pen = x
  for (const ch of Array.from(text)) {
    const px = Math.round(pen)
    if (stroke) {
      g.lineWidth = 2 // 居中描边：在 18px 字形外扩约 1px
      g.lineJoin = 'round'
      g.strokeStyle = stroke
      g.strokeText(ch, px, y)
    }
    g.fillText(ch, px, y)
    pen += g.measureText(ch).width + gap
  }
}

/**
 * 地名卡：居中偏下的一行衬线地名 + 一行小注记。
 * 不是像素字体，但坐落在 384×216 的逻辑坐标里，会跟画面一起放大。
 */
export function drawTitleCard(g: Ctx, card: TitleCard): void {
  const a = clamp01(card.alpha)
  if (a <= 0.004) return

  g.save()
  g.globalAlpha = a
  g.textAlign = 'left' // 居中也靠自己的逐字排版，才能带上字距
  g.textBaseline = 'middle'

  // ---- 主标题：暖骨白 + 1px 深描边 + 1px 落下阴影 ----
  g.font = `${CARD_TITLE_SIZE}px ${SERIF}`
  g.fillStyle = '#e8e0d0'
  g.shadowColor = 'rgba(2,3,6,0.78)'
  g.shadowOffsetX = 0
  g.shadowOffsetY = 1
  g.shadowBlur = 0
  const tw = spacedWidth(g, card.title, CARD_TITLE_GAP)
  paintSpaced(
    g,
    card.title,
    Math.round((VIEW_W - tw) / 2),
    CARD_TITLE_Y,
    CARD_TITLE_GAP,
    'rgba(4,6,10,0.9)',
  )

  // ---- 注脚：压暗一档的小字，只留阴影不描边，免得小字被描粗 ----
  if (card.note) {
    g.shadowColor = 'rgba(2,3,6,0.9)'
    g.shadowOffsetY = 1
    g.shadowBlur = 1
    g.fillStyle = '#c6bca6'
    g.font = `${CARD_NOTE_SIZE}px ${SERIF}`
    const nw = spacedWidth(g, card.note, CARD_NOTE_GAP)
    paintSpaced(
      g,
      card.note,
      Math.round((VIEW_W - nw) / 2),
      CARD_NOTE_Y,
      CARD_NOTE_GAP,
      null,
    )
  }

  g.restore()
}

/**
 * 旁白：左下角、比地名卡小一号、颜色更暗，只有一层淡阴影（无描边）。
 * text 里的 \n 用来断行；多行时末行贴住 NARR_LAST_Y，向上堆叠。
 */
export function drawNarration(g: Ctx, text: string, alpha: number): void {
  const a = clamp01(alpha)
  if (a <= 0.004) return
  const lines = text.split('\n').filter(s => s.length > 0)
  if (lines.length === 0) return

  g.save()
  g.globalAlpha = a
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.font = `${NARR_SIZE}px ${SERIF}`
  g.fillStyle = '#9aa6b8'
  g.shadowColor = 'rgba(0,0,0,0.62)'
  g.shadowOffsetX = 0
  g.shadowOffsetY = 1
  g.shadowBlur = 2

  const top = NARR_LAST_Y - (lines.length - 1) * NARR_LINE_H
  for (let i = 0; i < lines.length; i++) {
    paintSpaced(g, lines[i], NARR_LEFT, Math.round(top + i * NARR_LINE_H), NARR_GAP, null)
  }

  g.restore()
}

/**
 * 台词（说出口的一句话）：与旁白刻意拉开距离 ——
 * 水平居中、15px、暖浅金 #e8e0d0，比左下角的灰蓝旁白亮一档。
 * 引号由调用方写进 text 里，这里只负责排版。
 */
const SPOKEN_SIZE = 15
const SPOKEN_GAP = 1
/** 台词基线中心 y：压在画面下方，离人脸远一点 */
const SPOKEN_Y = 188

export function drawSpokenLine(g: Ctx, text: string, alpha: number): void {
  const a = clamp01(alpha)
  if (a <= 0.004) return
  const line = text.split('\n').filter(s => s.length > 0)
  if (line.length === 0) return

  g.save()
  g.globalAlpha = a
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.font = `${SPOKEN_SIZE}px ${SERIF}`
  g.fillStyle = '#e8e0d0'
  g.shadowColor = 'rgba(0,0,0,0.85)'
  g.shadowOffsetX = 0
  g.shadowOffsetY = 1
  g.shadowBlur = 2

  const top = SPOKEN_Y - ((line.length - 1) * 20) / 2
  for (let i = 0; i < line.length; i++) {
    const w = spacedWidth(g, line[i], SPOKEN_GAP)
    paintSpaced(
      g,
      line[i],
      Math.round((VIEW_W - w) / 2),
      Math.round(top + i * 20),
      SPOKEN_GAP,
      null,
    )
  }
  g.restore()
}

// ============================================================
// 10) 车厢内两镜（16.4–31.6s）
//
//   镜头 C1「望向窗外」16.4–26.2（26.2–28.4 让位给艾玛，28.4 切回）
//     · 弗里德里希的立绘从右下方升入，只入半身；整体水平翻转 → 他朝左看
//     · 左侧是他望着的窗：暗蓝窗洞，窗外快速掠过的树影 + 偶尔的暖色灯
//     · 脸上叠横向掠过的明暗条带（车窗外的树影打在脸上）
//   镜头 C2「对面的艾玛」26.2–28.4
//     · 弗里德里希淡出，艾玛从左下方升入；木色车厢压暗；这一镜没有任何字
//
//   立绘直接用项目已有的 256×256 透明 PNG（./portraits/*.png），
//   不程序化重画；图像没加载完时画深色剪影兜底，绝不留白。
//   所有条带的时机 / 宽度 / 明暗都由固定 seed 的 hash 生成：
//   同一个 t 每次画出来都一样，renderFrame(g, t) 仍是纯函数。
// ============================================================

/** 立绘在屏上的边长：256 原生 → 200，NEAREST 放大 */
const PORTRAIT_W = 200

const PORTRAIT_SRC = {
  ftz: './portraits/ftz.png',
  emma: './portraits/emma.png',
} as const

/** 弗里德里希：水平翻转后头中心落在画面右 1/3（x≈256），下半身出画 */
const FTZ_PX = 156
const FTZ_PY = 32
/** 艾玛：坐在对面，居中偏左，同样只入半身 */
const EMMA_PX = 88
const EMMA_PY = 26

interface Portrait {
  img: HTMLImageElement
  failed: boolean
}

interface Portraits {
  ftz: Portrait
  emma: Portrait
}

let cachedPortraits: Portraits | null = null

function loadPortrait(src: string): Portrait {
  const p: Portrait = { img: new Image(), failed: false }
  p.img.onerror = () => { p.failed = true }
  p.img.src = src
  return p
}

/** 立绘预加载：Opening 首帧之前调用一次（不调用也能工作，只是先画剪影） */
export function preloadPortraits(): void {
  if (!cachedPortraits) {
    cachedPortraits = {
      ftz: loadPortrait(PORTRAIT_SRC.ftz),
      emma: loadPortrait(PORTRAIT_SRC.emma),
    }
  }
}

function portraits(): Portraits {
  preloadPortraits()
  return cachedPortraits!
}

function portraitReady(p: Portrait): boolean {
  return !p.failed && p.img.complete && p.img.naturalWidth > 0
}

/** 立绘合成缓冲：先在 200×200 离屏画好「立绘 + 脸部条带」，再整块贴到主画布 */
let portraitBuf: HTMLCanvasElement | null = null

function portraitBuffer(): { c: HTMLCanvasElement; g: Ctx } {
  if (!portraitBuf) {
    portraitBuf = document.createElement('canvas')
    portraitBuf.width = PORTRAIT_W
    portraitBuf.height = PORTRAIT_W
  }
  return { c: portraitBuf, g: portraitBuf.getContext('2d')! }
}

/** 离屏用实心椭圆：上面的 ellRows 裁到视口高度，这里不能复用 */
function fillEllipse(g: Ctx, cx: number, cy: number, rx: number, ry: number, col: string): void {
  g.fillStyle = col
  const y0 = Math.ceil(cy - ry)
  const y1 = Math.floor(cy + ry)
  for (let y = y0; y <= y1; y++) {
    const dy = (y - cy) / ry
    const s = 1 - dy * dy
    if (s <= 0) continue
    const hw = Math.round(rx * Math.sqrt(s))
    g.fillRect(Math.round(cx - hw), y, hw * 2, 1)
  }
}

/**
 * 剪影兜底：立绘还没解码完时也要读出「一个人坐在窗边」，
 * 形状和立绘入画的位置对齐（头在上半、肩压到下缘），不留白。
 */
function drawPortraitSilhouette(g: Ctx): void {
  const cx = 128
  fillEllipse(g, cx, 206, 96, 74, '#0b0e13')   // 肩
  g.fillStyle = '#0b0e13'
  g.fillRect(cx - 17, 116, 34, 46)             // 脖子
  fillEllipse(g, cx, 76, 44, 50, '#0d1116')    // 头
  // 一线冷光把轮廓从暗背景里拉出来（与远景月光同色）
  g.fillStyle = 'rgba(154,166,184,0.22)'
  g.fillRect(cx - 43, 62, 1, 40)
  g.fillRect(cx - 30, 34, 1, 22)
  g.fillRect(cx + 20, 38, 1, 16)
}

// ---- 脸上的光影条带 ----------------------------------------------------
// 眼睛与脸颊在离屏坐标里的范围（翻转后）：x 44–164、y 40–110。
// 条带从右（190）扫到左（22），竖直宽度 3–8px，正好整张脸都掠过。

interface FaceStripe {
  /** 离屏坐标：条带左缘 */
  x: number
  w: number
  bright: boolean
  alpha: number
  seed: number
  /** 每段横向错开的斜率（−2..2）：整条读起来是微微斜的树影 */
  tilt: number
}

const STRIPE_TOP = 32
const STRIPE_BOT = 132
const STRIPE_X0 = 190
const STRIPE_X1 = 22
/** 第一条条带出现的时刻（16.4s 进车厢之后；相位选在验收帧都能扫在脸上） */
const STRIPE_T0 = 16.53
/** 固定 seed：同一时刻的条带永远一样 */
const STRIPE_SEED = 9271

/**
 * 生成 t 时刻正在扫过的条带。
 *
 * 每 0.6–0.9s 起「一组」：一条亮（+12%）紧挨一条暗（−10%），
 * 两条各自宽 3–8px、相隔 2–6px —— 读起来是树影的边缘（一道光一道影），
 * 单条扫过时够亮够暗，不会糊成一根扫描线。
 * 整组 0.62–0.78s 从右扫到左；时机 / 宽度 / 明暗全部来自 hash(i, seed)，
 * 同一时刻重画永远一样。
 */
function faceStripes(t: number): FaceStripe[] {
  const out: FaceStripe[] = []
  let t0 = STRIPE_T0
  for (let i = 0; i < 64 && t0 < 33; i++) {
    const gap = 0.6 + hash(i + STRIPE_SEED, 1) * 0.3      // 每 0.6–0.9s 一组
    const dur = 0.62 + hash(i + STRIPE_SEED, 2) * 0.16    // 扫完整张脸用 0.62–0.78s
    if (t >= t0 && t <= t0 + dur) {
      const p = (t - t0) / dur
      const ease = p * p * (3 - 2 * p)             // 缓起缓收：中段扫得快
      const edge = Math.min(1, p * 6, (1 - p) * 6) // 进出画面边缘时收掉，不硬切
      const x = STRIPE_X0 + (STRIPE_X1 - STRIPE_X0) * ease
      const lightFirst = hash(i + STRIPE_SEED, 3) > 0.5
      const w1 = 4 + Math.floor(hash(i + STRIPE_SEED, 4) * 5) // 4–8px
      const w2 = 4 + Math.floor(hash(i + STRIPE_SEED, 5) * 5) // 4–8px
      const bandGap = Math.floor(hash(i + STRIPE_SEED, 6) * 3) // 0–2px：明暗直接贴在一起
      out.push({
        x,
        w: w1,
        bright: lightFirst,
        alpha: (lightFirst ? 0.12 : 0.1) * edge,
        seed: i,
        tilt: Math.floor(hash(i + STRIPE_SEED, 7) * 5) - 2,
      })
      out.push({
        x: x + w1 + bandGap,
        w: w2,
        bright: !lightFirst,
        alpha: (lightFirst ? 0.1 : 0.12) * edge,
        seed: i + 37,
        tilt: Math.floor(hash(i + STRIPE_SEED, 8) * 5) - 2,
      })
    }
    t0 += gap
  }
  return out
}

/** 一条条带切成三段、每段横向错开 1–2px：像窗外的树影，不是扫描线 */
function paintStripeRects(g: Ctx, s: FaceStripe): void {
  for (let k = 0; k < 3; k++) {
    const y0 = STRIPE_TOP + Math.round(((STRIPE_BOT - STRIPE_TOP) * k) / 3)
    const y1 = STRIPE_TOP + Math.round(((STRIPE_BOT - STRIPE_TOP) * (k + 1)) / 3)
    const jx = (k - 1) * s.tilt
    g.fillRect(Math.round(s.x + jx), y0, s.w, y1 - y0)
  }
}

/** 条带用的第二块离屏：只放条带，再用立绘的 alpha 裁掉脸外的部分 */
let stripeBuf: HTMLCanvasElement | null = null

function stripeBuffer(): { c: HTMLCanvasElement; g: Ctx } {
  if (!stripeBuf) {
    stripeBuf = document.createElement('canvas')
    stripeBuf.width = PORTRAIT_W
    stripeBuf.height = PORTRAIT_W
  }
  return { c: stripeBuf, g: stripeBuf.getContext('2d')! }
}

/**
 * 把条带合成回主画布：
 *   暗条 = 半透明黑，source-over（−10%）
 *   亮条 = 加性白，lighter（+12%）
 * 两者都先经 destination-in 裁到立绘的 alpha 上，因此只打在脸/身上，
 * 不会在背景里留下一条竖线。
 */
function paintFaceStripes(
  g: Ctx,
  art: HTMLCanvasElement,
  stripes: FaceStripe[],
  dx: number,
  dy: number,
): void {
  if (stripes.length === 0) return
  const { c: sc, g: sg } = stripeBuffer()

  const pass = (list: FaceStripe[], col: (a: number) => string, mode: GlobalCompositeOperation): void => {
    if (list.length === 0) return
    sg.setTransform(1, 0, 0, 1, 0, 0)
    sg.globalCompositeOperation = 'source-over'
    sg.globalAlpha = 1
    sg.clearRect(0, 0, PORTRAIT_W, PORTRAIT_W)
    for (const s of list) {
      sg.fillStyle = col(s.alpha)
      paintStripeRects(sg, s)
    }
    // 只保留立绘有像素的位置
    sg.globalCompositeOperation = 'destination-in'
    sg.drawImage(art, 0, 0)
    sg.globalCompositeOperation = 'source-over'

    g.globalCompositeOperation = mode
    g.drawImage(sc, Math.round(dx), Math.round(dy))
    g.globalCompositeOperation = 'source-over'
  }

  pass(stripes.filter(s => !s.bright && s.alpha > 0.004), a => `rgba(0,0,0,${a.toFixed(3)})`, 'source-over')
  pass(stripes.filter(s => s.bright && s.alpha > 0.004), a => `rgba(255,255,255,${a.toFixed(3)})`, 'lighter')
}

/** 贴一张立绘：翻转 / 剪影兜底 / 脸部条带都在离屏里做完，再整块 drawImage */
function drawPortrait(
  g: Ctx,
  p: Portrait,
  dx: number,
  dy: number,
  flip: boolean,
  stripes: FaceStripe[] | null,
): void {
  const { c, g: pg } = portraitBuffer()
  pg.setTransform(1, 0, 0, 1, 0, 0)
  pg.imageSmoothingEnabled = false
  pg.globalAlpha = 1
  pg.globalCompositeOperation = 'source-over'
  pg.clearRect(0, 0, PORTRAIT_W, PORTRAIT_W)

  if (portraitReady(p)) {
    pg.save()
    // 水平翻转：他/她因此在画面里「朝另一边看」
    if (flip) {
      pg.translate(PORTRAIT_W, 0)
      pg.scale(-1, 1)
    }
    pg.drawImage(p.img, 0, 0, PORTRAIT_W, PORTRAIT_W)
    pg.restore()
  } else {
    drawPortraitSilhouette(pg)
  }

  g.drawImage(c, Math.round(dx), Math.round(dy))
  if (stripes) paintFaceStripes(g, c, stripes, dx, dy)
}

// ---- 车窗：一块暗蓝窗洞 + 横向滚过的树影与灯 -------------------------

const GAP_X = 17
const GAP_Y = 36
const GAP_W = 140
const GAP_H = 130
const GAP_STRIP_W = 512

/** 窗外纹理：可横向循环（树影首尾各画一遍，滚动时接缝不露） */
function drawWindowStrip(): HTMLCanvasElement {
  const { c, g } = canvas(GAP_STRIP_W, GAP_H)

  // 夜空：偏暗蓝，越靠下越暗（暗到近黑，但窗洞本身要能读成一块「暗蓝」）
  const bands = ['#122132', '#101c2b', '#0d1826', '#0a131e', '#071018']
  const bh = Math.ceil(GAP_H / bands.length)
  for (let i = 0; i < bands.length; i++) r(g, 0, i * bh, GAP_STRIP_W, bh + 1, bands[i])
  r(g, 0, Math.round(GAP_H * 0.62), GAP_STRIP_W, 2, '#050a11')

  // 树影：竖直暗条 —— 车往前走，它们就横向掠过窗口
  for (let i = 0; i < 64; i++) {
    const w = 3 + Math.floor(hash(i, 211) * 22)
    const x = Math.floor(hash(i, 212) * GAP_STRIP_W)
    const a = 0.4 + hash(i, 213) * 0.45
    g.fillStyle = `rgba(0,3,7,${a.toFixed(3)})`
    for (const off of [-GAP_STRIP_W, 0, GAP_STRIP_W]) g.fillRect(x + off, 0, w, GAP_H)
  }
  // 近处树冠：上半部更密的暗块，和远景拉开速度差
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(hash(i, 221) * GAP_STRIP_W)
    const y = Math.floor(hash(i, 222) * GAP_H * 0.42)
    const w = 8 + Math.floor(hash(i, 223) * 26)
    const h = 3 + Math.floor(hash(i, 224) * 10)
    g.fillStyle = 'rgba(0,3,7,0.5)'
    for (const off of [-GAP_STRIP_W, 0, GAP_STRIP_W]) g.fillRect(x + off, y, w, h)
  }
  // 远处的灯：隔很远才有一盏暖色光斑
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(hash(i, 231) * GAP_STRIP_W)
    const y = Math.round(GAP_H * (0.34 + hash(i, 232) * 0.42))
    const rad = 2 + Math.floor(hash(i, 233) * 3)
    const glow = g.createRadialGradient(x, y, 1, x, y, rad * 5)
    glow.addColorStop(0, 'rgba(232,176,88,0.5)')
    glow.addColorStop(0.4, 'rgba(200,150,72,0.18)')
    glow.addColorStop(1, 'rgba(160,110,40,0)')
    g.fillStyle = glow
    g.fillRect(x - rad * 5, y - rad * 5, rad * 10, rad * 10)
    g.fillStyle = '#e8b058'
    for (const off of [-GAP_STRIP_W, 0, GAP_STRIP_W]) {
      g.fillRect(x + off - (rad >> 1), y - (rad >> 1), rad, rad)
    }
  }
  return c
}

let cachedWindowStrip: HTMLCanvasElement | null = null

function windowStrip(): HTMLCanvasElement {
  if (!cachedWindowStrip) cachedWindowStrip = drawWindowStrip()
  return cachedWindowStrip
}

/** 窗洞：两层不同速度的滚动纹理 + 玻璃冷光 + 木窗框 + 窗台 */
function drawWindowView(g: Ctx, t: number): void {
  const strip = windowStrip()
  const base = g.globalAlpha

  g.save()
  g.beginPath()
  g.rect(GAP_X, GAP_Y, GAP_W, GAP_H)
  g.clip()

  // 远景（慢）与近景（快）：两层一起滚，读出车窗的速度
  const s1 = ((t * 300) % GAP_STRIP_W + GAP_STRIP_W) % GAP_STRIP_W
  g.globalAlpha = base * 0.95
  for (let k = -1; k <= 1; k++) g.drawImage(strip, GAP_X + k * GAP_STRIP_W - s1, GAP_Y)
  const s2 = ((t * 620) % GAP_STRIP_W + GAP_STRIP_W) % GAP_STRIP_W
  g.globalAlpha = base * 0.45
  for (let k = -1; k <= 1; k++) g.drawImage(strip, GAP_X + k * GAP_STRIP_W - s2, GAP_Y + 8)
  g.globalAlpha = base

  // 玻璃：一层很薄的冷色，让窗外是「透过去的」而不是贴片
  g.fillStyle = 'rgba(26,48,72,0.16)'
  g.fillRect(GAP_X, GAP_Y, GAP_W, GAP_H)
  g.fillStyle = 'rgba(154,196,230,0.045)'
  g.fillRect(GAP_X + 12, GAP_Y, 24, GAP_H)
  g.restore()

  // 窗框：木头
  const frame = '#171009'
  r(g, GAP_X - 3, GAP_Y - 3, GAP_W + 6, 3, frame)
  r(g, GAP_X - 3, GAP_Y + GAP_H, GAP_W + 6, 4, frame)
  r(g, GAP_X - 3, GAP_Y - 3, 3, GAP_H + 6, frame)
  r(g, GAP_X + GAP_W, GAP_Y - 3, 3, GAP_H + 6, frame)
  // 竖棂：把窗分成两扇
  r(g, GAP_X + Math.round(GAP_W / 2) - 1, GAP_Y, 2, GAP_H, frame)
  // 窗台：被窗外的灯擦亮的一线
  r(g, GAP_X - 5, GAP_Y + GAP_H + 3, GAP_W + 12, 3, '#1d1409')
  r(g, GAP_X - 5, GAP_Y + GAP_H + 3, GAP_W + 12, 1, '#3a2a14')
}

/** 车厢内壁：暖黑，横向木条；右侧更暗（他背对着的那半边） */
function drawCabinWall(g: Ctx): void {
  r(g, 0, 0, VIEW_W, VIEW_H, '#0a0806')
  for (let y = 0; y < VIEW_H; y += 24) {
    r(g, 0, y, VIEW_W, 1, '#120d08')
    r(g, 0, y + 1, VIEW_W, 1, '#070504')
  }
  // 右侧的暗：他背后的车厢尽头
  for (let x = VIEW_W - 70; x < VIEW_W; x++) {
    const a = ((x - (VIEW_W - 70)) / 70) * 0.5
    r(g, x, 0, 1, VIEW_H, `rgba(0,0,0,${a.toFixed(3)})`)
  }
  // 底部座位 / 裙板的暗影
  r(g, 0, 190, VIEW_W, VIEW_H - 190, '#070504')
  r(g, 0, 190, VIEW_W, 1, '#100b06')
}

/**
 * 镜头 C1：弗里德里希望向窗外。
 * 立绘从右下方升入（16.55–17.55s 落位），窗外冷光/暖光交替擦过他。
 */
export function drawWatchShot(g: Ctx, t: number, alpha: number): void {
  const a = clamp01(alpha)
  if (a <= 0.004) return
  const prev = g.globalAlpha
  g.globalAlpha = a

  drawCabinWall(g)
  drawWindowView(g, t)

  // 窗外灯在窗框右缘散开的一点暖光：把他和窗连起来
  const lampX = GAP_X + GAP_W
  const lampY = GAP_Y + GAP_H * 0.45
  const lamp = g.createRadialGradient(lampX, lampY, 4, lampX, lampY, 96)
  lamp.addColorStop(0, 'rgba(200,160,64,0.11)')
  lamp.addColorStop(1, 'rgba(200,160,64,0)')
  g.fillStyle = lamp
  g.fillRect(0, 0, VIEW_W, VIEW_H)

  // 从右下方升起：只入画半身，头落在画面右 1/3
  const rise = smoothstep(16.55, 17.55, t)
  const dy = Math.round(FTZ_PY + (1 - rise) * 62)
  drawPortrait(g, portraits().ftz, FTZ_PX, dy, true, faceStripes(t))

  // 画面其余部分压暗
  drawVignette(g, a * 0.55)
  g.globalAlpha = prev
}

/**
 * 镜头 C2：对面的艾玛。
 * 木色车厢压暗，她从左下方升入；这一镜没有任何文字。
 */
export function drawEmmaShot(g: Ctx, t: number, alpha: number): void {
  const a = clamp01(alpha)
  if (a <= 0.004) return
  const prev = g.globalAlpha
  g.globalAlpha = a

  // 车厢木壁：暖棕竖板 + 腰线，压暗但仍读得出是木头
  r(g, 0, 0, VIEW_W, VIEW_H, '#26190f')
  for (let x = 0; x < VIEW_W; x += 26) {
    r(g, x, 0, 1, VIEW_H, '#1a110a')
    r(g, x + 1, 0, 1, VIEW_H, '#332315')
  }
  for (let y = 0; y < VIEW_H; y += 31) r(g, 0, y, VIEW_W, 1, '#170f08')
  // 腰线
  r(g, 0, 150, VIEW_W, 2, '#3d2a18')
  r(g, 0, 150, VIEW_W, 1, '#52391f')
  // 座位靠背：底部暗影
  r(g, 0, 176, VIEW_W, VIEW_H - 176, '#140d07')
  r(g, 0, 176, VIEW_W, 1, '#2b1e10')
  // 从车窗透进来的冷光
  const cold = g.createRadialGradient(40, 40, 8, 40, 40, 210)
  cold.addColorStop(0, 'rgba(60,84,112,0.14)')
  cold.addColorStop(1, 'rgba(60,84,112,0)')
  g.fillStyle = cold
  g.fillRect(0, 0, VIEW_W, VIEW_H)

  // 从左下方升起，朝向右侧
  const rise = smoothstep(26.35, 27.15, t)
  const dx = Math.round(EMMA_PX - (1 - rise) * 34)
  const dy = Math.round(EMMA_PY + (1 - rise) * 70)
  drawPortrait(g, portraits().emma, dx, dy, false, null)

  // 只让她的脸亮着：整幅再压一档
  g.globalAlpha = a * 0.2
  g.fillStyle = '#000000'
  g.fillRect(0, 0, VIEW_W, VIEW_H)
  g.globalAlpha = prev

  drawVignette(g, a * 0.58)
}
