// ============================================================
// 瓦片：程序化像素绘制（16×16），零外部素材
// 光源统一在左上；每块建材至少给出 暗 / 中 / 亮 三档。
// TILES 的键就是地图 tiles 层的字符。
// ============================================================
import { TILE } from './build'

/** 16 色调色板（ART_AUDIO_SPEC §1） */
export const C = {
  night: '#0b0d10',   // 0 夜黑
  shadow: '#15181d',  // 1 深影
  graphite: '#232830',// 2 石墨
  stone: '#333a45',   // 3 石灰
  cold: '#4d5665',    // 4 冷灰
  mist: '#6f7a8c',    // 5 雾灰
  pale: '#9aa6b8',    // 6 淡灰
  bone: '#d8dde5',    // 7 骨白
  sugar: '#f2ece0',   // 8 糖白
  bloodDark: '#8c1f28',// 9 暗血
  blood: '#c0392b',   // 10 血红
  fire: '#e05a3a',    // 11 火橙
  teal: '#2b3a4a',    // 12 暗青
  moss: '#3d4a2f',    // 13 苔绿
  brass: '#7a6a3a',   // 14 黄铜
  gold: '#c8a040',    // 15 甜金
} as const

const GEM = {
  ruby: '#b02040',
  emerald: '#1f6b4a',
  diamond: '#b8d8e8',
} as const

type Ctx = CanvasRenderingContext2D

/**
 * 字符网格 → 颜色（'.' 与空格为透明）。
 * 前 16 个仍在规格调色板内；g~j 是木料四阶，k~m 是冷杉四阶（低饱和绿）。
 */
export const PAL: Record<string, string> = {
  '0': C.night,
  '1': C.shadow,
  '2': C.graphite,
  '3': C.stone,
  '4': C.cold,
  '5': C.mist,
  '6': C.pale,
  '7': C.bone,
  '8': C.sugar,
  '9': C.bloodDark,
  a: C.blood,
  b: C.fire,
  c: C.teal,
  d: C.moss,
  e: C.brass,
  f: C.gold,
  g: '#241a10', // 木·最深
  h: '#3f2f1c', // 木·暗
  i: '#5c4630', // 木·中
  j: '#77603f', // 木·亮
  k: '#26331f', // 冷杉·暗
  l: '#36452a', // 冷杉·中
  m: '#4b5d38', // 冷杉·亮
}

function make(draw: (g: Ctx) => void, w = TILE, h = TILE): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  draw(g)
  return c
}

/** 确定性伪随机（避免每帧闪烁） */
function rnd(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

function px(g: Ctx, x: number, y: number, col: string): void {
  g.fillStyle = col
  g.fillRect(x, y, 1, 1)
}

function r(g: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  g.fillStyle = col
  g.fillRect(x, y, w, h)
}

/** 逐像素把字符网格画到 context（fillRect 1×1，无抗锯齿） */
export function paintRows(g: Ctx, rows: string[], pal: Record<string, string> = PAL): void {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y]
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.' || ch === ' ') continue
      const col = pal[ch]
      if (!col || col === 'transparent') continue
      g.fillStyle = col
      g.fillRect(x, y, 1, 1)
    }
  }
}

/** 把字符网格包成 make() 需要的绘制函数 */
function G(rows: string[]): (g: Ctx) => void {
  return (g) => paintRows(g, rows)
}

// ============================================================
// 字符网格瓦片
// ============================================================

/**
 * 石地：大块错缝石板，比石墙暗一档，两个区域一眼能分开。
 * 11px 见方的石板，板缝在第 11 行/列（不贴瓦片边界，拼接看不到接缝）：
 * 2 板面 / 3 受光边 / 1 背光边与板缝，零散 3 点当磨损。
 */
const T_FLOOR_STONE: string[] = [
  '2222222222103222',
  '2222222222103222',
  '2223222222103222',
  '2222222222103222',
  '2222222222103222',
  '2222222322103222',
  '2222222222103222',
  '2222322222103222',
  '2222222222103222',
  '2222222322103222',
  '1111111111103222',
  '1111111111111111',
  '3333333333303222',
  '2222222222103222',
  '2222222222103222',
  '2222222222103222',
]

/**
 * 石墙：四层错缝砌块。
 * 每层「4 顶光 / 3 墙面 / 2 右侧背光 / 1 砖缝」；竖向砖缝交错，避开瓦片边界。
 */
const T_WALL_STONE: string[] = [
  '4444214444444144',
  '3333214333332143',
  '333321433d332143',
  '1110111111101111',
  '2144444441444444',
  '2143333331433333',
  '214333333143d333',
  '1110111111101111',
  '4444214444444144',
  '3333214333332143',
  '33c3214333332143',
  '1110111111101111',
  '2144444441444444',
  '2143333331433333',
  '2143333331433d33',
  '1110111111101111',
]

/**
 * 门洞：可通行的敞开门框。
 * 3 石墙 / 4 门柱受光 / 0 门后黑暗 / 1 门后地面 / 2 门槛；拱顶开阔，一眼能认出是门。
 */
const T_DOORWAY: string[] = [
  '3333300000033333',
  '3333000000003333',
  '3300000000000033',
  '3000000000000003',
  '3440000000000443',
  '3440000000000443',
  '3440000000000443',
  '3440000000000443',
  '3440000000000443',
  '3440000000000443',
  '3440000000000443',
  '3440000000000443',
  '3440000000100443',
  '3440000000110443',
  '3441111111111443',
  '3442222222222443',
]

/**
 * 楼梯：四级横向台阶。
 * 4 踏面前缘高光 / 3 踏面 / 2 立面 / 台阶高 4px，纵向连续不露接缝。
 */
const T_STAIR: string[] = [
  '4444444444444444',
  '3333333333333333',
  '3333233333332333',
  '2222222222222222',
  '4444444444444444',
  '3333333333333333',
  '3333332333323333',
  '2222222222222222',
  '4444444444444444',
  '3333333333333333',
  '3333233333332333',
  '2222222222222222',
  '4444444444444444',
  '3333333333333333',
  '3333332333323333',
  '2222222222222222',
]

