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

/**
 * 单人座椅（J / j）：一把朝过道的厢座单椅（俯视），不是一格红方块。
 * 靠背 y1..y6、坐垫 y7..y12，中间 y6 一道近黑深缝把两块分开；
 * 靠背 x3..x12（顶行窄 1px、两肩在 y2 下折 → 上沿是一道受光亮弧，右缘压暗）；
 * 坐垫 x4..x11，比靠背两侧各内收 1px，是比靠背亮一档的丝绒鼓包，下缘两角收圆；
 * 两侧黄铜扶手各 2px 宽（左 x2..x3、右 x12..x13），y6..y11，y6 是圆头；
 * 椅子正下方只压一条落影 —— 四周（x0..x1 / x14..x15）留出木地板，椅子才立得住。
 * 'j' 是同一张图上下翻转：靠背贴下侧车壁，坐垫朝上方的过道，隔着地毯与上排相对。
 */
function drawCoachSeatSingle(g: Ctx, down: boolean): void {
  // 下排：整格上下翻转（靠背贴下侧车壁，坐垫朝向上方的过道）
  if (down) {
    g.save()
    g.translate(0, TILE)
    g.scale(1, -1)
  }
  // 底：车厢木地板。椅子两侧留 3px、上下也留空，才读作"摆在车厢里的一把椅子"
  drawCoachFloor(g)
  // ---- 靠背 y1..y6 ----
  r(g, 3, 2, 10, 5, '#481017')       // 靠背本体 y2..y6
  r(g, 4, 1, 8, 1, '#481017')        // 顶沿窄 1px → 左右是圆肩
  r(g, 5, 1, 6, 1, '#cf4a54')        // 上沿受光亮弧：中间一段最亮
  px(g, 4, 1, '#a8303c'); px(g, 11, 1, '#a8303c')
  px(g, 3, 2, '#a8303c')             // 亮弧顺着左肩往下折一格
  r(g, 12, 2, 1, 5, '#1a0508')       // 右缘：近黑轮廓，把椅子从木地板上切出来
  // 绒面：左缘受光 + 三道竖光条
  r(g, 3, 3, 1, 3, '#6e1a24')
  for (const x of [5, 7, 10]) r(g, x, 3, 1, 3, '#5c161f')
  r(g, 6, 3, 1, 2, '#8c2a30')
  px(g, 9, 4, '#7d1e27')
  // 靠背与坐垫之间的深缝（1px 暗红黑）
  r(g, 4, 6, 8, 1, '#1a0508')
  // ---- 坐垫 y7..y12：比靠背窄 2px（两侧各内收 1px，正好落在两根扶手之间）----
  r(g, 4, 7, 8, 5, '#85212b')        // 坐垫本体：比靠背亮一档，先分出前后
  r(g, 4, 7, 8, 1, '#c94a52')        // 朝过道那一侧的前沿受光
  r(g, 4, 8, 1, 4, '#9a3038')        // 左缘受光
  r(g, 11, 8, 1, 4, '#4e1219')       // 右缘背光
  r(g, 5, 12, 6, 1, '#3a0b12')       // 前缘压暗，两角收圆
  // 丝绒鼓包的两处高光
  r(g, 6, 9, 3, 1, '#9a3038')
  px(g, 7, 10, '#8c2a30'); px(g, 8, 10, '#8c2a30')
  // 椅子在木地板上的落影：只在正下方压一条，别铺满整格
  r(g, 4, 13, 8, 1, '#3a2a1a')
  // ---- 两侧黄铜扶手：各 2px 宽，y6..y11，y6 是圆头 ----
  // 左 x2..x3：外侧受光，内侧那道暗黄铜是坐垫挨着扶手的影
  r(g, 2, 6, 2, 1, '#e8cf70')
  r(g, 2, 7, 1, 4, C.gold)
  r(g, 3, 7, 1, 4, C.brass)
  r(g, 2, 11, 2, 1, '#5f5430')
  // 右 x12..x13：镜面对称，两条扶手才夹得住坐垫
  r(g, 12, 6, 2, 1, '#e8cf70')
  r(g, 12, 7, 1, 4, C.brass)
  r(g, 13, 7, 1, 4, C.gold)
  r(g, 12, 11, 2, 1, '#5f5430')
  if (down) g.restore()
}

/**
 * 厢座小桌（K）：一张俯视的车厢小桌，不是白瓷缸。
 * 桌面 12×7（x2..x13 / y4..y10，四角各收 1px）、暖白带木纹；扁一点才像桌子。
 * 桌沿 y10 压一道深色，y11 与 y12 在木地板上压出投影 —— 桌子"坐"在地板上，
 * 不是浮着的；俯视看不到桌腿。
 * 一条白桌布横贯桌面，下缘垂过桌沿 1px、带锯齿边；
 * 布上方左边一只小碟、右边一只带杯耳的茶杯 —— 两样东西分开放，中间留出空当。
 * 阻挡：玩家只能绕到过道上，不能从桌面上穿过去。
 */
