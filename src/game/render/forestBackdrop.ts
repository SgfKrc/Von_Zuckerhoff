// ============================================================
// 森林远景：糖堡站 / 雾中山路的程序化多层视差（零外部素材）
// ============================================================
//
// 与另外两个远景模块的分工：
//   render/backdrop.ts         gate 的「一张写实图 + 降饱和 + 颗粒 + 纵向视差」
//   render/bridgeBackdrop.ts   bridge 的「四层程序化峡谷」
//   本文件                     station / road 的「森林」——
//                              远山脊 → 冷杉林 → 近景树干 → 地面雾，
//                              再叠一层天气（站台的雨 / 山路的雾 / 远处的一盏灯）。
//
// 视差：位移 = (相机坐标 − 相机中值) × 系数，系数越大越近。
//   station  ridge 0.20 / firs 0.45 / fog 0.70
//   road     ridge 0.15 / firs 0.40 / trunks 0.70 / groundfog 0.90
//
// 为什么这里 camX 与 camY 都乘同一个系数：
//   桥是纵向走的，所以 bridgeBackdrop 只用 camY。这两张地图是横向长的
//   （站台 26 格、山路 48 格），人是沿着路走的 —— 横向位移才是主要的纵深线索。
//   纵向相机行程只有 72px，所以纵向老老实实按同一个系数走也不会失真。
//
// 烘焙：每层只画一次到离屏画布（比视口大出一圈，给位移留余量），每帧只做 drawImage。
// 天气、灯光是每帧画的（雨丝要落、灯要跳、雾要飘），但那几十个 fillRect
// 比重烘一张 730px 的图便宜得多。
//
// 画布分层与"谁在前面"：
//   drawStationBackdrop / drawRoadBackdrop 在瓦片之前调用（景在场景后面）；
//   drawStationFore / drawRoadFore 在瓦片之后调用 —— 雨、灯光晕、地面雾
//   必须压在地面上，否则它们会被站台 / 山道的瓦片盖掉。
// ============================================================
import { VIEW_W, VIEW_H } from '../constants'

type Ctx = CanvasRenderingContext2D

/** 固定 seed 的伪随机：烘焙只做一次，每帧必须一致，否则整套远景会闪 */
function rnd(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

/** 每层的视差系数（越大越近、动得越快） */
const STATION_RATE = { ridge: 0.20, firs: 0.45, fog: 0.70 } as const
const ROAD_RATE = { ridge: 0.15, firs: 0.40, trunks: 0.70, groundFog: 0.90 } as const

/**
 * 相机行程的中值与半幅 —— 跟着 world/maps.ts 的尺寸走：
 *   station 26×18 格 = 416×288px，视口 384×216 → camX 0..32（中值 16）、camY 0..72（中值 36）
 *   road    48×18 格 = 768×288px，视口 384×216 → camX 0..384（中值 192）、camY 0..72（中值 36）
 * 地图改了尺寸，这里要跟着改（bridgeBackdrop.ts 的 CAM_MID 是同一套做法）。
 */
const STATION_CAM = { mx: 16, my: 36 } as const
const ROAD_CAM = { mx: 192, my: 36 } as const

interface Layer {
  canvas: HTMLCanvasElement
  padX: number
  padY: number
}

/**
 * 把一层画到离屏画布上。
 * 画布比视口大出 (padX, padY) 一圈，绘制时先把原点挪到 (padX, padY)，
 * 于是 draw 内部可以照常使用"屏幕坐标"，画到屏幕外也没关系。
 */
function bake(
  padX: number,
  padY: number,
  draw: (g: Ctx, x0: number, x1: number) => void,
): Layer {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, VIEW_W + padX * 2)
  canvas.height = Math.max(1, VIEW_H + padY * 2)
  const g = canvas.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.save()
  g.translate(padX, padY)
  draw(g, -padX, VIEW_W + padX)
  g.restore()
  return { canvas, padX, padY }
}

/** 一层按自己的系数位移：camX / camY 越大，这一层往左上走得越慢 */
function drawLayer(
  ctx: Ctx,
  L: Layer,
  camX: number,
  camY: number,
  rate: number,
  mx: number,
  my: number,
): void {
  const dx = -L.padX - Math.round((camX - mx) * rate)
  const dy = -L.padY - Math.round((camY - my) * rate)
  ctx.drawImage(L.canvas, dx, dy)
}