/**
 * 窗：石墙上的哥特高窗。
 * 2 窗框与拱石 / c 窗外暗青夜空 / 5 淡月光 / 6 月心 / 4 窗棂 / 窗台 4 受光。
 */
const T_WINDOW: string[] = [
  '3333333333333333',
  '3333332222333333',
  '3333322222233333',
  '3332222222222333',
  '333255544ccc2333',
  '333265544ccc2333',
  '333255544ccc2333',
  '3332ccc44ccc2333',
  '3332444444442333',
  '3332ccc44ccc2333',
  '3332cc244c2c2333',
  '3332c2c44c2c2333',
  '3332ccc44ccc2333',
  '3332222222222333',
  '3334444444444333',
  '3333333333333333',
]

/**
 * 月光窗洞：比普通窗亮得多的月窗。
 * 6 淡灰月光底 / 7 月盘 / 8 月心 / 4 窗棂；光溢到墙面与窗台，是室内最亮的瓦片。
 */
const T_MOON_WINDOW: string[] = [
  '3333333333333333',
  '3333332222333333',
  '3333322222233333',
  '3332222222222333',
  '3332666446662333',
  '3332677446662333',
  '3332678446662333',
  '3332677446662333',
  '3332444444442333',
  '3332666446662333',
  '4442666446662444',
  '3332666446662333',
  '3332666446662333',
  '3332222222222333',
  '4444444444444444',
  '3444444444444443',
]

// ============================================================
// 绘制型瓦片
// ============================================================

/** 室内地面底纹：石墨石面 + 少量石点，作为家具瓦片的底，和石地 '. ' 融合 */
function floorBackdrop(g: Ctx, seed: number): void {
  r(g, 0, 0, TILE, TILE, C.graphite)
  for (let i = 0; i < 11; i++) {
    const x = Math.floor(rnd(seed + i * 3.13) * TILE)
    const y = Math.floor(rnd(seed + i * 7.71) * TILE)
    px(g, x, y, i % 3 === 0 ? C.stone : C.shadow)
  }
}

/** 墙面底纹：供挂毯 / 画框 / 壁炉当底，与石墙 '# ' 同调 */
function wallBackdrop(g: Ctx, seed: number): void {
  r(g, 0, 0, TILE, TILE, C.stone)
  r(g, 0, 0, TILE, 1, C.cold)
  r(g, 0, 7, TILE, 1, C.graphite)
  r(g, 0, 15, TILE, 1, C.graphite)
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rnd(seed + i * 4.17) * TILE)
    const y = Math.floor(rnd(seed + i * 7.33) * TILE)
    px(g, x, y, i % 2 === 0 ? C.cold : C.graphite)
  }
}

/** 地毯：暗红绒面 + 稀疏织点 + 黄铜菱形暗纹 + 中心小花；边界全为绒面，平铺无缝 */
function drawCarpet(g: Ctx): void {
  r(g, 0, 0, TILE, TILE, C.bloodDark)
  // 织点：隔行错位，读作绒面而不是噪点
  for (let y = 0; y < TILE; y += 3) {
    for (let x = (y % 6 === 0 ? 0 : 1); x < TILE; x += 2) px(g, x, y, C.night)
  }
  // 黄铜菱形暗纹：只在四个方向各留几针，不做成硬图案
  const diamond: [number, number][] = [
    [7, 2], [8, 2], [6, 3], [9, 3], [4, 5], [11, 5],
    [2, 7], [13, 7], [2, 8], [13, 8], [4, 10], [11, 10],
    [6, 12], [9, 12], [7, 13], [8, 13],
  ]
  for (const [x, y] of diamond) px(g, x, y, C.brass)
  // 中心小花
  px(g, 7, 7, C.brass)
  px(g, 8, 8, C.brass)
  px(g, 8, 7, C.gold)
  px(g, 7, 8, C.brass)
}

/** 草地：暗苔绿底 + 2px 细草簇；草叶短、不跨格，平铺不出接缝 */
function drawGrass(g: Ctx): void {
  r(g, 0, 0, TILE, TILE, C.moss)
  // 地表起伏（少量暗斑）
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(rnd(23 + i * 3.7) * TILE)
    const y = Math.floor(rnd(23 + i * 6.1) * TILE)
    px(g, x, y, '#26331f')
  }
  // 草簇：上亮下暗的两像素细草
  for (let i = 0; i < 13; i++) {
    const x = Math.floor(rnd(31 + i * 4.3) * (TILE - 2)) + 1
    const y = Math.floor(rnd(31 + i * 9.1) * (TILE - 4)) + 2
    px(g, x, y, '#4b5d38')
    px(g, x, y + 1, '#36452a')
    if (i % 4 === 0) px(g, x + 1, y + 1, '#26331f')
  }
  // 零星露水
  for (let i = 0; i < 2; i++) {
    px(g, Math.floor(rnd(41 + i * 2.9) * TILE), Math.floor(rnd(41 + i * 5.5) * TILE), C.mist)
  }
}

/** 灌木：低矮灌丛，三团深绿叠出体积，底部压暗 */
function drawBush(g: Ctx): void {
  floorBackdrop(g, 133)
  const blob = (cx: number, cy: number, rr: number, col: string): void => {
    for (let y = Math.floor(cy - rr); y <= Math.ceil(cy + rr); y++) {
      for (let x = Math.floor(cx - rr); x <= Math.ceil(cx + rr); x++) {
        const dx = x - cx
        const dy = y - cy
        if (dx * dx + dy * dy * 1.4 <= rr * rr) px(g, x, y, col)
      }
    }
  }
  blob(8, 10, 5.4, '#26331f')
  blob(5.5, 9.5, 3.6, '#36452a')
  blob(10.5, 9.2, 3.2, C.moss)
  blob(6.2, 11.5, 3.0, C.moss)
  // 左上受光
  for (let i = 0; i < 9; i++) {
    const x = 3 + Math.floor(rnd(151 + i * 4.9) * 6)
    const y = 6 + Math.floor(rnd(151 + i * 6.7) * 4)
    px(g, x, y, '#4b5d38')
  }
  // 底部阴影与地面接触
  r(g, 4, 14, 9, 1, '#1b2416')
  r(g, 5, 15, 7, 1, '#1b2416')
}