function drawCoachTable(g: Ctx): void {
  // 底：横木地板，和过道地面同一块料，桌子才不会浮空
  drawCoachFloor(g)
  // ---- 桌面：x2..x13 / y4..y10（12×7，扁一点更像桌子）----
  // 三面一圈木边（受光在上/左、背光在右），桌板才是"一块桌面"而不是一团白
  r(g, 3, 4, 10, 1, '#b99a68')     // 远侧木沿受光（首行窄 1px，四角因此是圆的）
  r(g, 2, 5, 1, 5, '#c8a878')      // 左木沿受光
  r(g, 13, 5, 1, 5, '#8a6f45')     // 右木沿背光
  r(g, 3, 5, 10, 5, '#e6d6b4')     // 桌板 y5..y9：暖白偏木，比桌布暗一档
  // 木纹：两笔横向短纹，避开桌上的碟与杯，读作木料而不是白瓷
  r(g, 7, 5, 2, 1, '#cdb78e')
  r(g, 3, 7, 2, 1, '#cdb78e')
  // ---- 桌上左边：一只小圆碟（菱形，四角留空才不读成方块）----
  px(g, 5, 5, C.pale)              // 碟后沿（冷灰瓷沿，才从暖白桌面上跳出来）
  r(g, 4, 6, 3, 1, C.pale)         // 碟两侧
  px(g, 5, 6, C.sugar)             // 碟心
  px(g, 5, 7, C.pale)              // 碟前沿
  // ---- 桌上右边：一只茶杯（白瓷口 + 深红茶汤 + 右边黄铜杯耳）----
  px(g, 10, 5, '#f7f2e8')          // 杯口后沿
  px(g, 9, 6, C.bone)              // 杯口左
  px(g, 10, 6, '#3a2414')          // 茶汤：整张桌上最暗的一点，杯才立得住
  px(g, 11, 6, C.bone)             // 杯口右
  px(g, 10, 7, C.bone)             // 杯口前沿
  px(g, 12, 6, C.gold)             // 杯耳·受光
  px(g, 12, 7, '#5f5430')          // 杯耳·背光
  // ---- 白桌布：横贯桌面，下缘垂过桌沿 ----
  r(g, 3, 8, 10, 1, '#fdfcf8')     // 布面受光（比暖白桌板更冷、更亮，才分得出是布）
  r(g, 3, 9, 10, 1, '#cdbfa4')     // 布面折下去投在桌板上的影
  // ---- 桌沿：1px 深色桌沿 + 桌布垂下来的锯齿边 ----
  r(g, 2, 10, 12, 1, '#4a3822')
  for (const x of [4, 6, 8, 10, 12]) px(g, x, 10, '#fdfcf8')
  // ---- 落在木地板上的投影：桌子"坐"在地上，不是浮着的（俯视看不到桌腿）----
  r(g, 3, 11, 10, 1, '#2e2214')
  r(g, 4, 12, 8, 1, '#3f2f1c')
}

/**
 * 厢座地毯（C / c / d）：过道中间铺的一条窄长毯，铺在木地板上。
 * 毯面（C）：比门厅地毯 ',' 亮一档的暗红丝绒，织纹每 4px 一针、隔行错位
 * （旧版 2px 一针，平铺后像格子布）；毯心的黄铜小菱形只画在中间一行，
 * 整条毯子因此只有中间一条 16px 一格的织纹带，不会铺成一整片花格子。
 * 整条毯子只有最外两行有包边：最上行用 c（上包边 + 短流苏），最下行用 d（下包边 + 短流苏），
 * 中间行用纯毯面 C —— 否则每一行都带边，3 行平铺会读成三条独立的地毯。
 */
function paintAisleFace(g: Ctx, medallion: boolean): void {
  // 绒面底：比 ',' 的暗血红亮一档，和两侧木地板拉得开
  r(g, 0, 0, TILE, TILE, '#8f2029')
  // 绒面织点：4px 一针、隔行错位，密度约为旧版的一半
  for (let y = 3; y < TILE - 1; y += 4) {
    const x0 = y % 8 === 3 ? 2 : 0
    for (let x = x0; x < TILE; x += 4) px(g, x, y, '#741a23')
  }
  // 几针提亮的绒面受光，读作丝绒的毛向而不是噪点
  for (const [x, y] of [[2, 5], [11, 7], [5, 11], [13, 13]]) px(g, x, y, '#a8303c')
  if (!medallion) return
  // 毯心黄铜小菱形：只画在中间一行，一格一枚
  for (const [x, y] of [[7, 6], [8, 6], [6, 7], [9, 7], [6, 8], [9, 8], [7, 9], [8, 9]]) {
    px(g, x, y, C.brass)
  }
  px(g, 7, 7, C.gold)
}

/** 地毯包边：深色 1px + 每 2px 一根的短流苏，只画在 tile 的某一行（y0 或 y15） */
function paintAisleHem(g: Ctx, y: number): void {
  r(g, 0, y, TILE, 1, '#4a0f16')
  for (let x = 1; x < TILE; x += 2) px(g, x, y, '#180409')
}

/** 地毯·中间行：纯毯面 + 一枚黄铜菱形（整条毯子唯一的一排织纹带） */
function drawAisleCarpet(g: Ctx): void {
  paintAisleFace(g, true)
}

/** 地毯·最上行：毯面 + 上包边与短流苏 */
function drawAisleCarpetTop(g: Ctx): void {
  paintAisleFace(g, false)
  paintAisleHem(g, 0)
}

/** 地毯·最下行：毯面 + 下包边与短流苏 */
function drawAisleCarpetBottom(g: Ctx): void {
  paintAisleFace(g, false)
  paintAisleHem(g, TILE - 1)
}

// ============================================================
// 峡谷石桥（bridge）：桥面板 / 横向石板接缝 / 桥缘栏杆
// ============================================================
//
// 桥要读成「一块架在空中的板」，不是「铺在地上的一条地毯」：
//   桥缘外侧必须看得见厚度 —— 侧壁的 2px 近黑只画在栏杆格的最外缘
//   （'[' / '(' 画左缘、']' / ')' 画右缘）；桥面中段 '_' / 'H' 不带侧壁，
//   否则每一格都有一道竖边，桥面会读成一条条木板。
// 栏杆也不是「走廊的墙」：只有一道 3px 的扶手条 + 柱头 + 投在桥面上的 1px 影；
// 每 5 格换成 '(' / ')' 的断口（平台的石沿也用这两个字符），
// 这样两侧是「能扶的栏杆」，断口处人还能凑到桥边上。
const DK = {
  face: '#333a45',    // 桥面板面
  faceHi: '#47515f',  // 受光
  faceLo: '#232830',  // 背光
  seam: '#13171d',    // 板缝 / 凿痕
  edge: '#525e6e',    // 桥缘顶棱（最亮的一条边）
  edgeLo: '#343c48',  // 桥缘石面
  side: '#04060a',    // 桥体外轮廓（和背景切开）
  sideHi: '#1c2430',  // 桥体侧面：真的受一点月光，厚度才看得见
  rail: '#48535f',    // 扶手
  railHi: '#7b8899',  // 扶手受光顶边
  railLo: '#252c35',  // 扶手背光
  post: '#6b7889',    // 柱头顶面
  shade: '#171c23',   // 栏杆投在桥面上的影
}

/**
 * 画一条横向的桥面板（从 x0 起、宽 w）。
 * 桥面格与栏杆格共用它 —— 两格拼接时板纹在同一条 y 上，接缝不歪。
 */
