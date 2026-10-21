// ============================================================
// 章末演出 · 序章的独角戏（约 53 秒）
// ------------------------------------------------------------
// 依据：原作第一章止步于和赫尔曼在大厅谈完 ——「您有足够的时间，少爷。
// 您有一辈子的时间。」这一问一答之后，赫尔曼退下，大厅空下来，
// 只剩他站在壁炉前看着那幅画像。窗外是旗、是山、是莱茵河。
//
// 与 roadEnd.ts / montage.ts 同一付骨架：
//   · renderFrame(g, t) 是纯函数，任意一秒都能直接画出来 —— 跳过靠这条性质；
//   · 384×216 逻辑分辨率，全程序化、零外部素材；
//   · 画法是游戏自己的像素风（不是木刻）：逐行 fillRect、坐标取整、
//     不做位图插值；火光 / 月光 / 灰尘都靠"两种颜色之间插值"逐行铺出来。
//
// 十四段镜头（合计 53s，每段都带一句旁白）
//   1  0.0– 5.0  窗外：铁十字黑秃鹫的旗在夜风里飘（城墙、山脊、深蓝夜空）
//   2  5.0–10.0  远景横移：东弗里斯兰的黑森林，月光从云缝里漏下来
//   3 10.0–15.0  更远：莱茵河，水黑如墨，只有极细的月光碎点
//   4 15.0–19.0  回到室内：他在壁炉前的侧影，火光从下方打上来
//   5 19.0–22.0  艾玛的闪回：她垂下眼睛，嘴没有动
//   6 22.0–25.0  他的脸：侧光，眼睛没有焦点
//   7 25.0–31.0  三个快切（各 2s）：指尖的墨 / 胸口的银胸针 / 火染红的发
//   8 31.0–36.0  仰视：大厅中央的他，背后是三幅画像
//   9 36.0–39.0  他的背影，慢慢走向画像
//  10 39.0–42.0  画像远景（整幅：红发、黑长裙、银胸针）
//  11 42.0–44.0  壁炉的火（一个火花爆开的特写）
//  12 44.0–47.0  画像的脸（近景），嘴角似乎微微上扬
//  13 47.0–50.0  嘴（更近）
//  14 50.0–53.0  嘴的极特写（只剩嘴唇和一点下巴），淡出
//
// 最后 9 秒是**连续推近**，不是三个硬切：
//   nearZoom(t)     150 → 1400（指数曲线：越近越慢，像推轨在减速）
//   nearFocusY(t)   取景中心从脸心滑到嘴唇（0.5 → 0.72）
//   画面里那张脸始终由同一个 paintVictoriaHead() 按 box 重绘，
//   所以放大不会糊；细节按 box 宽度分三档长出来（96px / 320px 两道门槛）。
//   到 53s 时屏幕只覆盖 box 的 15% —— 只剩嘴唇、唇线、一点下巴。
//
// 声音（播放器那边发，这里只给锚点）：
//   0.0  Snd.setScene('night') + setBgm(null) —— 窗外与远景只有夜的低频
//   15.0 setScene('interior') —— 回到大厅，那一层有 58Hz 的呼吸与稀疏的钟
//   其余见 CF_BEATS（闷响、钟、火花的噼啪、嘴唇特写那一记下坠的锯齿）
// ============================================================

type Ctx = CanvasRenderingContext2D

export const CF_W = 384
export const CF_H = 216

/** 全片时长（秒） */
export const CF_TOTAL = 53

/** 跳过时落到的时刻：嘴唇特写的最后一帧（还没被结尾的黑吃掉） */
export const CF_SKIP_AT = 51.8

/** 从"窗外/远景"切回"大厅内部"的时刻：场景音也跟着换 */
export const CF_SCENE_AT = 15.0

// ------------------------------------------------------------
// 镜头表
// ------------------------------------------------------------

export interface CFShot {
  id: string
  t0: number
  t1: number
  /** 旁白（\n 断行；空字符串表示这一段不说话） */
  narration: string
  /** 镜头开场从黑里浮出来（秒） */
  fadeIn?: number
  /** 镜头收尾沉回黑里（秒） */
  fadeOut?: number
}

export const CF_SHOTS: ReadonlyArray<CFShot> = [
  {
    id: 'flag', t0: 0, t1: 5,
    narration: '窗外，铁十字黑秃鹫的旗帜在夜风中飘动。',
    fadeIn: 0.9, fadeOut: 0.3,
  },
  {
    id: 'forest', t0: 5, t1: 10,
    narration: '远处，东弗里斯兰群山的黑森林在月光下沉默。',
    fadeIn: 0.3, fadeOut: 0.3,
  },
  {
    id: 'river', t0: 10, t1: 15,
    narration: '更远处，莱茵河在帝国的腹地流淌，\n河水漆黑，深不见底。',
    fadeIn: 0.3, fadeOut: 0.35,
  },
  {
    id: 'hall', t0: 15, t1: 19,
    narration: '他想起艾玛转述的那句话。',
    fadeIn: 0.45, fadeOut: 0.25,
  },
  {
    id: 'emma', t0: 19, t1: 22,
    narration: '她不曾后悔。',
    fadeIn: 0.5, fadeOut: 0.4,
  },
  {
    id: 'face', t0: 22, t1: 25,
    narration: '他不明白。',
    fadeIn: 0.35, fadeOut: 0.3,
  },
  {
    id: 'closeups', t0: 25, t1: 31,
    narration: '但有一件事他明白——\n他已经不是弗里茨·施密特了。',
    fadeIn: 0.15, fadeOut: 0.3,
  },
  {
    id: 'portraits', t0: 31, t1: 36,
    narration: '他是弗里德里希·冯·祖克霍夫，聚斯霍芬堡的主人，\n祖克霍夫家最后的血裔，卡美洛血脉的继承者。',
    fadeIn: 0.3, fadeOut: 0.3,
  },
  {
    id: 'approach', t0: 36, t1: 39,
    narration: '他不知道这意味着什么。',
    fadeIn: 0.3, fadeOut: 0.25,
  },
  {
    id: 'painting', t0: 39, t1: 42,
    narration: '但他很快就会知道。',
    fadeIn: 0.35, fadeOut: 0.3,
  },
  {
    id: 'fire', t0: 42, t1: 44,
    narration: '',
    fadeIn: 0.3, fadeOut: 0.4,
  },
  {
    // 12–14 是同一段推近：三段的 fadeIn / fadeOut 都关掉，画面一路连着
    id: 'faceNear', t0: 44, t1: 47,
    narration: '那幅画像上，维多利亚·冯·祖克霍夫的\n嘴角似乎微微上扬了一点。',
    fadeIn: 0.4, fadeOut: 0,
  },
  {
    id: 'mouth', t0: 47, t1: 50,
    narration: '像在笑。',
    fadeIn: 0, fadeOut: 0,
  },
  {
    id: 'mouthClose', t0: 50, t1: 53,
    narration: '又像是在等待。',
    fadeIn: 0, fadeOut: 0,
  },
]

/** 音效锚点：播放器按时间发（跳过时不补放） */
export const CF_BEATS: ReadonlyArray<{ t: number; sfx: string }> = [
  { t: 15.0, sfx: 'type' },   // 回到室内：他放下手，一声闷响
  { t: 25.1, sfx: 'type' },   // 快切 · 手
  { t: 27.1, sfx: 'type' },   // 快切 · 胸针
  { t: 29.1, sfx: 'type' },   // 快切 · 红发
  { t: 31.0, sfx: 'bell' },   // 三幅画像：大厅的钟
  { t: 42.5, sfx: 'page' },   // 火花爆开的一声噼啪
  { t: 43.1, sfx: 'type' },   // 柴塌了一下
  { t: 50.0, sfx: 'sting' },  // 嘴唇特写：一记下坠的锯齿（寒气）
]

// ------------------------------------------------------------
// 色板
// ------------------------------------------------------------

const C = {
  night0: '#05070c',
  night1: '#0a1220',
  night2: '#16233a',
  night3: '#24344f',
  moon: '#cfd6df',
  moonDim: '#8d97a6',
  ridgeFar: '#0c1420',
  ridgeMid: '#080e16',
  ridgeNear: '#05090d',
  black: '#03050a',

  wall: '#0d0a0e',
  wallHi: '#1a141b',
  stone: '#2a2028',
  stoneHi: '#3a2c2e',

  fire0: '#ff5a14',
  fire1: '#ff9a2e',
  fire2: '#ffd07a',
  fire3: '#fff4d8',

  brass: '#8a6a2a',
  brassHi: '#c9a14a',
  brassLo: '#3f2f1c',

  skin: '#cbb7a6',
  skinHi: '#e4d2be',
  skinLo: '#9c8a7c',
  hair: '#6e1f18',
  hairHi: '#b8452c',
  hairLo: '#4a1410',
  lip: '#7c2e34',
  lipHi: '#a04a48',
  lipLo: '#4a161c',
  lipGloss: '#d8847a',
  eye: '#2b5f9a',
  eyeWhite: '#b6aa9c',

  canvasBg: '#141018',
  drape: '#241a24',
  drapeLo: '#1b1420',
  canvasLight: '#2c2130',

  steel: '#b9c0cc',
  steelHi: '#eef1f6',
  steelLo: '#6b7482',
  cloth: '#0f0c12',
  bone: '#d8cfc0',
} as const

// ------------------------------------------------------------
// 小工具
// ------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function clamp01(v: number): number {
  return clamp(v, 0, 1)
}

/** 平滑插值（0..1）：淡入淡出与浮现都用它，不要线性 */
function smooth(a: number, b: number, v: number): number {
  const t = clamp01((v - a) / Math.max(1e-6, b - a))
  return t * t * (3 - 2 * t)
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
function rect(g: Ctx, x: number, y: number, w: number, h: number, col: string): void {
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

/** `#rrggbb` / `rgb(...)` → 三个通道 */
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

/** 两种颜色之间插值（逐行铺渐变用）。输入可以是 rgb(...) —— 二层混色不能算出 NaN。 */
function mix(a: string, b: string, p: number): string {
  const [ar, ag, ab] = parseColor(a)
  const [br, bg, bb] = parseColor(b)
  const q = clamp01(p)
  return `rgb(${Math.round(ar + (br - ar) * q)},${Math.round(ag + (bg - ag) * q)},${Math.round(ab + (bb - ab) * q)})`
}

/** 关键点线性插值：[v, 值] 按 v 递增 */
function prof(pts: ReadonlyArray<readonly [number, number]>, v: number): number {
  if (v <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    if (v <= pts[i][0]) {
      const [v0, a] = pts[i - 1]
      const [v1, b] = pts[i]
      const k = (v - v0) / Math.max(1e-6, v1 - v0)
      return a + (b - a) * k
    }
  }
  return pts[pts.length - 1][1]
}

/**
 * 逐屏幕行遍历：只走屏幕上真的看得见的那几行。
 * 推近到 1400px 的 box 时，一次绘制要算上千行，但落在屏幕上的只有 216 行。
 */
function rowsOnScreen(top: number, h: number, fn: (sy: number, v: number) => void): void {
  if (h <= 0) return
  const y0 = Math.max(0, Math.floor(top))
  const y1 = Math.min(CF_H, Math.ceil(top + h))
  for (let sy = y0; sy < y1; sy++) fn(sy, (sy - top) / h)
}

/** 竖直渐变：从 top 到 bot 逐行插值（每 step 行一个色阶，省 fillRect） */
function vGrad(g: Ctx, top: number, bot: number, from: string, to: string, step = 1): void {
  for (let y = Math.floor(top); y < Math.ceil(bot); y += step) {
    rect(g, 0, y, CF_W, step, mix(from, to, (y - top) / Math.max(1e-6, bot - top)))
  }
}

/** 屏幕暗角（中心亮、四角沉）。只用于"现实"镜头，强度克制。 */
function vignette(g: Ctx, strength = 0.55, cx = CF_W / 2, cy = CF_H / 2): void {
  if (strength <= 0.004) return
  const grad = g.createRadialGradient(cx, cy, 44, cx, cy, 250)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.62, `rgba(0,0,0,${(strength * 0.18).toFixed(3)})`)
  grad.addColorStop(1, `rgba(0,0,0,${strength.toFixed(3)})`)
  g.fillStyle = grad
  g.fillRect(0, 0, CF_W, CF_H)
}

// ------------------------------------------------------------
// 字幕：居中、13px 衬线、字距 1px（384 宽一行最多 24 字）
// ------------------------------------------------------------

const SERIF = 'Georgia, "Songti SC", serif'
const CAP_SIZE = 13
const CAP_GAP = 1
const CAP_LINE_H = 18
const CAP_BOTTOM = 196

function spacedWidth(g: Ctx, text: string, gap: number): number {
  const chars = Array.from(text)
  if (chars.length === 0) return 0
  let w = 0
  for (const ch of chars) w += g.measureText(ch).width + gap
  return Math.max(0, w - gap)
}

function paintCentered(g: Ctx, text: string, cx: number, y: number, gap: number): void {
  const w = spacedWidth(g, text, gap)
  let pen = cx - w / 2
  for (const ch of Array.from(text)) {
    g.fillText(ch, Math.round(pen), y)
    pen += g.measureText(ch).width + gap
  }
}

function drawCaption(g: Ctx, text: string, alpha: number): void {
  if (!text || alpha <= 0.004) return
  const lines = text.split('\n').filter(s => s.length > 0)
  if (lines.length === 0) return
  g.save()
  g.globalAlpha = clamp01(alpha)
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.font = `${CAP_SIZE}px ${SERIF}`
  g.fillStyle = '#d2c8b6'
  g.shadowColor = 'rgba(0,0,0,0.82)'
  g.shadowOffsetX = 0
  g.shadowOffsetY = 1
  g.shadowBlur = 2
  const top = CAP_BOTTOM - (lines.length - 1) * CAP_LINE_H
  for (let i = 0; i < lines.length; i++) {
    paintCentered(g, lines[i], CF_W / 2, Math.round(top + i * CAP_LINE_H), CAP_GAP)
  }
  g.restore()
}

/** 这一段旁白此刻的不透明度（镜头内淡入 / 淡出） */
function captionAlpha(shot: CFShot, local: number): number {
  const dur = shot.t1 - shot.t0
  const inA = smooth(0.26, 0.7, local)
  const outAt = Math.max(0.85, dur - 0.45)
  const outA = 1 - smooth(outAt, outAt + 0.45, Math.min(local, dur))
  return clamp01(inA * outA)
}

// ------------------------------------------------------------
// 人物：剪影（侧影 / 背影 / 小像）
// ------------------------------------------------------------

/** 面向右侧的侧影轮廓：[v, 左半宽, 右半宽]（相对身高 h 的比例） */
const SIDE_PROFILE: ReadonlyArray<readonly [number, number, number]> = [
  [0.000, -0.016, 0.016],
  [0.020, -0.048, 0.050],
  [0.050, -0.070, 0.074],   // 额头
  [0.080, -0.074, 0.080],   // 眉
  [0.105, -0.072, 0.094],   // 鼻梁
  [0.125, -0.070, 0.106],   // 鼻尖
  [0.140, -0.068, 0.080],   // 鼻底
  [0.158, -0.064, 0.074],   // 上唇
  [0.172, -0.062, 0.070],   // 下唇
  [0.190, -0.058, 0.062],   // 下巴
  [0.215, -0.040, 0.040],   // 颈
  [0.245, -0.100, 0.080],   // 肩
  [0.290, -0.150, 0.110],
  [0.360, -0.164, 0.124],
  [0.520, -0.172, 0.132],
  [0.740, -0.180, 0.138],
  [1.000, -0.196, 0.150],
]

/** 背对的轮廓（左右对称，后脑 + 肩 + 背）：[v, 半宽] */
const BACK_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.000, 0.018],
  [0.030, 0.052],
  [0.070, 0.072],
  [0.130, 0.078],
  [0.190, 0.074],
  [0.215, 0.044],   // 颈
  [0.245, 0.112],   // 肩
  [0.300, 0.150],
  [0.440, 0.158],
  [0.700, 0.166],
  [1.000, 0.180],
]