// ============================================================
// 基础形状：山脊、冷杉、雾
// ============================================================

/** 一道山脊剪影：逐列填到地平线以下，脊线上一道 1px 冷色微光 */
function ridge(
  g: Ctx,
  x0: number,
  x1: number,
  fn: (x: number) => number,
  fill: string,
  rim: string,
  rimA: number,
  seed: number,
): void {
  for (let x = x0; x < x1; x++) {
    const y = Math.round(fn(x))
    g.fillStyle = fill
    g.fillRect(x, y, 1, VIEW_H + 160 - y)
    // 脊线：亮度按两段慢正弦起伏（受月光的一侧亮），只掺一点逐列抖动。
    // 早先用逐列随机，结果是脊线散成一串虚线 —— 山脊必须是一条线。
    const slow = 0.55 + Math.sin(x * 0.013 + seed) * 0.24 + Math.sin(x * 0.041 + seed * 1.7) * 0.12
    g.globalAlpha = Math.min(1, rimA * (slow + rnd(x * 17 + seed) * 0.12))
    g.fillStyle = rim
    g.fillRect(x, y, 1, 1)
    g.globalAlpha = 1
  }
}

/**
 * 一棵冷杉的剪影：底宽顶尖、六层阶梯、左缘一道极暗的受光边。
 * 阶梯是刻意的 —— 平滑三角形会读成"两座土丘"，一级一级收下去才读作"一棵树"。
 */
function fir(
  g: Ctx,
  cx: number,
  baseY: number,
  h: number,
  w: number,
  seed: number,
  dark: string,
  mid: string,
  lit: string,
): void {
  for (let dy = 0; dy < h; dy++) {
    const p = dy / h // 0 = 树根，1 = 树尖
    const step = Math.floor(p * 6) / 6
    let half = Math.max(0.6, (1 - step) * (w / 2))
    // 枝叶边缘：奇数行多出 1px，树尖才不会是一根针
    if (rnd(seed + dy * 13) > 0.58) half += 1
    const x0 = Math.round(cx - half)
    const x1 = Math.round(cx + half)
    g.fillStyle = p > 0.70 ? mid : dark
    g.fillRect(x0, baseY - dy, Math.max(1, x1 - x0), 1)
    // 左缘受光：月/雾的光从左上下来
    if (p < 0.86) {
      g.fillStyle = lit
      g.fillRect(x0, baseY - dy, 1, 1)
    }
  }
}

/** 一片周期性的雾贴图：横向整周期（左右无缝），纵向中间浓、上下散 */
function bakeFog(w: number, h: number, seed: number): Layer {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')!
  for (let y = 0; y < h; y++) {
    const v = (y / h - 0.5) * 2
    const band = Math.exp(-(v * v) / 0.34)
    if (band < 0.02) continue
    for (let x = 0; x < w; x++) {
      const u = (x / w) * Math.PI * 2
      // 三个整周期正弦：x = 0 与 x = w-1 连续，平铺无缝
      const n1 = Math.sin(u * 3 + seed) * 0.5 + 0.5
      const n2 = Math.sin(u * 7 + seed * 1.7 + y * 0.08) * 0.5 + 0.5
      const n3 = Math.sin(u * 13 + seed * 2.3 - y * 0.04) * 0.5 + 0.5
      const n = n1 * 0.5 + n2 * 0.32 + n3 * 0.18
      let a = band * (0.20 + n * 0.80)
      a *= 0.55 + rnd(x * 131 + y * 977 + seed * 31) * 0.85
      if (a < 0.02) continue
      const col = n > 0.62 ? '154,166,184' : '111,122,140'
      g.fillStyle = `rgba(${col},${Math.min(1, a).toFixed(3)})`
      g.fillRect(x, y, 1, 1)
    }
  }
  // 横向无缝的贴图：padX / padY 记 0，drawFogBand 自己算位置
  return { canvas, padX: 0, padY: 0 }
}