function paintDeck(g: Ctx, x0: number, w: number): void {
  r(g, x0, 0, w, TILE, DK.face)
  // 石面：不画任何贯穿的横线 —— 每格一条会连成「一条条木条」。
  // 只有两笔凿痕与一点反光，大块面才读作石板。
  const marks: [number, number, number][] = [
    [2, 5, 4], [9, 11, 3],
  ]
  for (const [mx, my, mw] of marks) {
    if (mx + mw > w) continue
    r(g, x0 + mx, my, mw, 1, DK.seam)
    r(g, x0 + mx, my + 1, mw, 1, '#3b4450')
  }
  // 湿石板上的一点冷反光
  px(g, x0 + Math.min(w - 1, 6), 8, DK.faceHi)
  px(g, x0 + Math.min(w - 1, 13), 3, DK.faceLo)
}

/** 桥面中段：一整块板，没有侧壁、没有栏杆，只有石面 */
function drawBridgeDeck(g: Ctx): void {
  paintDeck(g, 0, TILE)
}

/** 桥面接缝：横贯的 2px 深缝 + 缝上受光边 + 缝下的影；可走 */
function drawBridgeSeam(g: Ctx): void {
  paintDeck(g, 0, TILE)
  r(g, 0, 6, TILE, 1, DK.faceHi)   // 石板断面的受光边
  r(g, 0, 7, TILE, 2, DK.seam)     // 2px 深缝
  r(g, 0, 9, TILE, 1, '#232930')   // 缝下的影
  // 缝里积的一点冷光：夜里的水汽，不是苔
  px(g, 3, 7, '#2f3a49')
  px(g, 7, 8, '#26303c')
  px(g, 11, 8, '#2f3a49')
}

/**
 * 桥缘：外侧 2px 是桥体的厚度（侧壁），内侧是桥缘石 → 扶手 → 影 → 桥面。
 * gap = true 时没有扶手，只留桥缘石和一个矮的断柱础（栏杆在此断开）。
 */
function drawBridgeRail(g: Ctx, side: 'left' | 'right', gap: boolean): void {
  if (side === 'right') {
    g.save()
    g.translate(TILE, 0)
    g.scale(-1, 1)
  }
  // ---- 以下按「深渊在左、桥面在右」的左手侧画 ----
  // 桥体的厚度：外轮廓 1px 纯黑 → 侧面 1px 受月光 → 桥缘顶棱 1px 最亮。
  // 这三条竖线在暗背景上把桥「切」出来：桥是一块有厚度的板，不是贴图。
  r(g, 0, 0, 1, TILE, DK.side)
  r(g, 1, 0, 1, TILE, DK.sideHi)
  r(g, 2, 0, 1, TILE, DK.edge)
  // 桥缘石面
  r(g, 3, 0, 3, TILE, DK.edgeLo)
  if (gap) {
    // 断口：桥缘石完整，栏杆只剩一个矮柱础 —— 一眼看得出「这里断了」
    r(g, 6, 0, 3, TILE, DK.edgeLo)
    r(g, 6, 6, 3, 4, DK.railLo)
    r(g, 6, 6, 3, 1, DK.rail)
    r(g, 6, 9, 3, 1, '#10141a')
  } else {
    // 扶手：俯视下是一条 3px 窄条，外侧受光、内侧背光
    r(g, 6, 0, 1, TILE, DK.railHi)
    r(g, 7, 0, 1, TILE, DK.rail)
    r(g, 8, 0, 1, TILE, DK.railLo)
    // 柱头：每 8px 一个方头，读作「一根一根的立柱」而不是一道墙
    for (const py of [0, 8]) {
      r(g, 6, py, 3, 3, DK.post)
      r(g, 6, py, 3, 1, DK.railHi)
      r(g, 6, py + 2, 3, 1, DK.railLo)
    }
  }
  // 栏杆投在桥面上的影：桥面与栏杆因此有前后，不是同一张纸上画的
  r(g, 9, 0, 1, TILE, DK.shade)
  // 桥面板（栏杆格内侧的那一截）
  paintDeck(g, 10, 6)
  if (side === 'right') g.restore()
}

/** 虚空：不画任何像素，让底层夜色或远景透出来；空白字符 ' ' 用 */
function drawVoid(g: Ctx): void {
  void g
}

// ============================================================
// 糖堡站 / 雾中山路 / 城堡正门：新增瓦片
// ============================================================
//
// 这三张地图原来都是"石地 + 石墙"的室内语法，站在门口看不出自己在室外。
// 这一批瓦片补的是"室外地面"：木站台、站台边缘、积水、山道碎石、铁链护栏、
// 石砌水沟、门槛条石。每一块都是可平铺的 16×16，平铺后不出现接缝。
//
// 这一批的字符都是新占的，原来的瓦片表没有用过：
//   z 站台木板  k 站台边缘  u 水洼  x 山道碎石  y 铁链护栏  s 水沟  w 门槛

/**
 * 木站台板：横向长条木板，每 4px 一块，上缘受光、板缝压暗。
 * 板缝是全程贯通的横线，所以左右拼接看不到接缝；钉头固定摆在 x1 / x14，
 * 同一行上的站台因此读作"一条一条铺出来的"，不是一大片木纹。
 */
function platformBase(g: Ctx): void {
  r(g, 0, 0, TILE, TILE, '#1f1710')
  for (let i = 0; i < 4; i++) {
    const y = i * 4
    r(g, 0, y, TILE, 3, i % 2 === 0 ? '#2b2014' : '#281d13')
    r(g, 0, y, TILE, 1, '#372818')
    r(g, 0, y + 3, TILE, 1, '#1a130c')
  }
  // 木纹：每块板上两道短横线，长度不等 —— 平铺时靠错位读出木料
  for (let i = 0; i < 4; i++) {
    const y = i * 4
    for (let k = 0; k < 2; k++) {
      const x = 2 + Math.floor(rnd(700 + i * 13 + k * 29) * 9)
      const len = 3 + Math.floor(rnd(710 + i * 7 + k * 5) * 4)
      r(g, x, y + 1 + k, len, 1, '#332416')
    }
    // 钉头（左上受光，右下压暗）
    px(g, 1, y + 1, '#4a3823')
    px(g, 14, y + 1, '#4a3823')
    px(g, 2, y + 2, '#150f0a')
    px(g, 15, y + 2, '#150f0a')
  }
  // 雨后的湿痕：几道很淡的冷色反光，压在木纹上
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(rnd(720 + i * 17) * TILE)
    const y = Math.floor(rnd(730 + i * 23) * TILE)
    px(g, x, y, 'rgba(77,86,101,0.22)')
  }
}