/** 把侧影的三列表拆成两条曲线（模块加载时算一次，逐行绘制时不再 map） */
const SIDE_LEFT: ReadonlyArray<readonly [number, number]> =
  SIDE_PROFILE.map(p => [p[0], p[1]] as const)
const SIDE_RIGHT: ReadonlyArray<readonly [number, number]> =
  SIDE_PROFILE.map(p => [p[0], p[2]] as const)

interface FigureOpts {
  /** 中心 x */
  cx: number
  /** 头顶的屏幕 y */
  top: number
  /** 身高（px） */
  h: number
  /** 面朝 / 背对 */
  facing: 'side' | 'back'
  /** 边缘光（0 = 不点） */
  rim?: number
  /** 火光从哪边来：1 = 右边，-1 = 左边 */
  rimSide?: number
  /** 整体颜色（默认近黑） */
  body?: string
}

/**
 * 一个站着的男人。全部是逐行 fillRect：
 * 侧影的鼻子与下巴靠 SIDE_PROFILE 的凹凸读出来；
 * 火光那一侧再描一道 1~2px 的暖色边 —— 有了这道边，剪影才不是一块黑。
 */
function paintFigure(g: Ctx, o: FigureOpts): void {
  const rim = clamp01(o.rim ?? 0)
  const side = o.rimSide ?? 1
  const body = o.body ?? '#05040a'
  const y0 = Math.max(0, Math.floor(o.top))
  const y1 = Math.min(CF_H, Math.ceil(o.top + o.h))
  for (let sy = y0; sy < y1; sy++) {
    const v = clamp01((sy - o.top) / o.h)
    let xl: number
    let xr: number
    if (o.facing === 'back') {
      const half = prof(BACK_PROFILE, v) * o.h
      xl = o.cx - half
      xr = o.cx + half
    } else {
      // 侧影的凹凸表是按"面向右"画的：左列本来就是负数，不要再取反
      const l = prof(SIDE_LEFT, v)
      const r = prof(SIDE_RIGHT, v)
      if (side >= 0) {
        xl = o.cx + l * o.h
        xr = o.cx + r * o.h
      } else {
        xl = o.cx - r * o.h
        xr = o.cx - l * o.h
      }
    }
    rect(g, xl, sy, xr - xl, 1, body)
    // 轮廓线：受光那一侧一道暖边（越低越亮：火在下）
    if (rim > 0.01) {
      const low = clamp01((sy - o.top) / o.h)
      const a = rim * (0.28 + low * 0.72)
      const litX = side >= 0 ? xr - 1 : xl
      g.fillStyle = `rgba(214,120,54,${a.toFixed(3)})`
      g.fillRect(Math.round(litX), sy, 1, 1)
      if (low > 0.3) {
        g.fillStyle = `rgba(255,168,84,${(a * 0.55).toFixed(3)})`
        g.fillRect(Math.round(side >= 0 ? xr - 2 : xl + 1), sy, 1, 1)
      }
    }
  }
  // 头顶：红发的一点点暖色（背对时最明显）
  if (rim > 0.05) {
    const half = (o.facing === 'back' ? prof(BACK_PROFILE, 0.06) : 0.07) * o.h
    g.fillStyle = `rgba(150,58,34,${(rim * 0.5).toFixed(3)})`
    g.fillRect(Math.round(o.cx - half), Math.round(o.top + o.h * 0.02), Math.round(half * 2), 2)
  }
}

// ------------------------------------------------------------
// 维多利亚的头部（画像 / 推近镜头共用）
// ------------------------------------------------------------

interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** 头发外缘（半宽，相对 w） */
const HAIR_OUT: ReadonlyArray<readonly [number, number]> = [
  [0.000, 0.040],
  [0.020, 0.110],
  [0.055, 0.220],
  [0.100, 0.320],
  [0.160, 0.400],
  [0.250, 0.445],
  [0.380, 0.462],
  [0.520, 0.458],
  [0.660, 0.448],
  [0.800, 0.436],
  [1.000, 0.420],
]

/** 脸的外缘（半宽，相对 w；v 相对 box.h） */
const FACE_OUT: ReadonlyArray<readonly [number, number]> = [
  [0.262, 0.055],
  [0.280, 0.132],
  [0.305, 0.196],
  [0.340, 0.228],
  [0.395, 0.245],
  [0.465, 0.248],
  [0.540, 0.242],
  [0.615, 0.230],
  [0.690, 0.212],
  [0.755, 0.184],
  [0.800, 0.150],
  [0.845, 0.105],
  [0.872, 0.055],
  [0.884, 0.000],
]

/**
 * 维多利亚的头部：红发、苍白的脸、深蓝的眼睛、嘴角微微上扬的嘴。
 *
 * box 是"头发外缘"的包围盒。所有几何都按 box 的比例算 ——
 * 于是同一个函数既画得了 54px 的画像小人，也画得了占满屏幕的嘴唇特写；
 * 细节按 box.w 分三档（96 / 320 两道门槛），推近时细节自己长出来。
 *
 * 放大后最容易崩的是"线条"：笔画的粗细如果按 box 比例走，近景会变成一根根色块。
 * 所以鼻梁、唇线、眼睑这些细节的粗细全部用 min(比例, 上限) 夹住，
 * 远看是一条线，近看还是一根像素。
 *
 * @param mood 0 = 平静，1 = 嘴角上扬到这一段的上限
 * @param warm 火光落在这张脸上的强度（0..1，从下方打）
 */
function paintVictoriaHead(g: Ctx, box: Box, mood: number, warm: number): void {
  const w = box.w
  const h = box.h
  const cx = box.x + w * 0.5
  const detail = w > 320 ? 3 : w > 96 ? 2 : 1
  const smile = clamp01(mood)

  // ---- 1) 头发：暗底 → 主体 → 受光侧 ----
  rowsOnScreen(box.y, h, (sy, v) => {
    const half = prof(HAIR_OUT, v) * w
    rect(g, cx - half, sy, half * 2, 1, C.hairLo)
    const inner = Math.max(0, half - Math.max(1, w * 0.012))
    rect(g, cx - inner, sy, inner * 2, 1, C.hair)
    // 受光侧（左侧）一道更亮的发色
    rect(g, cx - inner, sy, Math.max(1, inner * 0.34), 1, C.hairHi)
  })
  // 长发：两侧各一束更深的（垂到画外）
  rowsOnScreen(box.y + h * 0.66, h * 0.34, (sy, v) => {
    const half = prof(HAIR_OUT, 0.66 + v * 0.34) * w
    rect(g, cx - half, sy, Math.max(1, half * 0.26), 1, '#3f100c')
    rect(g, cx + half - Math.max(1, half * 0.26), sy, Math.max(1, half * 0.26), 1, '#2c0c08')
  })
  // 发丝：几道顺着轮廓走的亮线（detail 越高越多）
  if (detail >= 2) {
    for (let i = 0; i < (detail >= 3 ? 7 : 3); i++) {
      const v0 = 0.08 + i * 0.11
      for (let k = 0; k < h * 0.12; k++) {
        const v = v0 + k / (h * 1.4)
        if (v > 0.9) break
        const half = prof(HAIR_OUT, v) * w
        const x = cx - half + half * 0.18 + i * 2
        px(g, x, box.y + v * h, i % 2 === 0 ? '#c4543a' : '#8e2c1c')
      }
    }
  }

  // ---- 2) 脖子（先画，脸压在上面）----
  const neckTop = box.y + h * 0.80
  const neckW = Math.max(2, w * 0.115)
  // 脖子在画面下方很快就沉进暗里（不是一块亮皮肤）
  rowsOnScreen(neckTop, h * 0.12, (sy, v) => {
    const half = neckW * (1 + v * 0.4)
    rect(g, cx - half, sy, half * 2, 1, mix('#8a7868', '#1c1612', Math.pow(v, 0.55)))
  })
  // 下颌投在脖子上的那一道影（极特写里就靠它收住下巴）
  rect(g, cx - neckW, neckTop, neckW * 2, Math.max(1, Math.round(h * 0.016)), '#5e5044')

  // ---- 3) 脸：逐行（四段光：受光 → 亮 → 中间 → 背光）----
  rowsOnScreen(box.y + h * 0.25, h * 0.64, (sy, v) => {
    const vv = 0.25 + v * 0.64
    const half = prof(FACE_OUT, vv) * w
    if (half <= 0.4) return
    const fx = cx - half
    const full = half * 2
    rect(g, fx, sy, full * 0.30, 1, C.skinHi)
    rect(g, fx + full * 0.30, sy, full * 0.28, 1, mix(C.skinHi, C.skin, 0.55))
    rect(g, fx + full * 0.58, sy, full * 0.24, 1, C.skin)
    rect(g, fx + full * 0.82, sy, full * 0.18, 1, C.skinLo)
    // 下颌 / 下巴的暗部（从 0.74 起缓缓变暗，整行覆盖：留下两侧亮边会读成一道横杠）
    if (vv > 0.74) {
      const k = clamp01((vv - 0.74) / 0.15)
      rect(g, fx, sy, full, 1, mix(C.skin, '#6e5c50', 0.04 + k * 0.58))
    }
  })

  // 颧骨的一点暖：火光从下往上
  if (warm > 0.02) {
    rowsOnScreen(box.y + h * 0.56, h * 0.30, (sy, v) => {
      const half = prof(FACE_OUT, 0.56 + v * 0.30) * w
      const a = warm * 0.11 * (0.4 + v * 0.6)
      g.fillStyle = `rgba(214,140,86,${a.toFixed(3)})`
      g.fillRect(Math.round(cx + half * 0.05), sy, Math.round(half * 0.95), 1)
    })
  }

  // ---- 4) 眼睛（深蓝、平静；上眼睑压低一点点）----
  const eyeY = box.y + h * 0.482
  const eyeDX = w * 0.104
  const eyeW = clamp(Math.round(w * 0.070), 3, 24)
  const eyeH = clamp(Math.round(h * 0.017), 2, 6)
  const irisW = clamp(Math.round(eyeW * 0.52), 2, 12)
  const pupilW = Math.max(1, Math.round(irisW * 0.46))
  const browY = box.y + h * 0.440
  const browW = clamp(Math.round(w * 0.076), 3, 26)
  for (const ex of [cx - eyeDX, cx + eyeDX]) {
    // 眼白（压暗：这是画像，不是活人的眼睛）
    rect(g, ex - eyeW / 2, eyeY, eyeW, eyeH, '#b0a496')
    // 虹膜（深蓝）+ 瞳孔
    rect(g, ex - irisW / 2, eyeY, irisW, eyeH, '#24425e')
    rect(g, ex - pupilW / 2, eyeY, pupilW, eyeH, '#0b1118')
    // 上眼睑（两行：眼皮 + 睫毛）
    rect(g, ex - eyeW / 2 - 1, eyeY - 2, eyeW + 2, 2, '#3a2620')
    // 下眼睑
    rect(g, ex - eyeW / 2, eyeY + eyeH, eyeW, 1, '#9a8574')
    // 高光：一个像素，别太亮（画像上的一点漆光）
    if (detail >= 2) px(g, ex - irisW * 0.22, eyeY + 1, '#c4ccd4')
    // 眼尾的一点暖
    if (detail >= 2) px(g, ex + eyeW / 2, eyeY, 'rgba(214,140,86,0.45)')
    if (detail >= 3) {
      // 卧蚕 / 眼下的一点光
      rect(g, ex - eyeW * 0.36, eyeY + eyeH + 2, eyeW * 0.72, 1, '#d0b8a2')
    }
    // ---- 眉毛（红棕，细）----
    rect(g, ex - browW / 2, browY, browW, 2, '#4a1c16')
    if (detail >= 2) rect(g, ex - browW / 2 + 1, browY + 2, browW * 0.7, 1, '#5e2620')
  }

  // ---- 5) 鼻：一条克制的高光 + 鼻尖 + 鼻底的一道软阴影 ----
  const noseTop = box.y + h * 0.545
  const noseBot = box.y + h * 0.665
  const noseW = clamp(Math.round(w * 0.012), 2, 6)
  rect(g, cx - noseW / 2, noseTop, noseW, noseBot - noseTop, '#d6c2ae')
  if (detail >= 2) rect(g, cx - noseW / 2 - 1, noseTop + 2, 1, (noseBot - noseTop) * 0.55, C.skinHi)
  // 鼻尖：横向的一小段（鼻子的圆头）
  const tipH = clamp(Math.round(h * 0.012), 1, 6)
  rect(g, cx - noseW * 1.4, noseBot - tipH, noseW * 2.8, tipH, '#d8c6b2')
  // 鼻底：短、软的一道影（别做成长横杠；颜色只比肤色暗一档，否则读成牙齿）
  rect(g, cx - noseW * 1.6, noseBot, noseW * 3.2, Math.max(1, Math.round(h * 0.006)), '#b8a292')
  if (detail >= 2) {
    // 鼻孔
    const nh = clamp(Math.round(w * 0.006), 1, 2)
    rect(g, cx - noseW * 1.05, noseBot, nh, Math.max(1, Math.round(h * 0.004)), '#8a7466')
    rect(g, cx + noseW * 1.05 - nh, noseBot, nh, Math.max(1, Math.round(h * 0.004)), '#8a7466')
    // 鼻梁右侧的一道极淡的影
    rect(g, cx + noseW, noseTop + (noseBot - noseTop) * 0.45, 1, (noseBot - noseTop) * 0.4, '#b8a292')
  }

  // ---- 6) 嘴：上唇（上窄下宽 + 人中）、唇线、饱满下唇（嘴角微微上扬）----
  const yLine = box.y + h * 0.735
  const mw = w * 0.086
  const upH = Math.max(1, Math.min(Math.round(h * 0.024), Math.round(mw * 0.36)))
  const loH = Math.max(1, Math.min(Math.round(h * 0.036), Math.round(mw * 0.55)))
  const lw = Math.max(1, Math.min(3, Math.round(h * 0.006)))
  // 嘴角上扬的幅度：只是"一点"，不是大笑（最多唇高的四分之一）
  const lift = Math.max(1, Math.round(smile * Math.min(loH * 0.5, h * 0.010)))
  for (let i = 0; i < upH; i++) {
    const v = i / Math.max(1, upH - 1)
    const half = mw * (0.40 + 0.60 * Math.sin(v * Math.PI * 0.5))
    // 上唇贴着唇线画（不要整体上移：留出的缝会读成一条皮肤色的带子）
    rect(g, cx - half, yLine - upH + i, half * 2, 1, C.lip)
    // 人中：上缘中央留一道很浅的缺口（只在前两行，且只在中/近景才画）
    if (detail >= 2 && i < 2) {
      const gap = Math.max(1, Math.round(mw * 0.055))
      rect(g, cx - gap / 2, yLine - upH + i, gap, 1, mix(C.lip, C.skin, 0.5))
    }
  }
  // 唇线：分成 14 段，两端的段往上抬 —— 于是它是一条很浅的"笑"弧。
  // 段与段之间重叠 2px（减去 1 就会露出一条条皮肤，读成一排牙）。
  const SEGS = 14
  for (let i = 0; i <= SEGS; i++) {
    const p = -1 + (2 * i) / SEGS
    const x = cx + p * mw
    const wBar = Math.max(2, Math.round((mw * 2) / SEGS) + 2)
    const up = Math.min(2, Math.round(lift * Math.pow(Math.abs(p), 2.4)))
    rect(g, x - wBar / 2, yLine - up, wBar, lw + up, C.lipLo)
  }
  // 下唇：上宽下窄的弧（sqrt 让下缘圆润）
  for (let i = 1; i <= loH; i++) {
    const v = i / loH
    const half = mw * Math.sqrt(Math.max(0, 1 - v * v * 0.88))
    rect(g, cx - half, yLine + lw + i - 1, half * 2, 1, i <= loH * 0.4 ? C.lipHi : '#8e3a3c')
  }
  // 下唇中央的高光（湿润）
  if (detail >= 2) {
    rect(g, cx - mw * 0.34, yLine + lw + Math.round(loH * 0.22), mw * 0.68, Math.max(1, lw), '#b45c56')
  }
  // 嘴角的一点阴影：把"上扬"钉住（detail>=2）
  if (detail >= 2) {
    px(g, cx - mw - 1, yLine - lift - 1, '#3a1216')
    px(g, cx + mw + 1, yLine - lift - 1, '#3a1216')
  }
  if (detail >= 3) {
    // 唇纹：三道极细的竖线（只在极特写里看得见）
    for (let i = -1; i <= 1; i++) {
      const x = cx + i * mw * 0.34
      rect(g, x, yLine + lw + loH * 0.3, 1, Math.max(1, loH * 0.36), 'rgba(90,26,30,0.38)')
    }
  }

  // ---- 7) 刘海：一束束不规则的垂发压住发际线（不是一条横带）----
  for (let i = 0; i < 12; i++) {
    const fx = cx - w * 0.40 + (w * 0.80 * (i + 0.5)) / 12
    const fw2 = Math.max(1, Math.round(w * 0.026 + hash(i * 17 + 3) * w * 0.014))
    const fl = h * (0.022 + hash(i * 11 + 5) * 0.050)
    const lean = (hash(i * 13 + 7) - 0.5) * 0.7
    for (let k = 0; k < fl; k++) {
      rect(g, fx + lean * k - fw2 / 2, box.y + h * 0.258 + k, fw2, 1, k < fl * 0.45 ? '#4f160f' : '#380e09')
    }
  }
  // 额前的一点受光
  rect(g, cx - w * 0.09, box.y + h * 0.272, w * 0.18, Math.max(1, h * 0.006), 'rgba(224,120,64,0.20)')
}

