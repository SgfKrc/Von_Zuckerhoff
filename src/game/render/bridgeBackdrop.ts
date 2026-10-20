// ============================================================
// 石桥远景：四层程序化视差（不依赖任何外部图片）
// ============================================================
//
// 与 render/backdrop.ts 的分工：
//   backdrop.ts 是 gate 的「一张写实图 + 纵向视差 + 降饱和 + 颗粒」；
//   这里是 bridge 的「四层程序化远景」—— 全部用 fillRect 烘焙出来，
//   没有图片素材，所以不吃 public/，也不怕素材缺失。
//
// 四层从远到近，纵向视差系数递增（位移 = camY * rate）：
//   1 远山  0.15   峡谷对面的山脊剪影（近乎黑）+ 山脊线 1px 冷色微光
//   2 雾带  0.30   两层雾片（0.26 / 0.34），横向缓慢漂移，globalAlpha 0.15–0.19
//   3 崖壁  0.55   对岸崖壁的横向层理 + 苔绿 + 时计塔剪影
//   4 谷底  0.75   几乎纯黑的谷底 + 一线冷色反光（水）
//
// 关键是「每一层都纵向可滚动，速度和别人不一样」：
// 玩家沿桥往上走（camY 变小）时，四层以各自的速度往下走，
// 层与层之间的相对位移就是纵深。远景整体压暗、降饱和（只有一个冷蓝色系），
// 桥面（前景瓦片）才跳得出来。
//
// 实现方式：每层先烘焙到一张「比屏幕高一段」的离屏画布（高度 = 视口高 +
// 中值位移 + 余量），每帧只做几次 drawImage —— 不逐帧逐像素重画。
// 位移以 camY 的中值为基准（CAM_MID），所以 24 行地图 0..168 的相机行程
// 正好分布在这张画布的余量里。
// ============================================================
import { VIEW_W, VIEW_H } from '../constants'
import { TILE } from '../art/build'

/** bridge 地图 24 行 × 16px = 384px 高，视口 216px，相机行程 0..168，中值 84 */
const CAM_MID = 84

/** 每层的纵向视差系数（越大越近、动得越快） */
const RATE = {
  ridge: 0.15,
  fog: 0.30,
  cliff: 0.55,
  depth: 0.75,
} as const

/** 固定 seed 的伪随机：烘焙只做一次，颗粒每帧一致，不会闪 */
function rnd(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

interface Layer {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
}

function layer(w: number, h: number): Layer {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  return { canvas, ctx }
}

/** 一层的画布高度：camY 走到两端时，这层仍要盖满屏幕 */
function layerH(rate: number): number {
  return VIEW_H + Math.ceil(CAM_MID * rate) + 8
}

// ============================================================
// 1 远山：逐列填充的山脊剪影 + 山脊线上 1px 冷光
// ============================================================

function bakeRidge(): Layer {
  const h = layerH(RATE.ridge)
  const L = layer(VIEW_W, h)
  const g = L.ctx

  // 夜空：顶部偏冷蓝，往下沉到近黑（远景整体压暗）
  const sky = g.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#0d1626')
  sky.addColorStop(0.42, '#0a1019')
  sky.addColorStop(1, '#070b12')
  g.fillStyle = sky
  g.fillRect(0, 0, VIEW_W, h)

  // 极稀的星：不闪，只给夜空一点颗粒
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(rnd(900 + i * 3.7) * VIEW_W)
    const y = Math.floor(rnd(900 + i * 7.3) * 52)
    g.fillStyle = `rgba(154,166,184,${(0.10 + rnd(900 + i * 5.1) * 0.26).toFixed(3)})`
    g.fillRect(x, y, 1, 1)
  }

  // 两道山脊：远的一道淡、近的一道黑。同属第 1 层，同一个系数 ——
  // 这样远山读作「一层层的山」而不是一条锯齿线。
  const far = (x: number): number =>
    40 + Math.sin(x * 0.0105 + 0.8) * 16
    + Math.sin(x * 0.026 + 2.2) * 6 + Math.sin(x * 0.061 + 1.2) * 3
  const near = (x: number): number =>
    66 + Math.sin(x * 0.0072 + 3.1) * 15
    + Math.sin(x * 0.019 + 0.4) * 6 + Math.sin(x * 0.051 + 5.2) * 2.4

  const ridges: [(x: number) => number, string, string, string][] = [
    [far, '#1a2331', '#4a6280', '#1f2a3b'],
    [near, '#0b111b', '#6b86a8', '#151d29'],
  ]
  for (const [fn, fill, line, glow] of ridges) {
    for (let x = 0; x < VIEW_W; x++) {
      const y0 = Math.round(fn(x))
      g.fillStyle = fill
      g.fillRect(x, y0, 1, h - y0)
      // 山脊下 2px：月光扫过山脊的一点点亮，山才有起伏
      g.fillStyle = glow
      g.fillRect(x, y0 + 1, 1, 1)
      // 山脊线：1px 冷色微光，亮度逐列起伏（受月光的一侧）
      g.globalAlpha = 0.34 + rnd(x * 17 + 11) * 0.62
      g.fillStyle = line
      g.fillRect(x, y0, 1, 1)
      g.globalAlpha = 1
    }
  }
  return L
}