/** 站台边缘：靠站台一侧还是木板，中线一道石压条 + 骨白警示线，线外是坠落；阻挡 */
function drawPlatformEdge(g: Ctx): void {
  // 木板：与 'z' 同样的 4px 循环，横向拼接时板缝对得上
  r(g, 0, 0, TILE, 8, '#241a10')
  for (let i = 0; i < 2; i++) {
    const y = i * 4
    r(g, 0, y, TILE, 3, '#2b2014')
    r(g, 0, y, TILE, 1, '#372818')
    r(g, 0, y + 3, TILE, 1, '#1a130c')
  }
  // 压条：一道石沿，受光在上、背光在下
  r(g, 0, 8, TILE, 2, C.stone)
  r(g, 0, 8, TILE, 1, C.cold)
  r(g, 0, 9, TILE, 1, C.graphite)
  // 警示线：骨白，雨里断成两段，被水浸淡了
  r(g, 0, 10, 6, 1, '#a8adb8')
  r(g, 9, 10, 6, 1, '#a8adb8')
  r(g, 0, 11, TILE, 1, C.mist)
  // 线外：道砟的近边，再往下是黑的
  r(g, 0, 12, TILE, 3, C.shadow)
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rnd(740 + i * 3.7) * TILE)
    px(g, x, 12 + Math.floor(rnd(750 + i * 5.9) * 3), i % 2 === 0 ? C.graphite : C.night)
  }
  r(g, 0, 15, TILE, 1, C.night)
}

/** 水洼：木板上的浅积水，中心偏冷、边上一圈湿痕，左上留一道反光；可走 */
function drawPuddle(g: Ctx): void {
  platformBase(g)
  // 湿痕：比水洼大一圈，把木板的亮度压下去
  for (let y = 3; y < 14; y++) {
    for (let x = 0; x < TILE; x++) {
      const dx = (x - 7.5) / 8.2
      const dy = (y - 8.5) / 4.6
      if (dx * dx + dy * dy > 1) continue
      px(g, x, y, 'rgba(10,13,18,0.35)')
    }
  }
  // 水面：一个压扁的椭圆，中心比木板暗一档、偏冷
  for (let y = 4; y < 13; y++) {
    for (let x = 1; x < 15; x++) {
      const dx = (x - 7.5) / 6.6
      const dy = (y - 8.2) / 3.4
      const d = dx * dx + dy * dy
      if (d > 1) continue
      px(g, x, y, d > 0.7 ? '#131b23' : '#1a2530')
    }
  }
  // 反光：一道冷色横带 + 两点亮，左上角来光
  r(g, 4, 7, 6, 1, 'rgba(174,186,204,0.42)')
  px(g, 6, 6, 'rgba(216,221,229,0.60)')
  px(g, 9, 9, 'rgba(111,122,140,0.36)')
  // 雨点涟漪：两道很淡的弧
  px(g, 10, 6, 'rgba(216,221,229,0.20)')
  px(g, 9, 6, 'rgba(154,166,184,0.15)')
  px(g, 11, 6, 'rgba(154,166,184,0.15)')
}

/** 山道：夯土 + 碎石的林间路，两道浅车辙贯通左右；可走 */
function drawTrail(g: Ctx): void {
  r(g, 0, 0, TILE, TILE, '#282216')
  // 夯土斑块：三档土色，随机压点，平铺出不重复的地面
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(rnd(800 + i * 3.7) * TILE)
    const y = Math.floor(rnd(810 + i * 6.1) * TILE)
    const n = i % 5
    px(g, x, y, n === 0 ? '#332c1e' : n === 1 ? '#1d1810' : n === 2 ? '#2e2719' : '#211c13')
  }
  // 碎石：左上受光、右下压暗（暖灰，不用蓝灰 —— 夜里的土是褐的）
  for (let i = 0; i < 4; i++) {
    const x = 1 + Math.floor(rnd(820 + i * 5.3) * 13)
    const y = 1 + Math.floor(rnd(830 + i * 9.7) * 13)
    px(g, x, y, '#4a4030')
    px(g, x + 1, y + 1, '#16120c')
  }
  // 车辙：不做贯穿的横线 —— 整行贯通的暗线会把土路读成木地板。
  // 改成三两道断续的浅压痕，长度不一、位置错开，竖向拼接后也不成条纹。
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(rnd(840 + i * 6.7) * 12)
    const y = 3 + Math.floor(rnd(850 + i * 4.9) * 9)
    r(g, x, y, 3 + Math.floor(rnd(860 + i * 3.1) * 4), 1, 'rgba(10,11,14,0.28)')
  }
  // 路面积水：一点点冷色
  px(g, 3, 8, 'rgba(70,80,94,0.30)')
  px(g, 12, 3, 'rgba(70,80,94,0.24)')
}

/** 铁链护栏：路肩草地上的一根铁立柱，链子中间下垂；阻挡（下坡一侧的边） */
function drawChainFence(g: Ctx): void {
  // 草土底：与 '~' 的暗部同一套绿，栅栏才是立在草地上而不是浮空
  r(g, 0, 0, TILE, TILE, '#1b2416')
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(rnd(900 + i * 3.1) * TILE)
    const y = Math.floor(rnd(910 + i * 5.7) * TILE)
    px(g, x, y, i % 3 === 0 ? '#36452a' : i % 3 === 1 ? '#26331f' : C.moss)
  }
  // 立柱：方铁柱，左缘受光
  r(g, 1, 2, 3, 13, C.graphite)
  r(g, 1, 2, 1, 13, C.cold)
  r(g, 3, 2, 1, 13, C.shadow)
  r(g, 0, 13, 5, 2, C.shadow)
  r(g, 0, 13, 5, 1, C.graphite)
  r(g, 2, 0, 2, 2, C.cold)
  px(g, 2, 0, C.mist)
  // 链条：从柱头往右垂，下一格再由下一根柱子接住
  for (let x = 4; x < TILE; x++) {
    const t = (x - 4) / (TILE - 4)
    const y = 4 + Math.round(Math.sin(t * Math.PI) * 3.4)
    px(g, x, y, C.mist)
    px(g, x, y + 1, C.graphite)
    if (x % 2 === 0) px(g, x, y - 1, C.cold)
  }
}