// ------------------------------------------------------------
// 整幅画像（构图：黄铜框 + 帷幔 + 红发 + 黑长裙 + 银胸针 + 手与书）
// ------------------------------------------------------------

function paintVictoriaPainting(
  g: Ctx, x: number, y: number, w: number, h: number, mood: number, glow: number,
): void {
  const B = Math.max(2, Math.round(w * 0.055))
  const F = Math.max(1, Math.round(w * 0.022))
  const edge = Math.max(1, Math.round(B * 0.45))

  // 外框：黄铜，左上受光、右下压暗
  rect(g, x, y, w, h, C.brass)
  rect(g, x, y, w, edge, C.brassHi)
  rect(g, x, y, edge, h, C.brassHi)
  rect(g, x + w - edge, y, edge, h, C.brassLo)
  rect(g, x, y + h - edge, w, edge, C.brassLo)
  // 框上的一道细线（明暗分界）
  rect(g, x + B - 1, y + B - 1, w - (B - 1) * 2, 1, C.brassLo)
  rect(g, x + B - 1, y + B - 1, 1, h - (B - 1) * 2, C.brassLo)

  // 内框（暗木）
  const ix = x + B
  const iy = y + B
  const iw = w - B * 2
  const ih = h - B * 2
  rect(g, ix, iy, iw, ih, '#241a10')

  // 画面
  const x0 = ix + F
  const y0 = iy + F
  const pw = iw - F * 2
  const ph = ih - F * 2
  if (pw <= 2 || ph <= 2) return
  rect(g, x0, y0, pw, ph, C.canvasBg)
  // 两侧帷幔
  rect(g, x0, y0, pw * 0.13, ph, C.drape)
  rect(g, x0 + pw * 0.87, y0, pw * 0.13, ph, C.drapeLo)
  rect(g, x0, y0, pw, Math.max(1, ph * 0.018), C.canvasLight)
  // 画面底部的暖（火光从下面照到画布上）
  if (glow > 0.01) {
    for (let r = 0; r < ph * 0.28; r += 1) {
      const yy = y0 + ph - r
      const a = glow * 0.10 * (1 - r / (ph * 0.28))
      if (a <= 0.004) continue
      g.fillStyle = `rgba(198,110,52,${a.toFixed(3)})`
      g.fillRect(Math.round(x0), Math.round(yy), Math.round(pw), 1)
    }
  }

  // ---- 人物 ----
  const headW = Math.round(pw * 0.40)
  const head: Box = {
    x: x0 + pw * 0.5 - headW / 2,
    y: y0 + ph * 0.09,
    w: headW,
    h: headW,
  }
  // 肩与黑长裙：从头部下方展开
  const shoulderY = head.y + head.h * 0.92
  const skirtBot = y0 + ph * 0.92
  rowsOnScreen(shoulderY, skirtBot - shoulderY, (sy, v) => {
    const half = pw * (0.24 + v * 0.06)
    rect(g, x0 + pw * 0.5 - half, sy, half * 2, 1, C.cloth)
    // 左肩受光
    rect(g, x0 + pw * 0.5 - half, sy, Math.max(1, half * 0.16), 1, '#191320')
    // 右肩背光
    rect(g, x0 + pw * 0.5 + half * 0.86, sy, Math.max(1, half * 0.14), 1, '#08070b')
  })
  // 胸口：一块小的苍白皮肤 + 暗红领口（小尺寸时只给一个银点，细节会糊成白牙）
  const midX = x0 + pw * 0.5
  if (head.h >= 40) {
    rect(g, midX - pw * 0.028, shoulderY + head.h * 0.04, pw * 0.056, head.h * 0.10, C.bone)
    rect(g, midX - pw * 0.028, shoulderY + head.h * 0.13, pw * 0.056, Math.max(1, head.h * 0.03), '#5e1620')
    // 银胸针（铁十字黑秃鹫）
    paintBrooch(g, midX, shoulderY + head.h * 0.26, Math.max(6, head.h * 0.30), 0)
  } else {
    px(g, midX, shoulderY + head.h * 0.18, C.steel)
    px(g, midX - 1, shoulderY + head.h * 0.18, C.steelLo)
    px(g, midX + 1, shoulderY + head.h * 0.18, C.steelHi)
  }

  // 脸与头发（最后画，压住肩线）
  paintVictoriaHead(g, head, mood, glow)

  // 交叠在腹前的手 + 一本合拢的书
  const handY = y0 + ph * 0.74
  rect(g, x0 + pw * 0.5 - pw * 0.075, handY, pw * 0.15, head.h * 0.06, C.bone)
  rect(g, x0 + pw * 0.5 - pw * 0.075, handY, pw * 0.15, 1, '#f0e8dc')
  rect(g, x0 + pw * 0.5 - pw * 0.010, handY + head.h * 0.04, pw * 0.085, head.h * 0.05, C.bone)
  // 书：暗红封皮 + 金色的书脊
  const bookY = handY + head.h * 0.09
  rect(g, x0 + pw * 0.5 - pw * 0.10, bookY, pw * 0.20, head.h * 0.18, '#3a1418')
  rect(g, x0 + pw * 0.5 - pw * 0.10, bookY, pw * 0.20, Math.max(1, head.h * 0.03), C.brassHi)
  rect(g, x0 + pw * 0.5 - pw * 0.10, bookY, Math.max(1, pw * 0.02), head.h * 0.18, '#6a3038')

  // 清漆的反光：一道极淡的斜光，只落在画面右下角（不穿过脸）
  g.fillStyle = 'rgba(255,252,240,0.028)'
  for (let r = 0; r < ph * 0.44; r++) {
    const xx = x0 + pw * 0.62 + r * 0.34
    if (xx < x0 || xx > x0 + pw) continue
    g.fillRect(Math.round(xx), Math.round(y0 + ph * 0.55 + r), 8, 1)
  }
  // 画框内缘的一道暖光（火从下方来）
  if (glow > 0.05) {
    g.fillStyle = `rgba(232,150,72,${(glow * 0.16).toFixed(3)})`
    g.fillRect(Math.round(x + B), Math.round(y + h - B - 1), Math.round(w - B * 2), 1)
  }
}

/** 银胸针：铁十字 + 展开的黑秃鹫（尺寸很小，只读轮廓） */
function paintBrooch(g: Ctx, cx: number, cy: number, size: number, t: number): void {
  const s = Math.max(3, Math.round(size))
  const half = s / 2
  // 十字臂要窄：宽了就成了一个方块
  const arm = Math.max(1, Math.round(s * 0.20))
  // 银十字：竖臂 + 横臂
  rect(g, cx - arm / 2, cy - half, arm, s, C.steel)
  rect(g, cx - half, cy - arm / 2, s, arm, C.steel)
  // 四端张开一点（铁十字的臂端比腰部宽）
  const foot = Math.max(1, Math.round(s * 0.09))
  rect(g, cx - arm / 2 - foot, cy - half, arm + foot * 2, Math.max(1, Math.round(s * 0.10)), C.steel)
  rect(g, cx - arm / 2 - foot, cy + half - Math.max(1, Math.round(s * 0.10)), arm + foot * 2, Math.max(1, Math.round(s * 0.10)), C.steel)
  rect(g, cx - half, cy - arm / 2 - foot, Math.max(1, Math.round(s * 0.10)), arm + foot * 2, C.steel)
  rect(g, cx + half - Math.max(1, Math.round(s * 0.10)), cy - arm / 2 - foot, Math.max(1, Math.round(s * 0.10)), arm + foot * 2, C.steel)
  // 高光与暗边：金属的立体感（左上受光）
  rect(g, cx - arm / 2, cy - half, 1, s, C.steelHi)
  rect(g, cx - half, cy - arm / 2, s, 1, C.steelHi)
  rect(g, cx + arm / 2 - 1, cy - half, 1, s, C.steelLo)
  rect(g, cx - half, cy + arm / 2 - 1, s, 1, C.steelLo)

  // ---- 秃鹫：两翼向下张开，身体在十字中央 ----
  const wing = Math.max(2, Math.round(s * 0.26))
  const bodyW = Math.max(1, Math.round(s * 0.09))
  for (let i = 0; i < wing; i++) {
    const v = i / Math.max(1, wing - 1)
    const yTop = cy - s * 0.10 + v * v * s * 0.12
    const hgt = Math.max(1, Math.round(s * 0.13 * (1 - v * 0.75)))
    rect(g, cx - arm * 0.7 - i, yTop, 1, hgt, '#232933')
    rect(g, cx + arm * 0.7 + i, yTop, 1, hgt, '#232933')
    if (v > 0.6) {
      px(g, cx - arm * 0.7 - i, yTop, '#414c5c')
      px(g, cx + arm * 0.7 + i, yTop, '#414c5c')
    }
  }
  // 身体
  rect(g, cx - bodyW, cy - s * 0.10, bodyW * 2, s * 0.17, '#1a1f27')
  // 头（偏左，秃鹫的头是低着的）
  rect(g, cx - bodyW - Math.round(s * 0.02), cy - s * 0.17, bodyW * 2, s * 0.08, '#1f242e')
  px(g, cx - bodyW - Math.round(s * 0.02), cy - s * 0.17, '#545f70')
  // 喙
  px(g, cx + bodyW + Math.round(s * 0.02), cy - s * 0.13, '#a9b2c0')
  // 尾
  rect(g, cx - bodyW, cy + s * 0.07, bodyW * 2, s * 0.07, '#151a22')

  // 火光的闪：随时间极慢地走过（不是闪烁的高光）
  if (t > 0) {
    const a = 0.10 + 0.06 * Math.sin(t * 1.7)
    g.fillStyle = `rgba(255,226,170,${a.toFixed(3)})`
    g.fillRect(Math.round(cx - arm / 2), Math.round(cy - half), 1, Math.max(1, Math.round(s * 0.4)))
  }
}

// ============================================================
// 镜头 1 · 窗外：铁十字黑秃鹫的旗（0–5s）
// ============================================================

