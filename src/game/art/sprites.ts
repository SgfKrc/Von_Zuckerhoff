// ============================================================
// 精灵：角色（16×24）、家具与道具、48×48 方形立绘（头 + 肩）。
// 全部用 fillRect 逐像素程序化绘制，零外部素材。
// 光源统一在左上；每块至少 暗 / 中 / 亮 三档。
// ============================================================
import { C } from './tiles'
import type { Dir } from '../types'

type Ctx = CanvasRenderingContext2D
type Sprite = HTMLCanvasElement

function canvas(w: number, h: number): { c: Sprite; g: Ctx } {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  return { c, g }
}

function r(g: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  g.fillStyle = col
  g.fillRect(x, y, w, h)
}

function px(g: Ctx, x: number, y: number, col: string): void {
  g.fillStyle = col
  g.fillRect(x, y, 1, 1)
}

/** 确定性伪随机（家具纹理用，避免每次刷新都不一样） */
function rnd(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

// ============================================================
// 主角专属配色（对照参考图取的色，都在调色板味道之内）
// ============================================================

/** 银饰三阶：弗里德里希的立领边、肩章、V 形胸饰 */
export const SILVER = { hi: '#e4eaf2', mid: '#aeb9c8', lo: '#6b7686' } as const

/** 绿领结三阶（艾玛） */
export const BOW_G = { hi: '#bade72', mid: '#5f9c3a', lo: '#36601e' } as const

/** 银紫发三阶（艾玛）：不是纯白，是偏紫的冷银 */
export const LILAC = { hi: '#efe8fa', mid: '#b4a6d6', lo: '#7f71a6' } as const

/**
 * 蓝紫单色阶（彩蛋角色）：不是纯蓝，是偏紫的冷蓝。
 * 全作都是暖褐石色，只有她一个人用这一族颜色 —— 这是「她不属于这里」的唯一提示。
 */
export const DEEPBLUE = { hi: '#a8b6f0', mid: '#6b7fd4', lo: '#3d4a86' } as const

/** 她的蕾丝（帽子与围裙）：比糖白更冷一档，和暖调的白放一起能看出偏蓝 */
export const LACE = { hi: '#ffffff', mid: '#eef0fa', lo: '#c9d2ee' } as const

// ============================================================
// 人类角色基型
// ============================================================

interface CharColors {
  hair: string
  hairHi: string
  hairDark: string
  skin: string
  skinShade: string
  skinHi: string
  coat: string
  coatHi: string
  coatDark: string
  pants: string
  shoe: string
  eye: string
  /** 发式：短发 / 盘发 / 后梳 / 头巾 */
  hairStyle: 'short' | 'bun' | 'slick' | 'kerchief'
  /** 领口、扣子 */
  accent?: string
  /** 白围裙与翻领（艾玛、玛尔塔） */
  apron?: string
  /** 银灰领结（赫尔曼） */
  bow?: string
  /** 头巾（玛尔塔） */
  kerchief?: string
  /** 高 2 像素：22×24 画布，脚底仍对齐 */
  tall?: boolean
  /** 制服一丝褶皱都没有（艾玛） */
  flat?: boolean
  /** 体型壮实（玛尔塔） */
  stout?: boolean
  /**
   * 剪影专门画法：英雄（窄肩长身 + 蓬松红发）/ 女仆（方领 + 围裙 + 盘发）。
   * 彩蛋角色的行走图改用 RPG Maker 素材（public/portraits/ds-walk.png），
   * 不再有程序化的剪影画法。
   */
  silhouette?: 'hero' | 'maid'
  /** 裤/靴的第四档：暗裤上的受光纵向高光 */
  pantsHi?: string
  /** 虹膜高光（行走图里那一个像素的亮心） */
  eyeHi?: string
  /** 虹膜下半 / 上眼睑线的深色（与立绘的 eyeDark 同一档） */
  eyeDark?: string
  /** 高领里露出的银灰领口 */
  collar?: string
  /** 唇色（行走图上只有一两个像素） */
  lip?: string
}

/**
 * 弗里德里希：明亮的深红发（不是橙红）、深蓝细长眼、暖调苍白有血色的皮肤。
 * 剪影：蓬松的头发比肩宽（10 vs 6），窄肩长身，深黑高领制服；
 * 胸前一条 V 形银饰（从双肩斜下汇到胸口）+ 银灰立领边 —— 一眼可辨的标志。
 */
const HERO: CharColors = {
  hair: '#b4231d', hairHi: '#e35138', hairDark: '#6f1211',
  skin: '#dcb49a', skinShade: '#b08a72', skinHi: '#f0d0b8',
  coat: '#171a20', coatHi: '#2c333f', coatDark: '#0a0c10',
  pants: '#22272f', shoe: '#30363f', eye: '#3f6db5', eyeHi: '#bcd8f8',
  eyeDark: '#26467a',
  hairStyle: 'short', accent: SILVER.mid, collar: SILVER.mid,
  pantsHi: '#343b46', silhouette: 'hero', lip: '#a8615a',
}

/**
 * 艾玛：银紫（不是纯白）中长微卷发、紫蓝眼、眼下略暗。
 * 剪影：头顶白色蕾丝女仆帽 + 两侧垂到肩的鬓发 + 白色荷叶边围裙 + 绿领结。
 * 皮肤比常人白但仍是活人的暖白，且均匀无色差 —— 她是「被造出来的」。
 */
const EMMA: CharColors = {
  hair: LILAC.mid, hairHi: LILAC.hi, hairDark: LILAC.lo,
  skin: '#e8cfc0', skinShade: '#bda093', skinHi: '#f6e2d4',
  coat: '#2a2340', coatHi: '#3d3459', coatDark: '#171226',
  pants: '#2a2340', shoe: '#1d1830', eye: '#6a5cc0', eyeHi: '#e0d8ff',
  eyeDark: '#3e3274',
  hairStyle: 'bun', apron: C.sugar, collar: C.bone,
  accent: BOW_G.mid, flat: true, silhouette: 'maid', pantsHi: '#332b4a',
  lip: '#b08080',
}

/** 赫尔曼：黑燕尾服、银灰领结、极苍白；比别人高 2 像素 */
const HERMANN: CharColors = {
  hair: '#c0c6d0', hairHi: '#dde2e8', hairDark: '#8a909c',
  skin: '#e6eaf0', skinShade: '#b6bfcc', skinHi: C.sugar,
  coat: '#12151a', coatHi: C.graphite, coatDark: C.night,
  pants: '#0e1014', shoe: C.night, eye: C.pale,
  hairStyle: 'slick', bow: C.pale, tall: true,
}

/** 玛尔塔：围裙、壮实、棕发头巾 */
const MARTA: CharColors = {
  hair: '#6b4a2f', hairHi: '#8a6440', hairDark: '#4a3320',
  skin: '#e0c0a0', skinShade: '#b89878', skinHi: '#f0d8c0',
  coat: '#5c4630', coatHi: '#77603f', coatDark: '#3f2f1c',
  pants: '#3f2f1c', shoe: C.night, eye: '#4a3520',
  hairStyle: 'kerchief', apron: C.sugar, kerchief: C.bone, stout: true,
}

/** 角色帧总入口：主角 / 女仆走专用剪影画法，其余角色走通用画法 */
function drawChar(cc: CharColors, dir: Dir, frame: number): Sprite {
  if (cc.silhouette === 'hero') return drawHero(cc, dir, frame)
  if (cc.silhouette === 'maid') return drawMaid(cc, dir, frame)
  return drawPlain(cc, dir, frame)
}

/**
 * 通用角色帧（赫尔曼 / 玛尔塔）。
 * 坐标约定：脚底 y22，影子 y23；tall 角色头顶到 y0，普通人头顶 y2。
 * 头部只让头发占头顶两行，整张脸露出来；四方向差别靠眼睛数量与鼻子朝向。
 */
function drawPlain(cc: CharColors, dir: Dir, frame: number): Sprite {
  const wide = cc.tall ? 22 : 16
  const { c, g } = canvas(wide, 24)
  const mid = Math.round(wide / 2)
  const bx = mid - 4                    // 躯干左边界（宽 8，壮实 9）
  const bwd = cc.stout ? 9 : 8
  const t = cc.tall ? 2 : 0
  const hairTop = 2 - t                 // 发顶
  const faceTop = 4 - t                 // 脸顶
  const bodyTop = 11 - t                // 躯干顶
  const legY = 18
  const bob = frame === 1 ? -1 : 0
  const mirror = dir === 'right'
  /** 形体镜像（朝右时把形体翻过来，颜色仍按屏幕左上光分配） */
  const mx = (x: number, w = 1): number => (mirror ? wide - x - w : x)

  // ---- 影子 ----
  r(g, mid - 5, 23, 10, 1, 'rgba(0,0,0,0.42)')
  r(g, mid - 4, 22, 8, 1, 'rgba(0,0,0,0.20)')

  // ---- 腿与鞋 ----
  const lx = bx + 1
  const rxx = bx + bwd - 3
  if (dir === 'down' || dir === 'up') {
    const legA = frame === 1 ? -1 : 0
    const legB = frame === 2 ? -1 : 0
    r(g, lx, legY + legA, 2, 4, cc.pants)
    r(g, lx, legY + 3 + legA, 2, 2, cc.shoe)
    r(g, rxx, legY + legB, 2, 4, cc.pants)
    r(g, rxx, legY + 3 + legB, 2, 2, cc.shoe)
  } else {
    // 侧面：前后两腿错开
    const front = frame === 1 ? 1 : frame === 2 ? -1 : 0
    const back = -front
    r(g, mx(bx + 2 + back, 2), legY, 2, 4, cc.pants)
    r(g, mx(bx + 2 + back, 2), legY + 3, 2, 2, cc.shoe)
    r(g, mx(bx + 5 + front, 2), legY, 2, 4, cc.pants)
    r(g, mx(bx + 5 + front, 2), legY + 3, 2, 2, cc.shoe)
  }

  // ---- 躯干 ----
  const bodyH = 17 - bodyTop + 1
  r(g, bx, bodyTop + bob, bwd, bodyH, cc.coat)
  r(g, bx, bodyTop + bob, bwd, 1, cc.coatHi)              // 肩线受光
  r(g, bx, bodyTop + bob, 1, bodyH, cc.coatHi)            // 屏幕左侧受光
  r(g, bx + bwd - 1, bodyTop + bob, 1, bodyH, cc.coatDark) // 屏幕右侧背光
  r(g, bx, 17 + bob, bwd, 1, cc.coatDark)                 // 下摆
  r(g, bx + 3, 16 + bob, 1, 1, cc.coatDark)               // 下摆分叉
  r(g, bx + 4, 16 + bob, 1, 1, cc.coatHi)
  if (!cc.flat) {
    // 衣褶：只有艾玛没有
    px(g, bx + 2, bodyTop + 3 + bob, cc.coatDark)
    px(g, bx + 5, bodyTop + 4 + bob, cc.coatHi)
  }

  // ---- 手臂 ----
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0
  if (dir === 'down' || dir === 'up') {
    r(g, bx - 1, bodyTop + 1 + bob + swing, 1, 4, cc.coat)
    px(g, bx - 1, bodyTop + 1 + bob + swing, cc.coatHi)
    r(g, bx + bwd, bodyTop + 1 + bob - swing, 1, 4, cc.coatDark)
  } else {
    r(g, mx(bx + 3, 2), bodyTop + 1 + bob + swing, 2, 4, cc.coat)
    r(g, mx(bx + 3, 1), bodyTop + 1 + bob + swing, 1, 4, cc.coatHi)
  }

  // ---- 头 ----
  r(g, bx + 3, 10 + bob, 2, 1, cc.skinShade)   // 颈

  if (dir === 'up') {
    // 后脑：圆头 + 发丝走向 + 后领
    r(g, bx, hairTop + bob, 8, 1, cc.hair)
    r(g, bx - 1, hairTop + bob + 1, 10, 6, cc.hair)
    r(g, bx, hairTop + bob + 7, 8, 1, cc.hair)
    r(g, bx + 1, hairTop + bob + 8, 6, 1, cc.hair)
    r(g, bx, hairTop + bob, 8, 1, cc.hairHi)
    r(g, bx - 1, hairTop + bob + 1, 1, 6, cc.hairHi)
    r(g, bx + 8, hairTop + bob + 1, 1, 6, cc.hairDark)
    r(g, bx + 2, hairTop + 2 + bob, 1, 4, cc.hairDark)
    r(g, bx + 5, hairTop + 2 + bob, 1, 5, cc.hairDark)
    px(g, bx + 3, hairTop + 3 + bob, cc.hairHi)
    px(g, bx + 6, hairTop + 4 + bob, cc.hairHi)
    r(g, bx + 1, hairTop + 7 + bob, 6, 1, cc.hairDark)
    r(g, bx + 1, 10 + bob, 6, 1, cc.coatHi)   // 后领
    return c
  }

  if (dir === 'down') {
    // 脸：完整 8 宽 7 高，额头露出来
    r(g, bx, faceTop + bob, 8, 7, cc.skin)
    r(g, bx, faceTop + 5 + bob, 8, 2, cc.skinShade)     // 下颌暗部
    px(g, bx, faceTop + bob, cc.skinHi)                 // 额头受光
    px(g, bx + 7, faceTop + bob + 1, cc.skinShade)
    // 头发：只盖头顶两行，两侧留 1px 鬓角
    r(g, bx, hairTop + bob, 8, 1, cc.hair)
    r(g, bx - 1, hairTop + bob + 1, 10, 1, cc.hair)
    r(g, bx, hairTop + bob, 8, 1, cc.hairHi)
    r(g, bx - 1, hairTop + bob + 1, 1, 1, cc.hairHi)
    r(g, bx + 8, hairTop + bob + 1, 1, 1, cc.hairDark)
    r(g, bx - 1, faceTop + bob, 1, 4, cc.hair)
    r(g, bx + 8, faceTop + bob, 1, 4, cc.hair)
    px(g, bx - 1, faceTop + bob, cc.hairHi)
    px(g, bx + 8, faceTop + bob, cc.hairDark)
    // 发际线：额头上一排暗点
    px(g, bx, faceTop + bob, cc.hairDark)
    px(g, bx + 2, faceTop + bob, cc.hairDark)
    px(g, bx + 4, faceTop + bob, cc.hairDark)
    px(g, bx + 6, faceTop + bob, cc.hairDark)
    // 眉
    r(g, bx + 1, faceTop + 1 + bob, 2, 1, cc.hairDark)
    r(g, bx + 5, faceTop + 1 + bob, 2, 1, cc.hairDark)
    // 眼：2px 深色 + 一点光
    r(g, bx + 1, faceTop + 2 + bob, 2, 1, cc.eye)
    r(g, bx + 5, faceTop + 2 + bob, 2, 1, cc.eye)
    px(g, bx + 2, faceTop + 2 + bob, cc.skinHi)
    px(g, bx + 6, faceTop + 2 + bob, cc.skinHi)
    // 鼻与嘴
    px(g, bx + 3, faceTop + 4 + bob, cc.skinShade)
    r(g, bx + 3, faceTop + 5 + bob, 2, 1, C.shadow)
  } else {
    // 侧面：脸 7 宽，后脑在背面，鼻子朝前突出，只露一只眼
    const faceX = mx(bx, 7)
    r(g, faceX, faceTop + bob, 7, 7, cc.skin)
    r(g, faceX, faceTop + 5 + bob, 7, 2, cc.skinShade)
    r(g, faceX, faceTop + bob, 1, 5, cc.skinHi)        // 屏幕左受光
    r(g, faceX + 6, faceTop + bob, 1, 5, cc.skinShade) // 屏幕右背光
    // 顶发
    const topX = mx(bx - 1, 10)
    r(g, topX + 1, hairTop + bob, 8, 1, cc.hair)
    r(g, topX, hairTop + bob + 1, 10, 1, cc.hair)
    r(g, topX + 1, hairTop + bob, 8, 1, cc.hairHi)
    r(g, topX, hairTop + bob + 1, 1, 1, cc.hairHi)
    r(g, topX + 9, hairTop + bob + 1, 1, 1, cc.hairDark)
    // 后脑
    const backX = mx(bx + 4, 5)
    r(g, backX, faceTop + bob, 5, 7, cc.hair)
    r(g, backX, faceTop + bob, 1, 7, cc.hairHi)
    r(g, backX + 4, faceTop + bob, 1, 7, cc.hairDark)
    px(g, backX + 2, faceTop + 2 + bob, cc.hairDark)
    px(g, backX + 2, faceTop + 4 + bob, cc.hairHi)
    // 前侧鬓角
    r(g, mx(bx - 1, 1), faceTop + bob, 1, 4, cc.hair)
    // 鼻尖（朝前的那一侧突出 1px）
    const noseX = mirror ? faceX + 7 : faceX - 1
    r(g, noseX, faceTop + 3 + bob, 1, 1, cc.skin)
    px(g, noseX, faceTop + 4 + bob, cc.skinShade)
    // 一只眼 + 眉
    const eyeX = mirror ? faceX + 3 : faceX + 2
    r(g, eyeX, faceTop + 1 + bob, 2, 1, cc.hairDark)
    r(g, eyeX, faceTop + 2 + bob, 2, 1, cc.eye)
    px(g, eyeX + (mirror ? 1 : 0), faceTop + 2 + bob, cc.skinHi)
    // 嘴
    r(g, faceX + (mirror ? 2 : 3), faceTop + 5 + bob, 2, 1, C.shadow)
  }

  // ---- 领口 / 配件 ----
  if (cc.apron) {
    // 白领 + 两条肩带 + 胸前围裙：左右完全对称，一丝褶皱都没有（艾玛）
    r(g, bx + 1, bodyTop + bob, 6, 1, cc.skinHi)
    r(g, bx + 2, bodyTop + bob + 1, 1, 3, cc.apron)
    r(g, bx + 5, bodyTop + bob + 1, 1, 3, cc.apron)
    r(g, bx + 2, bodyTop + bob + 4, 4, 2, cc.apron)
    px(g, bx + 2, bodyTop + bob + 5, cc.skinHi)
  } else if (cc.bow) {
    // 银灰领结（赫尔曼）
    r(g, bx + 1, bodyTop + bob, 6, 1, cc.skinHi)
    r(g, bx + 2, bodyTop + bob + 1, 2, 1, cc.bow)
    r(g, bx + 4, bodyTop + bob + 1, 2, 1, cc.bow)
    px(g, bx + 3, bodyTop + bob + 1, C.bone)
    px(g, bx + 3, bodyTop + bob + 2, cc.bow)
  } else {
    // 普通领口与扣子
    r(g, bx + 2, bodyTop + bob, 4, 1, cc.skinShade)
    if (dir === 'down') {
      px(g, bx + 3, bodyTop + 2 + bob, cc.accent ?? cc.coatHi)
      px(g, bx + 3, bodyTop + 4 + bob, cc.accent ?? cc.coatHi)
    }
  }

  // ---- 玛尔塔的头巾 ----
  if (cc.hairStyle === 'kerchief' && cc.kerchief) {
    r(g, bx - 1, hairTop + bob, 10, 2, cc.kerchief)
    r(g, bx - 1, hairTop + bob, 10, 1, C.sugar)
    r(g, bx - 1, hairTop + bob + 2, 1, 3, cc.kerchief)
    r(g, bx + 8, hairTop + bob + 2, 1, 3, cc.kerchief)
  }

  return c
}

// ============================================================
// 弗里德里希：窄肩长身 + 蓬松红发
// 16×24。发顶 y1，脸 y4..y10，窄躯干 y11..y17，长腿 y18..20，靴 y21..22。
// 五官行号与艾玛完全一致（眉 y5 / 眼 y6..y7 / 鼻 y8 / 嘴 y9 / 下巴 y10），
// 两人在地图上切换时脸不会一高一低。
// 剪影：头发 10px 宽 > 肩 6px 宽；直筒长腿；深色高领 + 银灰领口 + 铜扣。
// ============================================================
function drawHero(cc: CharColors, dir: Dir, frame: number): Sprite {
  const { c, g } = canvas(16, 24)
  const mirror = dir === 'right'
  const mx = (x: number, w = 1): number => (mirror ? 16 - x - w : x)
  const bob = frame === 1 ? -1 : 0        // 身体起伏
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0
  const liftL = frame === 1 ? 1 : 0       // 抬左腿
  const liftR = frame === 2 ? 1 : 0       // 抬右腿
  const hi = cc.pantsHi ?? cc.pants
  const lip = cc.lip ?? '#8b5a52'
  const darkShoe = cc.coatDark

  // ---- 影子 ----
  r(g, 3, 23, 10, 1, 'rgba(0,0,0,0.42)')
  r(g, 4, 22, 8, 1, 'rgba(0,0,0,0.20)')

  // ---- 腿：细长直腿（裤 3 行 + 靴 2 行）；抬起的腿短 1px 并压暗 ----
  if (dir === 'down' || dir === 'up') {
    r(g, 5, 18, 2, 3 - liftL, cc.pants)
    r(g, 5, 18, 1, 3 - liftL, hi)
    r(g, 5, 21 - liftL, 2, 2, liftL ? darkShoe : cc.shoe)
    px(g, 5, 21 - liftL, liftL ? cc.pants : hi)
    r(g, 9, 18, 2, 3 - liftR, cc.pants)
    r(g, 9, 18, 1, 3 - liftR, hi)
    r(g, 9, 21 - liftR, 2, 2, liftR ? darkShoe : cc.shoe)
    px(g, 9, 21 - liftR, liftR ? cc.pants : hi)
  } else {
    // 侧面：原型朝左——前腿在屏幕左（x5..6），后腿在右（x9..10）
    const lead = frame === 1 ? 1 : 0
    const trail = frame === 2 ? 1 : 0
    r(g, mx(9, 2), 18, 2, 3 - trail, cc.pants)          // 后腿
    r(g, mx(9, 2), 18, 1, 3 - trail, hi)
    r(g, mx(9, 2), 21 - trail, 2, 2, trail ? darkShoe : cc.shoe)
    r(g, mx(5 + lead, 2), 18, 2, 3, cc.pants)           // 前腿（frame1 前伸）
    r(g, mx(5 + lead, 2), 18, 1, 3, hi)
    r(g, mx(5 + lead, 2), 21, 2, 2, cc.shoe)
    px(g, mx(5 + lead, 2), 21, hi)
  }

  // ---- 躯干：只有 6 宽，窄肩 ----
  const ty = 11 + bob
  r(g, 5, ty, 6, 7, cc.coat)
  r(g, 5, ty, 6, 1, cc.coatHi)               // 肩线
  r(g, 5, ty, 1, 7, cc.coatHi)               // 屏幕左缘受光
  r(g, 10, ty, 1, 7, cc.coatDark)            // 屏幕右缘背光
  r(g, 5, ty + 6, 6, 1, cc.coatDark)         // 下摆

  // ---- 手臂：细，摆动 ±1px，末端露一只手 ----
  if (dir === 'down' || dir === 'up') {
    const aL = 12 + bob + swing
    const aR = 12 + bob - swing
    r(g, 4, aL, 1, 4, cc.coat)
    px(g, 4, aL, cc.coatHi)
    px(g, 4, aL + 3, cc.skin)
    r(g, 11, aR, 1, 4, cc.coatDark)
    px(g, 11, aR + 3, cc.skinShade)
  } else {
    const aY = 12 + bob + swing
    r(g, mx(6, 2), aY, 2, 4, cc.coat)
    px(g, mx(6, 1), aY, cc.coatHi)
    px(g, mx(7, 1), aY + 3, cc.skin)
  }

  // ---- 头 ----
  if (dir === 'down') {
    // 脸：8 宽 7 高
    r(g, 4, 4 + bob, 8, 7, cc.skin)
    r(g, 4, 4 + bob, 1, 6, cc.skinHi)
    r(g, 11, 4 + bob, 1, 6, cc.skinShade)
    r(g, 5, 10 + bob, 6, 1, cc.skin)                  // 下巴
    px(g, 5, 10 + bob, cc.skinShade)
    px(g, 10, 10 + bob, cc.skinShade)
    // 顶发：三层加宽，比肩宽一圈
    r(g, 6, 1 + bob, 4, 1, cc.hair)
    r(g, 7, 1 + bob, 2, 1, cc.hairHi)
    r(g, 4, 2 + bob, 8, 1, cc.hair)
    r(g, 4, 2 + bob, 4, 1, cc.hairHi)
    r(g, 10, 2 + bob, 2, 1, cc.hairDark)
    r(g, 3, 2 + bob, 1, 1, cc.hairHi)                 // 左侧翘起的一绺
    r(g, 12, 2 + bob, 1, 1, cc.hairDark)
    r(g, 3, 3 + bob, 10, 1, cc.hair)
    r(g, 3, 3 + bob, 3, 1, cc.hairHi)
    r(g, 11, 3 + bob, 2, 1, cc.hairDark)
    // 刘海：左绺 x3..5，右绺 x10..12，中间露 4px 额头
    r(g, 3, 4 + bob, 3, 1, cc.hair)
    px(g, 5, 4 + bob, cc.hairDark)                    // 左绺尖
    r(g, 10, 4 + bob, 3, 1, cc.hair)
    px(g, 10, 4 + bob, cc.hairDark)                   // 右绺尖
    px(g, 3, 4 + bob, cc.hairHi)
    // 鬓发：垂到下颌，把脸框住
    r(g, 3, 5 + bob, 1, 2, cc.hair)
    r(g, 12, 5 + bob, 1, 2, cc.hairDark)
    // 眉（y5）：与眼睛之间空出 y6 一整行 —— 眉骨凸起，眼窝凹下去
    r(g, 5, 5 + bob, 2, 1, cc.hairDark)
    r(g, 9, 5 + bob, 2, 1, cc.hairDark)
    // 眼：y7 是一条明确的上眼睑横线，y8 只留 1px 高的虹膜 —— 窄眼，不再是方块
    const eyeDk = cc.eyeDark ?? cc.eye
    r(g, 5, 7 + bob, 2, 1, eyeDk)
    r(g, 9, 7 + bob, 2, 1, eyeDk)
    px(g, 5, 8 + bob, C.sugar)                        // 眼白：虹膜不占满
    px(g, 6, 8 + bob, cc.eye)                         // 虹膜只占内侧 1px
    px(g, 9, 8 + bob, cc.eye)
    px(g, 10, 8 + bob, C.sugar)
    // 鼻：y7 鼻梁（两眉之间）+ y8 鼻头，两行，不再是一个孤零零的点
    px(g, 8, 7 + bob, cc.skinShade)                   // 鼻梁的背光侧
    px(g, 7, 8 + bob, cc.skinShade)                   // 鼻头底面
    px(g, 8, 8 + bob, cc.skinShade)
    // 嘴
    r(g, 7, 9 + bob, 2, 1, lip)
    px(g, 6, 9 + bob, cc.skinShade)
    px(g, 9, 9 + bob, cc.skinShade)
  } else if (dir === 'up') {
    // 后脑：整颗头都是头发 —— 没有脸、没有眼
    r(g, 6, 1 + bob, 4, 1, cc.hair)
    r(g, 7, 1 + bob, 2, 1, cc.hairHi)
    r(g, 4, 2 + bob, 8, 1, cc.hair)
    r(g, 4, 2 + bob, 4, 1, cc.hairHi)
    r(g, 10, 2 + bob, 2, 1, cc.hairDark)
    r(g, 3, 2 + bob, 1, 1, cc.hairHi)
    r(g, 12, 2 + bob, 1, 1, cc.hairDark)
    r(g, 3, 3 + bob, 10, 6, cc.hair)                  // y3..y8
    r(g, 3, 3 + bob, 1, 6, cc.hairHi)
    r(g, 12, 3 + bob, 1, 6, cc.hairDark)
    r(g, 4, 3 + bob, 3, 1, cc.hairHi)
    // 发丝：两道深缝 + 两点高光
    r(g, 6, 4 + bob, 1, 4, cc.hairDark)
    px(g, 4, 4 + bob, cc.hairHi)
    px(g, 4, 6 + bob, cc.hairHi)
    px(g, 9, 5 + bob, cc.hairDark)
    px(g, 11, 4 + bob, cc.hairDark)
    // 发尾：收窄一行，压暗
    r(g, 4, 9 + bob, 8, 1, cc.hair)
    px(g, 4, 9 + bob, cc.hairHi)
    r(g, 10, 9 + bob, 2, 1, cc.hairDark)
    px(g, 5, 9 + bob, cc.hairDark)
    px(g, 9, 9 + bob, cc.hairDark)
    // 后颈与后领（银灰立领的后缘，背向观众也认得出这套制服）
    r(g, 7, 10 + bob, 2, 1, cc.skinShade)
    r(g, 5, 10 + bob, 2, 1, cc.collar ?? cc.coatHi)
    r(g, 9, 10 + bob, 2, 1, cc.collar ?? cc.coatHi)
  } else {
    // 侧面（原型朝左，朝右时整体镜像）：鼻尖朝屏幕外侧突出 1px
    const f = (x: number, w = 1): number => (mirror ? 16 - x - w : x)
    // 脸 x4..10
    r(g, f(4, 7), 4 + bob, 7, 7, cc.skin)
    r(g, f(4, 1), 4 + bob, 1, 6, cc.skinHi)           // 屏幕左缘受光
    r(g, f(10, 1), 4 + bob, 1, 6, cc.skinShade)       // 屏幕右缘背光
    r(g, f(4, 7), 10 + bob, 7, 1, cc.skinShade)       // 下巴
    const noseX = mirror ? 12 : 3                     // 鼻尖
    px(g, noseX, 7 + bob, cc.skin)
    px(g, noseX, 8 + bob, cc.skinShade)
    // 顶发
    r(g, f(5, 6), 1 + bob, 6, 1, cc.hair)
    r(g, f(6, 2), 1 + bob, 2, 1, cc.hairHi)
    r(g, f(3, 10), 2 + bob, 10, 1, cc.hair)
    r(g, f(4, 5), 2 + bob, 5, 1, cc.hairHi)
    r(g, f(10, 3), 2 + bob, 3, 1, cc.hairDark)
    r(g, f(3, 10), 3 + bob, 10, 1, cc.hair)
    r(g, f(3, 3), 3 + bob, 3, 1, cc.hairHi)
    r(g, f(11, 2), 3 + bob, 2, 1, cc.hairDark)
    // 后脑的头发（朝左时在屏幕右侧）
    r(g, f(9, 4), 4 + bob, 4, 6, cc.hair)
    r(g, f(9, 1), 4 + bob, 1, 6, cc.hairHi)
    r(g, f(12, 1), 4 + bob, 1, 6, cc.hairDark)
    px(g, f(10, 1), 5 + bob, cc.hairDark)
    px(g, f(11, 1), 7 + bob, cc.hairHi)
    // 前额的刘海：一绺斜垂
    r(g, f(4, 3), 4 + bob, 3, 1, cc.hair)
    r(g, f(5, 2), 5 + bob, 2, 1, cc.hair)
    px(g, f(4, 1), 4 + bob, cc.hairHi)
    px(g, f(5, 1), 5 + bob, cc.hairDark)
    // 后颈发尾
    r(g, f(9, 4), 10 + bob, 4, 1, cc.hairDark)
    // 只露一只眼：眉 y5 → 空一行 → y7 上眼睑横线 → y8 只留 1px 高的虹膜
    const eyeX = mirror ? 9 : 6
    const eyeDk = cc.eyeDark ?? cc.eye
    r(g, eyeX, 5 + bob, 2, 1, cc.hairDark)            // 眉
    r(g, eyeX, 7 + bob, 2, 1, eyeDk)                  // 上眼睑：明确的横线
    px(g, eyeX, 8 + bob, C.sugar)                     // 眼白
    px(g, eyeX + 1, 8 + bob, cc.eye)                  // 虹膜
    // 嘴
    px(g, mirror ? 10 : 5, 9 + bob, lip)
    px(g, mirror ? 11 : 6, 9 + bob, cc.skinShade)
  }

  // ---- 领口与胸饰：银灰立领边 + V 形银饰（压缩到 4 行）----
  // 16×24 上画不下立绘那条完整的 V 形银线，压成一组银点：
  // y13 双肩起点 → y14 内收 → y15 汇到中央 → y16 中央的小银扣。
  const silver = cc.collar ?? C.pale
  if (dir === 'up') {
    r(g, 5, ty, 6, 1, silver)                 // 后领一圈银边
  } else if (dir === 'down') {
    // 立领：上缘一道亮银，两侧立边，中间是深色领内
    r(g, 6, ty, 4, 1, silver)
    px(g, 6, ty, C.bone)
    px(g, 9, ty, C.mist)
    px(g, 6, ty + 1, silver)
    px(g, 9, ty + 1, silver)
    r(g, 7, ty + 1, 2, 1, cc.coatDark)
    // V 形银饰：左亮右暗，八点收成一个尖
    px(g, 5, ty + 2, C.bone)                  // 左肩起点
    px(g, 10, ty + 2, silver)                 // 右肩起点
    px(g, 6, ty + 3, C.bone)
    px(g, 9, ty + 3, silver)
    px(g, 7, ty + 4, C.bone)                  // 汇到中央
    px(g, 8, ty + 4, silver)
    r(g, 7, ty + 5, 2, 1, silver)             // 中央的小银扣
    px(g, 7, ty + 5, C.bone)
  } else {
    // 侧面：只画朝向镜头的那半边 V（朝左时在屏幕左侧）
    r(g, mx(6, 4), ty, 4, 1, silver)
    px(g, mx(6, 1), ty, C.bone)
    px(g, mx(6, 1), ty + 1, silver)
    px(g, mx(9, 1), ty + 1, silver)
    r(g, mx(7, 2), ty + 1, 2, 1, cc.coatDark)
    px(g, mx(5, 1), ty + 2, C.bone)
    px(g, mx(6, 1), ty + 3, C.bone)
    px(g, mx(7, 1), ty + 4, C.bone)
    px(g, mx(8, 1), ty + 4, silver)
    px(g, mx(7, 1), ty + 5, silver)
  }

  return c
}

// ============================================================
// 艾玛：方形白领 + 白围裙前襟 + 盘发轮廓 + 两侧垂发
// 16×24。发髻 y0..y2，头顶 y3，齐刘海 y4，脸 y5..y10，
// 躯干 y11..y16，长裙 y17..y20，小鞋 y21..22。
// 剪影：头顶凸起的发髻、两条笔直的垂发、横平的方领与一条竖白前襟、展开的裙摆。
// ============================================================
function drawMaid(cc: CharColors, dir: Dir, frame: number): Sprite {
  const { c, g } = canvas(16, 24)
  const mirror = dir === 'right'
  const mx = (x: number, w = 1): number => (mirror ? 16 - x - w : x)
  const bob = frame === 1 ? -1 : 0
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0
  const liftL = frame === 1 ? 1 : 0
  const liftR = frame === 2 ? 1 : 0
  const apron = cc.apron ?? C.sugar
  const lip = cc.lip ?? '#a07070'

  // ---- 影子 ----
  r(g, 3, 23, 10, 1, 'rgba(0,0,0,0.42)')
  r(g, 4, 22, 8, 1, 'rgba(0,0,0,0.20)')

  // ---- 长裙：上窄下宽；行走时下摆左右摆、鞋交替探出 ----
  if (dir === 'down' || dir === 'up') {
    const sway = frame === 1 ? 1 : frame === 2 ? -1 : 0
    r(g, 5, 17 + bob, 6, 1, cc.coat)
    r(g, 4, 18 + bob, 8, 1, cc.coat)
    r(g, 4, 19 + bob, 8, 1, cc.coat)
    r(g, 3 + sway, 20 + bob, 10, 1, cc.coat)
    r(g, 5, 17 + bob, 1, 1, cc.coatHi)
    r(g, 4, 18 + bob, 1, 2, cc.coatHi)
    r(g, 3 + sway, 20 + bob, 1, 1, cc.coatHi)
    r(g, 11, 18 + bob, 1, 2, cc.coatDark)
    r(g, 12 + sway, 20 + bob, 1, 1, cc.coatDark)
    // 围裙前襟一直垂到裙上（白条穿过整条裙子）
    r(g, 7, 17 + bob, 2, 3, apron)
    r(g, 7, 17 + bob, 1, 3, C.sugar)
    r(g, 8, 17 + bob, 1, 3, C.bone)
    // 小鞋
    r(g, 5, 21 - liftL, 2, 2, liftL ? cc.coatDark : cc.shoe)
    px(g, 5, 21 - liftL, liftL ? cc.coatDark : cc.coatHi)
    r(g, 9, 21 - liftR, 2, 2, liftR ? cc.coatDark : cc.shoe)
    px(g, 9, 21 - liftR, liftR ? cc.coatDark : cc.coat)
  } else {
    const lead = frame === 1 ? 1 : 0
    const back = frame === 2 ? 1 : 0
    r(g, mx(5, 6), 17 + bob, 6, 2, cc.coat)
    r(g, mx(4, 8), 19 + bob, 8, 1, cc.coat)
    r(g, mx(3, 10), 20 + bob, 10, 1, cc.coat)
    px(g, mx(4, 1), 19 + bob, cc.coatHi)
    px(g, mx(11, 1), 19 + bob, cc.coatDark)
    // 前脚探出（frame1 前伸，frame2 收回）
    r(g, mx(8 + lead - back, 2), 21, 2, 2, cc.shoe)
    px(g, mx(8 + lead - back, 1), 21, cc.coatHi)
  }

  // ---- 躯干：横平的方领 + 一条笔直的围裙前襟 ----
  const ty = 11 + bob
  r(g, 5, ty, 6, 6, cc.coat)
  r(g, 5, ty, 1, 6, cc.coatHi)
  r(g, 10, ty, 1, 6, cc.coatDark)
  // 方正白领：一整行横平的硬挺领子
  r(g, 5, ty, 6, 1, apron)
  px(g, 5, ty, C.sugar)
  // ---- 绿领结：两翼 + 结心 + 垂下的短尾（她最醒目的一点颜色）----
  r(g, 6, ty + 1, 4, 1, BOW_G.mid)        // 两翼
  px(g, 6, ty + 1, BOW_G.hi)              // 左翼受光、右翼背光
  px(g, 9, ty + 1, BOW_G.lo)
  r(g, 7, ty + 1, 2, 1, BOW_G.hi)         // 结心：最亮的两点
  px(g, 7, ty + 2, BOW_G.mid)             // 结心垂下的小尾
  px(g, 8, ty + 2, BOW_G.lo)
  // 白围裙前襟：一条笔直的竖白条，一丝褶皱都没有
  r(g, 7, ty + 3, 2, 3, apron)
  r(g, 7, ty + 3, 1, 3, C.sugar)
  r(g, 8, ty + 3, 1, 3, C.bone)

  // ---- 手臂：深色袖子 + 一圈白袖口 ----
  if (dir === 'down' || dir === 'up') {
    const aL = 12 + bob + swing
    const aR = 12 + bob - swing
    r(g, 4, aL, 1, 4, cc.coat)
    px(g, 4, aL, cc.coatHi)
    px(g, 4, aL + 3, apron)
    r(g, 11, aR, 1, 4, cc.coatDark)
    px(g, 11, aR + 3, apron)
  } else {
    const aY = 12 + bob + swing
    r(g, mx(6, 2), aY, 2, 4, cc.coat)
    px(g, mx(6, 1), aY, cc.coatHi)
    px(g, mx(7, 1), aY + 3, apron)
  }

  // ---- 头 ----
  /**
   * 白色蕾丝女仆帽：帽檐占头顶 2 行（16×24 上能画出的最大幅度），
   * 比头骨宽一圈，两侧各挂一小簇蕾丝 —— 这是立绘那顶帽子在行走图上的压缩形态。
   */
  const capTop = (): void => {
    r(g, 6, 0 + bob, 4, 1, apron)                    // 帽冠
    px(g, 6, 0 + bob, C.sugar)                       // 左上受光
    px(g, 9, 0 + bob, C.pale)                        // 右下压暗
    r(g, 4, 1 + bob, 8, 1, apron)                    // 帽檐（比脸宽一圈）
    r(g, 4, 1 + bob, 3, 1, C.sugar)
    r(g, 10, 1 + bob, 2, 1, C.bone)
    px(g, 3, 1 + bob, apron)                         // 两侧的蕾丝小簇
    px(g, 12, 1 + bob, apron)
    px(g, 3, 2 + bob, C.sugar)
    px(g, 12, 2 + bob, C.bone)
  }
  /** 两侧的螺旋卷：每侧三卷，从上往下变小，垂到肩膀以下 2px */
  const sideCurls = (): void => {
    const both = (x: number, y: number, w: number, h: number, col: string): void => {
      r(g, x, y + bob, w, h, col)
      r(g, 16 - x - w, y + bob, w, h, col)
    }
    // 卷1（最大，y5..y7）：一列竖干 + 一个向左外翻的钩
    both(3, 5, 1, 3, cc.hair)
    both(2, 6, 2, 2, cc.hair)
    both(2, 6, 1, 2, cc.hairHi)          // 外缘受光
    both(3, 7, 1, 1, cc.hairDark)        // 内侧贴脸处压暗一档
    both(2, 7, 1, 1, cc.hairHi)          // 卷底的钩尖
    // 卷2（y8..y9）
    both(2, 8, 1, 1, cc.hair)
    both(2, 8, 1, 1, cc.hairHi)
    both(3, 8, 1, 2, cc.hair)
    both(3, 9, 1, 1, cc.hairDark)
    // 卷3（y10..y11，最小）
    both(3, 10, 1, 2, cc.hair)
    both(3, 10, 1, 1, cc.hairHi)
    both(3, 11, 1, 1, cc.hairDark)
    // 发梢：垂到肩下
    both(3, 12, 1, 2, cc.hair)
    both(3, 13, 1, 1, cc.hairDark)
  }

  if (dir === 'down') {
    // 脸
    r(g, 4, 4 + bob, 8, 7, cc.skin)
    r(g, 4, 4 + bob, 1, 6, cc.skinHi)
    r(g, 11, 4 + bob, 1, 6, cc.skinShade)
    r(g, 5, 10 + bob, 6, 1, cc.skin)
    px(g, 5, 10 + bob, cc.skinShade)
    px(g, 10, 10 + bob, cc.skinShade)
    // 白色蕾丝女仆帽（帽檐 2px），帽下才是头发
    capTop()
    r(g, 4, 2 + bob, 8, 1, cc.hair)
    r(g, 4, 2 + bob, 3, 1, cc.hairHi)
    r(g, 10, 2 + bob, 2, 1, cc.hairDark)
    r(g, 4, 3 + bob, 8, 1, cc.hair)
    r(g, 4, 3 + bob, 3, 1, cc.hairHi)
    r(g, 11, 3 + bob, 2, 1, cc.hairDark)
    px(g, 6, 3 + bob, cc.hairDark)                    // 一道发丝，帽子下不是一块平涂
    px(g, 9, 3 + bob, cc.hairDark)
    // 齐刘海：平直的一行，下缘一丝不乱
    r(g, 3, 4 + bob, 10, 1, cc.hair)
    r(g, 3, 4 + bob, 3, 1, cc.hairHi)
    r(g, 11, 4 + bob, 2, 1, cc.hairDark)
    // 两侧的螺旋卷
    sideCurls()
    // 眉：平、低、冷静；与眼睛之间留 1px 空隙
    r(g, 5, 5 + bob, 2, 1, cc.hairDark)
    r(g, 9, 5 + bob, 2, 1, cc.hairDark)
    // 眼：灰蓝、窄而平（她不眨眼）—— 上眼睑一条横线，虹膜只有 1px 高
    const eyeDk = cc.eyeDark ?? cc.eye
    r(g, 5, 7 + bob, 2, 1, eyeDk)
    r(g, 9, 7 + bob, 2, 1, eyeDk)
    px(g, 5, 8 + bob, cc.eyeHi ?? C.sugar)
    px(g, 6, 8 + bob, cc.eye)
    px(g, 9, 8 + bob, cc.eye)
    px(g, 10, 8 + bob, cc.eyeHi ?? C.sugar)
    // 鼻：鼻梁 + 鼻头两行
    px(g, 8, 7 + bob, cc.skinShade)
    px(g, 7, 8 + bob, cc.skinShade)
    px(g, 8, 8 + bob, cc.skinShade)
    // 嘴：平直，只有一点唇色
    r(g, 7, 9 + bob, 2, 1, lip)
  } else if (dir === 'up') {
    // 背面：女仆帽 + 后脑 + 两侧的螺旋卷
    capTop()
    r(g, 4, 2 + bob, 8, 1, cc.hair)
    r(g, 4, 2 + bob, 3, 1, cc.hairHi)
    r(g, 10, 2 + bob, 2, 1, cc.hairDark)
    r(g, 3, 3 + bob, 10, 1, cc.hair)
    r(g, 3, 3 + bob, 3, 1, cc.hairHi)
    r(g, 11, 3 + bob, 2, 1, cc.hairDark)
    r(g, 3, 4 + bob, 10, 5, cc.hair)                    // y4..y8 后脑
    r(g, 3, 4 + bob, 1, 5, cc.hairHi)
    r(g, 12, 4 + bob, 1, 5, cc.hairDark)
    r(g, 4, 4 + bob, 3, 1, cc.hairHi)
    // 发丝：两道弯的暗线，读起来是卷而不是直
    r(g, 6, 5 + bob, 1, 2, cc.hairDark)
    px(g, 7, 7 + bob, cc.hairDark)
    r(g, 9, 5 + bob, 1, 2, cc.hair)
    px(g, 10, 7 + bob, cc.hairDark)
    // 发尾
    r(g, 4, 9 + bob, 8, 1, cc.hair)
    px(g, 4, 9 + bob, cc.hairHi)
    r(g, 10, 9 + bob, 2, 1, cc.hairDark)
    // 两侧的螺旋卷
    sideCurls()
    // 后颈与白领的后缘
    r(g, 7, 10 + bob, 2, 1, cc.skinShade)
    r(g, 5, 10 + bob, 6, 1, apron)
    px(g, 5, 10 + bob, C.sugar)
  } else {
    // 侧面（原型朝左，朝右时镜像）
    const f = (x: number, w = 1): number => (mirror ? 16 - x - w : x)
    // 脸
    r(g, f(4, 7), 4 + bob, 7, 7, cc.skin)
    r(g, f(4, 1), 4 + bob, 1, 6, cc.skinHi)
    r(g, f(10, 1), 4 + bob, 1, 6, cc.skinShade)
    r(g, f(4, 7), 10 + bob, 7, 1, cc.skinShade)
    const noseX = mirror ? 12 : 3
    px(g, noseX, 7 + bob, cc.skin)
    px(g, noseX, 8 + bob, cc.skinShade)
    // 女仆帽（侧面也是白帽檐压头顶）
    capTop()
    r(g, f(4, 6), 2 + bob, 6, 1, cc.hair)
    r(g, f(4, 2), 2 + bob, 2, 1, cc.hairHi)
    r(g, f(8, 2), 2 + bob, 2, 1, cc.hairDark)
    r(g, f(4, 7), 3 + bob, 7, 1, cc.hair)
    r(g, f(4, 3), 3 + bob, 3, 1, cc.hairHi)
    // 后脑的头发：上宽下窄，一路收成颈后的发尾（垂到肩，不是一块方砖）
    r(g, f(8, 5), 3 + bob, 5, 4, cc.hair)      // y3..y6
    r(g, f(9, 4), 7 + bob, 4, 3, cc.hair)      // y7..y9，内缘收 1px
    r(g, f(10, 3), 10 + bob, 3, 4, cc.hair)    // y10..y13，垂到肩下
    // 受光/背光始终按屏幕走（左上光源），镜像时不跟着翻
    r(g, f(8, 1), 3 + bob, 1, 4, mirror ? cc.hairDark : cc.hairHi)
    r(g, f(12, 1), 3 + bob, 1, 8, mirror ? cc.hairHi : cc.hairDark)
    px(g, f(10, 1), 4 + bob, cc.hairDark)
    // 卷的一痕：颈后这道暗缝把发尾与后脑分开
    r(g, f(10, 3), 9 + bob, 3, 1, cc.hairDark)
    px(g, f(10, 1), 12 + bob, cc.hairHi)
    // 齐刘海只在前额露出一条
    r(g, f(4, 3), 4 + bob, 3, 1, cc.hair)
    r(g, f(4, 1), 4 + bob, 1, 1, cc.hairHi)
    // 鬓边垂下来的一缕
    r(g, f(5, 1), 5 + bob, 1, 5, cc.hairDark)
    // 一只眼：眉 y5 → 空一行 → y7 上眼睑横线 → y8 只留 1px 高的虹膜
    const eyeX = mirror ? 9 : 6
    r(g, eyeX, 5 + bob, 2, 1, cc.hairDark)
    r(g, eyeX, 7 + bob, 2, 1, cc.eyeDark ?? cc.eye)
    px(g, eyeX, 8 + bob, cc.eyeHi ?? C.sugar)
    px(g, eyeX + 1, 8 + bob, cc.eye)
    // 嘴
    px(g, mirror ? 10 : 5, 9 + bob, lip)
    px(g, mirror ? 11 : 6, 9 + bob, cc.skinShade)
  }

  return c
}

function buildCharSet(cc: CharColors, prefix: string): Record<string, Sprite[]> {
  const out: Record<string, Sprite[]> = {}
  for (const d of ['down', 'up', 'left', 'right'] as Dir[]) {
    out[prefix + '_' + d] = [drawChar(cc, d, 0), drawChar(cc, d, 1), drawChar(cc, d, 2)]
  }
  return out
}

// ============================================================
// 家具与道具
// ============================================================

/** 石墙背底（家具精灵当背景时用，与 '#' 墙同调） */
function wallBase(g: Ctx, w: number, h: number, seed: number): void {
  r(g, 0, 0, w, h, C.stone)
  r(g, 0, 0, w, 1, C.cold)
  for (let y = 0; y < h; y += 8) {
    r(g, 0, y, w, 1, C.graphite)
    for (let x = (y / 8) % 2 === 0 ? 0 : 8; x < w; x += 16) r(g, x, y, 1, 8, C.graphite)
  }
  for (let i = 0; i < w * h / 12; i++) {
    const x = Math.floor(rnd(seed + i * 3.7) * w)
    const y = Math.floor(rnd(seed + i * 7.1) * h)
    px(g, x, y, i % 3 === 0 ? C.cold : C.graphite)
  }
}

/**
 * 大画像：维多利亚 — 红发女性、黑长裙、铁十字胸针。
 * 传 gem 时胸针中心换成宝石（bigPaintingGem）。
 */
function bigPainting(gem?: string): Sprite {
  const { c, g } = canvas(32, 40)
  const HAIR = '#a83224'
  const HAIR_HI = '#d95b3a'
  const HAIR_DK = '#6e1f18'

  // 外框：黄铜，左上受光、右下压暗
  r(g, 0, 0, 32, 40, C.brass)
  r(g, 0, 0, 32, 2, C.gold)
  r(g, 0, 0, 2, 40, C.gold)
  r(g, 30, 0, 2, 40, '#3f2f1c')
  r(g, 0, 38, 32, 2, '#3f2f1c')
  // 内框
  r(g, 2, 2, 28, 36, '#241a10')
  r(g, 2, 2, 28, 1, C.brass)
  r(g, 29, 2, 1, 36, '#170f08')
  // 画面：暗紫黑底 + 两侧帷幔
  r(g, 4, 4, 24, 32, C.shadow)
  r(g, 4, 4, 3, 32, '#241a24')
  r(g, 25, 4, 3, 32, '#1b1420')
  r(g, 4, 4, 24, 2, '#2c2130')

  // ---- 红发（先画，脸压在上面）----
  r(g, 12, 7, 8, 2, HAIR)           // 头顶
  r(g, 11, 9, 10, 4, HAIR)
  r(g, 11, 9, 10, 1, HAIR_HI)
  r(g, 11, 9, 1, 4, HAIR_HI)
  r(g, 20, 9, 1, 4, HAIR_DK)
  r(g, 10, 12, 2, 14, HAIR)         // 左侧长发
  r(g, 20, 12, 2, 14, HAIR)         // 右侧长发
  r(g, 10, 12, 1, 14, HAIR_HI)      // 左侧受光
  r(g, 21, 12, 1, 14, HAIR_DK)      // 右侧背光

  // ---- 脸 ----
  r(g, 13, 11, 6, 7, C.bone)
  r(g, 13, 16, 6, 2, C.pale)        // 下颌暗部
  r(g, 13, 11, 1, 5, C.sugar)       // 屏幕左侧受光
  r(g, 18, 11, 1, 5, C.pale)        // 屏幕右侧背光
  r(g, 13, 11, 6, 1, HAIR_DK)       // 发际线
  px(g, 14, 13, '#2b5f9a')          // 深蓝眼
  px(g, 17, 13, '#2b5f9a')
  px(g, 14, 13, C.sugar)            // 眼高光
  px(g, 15, 12, C.pale)             // 鼻梁
  px(g, 15, 15, '#8a4048')          // 嘴
  r(g, 15, 18, 2, 2, C.pale)        // 颈

  // ---- 黑长裙 ----
  r(g, 8, 20, 16, 14, C.night)
  r(g, 11, 20, 10, 3, '#141019')
  r(g, 8, 20, 16, 1, '#221a26')     // 肩线
  r(g, 8, 20, 1, 14, '#1c1622')     // 裙左受光
  r(g, 23, 20, 1, 14, '#08090c')    // 裙右背光
  // 胸口露出的苍白皮肤与暗红领口
  r(g, 14, 19, 4, 3, C.bone)
  r(g, 14, 21, 4, 1, '#8c1f28')
  // 袖子
  r(g, 8, 21, 3, 8, '#181420')
  r(g, 21, 21, 3, 8, '#0c0a10')
  // 银十字胸针 + 红宝石
  r(g, 13, 23, 6, 1, C.cold)
  r(g, 15, 22, 2, 5, C.cold)
  r(g, 13, 23, 1, 1, C.pale)
  r(g, 15, 24, 2, 2, gem ?? C.blood)
  px(g, 15, 24, C.sugar)

  // ---- 交叠在腹前的手 ----
  r(g, 13, 30, 3, 2, C.bone)
  r(g, 16, 31, 3, 2, C.bone)
  r(g, 13, 30, 3, 1, C.sugar)
  r(g, 16, 31, 3, 1, C.sugar)

  // 画面暗角
  r(g, 4, 33, 24, 3, '#0e0b12')
  px(g, 5, 5, '#2c2130')
  return c
}

/** 壁炉：32×32，石砌壁柱、拱形炉膛与摇曳的火 */
function fireplace(): Sprite {
  const { c, g } = canvas(32, 32)
  wallBase(g, 32, 32, 9)
  // 炉台
  r(g, 0, 3, 32, 3, C.cold)
  r(g, 0, 3, 32, 1, C.pale)
  r(g, 0, 5, 32, 1, C.graphite)
  // 壁柱
  r(g, 0, 6, 5, 26, C.stone)
  r(g, 0, 6, 1, 26, C.cold)
  r(g, 27, 6, 5, 26, C.stone)
  r(g, 31, 6, 1, 26, C.graphite)
  r(g, 4, 6, 1, 26, C.graphite)
  r(g, 27, 6, 1, 26, C.graphite)
  // 拱形炉口：逐行收窄
  r(g, 13, 6, 6, 1, C.night)
  r(g, 11, 7, 10, 1, C.night)
  r(g, 9, 8, 14, 1, C.night)
  r(g, 7, 9, 18, 1, C.night)
  r(g, 6, 10, 20, 1, C.night)
  r(g, 5, 11, 22, 21, C.night)
  // 内壁阴影
  r(g, 5, 11, 1, 21, C.graphite)
  r(g, 26, 11, 1, 21, C.shadow)
  // 火床
  r(g, 8, 27, 16, 3, C.bloodDark)
  r(g, 9, 26, 14, 1, C.blood)
  // 火焰：细长、分层的火舌
  r(g, 11, 23, 10, 4, C.fire)
  r(g, 12, 19, 8, 5, C.fire)
  r(g, 13, 16, 6, 5, C.fire)
  r(g, 14, 13, 4, 5, C.fire)
  r(g, 13, 20, 4, 6, C.gold)
  r(g, 14, 16, 2, 6, C.gold)
  r(g, 15, 21, 2, 3, C.sugar)
  px(g, 15, 14, C.gold)
  px(g, 16, 12, C.fire)
  px(g, 11, 21, C.fire)
  px(g, 20, 22, C.fire)
  px(g, 12, 18, C.gold)
  px(g, 19, 19, C.gold)
  // 余烬与火星
  px(g, 9, 29, C.blood)
  px(g, 22, 29, C.blood)
  px(g, 11, 28, C.gold)
  px(g, 20, 28, C.gold)
  px(g, 15, 10, C.gold)
  // 火光溢到炉石
  px(g, 4, 16, C.bloodDark)
  px(g, 27, 16, C.bloodDark)
  px(g, 4, 23, C.bloodDark)
  px(g, 27, 23, C.bloodDark)
  r(g, 6, 24, 2, 2, C.bloodDark)
  r(g, 24, 24, 2, 2, C.bloodDark)
  return c
}

/** 桌子：木桌，宽桌放信纸与酒杯 */
function table(w: number, h: number): Sprite {
  const { c, g } = canvas(w, h)
  // 桌面（俯视）：面 + 左上受光 + 右下暗
  r(g, 0, 2, w, h - 6, '#5c4630')
  r(g, 0, 2, w, 2, '#77603f')
  r(g, 0, 2, 1, h - 6, '#77603f')
  r(g, w - 1, 2, 1, h - 6, '#3f2f1c')
  r(g, 0, h - 5, w, 1, '#3f2f1c')
  // 木纹
  for (let i = 0; i < 3; i++) {
    const y = 5 + i * 3
    r(g, 2, y, w - 6, 1, i % 2 === 0 ? '#4a3822' : '#6a5038')
  }
  // 桌腿
  r(g, 2, h - 4, 3, 4, '#3f2f1c')
  r(g, w - 5, h - 4, 3, 4, '#241a10')
  // 桌面陈设
  if (w >= 32) {
    r(g, 4, 4, 7, 5, C.bone)          // 信纸
    r(g, 4, 4, 7, 1, C.sugar)
    px(g, 6, 6, C.pale)
    px(g, 7, 6, C.pale)
    r(g, w - 8, 4, 3, 4, C.pale)      // 酒杯
    r(g, w - 8, 6, 3, 2, C.bloodDark)
    px(g, w - 8, 4, C.bone)
  }
  return c
}

/** 书桌：32×24，桌面有信、墨水瓶、羽毛笔，侧面带抽屉 */
function desk(): Sprite {
  const { c, g } = canvas(32, 24)
  // 桌面
  r(g, 0, 4, 32, 8, '#5c4630')
  r(g, 0, 4, 32, 2, '#77603f')
  r(g, 0, 4, 1, 8, '#77603f')
  r(g, 31, 4, 1, 8, '#3f2f1c')
  r(g, 0, 11, 32, 1, '#3f2f1c')
  // 桌面木纹
  r(g, 2, 7, 28, 1, '#6a5038')
  // 桌腿与抽屉柜
  r(g, 1, 12, 3, 12, '#3f2f1c')
  r(g, 28, 12, 3, 12, '#241a10')
  r(g, 4, 12, 12, 11, '#3f2f1c')
  r(g, 4, 12, 12, 1, '#5c4630')
  r(g, 4, 12, 1, 11, '#5c4630')
  r(g, 6, 15, 8, 1, '#241a10')
  r(g, 6, 19, 8, 1, '#241a10')
  r(g, 9, 16, 2, 1, C.brass)
  r(g, 9, 20, 2, 1, C.brass)
  // 桌面陈设：纸、墨水瓶、羽毛笔
  r(g, 2, 5, 9, 6, C.bone)
  r(g, 2, 5, 9, 1, C.sugar)
  r(g, 23, 5, 4, 4, '#1a2028')      // 墨水瓶
  r(g, 23, 5, 4, 1, C.cold)
  r(g, 24, 6, 2, 2, C.night)
  r(g, 23, 4, 1, 1, C.pale)         // 瓶塞
  // 羽毛笔
  r(g, 18, 5, 4, 1, C.pale)
  r(g, 21, 4, 2, 1, C.bone)
  px(g, 17, 6, C.brass)
  // 纸上的字
  for (let i = 0; i < 4; i++) r(g, 4, 7 + i, 5 - (i % 2), 1, C.pale)
  return c
}

/** 床：32×24 横躺，床头板在左、枕头居中、被子盖到床尾 */
function bed(): Sprite {
  const { c, g } = canvas(32, 24)
  // 床头板
  r(g, 0, 0, 5, 24, '#3f2f1c')
  r(g, 0, 0, 5, 2, '#77603f')
  r(g, 0, 0, 1, 24, '#5c4630')
  r(g, 4, 0, 1, 24, '#241a10')
  // 床架
  r(g, 4, 4, 28, 16, '#3f2f1c')
  r(g, 4, 4, 28, 1, '#77603f')
  r(g, 4, 19, 28, 2, '#241a10')
  r(g, 31, 4, 1, 16, '#241a10')
  // 床垫
  r(g, 5, 5, 26, 14, C.bone)
  r(g, 5, 5, 26, 1, C.sugar)
  r(g, 30, 5, 1, 14, C.pale)
  // 枕头
  r(g, 6, 6, 7, 6, C.sugar)
  r(g, 6, 6, 7, 1, '#f2ece0')
  r(g, 6, 11, 7, 1, C.pale)
  r(g, 12, 6, 1, 6, C.pale)
  // 被子
  r(g, 14, 5, 16, 14, C.pale)
  r(g, 14, 5, 16, 1, C.bone)
  r(g, 14, 18, 16, 1, '#7f8ca0')
  // 被面折纹（大块，不碎）
  r(g, 17, 7, 1, 10, '#8f9cae')
  r(g, 23, 7, 1, 10, '#8f9cae')
  // 床腿
  r(g, 1, 22, 3, 2, '#241a10')
  r(g, 28, 22, 3, 2, '#241a10')
  return c
}

/** 书架：16×32，木壳五层，书脊颜色克制 */
function bookshelf(): Sprite {
  const { c, g } = canvas(16, 32)
  r(g, 0, 0, 16, 32, '#3f2f1c')
  r(g, 0, 0, 16, 1, '#77603f')
  r(g, 0, 0, 1, 32, '#5c4630')
  r(g, 15, 0, 1, 32, '#241a10')
  r(g, 0, 31, 16, 1, '#241a10')
  r(g, 1, 1, 14, 30, '#241a10')
  const bookCols = ['#7a1c24', '#6b5c32', '#26333f', '#33402a', '#3f4754', '#5c4a2c']
  for (let s = 0; s < 5; s++) {
    const y0 = 1 + s * 6
    for (let i = 0; i < 7; i++) {
      const h = 3 + Math.floor(rnd(401 + s * 19 + i * 3.3) * 2)
      const w = i % 3 === 0 ? 2 : 1
      const x = 2 + i * 2
      const col = bookCols[(i + s * 2) % bookCols.length]
      r(g, x, y0 + 4 - h, w, h, col)
      px(g, x, y0 + 4 - h, '#9aa6b8')
    }
    r(g, 1, y0 + 4, 14, 1, '#5c4630')
    px(g, 1, y0 + 4, '#77603f')
    r(g, 1, y0 + 5, 14, 1, '#241a10')
  }
  return c
}

/** 烛台：16×32，三枝黄铜烛台，烛焰是唯一暖源 */
function candelabra(): Sprite {
  const { c, g } = canvas(16, 32)
  // 底座
  r(g, 3, 28, 10, 3, C.brass)
  r(g, 3, 28, 10, 1, C.gold)
  r(g, 4, 31, 8, 1, C.graphite)
  // 立柱
  r(g, 7, 18, 2, 10, C.brass)
  r(g, 7, 18, 1, 10, C.gold)
  // 柱身装饰球
  r(g, 6, 26, 4, 2, C.brass)
  r(g, 6, 26, 4, 1, C.gold)
  // 横臂
  r(g, 2, 16, 12, 1, C.brass)
  r(g, 2, 16, 1, 1, C.gold)
  r(g, 13, 16, 1, 1, C.graphite)
  // 三个烛杯
  r(g, 2, 15, 4, 1, C.brass)
  r(g, 6, 15, 4, 1, C.brass)
  r(g, 10, 15, 4, 1, C.brass)
  // 蜡烛
  r(g, 3, 9, 2, 6, C.bone)
  px(g, 3, 9, C.sugar)
  px(g, 4, 9, C.pale)
  r(g, 7, 6, 2, 9, C.bone)
  px(g, 7, 6, C.sugar)
  px(g, 8, 6, C.pale)
  r(g, 11, 9, 2, 6, C.bone)
  px(g, 11, 9, C.sugar)
  px(g, 12, 9, C.pale)
  // 火焰
  r(g, 3, 7, 2, 2, C.fire)
  px(g, 3, 7, C.gold)
  px(g, 4, 6, C.sugar)
  r(g, 7, 3, 2, 3, C.fire)
  px(g, 7, 3, C.sugar)
  px(g, 8, 2, C.gold)
  r(g, 11, 7, 2, 2, C.fire)
  px(g, 11, 7, C.gold)
  px(g, 12, 6, C.sugar)
  // 台面火光
  px(g, 2, 13, C.bloodDark)
  px(g, 13, 13, C.bloodDark)
  return c
}

/** 穿衣镜：16×40，黄铜镜框里映着昏暗房间与一道窗光 */
function mirror(): Sprite {
  const { c, g } = canvas(16, 40)
  // 底座
  r(g, 2, 36, 12, 4, '#3f2f1c')
  r(g, 2, 36, 12, 1, '#77603f')
  r(g, 2, 39, 12, 1, '#241a10')
  r(g, 6, 33, 4, 3, '#5c4630')
  r(g, 6, 33, 1, 3, '#77603f')
  // 镜框
  r(g, 1, 1, 14, 33, C.brass)
  r(g, 1, 1, 14, 1, C.gold)
  r(g, 1, 1, 1, 33, C.gold)
  r(g, 14, 1, 1, 33, '#3f2f1c')
  r(g, 1, 33, 14, 1, '#3f2f1c')
  r(g, 3, 0, 10, 1, C.brass)
  px(g, 7, 0, C.gold)
  // 镜面：反射昏暗房间
  r(g, 3, 3, 10, 29, '#232c36')
  r(g, 3, 3, 10, 1, C.cold)
  r(g, 3, 3, 1, 29, C.mist)
  // 映出的窗光
  r(g, 4, 5, 4, 10, '#33414f')
  r(g, 4, 5, 3, 6, C.cold)
  r(g, 5, 7, 1, 3, C.pale)
  // 斜向反光
  for (let i = 0; i < 10; i++) px(g, 5 + i, 10 + i * 2, C.mist)
  // 镜面右下压暗
  r(g, 9, 20, 4, 12, '#161d25')
  // 镜框高光
  px(g, 2, 2, C.sugar)
  px(g, 12, 30, '#5f5430')
  return c
}

/** 落地钟：16×40，木壳、清楚的钟盘与钟摆 */
function grandfatherClock(): Sprite {
  const { c, g } = canvas(16, 40)
  // 木壳
  r(g, 1, 0, 14, 40, '#3f2f1c')
  r(g, 1, 0, 14, 2, '#77603f')
  r(g, 1, 0, 1, 40, '#5c4630')
  r(g, 14, 0, 1, 40, '#241a10')
  // 顶冠
  r(g, 2, 0, 12, 1, '#77603f')
  r(g, 4, 0, 8, 1, C.brass)
  // 钟盘
  r(g, 3, 3, 10, 10, C.bone)
  r(g, 3, 3, 10, 1, C.sugar)
  r(g, 3, 3, 1, 10, '#f2ece0')
  r(g, 12, 3, 1, 10, C.pale)
  // 刻度
  px(g, 4, 5, C.graphite)
  px(g, 11, 5, C.graphite)
  px(g, 4, 10, C.graphite)
  px(g, 11, 10, C.graphite)
  px(g, 7, 4, C.graphite)
  px(g, 8, 11, C.graphite)
  // 指针
  r(g, 7, 6, 1, 4, C.night)
  r(g, 7, 8, 3, 1, C.night)
  px(g, 7, 8, C.brass)
  // 玻璃门与钟摆
  r(g, 3, 14, 10, 20, '#1c241c')
  r(g, 3, 14, 10, 1, C.graphite)
  r(g, 3, 14, 1, 20, C.cold)
  r(g, 8, 16, 1, 14, C.brass)
  r(g, 7, 22, 3, 1, C.brass)
  // 钟摆
  r(g, 6, 29, 5, 4, C.gold)
  r(g, 6, 29, 5, 1, C.sugar)
  r(g, 7, 30, 3, 2, C.brass)
  // 底座
  r(g, 1, 34, 14, 6, '#3f2f1c')
  r(g, 1, 34, 14, 1, '#77603f')
  r(g, 3, 37, 10, 1, C.brass)
  return c
}

/** 铁门：16×32，铁板、横梁、铆钉、黄铜把手 */
function ironDoor(): Sprite {
  const { c, g } = canvas(16, 32)
  // 石框
  r(g, 0, 0, 16, 32, C.graphite)
  r(g, 0, 0, 16, 1, C.stone)
  // 铁门板
  r(g, 2, 1, 12, 31, '#2a2f38')
  r(g, 2, 1, 12, 1, C.cold)
  r(g, 2, 1, 1, 31, C.cold)
  r(g, 13, 1, 1, 31, C.night)
  // 横梁
  r(g, 2, 7, 12, 2, '#3a3f48')
  r(g, 2, 7, 12, 1, C.cold)
  r(g, 2, 17, 12, 2, '#3a3f48')
  r(g, 2, 17, 12, 1, C.cold)
  r(g, 2, 27, 12, 2, '#3a3f48')
  r(g, 2, 27, 12, 1, C.cold)
  // 中缝
  r(g, 8, 1, 1, 31, C.night)
  // 铆钉
  for (const y of [3, 12, 22, 30]) {
    px(g, 3, y, C.pale)
    px(g, 6, y, C.pale)
    px(g, 9, y, C.pale)
    px(g, 12, y, C.pale)
  }
  // 把手与锁
  r(g, 4, 14, 2, 5, C.brass)
  r(g, 4, 14, 1, 5, C.gold)
  r(g, 3, 19, 4, 1, C.brass)
  r(g, 10, 9, 2, 3, C.brass)
  px(g, 10, 9, C.gold)
  // 门底阴影
  r(g, 2, 31, 12, 1, C.night)
  return c
}

/** 告示板：16×24，木框 + 纸张 + 字行 */
function notice(): Sprite {
  const { c, g } = canvas(16, 24)
  // 木框
  r(g, 1, 1, 14, 18, '#3f2f1c')
  r(g, 1, 1, 14, 1, '#77603f')
  r(g, 1, 1, 1, 18, '#5c4630')
  r(g, 14, 1, 1, 18, '#241a10')
  r(g, 1, 18, 14, 1, '#241a10')
  // 纸
  r(g, 3, 3, 10, 14, C.bone)
  r(g, 3, 3, 10, 1, C.sugar)
  r(g, 12, 3, 1, 14, C.pale)
  for (let i = 0; i < 5; i++) r(g, 4, 6 + i * 2, 8 - (i % 3), 1, C.cold)
  // 图钉
  px(g, 4, 3, C.brass)
  px(g, 11, 3, C.brass)
  // 支柱
  r(g, 7, 19, 2, 5, '#3f2f1c')
  r(g, 7, 19, 1, 5, '#5c4630')
  r(g, 6, 23, 4, 1, '#241a10')
  return c
}

/** 铁艺门拱：16×32，黑铁拱券与两根立柱 */
function gateArch(): Sprite {
  const { c, g } = canvas(16, 32)
  r(g, 0, 0, 16, 32, C.night)
  // 拱券（像素弧）
  const arc: [number, number][] = [
    [3, 10], [2, 11], [1, 12], [1, 13], [1, 14],
    [14, 12], [15, 13], [15, 14], [14, 11], [13, 10],
  ]
  for (const [x, y] of arc) px(g, x, y, C.cold)
  r(g, 4, 9, 8, 1, C.cold)
  r(g, 5, 8, 6, 1, C.cold)
  r(g, 6, 7, 4, 1, C.cold)
  r(g, 7, 6, 2, 1, C.cold)
  // 立柱
  r(g, 1, 14, 2, 18, C.cold)
  r(g, 1, 14, 1, 18, C.mist)
  r(g, 13, 14, 2, 18, C.cold)
  r(g, 14, 14, 1, 18, C.graphite)
  // 柱头与柱础
  r(g, 0, 12, 4, 2, C.cold)
  r(g, 12, 12, 4, 2, C.cold)
  r(g, 0, 30, 5, 2, C.cold)
  r(g, 11, 30, 5, 2, C.cold)
  // 穹顶饰尖
  px(g, 8, 5, C.brass)
  px(g, 7, 6, C.brass)
  return c
}

/** 三花猫（序章）：橘白花色，坐在阶上 */
function cat(): Sprite {
  const { c, g } = canvas(16, 16)
  // 身体
  r(g, 4, 8, 8, 6, '#c8a05a')
  r(g, 4, 8, 8, 1, '#e0c080')
  r(g, 11, 8, 1, 6, '#8a6438')
  // 头和耳朵
  r(g, 4, 4, 6, 5, '#c8a05a')
  r(g, 4, 4, 6, 1, '#e0c080')
  px(g, 4, 3, '#c8a05a')
  px(g, 9, 3, '#c8a05a')
  px(g, 5, 2, '#8a6438')
  px(g, 8, 2, '#8a6438')
  // 脸
  r(g, 5, 6, 4, 2, '#e0c080')
  px(g, 5, 6, C.night)
  px(g, 8, 6, C.night)
  px(g, 6, 7, '#8a6438')
  // 尾巴
  r(g, 12, 10, 3, 1, '#c8a05a')
  r(g, 14, 7, 1, 3, '#c8a05a')
  r(g, 13, 6, 2, 1, '#e0c080')
  // 前爪
  r(g, 5, 13, 2, 1, '#e0c080')
  r(g, 9, 13, 2, 1, '#e0c080')
  // 影子
  r(g, 3, 14, 10, 1, '#8a6438')
  return c
}

/** 骨头：两端骨节粗、中间骨干细的一截月兽遗骨 */
function bone(): Sprite {
  const { c, g } = canvas(16, 16)
  // 骨干
  r(g, 4, 9, 8, 2, C.bone)
  r(g, 4, 9, 8, 1, C.sugar)
  r(g, 4, 10, 8, 1, C.pale)
  // 左端骨节
  r(g, 2, 7, 3, 3, C.bone)
  r(g, 2, 7, 3, 1, C.sugar)
  px(g, 1, 8, C.bone)
  px(g, 2, 10, C.pale)
  // 右端骨节
  r(g, 11, 8, 3, 3, C.bone)
  r(g, 11, 8, 3, 1, C.sugar)
  px(g, 14, 9, C.bone)
  px(g, 12, 11, C.pale)
  // 骨缝
  px(g, 6, 9, C.pale)
  px(g, 9, 9, C.pale)
  return c
}

/** 画架：16×32，木架上一张空白画布 */
function easel(): Sprite {
  const { c, g } = canvas(16, 32)
  // 支腿
  r(g, 7, 10, 1, 22, '#5c4630')
  r(g, 2, 26, 2, 6, '#3f2f1c')
  r(g, 12, 26, 2, 6, '#241a10')
  r(g, 2, 26, 1, 6, '#5c4630')
  // 画布框
  r(g, 1, 3, 14, 13, '#3f2f1c')
  r(g, 1, 3, 14, 1, '#77603f')
  r(g, 1, 3, 1, 13, '#77603f')
  r(g, 14, 3, 1, 13, '#241a10')
  r(g, 1, 15, 14, 1, '#241a10')
  // 画布
  r(g, 2, 4, 12, 11, C.bone)
  r(g, 2, 4, 12, 1, C.sugar)
  r(g, 13, 4, 1, 11, C.pale)
  // 未完成的草图
  r(g, 5, 8, 6, 1, C.pale)
  r(g, 6, 9, 4, 1, C.pale)
  r(g, 7, 10, 2, 2, C.pale)
  // 托架
  r(g, 1, 16, 14, 1, '#77603f')
  return c
}

// ============================================================
// 立绘（48×48）：1:1 方形头像，只画到头与肩。
// 骨架（所有角色共用，切换时头、颈、肩的行号不动）：
//   发顶 y0 → 头骨 y5..y31 → 颈 y32..y35 → 肩 y36..y47
// 头（发顶到下巴）32 行 = 67%，颈 4 行，肩 12 行 —— 胸口以下不画；
// 头骨仍是 14 宽（横向与 48×64 时一致，只把脸纵向拉长、五官放大）。
// 三阶明暗、左上光源、背景透明。
// ============================================================

interface PortraitPal {
  skin: string
  skinHi: string
  skinShade: string
  hair: string
  hairHi: string
  hairDark: string
  eye: string
  eyeHi: string
  /** 虹膜下半，比 eye 深一档；不填则与 eye 同色 */
  eyeDark?: string
  lip: string
  coat: string
  coatHi: string
  coatDark: string
  collar: string
  hairStyle: 'wavy' | 'bun' | 'ringlet' | 'slick' | 'kerchief'
  mood: 'calm' | 'cold' | 'quiet' | 'smile' | 'grin'
  /** 领结（赫尔曼的银灰领结） */
  bow?: string
  /** 围裙（艾玛 / 玛尔塔） */
  apron?: string
  /** 头巾（玛尔塔） */
  kerchief?: string
  /** 领口的小饰物（艾玛的铜结） */
  pin?: string
  /** 虹膜两侧各留 1px 眼白（少女的眼睛要有神；男性角色不要，会读成眼镜） */
  eyeWhite?: boolean
  /** 两眼之间的空隙：艾玛 3px（显年轻），默认 2px */
  eyeGap?: number
  /** 嘴角外端抬 1px（艾玛的"0.5px 上扬"；只抬不压） */
  softMouth?: boolean
}

/** 立绘画布：1:1，RPG Maker 系头像比例 */
const PW = 48
const PH = 48

/** 骨架行号（所有立绘共用；并排时头、颈、肩不会一高一低） */
const SKULL_TOP = 10       // 发际线：以上 10 行是头发/帽子，以下是脸
const NECK_TOP = 32        // 颈：y32 下颌阴影，y33..y35 颈干
const SHOULDER_TOP = 36    // 肩从 y36 展开到 y47（被画布底边裁断，到上臂为止）
const BROW_Y = 16          // 眉（与眼睑之间留 1 行空隙，贴着会凶）
const EYE_TOP = 18         // 上眼睑：一道 3px 横线
const IRIS_Y = 19          // 虹膜：只占中间 1px，左右各 1px 眼白
const NOSE_Y = 23          // 鼻梁 + 鼻头 = 2 行（1 行平、3 行长）
const MOUTH_Y = 27         // 嘴

/**
 * 头骨行宽：22 行（y10..y31），16 宽保持 9 行，之后从颧骨开始逐段收窄 ——
 * 16 → 15 → 14 → 13 → 11 是连续的锥形（瓜子脸）；
 * 窄脸（14）在 22 行的长度上仍然读作"瘦长"，所以整条线都放到了 16。
 */
const SKULL_14: number[] = [
  12, 14,                                    // y10..y11 额头的窄顶（被刘海压住）
  16, 16, 16, 16, 16, 16, 16, 16, 16,        // y12..y20 颧骨：最宽的一段
  15, 15, 15,                                // y21..y23
  14, 14, 14,                                // y24..y26 下颌
  13, 13, 13,                                // y27..y29
  11, 11,                                    // y30..y31 下巴（末端略平）
]

/** 弗里德里希：最宽 16、下颌 14、方下巴 11（不收成一个尖） */
const FTZ_HEAD: number[] = [
  12, 14,
  16, 16, 16, 16, 16, 16, 16, 16, 16,
  15, 15, 15,
  14, 14, 14,
  13, 13, 13,
  11, 11,
]

/** 艾玛：最宽 18、下颌 15、下巴 12 —— 比男角各宽 2px，脸才圆 */
const EMMA_HEAD: number[] = [
  13, 15,
  18, 18, 18, 18, 18, 18, 18, 18, 18,
  17, 17, 17,
  15, 15, 15,
  14, 14, 14,
  12, 12,
]

/**
 * 她的头骨行宽：与艾玛同一组行号（鹅蛋脸，最宽 18、下颌 15、下巴 12）。
 * 抄一份而不是引用 —— 以后改艾玛的脸不会连带改掉她。
 */
const DS_HEAD: number[] = [
  13, 15,
  18, 18, 18, 18, 18, 18, 18, 18, 18,
  17, 17, 17,
  15, 15, 15,
  14, 14, 14,
  12, 12,
]

/** 头骨的左缘：偶数宽在 23.5 轴上对称，奇数宽宁可偏左半像素（受光侧） */
function skullLeft(w: number): number {
  return 24 - ((w + 1) >> 1)
}

/** 五官的横向布局：眼宽 3px，两眼之间留 eyeGap（默认 2 / 艾玛 3） */
function eyeLayout(p: PortraitPal): { ex0: number; ex1: number } {
  const gap = p.eyeGap ?? 2
  const ex0 = Math.floor(24 - (6 + gap) / 2)
  return { ex0, ex1: ex0 + 3 + gap }
}

type Mood = PortraitPal['mood']

/**
 * 肩与躯干：y36 的 22 宽展开到 y47 的 36 宽，底边裁断 —— 只有肩，没有胸。
 * 肩要够宽，否则 22 行的脸配一副窄肩，整个人还是"细长"。
 */
function portraitBody(g: Ctx, p: PortraitPal): void {
  for (let y = SHOULDER_TOP; y < PH; y++) {
    const t = (y - SHOULDER_TOP) / (PH - SHOULDER_TOP)
    const hw = Math.round(11 + t * 7)
    r(g, 24 - hw, y, hw * 2, 1, p.coat)
    r(g, 24 - hw, y, 2, 1, p.coatHi)
    r(g, 24 + hw - 2, y, 2, 1, p.coatDark)
  }
  r(g, 13, SHOULDER_TOP, 22, 1, p.coatHi)      // 肩线受光
}

/** 颈：下颌一道宽阴影 + 4 行颈干（大半会被领子吃掉） */
function portraitNeck(g: Ctx, p: PortraitPal): void {
  r(g, 20, NECK_TOP, 8, 1, p.skinShade)        // 下颌投在颈上的阴影
  r(g, 21, NECK_TOP + 1, 6, 3, p.skinShade)    // 颈干 y33..y35
  r(g, 21, NECK_TOP + 1, 3, 3, p.skin)         // 颈前受光柱
  px(g, 21, NECK_TOP + 1, p.skinHi)
}

/**
 * 头骨 + 耳：逐行给宽度，22 行（y10..y31）。
 * 左缘 1px 受光；颧骨以下右缘内侧 1px 是一道竖高光（脸颊饱满）。
 * 两侧都不许出现竖暗部 —— 那是"显老"的第二元凶，脸会读成两颊凹陷。
 */
function portraitSkull(g: Ctx, p: PortraitPal, rows: number[]): void {
  for (let i = 0; i < rows.length; i++) {
    const w = rows[i]
    const y = SKULL_TOP + i
    const x0 = skullLeft(w)
    r(g, x0, y, w, 1, p.skin)
    px(g, x0, y, p.skinHi)                     // 左缘受光
    if (y >= 19) px(g, x0 + w - 2, y, p.skinHi) // 颧骨到下颌：脸颊高光 1px
  }
  // 下巴底面：只压最后一行中间的两三个像素，末端收住但不成为尖
  const lastW = rows[rows.length - 1]
  r(g, skullLeft(lastW) + 3, SKULL_TOP + rows.length - 1, lastW - 6, 1, p.skinShade)
  // 耳：被鬓发压住大半，只在眼到鼻之间露 5 行
  const maxW = Math.max(...rows)
  const fx0 = skullLeft(maxW)
  r(g, fx0 - 2, 19, 2, 5, p.skin)
  px(g, fx0 - 2, 19, p.skinHi)
  r(g, fx0 + maxW, 19, 2, 5, p.skin)
  px(g, fx0 + maxW + 1, 23, p.skinShade)
}

/** 眉：y17 一道 4px 横线，外端抬 1px；cold 时笔直（"冷"靠眉，不靠眼下暗部） */
function portraitBrows(g: Ctx, p: PortraitPal, mood: Mood): void {
  const { ex0, ex1 } = eyeLayout(p)
  const lx = ex0 - 1
  const rx = ex1                                // 右眉起笔：与右眼左端齐平
  for (const x of [lx, rx]) r(g, x, BROW_Y, 4, 1, p.hairDark)
  if (mood !== 'cold') {
    px(g, lx, BROW_Y - 1, p.hairDark)           // 眉梢上挑一像素
    px(g, rx + 3, BROW_Y - 1, p.hairDark)
  }
}

/**
 * 3px 的眼睛：上眼睑一道横线 + 1px 虹膜行。
 * 虹膜只占中间 1px、左右各 1px 眼白 —— 眼白一多就成了"大眼娃娃"。
 * 下眼睑整行省略：眼下不许有任何暗部（会立刻老十岁）。
 * lidded（cold / quiet）只让中间那 1px 虹膜半露，别的一概不动。
 */
function portraitEyes(g: Ctx, p: PortraitPal, mood: Mood): void {
  const eyeDark = p.eyeDark ?? p.eye
  const white = p.eyeWhite ? C.bone : p.skinHi
  const lidded = mood === 'cold' || mood === 'quiet'
  const { ex0, ex1 } = eyeLayout(p)
  for (const ex of [ex0, ex1]) {
    if (mood === 'smile' || mood === 'grin') {
      // 笑眼：中间 1px 高、两端 1px 低的小月牙
      px(g, ex + 1, EYE_TOP, eyeDark)
      px(g, ex, IRIS_Y, eyeDark)
      px(g, ex + 2, IRIS_Y, eyeDark)
      continue
    }
    r(g, ex, EYE_TOP, 3, 1, eyeDark)           // 上眼睑：一道 3px 横线
    if (lidded) {
      px(g, ex + 1, IRIS_Y, p.eye)             // 眼皮压下来，只露一条缝
    } else {
      px(g, ex, IRIS_Y, white)                 // 外眼角 1px 眼白
      px(g, ex + 1, IRIS_Y, p.eye)             // 虹膜：只占中间 1px
      px(g, ex + 2, IRIS_Y, white)             // 内眼角 1px 眼白
    }
  }
}

/** 鼻：2 行 —— y23 鼻梁（一明一暗）、y24 鼻头 3px 宽 */
function portraitNose(g: Ctx, p: PortraitPal): void {
  r(g, 23, NOSE_Y, 1, 1, p.skinHi)
  r(g, 24, NOSE_Y, 1, 1, p.skinShade)
  r(g, 22, NOSE_Y + 1, 3, 1, p.skinShade)
}

/**
 * 嘴：y27 一道 6px 平直唇线。
 * 嘴角只汇聚、不下压（下压是"显老"的第三元凶）；
 * smile / softMouth 让最外端抬 1px —— 艾玛的"0.5px 上扬"落地成这一像素。
 */
function portraitMouth(g: Ctx, p: PortraitPal, mood: Mood): void {
  const x0 = 21
  if (mood === 'grin') {
    r(g, x0, MOUTH_Y, 6, 2, '#3a2024')
    r(g, x0 + 1, MOUTH_Y, 4, 1, C.bone)          // 牙
    px(g, x0 - 1, MOUTH_Y, p.lip)
    px(g, x0 + 6, MOUTH_Y, p.lip)
    return
  }
  if (mood === 'cold') {
    r(g, x0, MOUTH_Y, 6, 1, p.skinShade)         // 只去掉唇色，形状仍然平直
    return
  }
  r(g, x0, MOUTH_Y, 6, 1, p.lip)
  px(g, x0 - 1, MOUTH_Y, p.skinShade)            // 嘴角收敛（只收，不下压）
  px(g, x0 + 6, MOUTH_Y, p.skinShade)
  if (mood === 'smile' || p.softMouth) {
    px(g, x0 - 1, MOUTH_Y - 1, p.lip)            // 外端抬 1px（不是下压）
    px(g, x0 + 6, MOUTH_Y - 1, p.lip)
  }
}

/**
 * 弗里德里希：明亮深红发 + 前额一绺上翻的刘海 + 深蓝细长眼 +
 * 深黑高领制服、银灰立领边、胸前 V 形银饰、肩章银线。
 * 48×48 里 V 的下半截会被画布底边裁掉，所以起笔就是两道向内收的银线。
 */
function portraitHero(p: PortraitPal): Sprite {
  const { c, g } = canvas(PW, PH)
  const mood = p.mood
  /** 48 宽的轴在 23.5：左右严格镜像 */
  const both = (x: number, y: number, w: number, h: number, col: string): void => {
    r(g, x, y, w, h, col)
    r(g, 48 - x - w, y, w, h, col)
  }

  portraitBody(g, p)
  portraitNeck(g, p)
  portraitSkull(g, p, FTZ_HEAD)

  // ---- 头发：蓬松的体量比头骨宽 8px（x13..34），y0 起逐层加宽 ----
  r(g, 22, 0, 5, 1, p.hair)
  r(g, 20, 1, 9, 1, p.hair)
  r(g, 18, 2, 13, 1, p.hair)
  r(g, 16, 3, 17, 1, p.hair)
  r(g, 14, 4, 21, 1, p.hair)
  r(g, 13, 5, 22, 1, p.hair)
  r(g, 13, 6, 22, 1, p.hair)
  r(g, 13, 7, 22, 1, p.hair)
  r(g, 13, 8, 22, 1, p.hair)
  r(g, 13, 9, 22, 1, p.hair)                   // y9：发际线的上沿
  // 左上轮廓内侧的受光带
  r(g, 22, 0, 3, 1, p.hairHi)
  r(g, 20, 1, 4, 1, p.hairHi)
  r(g, 16, 3, 2, 1, p.hairHi)
  r(g, 14, 4, 2, 1, p.hairHi)
  r(g, 13, 5, 2, 1, p.hairHi)
  r(g, 13, 6, 2, 1, p.hairHi)
  r(g, 13, 7, 2, 1, p.hairHi)
  r(g, 13, 8, 2, 1, p.hairHi)
  r(g, 13, 9, 2, 1, p.hairHi)
  // 右下背光
  r(g, 29, 2, 2, 1, p.hairDark)
  r(g, 31, 3, 2, 1, p.hairDark)
  r(g, 32, 4, 3, 1, p.hairDark)
  r(g, 32, 5, 3, 1, p.hairDark)
  r(g, 32, 6, 3, 1, p.hairDark)
  r(g, 32, 7, 3, 1, p.hairDark)
  r(g, 32, 8, 3, 1, p.hairDark)
  r(g, 32, 9, 3, 1, p.hairDark)

  // ---- 前额那一绺向上翻卷的刘海（参考图的核心特征）----
  r(g, 22, 1, 5, 1, p.hairHi)                  // 弧顶
  r(g, 20, 2, 4, 1, p.hairHi)                  // 左侧
  r(g, 25, 2, 4, 1, p.hairHi)                  // 右侧
  r(g, 19, 3, 3, 1, p.hairHi)                  // 左端落下
  r(g, 27, 3, 3, 1, p.hairHi)                  // 右端落下
  r(g, 22, 2, 4, 1, p.hair)                    // 弧心是背光的
  r(g, 19, 4, 3, 1, p.hairDark)                // 弧下的阴影
  r(g, 26, 4, 4, 1, p.hairDark)
  r(g, 21, 5, 8, 1, p.hairDark)
  r(g, 22, 6, 6, 1, p.hair)

  // ---- 发际线：y10..y11 只压住头骨的两侧窄顶，y12 起额头全宽露出，
  //      此后只剩贴脸的鬓角。左侧多垂一绺盖住左额，右侧只留发角 ----
  r(g, 13, 10, 5, 1, p.hair)                   // x13..17
  r(g, 30, 10, 5, 1, p.hair)                   // x30..34
  r(g, 13, 11, 4, 1, p.hair)                   // x13..16
  r(g, 31, 11, 4, 1, p.hair)                   // x31..34
  r(g, 13, 12, 4, 1, p.hair)                   // x13..16（左绺垂到左额）
  r(g, 31, 12, 4, 1, p.hair)                   // x31..34
  r(g, 13, 13, 3, 1, p.hair)                   // x13..15
  r(g, 32, 13, 3, 1, p.hair)                   // x32..34
  r(g, 13, 14, 3, 1, p.hair)                   // x13..15（贴住脸的左缘 x16）
  r(g, 32, 14, 3, 1, p.hair)
  // 鬓角末端外翻打一个卷（不到下颌，别画成女式长发）
  r(g, 12, 15, 4, 1, p.hair)                   // x12..15 外翻鼓出
  r(g, 32, 15, 4, 1, p.hair)                   // x32..35
  r(g, 13, 16, 3, 1, p.hair)                   // 收成发梢
  r(g, 32, 16, 3, 1, p.hair)
  px(g, 14, 17, p.hair)                        // 卷尾
  px(g, 33, 17, p.hair)
  // 发丝：外缘受光 / 背光，内缘压暗一档
  r(g, 13, 5, 1, 9, p.hairHi)
  r(g, 34, 5, 1, 9, p.hairDark)
  r(g, 12, 15, 1, 1, p.hairHi)
  r(g, 35, 15, 1, 1, p.hairDark)
  r(g, 15, 13, 1, 4, p.hairDark)               // 贴脸处压暗，头发与皮肤分得开
  r(g, 32, 13, 1, 4, p.hairDark)

  portraitBrows(g, p, mood)
  portraitEyes(g, p, mood)
  portraitNose(g, p)
  portraitMouth(g, p, mood)

  // ================= 深黑高领制服：银领边 + V 形银饰 =================
  // ---- 立领：银灰包边，领口一直立到下颌 ----
  r(g, 19, 36, 10, 1, SILVER.mid)              // 领口上缘 x19..28
  r(g, 19, 36, 4, 1, SILVER.hi)                // 左上受光段
  r(g, 26, 36, 3, 1, SILVER.lo)                // 右下背光段
  r(g, 19, 37, 1, 1, SILVER.lo)                // 左立边
  r(g, 28, 37, 1, 1, SILVER.lo)                // 右立边
  r(g, 20, 37, 8, 1, '#12161d')                // 领内（脖子被完全包住）
  r(g, 20, 37, 1, 1, p.coatHi)
  px(g, 18, 38, SILVER.lo)                     // 领子向下张开、接上肩
  px(g, 29, 38, SILVER.lo)

  // ---- 胸前的 V 形银饰：y38 从双肩内侧起，到画布底边收到中央 ----
  // 下半截会被方画布裁掉，所以起笔就是两道"向内收"的银线。
  const vTop = 38
  const vBot = 47
  const span = vBot - vTop
  for (let i = 0; i <= span; i++) {
    const y = vTop + i
    const xl = 19 + Math.round((i * 4) / span)  // 19 → 23
    const xr = 47 - xl                          // 28 → 24
    if (xr - xl > 1) r(g, xl + 1, y, xr - xl - 1, 1, '#2e3542')
    px(g, xl, y, SILVER.hi)                     // 左斜线（受光侧更亮）
    px(g, xr, y, SILVER.mid)                    // 右斜线
  }

  // ---- 肩章：肩头一道银线 ----
  r(g, 13, 37, 5, 1, SILVER.hi)
  r(g, 30, 37, 5, 1, SILVER.mid)

  // ---- 肩线与袖子：一道斜下的明暗缝，黑制服才有结构而不是一块黑板 ----
  for (let i = 0; i < 4; i++) {
    px(g, 12 + i, 39 + i, p.coatHi)
    px(g, 35 - i, 39 + i, p.coatDark)
  }
  r(g, 14, 43, 1, 5, p.coatHi)
  r(g, 33, 43, 1, 5, p.coatDark)

  return c
}

/**
 * 艾玛：银紫中长微卷发 + 紫蓝眼 + 眼下略暗 +
 * 白色蕾丝女仆帽（波浪檐）、深蓝紫衣身、领口绿蝴蝶结、白围裙肩带。
 */
function portraitEmma(p: PortraitPal): Sprite {
  const { c, g } = canvas(PW, PH)
  const mood = p.mood
  const white = C.sugar
  const wmid = C.bone
  const wsh = C.pale
  const both = (x: number, y: number, w: number, h: number, col: string): void => {
    r(g, x, y, w, h, col)
    r(g, 48 - x - w, y, w, h, col)
  }

  portraitBody(g, p)
  portraitNeck(g, p)
  portraitSkull(g, p, EMMA_HEAD)

  // ---- 头发：银紫、中长、有层次的微卷（不是纯白）----
  // 帽檐压到 y5，头顶从 y5 接上 —— 齿缝里不能露出画布底色
  r(g, 14, 5, 20, 1, p.hair)                   // y5 x14..33
  r(g, 14, 6, 20, 1, p.hair)
  r(g, 14, 7, 20, 1, p.hair)
  r(g, 14, 8, 20, 1, p.hair)
  r(g, 14, 9, 20, 1, p.hair)                   // y9：发际线上沿
  // 中分刘海：从额心向两侧张开 —— 每一行少盖 1px，额头才不被吃掉
  r(g, 14, 10, 6, 1, p.hair)                   // x14..19（额心 x20..26 露 7px）
  r(g, 27, 10, 6, 1, p.hair)                   // x27..32
  r(g, 14, 11, 5, 1, p.hair)                   // x14..18
  r(g, 28, 11, 5, 1, p.hair)                   // x28..32
  r(g, 14, 12, 4, 1, p.hair)                   // x14..17
  r(g, 29, 12, 4, 1, p.hair)                   // x29..32
  r(g, 14, 13, 3, 1, p.hair)                   // x14..16
  r(g, 30, 13, 3, 1, p.hair)                   // x30..32
  r(g, 14, 14, 2, 1, p.hair)                   // x14..15（贴住脸的左缘 x15）
  r(g, 31, 14, 2, 1, p.hair)
  px(g, 14, 15, p.hair)                        // 鬓角收尾
  px(g, 32, 15, p.hair)
  // 层次：左亮右暗 + 几道发丝
  r(g, 14, 5, 3, 1, p.hairHi)
  r(g, 31, 5, 2, 1, p.hairDark)
  r(g, 14, 6, 2, 1, p.hairHi)
  r(g, 32, 6, 1, 1, p.hairDark)
  px(g, 21, 9, p.hairDark)
  px(g, 26, 9, p.hairDark)
  px(g, 19, 10, p.hairHi)
  px(g, 28, 10, p.hairDark)
  px(g, 18, 12, p.hairDark)

  portraitBrows(g, p, mood)
  portraitEyes(g, p, mood)
  // 眼下不再压任何暗线 —— 那是"显老"的第一元凶
  portraitNose(g, p)
  portraitMouth(g, p, mood)

  // ================= 深蓝紫衣身 + 白领 + 绿领结 + 围裙肩带 =================
  // ---- 白衬衫领（彼得潘小圆领）----
  r(g, 19, 36, 10, 2, white)                   // y36..y37
  r(g, 19, 36, 3, 2, white)
  px(g, 19, 36, C.sugar)
  r(g, 27, 36, 2, 2, wmid)
  r(g, 19, 38, 10, 1, wsh)                     // 领下缘的阴影

  // ---- 绿蝴蝶结：两翼 + 结心 + 两条垂下的短尾（比白领宽 2px，翼露在领外）----
  r(g, 17, 38, 4, 2, BOW_G.mid)                // 左翼 x17..20
  r(g, 27, 38, 4, 2, BOW_G.mid)                // 右翼 x27..30
  r(g, 17, 38, 1, 2, BOW_G.hi)
  r(g, 30, 38, 1, 2, BOW_G.lo)
  r(g, 22, 38, 4, 2, BOW_G.hi)                 // 结心（最亮）
  px(g, 22, 38, BOW_G.hi)
  r(g, 21, 40, 1, 3, BOW_G.mid)                // 左短尾
  r(g, 26, 40, 1, 3, BOW_G.lo)                 // 右短尾

  // ---- 白围裙：只露两条肩带（胸口以下不画）----
  r(g, 16, 41, 2, 7, white)                    // 左肩带 x16..17
  r(g, 30, 41, 2, 7, white)                    // 右肩带 x30..31
  r(g, 16, 41, 1, 7, C.sugar)
  r(g, 31, 41, 1, 7, wmid)

  // ---- 两侧的长鬓发：三卷，从上往下变小（压在衣服之上）----
  // 宽度逐行写死（顶窄 → 中段鼓出 → 底再收）；内缘跟着脸走 ——
  // 脸越往下越窄，发卷若不跟着收，脸侧会露出一条透明缝。
  const curls: [number, number, number[]][] = [
    [10, 10, [4, 5, 6, 6, 6, 6, 6, 5, 5, 4]],   // 卷1 y10..y19，最宽 6px
    [21, 8, [4, 5, 5, 5, 5, 5, 4, 4]],           // 卷2 y21..y28
    [30, 7, [3, 4, 4, 4, 4, 3, 3]],              // 卷3 y30..y36
  ]
  const innerAt = (y: number): number => {
    const i = Math.min(EMMA_HEAD.length - 1, Math.max(0, y - SKULL_TOP))
    return skullLeft(EMMA_HEAD[i]) - 1
  }
  for (const [y0, h, ws] of curls) {
    const wMax = Math.max(...ws)
    for (let i = 0; i < h; i++) {
      const y = y0 + i
      const inner = innerAt(y)
      const w = ws[i]
      const xo = inner + 1 - w
      both(xo, y, w, 1, p.hair)
      both(xo, y, 1, 1, p.hairHi)                          // 外缘受光
      if (w >= 2) both(inner, y, 1, 1, p.hairDark)         // 内缘压暗
    }
    const yEnd = y0 + h - 1
    const xoMax = innerAt(yEnd) + 1 - wMax
    both(xoMax + 2, yEnd, wMax - 2, 1, p.hairDark)         // 卷尾收口
    both(xoMax + 1, yEnd - 1, 1, 1, p.hairHi)              // 外翻的弧
  }
  // 发梢：从最小的一卷垂到肩上（压在衣领外侧）
  both(14, 37, 3, 3, p.hair)                   // x14..16 y37..y39
  both(14, 37, 1, 3, p.hairHi)
  both(16, 37, 1, 3, p.hairDark)
  both(15, 40, 2, 2, p.hair)
  both(15, 40, 1, 2, p.hairHi)
  both(15, 42, 1, 2, p.hair)

  // ---- 白色蕾丝女仆帽（最后压上去）：帽檐波浪，两侧各一簇蕾丝 ----
  // 帽子是艾玛最醒目的识别点：帽檐到 x12..35（24px，比 18px 的头骨宽 6px），
  // 波浪檐再加一条投影压在头发上 —— 白头巾与银紫发才不会糊成一片浅色。
  const cap = C.sugar
  const capMid = C.bone
  r(g, 21, 0, 6, 1, cap)                       // 帽冠 x21..26
  r(g, 18, 1, 12, 1, cap)                      // x18..29
  r(g, 16, 2, 16, 1, cap)                      // x16..31
  r(g, 14, 3, 20, 1, cap)                      // x14..33
  r(g, 12, 4, 24, 1, cap)                      // 帽檐最宽 x12..35
  for (let x = 11; x < 37; x += 3) r(g, x, 5, 2, 1, cap)   // y5 波浪下缘（密齿）
  for (let x = 15; x < 35; x += 2) px(g, x, 6, p.hairDark) // 帽檐投在头发上的影子
  // 三阶明暗：左上近白、右下带灰
  r(g, 21, 0, 4, 1, C.sugar)
  r(g, 25, 0, 2, 1, capMid)
  r(g, 18, 1, 5, 1, C.sugar)
  r(g, 26, 1, 4, 1, capMid)
  r(g, 16, 2, 5, 1, C.sugar)
  r(g, 27, 2, 5, 1, capMid)
  r(g, 14, 3, 6, 1, C.sugar)
  r(g, 29, 3, 5, 1, capMid)
  r(g, 12, 4, 7, 1, C.sugar)
  r(g, 30, 4, 6, 1, capMid)
  // 帽檐两侧的蕾丝小簇（参考图侧面那一小簇）
  r(g, 10, 4, 2, 4, cap)                       // 左侧垂下的蕾丝串
  px(g, 11, 8, capMid)
  r(g, 36, 4, 2, 4, capMid)                    // 右侧（背光，灰一档）
  px(g, 37, 8, capMid)

  return c
}

/**
 * 通用立绘（赫尔曼 / 玛尔塔）。
 * 与两位主角共用同一套骨架：头骨 y5..y31、颈 y32..y35、肩从 y36 展开。
 */
function portrait(p: PortraitPal): Sprite {
  const { c, g } = canvas(PW, PH)
  const mood = p.mood

  portraitBody(g, p)
  portraitNeck(g, p)
  portraitSkull(g, p, SKULL_14)

  // ---- 头发（顶部 y0..y9，发际线以下才是脸）----
  if (p.hairStyle === 'wavy') {
    // 顶部逐层加宽（比头骨宽一圈）
    r(g, 21, 0, 6, 1, p.hair)
    r(g, 19, 1, 10, 1, p.hair)
    r(g, 17, 2, 14, 1, p.hair)
    r(g, 15, 3, 18, 1, p.hair)
    r(g, 13, 4, 22, 1, p.hair)
    r(g, 13, 5, 22, 1, p.hair)
    r(g, 13, 6, 22, 1, p.hair)
    r(g, 13, 7, 22, 1, p.hair)
    r(g, 13, 8, 22, 1, p.hair)
    r(g, 13, 9, 22, 1, p.hair)
    r(g, 21, 0, 3, 1, p.hairHi)
    r(g, 19, 1, 3, 1, p.hairHi)
    r(g, 17, 2, 3, 1, p.hairHi)
    r(g, 15, 3, 2, 1, p.hairHi)
    r(g, 13, 4, 2, 1, p.hairHi)
    r(g, 29, 1, 2, 1, p.hairDark)
    r(g, 31, 2, 2, 1, p.hairDark)
    r(g, 32, 3, 3, 1, p.hairDark)
    r(g, 33, 4, 2, 1, p.hairDark)
    // 中分刘海：y10 先压满一整行，y11 起额心才露出来
    r(g, 13, 10, 22, 1, p.hair)
    r(g, 13, 11, 9, 1, p.hair)                 // x13..21
    r(g, 26, 11, 9, 1, p.hair)                 // x26..34
    r(g, 13, 12, 4, 1, p.hair)                 // x13..16
    r(g, 31, 12, 4, 1, p.hair)
    r(g, 14, 13, 3, 1, p.hair)                 // x14..16
    r(g, 31, 13, 3, 1, p.hair)
    // 鬓发
    r(g, 13, 11, 4, 8, p.hair)                 // y11..y18
    r(g, 31, 11, 4, 8, p.hair)
    r(g, 13, 11, 1, 8, p.hairHi)
    r(g, 34, 11, 1, 8, p.hairDark)
  } else if (p.hairStyle === 'slick') {
    // 后梳：发际线高、露出额头。顶部只比头骨宽 6px ——
    // 22px 的大方块会把他的头读成一个"桶"，剪影贴着 14px 的头骨才像人的后脑。
    r(g, 18, 1, 12, 1, p.hair)                 // y1 x18..29
    r(g, 16, 2, 16, 1, p.hair)                 // y2 x16..31
    r(g, 15, 3, 18, 1, p.hair)                 // y3 x15..32
    r(g, 14, 4, 20, 1, p.hair)                 // y4 x14..33
    r(g, 14, 5, 20, 1, p.hair)                 // y5
    r(g, 14, 6, 20, 1, p.hair)
    r(g, 14, 7, 20, 1, p.hair)
    r(g, 14, 8, 20, 1, p.hair)
    r(g, 14, 9, 20, 1, p.hair)                 // y9 发际线
    // 受光 / 背光
    r(g, 18, 1, 5, 1, p.hairHi)
    r(g, 16, 2, 6, 1, p.hairHi)
    r(g, 15, 3, 5, 1, p.hairHi)
    r(g, 14, 4, 6, 1, p.hairHi)
    r(g, 28, 2, 3, 1, p.hairDark)
    r(g, 29, 3, 4, 1, p.hairDark)
    r(g, 30, 4, 3, 1, p.hairDark)
    // 向后梳的三道深痕
    r(g, 19, 2, 1, 6, p.hairDark)
    r(g, 23, 2, 1, 6, p.hairDark)
    r(g, 27, 2, 1, 6, p.hairDark)
    // 发际线：一条横过额头的暗线，后梳的高额头才立得住
    r(g, 17, 9, 14, 1, p.hairDark)
    // 鬓角：细、短，只到颧骨
    r(g, 15, 10, 3, 1, p.hair)                 // y10 补住头骨的窄顶
    r(g, 30, 10, 3, 1, p.hair)
    r(g, 14, 11, 2, 7, p.hair)                 // y11..y17
    r(g, 32, 11, 2, 7, p.hair)
    r(g, 14, 11, 1, 7, p.hairHi)
    r(g, 33, 11, 1, 7, p.hairDark)
  } else if (p.hairStyle === 'kerchief') {
    // 头巾：亚麻布包住头顶（圆顶，不是方盒），两侧垂到肩
    const kc = p.kerchief ?? C.sugar
    r(g, 16, 0, 16, 1, kc)                     // y0 圆顶
    r(g, 14, 1, 20, 1, kc)                     // y1
    r(g, 13, 2, 22, 1, kc)                     // y2 x13..34
    r(g, 12, 3, 24, 7, kc)                     // y3..y9 x12..35
    r(g, 12, 3, 1, 7, C.sugar)
    r(g, 34, 3, 1, 7, kc)
    r(g, 14, 1, 6, 1, C.sugar)                  // 布面的受光
    r(g, 16, 0, 5, 1, C.sugar)
    r(g, 30, 2, 4, 1, C.bone)                   // 右下压暗
    // 头巾下缘的一道暗线，布与额头分得开
    r(g, 17, 9, 14, 1, C.bone)
    // 额前垂下的一缕头发（头巾下缘压着）
    r(g, 15, 10, 3, 1, p.hair)                  // y10 补住头骨的窄顶
    r(g, 30, 10, 3, 1, p.hair)
    r(g, 15, 11, 2, 1, p.hair)                  // y11
    r(g, 31, 11, 2, 1, p.hair)
    r(g, 14, 12, 2, 6, p.hair)                  // y12..y17 鬓角
    r(g, 32, 12, 2, 6, p.hair)
    r(g, 14, 12, 1, 6, p.hairHi)
    r(g, 33, 12, 1, 6, p.hairDark)
    // 两侧垂到肩的布尾
    r(g, 11, 10, 3, 13, kc)                     // y10..y22 左
    r(g, 34, 10, 3, 13, kc)                     // 右
    r(g, 11, 10, 1, 13, C.sugar)
    r(g, 36, 10, 1, 13, kc)
    px(g, 13, 23, kc)
    px(g, 34, 23, kc)
  } else {
    // ringlet：小髻 + 齐额发 + 两侧的螺旋卷
    r(g, 22, 0, 4, 1, p.hair)
    r(g, 21, 1, 6, 1, p.hair)
    r(g, 21, 2, 6, 1, p.hair)
    r(g, 22, 3, 4, 1, p.hair)
    r(g, 22, 0, 2, 1, p.hairHi)
    r(g, 21, 1, 2, 1, p.hairHi)
    r(g, 25, 2, 2, 1, p.hairDark)
    r(g, 20, 4, 8, 1, p.hairDark)
    r(g, 18, 5, 12, 1, p.hair)
    r(g, 15, 6, 18, 1, p.hair)
    r(g, 15, 7, 18, 1, p.hair)
    r(g, 15, 8, 18, 1, p.hair)
    r(g, 15, 9, 18, 1, p.hair)
    r(g, 15, 10, 18, 1, p.hair)                 // y10 齐额（额头从 y11 起露出）
    r(g, 15, 6, 3, 4, p.hairHi)
    r(g, 30, 6, 3, 4, p.hairDark)
    r(g, 13, 11, 3, 10, p.hair)                 // 鬓发 y11..y20
    r(g, 32, 11, 3, 10, p.hair)
    r(g, 13, 11, 1, 10, p.hairHi)
    r(g, 34, 11, 1, 10, p.hairDark)
  }

  portraitBrows(g, p, mood)
  portraitEyes(g, p, mood)
  portraitNose(g, p)
  portraitMouth(g, p, mood)

  // ---- 衣领 / 配件 ----
  if (p.apron) {
    // 女仆装：白圆领 + 两条肩带（只露肩）
    r(g, 20, 36, 8, 4, p.collar)
    r(g, 20, 36, 8, 1, C.sugar)
    r(g, 20, 36, 1, 4, C.sugar)
    r(g, 27, 36, 1, 4, C.pale)
    r(g, 23, 39, 2, 2, p.pin ?? C.brass)       // 领口的小饰物
    px(g, 23, 39, C.gold)
    px(g, 24, 40, C.gold)
    r(g, 16, 40, 3, 8, p.apron)                // 左肩带
    r(g, 30, 40, 3, 8, p.apron)                // 右肩带
    r(g, 16, 40, 1, 8, C.sugar)
    r(g, 32, 40, 1, 8, C.pale)
  } else if (p.bow) {
    // 燕尾服 + 白衬衫 + 银灰领结：两翼各 5px、带受光与暗面，压在纯黑的燕尾服上才读得出
    r(g, 17, 36, 2, 4, p.coatHi)               // 燕尾服的立领（左）
    r(g, 31, 36, 2, 4, p.coatDark)             // 立领（右）
    r(g, 19, 36, 10, 3, p.collar)              // 白衬衫 y36..y38
    r(g, 19, 36, 10, 1, C.sugar)
    r(g, 19, 36, 1, 3, C.sugar)
    r(g, 28, 36, 1, 3, p.collar)
    r(g, 19, 38, 10, 1, C.pale)                // 领口下缘的阴影
    // 银灰领结：两翼 x16..20 / x27..31，结心 x21..25
    r(g, 16, 39, 5, 3, p.bow)
    r(g, 27, 39, 5, 3, p.bow)
    r(g, 16, 39, 5, 1, C.bone)                 // 翼的上缘受光
    r(g, 27, 39, 5, 1, C.bone)
    r(g, 16, 42, 5, 1, p.coatDark)             // 翼的下缘压暗
    r(g, 27, 42, 5, 1, p.coatDark)
    r(g, 21, 39, 5, 3, p.bow)                  // 结心
    r(g, 22, 39, 3, 1, C.bone)
    px(g, 22, 40, C.bone)
    px(g, 25, 41, p.coatDark)
    r(g, 23, 42, 2, 2, p.coatDark)             // 结心垂下的窄尾
    r(g, 12, 43, 6, 5, p.coatHi)               // 燕尾服的翻领
    r(g, 30, 43, 6, 5, p.coatDark)
  } else if (p.kerchief) {
    // 玛尔塔：围裙 + 领巾
    r(g, 17, 36, 14, 4, p.collar)
    r(g, 17, 36, 14, 1, C.sugar)
    r(g, 15, 40, 18, 8, p.apron ?? p.collar)
    r(g, 15, 40, 18, 1, C.sugar)
    r(g, 15, 40, 1, 8, C.sugar)
    r(g, 32, 40, 1, 8, C.pale)
    r(g, 20, 39, 8, 3, p.kerchief ?? C.bone)   // 领巾结
    r(g, 21, 39, 6, 1, C.sugar)
  } else {
    // 默认：深色高领 + 银灰领口 + 铜扣
    r(g, 18, 36, 12, 5, p.coat)
    r(g, 19, 36, 10, 1, p.collar)
    r(g, 21, 37, 6, 1, p.collar)
    r(g, 18, 36, 1, 5, p.coatHi)
    r(g, 29, 36, 1, 5, p.coatDark)
    r(g, 16, 41, 4, 7, p.coatHi)
    r(g, 28, 41, 4, 7, p.coatDark)
    r(g, 23, 41, 2, 7, p.coatDark)
    r(g, 23, 43, 2, 1, C.brass)
  }

  return c
}

/**
 * 彩蛋角色立绘：白色大荷叶边女仆帽、蓝紫长发（垂到肩下）、
 * 领口蓝色大蝴蝶结、白围裙肩带、微笑。
 * 骨架与弗里德里希 / 艾玛完全相同：头发 y0..y9、脸 y10..y31、颈 y32..y35、肩从 y36 展开，
 * 五官行号同一套（眉 17 / 眼睑 18 / 虹膜 19 / 鼻 23..24 / 嘴 27）。
 */
function portraitCameo(p: PortraitPal): Sprite {
  const { c, g } = canvas(PW, PH)
  const mood = p.mood
  const lace = LACE.mid
  const both = (x: number, y: number, w: number, h: number, col: string): void => {
    r(g, x, y, w, h, col)
    r(g, 48 - x - w, y, w, h, col)
  }

  portraitBody(g, p)                           // 深蓝衣身（与其它立绘同一个肩梯形）
  portraitNeck(g, p)
  portraitSkull(g, p, DS_HEAD)                 // 头骨 y10..y31

  // ---- 头发：头顶与中分刘海（帽子最后压在上面）----
  r(g, 14, 4, 20, 1, p.hair)                   // 帽檐下露出的一层 x14..33
  r(g, 14, 5, 20, 1, p.hair)
  r(g, 14, 6, 20, 1, p.hair)
  r(g, 14, 7, 20, 1, p.hair)
  r(g, 14, 8, 20, 1, p.hair)
  r(g, 14, 9, 20, 1, p.hair)                   // y9：发际线上沿
  // 中分刘海：从额心向两侧张开
  r(g, 14, 10, 6, 1, p.hair)                   // x14..19（额心 x20..26 露 7px）
  r(g, 27, 10, 6, 1, p.hair)                   // x27..32
  r(g, 14, 11, 5, 1, p.hair)                   // x14..18
  r(g, 28, 11, 5, 1, p.hair)
  r(g, 14, 12, 4, 1, p.hair)                   // x14..17
  r(g, 29, 12, 4, 1, p.hair)
  r(g, 14, 13, 3, 1, p.hair)                   // x14..16（不碰眉）
  r(g, 30, 13, 3, 1, p.hair)
  // 刘海的层次：左上受光、右下背光，中缝边上有碎发
  r(g, 14, 5, 5, 2, p.hairHi)
  r(g, 30, 5, 4, 2, p.hairDark)
  r(g, 15, 7, 3, 1, p.hairHi)
  r(g, 30, 7, 3, 1, p.hairDark)
  r(g, 15, 9, 2, 1, p.hairHi)
  r(g, 31, 9, 2, 1, p.hairDark)
  px(g, 21, 10, p.hairDark)
  px(g, 26, 10, p.hairDark)
  px(g, 19, 11, p.hairDark)
  px(g, 27, 11, p.hairHi)

  portraitBrows(g, p, mood)
  portraitEyes(g, p, mood)                     // 眼白两侧各 1px，虹膜中间一个高光点
  portraitNose(g, p)                           // 与艾玛同样的短鼻
  portraitMouth(g, p, mood)                    // smile：嘴角抬一行

  // ================= 深蓝衣身 + 白蕾丝领 + 蓝大蝴蝶结 =================
  // ---- 白蕾丝小圆领 ----
  r(g, 19, 36, 10, 2, lace)
  r(g, 19, 36, 3, 2, LACE.hi)
  r(g, 27, 36, 2, 2, LACE.lo)
  r(g, 19, 38, 10, 1, LACE.lo)
  for (let x = 19; x < 29; x += 3) px(g, x, 38, LACE.lo)   // 领缘的荷叶小齿

  // ---- 领口蓝色大蝴蝶结：两翼 + 方结心 + 两条短缎带 ----
  // 全部落在 x17..x30 之间 —— 两侧的长发在更外面，结不会被发束吃掉。
  r(g, 17, 38, 5, 2, DEEPBLUE.mid)             // 左翼 x17..21
  r(g, 26, 38, 5, 2, DEEPBLUE.mid)             // 右翼 x26..30
  r(g, 17, 38, 5, 1, DEEPBLUE.hi)              // 翼的上缘受光
  r(g, 26, 38, 5, 1, DEEPBLUE.hi)
  r(g, 18, 40, 4, 1, DEEPBLUE.lo)              // 翼的下缘收窄一行、压暗
  r(g, 26, 40, 4, 1, DEEPBLUE.lo)
  // 结心：4×3 的方块，左上受光、右下压暗
  r(g, 22, 38, 4, 3, DEEPBLUE.mid)
  r(g, 22, 38, 3, 1, DEEPBLUE.hi)
  r(g, 22, 39, 1, 2, DEEPBLUE.hi)
  r(g, 25, 40, 1, 1, DEEPBLUE.lo)
  // 两条垂下的短缎带
  r(g, 21, 41, 2, 6, DEEPBLUE.mid)
  r(g, 25, 41, 2, 6, DEEPBLUE.mid)
  r(g, 21, 41, 1, 6, DEEPBLUE.hi)
  r(g, 26, 41, 1, 6, DEEPBLUE.lo)

  // ---- 白围裙：只露两条肩带 ----
  r(g, 16, 41, 2, 7, lace)
  r(g, 30, 41, 2, 7, lace)
  r(g, 16, 41, 1, 7, LACE.hi)
  r(g, 31, 41, 1, 7, LACE.lo)

  // ================= 及肩的蓝发：从耳侧垂到肩上，压在衣服之上 =================
  both(12, 10, 3, 28, p.hair)                  // 贴脸的鬓发 x12..14（内缘 14，贴住脸的左缘 15）
  both(10, 16, 3, 24, p.hair)                  // 主束 x10..12（盖住肩外侧）
  both(12, 10, 1, 28, p.hairHi)                // 外缘受光
  both(14, 10, 1, 28, p.hairDark)              // 内缘压暗
  both(10, 16, 1, 24, p.hairHi)
  both(12, 16, 1, 24, p.hairDark)
  // 发丝：顺着垂下来的暗线，头发才不是一块平涂
  both(14, 20, 1, 14, p.hairDark)
  both(12, 30, 1, 8, p.hairHi)
  // 发梢分叉
  px(g, 13, 38, p.hairHi)
  px(g, 34, 38, p.hairDark)

  // ================= 白色大荷叶边女仆帽（最后压上去）=================
  // 帽冠：五层逐层加宽，最宽 26px（比 14px 的头骨宽近一倍）
  r(g, 19, 0, 10, 1, lace)
  r(g, 16, 1, 16, 1, lace)
  r(g, 14, 2, 20, 1, lace)
  r(g, 12, 3, 24, 1, lace)
  r(g, 11, 4, 26, 1, lace)
  // 两侧的包边：帽子扣下来包住头骨，垂到耳侧
  r(g, 11, 5, 3, 3, lace)
  r(g, 34, 5, 3, 3, lace)
  // 下缘的荷叶边：每 3px 凸一个 2px 的扇贝（齿缝里露出头发）
  for (let x = 14; x < 33; x += 3) r(g, x, 5, 2, 1, lace)
  // 三阶明暗：左上近白、右下带灰
  r(g, 19, 0, 6, 1, LACE.hi)
  r(g, 25, 0, 4, 1, LACE.lo)
  r(g, 16, 1, 7, 1, LACE.hi)
  r(g, 26, 1, 6, 1, LACE.lo)
  r(g, 14, 2, 8, 1, LACE.hi)
  r(g, 27, 2, 7, 1, LACE.lo)
  r(g, 12, 3, 8, 1, LACE.hi)
  r(g, 29, 3, 7, 1, LACE.lo)
  r(g, 11, 4, 9, 1, LACE.hi)
  r(g, 31, 4, 6, 1, LACE.lo)
  // 包边：左边受光、右边背光
  r(g, 11, 5, 3, 3, LACE.hi)
  r(g, 34, 5, 3, 3, LACE.lo)
  // 荷叶边的齿：左端一点亮，读得出是凸出来的布
  for (let x = 14; x < 33; x += 3) px(g, x, 5, LACE.hi)

  return c
}

/** 弗里德里希：深红发、深蓝细长眼、深黑高领制服 + V 形银饰 */
const FTZ_PORTRAIT: PortraitPal = {
  skin: '#e2c0a8', skinHi: '#f2d6bd', skinShade: '#b48e74',
  hair: '#b4231d', hairHi: '#e35138', hairDark: '#6f1211',
  eye: '#3f6db5', eyeHi: '#8fbaec', eyeDark: '#101c30',
  lip: '#a8615a',
  coat: '#171a20', coatHi: '#333c4a', coatDark: '#0a0c10',
  collar: SILVER.mid, hairStyle: 'wavy', mood: 'calm',
}

/** 艾玛：银紫微卷发、紫蓝眼、深蓝紫女仆装 + 白围裙 + 绿领结 */
const EMMA_PORTRAIT: PortraitPal = {
  skin: '#e8cfc0', skinHi: '#f6e2d4', skinShade: '#bda093',
  hair: LILAC.mid, hairHi: LILAC.hi, hairDark: LILAC.lo,
  eye: '#6a5cc0', eyeHi: '#b9aef0', eyeDark: '#2a1f5c',
  lip: '#b08080', eyeWhite: true,
  eyeGap: 3, softMouth: true,
  coat: '#2a2340', coatHi: '#3d3459', coatDark: '#171226',
  collar: C.bone, apron: C.sugar, pin: BOW_G.mid, hairStyle: 'ringlet', mood: 'calm',
}

const HERMANN_PORTRAIT: PortraitPal = {
  skin: '#e6eaf0', skinHi: C.sugar, skinShade: '#b6bfcc',
  // 银灰发比皮肤压暗一档：否则近白的脸与近白的头发糊成一个石膏像
  hair: '#98a1ae', hairHi: '#c4cad4', hairDark: '#626b78',
  eye: C.pale, eyeHi: C.sugar, eyeDark: C.cold, lip: '#8a8f96',
  coat: '#12151a', coatHi: C.graphite, coatDark: C.night,
  collar: C.bone, hairStyle: 'slick', mood: 'smile', bow: C.pale,
}

const MARTA_PORTRAIT: PortraitPal = {
  skin: '#e0c0a0', skinHi: '#f0d8c0', skinShade: '#b89878',
  hair: '#6b4a2f', hairHi: '#8a6440', hairDark: '#4a3320',
  eye: '#4a3520', eyeHi: C.sugar, lip: '#a05050',
  coat: '#5c4630', coatHi: '#77603f', coatDark: '#3f2f1c',
  collar: C.sugar, hairStyle: 'kerchief', mood: 'grin',
  apron: C.bone, kerchief: C.sugar,
}

/**
 * 彩蛋角色：蓝紫单色阶的冷调 —— 头发、眼睛、蝴蝶结全部取自 DEEPBLUE 一阶，
 * 皮肤也压成带紫的冷白；衣身深蓝，帽与围裙用冷白 LACE。
 */
const DS_PORTRAIT: PortraitPal = {
  skin: '#ece0e8', skinHi: '#faf2f6', skinShade: '#c6b3c1',
  hair: DEEPBLUE.mid, hairHi: DEEPBLUE.hi, hairDark: DEEPBLUE.lo,
  eye: DEEPBLUE.mid, eyeHi: '#dfe6ff', eyeDark: '#2a3568',
  lip: '#c08ca6', eyeWhite: true, eyeGap: 3,
  coat: '#2b3358', coatHi: '#414d80', coatDark: '#181d33',
  collar: LACE.mid, apron: LACE.mid, pin: DEEPBLUE.mid,
  hairStyle: 'ringlet', mood: 'smile',
}

/**
 * 立绘注册表（48×48，对话时放在左侧，显示为 144×144）。
 * 艾玛只有平静一种表情：emmaQuiet 只是眼皮压低 1px，其余完全不动。
 * ftzCold 不换脸：只压低眼睑与眉、把嘴角压平。
 */
export const PORTRAITS: Record<string, HTMLCanvasElement> = {
  ftz: portraitHero(FTZ_PORTRAIT),
  ftzCold: portraitHero({ ...FTZ_PORTRAIT, mood: 'cold' }),
  emma: portraitEmma(EMMA_PORTRAIT),
  emmaQuiet: portraitEmma({ ...EMMA_PORTRAIT, mood: 'quiet' }),
  hermann: portrait(HERMANN_PORTRAIT),
  marta: portrait(MARTA_PORTRAIT),
  ds: portraitCameo(DS_PORTRAIT),
}
// ============================================================
// 注册表
// ============================================================

export const SPRITES: Record<string, Sprite | Sprite[]> = {
  // 彩蛋角色的行走图不走程序化绘制：由文件末尾的 loadCameoWalk() 异步写入
  // ds_down / ds_left / ds_right / ds_up（加载完成前这几个键不存在，渲染器跳过）。

  ...buildCharSet(HERO, 'hero'),
  ...buildCharSet(EMMA, 'emma'),
  ...buildCharSet(HERMANN, 'hermann'),
  ...buildCharSet(MARTA, 'marta'),

  // 家具
  bigPainting: bigPainting(),
  bigPaintingGem: bigPainting('#b02040'),
  fireplace: fireplace(),
  table: table(32, 16),
  tableSmall: table(16, 16),
  desk: desk(),
  bed: bed(),
  bookshelf: bookshelf(),
  candelabra: candelabra(),
  mirror: mirror(),
  grandfatherClock: grandfatherClock(),
  ironDoor: ironDoor(),
  notice: notice(),
  gateArch: gateArch(),
  cat: cat(),
  bone: bone(),
  easel: easel(),
}

/** 角色精灵名（供实体使用） */
export const CHAR_SPRITES = ['hero', 'emma', 'hermann', 'marta', 'ds']

export function spriteFor(name: string): Sprite | Sprite[] | undefined {
  return SPRITES[name]
}

/**
 * 彩蛋角色行走图的四个精灵键 → 素材图的行号。
 * 行序是 RPG Maker 标准：down / left / right / up。
 * （键名写在这里：内容校验脚本按行首键名收集精灵名，只认两格缩进的 `key:`）
 */
const CAMEO_WALK_ROW = {
  ds_down: 0,
  ds_left: 1,
  ds_right: 2,
  ds_up: 3,
} as const

/**
 * 彩蛋角色的行走图：RPG Maker 素材 public/portraits/ds-walk.png。
 * 原图 72×96 —— 3 列 × 4 行，每帧 24×24，行序是 RPG Maker 标准的
 * down / left / right / up。RPG Maker 的三帧是「左步 / 站立 / 右步」，
 * 本引擎约定 [0] 待机、[1][2] 行走，所以每行重排成 [站立, 左步, 右步]
 * （即原图的第 2、1、3 帧）。
 *
 * 异步加载：onload 之前 ds_* 不存在（渲染器读到 undefined 会跳过，不会画错位置），
 * 加载完成后直接写进 SPRITES —— 渲染器每帧都读它，下一帧就生效。
 * 24×24 的帧比其它角色（16×24）宽 8px，drawEntities 按 img.width/height 居中绘制，
 * 引擎不需要改；帧内的脚底在 y23，与其它角色（脚底 y22 + 影子 y23）齐平，站在地上。
 */
function loadCameoWalk(): void {
  const img = new Image()
  img.onload = () => {
    /** 从素材表里切一帧：row = 0..3（down/left/right/up），col = 0..2 */
    const cut = (row: number, col: number): Sprite => {
      const { c, g } = canvas(24, 24)
      g.drawImage(img, col * 24, row * 24, 24, 24, 0, 0, 24, 24)
      return c
    }
    /** 一行的三帧：原图 [左步, 站立, 右步] → 引擎 [站立, 左步, 右步] */
    const walk = (row: number): Sprite[] => [cut(row, 1), cut(row, 0), cut(row, 2)]
    for (const [key, row] of Object.entries(CAMEO_WALK_ROW)) SPRITES[key] = walk(row)
  }
  img.src = './portraits/ds-walk.png'
}

loadCameoWalk()