/** 墓碑：墓园石碑，受光左缘 + 十字凹刻 + 底部青苔（'=' 已让位给车厢壁，当前未注册） */
function drawGrave(g: Ctx): void {
  r(g, 0, 0, TILE, TILE, '#232b20')
  for (let i = 0; i < 13; i++) {
    const x = Math.floor(rnd(161 + i * 3.1) * TILE)
    const y = Math.floor(rnd(161 + i * 5.9) * TILE)
    px(g, x, y, i % 3 === 0 ? C.moss : (i % 3 === 1 ? '#181f15' : C.graphite))
  }
  // 碑影
  r(g, 4, 14, 9, 2, '#141a12')
  // 碑身：圆顶
  r(g, 6, 3, 5, 1, C.stone)
  r(g, 5, 4, 7, 11, C.stone)
  r(g, 5, 4, 1, 11, C.cold)
  r(g, 6, 3, 4, 1, C.cold)
  r(g, 11, 4, 1, 11, C.graphite)
  r(g, 5, 14, 7, 1, C.graphite)
  // 十字凹刻
  r(g, 8, 6, 1, 6, C.graphite)
  r(g, 6, 8, 5, 1, C.graphite)
  r(g, 7, 6, 1, 5, C.pale)
  r(g, 6, 7, 4, 1, C.pale)
  // 苔痕
  px(g, 5, 12, C.moss)
  px(g, 6, 13, C.moss)
  px(g, 10, 13, '#26331f')
}

/** 齿轮：黄铜八齿机械轮，方齿、厚轮缘、中心轴孔；左上受光 */
function drawGear(g: Ctx): void {
  r(g, 0, 0, TILE, TILE, C.graphite)
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(rnd(177 + i * 3.3) * TILE)
    const y = Math.floor(rnd(177 + i * 6.9) * TILE)
    px(g, x, y, i % 2 === 0 ? C.shadow : C.stone)
  }
  const cx = 7.5
  const cy = 7.5
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const dx = x - cx
      const dy = y - cy
      const d = Math.sqrt(dx * dx + dy * dy)
      const ang = Math.atan2(dy, dx)
      // 八个方齿：沿半径方向伸出的矩形
      const sector = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4)
      const along = dx * Math.cos(sector) + dy * Math.sin(sector)
      const perp = -dx * Math.sin(sector) + dy * Math.cos(sector)
      const tooth = along > 3.9 && along < 6.2 && Math.abs(perp) < 1.3
      if (d > 2.1 && (d <= 4.1 || tooth)) {
        // 光源在左上：朝左上的轮缘给甜金，其余黄铜，右下压暗
        const lit = -dx - dy > 3.5
        const dark = dx + dy > 4.5
        px(g, x, y, lit ? C.gold : (dark ? '#5f5430' : C.brass))
      } else if (d <= 2.1) {
        px(g, x, y, d <= 1.0 ? C.graphite : C.shadow)
      }
    }
  }
  // 轮缘上的铆点
  px(g, 4, 4, C.gold)
  px(g, 11, 11, '#5f5430')
}

/** 铁栅栏：栏后黑暗，四根矛尖铁条 + 两道横档，左上受光 */
function drawGrille(g: Ctx): void {
  r(g, 0, 0, TILE, TILE, C.night)
  r(g, 0, 12, TILE, 4, C.shadow)
  // 横档
  r(g, 0, 2, TILE, 1, C.cold)
  r(g, 0, 3, TILE, 1, C.graphite)
  r(g, 0, 11, TILE, 1, C.cold)
  r(g, 0, 12, TILE, 1, C.graphite)
  // 竖铁条与矛尖
  for (const x of [2, 6, 10, 14]) {
    r(g, x, 1, 1, 14, C.cold)
    px(g, x, 0, C.mist)
    px(g, Math.min(TILE - 1, x + 1), 1, C.graphite)
    px(g, x, 2, C.mist)
    px(g, x, 11, C.mist)
  }
  // 底部石基
  r(g, 0, 14, TILE, 1, C.graphite)
  r(g, 0, 15, TILE, 1, C.shadow)
}

/** 挂毯：石墙上的暗红织毯，黄铜杆 + 金线纹章 + 流苏 */
function drawTapestry(g: Ctx): void {
  wallBackdrop(g, 191)
  // 挂杆与挂环
  r(g, 1, 0, 14, 1, C.brass)
  r(g, 1, 0, 14, 1, C.brass)
  px(g, 2, 0, C.gold)
  px(g, 13, 0, C.gold)
  r(g, 2, 1, 1, 1, C.graphite)
  r(g, 13, 1, 1, 1, C.graphite)
  // 毯面
  r(g, 2, 1, 12, 13, C.bloodDark)
  r(g, 2, 1, 12, 1, '#a02a34')
  r(g, 2, 1, 1, 13, '#a02a34')
  r(g, 13, 1, 1, 13, '#6a1620')
  // 上下金线
  r(g, 2, 2, 12, 1, C.brass)
  r(g, 2, 12, 12, 1, C.brass)
  // 纹章：金色菱形 + 中心十字
  px(g, 7, 5, C.gold)
  px(g, 8, 5, C.gold)
  r(g, 6, 6, 4, 1, C.gold)
  r(g, 7, 7, 2, 3, C.gold)
  px(g, 5, 7, C.brass)
  px(g, 10, 7, C.brass)
  px(g, 7, 10, C.brass)
  px(g, 8, 10, C.brass)
  // 流苏
  for (let x = 2; x < 14; x += 2) px(g, x, 14, C.brass)
}