function paintFlagShot(g: Ctx, t: number, u: number): void {
  // 夜空：顶上的近黑一路压到地平线上的一线冷光
  vGrad(g, 0, 158, '#03050a', '#101a2a', 1)
  // 右上角的月光（被云洗过的一团冷光，不是月亮本身）
  const moonGlow = g.createRadialGradient(330, 26, 4, 330, 26, 120)
  moonGlow.addColorStop(0, 'rgba(150,168,194,0.16)')
  moonGlow.addColorStop(1, 'rgba(150,168,194,0)')
  g.fillStyle = moonGlow
  g.fillRect(0, 0, CF_W, 170)
  // 云：两条极暗的横带，慢慢往左移
  for (let i = 0; i < 2; i++) {
    const cy = 30 + i * 26
    const drift = ((u * 9 + i * 60) % (CF_W + 120)) - 60
    g.fillStyle = `rgba(4,7,13,${(0.46 - i * 0.12).toFixed(3)})`
    for (let x = 0; x < CF_W; x += 3) {
      const wob = Math.sin((x + drift) * 0.018 + i * 2.1) * 4
      g.fillRect(x, Math.round(cy + wob), 3, 12 + i * 5)
    }
  }
  // 星：稀，只有几颗
  for (let i = 0; i < 30; i++) {
    const x = Math.round(hash(i * 7 + 1) * CF_W)
    const y = Math.round(hash(i * 11 + 3) * 112) + 3
    const a = 0.07 + hash(i * 13 + 5) * 0.20
    px(g, x, y, `rgba(178,194,214,${a.toFixed(3)})`)
  }
  // 远处山脊（两层）
  for (let x = 0; x < CF_W; x++) {
    const y1 = Math.round(122 + Math.sin(x * 0.013 + 0.7) * 7 + Math.sin(x * 0.031 + 2.1) * 3)
    rect(g, x, y1, 1, 158 - y1, C.ridgeFar)
    const y2 = Math.round(138 + Math.sin(x * 0.017 + 3.4) * 5 + Math.sin(x * 0.041 + 0.9) * 2)
    rect(g, x, y2, 1, 158 - y2, C.ridgeMid)
    // 山脊上的一点月光边缘（只擦靠月的那一侧）
    if (hash(x * 3 + 7) > 0.66) px(g, x, y2, '#24364a')
  }
  // 中景：城墙（一道黑，顶上有雉堞）
  rect(g, 0, 158, CF_W, CF_H - 158, '#05080e')
  for (let x = -6; x < CF_W + 12; x += 24) {
    const hh = 8 + Math.round(hash(x) * 3)
    rect(g, x, 158 - hh, 14, hh, '#05080e')
    rect(g, x, 158 - hh, 14, 1, '#16202e')
    px(g, x, 158 - hh, '#26374a')
  }
  rect(g, 0, 158, CF_W, 1, '#16202e')

  // ---- 旗杆 ----
  const POLE_X = 208
  const POLE_TOP = 38
  const POLE_BOT = 176
  rect(g, POLE_X, POLE_TOP, 2, POLE_BOT - POLE_TOP, '#141a22')
  rect(g, POLE_X, POLE_TOP, 1, POLE_BOT - POLE_TOP, '#39434f')
  // 杆顶的矛尖
  for (let i = 0; i < 5; i++) {
    rect(g, POLE_X - i * 0.5, POLE_TOP - 5 + i, 2 + i, 1, '#45505e')
  }

  // ---- 旗面：每行的右端跟着风摆 ----
  const FLAG_X = POLE_X + 2
  const FLAG_Y = 42
  const FLAG_W = 112
  const FLAG_H = 76
  const shiftAt = (row: number): number => {
    const v = row / FLAG_H
    return Math.round(Math.sin(t * 2.05 + v * 3.3) * 5 + Math.sin(t * 3.6 + v * 7.1) * 2.2)
  }
  for (let r = 0; r < FLAG_H; r++) {
    const v = r / FLAG_H
    const sh = shiftAt(r)
    // 旗尾略收窄；最上缘与最下缘各被风吹薄一点
    const tail = Math.round(FLAG_W - v * 10 - Math.abs(v - 0.5) * 4)
    const right = FLAG_X + tail + sh
    // 旗面比夜空亮一档：这是一块布，不是一块夜
    rect(g, FLAG_X, FLAG_Y + r, right - FLAG_X, 1, '#171c25')
    // 布纹：横向的明暗（一道亮褶、一道暗褶）
    rect(g, FLAG_X, FLAG_Y + r, right - FLAG_X, 1, v < 0.30 ? '#1b212b' : v < 0.62 ? '#141922' : '#111620')
    // 上缘与下缘的月光
    if (r < 2) rect(g, FLAG_X, FLAG_Y + r, right - FLAG_X, 1, '#323c4a')
    if (r === FLAG_H - 1) rect(g, FLAG_X, FLAG_Y + r, right - FLAG_X, 1, '#232c38')
    // 三道纵向的褶皱高光（随行偏移，所以它在飘）
    for (let k = 0; k < 3; k++) {
      const fx = FLAG_X + FLAG_W * (0.24 + k * 0.25) + Math.round(sh * 0.6)
      if (fx < FLAG_X || fx > right - 1) continue
      const a = 0.16 + 0.08 * Math.sin(t * 2.7 + k * 2.1 + v * 3)
      g.fillStyle = `rgba(118,136,160,${a.toFixed(3)})`
      g.fillRect(Math.round(fx), FLAG_Y + r, 2, 1)
    }
    // 旗尾的一道受光边（布的边缘在风里翻起来）
    px(g, right - 1, FLAG_Y + r, '#4a5666')
    px(g, right, FLAG_Y + r, 'rgba(20,24,32,0.85)')
  }

  // ---- 纹样：铁十字（银灰，收腰的那种）----
  const CROSS_X = FLAG_X + 54
  const CROSS_Y = FLAG_Y + 38
  const ARM = 22
  const THICK = 8
  for (let r = 0; r < ARM * 2; r++) {
    const row = FLAG_Y + (CROSS_Y - FLAG_Y) - ARM + r
    const sh = shiftAt(clamp(row - FLAG_Y, 0, FLAG_H - 1))
    const dy = Math.abs(r - ARM)
    // 横臂：只在中间 8 行；越靠上下越窄（十字臂的收腰）
    if (dy <= THICK / 2) {
      const inset = Math.round(dy * 0.6)
      rect(g, CROSS_X - ARM + sh + inset, row, ARM * 2 - inset * 2, 1, '#b7bfcc')
      px(g, CROSS_X - ARM + sh + inset, row, '#e9edf4')
      px(g, CROSS_X + ARM - inset - 1 + sh, row, '#7d8796')
    }
    // 竖臂：整条；两端略收
    const vArm = Math.min(THICK / 2 + 1, 4 + Math.round((ARM - dy) * 0.18))
    rect(g, CROSS_X - vArm + sh, row, vArm * 2, 1, '#b7bfcc')
    rect(g, CROSS_X - vArm + sh, row, 1, 1, '#e9edf4')
    rect(g, CROSS_X + vArm - 1 + sh, row, 1, 1, '#7d8796')
  }

  // ---- 黑秃鹫：立在十字上臂的上方（纹章式），双翼向下张开 ----
  //   压在十字中央会把十字切成四块、自己也看不清 —— 所以放在上方，
  //   再用一圈银边把鸟从黑旗面上"剪"出来。
  const vx = CROSS_X + Math.round(shiftAt(24) * 0.8)
  const vy = CROSS_Y - 17
  for (let i = 0; i < 14; i++) {
    const t2 = i / 13
    const yTop = vy - 2 + Math.round(t2 * 7)
    const hgt = Math.max(1, Math.round(6 - t2 * 4))
    rect(g, vx - 2 - i, yTop, 2, hgt, '#2b323e')
    rect(g, vx + 2 + i, yTop, 2, hgt, '#2b323e')
    px(g, vx - 2 - i, yTop, i > 7 ? '#8a94a6' : '#5a657a')
    px(g, vx + 2 + i, yTop, i > 7 ? '#8a94a6' : '#5a657a')
  }
  // 身体 / 头 / 尾（头上点一针银，喙向左）
  rect(g, vx - 2, vy - 5, 5, 9, '#1f242e')
  rect(g, vx - 1, vy - 9, 4, 4, '#232a34')
  px(g, vx - 1, vy - 9, '#8a94a6')
  px(g, vx - 3, vy - 7, '#b7bfcc')   // 喙
  rect(g, vx - 1, vy + 4, 4, 4, '#191e26')

  // 空气里的碎屑（几点，向右飘）
  for (let i = 0; i < 7; i++) {
    const x = ((u * (26 + i * 9) + i * 53) % (CF_W + 40)) - 20
    const y = 84 + Math.sin(u * 2 + i) * 16 + i * 9
    px(g, x, y, `rgba(140,154,176,${(0.10 + hash(i) * 0.12).toFixed(3)})`)
  }

  vignette(g, 0.62, 240, 96)
}

// ============================================================
// 镜头 2 · 黑森林（5–10s）
// ============================================================

/** 一棵冷杉的剪影：三层三角 + 树尖 */
function firSil(g: Ctx, x: number, baseY: number, h: number, w: number, body: string, rim: string): void {
  const tiers = 3
  const th = Math.max(2, Math.round(h / tiers))
  for (let tier = 0; tier < tiers; tier++) {
    const y0 = baseY - h + tier * th
    const ww = Math.max(2, Math.round((w * (tier + 1)) / tiers))
    const rows = tier === tiers - 1 ? th + 2 : th
    for (let row = 0; row < rows; row++) {
      const rw = Math.max(1, Math.round((ww * (row + 1)) / rows))
      rect(g, x - rw / 2, y0 + row, rw, 1, body)
      if (hash(x * 3 + row * 7 + tier) > 0.80) px(g, x - rw / 2, y0 + row, rim)
    }
    // 层底的针叶锯齿
    for (let k = 0; k < ww; k += 2) px(g, x - ww / 2 + k, y0 + rows, body)
  }
  px(g, x, baseY - h - 1, rim)
}

function paintForestShot(g: Ctx, t: number, u: number): void {
  const shift = u * 96
  // 夜空
  vGrad(g, 0, 132, '#03050a', '#0b1521', 1)
  // 云带：三条，比旗帜那段厚（山里的云压得低）
  for (let i = 0; i < 3; i++) {
    const cy = 22 + i * 20
    const drift = ((u * 14 + i * 90) % (CF_W + 160)) - 80
    for (let x = 0; x < CF_W; x += 3) {
      const wob = Math.sin((x + drift) * 0.014 + i * 1.7) * 5
      g.fillStyle = `rgba(4,7,12,${(0.34 - i * 0.08).toFixed(3)})`
      g.fillRect(x, Math.round(cy + wob), 3, 10 + i * 6)
    }
  }
  // 月亮：被云缝切成两半（右上方）
  const mx = 302
  const my = 40
  const mr = 10
  const halo = g.createRadialGradient(mx, my, 4, mx, my, 56)
  halo.addColorStop(0, 'rgba(160,176,200,0.20)')
  halo.addColorStop(1, 'rgba(160,176,200,0)')
  g.fillStyle = halo
  g.fillRect(mx - 58, my - 58, 116, 116)
  for (let y = -mr; y <= mr; y++) {
    for (let x = -mr; x <= mr; x++) {
      if (x * x + y * y > mr * mr + 2) continue
      // 上半部被薄云遮住：不是缺一块，是暗一档
      px(g, mx + x, my + y, y < -3 ? '#5c6675' : y < 2 ? '#8a94a4' : C.moonDim)
    }
  }
  // 月光从云缝里漏下来：三道很宽的斜光（不是一排直线，越往下越散）
  for (let i = 0; i < 3; i++) {
    const x0 = 276 + i * 20
    const a = 0.022 + hash(i * 7 + 1) * 0.022
    for (let r = 0; r < 160; r++) {
      const yy = 50 + r
      if (yy > 150) break
      const xx = x0 + r * 0.30 + Math.sin(r * 0.05 + i) * 3
      const w = Math.round(5 + r * 0.10)
      g.fillStyle = `rgba(150,170,196,${(a * (1 - r / 160)).toFixed(3)})`
      g.fillRect(Math.round(xx), yy, w, 1)
    }
  }

  // 远山脊：整片山从画面中腰压下来，森林才有"层层叠叠"的余地
  for (let x = 0; x < CF_W; x++) {
    const y = Math.round(100 + Math.sin(x * 0.011 + 1.2) * 10 + Math.sin(x * 0.027 + 2.8) * 5)
    rect(g, x, y, 1, CF_H - y, '#0a1319')
    if (hash(x * 5 + 3) > 0.66) px(g, x, y, '#1b2a36')
  }

  // 四层冷杉：视差不同，越近越快、越黑、越高
  interface Layer { baseY: number; step: number; hMin: number; hMax: number; w: number; speed: number; body: string; rim: string }
  const layers: Layer[] = [
    { baseY: 112, step: 6, hMin: 14, hMax: 26, w: 11, speed: 0.35, body: '#0b151b', rim: '#1a2830' },
    { baseY: 148, step: 9, hMin: 28, hMax: 50, w: 17, speed: 0.55, body: '#071013', rim: '#111e22' },
    { baseY: 180, step: 13, hMin: 48, hMax: 80, w: 23, speed: 0.80, body: '#040a0b', rim: '#0a1517' },
    { baseY: 224, step: 20, hMin: 78, hMax: 120, w: 32, speed: 1.06, body: '#020606', rim: '#060f10' },
  ]
  for (let li = 0; li < layers.length; li++) {
    const L = layers[li]
    const off = (shift * L.speed) % L.step
    for (let k = -1; k * L.step - off < CF_W + L.step; k++) {
      const x = k * L.step - off + hash(k * 17 + li * 53) * L.step * 0.5
      if (x < -24 || x > CF_W + 24) continue
      const h = L.hMin + hash(k * 31 + li * 71) * (L.hMax - L.hMin)
      const base = L.baseY + hash(k * 13 + li * 29) * 10
      firSil(g, x, base, h, L.w * (0.8 + hash(k * 41 + li) * 0.4), L.body, L.rim)
    }
  }
  // 近景两侧各一棵大树：给"他站在林边"一个尺度
  firSil(g, 26, 236, 150, 46, '#010404', '#050b0c')
  firSil(g, 360, 240, 132, 40, '#010404', '#050b0c')
  // 脚下的一层暗（树根）
  vGrad(g, 206, CF_H, 'rgba(2,5,4,0)', '#010303', 2)
  vignette(g, 0.6, 300, 110)
}

// ============================================================
// 镜头 3 · 莱茵河（10–15s）
// ============================================================