/** 一条雾带：纵向按自己的系数走，横向是"视差 + 风"，贴图左右无缝所以画两张 */
function drawFogBand(
  ctx: Ctx,
  tex: Layer,
  camX: number,
  camY: number,
  t: number,
  rate: number,
  mx: number,
  my: number,
  screenY: number,
  windSpeed: number,
  alpha: number,
): void {
  const dy = Math.round(screenY - tex.canvas.height / 2 - (camY - my) * rate)
  const off = ((t * windSpeed - (camX - mx) * rate) % VIEW_W + VIEW_W) % VIEW_W
  const ox = Math.round(off)
  ctx.globalAlpha = alpha
  ctx.drawImage(tex.canvas, -ox, dy)
  ctx.drawImage(tex.canvas, VIEW_W - ox, dy)
  ctx.globalAlpha = 1
}

// ============================================================
// 糖堡站：夜空 + 远山脊 + 冷杉林 + 雾带
//
// 站台在画面下缘（maps.ts 里 y6..y12 是木板），它上面那 6 行是虚空，
// 远景就是从这 96px 的窗口里透出来的。所以这一套的天际线压在 96..104px 上：
// 山脊在 56..88，冷杉的根落在 96..108，雾带横在 78..118。
// ============================================================

const STATION_HORIZON = 100

function bakeStationSky(padX: number, padY: number): Layer {
  return bake(padX, padY, (g, x0, x1) => {
    // 夜空：雨夜里云把天光反下来，越靠地平线越亮
    const sky = g.createLinearGradient(0, -padY, 0, STATION_HORIZON)
    sky.addColorStop(0, '#06090f')
    sky.addColorStop(0.55, '#0a111c')
    sky.addColorStop(1, '#16232f')
    g.fillStyle = sky
    g.fillRect(x0, -padY, x1 - x0, STATION_HORIZON + padY)
    // 雨云的底边：三道极淡的横向暗带，把天空压住
    for (let i = 0; i < 3; i++) {
      const y = 14 + i * 17
      g.fillStyle = `rgba(4,6,10,${(0.16 + i * 0.05).toFixed(2)})`
      for (let x = x0; x < x1; x += 1) {
        const w = Math.sin((x / VIEW_W) * Math.PI * 4 + i * 1.7) * 0.5 + 0.5
        if (w > 0.42) g.fillRect(x, y + Math.round(w * 5), 1, 3 + Math.round(w * 3))
      }
    }
    // 星：天顶稀稀几颗（雨夜里只留最亮的）
    for (let i = 0; i < 22; i++) {
      const x = Math.floor(rnd(300 + i * 3.7) * (x1 - x0)) + x0
      const y = Math.floor(rnd(320 + i * 7.3) * 52) - padY
      g.fillStyle = `rgba(154,166,184,${(0.08 + rnd(340 + i * 5.1) * 0.20).toFixed(3)})`
      g.fillRect(x, y, 1, 1)
    }
    // 两层山脊：远的一层淡、近的一层黑
    const far = (x: number): number =>
      38 + Math.sin(x * 0.0116 + 1.4) * 13
      + Math.sin(x * 0.029 + 3.1) * 5 + Math.sin(x * 0.071 + 0.6) * 2.2
    const near = (x: number): number =>
      58 + Math.sin(x * 0.0081 + 0.3) * 10
      + Math.sin(x * 0.021 + 4.2) * 4 + Math.sin(x * 0.053 + 2.1) * 2
    ridge(g, x0, x1, far, '#0c1420', '#3f5670', 0.45, 11)
    ridge(g, x0, x1, near, '#080e17', '#5a7690', 0.6, 29)
    // 地平线以下：黑。冷杉之间的缝里要沉下去，不能透出天空的亮
    g.fillStyle = '#05080c'
    g.fillRect(x0, STATION_HORIZON - 2, x1 - x0, VIEW_H + padY)
  })
}