/** 冷杉：细高的三层针叶剪影，树干可见；密排成林时留出空隙不显重复 */
function drawTree(g: Ctx): void {
  // 林下地面（暗绿 + 苔点），与草地暗部衔接
  r(g, 0, 0, TILE, TILE, '#1e2a1a')
  for (let i = 0; i < 13; i++) {
    const x = Math.floor(rnd(211 + i * 3.1) * TILE)
    const y = Math.floor(rnd(211 + i * 6.7) * TILE)
    px(g, x, y, i % 3 === 0 ? '#36452a' : (i % 3 === 1 ? '#26331f' : C.moss))
  }
  // 树干：只在下半露出，左缘受光
  r(g, 7, 8, 2, 8, '#3a2a1c')
  r(g, 7, 8, 1, 8, '#55402a')
  r(g, 6, 15, 4, 1, '#241a10')
  px(g, 6, 12, '#3a2a1c')
  px(g, 9, 13, '#3a2a1c')
  // 三层树冠：越往下越宽，层与层之间留一道暗缝
  const tiers: [number, number][] = [[0, 5], [3, 7], [7, 9]]
  for (const [y0, w] of tiers) {
    const h = 4
    for (let row = 0; row < h; row++) {
      const ww = Math.max(1, Math.round((w * (row + 1)) / h))
      const x0 = 8 - Math.floor(ww / 2)
      for (let x = x0; x < x0 + ww; x++) {
        const col = x < 8 ? (x === x0 ? '#4b5d38' : '#36452a') : '#26331f'
        px(g, x, y0 + row, col)
      }
    }
    // 层底：锯齿状的针叶边
    const wb = w
    const xb = 8 - Math.floor(wb / 2)
    for (let x = xb; x < xb + wb; x += 2) px(g, x, y0 + h, '#141c12')
  }
  // 顶芽与受光针叶
  px(g, 8, 0, '#4b5d38')
  px(g, 6, 4, '#4b5d38')
  px(g, 5, 8, '#4b5d38')
  px(g, 4, 10, '#36452a')
  px(g, 11, 9, '#1e2a1a')
}

/** 悬崖边缘：崖顶草缘、堆叠的大块岩石立面、崖脚阴影与断崖黑暗；阻挡 */
function drawCliff(g: Ctx): void {
  // 崖顶草地边缘
  r(g, 0, 0, TILE, 3, C.moss)
  for (let i = 0; i < 12; i++) {
    px(g, Math.floor(rnd(231 + i * 3.3) * TILE), Math.floor(rnd(231 + i * 4.1) * 3), i % 2 ? '#36452a' : '#26331f')
  }
  // 岩石立面：几块大小不一的岩石，每块左上受光、右下背光
  const blocks: [number, number, number, number][] = [
    [0, 3, 6, 5],
    [6, 3, 5, 7],
    [11, 3, 5, 5],
    [0, 9, 7, 4],
    [7, 11, 4, 2],
    [11, 9, 5, 4],
  ]
  for (const [x, y, w, h] of blocks) {
    r(g, x, y, w, h, C.stone)
    r(g, x, y, w, 1, C.cold)
    r(g, x, y, 1, h, C.cold)
    r(g, x, y + h - 1, w, 1, C.graphite)
    r(g, x + w - 1, y, 1, h, C.graphite)
  }
  // 石块下缘的阴影缝
  r(g, 0, 8, 6, 1, C.shadow)
  r(g, 6, 10, 5, 1, C.shadow)
  r(g, 11, 8, 5, 1, C.shadow)
  r(g, 0, 13, 7, 1, C.shadow)
  // 崖脚：石棱 → 阴影 → 黑暗
  r(g, 0, 13, TILE, 1, C.graphite)
  r(g, 0, 14, TILE, 2, C.night)
  // 垂下来的草根
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(rnd(241 + i * 5.1) * TILE)
    px(g, x, 3, '#36452a')
    if (i % 2 === 0) px(g, x, 4, '#26331f')
  }
}

/** 铁轨：道砟 + 两根钢轨 + 枕木；可正常行走 */
function drawRail(g: Ctx): void {
  // 道砟
  r(g, 0, 0, TILE, TILE, C.graphite)
  for (let i = 0; i < 66; i++) {
    const x = Math.floor(rnd(311 + i * 2.7) * TILE)
    const y = Math.floor(rnd(311 + i * 5.3) * TILE)
    const n = i % 6
    px(g, x, y, n === 0 ? C.cold : (n === 1 ? C.stone : C.shadow))
  }
  // 枕木（竖向，每 8px 一根）
  for (const x0 of [0, 8]) {
    r(g, x0 + 1, 3, 3, 10, '#3f2f1c')
    r(g, x0 + 1, 3, 3, 1, '#5c4630')
    r(g, x0 + 2, 4, 1, 8, '#4a3822')
    r(g, x0 + 1, 12, 3, 1, '#241a10')
  }
  // 钢轨：横贯左右，轨面受光
  r(g, 0, 4, TILE, 2, C.graphite)
  r(g, 0, 5, TILE, 2, C.cold)
  r(g, 0, 5, TILE, 1, C.pale)
  r(g, 0, 9, TILE, 2, C.cold)
  r(g, 0, 9, TILE, 1, C.pale)
  r(g, 0, 10, TILE, 1, C.graphite)
  // 轨间阴影与轨钉
  r(g, 0, 7, TILE, 2, C.shadow)
  px(g, 2, 6, C.brass)
  px(g, 10, 6, C.brass)
  px(g, 2, 11, C.brass)
  px(g, 10, 11, C.brass)
}

/** 雾块：半透明雾团，中心浓、边缘散，叠在地面上像雾；可正常行走 */
function drawMist(g: Ctx): void {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const dx = (x - 7.5) / 8
      const dy = (y - 7.5) / 8
      const d = Math.sqrt(dx * dx + dy * dy)
      const base = Math.max(0, 1 - d * d)
      if (base <= 0.02) continue
      const n = rnd(x * 37 + y * 91 + 7)
      const a = base * (0.22 + n * 0.24)
      if (a < 0.015) continue
      g.fillStyle = n > 0.74 ? `rgba(154,166,184,${a.toFixed(3)})` : `rgba(111,122,140,${a.toFixed(3)})`
      g.fillRect(x, y, 1, 1)
    }
  }
  // 几颗更亮的雾气颗粒
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rnd(331 + i * 4.7) * TILE)
    const y = Math.floor(rnd(331 + i * 8.9) * TILE)
    g.fillStyle = 'rgba(216,221,229,0.16)'
    g.fillRect(x, y, 1, 1)
  }
}