// ============================================================
// 2 雾带：逐像素的像素雾（横向整周期，左右无缝可平铺）
// ============================================================

function bakeFogTex(w: number, h: number, seed: number): Layer {
  const L = layer(w, h)
  const g = L.ctx
  for (let y = 0; y < h; y++) {
    const v = (y / h - 0.5) * 2
    // 纵向：中央浓、上下散开，边缘完全透明 —— 叠在别的层上不出硬边
    const band = Math.exp(-(v * v) / 0.30)
    if (band < 0.015) continue
    for (let x = 0; x < w; x++) {
      const u = (x / w) * Math.PI * 2
      // 三个整周期正弦：x = 0 与 x = w-1 连续，横向平铺无缝
      const n1 = Math.sin(u * 3 + seed) * 0.5 + 0.5
      const n2 = Math.sin(u * 7 + seed * 1.7 + y * 0.09) * 0.5 + 0.5
      const n3 = Math.sin(u * 13 + seed * 2.3 - y * 0.05) * 0.5 + 0.5
      const n = n1 * 0.5 + n2 * 0.32 + n3 * 0.18
      let a = band * (0.24 + n * 0.76)
      // 颗粒：把连续的雾打碎成像素点，和 16 色像素画同一个语言
      a *= 0.55 + rnd(x * 131 + y * 977 + seed * 31) * 0.85
      if (a < 0.02) continue
      const col = n > 0.62 ? '154,166,184' : '111,122,140'
      g.fillStyle = `rgba(${col},${Math.min(1, a).toFixed(3)})`
      g.fillRect(x, y, 1, 1)
    }
  }
  return L
}

// ============================================================
// 3 对岸崖壁：横向层理 + 苔绿 + 时计塔剪影
// ============================================================

/**
 * 崖顶轮廓。
 *
 * 关键：桥正对的方向（屏幕中间）没有崖壁 —— 那里是峡谷的开口，
 * 只有远山、雾和谷底；两侧才是夹着桥的对岸崖壁，崖顶近乎水平、一路向下出画面。
 * 开口边缘的 26px 是崖壁的侧缘（陡落），读作「崖壁的边」，
 * 不是一条平滑的圆弧 —— 圆弧会读成两座土丘。
 */
function cliffAt(x: number): number {
  const d = Math.abs(x - VIEW_W / 2)
  // 开口半径 62px，外面 26px 内从「屏外」抬到崖顶高度
  const t = Math.min(1, Math.max(0, (d - 62) / 26))
  const s = t * t * (3 - 2 * t)
  const raw = 300 - s * 188
    + Math.sin(x * 0.016 + 2.2) * 4
    + Math.sin(x * 0.043 + 1.1) * 3
  // 量化成 7px 的台阶：崖壁是岩层一级一级塌下去的，不是一条平滑的坡
  return Math.round(raw / 7) * 7
}

function bakeTower(g: CanvasRenderingContext2D, cx: number, baseY: number): void {
  const bodyW = 14
  const topW = 10
  const topY = baseY - 56

  // 塔身：下宽上窄的梯形剪影，左缘受光、右缘压暗（一条很细的立体边）
  for (let y = topY; y < baseY; y++) {
    const t = (y - topY) / Math.max(1, baseY - topY)
    const w = Math.round(topW + (bodyW - topW) * t)
    const x0 = Math.round(cx - w / 2)
    g.fillStyle = '#1e2430'
    g.fillRect(x0, y, w, 1)
    g.fillStyle = '#45566d'
    g.fillRect(x0, y, 1, 1)
    g.fillStyle = '#0a0d13'
    g.fillRect(x0 + w - 1, y, 1, 1)
  }

  // 尖顶：八层，逐层收窄
  for (let i = 0; i < 9; i++) {
    const w = Math.max(1, Math.round(bodyW * 0.62) - i)
    g.fillStyle = '#1a2029'
    g.fillRect(Math.round(cx - w / 2), topY - 9 + i, w, 1)
  }

  // 四个圆形凹槽：远景里读不出构造，只读得出「四个洞」
  for (let i = 0; i < 4; i++) {
    const cy = topY + 10 + i * 11
    const r0 = 2
    for (let dy = -r0 - 1; dy <= r0 + 1; dy++) {
      for (let dx = -r0 - 1; dx <= r0 + 1; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d > r0 + 0.6) continue
        g.fillStyle = d > r0 - 0.4 ? '#38455a' : '#06080c'
        g.fillRect(Math.round(cx + dx), Math.round(cy + dy), 1, 1)
      }
    }
  }
}