function bakeStationFirs(padX: number, padY: number): Layer {
  return bake(padX, padY, (g, x0, x1) => {
    // 先铺一层近黑的林下：树与树之间的缝是"林子深处"，不是天空
    g.fillStyle = '#060b09'
    g.fillRect(x0, 56, x1 - x0, VIEW_H + padY)
    // 两排：后排矮、被雾洗淡；前排高、压到近黑
    for (let pass = 0; pass < 2; pass++) {
      const far = pass === 0
      const base = far ? 98 : 106
      const hMin = far ? 18 : 26
      const hMax = far ? 34 : 48
      const stepPx = far ? 6 : 9
      for (let x = x0; x < x1; x += stepPx) {
        const seed = (far ? 5000 : 9000) + Math.round(x) * 13
        const jx = Math.round((rnd(seed) - 0.5) * 7)
        const h = hMin + rnd(seed + 1) * (hMax - hMin)
        const w = far ? 9 + rnd(seed + 2) * 5 : 13 + rnd(seed + 2) * 8
        const by = base + Math.round(rnd(seed + 3) * 5)
        fir(
          g, x + jx, by, h, w, seed,
          far ? '#0c1511' : '#080d0b',
          far ? '#131f17' : '#0d1511',
          far ? '#22321f' : '#1a2a1d',
        )
      }
    }
    // 林线的脚：往下渐黑，和站台木板压出的那条边接上
    const grad = g.createLinearGradient(0, 96, 0, 132)
    grad.addColorStop(0, 'rgba(3,5,6,0)')
    grad.addColorStop(1, 'rgba(3,5,6,0.96)')
    g.fillStyle = grad
    g.fillRect(x0, 96, x1 - x0, 40)
    // 站台边缘之外：铁轨往右下斜着进黑暗。
    // 这一段只在玩家走到月台边（camY 大）时才从瓦片下面露出来，
    // 但正是它把"站台在画面下缘、下面是铁路"这件事说完。
    bakeTrack(g)
  })
}

/**
 * 一条向右下方消失的铁轨：中心线从 (96,138) 走到 (352,248)，
 * 轨距从 12px 张开到 58px；道砟按行填充，枕木横在两条轨之间。
 */
function bakeTrack(g: Ctx): void {
  const N = 120
  const cx = (t: number): number => 96 + 256 * t + 40 * t * t
  const cy = (t: number): number => 138 + 104 * t + 22 * t * t
  const half = (t: number): number => 6 + 26 * t
  // 道砟：一条越远越窄的暗带
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    const x = Math.round(cx(t))
    const y = Math.round(cy(t))
    const w = Math.round(half(t) * 1.9)
    g.fillStyle = '#0e1217'
    g.fillRect(x - w, y - 3, w * 2, 7)
  }
  // 枕木：每 9 步一根，横着压在两条轨之间（越远越短）
  for (let i = 2; i < N; i += 9) {
    const t = i / (N - 1)
    const x = Math.round(cx(t))
    const y = Math.round(cy(t))
    const w = Math.round(half(t) * 1.5)
    g.fillStyle = '#1b1610'
    g.fillRect(x - w, y - 1, w * 2, 2)
    g.fillStyle = '#0f0c08'
    g.fillRect(x - w, y + 1, w * 2, 1)
  }
  // 两条钢轨：外缘冷光、内缘暗，越远越淡（雾吞掉）
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    const x = Math.round(cx(t))
    const y = Math.round(cy(t))
    const h = half(t)
    const a = 0.22 + t * 0.52
    for (const side of [-1, 1]) {
      const rx = Math.round(x + side * h)
      g.fillStyle = `rgba(154,166,184,${(a * 0.55).toFixed(3)})`
      g.fillRect(rx, y, 1, 1)
      g.fillStyle = `rgba(77,86,101,${(a * 0.5).toFixed(3)})`
      g.fillRect(rx, y + 1, 1, 1)
    }
  }
}

let stationBaked = false
let stationSky: Layer
let stationFirs: Layer
let stationFogFar: Layer
let stationFogNear: Layer

function bakeStation(): void {
  if (stationBaked) return
  const padX = Math.ceil(STATION_CAM.mx * STATION_RATE.fog) + 4
  const padY = Math.ceil(STATION_CAM.my * STATION_RATE.fog) + 4
  stationSky = bakeStationSky(padX, padY)
  stationFirs = bakeStationFirs(padX, padY)
  stationFogFar = bakeFog(VIEW_W, 86, 1.9)
  stationFogNear = bakeFog(VIEW_W, 64, 5.3)
  stationBaked = true
}