/** 烛台：三枝黄铜烛台，烛焰照亮台面；阻挡 */
function drawCandelabra(g: Ctx): void {
  floorBackdrop(g, 71)
  // 底座与立柱
  r(g, 4, 14, 8, 2, C.brass)
  r(g, 4, 14, 8, 1, C.gold)
  r(g, 5, 15, 6, 1, C.graphite)
  r(g, 6, 13, 4, 1, C.brass)
  r(g, 7, 9, 2, 4, C.brass)
  r(g, 7, 9, 1, 4, C.gold)
  // 横臂
  r(g, 2, 8, 12, 1, C.brass)
  r(g, 2, 8, 1, 1, C.gold)
  r(g, 13, 8, 1, 1, C.graphite)
  // 三个烛杯
  r(g, 2, 7, 4, 1, C.brass)
  r(g, 6, 7, 4, 1, C.brass)
  r(g, 10, 7, 4, 1, C.brass)
  // 蜡烛（骨白，左受光）
  r(g, 3, 3, 2, 4, C.bone)
  px(g, 3, 3, C.sugar)
  px(g, 4, 3, C.pale)
  r(g, 7, 2, 2, 5, C.bone)
  px(g, 7, 2, C.sugar)
  px(g, 8, 2, C.pale)
  r(g, 11, 3, 2, 4, C.bone)
  px(g, 11, 3, C.sugar)
  px(g, 12, 3, C.pale)
  // 火焰：外圈火橙、内芯甜金、顶部糖白
  r(g, 3, 1, 2, 2, C.fire)
  px(g, 3, 1, C.gold)
  px(g, 4, 0, C.sugar)
  r(g, 7, 0, 2, 2, C.fire)
  px(g, 7, 0, C.sugar)
  r(g, 11, 1, 2, 2, C.fire)
  px(g, 11, 1, C.gold)
  px(g, 12, 0, C.sugar)
  // 火光溢到台面
  px(g, 2, 5, C.bloodDark)
  px(g, 13, 5, C.bloodDark)
  px(g, 5, 6, C.bloodDark)
  px(g, 10, 6, C.bloodDark)
}

/** 桌子：占满一格的木桌，桌面有信纸与酒杯；阻挡 */
function drawTable(g: Ctx): void {
  floorBackdrop(g, 83)
  // 桌面：左上受光，右下压暗
  r(g, 1, 1, 14, 14, '#5c4630')
  r(g, 1, 1, 14, 2, '#77603f')
  r(g, 1, 1, 2, 14, '#77603f')
  r(g, 13, 1, 2, 14, '#3f2f1c')
  r(g, 1, 13, 14, 2, '#3f2f1c')
  // 木纹
  r(g, 3, 5, 10, 1, '#4a3822')
  r(g, 3, 9, 10, 1, '#6a5038')
  r(g, 2, 11, 12, 1, '#4a3822')
  // 信纸
  r(g, 3, 3, 6, 5, C.bone)
  r(g, 3, 3, 6, 1, C.sugar)
  r(g, 8, 3, 1, 5, C.pale)
  px(g, 4, 5, C.pale)
  px(g, 5, 5, C.pale)
  px(g, 6, 5, C.pale)
  // 酒杯
  r(g, 10, 3, 3, 3, C.pale)
  r(g, 10, 5, 3, 2, C.bloodDark)
  r(g, 10, 3, 3, 1, C.bone)
  r(g, 11, 7, 1, 1, C.pale)
  // 桌腿压出的暗角
  r(g, 1, 14, 14, 1, C.shadow)
}

/** 壁炉：石砌炉台与拱形炉膛，炉火是画面里唯一的暖源；阻挡 */
function drawFireplace(g: Ctx): void {
  wallBackdrop(g, 89)
  // 炉台（左受光、右背光）
  r(g, 0, 4, TILE, 1, C.cold)
  r(g, 0, 5, TILE, 1, C.graphite)
  // 炉口
  r(g, 3, 6, 10, 10, C.night)
  r(g, 3, 6, 1, 10, C.graphite)
  r(g, 12, 6, 1, 10, C.shadow)
  // 拱顶
  r(g, 4, 5, 8, 1, C.graphite)
  r(g, 3, 6, 1, 1, C.graphite)
  // 火床
  r(g, 4, 14, 8, 2, C.bloodDark)
  r(g, 5, 13, 6, 1, C.bloodDark)
  // 火焰：外橙、内金、芯白
  r(g, 6, 11, 4, 3, C.fire)
  r(g, 7, 9, 2, 5, C.fire)
  r(g, 7, 12, 2, 2, C.gold)
  px(g, 7, 8, C.fire)
  px(g, 8, 10, C.gold)
  // 余烬
  px(g, 5, 15, C.blood)
  px(g, 10, 15, C.blood)
  px(g, 9, 14, C.gold)
  // 火光溢到炉石
  px(g, 3, 9, C.bloodDark)
  px(g, 12, 9, C.bloodDark)
  px(g, 3, 12, C.bloodDark)
  px(g, 12, 12, C.bloodDark)
}

/** 床：床头板、蓬起的枕头、骨白被子与床尾板，从上到下三段；阻挡 */
function drawBed(g: Ctx): void {
  floorBackdrop(g, 211)
  // 床头板（最上面一条横木，让床有"头"）
  r(g, 1, 0, 14, 2, '#5c4630')
  r(g, 1, 0, 14, 1, '#77603f')
  // 床架
  r(g, 1, 2, 14, 13, '#3f2f1c')
  r(g, 1, 2, 1, 13, '#5c4630')
  r(g, 14, 2, 1, 13, '#241a10')
  // 床垫
  r(g, 2, 3, 12, 11, C.bone)
  r(g, 2, 3, 12, 1, C.sugar)
  r(g, 13, 3, 1, 11, C.pale)
  // 枕头（蓬起：中间高一行）
  r(g, 3, 3, 10, 3, C.sugar)
  r(g, 4, 3, 8, 1, '#f2ece0')
  r(g, 3, 5, 10, 1, C.pale)
  // 被子：骨白被面 + 折纹 + 被脚阴影
  r(g, 2, 6, 12, 8, C.bone)
  r(g, 2, 6, 12, 1, C.sugar)
  r(g, 2, 13, 12, 1, C.pale)
  r(g, 2, 9, 12, 1, C.pale)
  // 床尾板与床脚
  r(g, 1, 13, 14, 1, '#5c4630')
  r(g, 0, 14, 3, 2, '#241a10')
  r(g, 13, 14, 3, 2, '#241a10')
}