function paintRiverShot(g: Ctx, t: number, u: number): void {
  const HORIZON = 96

  // ---- 天：比前两段更暗，云散了一点 ----
  vGrad(g, 0, HORIZON + 8, '#03050a', '#0e1a28', 1)
  for (let i = 0; i < 30; i++) {
    const x = Math.round(hash(i * 5 + 2) * CF_W)
    const y = Math.round(hash(i * 9 + 4) * 84) + 3
    const a = 0.05 + hash(i * 11 + 6) * 0.14
    px(g, x, y, `rgba(168,184,204,${a.toFixed(3)})`)
  }
  // 薄云：两条，压得很低
  for (let i = 0; i < 2; i++) {
    const cy = 26 + i * 18
    const drift = ((u * 6 + i * 120) % (CF_W + 200)) - 100
    for (let x = 0; x < CF_W; x += 4) {
      const wob = Math.sin((x + drift) * 0.012 + i * 2.3) * 4
      g.fillStyle = `rgba(5,8,13,${(0.30 - i * 0.10).toFixed(3)})`
      g.fillRect(x, Math.round(cy + wob), 4, 8 + i * 4)
    }
  }
  // 月亮：很小、很远（它只是这条河上碎光的来源）
  const mx = 324
  const my = 24
  const halo = g.createRadialGradient(mx, my, 2, mx, my, 46)
  halo.addColorStop(0, 'rgba(170,186,208,0.20)')
  halo.addColorStop(1, 'rgba(170,186,208,0)')
  g.fillStyle = halo
  g.fillRect(mx - 48, my - 48, 96, 96)
  for (let y = -6; y <= 6; y++) {
    for (let x = -6; x <= 6; x++) {
      if (x * x + y * y > 38) continue
      px(g, mx + x, my + y, y < -1 ? '#6a7484' : y < 2 ? '#a6b2c2' : C.moonDim)
    }
  }

  // ---- 对岸：无边的暗色平原 ----
  for (let x = 0; x < CF_W; x++) {
    const y = Math.round(HORIZON + Math.sin(x * 0.021 + 0.6) * 2 + Math.sin(x * 0.047 + 1.9) * 1.5)
    rect(g, x, y, 1, CF_H - y, '#05090b')
  }
  // 地平线上的一线冷光（把天与平原分开）
  for (let x = 0; x < CF_W; x++) {
    const y = Math.round(HORIZON + Math.sin(x * 0.021 + 0.6) * 2)
    if (hash(x * 3 + 1) > 0.55) px(g, x, y - 1, '#152230')
    if (hash(x * 3 + 2) > 0.85) px(g, x, y - 2, '#1d2c3c')
  }
  // 对岸的几棵树 / 一座教堂的尖顶（黑剪影，逆着天光）
  const skyline: Array<[number, number, number]> = [
    [26, 11, 1], [48, 7, 1], [74, 14, 1], [96, 8, 1],
    [250, 10, 1], [268, 7, 1], [296, 9, 1],
  ]
  for (const [x, h] of skyline) {
    for (let k = 0; k < h; k++) {
      const w = Math.max(1, Math.round((1 - k / h) * 5))
      rect(g, x - w / 2, HORIZON + 1 - k, w, 1, '#03060a')
    }
  }
  // 教堂尖塔
  for (let k = 0; k < 22; k++) {
    const w = Math.max(1, Math.round((1 - k / 22) * 7))
    rect(g, 176 - w / 2, HORIZON + 1 - k, w, 1, '#03060a')
  }
  px(g, 175, HORIZON - 24, '#233444')
  px(g, 173, HORIZON - 18, '#1c2a38')

  // ---- 河：从画面左下（近、宽）斜流到右上（远、窄）----
  const riverTop = (x: number): number => 116 - (x / CF_W) * 20
  const riverBot = (x: number): number => 220 - (x / CF_W) * 104
  for (let x = 0; x < CF_W; x++) {
    const y0 = riverTop(x)
    const y1 = riverBot(x)
    const hgt = Math.max(2, y1 - y0)
    rect(g, x, y0, 1, hgt, '#010207')
    // 天空的反射：靠远岸的一段极暗的蓝，往下两段就吃掉 —— 深不见底
    const band = Math.max(2, Math.min(10, hgt * 0.34))
    rect(g, x, y0, 1, band, '#0b1824')
    rect(g, x, y0 + band, 1, Math.max(1, band * 0.7), '#050c14')
    // 两岸的水线：极细的一道冷光
    px(g, x, y0, '#1e3040')
    px(g, x, y1, '#101e2a')
  }
  // 河面：月亮那一条倒影的碎光（只在靠月的一侧，极细、几乎不动）
  for (let i = 0; i < 90; i++) {
    const rx = 250 + hash(i * 13 + 3) * 134
    const p = clamp01((rx - 250) / 134)
    const y0 = riverTop(rx)
    const y1 = riverBot(rx)
    const ry = y0 + 2 + hash(i * 17 + 5) * Math.max(2, (y1 - y0) * 0.9)
    const wob = Math.sin(t * 0.30 + i * 1.7) * 1.4
    const tw = 0.5 + 0.5 * Math.sin(t * 0.8 + i * 1.3)
    const a = (0.05 + tw * 0.24) * (0.45 + (1 - p) * 0.55)
    px(g, rx + wob, ry, `rgba(186,202,224,${a.toFixed(3)})`)
    if (hash(i * 7) > 0.72 && tw > 0.55) px(g, rx + wob + 1, ry, `rgba(186,202,224,${(a * 0.55).toFixed(3)})`)
  }
  // 河心的几道暗涌（比河面更黑：深不见底）
  for (let i = 0; i < 4; i++) {
    for (let x = 0; x < CF_W; x++) {
      const y = riverTop(x) + 4 + i * 5 + Math.sin(x * 0.03 + t * 0.2 + i) * 2
      if (y >= riverBot(x)) continue
      g.fillStyle = 'rgba(0,0,0,0.45)'
      g.fillRect(x, Math.round(y), 1, 1)
    }
  }

  // ---- 近岸：画面底部的黑岸与草（给"他站在岸边"一个尺度）----
  for (let x = 0; x < CF_W; x++) {
    rect(g, x, riverBot(x), 1, CF_H - riverBot(x), '#030605')
  }
  // 岸边的草：贴着水线往上长
  for (let i = 0; i < 70; i++) {
    const x = Math.round(hash(i * 7 + 3) * CF_W)
    const baseY = riverBot(x)
    const h = 4 + Math.round(hash(i * 11 + 5) * 12)
    for (let k = 0; k < h; k++) {
      const lean = Math.sin(k * 0.6 + i) * 1.6
      px(g, x + lean, baseY - k, k < h * 0.5 ? '#06100c' : '#04100a')
    }
  }
  // 水线上的几粒碎石反光
  for (let i = 0; i < 22; i++) {
    const x = Math.round(hash(i * 19 + 7) * CF_W)
    px(g, x, riverBot(x) + 1 + Math.round(hash(i * 23) * 2), 'rgba(120,136,154,0.20)')
  }

  vignette(g, 0.68, 300, 120)
}

// ============================================================
// 镜头 4 · 大厅：壁炉前的侧影（15–19s）
// ============================================================

/** 壁炉：炉台、石砌炉膛、里面的一团火。返回火光中心（给光晕用） */
function paintFireplace(g: Ctx, t: number, fx: number, fy: number, fw: number, fh: number): { x: number; y: number } {
  // 炉台（一条亮石）
  rect(g, fx - fw * 0.12, fy, fw * 1.24, Math.max(3, fh * 0.07), C.stone)
  rect(g, fx - fw * 0.12, fy, fw * 1.24, 2, C.stoneHi)
  // 两侧炉柱：石砌的横缝
  const colW = Math.max(3, fw * 0.10)
  rect(g, fx - fw * 0.12, fy, colW, fh, '#171218')
  rect(g, fx + fw * 1.02, fy, colW, fh, '#120e13')
  for (let i = 0; i < 6; i++) {
    rect(g, fx - fw * 0.12, fy + 10 + i * (fh / 7), colW, 1, '#2a2028')
    rect(g, fx + fw * 1.02, fy + 14 + i * (fh / 7), colW, 1, '#241a20')
  }
  // 炉膛：黑的拱
  const ix = fx
  const iy = fy + fh * 0.07
  const iw = fw
  const ih = fh * 0.93
  rect(g, ix, iy, iw, ih, '#07050a')
  // 拱顶：逐行收窄（一台阶一台阶的）
  for (let r = 0; r < ih * 0.22; r++) {
    const w0 = iw * (0.55 + 0.45 * (r / (ih * 0.22)))
    rect(g, ix + (iw - w0) / 2, iy + r, w0, 1, '#07050a')
  }
  // 炉膛内壁的一点暖（火在墙上映出的红）
  for (let r = 0; r < ih * 0.7; r++) {
    const a = 0.16 * (1 - r / (ih * 0.7))
    if (a <= 0.004) continue
    g.fillStyle = `rgba(120,40,16,${a.toFixed(3)})`
    g.fillRect(Math.round(ix + iw * 0.08), Math.round(iy + r), Math.round(iw * 0.84), 1)
  }

  // ---- 火：一团（宽底、收顶），不是一排尖刺 ----
  const baseY = iy + ih * 0.94
  const cx = ix + iw / 2
  const fireH = ih * 0.62
  const fireW = iw * 0.40
  // 主体轮廓：底部最宽，向上收窄，并轻微左右摇摆
  for (let r = 0; r < fireH; r++) {
    const v = r / fireH
    const breathe = 1 + 0.10 * Math.sin(t * 4.3 + v * 7.5)
    const half = fireW * (1 - v * 0.72) * breathe * (0.72 + 0.28 * Math.sin(t * 2.1 + v * 5))
    if (half <= 0.4) continue
    const sway = Math.sin(t * 2.6 + v * 4.2) * iw * 0.045 * v
    const col = v > 0.72 ? mix(C.fire0, '#5a1a04', (v - 0.72) / 0.28)
      : v > 0.40 ? mix(C.fire1, C.fire0, (v - 0.40) / 0.32)
        : mix(C.fire3, C.fire1, v / 0.40)
    rect(g, cx + sway - half, baseY - r, half * 2, 1, col)
  }
  // 火舌：从主体顶部冒出的几条，窄、扭
  for (let i = 0; i < 5; i++) {
    const ph = hash(i * 13 + 3) * 6.28
    const ox = (hash(i * 17 + 5) - 0.5) * fireW * 0.9
    const hh = fireH * (0.10 + hash(i * 19 + 7) * 0.22) * (0.8 + 0.2 * Math.sin(t * 3.6 + ph))
    const sway = Math.sin(t * 2.9 + ph) * iw * 0.03
    for (let r = 0; r < hh; r++) {
      const v = r / hh
      const w2 = Math.max(1, fireW * 0.16 * (1 - v))
      rect(g, cx + ox + sway * v - w2 / 2, baseY - fireH * 0.86 - r, w2, 1, v < 0.35 ? C.fire1 : C.fire0)
    }
  }
  // 白芯：底部中央
  rect(g, cx - iw * 0.055, baseY - ih * 0.10, iw * 0.11, ih * 0.10, C.fire3)
  // 柴（两根横木压在火下面），上面的炭红
  rect(g, cx - iw * 0.28, baseY - ih * 0.03, iw * 0.56, Math.max(2, ih * 0.045), '#241710')
  rect(g, cx - iw * 0.22, baseY - ih * 0.08, iw * 0.44, Math.max(2, ih * 0.035), '#2e1d12')
  for (let i = 0; i < 10; i++) {
    px(g, cx + (hash(i * 7 + 1) - 0.5) * iw * 0.5, baseY - ih * 0.03 - hash(i * 11) * 3, '#8a2c0c')
  }
  // 火星：向上飘
  for (let i = 0; i < 14; i++) {
    const ph = (t * (0.4 + hash(i * 23) * 0.5) + hash(i * 29)) % 1
    const sx = cx + (hash(i * 31) - 0.5) * iw * 0.5 + Math.sin(ph * 6 + i) * 4
    const sy = baseY - ih * 0.45 - ph * ih * 0.7
    const a = (1 - ph) * 0.7
    if (a <= 0.03) continue
    px(g, sx, sy, `rgba(255,178,90,${a.toFixed(3)})`)
  }
  return { x: cx, y: baseY - ih * 0.3 }
}