/** 在瓦片之下画糖堡站的三层夜景（山脊 / 冷杉林 / 雾带） */
export function drawStationBackdrop(
  ctx: Ctx,
  camX: number,
  camY: number,
  t: number,
): void {
  bakeStation()
  ctx.save()
  ctx.imageSmoothingEnabled = false
  // 底色：层位移时屏幕边缘不能露出更下面那张图
  ctx.fillStyle = '#06090e'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  // 1 夜空 + 远山脊
  drawLayer(ctx, stationSky, camX, camY, STATION_RATE.ridge, STATION_CAM.mx, STATION_CAM.my)
  // 2 冷杉林
  drawLayer(ctx, stationFirs, camX, camY, STATION_RATE.firs, STATION_CAM.mx, STATION_CAM.my)
  // 3 雾带：两条，远的一条慢而高、近的一条快而低
  drawFogBand(
    ctx, stationFogFar, camX, camY, t, STATION_RATE.fog * 0.82, STATION_CAM.mx, STATION_CAM.my,
    84, 0.14, 0.17,
  )
  drawFogBand(
    ctx, stationFogNear, camX, camY, t, STATION_RATE.fog * 1.12, STATION_CAM.mx, STATION_CAM.my,
    108, -0.21, 0.21,
  )
  ctx.restore()
}

// ============================================================
// 糖堡站 · 前景：煤气灯的暖光 + 斜雨
// ============================================================

/** 灯头在世界坐标里的位置（renderer 按地图实体算好传进来） */
export interface LampPos { x: number; y: number }