/** 书架：木壳三层书架，书脊颜色克制；阻挡 */
function drawBookshelf(g: Ctx): void {
  r(g, 0, 0, TILE, TILE, '#3f2f1c')
  r(g, 0, 0, TILE, 1, '#77603f')
  r(g, 0, 0, 1, TILE, '#5c4630')
  r(g, 15, 0, 1, TILE, '#241a10')
  r(g, 0, 15, TILE, 1, '#241a10')
  // 背板
  r(g, 1, 1, 14, 14, '#241a10')
  const bookCols = ['#7a1c24', '#6b5c32', '#26333f', '#33402a', '#3f4754', '#5c4a2c']
  const shelfY = [1, 6, 11]
  for (let s = 0; s < 3; s++) {
    const y0 = shelfY[s]
    for (let i = 0; i < 7; i++) {
      const h = 3 + Math.floor(rnd(401 + s * 19 + i * 3.3) * 2)
      const w = i % 3 === 0 ? 2 : 1
      const x = 2 + i * 2
      const col = bookCols[(i + s * 2) % bookCols.length]
      r(g, x, y0 + 4 - h, w, h, col)
      px(g, x, y0 + 4 - h, '#9aa6b8')
    }
    // 隔板
    r(g, 1, y0 + 4, 14, 1, '#5c4630')
    px(g, 1, y0 + 4, '#77603f')
  }
}

/** 画框：墙上的竖幅小肖像，黄铜框 + 红发女性；阻挡 */
function drawPainting(g: Ctx): void {
  wallBackdrop(g, 97)
  // 竖幅框
  r(g, 3, 1, 10, 14, C.brass)
  r(g, 3, 1, 10, 1, C.gold)
  r(g, 3, 1, 1, 14, C.gold)
  r(g, 12, 1, 1, 14, '#3f2f1c')
  r(g, 3, 14, 10, 1, '#3f2f1c')
  // 画面：暗紫黑底
  r(g, 4, 2, 8, 12, C.shadow)
  r(g, 4, 2, 8, 1, '#2c2130')
  // 红发
  r(g, 5, 3, 6, 2, '#a83224')
  r(g, 5, 3, 6, 1, '#d95b3a')
  r(g, 5, 5, 1, 4, '#a83224')
  r(g, 10, 5, 1, 4, '#a83224')
  // 脸
  r(g, 6, 5, 4, 5, C.bone)
  r(g, 6, 8, 4, 2, C.pale)
  r(g, 6, 5, 1, 4, C.sugar)
  px(g, 7, 6, '#2b5f9a')
  px(g, 8, 6, '#2b5f9a')
  px(g, 7, 8, '#8a4048')
  // 颈与黑裙
  r(g, 7, 9, 2, 1, C.pale)
  r(g, 5, 10, 6, 4, C.night)
  r(g, 5, 10, 6, 1, '#221a26')
  // 胸针
  px(g, 7, 11, C.cold)
  px(g, 8, 11, C.cold)
  px(g, 7, 12, C.blood)
}

// ============================================================
// 车厢（序章列车）：木与铁，不是石砌城堡
// ============================================================

/**
 * 车厢壁：竖向木板 + 深棕木框 + 底部一条黄铜踢脚线。
 * 板宽 4px（亮缘 / 中板 / 中暗 / 板缝），周期整除 16，横向平铺看不到接缝。
 */
function drawCoachWall(g: Ctx): void {
  for (let x = 0; x < TILE; x += 4) {
    r(g, x, 0, 1, TILE, '#77603f')     // 板·亮（受光左缘）
    r(g, x + 1, 0, 1, TILE, '#5c4630') // 板·中
    r(g, x + 2, 0, 1, TILE, '#4a3822') // 板·中偏暗
    r(g, x + 3, 0, 1, TILE, '#3f2f1c') // 板缝
  }
  // 木纹：短暗纹，固定位置，不抖成噪点
  for (let x = 0; x < TILE; x += 4) {
    px(g, x + 1, 5, '#3f2f1c')
    px(g, x + 2, 9, '#3f2f1c')
    px(g, x + 1, 12, '#6a5038')
  }
  // 上横框：受光顶梁 + 梁下暗线
  r(g, 0, 0, TILE, 1, '#8a7048')
  r(g, 0, 1, TILE, 1, '#3f2f1c')
  // 下横框与黄铜踢脚线
  r(g, 0, 13, TILE, 1, '#3f2f1c')
  r(g, 0, 14, TILE, 1, C.brass)
  px(g, 1, 14, C.gold)
  px(g, 9, 14, C.gold)
  px(g, 5, 14, '#5f5430')
  r(g, 0, 15, TILE, 1, '#1a120a')
}

/**
 * 车厢地板：横向长条木地板。
 * 三块板高 4 / 5 / 5，板缝落在 4、10、瓦片边界，间距不等；
 * 板端接缝在三块板上错开，板 B 上有一片油渍。
 */