function paintHallSilhouette(g: Ctx, t: number, u: number): void {
  // 背景墙：被炉火烤亮的暖暗。剪影必须比墙黑，否则只剩下一条发光的边。
  vGrad(g, 0, CF_H, '#0a070b', '#3c231c', 1)
  // 炉火照到的那面墙：一团很大的暖光（不是圆，是贴着墙的一片）
  const wallGlow = g.createRadialGradient(300, 148, 20, 300, 148, 250)
  wallGlow.addColorStop(0, 'rgba(140,66,34,0.34)')
  wallGlow.addColorStop(0.5, 'rgba(110,50,26,0.16)')
  wallGlow.addColorStop(1, 'rgba(80,36,18,0)')
  g.fillStyle = wallGlow
  g.fillRect(0, 0, CF_W, CF_H)
  // 拱肋：左右各两条很暗的斜线（一抬头就是九格高的拱顶）
  for (let i = 0; i < 120; i++) {
    const p = i / 120
    rect(g, 14 + p * 130, p * 88, 3, 2, '#1a1218')
    rect(g, CF_W - 16 - p * 130, p * 88, 3, 2, '#1a1218')
  }
  // 左侧墙上的两幅挂画（暗影 + 一线画布的反光）
  rect(g, 24, 22, 62, 86, '#0e0a0f')
  rect(g, 24, 22, 62, 2, '#3a2a28')
  rect(g, 28, 26, 54, 78, '#08060a')
  rect(g, 60, 46, 14, 30, '#171019')
  rect(g, 96, 38, 54, 74, '#0c090e')
  rect(g, 96, 38, 54, 2, '#33241f')
  rect(g, 100, 42, 46, 66, '#070509')
  rect(g, 112, 58, 20, 26, '#141019')

  // 壁炉：右侧（炉膛底落在地面线上）
  const fp = paintFireplace(g, t, 244, 62, 100, 120)
  // 火光的光晕（从炉膛向外）
  const glow = g.createRadialGradient(fp.x, fp.y, 10, fp.x, fp.y, 220)
  glow.addColorStop(0, 'rgba(255,154,64,0.34)')
  glow.addColorStop(0.35, 'rgba(224,112,42,0.15)')
  glow.addColorStop(1, 'rgba(160,70,20,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, CF_W, CF_H)

  // 地面：石板 + 火光的一道横向反光
  rect(g, 0, 190, CF_W, CF_H - 190, '#0d090b')
  for (let i = 0; i < 5; i++) {
    const y = 194 + i * 6
    g.fillStyle = `rgba(58,38,38,${(0.60 - i * 0.08).toFixed(3)})`
    g.fillRect(0, y, CF_W, 1)
  }
  // 石板之间的竖缝
  for (let i = 0; i < 7; i++) {
    g.fillStyle = 'rgba(50,34,34,0.55)'
    g.fillRect(20 + i * 56, 190, 1, 26)
  }
  // 火光在地板上的倒影
  for (let i = 0; i < 20; i++) {
    const w = 86 - i * 3
    const y = 191 + i
    if (w <= 2) break
    g.fillStyle = `rgba(210,112,46,${(0.22 - i * 0.009).toFixed(3)})`
    g.fillRect(Math.round(fp.x - w / 2), y, w, 1)
  }
  // 他的影子：从脚向左拉长
  for (let i = 0; i < 26; i++) {
    const w = 52 + i * 9
    const y = 190 + i
    if (y > CF_H) break
    g.fillStyle = `rgba(3,2,4,${(0.60 - i * 0.019).toFixed(3)})`
    g.fillRect(Math.round(146 - i * 6), y, w, 1)
  }

  // 侧影：站在壁炉前，面向右（向着火）。纯黑 —— 只有背景亮了，剪影才立得住。
  const breathe = Math.sin(t * 1.15) * 0.6
  paintFigure(g, {
    cx: 148,
    top: 36 + breathe,
    h: 178,
    facing: 'side',
    rim: 1,
    rimSide: 1,
    body: '#020103',
  })
  // 肩上的一道暖（火从右前方照过来）
  for (let i = 0; i < 16; i++) {
    px(g, 156 + i * 0.9, 36 + 178 * 0.248 + i * 0.16, `rgba(238,148,72,${(0.30 - i * 0.016).toFixed(3)})`)
  }

  // 空气里的灰：极慢地飘
  for (let i = 0; i < 10; i++) {
    const x = (hash(i * 7 + 1) * CF_W + u * (3 + i)) % CF_W
    const y = 40 + hash(i * 11 + 3) * 140 + Math.sin(t * 0.4 + i) * 5
    px(g, x, y, `rgba(210,176,142,${(0.07 + hash(i * 13) * 0.10).toFixed(3)})`)
  }

  vignette(g, 0.54, 240, 132)
}

// ============================================================
// 镜头 5 · 艾玛的闪回（19–22s）
// ============================================================

function paintEmmaFlash(g: Ctx, t: number, u: number): void {
  // 全黑底（记忆里没有墙，也没有火）
  rect(g, 0, 0, CF_W, CF_H, '#000000')
  // 一片很暗的光斑：她的脸只在这一点光里
  const cx = 224
  const cy = 96
  for (let sy = 16; sy < 196; sy++) {
    const v = clamp01((sy - 16) / 180)
    const hw = 92 * Math.sin(Math.PI * clamp01(v * 1.05))
    const a = 0.04 + 0.10 * Math.sin(Math.PI * v)
    if (a <= 0.004) continue
    g.fillStyle = `rgba(92,72,64,${a.toFixed(3)})`
    g.fillRect(Math.round(cx - hw), sy, Math.round(hw * 2), 1)
  }

  // ---- 她的头 ----
  const headTop = 52          // 帽顶
  const faceTop = 74          // 发际线
  const faceH = 68            // 脸高
  const faceW = 44            // 脸宽
  const hairL = cx - 36
  const hairR = cx + 36
  // 头发：从发际线垂到肩（左右两束），中间是脸
  for (let sy = headTop + 8; sy < headTop + 124; sy++) {
    const v = (sy - headTop - 8) / 116
    const half = 34 + 8 * Math.sin(Math.PI * clamp01(v * 0.92))
    rect(g, cx - half, sy, 13, 1, '#2a1e18')
    rect(g, cx + half - 13, sy, 13, 1, '#221812')
    // 头顶的头发
    if (v < 0.26) rect(g, cx - half, sy, half * 2, 1, '#2a1e18')
  }
  // 头顶的头发（压住帽檐下面）
  for (let sy = headTop + 6; sy < headTop + 26; sy++) {
    rect(g, hairL + 2, sy, hairR - hairL - 4, 1, '#241a14')
  }
  // 女仆帽：白色的一圈，中间略高（压得扁一点，才像帽子不像蛋糕）
  rect(g, cx - 30, headTop + 6, 60, 9, '#b9b0a4')
  rect(g, cx - 30, headTop + 6, 60, 2, '#d8d0c4')
  rect(g, cx - 20, headTop + 1, 40, 6, '#c6bdb0')
  rect(g, cx - 20, headTop + 1, 40, 2, '#ded6c8')
  rect(g, cx - 30, headTop + 14, 60, 1, '#8a8378')
  // 帽带（一条深色的，勒在帽子下面）
  rect(g, cx - 28, headTop + 16, 56, 2, '#5a5048')

  // 脸：椭圆（宽 faceW、高 faceH），左受光
  for (let r = 0; r < faceH; r++) {
    const v = r / (faceH - 1)
    const half = (faceW / 2) * Math.sin(Math.PI * clamp01(0.12 + v * 0.84))
    if (half <= 0.4) continue
    const y = faceTop + r
    rect(g, cx - half, y, half * 2, 1, C.skin)
    rect(g, cx - half, y, Math.max(1, half * 0.5), 1, C.skinHi)
    rect(g, cx + half * 0.40, y, half * 0.60, 1, C.skinLo)
  }
  // 鬓角：脸两侧垂下的一缕头发
  rect(g, cx - 25, faceTop + 6, 3, 34, '#2a1e18')
  rect(g, cx + 22, faceTop + 6, 3, 34, '#221812')

  // 眼睛：垂下的（上眼睑压到只剩 1px 的缝，看不清瞳孔）
  const eyeY = faceTop + 34
  for (const ex of [cx - 13, cx + 13]) {
    rect(g, ex - 7, eyeY, 14, 2, '#3a2418')
    rect(g, ex - 6, eyeY + 2, 12, 1, '#7a5a4a')
    px(g, ex - 4, eyeY + 2, '#2a1c16')
    // 睫毛的阴影
    rect(g, ex - 7, eyeY - 1, 14, 1, '#2a1c16')
  }
  // 眉（低垂的）
  rect(g, cx - 20, eyeY - 7, 12, 1, '#3a2a22')
  rect(g, cx + 8, eyeY - 7, 12, 1, '#3a2a22')
  // 鼻
  rect(g, cx - 1, eyeY + 5, 2, 8, C.skinHi)
  px(g, cx - 1, eyeY + 13, '#8a7466')
  px(g, cx + 1, eyeY + 13, '#8a7466')
  // 嘴：闭合的一条平线（她没有说话）
  rect(g, cx - 8, eyeY + 19, 17, 1, '#7a4a44')
  rect(g, cx - 6, eyeY + 20, 13, 1, '#9a6a60')

  // 颈与领口
  rect(g, cx - 8, faceTop + faceH - 4, 16, 16, C.skinLo)
  rect(g, cx - 8, faceTop + faceH - 4, 6, 16, C.skin)
  // 白领
  rect(g, cx - 16, faceTop + faceH + 10, 32, 7, '#b9b0a4')
  rect(g, cx - 16, faceTop + faceH + 10, 32, 1, '#d8d0c4')
  // 裙子 / 肩
  for (let i = 0; i < 22; i++) {
    const half = 30 + i * 2.2
    rect(g, cx - half, faceTop + faceH + 16 + i, half * 2, 1, '#12111a')
  }
  rect(g, cx - 34, faceTop + faceH + 16, 68, 1, '#1e1c28')

  // 边缘压黑：让这张脸从黑里浮出来（不是贴上去的）
  const vig = g.createRadialGradient(cx, cy, 34, cx, cy, 150)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(0.62, 'rgba(0,0,0,0.30)')
  vig.addColorStop(1, 'rgba(0,0,0,0.96)')
  g.fillStyle = vig
  g.fillRect(0, 0, CF_W, CF_H)
  // 闪回本身的淡入淡出：前 0.5s 浮出，最后 0.5s 沉回去
  const a = (1 - smooth(0, 0.5, u)) + smooth(0.82, 1, u)
  if (a > 0.002) {
    g.fillStyle = `rgba(0,0,0,${clamp01(a).toFixed(3)})`
    g.fillRect(0, 0, CF_W, CF_H)
  }
  void t
}

// ============================================================
// 镜头 6 · 他的脸（22–25s）
// ============================================================

function paintHisFace(g: Ctx, t: number, u: number): void {
  // 背景：大厅的暗，右上有一点火光的漏
  vGrad(g, 0, CF_H, '#060408', '#160d10', 1)
  const leak = g.createRadialGradient(330, 180, 10, 330, 180, 220)
  leak.addColorStop(0, 'rgba(210,110,44,0.20)')
  leak.addColorStop(1, 'rgba(210,110,44,0)')
  g.fillStyle = leak
  g.fillRect(0, 0, CF_W, CF_H)

  const cx = 184
  const top = 28
  const hh = 172
  const faceW = 82
  const faceTop = top + 30
  const faceH = 116

  // 脖子与肩（画在脸后面，宽度比脸宽，才不会在脸侧露出一块）
  for (let i = 0; i < 60; i++) {
    const v = i / 60
    const half = 30 + v * 56
    rect(g, cx - half, faceTop + faceH * 0.82 + i, half * 2, 1, '#0b080c')
    rect(g, cx - half, faceTop + faceH * 0.82 + i, Math.max(1, half * 0.22), 1, '#181016')
  }

  // 脸：椭圆（下巴略尖），左受光
  for (let r = 0; r < faceH; r++) {
    const v = r / (faceH - 1)
    const half = (faceW / 2) * Math.sin(Math.PI * clamp01(0.10 + v * 0.90)) * (v > 0.72 ? 1 - (v - 0.72) * 1.1 : 1)
    if (half <= 0.4) continue
    const y = faceTop + r
    rect(g, cx - half, y, half * 2, 1, C.skin)
    rect(g, cx - half, y, Math.max(1, half * 0.58), 1, C.skinHi)
    rect(g, cx + half * 0.34, y, half * 0.66, 1, C.skinLo)
    if (v > 0.80) rect(g, cx - half * 0.6, y, half * 1.2, 1, '#8a7364')
  }

  // ---- 头发：短、乱、从发际线压下来（不是一顶帽子）----
  const hairTop = faceTop - 26
  const hairBottom = faceTop + 14
  for (let y = hairTop; y < hairBottom; y++) {
    const v = (y - hairTop) / (hairBottom - hairTop)
    // 顶部窄、两侧宽，下缘（太阳穴）略收
    const half = (faceW / 2) * (0.70 + 0.36 * Math.sin(Math.PI * clamp01(v * 0.92 + 0.06)))
    rect(g, cx - half, y, half * 2, 1, v < 0.38 ? '#5e1f14' : '#43130e')
    // 左侧受光（火光在左下）
    rect(g, cx - half, y, Math.max(1, half * 0.30), 1, '#8e3220')
    if (y < hairTop + 2) rect(g, cx - half, y, half * 2, 1, '#a03e26')
  }
  // 鬓角：两缕从太阳穴垂到耳前（长短不一）
  for (const s of [-1, 1]) {
    const bx = cx + s * (faceW / 2) * 0.84
    const len = 30 + Math.round(hash(s + 3) * 10)
    for (let k = 0; k < len; k++) {
      const w = Math.max(2, 6 - k * 0.10)
      rect(g, bx - w / 2 + s * k * 0.06, hairBottom - 8 + k, w, 1, k < len * 0.4 ? '#4f1a10' : '#38100a')
    }
  }
  // 额前的碎发（不规则地垂下几缕）
  for (let i = 0; i < 6; i++) {
    const x = cx - faceW / 2 + 6 + i * (faceW / 6)
    const h2 = 6 + Math.round(hash(i * 11 + 3) * 12)
    for (let k = 0; k < h2; k++) {
      const lean = Math.sin(k * 0.5 + i) * 1.5
      px(g, x + lean, faceTop - 2 + k, k < h2 * 0.4 ? '#5e1f14' : '#3f120c')
    }
  }

  // ---- 眼睛：没有焦点（瞳孔不聚，也不画高光）----
  const eyeY = faceTop + faceH * 0.40
  const eyeDX = 21
  const eyeW = 20
  for (const ex of [cx - eyeDX, cx + eyeDX]) {
    // 眼窝的暗
    rect(g, ex - eyeW / 2 - 2, eyeY - 4, eyeW + 4, 12, '#a08a78')
    // 眼白压暗（侧光下眼白不会是白的）
    rect(g, ex - eyeW / 2, eyeY, eyeW, 5, '#877c70')
    // 虹膜：灰蓝，无高光
    rect(g, ex - 6, eyeY, 12, 5, '#3d4a52')
    rect(g, ex - 4, eyeY + 1, 8, 4, '#1a2024')
    // 上眼睑：压得很低
    rect(g, ex - eyeW / 2 - 2, eyeY - 2, eyeW + 4, 2, '#3a2418')
    // 下眼睑的阴影
    rect(g, ex - eyeW / 2, eyeY + 5, eyeW, 1, '#7a6050')
  }
  // 眉：压低、几乎是平的
  rect(g, cx - eyeDX - 13, eyeY - 9, 24, 2, '#4a1c16')
  rect(g, cx + eyeDX - 11, eyeY - 9, 24, 2, '#4a1c16')

  // 鼻：窄高光 + 鼻底阴影
  rect(g, cx - 1, faceTop + faceH * 0.44, 2, faceH * 0.20, C.skinHi)
  rect(g, cx - 5, faceTop + faceH * 0.64, 10, 2, '#8a7466')
  px(g, cx - 4, faceTop + faceH * 0.64 + 2, '#6a5448')
  px(g, cx + 4, faceTop + faceH * 0.64 + 2, '#6a5448')
  // 嘴：一条平线（没有笑，也没有说话）
  rect(g, cx - 12, faceTop + faceH * 0.78, 24, 2, '#6a3a34')
  rect(g, cx - 10, faceTop + faceH * 0.78 + 2, 20, 1, '#8a5a4a')

  // 右边一半被黑影吞掉（光只到左半张脸）
  for (let x = cx + 26; x < CF_W; x++) {
    const a = smooth(cx + 26, cx + 108, x) * 0.74
    if (a <= 0.004) continue
    g.fillStyle = `rgba(2,1,3,${a.toFixed(3)})`
    g.fillRect(x, 0, 1, CF_H)
  }
  // 火光在颧骨与下颌上的一线暖
  for (let x = cx - 40; x < cx + 10; x++) {
    const a = 0.14 * (1 - Math.abs(x - (cx - 16)) / 34)
    if (a <= 0.004) continue
    g.fillStyle = `rgba(226,132,62,${a.toFixed(3)})`
    g.fillRect(x, Math.round(faceTop + faceH * 0.70), 1, Math.round(faceH * 0.10))
  }
  // 空气的灰
  for (let i = 0; i < 8; i++) {
    const x = (hash(i * 7 + 3) * CF_W + u * 4) % CF_W
    const y = 30 + hash(i * 11 + 5) * 150
    px(g, x, y, `rgba(180,150,120,${(0.05 + hash(i * 13) * 0.08).toFixed(3)})`)
  }
  void t
  vignette(g, 0.5, 200, 104)
}

// ============================================================
// 镜头 7 · 三个快切（25–31s，各 2s）
// ============================================================

/** ① 他的手：指尖有墨 */
function paintHandShot(g: Ctx, t: number, u: number): void {
  vGrad(g, 0, CF_H, '#0a0709', '#1c1114', 1)
  // 桌面（一块木板的边）
  rect(g, 0, 158, CF_W, CF_H - 158, '#161016')
  rect(g, 0, 158, CF_W, 2, '#2a1e22')
  for (let i = 0; i < 4; i++) rect(g, 0, 166 + i * 13, CF_W, 1, 'rgba(44,30,36,0.45)')

  const skin = '#9c7a62'
  const skinHi = '#c6a084'
  const skinLo = '#6a4e3e'
  const nail = '#cbb0a0'
  const ink = '#0a0a10'

  // 手背（手掌）：一个圆角的长块，从左往右铺开
  const palmX = 214
  const palmY = 78
  const palmW = 112
  const palmH = 86
  for (let r = 0; r < palmH; r++) {
    const v = r / (palmH - 1)
    // 左右两端收圆
    const inset = Math.round(8 * Math.sin(Math.PI * v))
    rect(g, palmX + inset, palmY + r, palmW - inset * 2, 1, skin)
    rect(g, palmX + inset, palmY + r, Math.max(1, palmW * 0.22), 1, skinHi)
    rect(g, palmX + palmW - inset - Math.max(1, palmW * 0.18), palmY + r, Math.max(1, palmW * 0.18), 1, skinLo)
  }
  // 指根的四道浅沟（手背的骨节）
  for (let i = 0; i < 4; i++) {
    rect(g, palmX + 6, palmY + 18 + i * 16, 26, 1, 'rgba(120,90,70,0.55)')
  }

  // 四根手指：并排向左伸出，长度不同
  const fingers: Array<{ y: number; len: number; w: number; dn: number }> = [
    { y: 72, len: 62, w: 17, dn: 0 },   // 食指
    { y: 90, len: 72, w: 17, dn: 2 },   // 中指
    { y: 108, len: 66, w: 16, dn: 4 },  // 无名指
    { y: 126, len: 54, w: 15, dn: 6 },  // 小指
  ]
  for (const F of fingers) {
    const tipX = palmX + 8 - F.len
    for (let r = 0; r < F.w; r++) {
      const v = r / (F.w - 1)
      // 手指的侧面：上缘亮、下缘暗；指尖的圆收在 len 的最后 6px
      const taper = Math.round(5 * smooth(0.82, 1, v))
      rect(g, tipX + taper, F.y + F.dn + r, F.len, 1, skin)
      rect(g, tipX + taper, F.y + F.dn + r, F.len, 1, v < 0.3 ? skinHi : v > 0.76 ? skinLo : skin)
    }
    // 指节的折痕
    rect(g, tipX + F.len * 0.42, F.y + F.dn + 1, 1, F.w - 2, 'rgba(110,82,64,0.45)')
    rect(g, tipX + F.len * 0.66, F.y + F.dn + 1, 1, F.w - 2, 'rgba(110,82,64,0.35)')
    // 指甲
    rect(g, tipX + 6, F.y + F.dn + 5, 9, 6, nail)
    rect(g, tipX + 6, F.y + F.dn + 5, 9, 1, '#e0cbb8')
    // 指尖的墨：吃进指甲缝，擦不掉
    rect(g, tipX + 3, F.y + F.dn + 4, 7, 8, ink)
    rect(g, tipX + 2, F.y + F.dn + 8, 4, 4, '#121018')
    px(g, tipX + 4, F.y + F.dn + 3, '#1c1a26')
  }
  // 拇指：从手掌左上斜向上
  for (let r = 0; r < 46; r++) {
    const w = 18 - Math.round(r * 0.12)
    const x = palmX - 6 + r * 0.32
    const y = palmY - 6 - r
    rect(g, x, y, w, 1, skin)
    rect(g, x, y, Math.max(1, w * 0.3), 1, skinHi)
    if (r > 30) rect(g, x + 2, y, 6, 1, nail)
  }
  // 手腕：从右下出画
  for (let r = 0; r < 34; r++) {
    const half = 34 + r * 0.5
    rect(g, palmX + 42 - half, palmY + palmH - 6 + r, half * 2, 1, '#2a1e22')
  }
  // 火光从右上打来：手掌右缘的一道暖边
  for (let r = 0; r < palmH; r += 2) {
    const x = palmX + palmW - 3
    px(g, x, palmY + r, `rgba(226,132,62,${(0.22 - r * 0.0018).toFixed(3)})`)
  }
  void t
  void u
  vignette(g, 0.6, 220, 120)
}

/** ② 胸口的银胸针 */
function paintBroochShot(g: Ctx, t: number, u: number): void {
  vGrad(g, 0, CF_H, '#08070c', '#131019', 1)
  // 黑呢料：细的织纹（一条条极暗的横纹）
  rect(g, 0, 0, CF_W, CF_H, '#0c0a10')
  for (let i = 0; i < 54; i++) {
    const y = i * 4
    g.fillStyle = `rgba(22,18,28,${(0.42 - i * 0.004).toFixed(3)})`
    g.fillRect(0, y, CF_W, 1)
  }
  // 翻领的两条斜线（右翻领压着左翻领）
  for (let r = 0; r < 150; r++) {
    g.fillStyle = '#14101a'
    g.fillRect(Math.round(92 + r * 0.62), 8 + r, 4, 1)
    g.fillStyle = '#100d15'
    g.fillRect(Math.round(292 - r * 0.60), 8 + r, 4, 1)
  }
  // 衬衫领口：一小片暗白（不是一大块）
  rect(g, 178, 22, 28, 34, '#7e7768')
  rect(g, 178, 22, 28, 2, '#a39a8a')
  rect(g, 191, 22, 2, 34, '#5e5a52')
  // 胸针：十字 + 秃鹫
  paintBrooch(g, 192, 112, 84, t)
  // 金属的星芒：只在左上一点点（火光在银上的一闪）
  const a = 0.08 + 0.06 * Math.sin(t * 1.9)
  for (let i = 0; i < 10; i++) {
    const len = 3 + i * 1.4
    g.fillStyle = `rgba(255,240,206,${(a * (1 - i / 10)).toFixed(3)})`
    g.fillRect(Math.round(192 + len), Math.round(80 - 2), 1, 3)
    g.fillRect(Math.round(192 - len), Math.round(80 - 2), 1, 3)
  }
  // 呢料被火照到的一侧（右下）
  const warm = g.createRadialGradient(320, 220, 10, 320, 220, 200)
  warm.addColorStop(0, 'rgba(190,96,40,0.16)')
  warm.addColorStop(1, 'rgba(190,96,40,0)')
  g.fillStyle = warm
  g.fillRect(0, 0, CF_W, CF_H)
  void u
  vignette(g, 0.62, 192, 110)
}

/** ③ 红发被火光染亮 */
function paintHairShot(g: Ctx, t: number, u: number): void {
  vGrad(g, 0, CF_H, '#0a0507', '#1a0b09', 1)
  // 四大束头发：每束是宽的波浪，束与束之间是黑缝
  const strands = 5
  for (let s = 0; s < strands; s++) {
    const baseX = -20 + s * 96
    const bend = 0.5 + hash(s * 13 + 3) * 0.5
    const w0 = 54 + hash(s * 17 + 5) * 26
    for (let r = 0; r < 220; r++) {
      const y = r - 6
      if (y < 0 || y >= CF_H) continue
      const cx = baseX + Math.sin(r * 0.017 + s * 1.9) * 22 * bend + r * 0.16
      const w = w0 * (0.86 + 0.14 * Math.sin(r * 0.02 + s))
      // 束的颜色：左侧暗、中间主色、右侧受火光的边
      const x0 = Math.round(cx - w / 2)
      rect(g, x0, y, w, 1, s % 2 === 0 ? '#4a130d' : '#3a0e0a')
      rect(g, x0, y, Math.max(1, w * 0.22), 1, '#5e1a10')
      // 束内的发丝：两道更亮的纵线
      rect(g, x0 + w * 0.30, y, Math.max(1, w * 0.10), 1, '#7e2614')
      if (r % 7 < 5) rect(g, x0 + w * 0.62, y, Math.max(1, w * 0.07), 1, '#6a1e12')
      // 火光的边：只有靠右下的一侧
      const lit = clamp01((cx + y) / 620 - 0.05)
      if (lit > 0.2) {
        const a = lit * (0.5 + 0.16 * Math.sin(t * 2.2 + s + r * 0.04))
        rect(g, x0 + w - Math.max(2, Math.round(w * 0.16)), y, Math.max(2, Math.round(w * 0.16)), 1, `rgba(216,102,42,${clamp01(a).toFixed(3)})`)
        if (lit > 0.55 && hash(s * 7 + r) > 0.45) px(g, x0 + w - 2, y, `rgba(255,186,104,${(lit * 0.55).toFixed(3)})`)
      }
    }
  }
  // 火光从右下打来：一片暖色的晕
  const warm = g.createRadialGradient(300, 200, 8, 300, 200, 210)
  warm.addColorStop(0, 'rgba(255,150,64,0.24)')
  warm.addColorStop(1, 'rgba(255,150,64,0)')
  g.fillStyle = warm
  g.fillRect(0, 0, CF_W, CF_H)
  void u
  vignette(g, 0.5, 270, 130)
}

// ============================================================
// 镜头 8 · 仰视：大厅中央的他与三幅画像（31–36s）
// ============================================================

/** 一幅祖先像（比维多利亚那幅更暗、更小，只读轮廓） */
function paintAncestor(g: Ctx, x: number, y: number, w: number, h: number): void {
  const B = Math.max(2, Math.round(w * 0.06))
  rect(g, x, y, w, h, '#2a2018')
  rect(g, x, y, w, 1, '#3a2c20')
  rect(g, x, y + h - 1, w, 1, '#1a120c')
  rect(g, x + B, y + B, w - B * 2, h - B * 2, '#121016')
  // 一个穿黑礼服的男人：头 + 肩（全是剪影）
  const headW = w * 0.30
  const headX = x + w * 0.5 - headW / 2
  const headY = y + h * 0.24
  rect(g, headX, headY, headW, headW * 1.15, '#1c1a20')
  rect(g, x + w * 0.5 - w * 0.26, headY + headW * 1.1, w * 0.52, h * 0.46, '#0e0c12')
  // 领口的一点白
  rect(g, x + w * 0.5 - w * 0.05, headY + headW * 1.05, w * 0.10, h * 0.06, '#7e7768')
  // 画面底部的暗
  rect(g, x + B, y + h - B - h * 0.10, w - B * 2, h * 0.10, '#0a0810')
}

function paintPortraitsShot(g: Ctx, t: number, u: number): void {
  // 背景：高墙 + 拱肋（从四角向中央上方汇聚 → 仰视）
  vGrad(g, 0, CF_H, '#070509', '#161016', 1)
  // 拱肋：四条斜线（很暗：它是石头的阴影，不是发光体）
  const ribs: Array<[number, number, number, number]> = [
    [0, 0, 150, 96], [CF_W, 0, 234, 96],
    [0, 60, 150, 100], [CF_W, 60, 234, 100],
  ]
  for (const [x0, y0, x1, y1] of ribs) {
    const steps = 120
    for (let i = 0; i <= steps; i++) {
      const p = i / steps
      rect(g, x0 + (x1 - x0) * p, y0 + (y1 - y0) * p, 3, 2, '#130f17')
    }
  }
  // 墙上的石缝（横向的，越高越密 —— 仰视的透视）
  for (let i = 0; i < 9; i++) {
    const y = 4 + i * 9 + i * i * 0.5
    if (y > 150) break
    g.fillStyle = 'rgba(30,24,32,0.45)'
    g.fillRect(0, Math.round(y), CF_W, 1)
  }

  // 三幅画像：中间大（维多利亚），两侧小（祖先）
  const midW = 104
  const midH = 136
  const midX = CF_W / 2 - midW / 2
  const midY = 26
  paintAncestor(g, midX - 82, midY + 22, 70, 96)
  paintAncestor(g, midX + midW + 12, midY + 22, 70, 96)
  paintVictoriaPainting(g, midX, midY, midW, midH, 0.3, 0.75)

  // 地面：一片被火烤暖的石板
  rect(g, 0, 176, CF_W, CF_H - 176, '#0a0709')
  for (let i = 0; i < 10; i++) {
    const w = 150 - i * 12
    g.fillStyle = `rgba(200,108,44,${(0.13 - i * 0.011).toFixed(3)})`
    g.fillRect(Math.round(CF_W / 2 - w / 2), 176 + i, w, 1)
  }
  // 他的剪影：站在画像下面，很小（仰视：人小、墙高）
  const breathe = Math.sin(t * 1.2) * 0.5
  paintFigure(g, {
    cx: 190,
    top: 116 + breathe,
    h: 96,
    facing: 'back',
    rim: 0.6,
    rimSide: 1,
    body: '#050409',
  })
  // 头发的一点红（背影）
  for (let r = 0; r < 18; r++) {
    const half = 12 * Math.sin(Math.PI * clamp01(0.12 + (r / 18) * 0.9))
    rect(g, 190 - half, 117 + r, half * 2, 1, '#3a110c')
  }
  // 壁炉的火光从右下漏进来
  const leak = g.createRadialGradient(340, 200, 10, 340, 200, 200)
  leak.addColorStop(0, 'rgba(220,116,44,0.20)')
  leak.addColorStop(1, 'rgba(220,116,44,0)')
  g.fillStyle = leak
  g.fillRect(0, 0, CF_W, CF_H)
  void u
  vignette(g, 0.56, 192, 90)
}

// ============================================================
// 镜头 9 · 背影，慢慢走向画像（36–39s）
// ============================================================

function paintApproachShot(g: Ctx, t: number, u: number): void {
  // 背景：一面墙 + 壁炉的火光 + 高处的画像（仰视）
  vGrad(g, 0, CF_H, '#070509', '#150e12', 1)
  // 画像在墙上：小、偏上（他在往它走）
  paintVictoriaPainting(g, 148, 14, 92, 120, 0.25, 0.7)
  // 壁炉在画像下方一段（右侧）
  const fp = paintFireplace(g, t, 246, 120, 84, 96)
  const glow = g.createRadialGradient(fp.x, fp.y, 8, fp.x, fp.y, 190)
  glow.addColorStop(0, 'rgba(255,150,60,0.26)')
  glow.addColorStop(1, 'rgba(255,150,60,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, CF_W, CF_H)
  // 地面
  rect(g, 0, 190, CF_W, CF_H - 190, '#0a0709')
  for (let i = 0; i < 5; i++) {
    g.fillStyle = `rgba(30,20,24,${(0.5 - i * 0.07).toFixed(3)})`
    g.fillRect(0, 194 + i * 6, CF_W, 1)
  }
  // 他：背对镜头，往前走（3 秒里走两步：位置右移、身高略缩）
  const p = smooth(0.05, 0.95, u)
  const cx = 168 + p * 26
  const top = 66 + p * 10
  const h = 148 - p * 10
  // 影子
  for (let i = 0; i < 18; i++) {
    const y = 200 + i
    if (y > CF_H) break
    g.fillStyle = `rgba(2,2,4,${(0.42 - i * 0.02).toFixed(3)})`
    g.fillRect(Math.round(cx - 26 - i * 2), y, 52 + i * 4, 1)
  }
  paintFigure(g, {
    cx, top, h, facing: 'back', rim: 0.95, rimSide: 1, body: '#050409',
  })
  // 他的红发：背影里唯一有颜色的一块（被火光从前面染亮）
  const headTop = top + h * 0.02
  for (let r = 0; r < h * 0.20; r++) {
    const v = r / (h * 0.20)
    const half = 11 * Math.sin(Math.PI * clamp01(0.12 + v * 0.9))
    rect(g, cx - half, headTop + r, half * 2, 1, '#3a110c')
    rect(g, cx - half, headTop + r, Math.max(1, half * 0.4), 1, '#5e1a10')
  }
  // 肩上的暖边（火在前方）
  for (let i = 0; i < 14; i++) {
    px(g, cx + 18 + i * 0.9, top + h * 0.40 + i * 0.12, `rgba(226,132,62,${(0.26 - i * 0.016).toFixed(3)})`)
  }
  // 左侧墙上的一道拱窗暗影（画面左半不要空着）
  rect(g, 14, 30, 66, 128, '#0d0a10')
  rect(g, 14, 30, 66, 2, '#1c1620')
  rect(g, 47, 30, 2, 128, '#07050a')
  rect(g, 14, 94, 66, 2, '#07050a')
  void t
  vignette(g, 0.5, 200, 100)
}

// ============================================================
// 镜头 10 · 画像远景（39–42s）
// ============================================================

function paintPaintingFarShot(g: Ctx, t: number, u: number): void {
  // 背景：画廊的墙，火光从下方来
  vGrad(g, 0, CF_H, '#08060a', '#1a1013', 1)
  // 墙面的一道暖光晕（壁炉在画面下缘以下）
  const glow = g.createRadialGradient(192, 236, 20, 192, 236, 200)
  glow.addColorStop(0, 'rgba(230,124,48,0.24)')
  glow.addColorStop(1, 'rgba(230,124,48,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, CF_W, CF_H)
  // 画像：3 秒里极慢地推近（1.0 → 1.06，为下一段的推近起头）
  const z = 1 + smooth(0, 1, u) * 0.06
  const w = 146 * z
  const h = 190 * z
  const x = 192 - w / 2
  const y = 106 - h / 2 + 2
  paintVictoriaPainting(g, x, y, w, h, 0.35, 0.9)
  // 画框下方的一道暖光（火光打在框上）
  g.fillStyle = 'rgba(232,150,72,0.20)'
  g.fillRect(Math.round(x + 4), Math.round(y + h + 1), Math.round(w - 8), 2)
  // 墙脚的踢脚线
  rect(g, 0, 206, CF_W, 2, '#1c1418')
  rect(g, 0, 206, CF_W, 1, '#2a1e22')
  void t
  vignette(g, 0.62, 192, 96)
}

// ============================================================
// 镜头 11 · 壁炉的火（42–44s）
// ============================================================

function paintFireShot(g: Ctx, t: number, u: number): void {
  // 炉膛内部的黑
  rect(g, 0, 0, CF_W, CF_H, '#050307')
  // 炉壁：两侧的石（大块，虚焦只留色调）
  rect(g, 0, 0, 66, CF_H, '#140d10')
  rect(g, CF_W - 66, 0, 66, CF_H, '#100a0d')
  for (let i = 0; i < 5; i++) {
    g.fillStyle = 'rgba(36,24,26,0.5)'
    g.fillRect(8, i * 38 + 12, 52, 2)
    g.fillRect(CF_W - 60, i * 38 + 20, 52, 2)
  }
  // 炉底：一层灰与两根柴
  rect(g, 60, 168, CF_W - 120, CF_H - 168, '#0d0809')
  rect(g, 74, 168, CF_W - 148, 3, '#1e1414')
  rect(g, 96, 150, 150, 14, '#2a1a12')
  rect(g, 96, 150, 150, 2, '#3a2418')
  rect(g, 130, 164, 110, 12, '#241610')
  rect(g, 130, 164, 110, 2, '#33200f')
  // 炭：柴上的暗红
  for (let i = 0; i < 26; i++) {
    const x = 100 + hash(i * 7 + 1) * 140
    const y = 150 + hash(i * 11 + 3) * 22
    px(g, x, y, i % 3 === 0 ? '#7a2a10' : '#4a1a0a')
  }
  // 火焰：一大团（宽底、收顶）—— 不是一排尖刺
  const cx = 192
  const baseY = 168
  const fireH = 118
  const fireW = 104
  for (let r = 0; r < fireH; r++) {
    const v = r / fireH
    // 主体：底部最宽，往上收；每一行都带两个频率的抖动（火在撕裂，不是一块布）
    const half = fireW * (1 - v * 0.80) *
      (0.74 + 0.26 * Math.sin(t * 2.7 + v * 9.1)) *
      (0.82 + 0.18 * Math.sin(t * 5.3 + v * 17))
    if (half <= 0.4) continue
    const sway = Math.sin(t * 2.9 + v * 5.2) * 13 * v
    // 外焰：橙 → 红
    const outer = v > 0.90 ? mix(C.fire0, '#4a1204', (v - 0.90) / 0.10)
      : v > 0.58 ? mix(C.fire1, C.fire0, (v - 0.58) / 0.32)
        : mix(C.fire2, C.fire1, v / 0.58)
    rect(g, cx + sway - half, baseY - r, half * 2, 1, outer)
    // 内焰：黄 → 白（宽度 55%，底部才亮得起来，又不至于整团发白）
    const h2 = half * 0.55
    const inner = v > 0.72 ? mix(C.fire1, C.fire0, (v - 0.72) / 0.28)
      : v > 0.30 ? mix(C.fire2, C.fire1, (v - 0.30) / 0.42)
        : mix(C.fire3, C.fire2, v / 0.30)
    rect(g, cx + sway - h2, baseY - r, h2 * 2, 1, inner)
  }
  // 火舌：从主体顶部冒出来的几条（与主体重叠，才不会像"三根天线"）
  for (let i = 0; i < 6; i++) {
    const ph = hash(i * 13 + 5) * 6.28
    const ox = (hash(i * 17 + 7) - 0.5) * fireW * 0.85
    const hh = fireH * (0.20 + hash(i * 19 + 9) * 0.26) * (0.82 + 0.18 * Math.sin(t * 3.4 + ph))
    const sway = Math.sin(t * 2.6 + ph) * 14
    for (let r = 0; r < hh; r++) {
      const v = r / hh
      const w2 = Math.max(1, fireW * 0.17 * (1 - v * 0.92))
      const x = cx + ox + sway * v * v
      const col = v < 0.30 ? mix(C.fire2, C.fire1, v / 0.30)
        : v < 0.62 ? mix(C.fire1, C.fire0, (v - 0.30) / 0.32)
          : mix(C.fire0, '#4a1204', (v - 0.62) / 0.38)
      rect(g, x - w2 / 2, baseY - fireH * 0.78 - r, w2, 1, col)
    }
  }
  // 白芯：底部中央（小、逐行收窄，不是一块方块）
  for (let r = 0; r < 34; r++) {
    const v = r / 34
    const half = 18 * (1 - v * 0.80)
    rect(g, cx - half, baseY - 3 - r, half * 2, 1, v < 0.5 ? C.fire3 : C.fire2)
  }
  // 42.5s 的那一下火花：爆开、飞散、熄灭
  const sparkT = t - 42.5
  if (sparkT > 0 && sparkT < 1.5) {
    const sx = 236
    const sy = 128
    const p = sparkT / 1.5
    // 爆开的一闪
    if (p < 0.12) {
      const a = 1 - p / 0.12
      g.fillStyle = `rgba(255,244,216,${a.toFixed(3)})`
      g.fillRect(sx - 10, sy - 3, 20, 6)
      g.fillRect(sx - 3, sy - 10, 6, 20)
    }
    // 飞散的八粒
    for (let i = 0; i < 10; i++) {
      const a = i * 0.63 + hash(i * 7 + 3) * 0.4
      const sp = 60 + hash(i * 11 + 5) * 120
      const dist = sp * sparkT * (1 - p * 0.35)
      const x = sx + Math.cos(a) * dist
      const y = sy + Math.sin(a) * dist + 40 * sparkT * sparkT
      const life = 1 - p
      if (life <= 0.02) continue
      const col = life > 0.6 ? C.fire3 : life > 0.3 ? C.fire2 : C.fire1
      px(g, x, y, col)
      if (life > 0.45) px(g, x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5, C.fire2)
    }
  }
  // 上升的火星
  for (let i = 0; i < 26; i++) {
    const ph = (t * (0.45 + hash(i * 29) * 0.5) + hash(i * 31)) % 1
    const sx2 = cx + (hash(i * 37) - 0.5) * 170 + Math.sin(ph * 7 + i) * 6
    const sy2 = baseY - 40 - ph * 140
    if (sy2 < 0) continue
    px(g, sx2, sy2, `rgba(255,178,90,${((1 - ph) * 0.65).toFixed(3)})`)
  }
  // 火光在画面上的整体暖：中间亮、四周暗
  const warm = g.createRadialGradient(cx, baseY - 40, 20, cx, baseY - 40, 220)
  warm.addColorStop(0, 'rgba(255,160,70,0.20)')
  warm.addColorStop(1, 'rgba(255,160,70,0)')
  g.fillStyle = warm
  g.fillRect(0, 0, CF_W, CF_H)
  void u
  vignette(g, 0.7, 192, 130)
}

// ============================================================
// 镜头 12–14 · 连续推近：整张脸 → 只剩嘴唇
// ============================================================

/** 推近的起点与终点（秒）：44s 整张脸，53s 嘴唇 */
const NEAR_T0 = 44
const NEAR_T1 = 53
/** box 的宽度：150 → 1400（指数曲线：越近越慢） */
const NEAR_W0 = 150
const NEAR_W1 = 1400

/**
 * 脸 box 的宽度。
 * 用指数而不是线性：推轨越靠近目标，屏幕上的变化越慢 ——
 * 线性放大到最后几秒会失控（嘴唇糊成一整块）。
 */
function nearZoom(t: number): number {
  const p = clamp01((t - NEAR_T0) / (NEAR_T1 - NEAR_T0))
  const s = p * p * (3 - 2 * p)
  return NEAR_W0 * Math.pow(NEAR_W1 / NEAR_W0, s)
}

/**
 * 取景中心的纵向位置（在 box 内的比例）。
 * 0.5 = 脸心对准屏幕中心；0.735 = 嘴唇对准屏幕中心。
 * 前段慢慢从脸心滑到嘴，50s 之后基本钉在唇线上 —— 最后三秒只剩嘴唇。
 */
function nearFocusY(t: number): number {
  const p = clamp01((t - NEAR_T0) / (NEAR_T1 - NEAR_T0))
  const f = smooth(0.02, 0.72, p)
  return 0.5 + f * 0.255
}

function paintNearShot(g: Ctx, t: number): void {
  const w = nearZoom(t)
  const fy = nearFocusY(t)
  // 极慢的手持漂移（不是摆动：一秒钟不到 1px）
  const cx = 192 + Math.sin(t * 0.71) * 1.3
  const cy = 108 + Math.sin(t * 0.53 + 1.1) * 1.0
  const box: Box = { x: cx - w / 2, y: cy - fy * w, w, h: w }

  // 背景：画布的暗紫黑，火光从下方漏上来一点
  rect(g, 0, 0, CF_W, CF_H, C.canvasBg)
  const warm = g.createRadialGradient(192, CF_H + 40, 30, 192, CF_H + 40, 300)
  warm.addColorStop(0, 'rgba(216,124,52,0.22)')
  warm.addColorStop(1, 'rgba(216,124,52,0)')
  g.fillStyle = warm
  g.fillRect(0, 0, CF_W, CF_H)
  // 背景的一点冷光（左上角）：画像背后那面墙的月光，其余全暗
  const cool = g.createRadialGradient(64, 16, 4, 64, 16, 130)
  cool.addColorStop(0, 'rgba(72,90,116,0.10)')
  cool.addColorStop(1, 'rgba(72,90,116,0)')
  g.fillStyle = cool
  g.fillRect(0, 0, CF_W, CF_H)

  // 脸（也含头发）。嘴角在推近的后半段抬到 1 ——「像在笑」。
  const mood = 0.35 + 0.5 * smooth(45.6, 49.4, t)
  paintVictoriaHead(g, box, mood, 0.85)

  // 上下各压一道渐暗：下巴沉进黑里，画面只剩嘴唇那一块亮（字也压得住）
  for (let y = 138; y < CF_H; y++) {
    const a = smooth(138, CF_H - 6, y) * 0.72
    if (a <= 0.004) continue
    g.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`
    g.fillRect(0, y, CF_W, 1)
  }
  for (let y = 0; y < 26; y++) {
    const a = (1 - y / 26) * 0.55
    if (a <= 0.004) continue
    g.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`
    g.fillRect(0, y, CF_W, 1)
  }

  // 极近时：把四周压暗，只剩嘴唇那一块亮（像镜头贴上去的暗角）
  const zoomIn = clamp01((t - 49.0) / 4)
  if (zoomIn > 0.01) {
    const grad = g.createRadialGradient(192, 112, 18, 192, 112, 172)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(0.45, `rgba(0,0,0,${(zoomIn * 0.14).toFixed(3)})`)
    grad.addColorStop(0.78, `rgba(0,0,0,${(zoomIn * 0.52).toFixed(3)})`)
    grad.addColorStop(1, `rgba(0,0,0,${(zoomIn * 0.86).toFixed(3)})`)
    g.fillStyle = grad
    g.fillRect(0, 0, CF_W, CF_H)
    // 左右两条竖直的暗带：两侧的红发退到暗里，画面只剩中间那张嘴
    for (let x = 0; x < 72; x++) {
      const a = zoomIn * 0.72 * (1 - x / 72)
      if (a <= 0.004) continue
      g.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`
      g.fillRect(x, 0, 1, CF_H)
      g.fillRect(CF_W - 1 - x, 0, 1, CF_H)
    }
  } else {
    vignette(g, 0.42, 192, 104)
  }
}

// ============================================================
// 纯函数：任意一秒的那一帧
// ============================================================

function shotIndexAt(t: number): number {
  for (let i = 0; i < CF_SHOTS.length; i++) {
    const s = CF_SHOTS[i]
    if (t < s.t1) return i
  }
  return CF_SHOTS.length - 1
}

/**
 * 把某一时刻的整幅画面画到 canvas 上（纯函数）。
 * 跳过靠它落到最后一帧、定帧调试靠它停在某一秒 —— 它不读任何外部状态。
 */
export function renderFrame(g: Ctx, t: number): void {
  const tt = clamp(t, 0, CF_TOTAL)
  g.save()
  g.imageSmoothingEnabled = false

  g.fillStyle = '#000000'
  g.fillRect(0, 0, CF_W, CF_H)

  const idx = shotIndexAt(tt)
  const shot = CF_SHOTS[idx]
  const local = tt - shot.t0
  const dur = shot.t1 - shot.t0
  const u = clamp01(local / Math.max(1e-6, dur))

  switch (shot.id) {
    case 'flag': paintFlagShot(g, tt, u); break
    case 'forest': paintForestShot(g, tt, u); break
    case 'river': paintRiverShot(g, tt, u); break
    case 'hall': paintHallSilhouette(g, tt, u); break
    case 'emma': paintEmmaFlash(g, tt, u); break
    case 'face': paintHisFace(g, tt, u); break
    case 'closeups': {
      // 三个 2s 的快切：按镜头内的第几段选画
      if (local < 2) paintHandShot(g, tt, local / 2)
      else if (local < 4) paintBroochShot(g, tt, (local - 2) / 2)
      else paintHairShot(g, tt, (local - 4) / 2)
      break
    }
    case 'portraits': paintPortraitsShot(g, tt, u); break
    case 'approach': paintApproachShot(g, tt, u); break
    case 'painting': paintPaintingFarShot(g, tt, u); break
    case 'fire': paintFireShot(g, tt, u); break
    case 'faceNear':
    case 'mouth':
    case 'mouthClose': paintNearShot(g, tt); break
    default: break
  }

  // 旁白（画在黑场之前：镜头黑下来的同时，字也跟着沉下去）
  drawCaption(g, shot.narration, captionAlpha(shot, local))

  // 镜头之间的黑场：每段自己淡入淡出（12–14 是同一段推近，不切黑）
  let black = 0
  const fi = shot.fadeIn ?? 0.2
  const fo = shot.fadeOut ?? 0.2
  if (fi > 0 && local < fi) black = Math.max(black, 1 - local / fi)
  if (fo > 0 && local > dur - fo) black = Math.max(black, (local - (dur - fo)) / fo)
  // 全片结尾：最后 1.4s 沉到黑（嘴唇在黑暗里消失）
  const endFade = 1.4
  if (tt > CF_TOTAL - endFade) {
    black = Math.max(black, (tt - (CF_TOTAL - endFade)) / endFade)
  }
  if (black > 0.002) {
    g.fillStyle = `rgba(0,0,0,${clamp01(black).toFixed(3)})`
    g.fillRect(0, 0, CF_W, CF_H)
  }

  g.restore()
}