function bakeCliff(): Layer {
  const h = layerH(RATE.cliff)
  const L = layer(VIEW_W, h)
  const g = L.ctx

  // 崖顶轮廓加 1px 碎石抖动：崖顶不是一条数学曲线，是一道碎石的边
  const edgeAt = (x: number): number => cliffAt(x) + (rnd(x * 29 + 3) > 0.72 ? 1 : 0)

  // 崖顶之上的雾：把崖壁与雾带 / 远山接上，不出现硬边
  for (let x = 0; x < VIEW_W; x++) {
    const y0 = edgeAt(x)
    for (let y = Math.max(0, y0 - 18); y < y0; y++) {
      const k = 1 - (y0 - y) / 18
      g.fillStyle = `rgba(111,122,140,${(0.18 * k * k).toFixed(3)})`
      g.fillRect(x, y, 1, 1)
    }
  }

  // 岩体：逐列填充 → 横向层理 → 苔绿 → 竖裂
  // 崖壁不是一座山：岩壁只向下延续 CLIFF_DEPTH px，下缘化进雾里 ——
  // 再往下是谷底（第 4 层），所以崖脚不能一直填到屏幕底，否则桥会像嵌在山坡里。
  const CLIFF_DEPTH = 118
  for (let x = 0; x < VIEW_W; x++) {
    const y0 = edgeAt(x)
    // 岩面本身的明暗起伏（平滑函数，不是逐列噪点）：崖壁才是一整面岩，不是一块平色
    const tone = Math.sin(x * 0.019 + 2.6) * 0.5 + 0.5
    // 深灰褐：比暖褐更灰一档，远景降饱和；三档只差一点点，是岩面的起伏不是花纹
    const body = tone > 0.66 ? '#1a1712' : (tone > 0.33 ? '#17140f' : '#14120d')

    // 岩体：越往下越暗，崖脚直接沉进雾/谷底
    for (let yy = 0; yy < CLIFF_DEPTH; yy++) {
      const t = yy / CLIFF_DEPTH
      // 下缘 22% 的高度做淡出，与谷底的雾接上，不出现一条硬边
      g.globalAlpha = t > 0.78 ? ((1 - t) / 0.22) ** 2 : 1
      // 崖顶往下 7px 是一条受光的「立面」：有这一条，崖壁才读作竖直的岩壁，
      // 不是一块缓坡的顶面。
      g.fillStyle = t < 0.06 ? '#221e18' : body
      g.fillRect(x, y0 + yy, 1, 1)
      // 岩壁下段压暗：崖脚没有月光
      if (t > 0.62) {
        g.fillStyle = `rgba(4,6,10,${(0.26 * ((t - 0.62) / 0.38)).toFixed(3)})`
        g.fillRect(x, y0 + yy, 1, 1)
      }
      g.globalAlpha = 1
    }
    // 崖顶：1px 冷色受光（月光扫过崖顶草土）
    g.fillStyle = '#26221d'
    g.fillRect(x, y0, 1, 1)
    g.fillStyle = '#1b1813'
    g.fillRect(x, y0 + 1, 1, 1)

    // 横向层理：每 9px 一道暗缝（只画暗的，不画亮的）——
    // 亮线会读成「梯田的等高线」，暗缝才是岩层。
    for (let k = 1; k < 14; k++) {
      const yy = y0 + k * 9 + Math.round(Math.sin(x * 0.09 + k * 1.7) * 1.2)
      if (yy >= y0 + CLIFF_DEPTH - 8) break
      const layer = rnd(x * 19 + k * 71 + 5)
      if (layer < 0.30) continue
      g.fillStyle = '#080705'
      g.fillRect(x, yy, 1, layer > 0.86 ? 2 : 1)
    }

    // 苔绿：只长在崖顶附近，压到近黑绿，不用鲜绿
    const n = rnd(x * 23 + 101)
    if (n > 0.90) {
      const yy = y0 + 2 + Math.floor(rnd(x * 31 + 7) * 22)
      g.fillStyle = '#28331f'
      g.fillRect(x, yy, 1, 1)
      if (n > 0.965) {
        g.fillStyle = '#34422a'
        g.fillRect(x, yy + 1, 1, 1)
      }
    }

    // 竖裂：极短（3px），有竖裂没有竖纹，岩体才不变成砖墙
    if (n < 0.05) {
      const yy = y0 + 8 + Math.floor(rnd(x * 41 + 3) * 40)
      g.fillStyle = '#0b0907'
      g.fillRect(x, yy, 1, 3)
    }
  }

  // 时计塔：立在崖顶，屏幕右缘、桥面之外 —— 桥上抬头就能看见的那座塔
  bakeTower(g, 330, edgeAt(330))
  return L
}