/** 石砌水沟：上沿条石、中间积水、下沿条石；可跨过去 */
function drawDitch(g: Ctx): void {
  r(g, 0, 0, TILE, TILE, C.graphite)
  // 上沿 / 下沿：两排条石，受光在上
  r(g, 0, 0, TILE, 2, C.stone)
  r(g, 0, 0, TILE, 1, C.cold)
  r(g, 0, 14, TILE, 2, C.stone)
  r(g, 0, 15, TILE, 1, C.graphite)
  // 沟内：暗水，两道反光，两端压暗
  r(g, 0, 2, TILE, 12, '#121a22')
  r(g, 0, 6, TILE, 1, 'rgba(154,166,184,0.26)')
  r(g, 0, 10, TILE, 1, 'rgba(77,86,101,0.32)')
  r(g, 0, 2, TILE, 1, 'rgba(11,13,16,0.55)')
  r(g, 0, 13, TILE, 1, 'rgba(11,13,16,0.55)')
  // 沟底的石子
  for (let i = 0; i < 4; i++) {
    px(g, Math.floor(rnd(950 + i * 7.3) * TILE), 3 + Math.floor(rnd(960 + i * 4.1) * 10), C.graphite)
  }
}

/** 门槛条石：门洞下被踩陷的一整块条石，上面有几道刻痕（记号，不是字）；可走 */
function drawThreshold(g: Ctx): void {
  r(g, 0, 0, TILE, TILE, C.stone)
  // 受光面：上缘与左缘
  r(g, 0, 0, TILE, 1, C.cold)
  r(g, 0, 0, 1, TILE, C.cold)
  r(g, 0, TILE - 1, TILE, 1, C.graphite)
  r(g, TILE - 1, 0, 1, TILE, C.graphite)
  // 被踩出的凹：中间一条比周围暗一档的长带
  r(g, 0, 5, TILE, 6, '#2d333c')
  r(g, 0, 5, TILE, 1, 'rgba(11,13,16,0.45)')
  r(g, 0, 10, TILE, 1, 'rgba(11,13,16,0.45)')
  // 刻痕：五道竖线，间距不匀（人手刻的），深浅不一
  const marks = [2, 5, 7, 10, 13]
  for (let i = 0; i < marks.length; i++) {
    const x = marks[i]
    const h = 3 + (i % 2)
    r(g, x, 6 - Math.floor(h / 2) + 2, 1, h, C.graphite)
    px(g, x, 6 - Math.floor(h / 2) + 1, C.shadow)
  }
  // 磨损点
  px(g, 4, 3, C.cold)
  px(g, 11, 12, C.graphite)
}

// ============================================================
// 聚斯霍芬堡内部：地面分区 / 墙脚 / 光与脏
// ============================================================
//
// 城堡内部原来只有一种地面（'.' 石地）铺满整间房、一种墙（'#' 石墙）围住四面：
// 玩家走进去读不出自己在哪，也看不出光从哪儿来 —— 因为地板亮度是均匀的。
//
// 这一批补的是室内语汇，分两件事：
//
//   一、分区。中间走道被踩了几十年，磨得发亮（'%'）；靠墙与角落
//       没人擦，积灰（'$'）；石板上该有裂缝（'"'）；地毯会旧（';'）。
//
//   二、光。副本里没有动态光，冷暖只能画进瓦片：
//       灯 / 炉正下方最暖（'!'），往外一圈弱下去（'&'）；
//       窗正下方最冷（':'），往外一圈弱下去（'<'）。
//       把这两组铺在灯与窗的周围，玩家一眼就能读出「光从哪儿来」。
//
// 墙脚另有一行：深木护墙板 + 黄铜踢脚线（'|'，阻挡），它把「墙」从一条
// 16px 的石带变成墙 + 墙脚两段，墙面才有高度感。

/**
 * 磨光石板：走廊正中那条被踩亮的道。
 * 与 '.' 用同一套 11px 错缝石板 —— 换一套网格会在同一个房间里露出两种铺法，
 * 一眼就假。差别只在亮度与表面：这里的板面亮一档、缝更细、板上有磨出来的擦痕。
 * 不画方砖格，也不画每格一处的亮斑：平铺后那些东西会连成一张机械的网格。
 */
function drawPolishedFloor(g: Ctx): void {
  // 板面：比 '.' 的石墨色亮两档（暗角压下来之后仍然读得出这条道）
  r(g, 0, 0, TILE, TILE, '#3a4452')
  // 错缝：与 '.' 同位置的板缝（x10..11 / y10..11）
  r(g, 10, 0, 1, TILE, '#1a1f27')
  r(g, 11, 0, 2, TILE, '#39424f')
  r(g, 0, 10, TILE, 1, '#1a1f27')
  r(g, 0, 11, TILE, 1, '#141820')
  r(g, 0, 12, TILE, 1, '#454f5e')
  // 板面的磨光：两三道很淡的横向擦痕，断续、不跨板缝
  r(g, 2, 3, 5, 1, 'rgba(77,86,101,0.34)')
  r(g, 4, 7, 3, 1, 'rgba(77,86,101,0.20)')
  px(g, 8, 5, '#46515f')
  // 板面上的几粒磨秃的黑点（与 '.' 的石点不同：这里是被鞋底磨出来的）
  px(g, 3, 6, '#232a33')
  px(g, 7, 2, '#28303a')
  px(g, 5, 9, '#232a33')
  // 板缝里的一点反光
  px(g, 10, 4, '#3d4653')
  px(g, 10, 8, '#333c48')
}

/**
 * 积灰石板：靠墙那一圈与四个角，没人擦。
 * 与 '.' 同一套 11px 错缝（换一套网格会在同一个房间里露出两种铺法），
 * 只是整块压暗一档、板面上浮着一层灰。角落里灰积得更厚，还挂一缕蛛丝。
 */