function drawCoachFloor(g: Ctx): void {
  r(g, 0, 0, TILE, TILE, '#5c4630')       // 板面·中
  // 板 A：y0..y3
  r(g, 0, 0, TILE, 1, '#77603f')          // 板顶受光
  r(g, 0, 3, TILE, 1, '#3f2f1c')          // 板底
  r(g, 0, 4, TILE, 1, '#241a10')          // 板缝
  // 板 B：y5..y9
  r(g, 0, 5, TILE, 1, '#77603f')
  r(g, 0, 9, TILE, 1, '#3f2f1c')
  r(g, 0, 10, TILE, 1, '#241a10')         // 板缝
  // 板 C：y11..y15
  r(g, 0, 11, TILE, 1, '#77603f')
  r(g, 0, 15, TILE, 1, '#3f2f1c')         // 板底（与下一格板顶相接）
  // 横向长木纹：细、断续，不让地板读成柜门
  r(g, 2, 2, 10, 1, '#4a3822')
  r(g, 6, 7, 7, 1, '#4a3822')
  r(g, 1, 13, 9, 1, '#4a3822')
  // 板端接缝：只留两像素的短线，三块板错开
  px(g, 12, 1, '#3f2f1c')
  px(g, 12, 2, '#3f2f1c')
  px(g, 5, 6, '#3f2f1c')
  px(g, 5, 7, '#3f2f1c')
  px(g, 9, 12, '#3f2f1c')
  px(g, 9, 13, '#3f2f1c')
  // 油渍：板 B 上一摊深褐，油膜留一点反光
  r(g, 9, 6, 4, 1, '#3f2f1c')
  r(g, 8, 7, 5, 1, '#2e2214')
  r(g, 9, 8, 3, 1, '#3a2a1a')
  px(g, 11, 7, '#77603f')
}

/**
 * 车窗（夜）：车厢壁上的小方窗，黄铜窗框，一根竖棂。
 * 窗洞只有 8×7（普通石墙窗是 10×10 的哥特高窗），外面是暗青夜色与一点雾。
 */
function drawCoachWindow(g: Ctx): void {
  // 底：与 '=' 同调的竖板车厢壁
  for (let x = 0; x < TILE; x += 4) {
    r(g, x, 0, 1, TILE, '#77603f')
    r(g, x + 1, 0, 2, TILE, '#5c4630')
    r(g, x + 3, 0, 1, TILE, '#3f2f1c')
  }
  r(g, 0, 0, TILE, 1, '#8a7048')
  r(g, 0, 1, TILE, 1, '#3f2f1c')
  r(g, 0, 13, TILE, 1, '#3f2f1c')
  r(g, 0, 14, TILE, 1, C.brass)
  r(g, 0, 15, TILE, 1, '#1a120a')

  // 窗框：10 宽 9 高，比普通窗明显小一圈
  r(g, 3, 2, 10, 1, C.gold)       // 上框受光
  r(g, 3, 10, 10, 1, C.brass)     // 下框
  r(g, 3, 2, 1, 9, C.gold)        // 左框受光
  r(g, 12, 2, 1, 9, C.brass)      // 右框
  r(g, 12, 9, 1, 2, '#5f5430')    // 右下背光

  // 窗外：大半是夜黑，只有贴近下沿的一带暗青（远处的林线）与雾
  r(g, 4, 3, 8, 7, C.night)
  r(g, 4, 8, 8, 2, C.teal)
  r(g, 4, 7, 8, 1, C.shadow)
  r(g, 5, 8, 1, 2, C.shadow)
  r(g, 9, 8, 1, 2, C.shadow)
  // 窗外一点雾
  px(g, 5, 9, C.mist)
  px(g, 6, 8, C.mist)
  px(g, 9, 9, C.mist)
  px(g, 10, 8, C.mist)
  // 竖棂：把窗分成两扇
  r(g, 7, 3, 1, 7, C.brass)
  px(g, 7, 3, C.gold)
  // 窗台：受光的木沿
  r(g, 2, 11, 12, 1, '#77603f')
  r(g, 2, 12, 12, 1, '#3f2f1c')
}

/**
 * 车厢内饰板：窗与窗之间的窄木板 + 一排铜制挂钩。
 * 板宽 5px，比车厢壁的板更窄；可走，玩家能靠到窗边的墙根。
 */
function drawCoachPanel(g: Ctx): void {
  for (let x = 0; x < TILE; x += 5) {
    r(g, x, 0, 1, TILE, '#77603f')
    r(g, x + 1, 0, 3, TILE, '#5c4630')
    if (x + 4 < TILE) r(g, x + 4, 0, 1, TILE, '#3f2f1c')
  }
  r(g, 15, 0, 1, TILE, '#4a3822')
  r(g, 0, 0, TILE, 1, '#8a7048')
  r(g, 0, 1, TILE, 1, '#3f2f1c')
  // 黄铜护墙线
  r(g, 0, 9, TILE, 1, C.brass)
  px(g, 6, 9, C.gold)
  // 铜挂钩：三个倒 L 形
  for (const x of [2, 7, 12]) {
    px(g, x, 3, C.gold)
    px(g, x, 4, C.brass)
    px(g, x + 1, 5, C.brass)
  }
  // 底部木框与踢脚线
  r(g, 0, 13, TILE, 1, '#3f2f1c')
  r(g, 0, 14, TILE, 1, C.brass)
  r(g, 0, 15, TILE, 1, '#1a120a')
  // 板面木纹
  px(g, 1, 6, '#3f2f1c')
  px(g, 6, 11, '#3f2f1c')
  px(g, 11, 7, '#3f2f1c')
}

/**
 * 座椅：暗红丝绒长椅（俯视）。
 * 上半是靠背、下半是坐垫，中间一道深缝，两侧竖铜扶手带圆头；
 * 丝绒靠竖光条与几点反光读作绒面，不是木箱。
 */