// ============================================================
// 4 谷底：几乎纯黑 + 一线冷色反光
// ============================================================

function bakeDepth(): Layer {
  const h = layerH(RATE.depth)
  const L = layer(VIEW_W, h)
  const g = L.ctx

  // 从崖脚往下渐入纯黑：谷底深到看不清，这是「高处」的来源。
  // 渐变起点压到世界 196：崖壁的层理要能露出来，谷底才在它脚下。
  const grad = g.createLinearGradient(0, 196, 0, 244)
  grad.addColorStop(0, 'rgba(4,6,10,0)')
  grad.addColorStop(0.55, 'rgba(4,6,10,0.86)')
  grad.addColorStop(1, 'rgba(3,4,7,0.99)')
  g.fillStyle = grad
  g.fillRect(0, 196, VIEW_W, h - 196)
  g.fillStyle = '#030407'
  g.fillRect(0, 244, VIEW_W, h - 244)

  // 谷底的低雾：比纯黑亮一点点 —— 黑得「有东西」才读作深，不是读作空
  for (let y = 182; y < 246; y++) {
    const band = Math.sin(((y - 182) / 64) * Math.PI) ** 2
    if (band < 0.03) continue
    for (let x = 0; x < VIEW_W; x++) {
      const u = (x / VIEW_W) * Math.PI * 2
      const n = Math.sin(u * 3 + 1.1) * 0.5 + 0.5
      const a = band * (0.05 + n * 0.10)
      if (a < 0.01) continue
      g.fillStyle = `rgba(24,32,44,${a.toFixed(3)})`
      g.fillRect(x, y, 1, 1)
    }
  }

  // 一线冷色反光：谷底的水。只有 1–2px，断断续续，两端化进黑暗
  const y0 = 212
  for (let x = 0; x < VIEW_W; x++) {
    const k = Math.sin((x / VIEW_W) * Math.PI * 2 * 2 + 0.9) * 0.5 + 0.5
    const grain = rnd(x * 53 + 17)
    // 水面不是一条直线：暗处整段断掉，只有几处反光
    if (grain < 0.18) continue
    const a = (0.16 + k * 0.48) * (0.65 + grain * 0.5)
    g.fillStyle = `rgba(143,158,178,${a.toFixed(3)})`
    g.fillRect(x, y0, 1, 1)
    if (k > 0.78 && grain > 0.6) {
      g.fillStyle = `rgba(190,205,225,${(a * 0.9).toFixed(3)})`
      g.fillRect(x, y0, 1, 2)
    }
    // 反光上方的一点点冷辉，把「水」和「黑」之间接软
    g.fillStyle = `rgba(54,74,94,${(a * 0.55).toFixed(3)})`
    g.fillRect(x, y0 - 3, 1, 3)
    g.fillStyle = `rgba(30,42,56,${(a * 0.32).toFixed(3)})`
    g.fillRect(x, y0 + 1, 1, 3)
  }

  // 谷底两道更暗的岩脊：短段、断续、微微起伏 —— 让黑有一点层次，但看不清楚
  for (const yy of [262, 278]) {
    if (yy >= h) continue
    for (let x = 0; x < VIEW_W; x += 7) {
      const len = 2 + Math.floor(rnd(x * 7 + yy) * 5)
      if (rnd(x * 13 + yy) < 0.45) continue
      const j = Math.round(Math.sin(x * 0.03 + yy) * 1.2)
      g.fillStyle = '#0b0f15'
      g.fillRect(x, yy + j, len, 1)
    }
  }
  return L
}

// ============================================================
// 烘焙与绘制
// ============================================================

let baked = false
let ridgeLayer: Layer
let fogFar: Layer
let fogNear: Layer
let cliffLayer: Layer
let depthLayer: Layer