function drawDustFloor(g: Ctx): void {
  r(g, 0, 0, TILE, TILE, '#15191f')
  // 错缝：与 '.' / '%' 同位置
  r(g, 10, 0, 1, TILE, '#0b0e12')
  r(g, 11, 0, 2, TILE, '#1b2027')
  r(g, 0, 10, TILE, 1, '#0e1116')
  r(g, 0, 11, TILE, 1, '#0b0d11')
  r(g, 0, 12, TILE, 1, '#262c35')
  // 灰：细灰点，密度比 '.' 的石点高一倍，压得也浅
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(rnd(1201 + i * 3.7) * TILE)
    const y = Math.floor(rnd(1211 + i * 6.1) * TILE)
    const n = i % 5
    px(g, x, y, n === 0 ? '#39424f' : n === 1 ? '#2b3139' : n === 2 ? '#10141a' : '#232830')
  }
  // 墙脚那一侧积得更厚：靠上缘的一带压暗
  r(g, 0, 0, TILE, 2, 'rgba(11,13,16,0.28)')
  r(g, 0, 13, TILE, 1, 'rgba(11,13,16,0.22)')
  // 积灰里的一簇细尘与两粒碎石
  r(g, 3, 8, 4, 1, 'rgba(111,122,140,0.20)')
  px(g, 12, 5, 'rgba(111,122,140,0.24)')
  px(g, 6, 4, '#39424f')
  // 蛛丝：从右上角斜下来的一根
  px(g, 14, 0, 'rgba(216,221,229,0.20)')
  px(g, 14, 1, 'rgba(216,221,229,0.14)')
  px(g, 13, 2, 'rgba(216,221,229,0.10)')
}

/**
 * 火光石地（强）：烛台 / 壁灯 / 壁炉正下方那一格。
 * 底子是走道那块亮石板 —— 被火照亮的仍然是一块石板，不是一块木头。
 * 暖色只是叠上去的一层光：橙色从上方压下来，再撒几粒金。
 */
function drawFirelitFloor(g: Ctx): void {
  // 底：被火照亮的一块暖灰石板（比 '%' 亮一档，色温往暖里偏 —— 不是褐色地板）
  r(g, 0, 0, TILE, TILE, '#4a4238')
  // 错缝：与 '.' / '%' 同位置
  r(g, 10, 0, 1, TILE, '#241d16')
  r(g, 11, 0, 2, TILE, '#544a3c')
  r(g, 0, 10, TILE, 1, '#241d16')
  r(g, 0, 11, TILE, 1, '#1b150f')
  r(g, 0, 12, TILE, 1, '#5e5240')
  // 暖光：从上方落下来，越往下越淡
  for (let y = 0; y < TILE; y++) {
    const a = 0.30 * (1 - y / TILE)
    if (a > 0.01) r(g, 0, y, TILE, 1, `rgba(224,90,58,${a.toFixed(3)})`)
  }
  // 火光的碎斑：几粒橙与金，落在石面上
  for (let i = 0; i < 7; i++) {
    const x = 2 + Math.floor(rnd(1231 + i * 4.3) * 12)
    const y = 2 + Math.floor(rnd(1241 + i * 5.9) * 9)
    px(g, x, y, i % 2 === 0 ? 'rgba(224,90,58,0.45)' : 'rgba(255,214,140,0.40)')
  }
  // 磨痕：暖面上留一道不暖的地方，才不是一块橙色贴图
  r(g, 3, 5, 6, 1, 'rgba(28,22,16,0.22)')
  px(g, 13, 13, 'rgba(111,122,140,0.14)')
}

/**
 * 火光石地（弱）：暖光晕的外圈。
 * 底子比 '%' 暗一阶、暖色只剩三分之一 —— 灯 → 强 → 弱 → 普通，
 * 这样光才有"照到哪儿为止"的边，而不是一块褐色的方形补丁。
 */
function drawFirelitFloorSoft(g: Ctx): void {
  r(g, 0, 0, TILE, TILE, '#2b3440')
  r(g, 10, 0, 1, TILE, '#171c23')
  r(g, 11, 0, 2, TILE, '#2e3a48')
  r(g, 0, 10, TILE, 1, '#171c23')
  r(g, 0, 11, TILE, 1, '#121820')
  r(g, 0, 12, TILE, 1, '#39424f')
  // 暖光只压一半深度、强度三分之一
  for (let y = 0; y < 12; y++) {
    const a = 0.14 * (1 - y / 12)
    if (a > 0.006) r(g, 0, y, TILE, 1, `rgba(224,90,58,${a.toFixed(3)})`)
  }
  px(g, 5, 4, 'rgba(200,160,64,0.20)')
  px(g, 10, 7, 'rgba(224,90,58,0.22)')
  r(g, 4, 12, 7, 1, 'rgba(20,16,12,0.18)')
}

/**
 * 潮湿 / 月光石地（强）：窗正下方那一条冷光。
 * 底子比 '.' 亮一档、偏蓝 —— 月光落在石板上是把它照亮，不是把它染黑；
 * 水光从上方斜落，积水的圈里有一线月白。
 */
function drawDampFloor(g: Ctx): void {
  r(g, 0, 0, TILE, TILE, '#2c3644')
  // 石板缝：与 '.' 同节奏，缝更冷
  r(g, 10, 0, 1, TILE, '#141b24')
  r(g, 11, 0, 2, TILE, '#3b4a5c')
  r(g, 0, 10, TILE, 1, '#141b24')
  r(g, 0, 11, TILE, 1, '#0f151c')
  r(g, 0, 12, TILE, 1, '#4a5c70')
  // 月光：从窗口（上方）落下来，越往上越亮
  for (let y = 0; y < TILE; y++) {
    const a = 0.26 * (1 - y / (TILE * 0.92))
    if (a > 0.01) r(g, 0, y, TILE, 1, `rgba(154,166,184,${a.toFixed(3)})`)
  }
  // 积水：两圈压扁的冷色反光
  const pools: [number, number, number, number][] = [[8, 8, 5.2, 2.2], [4, 12.5, 2.6, 1.4]]
  for (const [cx, cy, rx, ry] of pools) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (x < 0 || x >= TILE || y < 0 || y >= TILE) continue
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        const d = dx * dx + dy * dy
        if (d > 1) continue
        px(g, x, y, d > 0.62 ? 'rgba(16,22,29,0.55)' : 'rgba(43,58,74,0.55)')
      }
    }
  }
  // 水面的一线月光
  r(g, 5, 7, 5, 1, 'rgba(216,221,229,0.30)')
  px(g, 9, 8, 'rgba(154,166,184,0.22)')
  // 潮气
  px(g, 3, 3, 'rgba(154,166,184,0.16)')
  px(g, 13, 5, 'rgba(154,166,184,0.12)')
}

/**
 * 潮湿 / 月光石地（弱）：月光带的外圈。
 * 底子只比 '.' 亮一点点，冷色很淡 —— 窗下那条光因此有一道边。
 */