function drawCoachSeat(g: Ctx): void {
  // 丝绒暗底
  r(g, 0, 0, TILE, TILE, '#3a0b12')
  // 靠背：顶沿受光、两角略收，向右侧压暗
  r(g, 2, 0, 12, 8, '#4e1219')
  r(g, 3, 0, 10, 1, '#9a3038')       // 顶沿受光
  r(g, 2, 1, 1, 7, '#6e1a24')        // 左缘受光
  r(g, 13, 1, 1, 7, '#3a0b12')       // 右缘背光
  // 绒面竖光：成组的细条，中间一条更亮
  for (const x of [4, 6, 9, 11]) r(g, x, 2, 1, 6, '#5c161f')
  r(g, 5, 2, 1, 5, '#7d1e27')
  r(g, 10, 3, 1, 4, '#7d1e27')
  // 靠背与坐垫之间的深缝
  r(g, 2, 8, 12, 1, '#2a080d')
  // 坐垫：比靠背亮一档
  r(g, 2, 9, 12, 6, '#6e1a24')
  r(g, 2, 9, 12, 1, '#9a3038')       // 前沿受光
  r(g, 2, 10, 1, 5, '#8c2a30')
  r(g, 13, 10, 1, 5, '#4e1219')
  r(g, 2, 14, 12, 1, '#4e1219')      // 前缘压暗
  // 两个坐垫的鼓包高光
  r(g, 4, 10, 2, 1, '#8c2a30')
  r(g, 10, 11, 2, 1, '#8c2a30')
  // 双座分缝
  r(g, 7, 9, 1, 6, '#3a0b12')
  // 铜扶手：只占坐垫两侧，圆头朝内；靠背两侧露出丝绒
  r(g, 0, 8, 2, 7, C.brass)
  r(g, 0, 8, 1, 7, C.gold)
  r(g, 1, 8, 1, 7, '#5f5430')
  r(g, 14, 8, 2, 7, C.brass)
  r(g, 14, 8, 1, 7, C.gold)
  r(g, 15, 8, 1, 7, '#3f2f1c')
  r(g, 0, 7, 2, 1, C.gold)
  r(g, 14, 7, 2, 1, C.gold)
  r(g, 0, 14, 2, 1, '#3f2f1c')
  r(g, 14, 14, 2, 1, '#3f2f1c')
  // 丝绒反光
  px(g, 5, 3, '#b0343c')
  px(g, 10, 4, '#b0343c')
  px(g, 6, 12, '#9a3038')
}

/** 虚空：不画任何像素，让底层夜色或远景透出来；空白字符 ' ' 用 */
function drawVoid(g: Ctx): void {
  void g
}

// ============================================================
// 注册表
// ============================================================

export const TILES: Record<string, HTMLCanvasElement> = {
  '.': make(G(T_FLOOR_STONE)),   // 石地：错缝石板，室内外通用地面
  ',': make(drawCarpet),         // 地毯：暗红绒面 + 黄铜菱形织纹
  '#': make(G(T_WALL_STONE)),    // 石墙：四层错缝砌块，暗/中/亮三阶
  '~': make(drawGrass),          // 草地：暗苔绿草地与冷绿草簇
  'D': make(G(T_DOORWAY)),       // 门洞：可通行的敞开门框，门后是黑暗
  'L': make(drawCandelabra),     // 烛台：三枝黄铜烛台，注意烛火是画面暖源
  'E': make(drawTable),          // 桌子：木桌，桌面有信纸与一杯酒
  'W': make(G(T_WINDOW)),        // 窗：石墙窗，窗外暗青夜空与一点月
  'T': make(G(T_STAIR)),         // 楼梯：四级横向石阶
  'f': make(drawFireplace),      // 壁炉：石砌炉台与拱形炉膛，火焰最亮
  'b': make(drawBookshelf),      // 书架：木壳三层书架，书脊颜色克制
  'p': make(drawPainting),       // 画框：墙上的小肖像（红发女性）
  'B': make(drawBed),            // 床：木床架、骨白床单与被子
  '^': make(drawTree),           // 冷杉：细高深绿剪影，树干可见，可密排成林
  '*': make(drawBush),           // 灌木：低矮深绿灌丛
  'o': make(drawGear),           // 齿轮：黄铜八齿机械轮
  '+': make(drawGrille),         // 铁栅栏：矛尖铁条与横档，栏后漆黑
  'v': make(drawTapestry),       // 挂毯：石墙上的暗红织毯与黄铜纹章
  'r': make(drawRail),           // 铁轨：道砟、枕木与两根钢轨（可走，不阻挡）
  'q': make(drawMist),           // 雾：半透明雾团（可走，叠在地面上）
  'h': make(drawCliff),          // 悬崖边缘：崖顶草缘、岩石立面与断崖（阻挡）
  'n': make(G(T_MOON_WINDOW)),   // 月光窗洞：比普通窗亮得多的月窗（阻挡）
  '-': make(drawCoachFloor),     // 车厢地板：横向长条木板，一处油渍（可走）
  '=': make(drawCoachWall),      // 车厢壁：竖向木板 + 黄铜踢脚线（阻挡）
  'N': make(drawCoachWindow),    // 车窗：小方窗，窗外暗青夜色与一点雾（阻挡）
  'I': make(drawCoachPanel),     // 车厢内饰板：窄木板 + 铜挂钩（可走）
  'U': make(drawCoachSeat),      // 座椅：暗红丝绒长椅 + 铜扶手（阻挡）
  ' ': make(drawVoid),           // 虚空：透明，露出底层夜色 / 远景
}

/** 阻挡通行的瓦片（'r' 铁轨与 'q' 雾可走；车窗 'W'/'N'、座椅 'U'、虚空 ' ' 阻挡） */
export const SOLID_TILES = new Set(['#', 'W', 'L', 'E', 'f', 'b', 'p', 'B', '^', '=', 'o', '+', 'T', 'v', 'h', 'n', 'N', 'U', ' '])

/** 图纸层符号（供 renderer 使用） */
export const STRUCT_SYMBOL: Record<string, { color: string; kind: string }> = {
  V: { color: '#00000000', kind: 'void' },
  F: { color: '#00000000', kind: 'floor' },
  S: { color: '#8a8f96', kind: 'stone' },
  B: { color: '#5f6469', kind: 'brick' },
  K: { color: '#8a5a5a', kind: 'fake' },
  M: { color: '#a08a6a', kind: 'beam' },
  A: { color: '#c0b090', kind: 'arch' },
  P: { color: '#6a8a9a', kind: 'pipe' },
  R: { color: '#9a9a6a', kind: 'rail' },
  G: { color: '#c8a040', kind: 'gear' },
  W: { color: '#7a7a8a', kind: 'weight' },
  H: { color: '#5a7a6a', kind: 'shaft' },
  T: { color: '#8a8f96', kind: 'stair' },
  C: { color: '#5a7a6a', kind: 'cavity' },
  I: { color: '#b04040', kind: 'inkblot' },
  X: { color: '#e8e0d0', kind: 'torn' },
}

export { GEM, make }