/** 煤气灯：一圈暖色光晕 —— 整张冷蓝画面上唯一的暖点 */
function drawLampGlow(ctx: Ctx, camX: number, camY: number, t: number, lamps: LampPos[]): void {
  if (lamps.length === 0) return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < lamps.length; i++) {
    const l = lamps[i]
    const sx = Math.round(l.x - camX)
    const sy = Math.round(l.y - camY)
    if (sx < -60 || sx > VIEW_W + 60 || sy < -80 || sy > VIEW_H + 80) continue
    // 火苗的呼吸：两组不成倍数的正弦，读起来是"气不稳"，不是规律的脉冲
    const flick = 0.86
      + Math.sin(t * 0.071 + i * 2.1) * 0.07
      + Math.sin(t * 0.213 + i * 0.7 + 1.3) * 0.05
    // 内圈：灯罩附近
    const inner = ctx.createRadialGradient(sx, sy, 1, sx, sy, 26)
    inner.addColorStop(0, `rgba(242,214,140,${(0.34 * flick).toFixed(3)})`)
    inner.addColorStop(0.35, `rgba(200,160,64,${(0.15 * flick).toFixed(3)})`)
    inner.addColorStop(1, 'rgba(122,106,58,0)')
    ctx.fillStyle = inner
    ctx.beginPath()
    ctx.arc(sx, sy, 26, 0, Math.PI * 2)
    ctx.fill()
    // 外圈：照到木板上的那一圈，椭圆压扁（光摊在地上）
    ctx.save()
    ctx.translate(sx, sy + 12)
    ctx.scale(1, 0.62)
    const outer = ctx.createRadialGradient(0, 0, 4, 0, 0, 54)
    outer.addColorStop(0, `rgba(200,160,64,${(0.13 * flick).toFixed(3)})`)
    outer.addColorStop(0.6, `rgba(150,110,40,${(0.05 * flick).toFixed(3)})`)
    outer.addColorStop(1, 'rgba(90,70,30,0)')
    ctx.fillStyle = outer
    ctx.beginPath()
    ctx.arc(0, 0, 54, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()
}

/** 斜雨：1px 短斜线，落得快；近的亮、远的淡（同一套 alpha 分两档） */
function drawRain(ctx: Ctx, t: number): void {
  const tt = t / 60 // world.t 是帧计数（60fps）
  ctx.save()
  const DROPS = 112
  for (let i = 0; i < DROPS; i++) {
    const seed = 11000 + i * 7
    const near = i % 3 !== 0
    const speed = (near ? 340 : 210) + rnd(seed) * 120
    const len = (near ? 4 : 2) + Math.round(rnd(seed + 1) * (near ? 6 : 3))
    const x0 = rnd(seed + 2) * (VIEW_W + 120) - 60
    const y0 = rnd(seed + 3) * (VIEW_H + 140)
    // 风从左边来：雨丝往右下走，落到屏幕外就从顶上补回来
    const y = ((y0 + tt * speed) % (VIEW_H + 140)) - 70
    const x = ((x0 + tt * speed * 0.22) % (VIEW_W + 120)) - 60
    const a = near ? 0.20 + rnd(seed + 4) * 0.18 : 0.07 + rnd(seed + 4) * 0.09
    ctx.fillStyle = `rgba(154,166,184,${a.toFixed(3)})`
    for (let k = 0; k < len; k++) {
      ctx.fillRect(Math.round(x + k * 0.36), Math.round(y + k), 1, 1)
    }
  }
  ctx.restore()
}

/**
 * 糖堡站的前景天气：灯晕 + 雨。必须在瓦片之后调用 ——
 * 雨要落在站台上、灯光要摊在木板上，压在瓦片下面就会被站台整片盖掉。
 */
export function drawStationFore(
  ctx: Ctx,
  camX: number,
  camY: number,
  t: number,
  lamps: LampPos[],
): void {
  drawLampGlow(ctx, camX, camY, t, lamps)
  drawRain(ctx, t)
}

// ============================================================
// 雾中山路：远山 + 更密的树线（中间留一条通往深处的缝）+ 近景树干
//
// 山道的 sky 窗口只有 5 行（80px），所以这一套把地平线压到 78：
// 山脊 30..64，树线根 76..84、高 14..34，树干从画面顶上斜插进来、在雾里断掉。
// 树干是"这一层的近景"，但它仍然画在瓦片之前 —— 不能让树干盖住主角。
// 补上了"树已经封到画面边缘"的那部分，中间的缝留给远处的一盏灯。
// ============================================================

const ROAD_HORIZON = 78

function bakeRoadSky(padX: number, padY: number): Layer {
  return bake(padX, padY, (g, x0, x1) => {
    const sky = g.createLinearGradient(0, -padY, 0, ROAD_HORIZON + 20)
    sky.addColorStop(0, '#05070c')
    sky.addColorStop(0.5, '#0a0f18')
    sky.addColorStop(1, '#131c27')
    g.fillStyle = sky
    g.fillRect(x0, -padY, x1 - x0, ROAD_HORIZON + 20 + padY)
    // 远山：两层，山脊线只在中间那段被雾洗亮 —— 那边是隘口
    const far = (x: number): number =>
      26 + Math.sin(x * 0.0091 + 2.2) * 13
      + Math.sin(x * 0.024 + 0.7) * 6 + Math.sin(x * 0.063 + 3.4) * 2.4
    const near = (x: number): number =>
      46 + Math.sin(x * 0.0067 + 0.9) * 12
      + Math.sin(x * 0.019 + 4.4) * 5 + Math.sin(x * 0.047 + 1.8) * 2
    ridge(g, x0, x1, far, '#0a111b', '#42586f', 0.4, 53)
    ridge(g, x0, x1, near, '#070c13', '#556f88', 0.5, 71)
    // 山脚与隘口的雾：地平的亮带，把树林的根埋进去
    const haze = g.createLinearGradient(0, 44, 0, 96)
    haze.addColorStop(0, 'rgba(111,122,140,0)')
    haze.addColorStop(0.55, 'rgba(111,122,140,0.10)')
    haze.addColorStop(1, 'rgba(90,100,116,0.20)')
    g.fillStyle = haze
    g.fillRect(x0, 44, x1 - x0, 60)
    // 地平线以下：林下黑
    g.fillStyle = '#04060a'
    g.fillRect(x0, ROAD_HORIZON + 16, x1 - x0, VIEW_H + padY)
  })
}

function bakeRoadFirs(padX: number, padY: number): Layer {
  return bake(padX, padY, (g, x0, x1) => {
    g.fillStyle = '#05090b'
    g.fillRect(x0, 40, x1 - x0, VIEW_H + padY)
    // 中间留一条缝：x 158..232 这一段树矮下去，露出后面的雾与远山
    const gapAt = (x: number): number => {
      const d = Math.abs(x - 196)
      if (d > 74) return 0
      return 1 - d / 74 // 0..1，越靠中间越"矮"
    }
    for (let pass = 0; pass < 2; pass++) {
      const far = pass === 0
      const base = far ? 74 : 86
      const hMin = far ? 16 : 26
      const hMax = far ? 32 : 50
      const stepPx = far ? 4 : 6 // 比站台更密：林子里没有空当
      for (let x = x0; x < x1; x += stepPx) {
        const seed = (far ? 4100 : 8100) + Math.round(x) * 17
        const g0 = gapAt(x)
        if (g0 > 0.55 && far) continue       // 缝里后排直接不放
        const jx = Math.round((rnd(seed) - 0.5) * 5)
        const shrink = 1 - g0 * 0.72
        const h = (hMin + rnd(seed + 1) * (hMax - hMin)) * shrink
        const w = (far ? 8 + rnd(seed + 2) * 4 : 11 + rnd(seed + 2) * 7) * shrink
        const by = base + Math.round(rnd(seed + 3) * 4)
        fir(
          g, x + jx, by, h, w, seed,
          far ? '#0a120e' : '#060b09',
          far ? '#111c14' : '#0b120e',
          far ? '#1e2c1c' : '#16241a',
        )
      }
    }
    // 林下：往下渐黑
    const grad = g.createLinearGradient(0, 78, 0, 112)
    grad.addColorStop(0, 'rgba(3,5,6,0)')
    grad.addColorStop(1, 'rgba(3,5,6,0.96)')
    g.fillStyle = grad
    g.fillRect(x0, 78, x1 - x0, 40)
  })
}

/** 近景树干：从画面上缘斜插进来、在雾线（y≈72）上断掉；两粗一细 */
function bakeRoadTrunks(padX: number, padY: number): Layer {
  return bake(padX, padY, (g, x0, x1) => {
    // 树干的位置按层宽铺开：相机走到哪一段，画面两侧都有树封着
    const spots = [-120, 26, 118, 226, 332, 448]
    const drawTrunk = (cx: number, w: number, lean: number, seed: number): void => {
      const fadeBottom = 58 + rnd(seed) * 16
      for (let y = -padY; y < fadeBottom + 26; y++) {
        // 越往下越宽（透视：树是往上收的）
        const p = (y + padY) / (fadeBottom + padY + 26)
        const half = (w / 2) * (0.55 + p * 0.75)
        const ox = cx + Math.round((y - fadeBottom) * lean * 0.06)
        const a = y > fadeBottom ? Math.max(0, 1 - (y - fadeBottom) / 26) : 1
        g.globalAlpha = a
        g.fillStyle = '#05070a'
        g.fillRect(Math.round(ox - half), y, Math.max(1, Math.round(half * 2)), 1)
        // 左缘：一点冷光，树才不是一块剪影
        g.fillStyle = '#131c26'
        g.fillRect(Math.round(ox - half), y, 1, 1)
      }
      g.globalAlpha = 1
      // 横向伸出的枯枝：两段折线，压在雾线上
      for (let b = 0; b < 3; b++) {
        const by = 8 + Math.round(rnd(seed + b * 7) * 46)
        const dir = rnd(seed + b * 11) > 0.5 ? 1 : -1
        const len = 14 + Math.round(rnd(seed + b * 13) * 22)
        for (let i = 0; i < len; i++) {
          const bx = cx + Math.round(dir * i)
          const by2 = by - Math.round(i * (0.12 + rnd(seed + i * 3) * 0.1))
          g.fillStyle = '#05070a'
          g.fillRect(bx, by2, 1, 2)
        }
      }
    }
    // 左右各一棵粗的、中间几棵细的
    for (let i = 0; i < spots.length; i++) {
      const cx = spots[i]
      const wide = i % 2 === 0
      drawTrunk(cx, wide ? 22 : 13, i % 2 === 0 ? 1 : -1, 12000 + i * 31)
    }
    // 底部：树干的根被雾吃掉（与前景的雾带接上）
    const grad = g.createLinearGradient(0, 50, 0, 96)
    grad.addColorStop(0, 'rgba(8,12,18,0)')
    grad.addColorStop(1, 'rgba(8,12,18,0.85)')
    g.fillStyle = grad
    g.fillRect(x0, 50, x1 - x0, 50)
  })
}

let roadBaked = false
let roadSky: Layer
let roadFirs: Layer
let roadTrunks: Layer
let roadFogFar: Layer
let roadFogNear: Layer

function bakeRoad(): void {
  if (roadBaked) return
  const padX = Math.ceil(ROAD_CAM.mx * ROAD_RATE.groundFog) + 6
  const padY = Math.ceil(ROAD_CAM.my * ROAD_RATE.groundFog) + 6
  roadSky = bakeRoadSky(padX, padY)
  roadFirs = bakeRoadFirs(padX, padY)
  roadTrunks = bakeRoadTrunks(padX, padY)
  roadFogFar = bakeFog(VIEW_W, 74, 3.1)
  roadFogNear = bakeFog(VIEW_W, 96, 7.7)
  roadBaked = true
}

/** 远处的一盏灯：在隘口的缝里，慢慢亮、偶尔抖一下（画在树线之后、树干之前） */
function drawDistantLamp(ctx: Ctx, camX: number, camY: number, t: number): void {
  const lx = Math.round(196 - (camX - ROAD_CAM.mx) * ROAD_RATE.ridge)
  const ly = Math.round(56 - (camY - ROAD_CAM.my) * ROAD_RATE.ridge)
  if (lx < -40 || lx > VIEW_W + 40) return
  // 呼吸 + 偶尔的一下抖动：两组不成倍数的正弦
  const breathe = 0.62 + 0.38 * Math.sin(t * 0.0091 + 0.7)
  const flick = 0.72 + 0.28 * Math.sin(t * 0.043 + 1.9) * Math.sin(t * 0.017 + 0.3)
  const a = Math.max(0, breathe * flick)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  // 光晕要够大才看得出"那是一盏灯"：三层，从暖金到近黑的红
  const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 22)
  glow.addColorStop(0, `rgba(242,214,140,${(0.46 * a).toFixed(3)})`)
  glow.addColorStop(0.28, `rgba(200,160,64,${(0.22 * a).toFixed(3)})`)
  glow.addColorStop(0.62, `rgba(140,100,36,${(0.08 * a).toFixed(3)})`)
  glow.addColorStop(1, 'rgba(90,70,30,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(lx, ly, 22, 0, Math.PI * 2)
  ctx.fill()
  // 灯芯：1–2px 的暖白，亮的时候看得出是个火点
  ctx.fillStyle = `rgba(242,214,150,${(0.86 * a).toFixed(3)})`
  ctx.fillRect(lx - 1, ly - 1, 2, 2)
  ctx.fillStyle = `rgba(242,236,224,${(0.55 * a).toFixed(3)})`
  ctx.fillRect(lx, ly, 1, 1)
  ctx.restore()
}

/** 在瓦片之下画山路的三层远景（远山 / 树线 / 近景树干），并补上远处的一盏灯 */
export function drawRoadBackdrop(
  ctx: Ctx,
  camX: number,
  camY: number,
  t: number,
): void {
  bakeRoad()
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#05080d'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  drawLayer(ctx, roadSky, camX, camY, ROAD_RATE.ridge, ROAD_CAM.mx, ROAD_CAM.my)
  drawLayer(ctx, roadFirs, camX, camY, ROAD_RATE.firs, ROAD_CAM.mx, ROAD_CAM.my)
  drawDistantLamp(ctx, camX, camY, t)
  drawLayer(ctx, roadTrunks, camX, camY, ROAD_RATE.trunks, ROAD_CAM.mx, ROAD_CAM.my)
  ctx.restore()
}

/**
 * 山路的前景：贴地的雾 + 脚下的一道暗。
 * 同样必须在瓦片之后 —— 雾要在路面上走，不能压在路面底下。
 */
export function drawRoadFore(ctx: Ctx, camX: number, camY: number, t: number): void {
  bakeRoad()
  ctx.save()
  ctx.imageSmoothingEnabled = false
  drawFogBand(
    ctx, roadFogFar, camX, camY, t, ROAD_RATE.groundFog * 0.8, ROAD_CAM.mx, ROAD_CAM.my,
    150, 0.10, 0.13,
  )
  drawFogBand(
    ctx, roadFogNear, camX, camY, t, ROAD_RATE.groundFog, ROAD_CAM.mx, ROAD_CAM.my,
    186, -0.16, 0.17,
  )
  // 脚下：屏幕底部压暗，路是往下坡去的
  const bottom = ctx.createLinearGradient(0, VIEW_H - 56, 0, VIEW_H)
  bottom.addColorStop(0, 'rgba(4,6,10,0)')
  bottom.addColorStop(1, 'rgba(4,6,10,0.62)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, VIEW_H - 56, VIEW_W, 56)
  ctx.restore()
}