function drawDampFloorSoft(g: Ctx): void {
  r(g, 0, 0, TILE, TILE, '#212831')
  r(g, 10, 0, 1, TILE, '#151c24')
  r(g, 11, 0, 2, TILE, '#2b3846')
  r(g, 0, 10, TILE, 1, '#151c24')
  r(g, 0, 11, TILE, 1, '#111820')
  r(g, 0, 12, TILE, 1, '#333f4e')
  for (let y = 0; y < 9; y++) {
    const a = 0.14 * (1 - y / 9)
    if (a > 0.006) r(g, 0, y, TILE, 1, `rgba(154,166,184,${a.toFixed(3)})`)
  }
  px(g, 4, 6, 'rgba(154,166,184,0.26)')
  px(g, 9, 4, 'rgba(154,166,184,0.18)')
  px(g, 12, 11, 'rgba(111,122,140,0.16)')
}

/**
 * 旧地毯：铺了几十年、褪成砖红、边先脏的一条。
 * 只压上下两条边、不压左右 —— 横着连成长条时它才是"一条毯子"，
 * 而不是一格一格的红砖。破洞不用画在这里：磨损靠 ';' 与 ',' 的混铺与 '"' 表达，
 * 每格一个破洞平铺出来只会变成一排砖缝。
 */
function drawWornCarpet(g: Ctx): void {
  r(g, 0, 0, TILE, TILE, '#5c2626')
  // 织纹：4px 一针、隔行错位（与 ',' 同一套针脚，只是线色旧了）
  for (let y = 3; y < TILE - 1; y += 4) {
    const x0 = y % 8 === 3 ? 2 : 0
    for (let x = x0; x < TILE; x += 4) px(g, x, y, '#4a1e1e')
  }
  // 褪色的斑：几处绒面比周围浅或暗一点，不是破洞
  const fade: [number, number, string][] = [
    [2, 6, '#6b2f2f'], [9, 4, '#452020'], [12, 10, '#6b2f2f'], [5, 11, '#4e2323'],
  ]
  for (const [x, y, c] of fade) r(g, x, y, 2, 1, c)
  // 残存的金线：两针，别的都磨没了
  px(g, 5, 5, C.brass)
  px(g, 10, 9, '#5f5430')
  // 上下两条边：毯子铺久了，先脏的总是边
  r(g, 0, 0, TILE, 1, '#3f1a1a')
  r(g, 0, TILE - 1, TILE, 1, '#3f1a1a')
  // 起出来的线头
  px(g, 13, 15, '#8a4038')
  px(g, 4, 15, '#6a2c2c')
  px(g, 11, 1, '#6a2c2c')
}

/**
 * 裂开的石板：一道从左上贯穿到右下的裂缝，两侧剥落。
 * 底子与 '.' 同一块石板，所以裂缝周围的砖还在，只是碎了一道。
 */
function drawCrackedFloor(g: Ctx): void {
  paintRows(g, T_FLOOR_STONE)
  // 主缝：折两次的锯齿（真裂开的石头不会是一条直线）
  const crack: [number, number][] = [
    [1, 0], [2, 1], [2, 2], [3, 3], [4, 3], [4, 4], [5, 5], [6, 6], [6, 7],
    [7, 8], [8, 8], [8, 9], [9, 10], [10, 11], [10, 12], [11, 13], [12, 14], [13, 15],
  ]
  for (const [x, y] of crack) {
    px(g, x, y, '#0b0d10')
    px(g, Math.min(TILE - 1, x + 1), y, '#3d4653')
  }
  // 一道分叉：裂到一半往左下岔出去
  for (const [x, y] of [[5, 5], [4, 6], [3, 6], [2, 7], [1, 8]] as [number, number][]) {
    px(g, x, y, '#0b0d10')
  }
  // 剥落：缝边各掉了一小块，剥下来的粉堆在缝旁
  r(g, 9, 4, 2, 1, '#15181d')
  r(g, 2, 10, 1, 2, '#15181d')
  px(g, 3, 11, '#2a3038')
  px(g, 10, 5, '#2a3038')
  // 缝里反的一点光
  px(g, 6, 6, '#6f7a8c')
}

/**
 * 护墙板：贴地那一行墙 —— 石墙下缘 + 深木墙脚 + 黄铜踢脚线。
 * 它把「墙」从一条 16px 的石带变成两段：上面是石头，下面是被擦亮的木头。
 * 阻挡：这一行是墙脚，人走到墙根就停在这儿。
 */
function drawWainscot(g: Ctx): void {
  // 上段：石墙的下半截（背着光，比 '#' 的墙面暗一档）
  r(g, 0, 0, TILE, 5, C.graphite)
  r(g, 0, 0, TILE, 1, C.stone)
  // 石墙与木墙脚之间的黄铜压条
  r(g, 0, 5, TILE, 1, C.brass)
  px(g, 1, 5, C.gold)
  px(g, 9, 5, C.gold)
  r(g, 0, 6, TILE, 1, '#241a10')
  // 木墙脚：4px 一块的竖板
  for (let x = 0; x < TILE; x += 4) {
    r(g, x, 7, 1, 5, '#5c4630')
    r(g, x + 1, 7, 2, 5, '#3f2f1c')
    r(g, x + 3, 7, 1, 5, '#241a10')
  }
  // 板上一道浅浮雕横线，离地一掌高
  r(g, 0, 11, TILE, 1, '#5c4630')
  r(g, 0, 12, TILE, 1, C.brass)
  r(g, 0, 13, TILE, 1, '#5f5430')
  // 地面上的一道影：墙脚永远比屋子中间暗
  r(g, 0, 14, TILE, 2, '#12161c')
}

/**
 * 壁龛：石墙上的拱形凹龛。
 * 龛口是黑的，左侧内壁受光、右侧背光；龛里有一块石托，托上落着灰。
 * 阻挡：龛是墙的一部分，人进不去。
 */