function bakeAll(): void {
  if (baked) return
  ridgeLayer = bakeRidge()
  fogFar = bakeFogTex(VIEW_W, 72, 1.3)
  fogNear = bakeFogTex(VIEW_W, 58, 4.7)
  cliffLayer = bakeCliff()
  depthLayer = bakeDepth()
  baked = true
}

/** 世界纵向位置 → 屏幕位移：camY 变大（玩家往南走）时远景整体上移 */
function shift(camY: number, rate: number): number {
  return -Math.round((camY - CAM_MID) * rate)
}

/** 一层雾：纵向按自己的系数走，横向按 t 缓慢漂移（贴图左右无缝，平铺两张） */
function drawFogBand(
  ctx: CanvasRenderingContext2D,
  tex: Layer,
  camY: number,
  t: number,
  camX: number,
  rate: number,
  worldY: number,
  speed: number,
  alpha: number,
): void {
  const y = Math.round(worldY - tex.canvas.height / 2 - (camY - CAM_MID) * rate)
  // camX 在 12 格宽的桥上恒定；保留这一项，桥以后加宽时横向也会有微动
  const off = ((t * speed - camX * 0.05) % VIEW_W + VIEW_W) % VIEW_W
  const ox = Math.round(off)
  ctx.globalAlpha = alpha
  ctx.drawImage(tex.canvas, -ox, y)
  ctx.drawImage(tex.canvas, VIEW_W - ox, y)
  ctx.globalAlpha = 1
}

/**
 * 在瓦片之下画石桥的四层视差远景（只在 map.id === 'bridge' 时调用）。
 *
 * @param camX 相机横向坐标 —— 12 格宽的桥上它恒定（地图比视口窄，相机居中）
 * @param camY 相机纵向坐标 —— 四层按各自系数位移，这是纵深感的来源
 * @param t    帧计数（world.t）—— 只用来让雾横向漂移
 */
export function drawBridgeBackdrop(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  t: number,
): void {
  bakeAll()
  ctx.save()
  ctx.imageSmoothingEnabled = false

  // 天空底色：层在两端位移时，屏幕边缘不能露出更下面那张图
  ctx.fillStyle = '#090d14'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  // 1 远山
  ctx.drawImage(ridgeLayer.canvas, 0, shift(camY, RATE.ridge))

  // 2 雾带：远雾慢而高、近雾快而低，两层叠出「雾在谷里流动」
  drawFogBand(ctx, fogFar, camY, t, camX, RATE.fog * 0.87, 96, 0.11, 0.16)
  drawFogBand(ctx, fogNear, camY, t, camX, RATE.fog * 1.13, 168, -0.17, 0.20)

  // 3 对岸崖壁（含时计塔剪影）
  ctx.drawImage(cliffLayer.canvas, 0, shift(camY, RATE.cliff))

  // 4 谷底
  ctx.drawImage(depthLayer.canvas, 0, shift(camY, RATE.depth))

  // 桥体的投影：紧贴桥缘的两侧压暗 —— 桥是一块悬空的板，它的阴影落在深渊上。
  // 桥体在地图里占 x3..8（见 world/maps.ts 的 bridge），这里只用来定位两侧的暗带。
  const leftEdge = Math.round(3 * TILE - camX)
  const rightEdge = Math.round(9 * TILE - camX)
  const shading = 26
  const leftShade = ctx.createLinearGradient(leftEdge - shading, 0, leftEdge, 0)
  leftShade.addColorStop(0, 'rgba(3,5,9,0)')
  leftShade.addColorStop(1, 'rgba(3,5,9,0.66)')
  ctx.fillStyle = leftShade
  ctx.fillRect(leftEdge - shading, 0, shading, VIEW_H)
  const rightShade = ctx.createLinearGradient(rightEdge + shading, 0, rightEdge, 0)
  rightShade.addColorStop(0, 'rgba(3,5,9,0)')
  rightShade.addColorStop(1, 'rgba(3,5,9,0.66)')
  ctx.fillStyle = rightShade
  ctx.fillRect(rightEdge, 0, shading, VIEW_H)

  // 谷底的「无底」：屏幕底部固定压暗，不跟着视差走 ——
  // 无论相机走到哪，脚下都是一片望不到底的暗，这才是站在高处。
  const bottom = ctx.createLinearGradient(0, VIEW_H - 78, 0, VIEW_H)
  bottom.addColorStop(0, 'rgba(4,6,10,0)')
  bottom.addColorStop(0.6, 'rgba(4,6,10,0.55)')
  bottom.addColorStop(1, 'rgba(3,4,7,0.88)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, VIEW_H - 78, VIEW_W, 78)

  ctx.restore()
}