function drawNiche(g: Ctx): void {
  // 底：与 '#' 同一套砌块，龛只是在这面墙上凹进去
  paintRows(g, T_WALL_STONE)
  // 龛口的石檐：先压一道受光的拱石，再往下掏空
  r(g, 3, 2, 10, 1, C.cold)
  r(g, 4, 3, 8, 1, C.stone)
  // 龛内：拱顶三级收进，下面是黑
  r(g, 6, 4, 4, 1, C.shadow)
  r(g, 5, 5, 6, 1, C.shadow)
  r(g, 4, 6, 8, 1, C.night)
  r(g, 4, 7, 8, 7, C.night)
  // 龛的内壁：左上受光的一道窄边
  r(g, 4, 6, 1, 8, C.graphite)
  r(g, 4, 6, 8, 1, C.graphite)
  // 龛口外沿：左缘受光、右缘背光
  r(g, 3, 3, 1, 11, C.pale)
  r(g, 12, 3, 1, 11, C.shadow)
  // 龛里的石托：一块挑出来的石板，上面落着灰
  r(g, 3, 13, 10, 1, C.stone)
  r(g, 3, 13, 10, 1, 'rgba(216,221,229,0.10)')
  r(g, 4, 12, 8, 1, '#22282f')
  for (let i = 0; i < 4; i++) px(g, 5 + i * 2, 12, 'rgba(111,122,140,0.35)')
  // 托上加一点暖：这里点过蜡烛
  px(g, 7, 12, 'rgba(224,90,58,0.28)')
  px(g, 8, 11, 'rgba(200,160,64,0.20)')
  // 蛛丝：挂在龛口左上
  px(g, 3, 4, 'rgba(216,221,229,0.20)')
  px(g, 3, 5, 'rgba(216,221,229,0.14)')
  px(g, 4, 7, 'rgba(216,221,229,0.10)')
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
  'J': make(g => drawCoachSeatSingle(g, false)), // 单人座椅·上排：靠背朝上（车壁），坐垫朝过道（阻挡）
  'j': make(g => drawCoachSeatSingle(g, true)),  // 单人座椅·下排：镜像，靠背朝下，与上排同一 x 的椅子相对（阻挡）
  'K': make(drawCoachTable),     // 车厢小桌：12×7 暖白桌面 + 白桌布 + 碟与杯（阻挡）
  'C': make(drawAisleCarpet),    // 厢座地毯·中间行：暗红绒面 + 一枚黄铜菱形（可走）
  'c': make(drawAisleCarpetTop), // 厢座地毯·最上行：毯面 + 上包边与短流苏（可走）
  'd': make(drawAisleCarpetBottom), // 厢座地毯·最下行：毯面 + 下包边与短流苏（可走）
  // ---- 峡谷石桥 ----
  '_': make(drawBridgeDeck),     // 桥面中段：一整块石板，无侧壁（可走）
  'H': make(drawBridgeSeam),     // 桥面接缝：横贯的 2px 深缝，每 5 格一道（可走）
  '[': make(g => drawBridgeRail(g, 'left', false)),  // 左桥缘 + 栏杆：外侧 2px 是桥体厚度（阻挡）
  ']': make(g => drawBridgeRail(g, 'right', false)), // 右桥缘 + 栏杆（阻挡）
  '(': make(g => drawBridgeRail(g, 'left', true)),   // 左桥缘·栏杆断口 / 平台石沿（阻挡）
  ')': make(g => drawBridgeRail(g, 'right', true)),  // 右桥缘·栏杆断口 / 平台石沿（阻挡）
  // ---- 糖堡站 / 山路 / 正门：室外地面 ----
  'z': make(platformBase),       // 木站台板：横向长板、钉头、雨后湿痕（可走）
  'k': make(drawPlatformEdge),   // 站台边缘：石压条 + 骨白警示线，线外是坠落（阻挡）
  'u': make(drawPuddle),         // 水洼：木板上的积水，反一道冷光（可走，灯会在上面叠暖光）
  'x': make(drawTrail),          // 山道：夯土与碎石，两道浅车辙（可走）
  'y': make(drawChainFence),     // 铁链护栏：路肩的立柱与下垂的链子（阻挡）
  's': make(drawDitch),          // 石砌水沟：上沿条石、中间积水（可跨过去）
  'w': make(drawThreshold),      // 门槛条石：被踩陷的凹与五道刻痕（可走）
  // ---- 聚斯霍芬堡内部：地面分区 / 墙脚 / 光与脏 ----
  '%': make(drawPolishedFloor),  // 磨光石板：走道正中踩亮的方砖（可走）
  '$': make(drawDustFloor),      // 积灰石板：靠墙与角落没人擦的地方（可走）
  '!': make(drawFirelitFloor),   // 火光石地·强：烛台 / 壁炉 / 壁灯正下方（可走）
  '&': make(drawFirelitFloorSoft), // 火光石地·弱：暖光晕的外圈（可走）
  ':': make(drawDampFloor),      // 潮冷石地·强：窗下方那一条月光（可走）
  '<': make(drawDampFloorSoft),  // 潮冷石地·弱：月光带的外圈（可走）
  ';': make(drawWornCarpet),     // 旧地毯：褪色磨破的一块毯子（可走）
  '"': make(drawCrackedFloor),   // 裂开的石板：一道贯穿的裂缝（可走）
  '|': make(drawWainscot),       // 护墙板：石墙下缘 + 深木墙脚 + 黄铜踢脚线（阻挡）
  'O': make(drawNiche),          // 壁龛：石墙上的拱形凹龛，托上落着灰（阻挡）
  ' ': make(drawVoid),           // 虚空：透明，露出底层夜色 / 远景
}

/** 阻挡通行的瓦片（'r' 铁轨与 'q' 雾可走；车窗 'W'/'N'、座椅 'U'/'J'/'j'、小桌 'K'、虚空 ' ' 阻挡；
 *  'k' 站台边缘与 'y' 铁链护栏是外侧的边；'u' 水洼 / 'x' 山道 / 's' 水沟 / 'w' 门槛可走；
 *  室内这批里 '|' 护墙板与 'O' 壁龛是墙的一部分，其余（地面 / 地毯 / 光带）都可走） */
export const SOLID_TILES = new Set(['#', 'W', 'L', 'E', 'f', 'b', 'p', 'B', '^', '=', 'o', '+', 'T', 'v', 'h', 'n', 'N', 'U', 'J', 'j', 'K', ' ', '[', ']', '(', ')', 'k', 'y', '|', 'O'])

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
  // 注意：'C' 与 'K' 在 struct 层已被 cavity / fake 占用（地窖、池塘的图纸要它），
  // tiles 层与 struct 层是两套字符表，同名键不能有两个含义，故此处只新增 'J'。
  C: { color: '#5a7a6a', kind: 'cavity' },
  I: { color: '#b04040', kind: 'inkblot' },
  X: { color: '#e8e0d0', kind: 'torn' },
  J: { color: '#8c1f28', kind: 'seat' },
}

export { GEM, make }


