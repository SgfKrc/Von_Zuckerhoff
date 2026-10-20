// ============================================================
// 精灵：角色（24×32）、家具与道具、48×48 方形立绘（头 + 肩）。
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
  /** 领结：银灰（赫尔曼）/ 纯黑（艾玛的黑蝴蝶结） */
  bow?: string
  /** 头巾（玛尔塔） */
  kerchief?: string
  /** 比其他人高 1px（赫尔曼）：发顶从 y0 起，脚底仍在 y30 */
  tall?: boolean
  /** 制服一丝褶皱都没有（艾玛） */
  flat?: boolean
  /** 体型壮实（玛尔塔） */
  stout?: boolean
  /**
   * 剪影专门画法：英雄（窄肩长身 + 蓬松红发）/ 女仆（蕾丝帽 + 垂发 + 围裙）。
   * 彩蛋角色的行走图改用 RPG Maker 素材（public/portraits/ds-walk.png），
   * 不再有程序化的剪影画法。
   */
  silhouette?: 'hero' | 'maid'
  /** 裤/靴的第四档：暗裤上的受光纵向高光 */
  pantsHi?: string
  /**
   * 虹膜高光（立绘用）。行走图不用：每只眼睛只有 2×1 像素，
   * 一列给瞳孔、一列给眼白就是极限 —— 再多一格就成「大眼娃娃」。
   */
  eyeHi?: string
  /**
   * 眼白：每只眼睛 2×1 里靠外的那一列。
   * 比皮肤亮一档即可，纯白会把 24×32 的眼睛读成高光而不是眼白。
   */
  eyeWhite?: string
  /** 上眼睑线 / 深虹膜的深色（立绘里那圈最暗的靛） */
  eyeDark?: string
  /** 高领里露出的银灰领口 */
  collar?: string
  /** 唇色（行走图上只有一两个像素） */
  lip?: string
  /** 眉：不填就沿用发根的暗色 */
  brow?: string
  /** 白色蕾丝帽（艾玛）：帽冠与帽檐的最亮一档 */
  hat?: string
  /** 蕾丝帽的阴影：偏紫的冷白，和暖白领子分得开 */
  hatLo?: string
  /** 蝴蝶结的受光一档（艾玛的黑蝴蝶结也要有型） */
  bowHi?: string
}

/**
 * 弗里德里希：从新立绘 public/portraits/ftz.png 上直接取色 ——
 * 头发 #cf4449（立绘头部最常出现的那一片红，偏冷、不是橙红）、
 * 发根 #661829、眼睛 #4b58a2（虹膜那圈靛蓝）、眼白 #f6eee6、
 * 皮肤 #fbe1c3（暖调苍白有血色）、
 * 制服 #2b2530（立绘上占面积最大的那档紫黑，比旧稿的 #1d1824 亮一档，
 * 在昏暗地图上不会糊成一团黑）、立领与 V 形胸饰的银灰 #ad9fb2。
 * 剪影：蓬松的头发 14px 宽（肩只有 8px），窄肩长身，瘦长的脸。
 */
const HERO: CharColors = {
  hair: '#cf4449', hairHi: '#e2685f', hairDark: '#661829',
  skin: '#fbe1c3', skinShade: '#c99a86', skinHi: '#fff2dd',
  coat: '#2b2530', coatHi: '#453d4b', coatDark: '#131018',
  pants: '#232130', shoe: '#14121a', pantsHi: '#3a3650',
  eye: '#4b58a2', eyeDark: '#242b52', eyeWhite: '#ffffff', lip: '#c0807a',
  hairStyle: 'short', accent: '#ad9fb2', collar: '#ad9fb2',
  brow: '#661829', silhouette: 'hero',
}

/**
 * 艾玛：从新立绘 public/portraits/emma.png 上直接取色 ——
 * 头发 #a99bb2（银白偏淡紫的中调）、发丝高光 #e6e1e9、发根 #756580、
 * 眼睛 #5d4a6b（紫灰虹膜）、眼白 #f4eef7、睫毛/上眼睑 #200a21（立绘上几乎纯黑）、
 * 皮肤 #faf5e6（立绘是极浅的奶油白，带一点粉）、
 * 服装 #2f233b（深紫黑女仆装）、白蕾丝 #fdfcf4 / 阴影 #cfc8d6、
 * 黑蝴蝶结 #171020 —— 新素材是黑蝴蝶结，不再是旧行走图上那个绿领结。
 */
const EMMA: CharColors = {
  hair: '#a99bb2', hairHi: '#e6e1e9', hairDark: '#756580',
  skin: '#faf5e6', skinShade: '#cbbcc9', skinHi: '#fffdf2',
  coat: '#2f233b', coatHi: '#453758', coatDark: '#1a1224',
  pants: '#2f233b', shoe: '#1a1224', pantsHi: '#3a2d48',
  eye: '#5d4a6b', eyeDark: '#200a21', eyeWhite: '#ffffff', lip: '#c49aa4',
  hairStyle: 'bun', apron: '#f9f7ee', collar: '#cfc8d6',
  bow: '#171020', bowHi: '#53465a', hat: '#fdfcf4', hatLo: '#cfc8d6',
  brow: '#200a21', flat: true, silhouette: 'maid',
}

/** 赫尔曼：黑燕尾服、白衬衫硬领 + 银灰领结、极苍白；发顶比别人高 1px */
const HERMANN: CharColors = {
  hair: '#c0c6d0', hairHi: '#dde2e8', hairDark: '#8a909c',
  skin: '#e6eaf0', skinShade: '#b6bfcc', skinHi: C.sugar,
  coat: '#12151a', coatHi: C.graphite, coatDark: C.night,
  pants: '#0e1014', shoe: C.night, eye: '#6f7e95', eyeWhite: '#ffffff',
  hairStyle: 'slick', bow: C.pale, collar: C.bone, tall: true, brow: '#5f6a7a',
}

/** 玛尔塔：白围裙、壮实、棕发头巾 */
const MARTA: CharColors = {
  hair: '#6b4a2f', hairHi: '#8a6440', hairDark: '#4a3320',
  skin: '#e0c0a0', skinShade: '#b89878', skinHi: '#f0d8c0',
  coat: '#5c4630', coatHi: '#77603f', coatDark: '#3f2f1c',
  pants: '#3f2f1c', shoe: C.night, eye: '#3a2a18', eyeWhite: '#fff6e4',
  hairStyle: 'kerchief', apron: C.sugar, kerchief: C.bone, stout: true, brow: '#4a3320',
}

/** 角色帧总入口：主角 / 女仆走专用剪影画法，其余角色走通用画法 */
function drawChar(cc: CharColors, dir: Dir, frame: number): Sprite {
  if (cc.silhouette === 'hero') return drawHero(cc, dir, frame)
  if (cc.silhouette === 'maid') return drawMaid(cc, dir, frame)
  return drawPlain(cc, dir, frame)
}

// ============================================================
// 24×32 行走图：赫尔曼 / 玛尔塔（通用骨架）
// ============================================================
/**
 * 通用角色帧（赫尔曼 / 玛尔塔）：24×32。
 *
 * 骨架（四方向共用）：
 *   y0..y3   发顶 / 头巾（赫尔曼更高，从 y0 起；玛尔塔 y1 起）
 *   y4..y13  脸（额头 y4..y5 / 眉 y5 / 眼 y7 / 鼻 y9 / 嘴 y11 / 下巴 y12..y13）
 *   y14      颈
 *   y15..y22 躯干（肩线 y15，下摆固定 y23）
 *   y24..y27 裤 / 裙
 *   y28..y30 靴
 *   y31      影子
 * 上身高 1px（bob）时只有头、肩、手臂上移，下摆钉在地上。
 *
 * 脸型同样是上宽下窄：额/颧 10px（玛尔塔）或 8px（赫尔曼）→ 下颌 8/6 → 下巴 6。
 * 眼睛每只 2×1：靠鼻梁的一列是瞳孔，外侧一列是眼白（24×32 上终于画得下眼白）。
 */
function drawPlain(cc: CharColors, dir: Dir, frame: number): Sprite {
  const { c, g } = canvas(24, 32)
  const mirror = dir === 'right'
  const mx = (x: number, w = 1): number => (mirror ? 24 - x - w : x)
  const bob = frame === 1 ? -1 : 0
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0
  const liftL = frame === 1 ? 1 : 0
  const liftR = frame === 2 ? 1 : 0
  const hy = bob
  const hi = cc.pantsHi ?? cc.pants
  const brow = cc.brow ?? cc.hairDark
  const eyeW = cc.eyeWhite ?? C.sugar
  const kerchief = cc.kerchief
  const stout = !!cc.stout
  const slick = cc.hairStyle === 'slick'
  const faceTop = cc.tall ? 3 : 4
  const faceW = stout ? 10 : 8
  const fx = 12 - faceW / 2
  /** 眉 / 眼 / 鼻 / 嘴 的行号：所有角色对齐（眼 y7），换角色时脸不会一高一低 */
  const browY = 5
  const eyeY = 7
  const noseY = 9
  const mouthY = 11
  const eyeX = 9
  const { hair, hairHi, hairDark, skin, skinShade, skinHi } = cc

  // ---- 影子 ----
  r(g, 5, 31, 14, 1, 'rgba(0,0,0,0.42)')
  r(g, 6, 30, 12, 1, 'rgba(0,0,0,0.20)')

  // ---- 腿与靴 ----
  if (dir === 'down' || dir === 'up') {
    const lx = stout ? 8 : 9
    const lw = stout ? 3 : 2
    r(g, lx, 24, lw, 4 - liftL, cc.pants)
    r(g, lx, 24, 1, 4 - liftL, hi)
    r(g, lx - 1, 28 - liftL, lw + 1, 3, liftL ? cc.coatDark : cc.shoe)
    px(g, lx - 1, 28 - liftL, liftL ? cc.pants : hi)
    r(g, 24 - lx - lw, 24, lw, 4 - liftR, cc.pants)
    r(g, 24 - lx - lw, 24, 1, 4 - liftR, hi)
    r(g, 24 - lx - lw, 28 - liftR, lw + 1, 3, liftR ? cc.coatDark : cc.shoe)
    px(g, 24 - lx - lw, 28 - liftR, liftR ? cc.pants : hi)
  } else {
    // 侧面（原型朝左）：前腿在屏幕左，后腿在屏幕右
    const lead = frame === 1 ? 1 : 0
    const trail = frame === 2 ? 1 : 0
    const bw = stout ? 3 : 2
    r(g, mx(12 + trail, bw), 24, bw, 4, cc.pants)
    r(g, mx(12 + trail, 1), 24, 1, 4, hi)
    r(g, mx(12 + trail, bw + 1), 28, bw + 1, 3, cc.shoe)
    r(g, mx(8 - lead, bw), 24, bw, 4, cc.pants)
    r(g, mx(8 - lead, 1), 24, 1, 4, hi)
    r(g, mx(7 - lead, bw + 2), 28, bw + 2, 3, cc.shoe)
    px(g, mx(7 - lead, 1), 28, hi)
  }

  // ---- 躯干 ----
  const ty = 15 + bob
  const bodyH = 23 - ty
  const bx = stout ? 7 : 8
  const bw = stout ? 10 : 8

  if (dir === 'down' || dir === 'up') {
    // 手臂：赫尔曼瘦（1px），玛尔塔壮（2px）
    const aw = stout ? 2 : 1
    const aL = 16 + bob + swing
    const aR = 16 + bob - swing
    r(g, 7 - aw, aL, aw, 6, cc.coat)
    px(g, 7 - aw, aL, cc.coatHi)
    r(g, 7 - aw, aL + 5, aw, 1, cc.skinShade)
    r(g, 16, aR, aw, 6, cc.coatDark)
    r(g, 16, aR + 5, aw, 1, cc.skinShade)
    // 躯干
    r(g, bx, ty, bw, bodyH, cc.coat)
    r(g, bx, ty, bw, 1, cc.coatHi)
    r(g, bx, ty, 1, bodyH, cc.coatHi)
    r(g, bx + bw - 1, ty, 1, bodyH, cc.coatDark)
    if (!cc.flat) {
      px(g, bx + 2, ty + 4, cc.coatDark)
      px(g, bx + bw - 3, ty + 6, cc.coatHi)
    }
    // 下摆（固定在 y22..y23，不随 bob 动）
    r(g, bx - 1, 22, bw + 2, 1, cc.coat)
    r(g, bx - 1, 23, bw + 2, 1, cc.coatDark)
    px(g, bx - 1, 22, cc.coatHi)
    px(g, bx + bw, 22, cc.coatDark)
  } else {
    // 侧面：躯干 6 宽，近侧手臂在屏幕左，远侧在屏幕右
    const tL = mirror ? mx(9, 6) : mx(9, 1)
    const tR = mirror ? mx(9, 1) : mx(9, 6)
    const aY = 16 + bob + swing
    r(g, mx(7, 2), aY, 2, 6, cc.coat)
    px(g, mirror ? mx(7, 2) : mx(7, 1), aY, cc.coatHi)
    px(g, mx(7, 1), aY + 5, cc.skinShade)
    r(g, mx(14, 2), 16 + bob - swing, 2, 6, cc.coatDark)
    // 燕尾 / 衣摆拖在身后（屏幕右）
    r(g, mx(13, 4), 20, 4, 4, cc.coat)
    px(g, mx(16, 1), 20, cc.coatDark)
    // 躯干（画在远侧手臂之上）
    r(g, mx(9, 6), ty, 6, bodyH, cc.coat)
    r(g, tL, ty, 1, bodyH, cc.coatHi)
    r(g, tR, ty, 1, bodyH, cc.coatDark)
    r(g, mx(9, 6), 23, 6, 1, cc.coatDark)
    px(g, mx(9, 1), 23, cc.coatHi)
  }

  // ---- 头 ----
  if (dir === 'up') {
    // 后脑：赫尔曼是后梳的银发，玛尔塔是头巾 + 发髻
    if (kerchief) {
      r(g, 8, 1 + hy, 8, 1, kerchief)
      r(g, 6, 2 + hy, 12, 1, kerchief)
      r(g, 6, 3 + hy, 12, 1, kerchief)
      r(g, 6, 2 + hy, 4, 1, C.sugar)
      r(g, 6, 3 + hy, 2, 1, C.sugar)
      // 后脑的头发与发髻
      r(g, 7, 4 + hy, 10, 7, hair)
      r(g, 7, 4 + hy, 1, 7, hairHi)
      r(g, 16, 4 + hy, 1, 7, hairDark)
      r(g, 9, 11 + hy, 6, 2, hair)            // 圆发髻
      r(g, 10, 13 + hy, 4, 1, hairDark)
      r(g, 9, 11 + hy, 1, 2, hairHi)
      r(g, 14, 11 + hy, 1, 2, hairDark)
      r(g, 10, 5 + hy, 4, 1, hairHi)
      px(g, 13, 7 + hy, hairDark)
      // 头巾后结
      r(g, 14, 3 + hy, 3, 2, kerchief)
      px(g, 16, 4 + hy, C.sugar)
      // 后颈
      r(g, 11, 13 + hy, 2, 1, cc.skinShade)
    } else {
      // 赫尔曼：后梳，发尾在颈后收成一小撮
      r(g, 9, 0 + hy, 6, 1, hair)
      r(g, 8, 1 + hy, 8, 1, hair)
      r(g, 7, 2 + hy, 10, 1, hair)
      r(g, 7, 3 + hy, 10, 7, hair)          // y3..y9
      r(g, 8, 10 + hy, 8, 1, hair)          // y10
      r(g, 9, 11 + hy, 6, 1, hair)          // y11
      r(g, 10, 12 + hy, 4, 1, hair)         // y12 发尾
      r(g, 7, 3 + hy, 1, 8, hairHi)
      r(g, 16, 3 + hy, 1, 8, hairDark)
      r(g, 8, 4 + hy, 1, 6, hairHi)
      r(g, 9, 6 + hy, 6, 1, hairDark)       // 梳齿一样的一道路
      r(g, 12, 3 + hy, 1, 5, hairDark)      // 中缝
      r(g, 13, 10 + hy, 1, 2, hairDark)
      r(g, 10, 5 + hy, 3, 1, hairHi)
      r(g, 11, 13 + hy, 2, 1, cc.skinShade)
    }
  } else if (dir === 'down') {
    // 发 / 头巾 + 脸（先用发/巾铺满，再把脸压上去，下颌收窄处不会漏背景）
    if (kerchief) {
      r(g, 8, 1 + hy, 8, 1, kerchief)
      r(g, 6, 2 + hy, 12, 1, kerchief)
      r(g, 6, 3 + hy, 12, 1, kerchief)
      r(g, 5, 4 + hy, 14, 1, kerchief)     // 头巾压到鬓角
      r(g, 5, 4 + hy, 3, 1, C.sugar)
      r(g, 16, 4 + hy, 3, 1, C.sugar)
      // 头巾下的棕发：两侧鬓角与额前碎发
      r(g, 5, 5 + hy, 1, 5, hair)
      r(g, 18, 5 + hy, 1, 5, hairDark)
      px(g, 7, 5 + hy, hair)
      px(g, 9, 5 + hy, hair)
      px(g, 14, 5 + hy, hairDark)
      px(g, 16, 5 + hy, hairDark)
    } else {
      r(g, 9, 0 + hy, 6, 1, hair)
      r(g, 8, 1 + hy, 8, 1, hair)
      r(g, 7, 2 + hy, 10, 1, hair)
      r(g, 7, 3 + hy, 2, 7, hair)          // 左侧发
      r(g, 16, 3 + hy, 1, 7, hairDark)     // 右侧背光
      r(g, 7, 3 + hy, 1, 5, hairHi)
      r(g, 8, 3 + hy, 1, 1, hairDark)
      r(g, 11, 2 + hy, 1, 1, hairDark)     // 侧分线
    }

    // 脸：上宽下窄（10→8→6 或 8→6→6）。
    // 行号从下巴往上排：下巴 y12..y13、下颌 y10..y11、颧以上到 faceTop。
    const jawW = Math.max(6, faceW - 2)
    const chinW = Math.max(6, faceW - 4)
    const jawX = 12 - jawW / 2
    const chinX = 12 - chinW / 2
    const topH = 10 - faceTop
    r(g, fx, faceTop + hy, faceW, topH, skin)
    r(g, jawX, 10 + hy, jawW, 2, skin)
    r(g, chinX, 12 + hy, chinW, 2, skin)
    // 受光在屏幕左、背光在屏幕右
    r(g, fx, faceTop + hy, 1, topH, skinHi)
    r(g, fx + faceW - 1, faceTop + hy, 1, topH, skinShade)
    r(g, jawX, 10 + hy, 1, 2, skinHi)
    r(g, jawX + jawW - 1, 10 + hy, 1, 2, skinShade)
    r(g, chinX, 12 + hy, 1, 2, skinHi)
    r(g, chinX + chinW - 1, 12 + hy, 1, 2, skinShade)
    // 眉 y5
    r(g, eyeX, browY + hy, 2, 1, brow)
    r(g, eyeX + 4, browY + hy, 2, 1, brow)
    // 眼 y7：每只 2×1 —— 外侧眼白、内侧瞳孔（两眼之间空 2px 鼻梁）
    r(g, eyeX, eyeY + hy, 1, 1, eyeW)
    r(g, eyeX + 1, eyeY + hy, 1, 1, cc.eye)
    r(g, eyeX + 4, eyeY + hy, 1, 1, cc.eye)
    r(g, eyeX + 5, eyeY + hy, 1, 1, eyeW)
    // 鼻 y9、嘴 y11
    px(g, 12, noseY + hy, cc.skinShade)
    px(g, 11, noseY + hy, skinHi)
    px(g, 11, mouthY + hy, cc.lip ?? '#8a5f58')
    px(g, 12, mouthY + hy, cc.lip ?? '#8a5f58')
  } else {
    // 侧面（原型朝左，朝右镜像）：脸 7 宽，鼻尖突出 1px
    const f = (x: number, w = 1): number => mx(x, w)
    if (kerchief) {
      // 玛尔塔：头巾罩住头顶并垂到脑后，脸露出来
      r(g, f(8, 9), 1 + hy, 9, 1, kerchief)
      r(g, f(6, 13), 2 + hy, 13, 1, kerchief)
      r(g, f(6, 13), 3 + hy, 13, 1, kerchief)
      r(g, f(6, 4), 3 + hy, 4, 1, C.sugar)
      r(g, f(16, 3), 3 + hy, 3, 1, C.sugar)
      // 头巾在脑后的垂布
      r(g, f(14, 4), 3 + hy, 4, 7, kerchief)
      r(g, f(14, 1), 3 + hy, 1, 7, C.pale)
      r(g, f(18, 1), 3 + hy, 1, 7, cc.hairDark)
      // 后脑的头发与发髻（在垂布下方露出一截）
      r(g, f(14, 3), 10 + hy, 3, 2, hair)
      r(g, f(15, 2), 12 + hy, 2, 1, hair)
      // 前侧的鬓发
      r(g, f(7, 2), 4 + hy, 2, 2, hair)
      px(g, f(7, 1), 4 + hy, hairHi)
      // 头巾后结
      r(g, f(16, 3), 4 + hy, 3, 2, kerchief)
      px(g, f(18, 1), 4 + hy, C.sugar)
    } else {
      // 赫尔曼：后梳的银发，紧贴头骨；只有鬓角与后脑一小块
      r(g, f(9, 8), 0 + hy, 8, 1, hair)
      r(g, f(7, 11), 1 + hy, 11, 1, hair)
      r(g, f(7, 10), 2 + hy, 10, 1, hair)
      r(g, f(9, 4), 0 + hy, 4, 1, hairHi)
      r(g, f(15, 3), 1 + hy, 3, 1, hairDark)
      r(g, f(14, 4), 3 + hy, 4, 9, hair)      // 后脑 x14..x17
      r(g, f(14, 2), 12 + hy, 2, 2, hair)     // 发尾
      r(g, f(14, 1), 3 + hy, 1, 9, hairDark)
      r(g, f(17, 1), 3 + hy, 1, 9, hairDark)
      r(g, f(15, 2), 4 + hy, 2, 1, hairHi)
      px(g, f(16, 1), 6 + hy, hairHi)
      px(g, f(14, 1), 8 + hy, hairHi)
      // 鬓角：只压住太阳穴，不遮眼
      r(g, f(7, 1), 3 + hy, 1, 3, hair)
    }
    // 脸（赫尔曼的额头多一行）
    const topH = 10 - faceTop
    r(g, f(7, 8), faceTop + hy, 8, topH, skin)
    r(g, f(8, 7), 10 + hy, 7, 2, skin)
    r(g, f(9, 6), 12 + hy, 6, 2, skin)
    const faceL = mirror ? f(9, 6) : f(7, 1)
    const faceR = mirror ? f(7, 1) : f(9, 6)
    r(g, faceL, faceTop + hy, 1, topH, skinHi)
    r(g, faceR, faceTop + hy, 1, topH, skinShade)
    r(g, faceL, 10 + hy, 1, 2, skinHi)
    r(g, faceR, 10 + hy, 1, 2, skinShade)
    // 鼻尖
    px(g, mirror ? f(15, 1) : f(6, 1), 8 + hy, skin)
    px(g, mirror ? f(15, 1) : f(6, 1), 9 + hy, skinShade)
    // 一只眼：靠前侧瞳孔 + 靠后侧眼白
    px(g, f(9, 1), 5 + hy, brow)
    px(g, f(10, 1), 5 + hy, brow)
    px(g, mirror ? f(10, 1) : f(9, 1), 7 + hy, cc.eye)
    px(g, mirror ? f(9, 1) : f(10, 1), 7 + hy, eyeW)
    // 嘴
    px(g, f(9, 1), 11 + hy, cc.lip ?? '#a86a60')
    px(g, f(10, 1), 11 + hy, cc.skinShade)
  }

  // ---- 颈 ----
  r(g, 11, 14 + hy, 2, 1, cc.skinShade)

  // ---- 领口 / 白围裙 / 领结 ----
  if (kerchief) {
    // 玛尔塔：白围裙面板 + 两条肩带，白围裙压住棕衣
    r(g, 9, ty, 6, 1, cc.apron ?? C.sugar)
    r(g, 9, ty + 1, 6, 1, cc.apron ?? C.sugar)
    px(g, 9, ty, '#ffffff')
    px(g, 14, ty + 1, cc.skinShade)
    if (dir === 'down') {
      r(g, 9, ty + 2, 6, 5, cc.apron ?? C.sugar)
      r(g, 9, ty + 2, 1, 5, '#ffffff')
      r(g, 14, ty + 2, 1, 5, cc.skinShade)
      // 口袋与围裙褶：两条极浅的竖线，白围裙不是一块白板
      px(g, 11, ty + 4, C.pale)
      px(g, 12, ty + 4, C.pale)
      r(g, 11, ty + 5, 2, 1, C.pale)
    } else if (dir === 'up') {
      r(g, 9, ty + 2, 1, 5, cc.apron ?? C.sugar)
      r(g, 14, ty + 2, 1, 5, cc.apron ?? C.sugar)
    } else {
      r(g, 10, ty + 2, 4, 4, cc.apron ?? C.sugar)
      r(g, 10, ty + 2, 1, 4, '#ffffff')
      r(g, 13, ty + 2, 1, 4, cc.skinShade)
    }
  } else {
    // 赫尔曼：白衬衫硬领 + 银灰领结
    r(g, 9, ty, 6, 1, cc.collar ?? C.bone)
    px(g, 9, ty, '#ffffff')
    px(g, 14, ty, C.mist)
    if (dir === 'down') {
      r(g, 10, ty + 1, 2, 1, cc.bow ?? C.pale)
      r(g, 12, ty + 1, 2, 1, cc.bow ?? C.pale)
      r(g, 11, ty + 1, 1, 1, C.bone)
      px(g, 10, ty + 1, '#ffffff')
      r(g, 11, ty + 2, 1, 1, cc.bow ?? C.pale)
      // 衬衫胸前的白 V
      px(g, 11, ty + 3, C.bone)
      px(g, 12, ty + 3, C.bone)
      px(g, 11, ty + 4, C.pale)
    } else if (dir === 'up') {
      r(g, 9, ty + 1, 6, 1, cc.collar ?? C.bone)
      r(g, 9, ty + 1, 1, 1, '#ffffff')
      r(g, 14, ty + 1, 1, 1, C.mist)
    } else {
      r(g, 10, ty + 1, 2, 1, cc.bow ?? C.pale)
      px(g, 10, ty + 1, '#ffffff')
      px(g, 11, ty + 2, cc.bow ?? C.pale)
      px(g, 11, ty + 3, C.bone)
    }
  }

  return c
}

// ============================================================
// 弗里德里希：24×32 行走图 —— 深红蓬发 + 蓝眼 + 黑高领制服 + 银灰 V 形胸饰
// ============================================================
/**
 * 24×32，四方向 × 三帧。头部占 y1..y13（13 行，16×24 时代只有 10 行），
 * 多出来的像素全给了脸：额头一整行、眼窝、鼻梁、两行下颌。
 *
 * 脸型（上宽下窄，不再是方块）：
 *   额头 8px（x8..x15，被刘海压窄）→ 颧 10px（x7..x16）→ 下颌 7px（x9..x15）
 *   → 下巴 6px（x9..x14）。太阳穴两侧由 2px 鬓发框住。
 *
 * 眼睛（每只 2px 宽 × 1px 高）：外侧 1px 眼白、靠鼻梁的 1px 蓝瞳孔，
 *   左眼 x9..x10、右眼 x13..x14，两眼之间空 2px（x11..x12）当鼻梁。
 *   眉在 y5，眼睛在 y7 —— 中间空一整行，眼窝才是凹的。
 *
 * 三帧：0 站立；1 上身抬 1px + 抬左腿 + 右臂前摆；2 抬右腿 + 左臂前摆。
 */
function drawHero(cc: CharColors, dir: Dir, frame: number): Sprite {
  const { c, g } = canvas(24, 32)
  const mirror = dir === 'right'
  const mx = (x: number, w = 1): number => (mirror ? 24 - x - w : x)
  const bob = frame === 1 ? -1 : 0
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0
  const liftL = frame === 1 ? 1 : 0
  const liftR = frame === 2 ? 1 : 0
  const hy = bob
  const hi = cc.pantsHi ?? cc.pants
  const brow = cc.brow ?? cc.hairDark
  const lip = cc.lip ?? '#c0807a'
  const silver = cc.collar ?? '#ad9fb2'
  const silverHi = C.bone
  const silverLo = C.mist
  const eyeW = cc.eyeWhite ?? C.sugar
  const { hair, hairHi, hairDark, skin, skinShade, skinHi } = cc

  // ---- 影子 ----
  r(g, 5, 31, 14, 1, 'rgba(0,0,0,0.42)')
  r(g, 6, 30, 12, 1, 'rgba(0,0,0,0.20)')

  // ---- 腿：裤 y24..y27，靴 y28..y30；抬腿 = 裤短 1px + 靴上移 1px ----
  if (dir === 'down' || dir === 'up') {
    // 裤腿 3px 宽、靴 4px 宽：24 宽的画布上，2px 的腿会像两根牙签
    r(g, 8, 24, 3, 4 - liftL, cc.pants)
    r(g, 8, 24, 1, 4 - liftL, hi)
    r(g, 7, 28 - liftL, 4, 3, liftL ? cc.coatDark : cc.shoe)
    r(g, 7, 28 - liftL, 3, 1, liftL ? cc.pants : hi)
    r(g, 13, 24, 3, 4 - liftR, cc.pants)
    r(g, 13, 24, 1, 4 - liftR, hi)
    r(g, 13, 28 - liftR, 4, 3, liftR ? cc.coatDark : cc.shoe)
    r(g, 13, 28 - liftR, 3, 1, liftR ? cc.pants : hi)
  } else {
    // 侧面（原型朝左）：前腿在屏幕左、后腿在屏幕右，第 1 帧前伸、第 2 帧后撤
    const lead = frame === 1 ? 1 : 0
    const trail = frame === 2 ? 1 : 0
    const f = (x: number, w = 1): number => mx(x, w)
    r(g, f(12 + trail, 3), 24, 3, 4, cc.pants)
    px(g, f(12 + trail, 1), 24, hi)
    r(g, f(12 + trail, 4), 28, 4, 3, cc.shoe)
    r(g, f(8 - lead, 3), 24, 3, 4, cc.pants)
    px(g, f(8 - lead, 1), 24, hi)
    r(g, f(7 - lead, 5), 28, 5, 3, cc.shoe)
    r(g, f(7 - lead, 3), 28, 3, 1, hi)
  }

  // ---- 躯干 ----
  const ty = 15 + bob
  const bodyH = 23 - ty
  if (dir === 'down' || dir === 'up') {
    // 手臂：细，摆动 ±1px，袖口露出一只手
    const aL = 16 + bob + swing
    const aR = 16 + bob - swing
    r(g, 6, aL, 2, 6, cc.coat)
    r(g, 6, aL, 1, 6, cc.coatHi)
    r(g, 6, aL + 5, 2, 1, cc.skinShade)
    r(g, 16, aR, 2, 6, cc.coatDark)
    r(g, 17, aR + 5, 1, 1, cc.skinShade)
    // 躯干：窄肩 8 宽
    r(g, 8, ty, 8, bodyH, cc.coat)
    r(g, 8, ty, 8, 1, cc.coatHi)              // 肩线
    r(g, 8, ty, 1, bodyH, cc.coatHi)          // 屏幕左侧受光
    r(g, 15, ty, 1, bodyH, cc.coatDark)       // 屏幕右侧背光
    px(g, 11, ty + 5, cc.coatDark)            // 一道极轻的衣褶
    // 下摆：10 宽，钉在 y22..y23
    r(g, 7, 22, 10, 1, cc.coat)
    r(g, 7, 23, 10, 1, cc.coatDark)
    px(g, 7, 22, cc.coatHi)
    px(g, 16, 22, cc.coatDark)
  } else {
    // 侧面：躯干 6 宽，燕尾拖在身后
    const tL = mirror ? mx(9, 6) : mx(9, 1)
    const tR = mirror ? mx(9, 1) : mx(9, 6)
    const aY = 16 + bob + swing
    r(g, mx(7, 2), aY, 2, 6, cc.coat)
    px(g, mirror ? mx(7, 2) : mx(7, 1), aY, cc.coatHi)
    px(g, mx(7, 1), aY + 5, cc.skinShade)
    r(g, mx(14, 2), 16 + bob - swing, 2, 6, cc.coatDark)
    // 燕尾 / 下摆
    r(g, mx(13, 4), 20, 4, 4, cc.coat)
    px(g, mx(16, 1), 20, cc.coatDark)
    r(g, mx(9, 6), ty, 6, bodyH, cc.coat)
    r(g, tL, ty, 1, bodyH, cc.coatHi)
    r(g, tR, ty, 1, bodyH, cc.coatDark)
    r(g, mx(9, 6), 23, 6, 1, cc.coatDark)
  }

  // ---- 头 ----
  if (dir === 'up') {
    // 后脑：整颗头都是头发，发尾 14 → 10 → 8 → 6 收成圆润的后脑
    r(g, 8, 1 + hy, 8, 1, hair)
    r(g, 6, 2 + hy, 12, 1, hair)
    r(g, 5, 3 + hy, 14, 8, hair)            // y3..y10
    r(g, 6, 11 + hy, 12, 1, hair)
    r(g, 7, 12 + hy, 10, 1, hair)
    r(g, 8, 13 + hy, 8, 1, hair)
    // 左上受光、右下背光
    r(g, 8, 1 + hy, 4, 1, hairHi)
    r(g, 6, 2 + hy, 4, 1, hairHi)
    r(g, 5, 3 + hy, 1, 8, hairHi)
    r(g, 18, 3 + hy, 1, 11, hairDark)
    r(g, 16, 2 + hy, 2, 1, hairDark)
    r(g, 17, 3 + hy, 1, 8, hairDark)
    // 后脑只走横向受光带 —— 1px 的孤立暗点会读成眼睛
    r(g, 7, 5 + hy, 4, 1, hairHi)
    r(g, 12, 8 + hy, 4, 1, hairHi)
    px(g, 6, 6 + hy, hairHi)
    px(g, 15, 4 + hy, hairDark)
    px(g, 16, 8 + hy, hairDark)
    // 发旋与发缝：一道竖暗线 + 两道斜高光，后脑才不是一块红砖
    r(g, 11, 2 + hy, 1, 2, hairDark)
    px(g, 10, 3 + hy, hairHi)
    r(g, 8, 6 + hy, 1, 4, hairDark)
    r(g, 15, 5 + hy, 1, 3, hairDark)
    r(g, 6, 9 + hy, 2, 1, hairHi)
    r(g, 13, 10 + hy, 2, 1, hairHi)
    // 后颈
    r(g, 11, 13 + hy, 2, 1, cc.skinShade)
  } else if (dir === 'down') {
    // ---- 头发（先铺满，再把脸压上去）----
    r(g, 8, 1 + hy, 8, 1, hair)
    r(g, 6, 2 + hy, 12, 1, hair)
    r(g, 5, 3 + hy, 14, 8, hair)            // y3..y10 两鬓
    r(g, 6, 11 + hy, 12, 1, hair)
    r(g, 7, 12 + hy, 10, 1, hair)
    r(g, 8, 13 + hy, 8, 1, hair)
    // 顶发的受光 / 背光
    r(g, 9, 1 + hy, 3, 1, hairHi)
    r(g, 14, 1 + hy, 2, 1, hairDark)
    r(g, 7, 2 + hy, 4, 1, hairHi)
    r(g, 15, 2 + hy, 2, 1, hairDark)
    r(g, 5, 3 + hy, 4, 1, hairHi)
    r(g, 16, 3 + hy, 2, 1, hairDark)
    r(g, 5, 4 + hy, 1, 7, hairHi)           // 左缘受光
    r(g, 18, 4 + hy, 1, 9, hairDark)        // 右缘背光
    // 发丝：两鬓各一道向下的暗线与高光，红发才不是一块红布
    r(g, 6, 5 + hy, 1, 6, hairDark)
    r(g, 17, 5 + hy, 1, 6, hair)
    px(g, 7, 6 + hy, hairHi)
    px(g, 16, 6 + hy, hairDark)
    px(g, 5, 6 + hy, hairHi)

    // ---- 脸（上宽下窄）----
    r(g, 7, 4 + hy, 10, 1, skin)            // 额头 10
    r(g, 7, 5 + hy, 10, 5, skin)            // 颧 y5..y9
    r(g, 9, 10 + hy, 7, 2, skin)            // 下颌 7
    r(g, 9, 12 + hy, 6, 2, skin)            // 下巴 6
    // 屏幕左受光 / 右背光
    r(g, 7, 4 + hy, 1, 2, skinHi)
    r(g, 16, 4 + hy, 1, 2, skinShade)
    r(g, 7, 6 + hy, 1, 4, skinHi)
    r(g, 16, 6 + hy, 1, 4, skinShade)
    r(g, 9, 10 + hy, 1, 2, skinHi)
    r(g, 15, 10 + hy, 1, 2, skinShade)
    r(g, 9, 12 + hy, 1, 1, skinHi)
    r(g, 14, 12 + hy, 1, 2, skinShade)
    // 发际线：额角压两撮刘海
    px(g, 8, 4 + hy, hairDark)
    px(g, 11, 4 + hy, hairDark)
    px(g, 14, 4 + hy, hairDark)
    r(g, 7, 5 + hy, 1, 3, hair)             // 左鬓角
    r(g, 16, 5 + hy, 1, 3, hairDark)        // 右鬓角
    // 眉 y5（与眼睛之间空一整行）
    r(g, 9, 5 + hy, 2, 1, brow)
    r(g, 13, 5 + hy, 2, 1, brow)
    // 眼 y7：外侧眼白 + 内侧蓝瞳孔
    px(g, 9, 7 + hy, eyeW)
    px(g, 10, 7 + hy, cc.eye)
    px(g, 13, 7 + hy, cc.eye)
    px(g, 14, 7 + hy, eyeW)
    // 鼻 y9、嘴 y11
    px(g, 11, 9 + hy, skinHi)
    px(g, 12, 9 + hy, skinShade)
    r(g, 11, 11 + hy, 2, 1, lip)
    px(g, 13, 11 + hy, skinShade)
    // 下巴底：两点暗，脸才有厚度
    px(g, 10, 13 + hy, skinShade)
    px(g, 13, 13 + hy, skinShade)
  } else {
    // ---- 侧面（原型朝左，朝右镜像）：鼻尖突出 1px，下颌斜着收 ----
    const f = (x: number, w = 1): number => mx(x, w)
    // 顶发：9 → 11 → 13 宽，前额只压一小撮，别把脸盖住
    r(g, f(9, 8), 1 + hy, 8, 1, hair)
    r(g, f(7, 11), 2 + hy, 11, 1, hair)
    r(g, f(6, 13), 3 + hy, 13, 1, hair)
    r(g, f(9, 4), 1 + hy, 4, 1, hairHi)
    r(g, f(7, 5), 2 + hy, 5, 1, hairHi)
    r(g, f(6, 4), 3 + hy, 4, 1, hairHi)
    r(g, f(15, 3), 2 + hy, 3, 1, hairDark)
    r(g, f(17, 2), 3 + hy, 2, 1, hairDark)
    // 后脑：5 → 4 → 3 宽，发尾顺着下颌线收回去
    r(g, f(13, 5), 4 + hy, 5, 6, hair)        // y4..y9
    r(g, f(13, 4), 10 + hy, 4, 2, hair)       // y10..y11
    r(g, f(13, 3), 12 + hy, 3, 2, hair)       // y12..y13
    r(g, f(13, 1), 4 + hy, 1, 10, hairDark)   // 与脸的交界压暗
    r(g, f(17, 1), 4 + hy, 1, 6, hairDark)
    r(g, f(15, 2), 5 + hy, 2, 1, hairHi)
    px(g, f(16, 1), 7 + hy, hairHi)
    px(g, f(14, 1), 11 + hy, hairHi)
    // 前额一绺斜垂的刘海 + 鬓角（只到太阳穴，不压眼睛）
    r(g, f(6, 2), 4 + hy, 2, 1, hair)
    px(g, f(6, 1), 4 + hy, hairHi)
    r(g, f(6, 1), 5 + hy, 1, 3, hair)
    // 脸：额到颧 7 宽（x6..x12），下颌 6，下巴 5
    r(g, f(6, 7), 4 + hy, 7, 6, skin)
    r(g, f(7, 6), 10 + hy, 6, 2, skin)
    r(g, f(8, 5), 12 + hy, 5, 2, skin)
    const faceL = mirror ? f(8, 5) : f(6, 1)
    const faceR = mirror ? f(6, 1) : f(12, 1)
    r(g, faceL, 4 + hy, 1, 6, skinHi)
    r(g, faceR, 4 + hy, 1, 6, skinShade)
    r(g, faceL, 10 + hy, 1, 2, skinHi)
    r(g, faceR, 10 + hy, 1, 2, skinShade)
    // 鼻尖（朝前突出 1px），鼻底压暗
    px(g, mirror ? f(13, 1) : f(5, 1), 8 + hy, skin)
    px(g, mirror ? f(13, 1) : f(5, 1), 9 + hy, skinShade)
    // 只露一只眼：靠前侧瞳孔 + 靠后侧眼白
    px(g, f(9, 1), 5 + hy, brow)
    px(g, f(10, 1), 5 + hy, brow)
    px(g, mirror ? f(10, 1) : f(9, 1), 7 + hy, cc.eye)
    px(g, mirror ? f(9, 1) : f(10, 1), 7 + hy, eyeW)
    // 嘴
    px(g, f(9, 1), 11 + hy, lip)
    px(g, f(10, 1), 11 + hy, cc.skinShade)
  }

  // ---- 颈 ----
  r(g, 11, 14 + hy, 2, 1, cc.skinShade)

  // ---- 领口与胸饰：银灰立领 + V 形银饰 ----
  if (dir === 'up') {
    // 背面：后领一圈银边
    r(g, 9, ty, 6, 1, silver)
    px(g, 9, ty, silverHi)
    px(g, 14, ty, silverLo)
    r(g, 9, ty + 1, 6, 1, cc.coatDark)
    px(g, 11, ty + 1, silverLo)
  } else if (dir === 'down') {
    // 立领：上缘亮银，两侧立边，中间是深色领内
    r(g, 9, ty, 6, 1, silver)
    px(g, 9, ty, silverHi)
    px(g, 14, ty, silverLo)
    px(g, 9, ty + 1, silver)
    px(g, 14, ty + 1, silver)
    r(g, 10, ty + 1, 4, 1, cc.coatDark)
    // V 形银饰：6 点从两肩收成一个尖（16×24 上只放得下 3 点）
    px(g, 9, ty + 2, silverHi)
    px(g, 14, ty + 2, silver)
    px(g, 10, ty + 3, silverHi)
    px(g, 13, ty + 3, silver)
    px(g, 11, ty + 4, silverHi)
    px(g, 12, ty + 4, silver)
  } else {
    // 侧面：只画朝向镜头的那半边 V
    r(g, mx(9, 6), ty, 6, 1, silver)
    px(g, mirror ? mx(9, 6) : mx(9, 1), ty, silverHi)
    px(g, mx(9, 1), ty + 1, silver)
    r(g, mx(10, 4), ty + 1, 4, 1, cc.coatDark)
    px(g, mirror ? mx(13, 1) : mx(9, 1), ty + 2, silverHi)
    px(g, mirror ? mx(12, 1) : mx(10, 1), ty + 3, silverHi)
    px(g, mirror ? mx(11, 1) : mx(11, 1), ty + 4, silver)
  }

  return c
}

// ============================================================
// 艾玛：24×32 行走图 —— 银白淡紫长发 + 白蕾丝女仆帽 + 紫灰眼
//       + 深紫黑衣身 + 白围裙肩带 + 黑蝴蝶结
// ============================================================
/**
 * 24×32，四方向 × 三帧。头部占 y1..y13（13 行）：
 *   蕾丝帽 y1（帽冠）/ y2（帽檐）/ y3（波浪齿），脸 y4..y13。
 *   脸型同样是上宽下窄：额 8 → 颧 10 → 下颌 7 → 下巴 6。
 *   眼睛 y7：每只 2×1，外侧眼白 + 靠鼻梁的紫灰瞳孔，与弗里德里希行号一致。
 *
 * 身体：白硬领 y15 + 黑蝴蝶结 y16（两翼 + 结心 + 两条短尾）+ 白围裙肩带
 *       x9 / x14（y17..y20）；裙摆 y20..y27 上窄下宽，行走时下摆左右摆 1px。
 */
function drawMaid(cc: CharColors, dir: Dir, frame: number): Sprite {
  const { c, g } = canvas(24, 32)
  const mirror = dir === 'right'
  const mx = (x: number, w = 1): number => (mirror ? 24 - x - w : x)
  const bob = frame === 1 ? -1 : 0
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0
  const liftL = frame === 1 ? 1 : 0
  const liftR = frame === 2 ? 1 : 0
  const sway = frame === 1 ? 1 : frame === 2 ? -1 : 0
  const hy = bob
  const apron = cc.apron ?? C.sugar
  const hat = cc.hat ?? '#fdfcf4'
  const hatLo = cc.hatLo ?? C.pale
  const bow = cc.bow ?? C.night
  const bowHi = cc.bowHi ?? C.graphite
  const brow = cc.brow ?? cc.eyeDark ?? cc.hairDark
  const lip = cc.lip ?? '#b87c86'
  const eyeW = cc.eyeWhite ?? C.sugar
  const { hair, hairHi, hairDark, skin, skinShade, skinHi } = cc

  // ---- 影子 ----
  r(g, 5, 31, 14, 1, 'rgba(0,0,0,0.42)')
  r(g, 6, 30, 12, 1, 'rgba(0,0,0,0.20)')

  // ---- 鞋：裙下只露出一点；抬脚那侧压暗一档 ----
  if (dir === 'down' || dir === 'up') {
    r(g, 9, 28 - liftL, 2, 3, liftL ? cc.coatDark : cc.shoe)
    px(g, 9, 28 - liftL, liftL ? cc.pants : cc.coatHi)
    r(g, 14, 28 - liftR, 2, 3, liftR ? cc.coatDark : cc.shoe)
    px(g, 14, 28 - liftR, liftR ? cc.pants : cc.coatHi)
  } else {
    const lead = frame === 1 ? 1 : 0
    const back = frame === 2 ? 1 : 0
    const f = (x: number, w = 1): number => mx(x, w)
    r(g, f(13 + back, 2), 28, 2, 3, cc.shoe)
    r(g, f(9 - lead, 2), 28, 2, 3, cc.shoe)
  }

  // ---- 长裙：上窄下宽，下摆随行走左右摆 ----
  const ty = 15 + bob
  const bodyH = 19 - ty + 1
  const hem = 27
  // 裙身
  r(g, 8, 20, 8, 1, cc.coat)
  r(g, 7, 21, 10, 1, cc.coat)
  r(g, 6, 22, 12, hem - 22, cc.coat)
  // 下摆最下三行左右摆 1px
  r(g, 6 + sway, 25, 12, 1, cc.coat)
  r(g, 6 + sway, 26, 12, 1, cc.coat)
  r(g, 6 + sway, 27, 12, 1, cc.coatDark)
  // 受光 / 背光 / 褶
  r(g, 8, 20, 8, 1, cc.coatHi)
  r(g, 7, 21, 1, 1, cc.coatHi)
  r(g, 6, 22, 1, 5, cc.coatHi)
  r(g, 6 + sway, 25, 1, 3, cc.coatHi)
  r(g, 17, 22, 1, 3, cc.coatDark)
  r(g, 17 + sway, 25, 1, 3, cc.coatDark)
  px(g, 11, 23, cc.coatDark)
  px(g, 12, 25, cc.coatDark)
  // 裙褶与腰线：破开一大块深紫，裙摆才有体积
  r(g, 9, 20, 1, 3, cc.coatHi)
  px(g, 13, 23, cc.coatHi)
  px(g, 10, 25, cc.coatHi)
  r(g, 8, 20, 8, 1, cc.coatDark)

  // ---- 手臂：泡泡袖 + 深紫前臂 + 白袖口 ----
  if (dir === 'down' || dir === 'up') {
    const aL = 16 + bob + swing
    const aR = 16 + bob - swing
    // 泡泡袖
    r(g, 6, aL, 2, 3, cc.coat)
    px(g, 6, aL, cc.coatHi)
    r(g, 16, aR, 2, 3, cc.coatDark)
    // 前臂
    r(g, 6, aL + 3, 2, 3, cc.coat)
    px(g, 6, aL + 3, cc.coatHi)
    r(g, 16, aR + 3, 2, 3, cc.coatDark)
    // 白袖口 + 手
    r(g, 6, aL + 6, 2, 1, apron)
    r(g, 16, aR + 6, 2, 1, apron)
    px(g, 6, aL + 7, cc.skinShade)
    px(g, 16, aR + 7, cc.skinShade)
  } else {
    const f = (x: number, w = 1): number => mx(x, w)
    const aY = 16 + bob + swing
    r(g, f(7, 2), aY, 2, 3, cc.coat)
    px(g, mirror ? f(7, 2) : f(7, 1), aY, cc.coatHi)
    r(g, f(7, 2), aY + 3, 2, 3, cc.coat)
    r(g, f(7, 2), aY + 6, 2, 1, apron)
    px(g, f(7, 1), aY + 7, cc.skinShade)
    // 远侧手臂只露一窄条
    r(g, f(13, 1), 16 + bob - swing, 1, 6, cc.coatDark)
  }

  // ---- 躯干 ----
  r(g, 8, ty, 8, bodyH, cc.coat)
  r(g, 8, ty, 1, bodyH, cc.coatHi)
  r(g, 15, ty, 1, bodyH, cc.coatDark)

  // ---- 头 ----
  /** 白蕾丝帽：帽冠 1 行 + 帽檐 1 行 + 波浪齿 1 行 */
  const cap = (): void => {
    // 帽冠
    r(g, 9, 1 + hy, 6, 1, hat)
    px(g, 9, 1 + hy, '#ffffff')
    px(g, 14, 1 + hy, hatLo)
    // 帽檐（比脸宽一圈）
    r(g, 6, 2 + hy, 12, 1, hat)
    r(g, 6, 2 + hy, 3, 1, '#ffffff')
    r(g, 16, 2 + hy, 2, 1, hatLo)
    // 帽檐下缘的波浪齿：白与发根交替
    r(g, 6, 3 + hy, 12, 1, hairDark)
    for (const x of [6, 8, 10, 12, 14, 16]) px(g, x, 3 + hy, hat)
    px(g, 5, 3 + hy, hatLo)
    px(g, 17, 3 + hy, hatLo)
  }

  if (dir === 'up') {
    cap()
    // 后脑：整片银发，14 → 12 → 10 宽收下来，一路垂到肩下
    r(g, 5, 4 + hy, 14, 8, hair)              // y4..y11
    r(g, 6, 12 + hy, 12, 2, hair)             // y12..y13
    r(g, 5, 14 + hy, 4, 4, hair)              // 左肩垂发 y14..y17
    r(g, 15, 14 + hy, 4, 4, hair)             // 右肩垂发
    r(g, 5, 18 + hy, 3, 1, hairDark)
    r(g, 16, 18 + hy, 3, 1, hairDark)
    r(g, 5, 4 + hy, 1, 10, hairHi)
    r(g, 18, 4 + hy, 1, 10, hairDark)
    r(g, 6, 12 + hy, 1, 2, hairHi)
    r(g, 17, 12 + hy, 1, 2, hairDark)
    // 后脑只走横向受光带（孤立暗点会读成眼睛）
    r(g, 7, 5 + hy, 4, 1, hairHi)
    r(g, 11, 8 + hy, 4, 1, hairHi)
    r(g, 8, 13 + hy, 3, 1, hairHi)
    r(g, 13, 6 + hy, 2, 1, hairDark)
    px(g, 16, 5 + hy, hairHi)
    // 中缝与竖发丝：银发也要有体积
    r(g, 11, 4 + hy, 1, 8, hairDark)
    r(g, 8, 6 + hy, 1, 5, hairDark)
    r(g, 15, 7 + hy, 1, 4, hairDark)
    r(g, 6, 10 + hy, 2, 1, hairHi)
    r(g, 12, 12 + hy, 3, 1, hairHi)
    // 后颈
    r(g, 11, 13 + hy, 2, 1, cc.skinShade)
    // 背面：白领后缘 + 两条肩带（蝴蝶结在身前，看不见）
    r(g, 9, ty, 6, 1, apron)
    px(g, 9, ty, '#ffffff')
    px(g, 14, ty, hatLo)
    r(g, 9, ty + 2, 1, 4, apron)
    r(g, 14, ty + 2, 1, 4, apron)
    px(g, 9, ty + 2, '#ffffff')
  } else if (dir === 'down') {
    // 长发（先铺满，再把脸压上去）
    r(g, 5, 4 + hy, 14, 10, hair)             // y4..y13
    r(g, 5, 14 + hy, 3, 2, hair)              // 左垂发 y14..y15
    r(g, 16, 14 + hy, 3, 2, hair)             // 右垂发
    r(g, 5, 4 + hy, 1, 12, hairHi)
    r(g, 18, 4 + hy, 1, 12, hairDark)
    r(g, 6, 5 + hy, 1, 8, hairHi)
    r(g, 17, 5 + hy, 1, 8, hairDark)
    r(g, 5, 16 + hy, 2, 1, hairDark)          // 发梢
    r(g, 17, 16 + hy, 2, 1, hairDark)
    // 外鼓的一卷
    r(g, 4, 8 + hy, 1, 3, hair)
    r(g, 19, 8 + hy, 1, 3, hair)
    px(g, 4, 8 + hy, hairHi)
    px(g, 19, 8 + hy, hairDark)
    cap()

    // 脸（上宽下窄）：额头 10 → 颧 10 → 下颌 7 → 下巴 6
    r(g, 7, 4 + hy, 10, 1, skin)
    r(g, 7, 5 + hy, 10, 5, skin)
    r(g, 9, 10 + hy, 7, 2, skin)
    r(g, 9, 12 + hy, 6, 2, skin)
    r(g, 7, 4 + hy, 1, 2, skinHi)
    r(g, 16, 4 + hy, 1, 2, skinShade)
    r(g, 7, 6 + hy, 1, 4, skinHi)
    r(g, 16, 6 + hy, 1, 4, skinShade)
    r(g, 9, 10 + hy, 1, 2, skinHi)
    r(g, 15, 10 + hy, 1, 2, skinShade)
    r(g, 9, 12 + hy, 1, 1, skinHi)
    r(g, 14, 12 + hy, 1, 2, skinShade)
    // 齐刘海：额角两撮 + 三处发根点
    px(g, 8, 4 + hy, hairDark)
    px(g, 11, 4 + hy, hairDark)
    px(g, 14, 4 + hy, hairDark)
    r(g, 7, 5 + hy, 1, 2, hair)
    r(g, 16, 5 + hy, 1, 2, hairDark)
    // 眉 y5
    r(g, 9, 5 + hy, 2, 1, brow)
    r(g, 13, 5 + hy, 2, 1, brow)
    // 眼 y7：外侧眼白 + 内侧紫灰瞳孔
    px(g, 9, 7 + hy, eyeW)
    px(g, 10, 7 + hy, cc.eye)
    px(g, 13, 7 + hy, cc.eye)
    px(g, 14, 7 + hy, eyeW)
    // 鼻 y9、嘴 y11
    px(g, 11, 9 + hy, skinHi)
    px(g, 12, 9 + hy, skinShade)
    r(g, 11, 11 + hy, 2, 1, lip)
    px(g, 13, 11 + hy, skinShade)
    px(g, 10, 13 + hy, skinShade)
    px(g, 13, 13 + hy, skinShade)
  } else {
    // ---- 侧面（原型朝左，朝右镜像）----
    const f = (x: number, w = 1): number => mx(x, w)
    // 后脑的长发：6 → 5 → 4 宽，发尾垂到肩下；与脸的交界压暗
    r(g, f(13, 6), 4 + hy, 6, 10, hair)       // y4..y13
    r(g, f(13, 5), 14 + hy, 5, 2, hair)       // y14..y15
    r(g, f(14, 4), 16 + hy, 4, 1, hair)
    r(g, f(13, 1), 4 + hy, 1, 13, hairDark)
    r(g, f(18, 1), 4 + hy, 1, 10, hairDark)
    r(g, f(16, 2), 5 + hy, 2, 1, hairHi)
    r(g, f(15, 1), 9 + hy, 1, 3, hairHi)
    px(g, f(17, 1), 12 + hy, hairHi)
    // 额前的一缕（只在太阳穴，不压眼睛与鼻子）
    r(g, f(6, 2), 4 + hy, 2, 2, hair)
    r(g, f(5, 1), 5 + hy, 1, 4, hair)
    r(g, f(4, 1), 8 + hy, 1, 2, hairDark)     // 外鼓的一卷
    // 帽
    cap()
    // 脸：额到颧 7 宽（x6..x12），下颌 6，下巴 5；鼻尖突出 1px
    r(g, f(6, 7), 5 + hy, 7, 5, skin)
    r(g, f(7, 6), 10 + hy, 6, 2, skin)
    r(g, f(8, 5), 12 + hy, 5, 2, skin)
    const faceL = mirror ? f(8, 5) : f(6, 1)
    const faceR = mirror ? f(6, 1) : f(12, 1)
    r(g, faceL, 5 + hy, 1, 5, skinHi)
    r(g, faceR, 5 + hy, 1, 5, skinShade)
    r(g, faceL, 10 + hy, 1, 2, skinHi)
    r(g, faceR, 10 + hy, 1, 2, skinShade)
    // 鼻尖
    px(g, mirror ? f(13, 1) : f(5, 1), 8 + hy, skin)
    px(g, mirror ? f(13, 1) : f(5, 1), 9 + hy, skinShade)
    // 一只眼：靠前侧瞳孔 + 靠后侧眼白
    px(g, f(9, 1), 5 + hy, brow)
    px(g, f(10, 1), 5 + hy, brow)
    px(g, mirror ? f(10, 1) : f(9, 1), 7 + hy, cc.eye)
    px(g, mirror ? f(9, 1) : f(10, 1), 7 + hy, eyeW)
    // 嘴
    px(g, f(9, 1), 11 + hy, lip)
    px(g, f(10, 1), 11 + hy, cc.skinShade)
  }

  // ---- 领口 / 黑蝴蝶结 / 白围裙肩带 ----
  // 颈：头与身体之间不能漏一行背景
  r(g, 11, 14 + hy, 2, 1, cc.skinShade)
  if (dir === 'down') {
    // 白圆领：三行，中间宽一格 —— 黑蝴蝶结要有白底才看得出来（对照立绘的
    // 白色硬领 + 中央黑缎带）。领口本身不是围裙，围裙只有下面的两条肩带。
    r(g, 9, ty, 6, 1, apron)
    r(g, 8, ty + 1, 8, 1, apron)
    r(g, 9, ty + 2, 6, 1, apron)
    px(g, 9, ty, '#ffffff')
    px(g, 8, ty + 1, '#ffffff')
    px(g, 15, ty + 1, hatLo)
    px(g, 14, ty + 2, hatLo)
    // 黑蝴蝶结：两翼 + 结心 + 两条短尾（全落在白领上，形状才读得出来）
    r(g, 9, ty + 1, 2, 1, bow)
    r(g, 13, ty + 1, 2, 1, bow)
    r(g, 11, ty + 1, 2, 1, bow)
    px(g, 11, ty + 1, bowHi)
    px(g, 9, ty + 1, bowHi)
    px(g, 14, ty + 1, bowHi)
    r(g, 11, ty + 2, 2, 1, bow)
    px(g, 11, ty + 2, bowHi)
    // 白围裙：只露两条肩带
    r(g, 9, ty + 3, 1, 3, apron)
    r(g, 14, ty + 3, 1, 3, apron)
    px(g, 9, ty + 3, '#ffffff')
    px(g, 14, ty + 5, hatLo)
  } else if (dir === 'up') {
    // 背面的白领与肩带在头部段落里已画
  } else {
    // 侧面：白领只露前缘，蝴蝶结只画朝向镜头的那半边
    const f = (x: number, w = 1): number => mx(x, w)
    r(g, f(9, 4), ty, 4, 1, apron)
    r(g, f(9, 4), ty + 1, 4, 1, apron)
    px(g, f(9, 1), ty, '#ffffff')
    px(g, f(12, 1), ty + 1, hatLo)
    r(g, f(10, 2), ty + 1, 2, 1, bow)
    px(g, f(10, 1), ty + 1, bowHi)
    r(g, f(11, 1), ty + 2, 1, 1, bow)
    // 肩带只有一条
    r(g, f(10, 1), ty + 3, 1, 3, apron)
    px(g, f(10, 1), ty + 3, '#ffffff')
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
// 立绘（96×96）：1:1 方形头像，只画到头与肩。
//
// 【两个人不共用一套脸部比例】—— 本段最重要的一条约束。
//   弗里德里希  可见脸 y23..y58（36 行）× 宽 28  →  1.29 : 1
//               细长眼 6×2（位于脸的上 1/3）、颧骨最宽、方下巴。
//               头发 44 宽（比脸宽 16），卷发体量 + 上翻的刘海。
//   艾玛        可见脸 y28..y56（29 行）× 宽 32  →  0.91 : 1
//               巨大圆眼 10×7（位于可见脸自顶向下 36% 处）、短圆下巴、无颧骨。
// 两张脸的脸型数组、五官行号、眼形各写一份，互不引用：
// 上一轮把艾玛画出四十岁，根子就是两人共用一套行号 ——
// 她的眼睛被压成了男主角的细长眼，脸又被拉成同一副长脸。
//
// 共同边界（只有这些共用）：
//   弗里德里希：发 y0..y22 / 脸 y21..y58 / 颈 y59..y61 / 肩 y64..y95
//   艾玛      ：帽 y0..y15 / 发 y6..y31 / 脸 y17..y56 / 颈 y57..y60 / 肩 y63..y95
// 光源统一在左上；每块至少 暗 / 中 / 亮 三档；背景透明；全部 fillRect。
// ============================================================

/** 立绘画布：96×96 —— 对话框里按 2 倍显示成 192×192（整数放大不糊） */
const PW = 96
const PH = 96

/** 96 宽的中轴在 47.5：偶数宽以此左右对称，奇数宽偏左半像素（受光侧） */
function midLeft(w: number): number {
  return 48 - ((w + 1) >> 1)
}

/** 对 47.5 中轴镜像一个 x 坐标（w 为被镜像元素的宽度） */
function mir(x: number, w = 1): number {
  return 95 - x - w
}

/** 以中轴为心画一行宽 w 的横段 */
function midRow(g: Ctx, y: number, w: number, col: string): void {
  r(g, midLeft(w), y, w, 1, col)
}

/** Bresenham 直线：V 形银饰、卷草、发丝都用它（像素级，不插值） */
function line(g: Ctx, x0: number, y0: number, x1: number, y1: number, col: string): void {
  let dx = Math.abs(x1 - x0)
  let dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  for (;;) {
    px(g, x0, y0, col)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x0 += sx }
    if (e2 < dx) { err += dx; y0 += sy }
  }
}

/**
 * 一个发卷：一段椭圆弧，外缘亮、内缘暗。
 * 弗里德里希的头发全靠五六个这样的卷撑起来 —— 没有卷，红发就是一块红布。
 */
function curl(
  g: Ctx, cx: number, cy: number, rx: number, ry: number,
  a0: number, a1: number, hi: string, dark: string,
): void {
  for (let a = a0; a <= a1; a += 0.1) {
    const x = Math.round(cx + Math.cos(a) * rx)
    const y = Math.round(cy + Math.sin(a) * ry)
    px(g, x, y, hi)
    const x2 = Math.round(cx + Math.cos(a) * (rx - 2))
    const y2 = Math.round(cy + Math.sin(a) * (ry - 2))
    px(g, x2, y2, dark)
  }
}

/** 立绘配色：三阶明暗全部由调用方给足（不做任何运行时混色） */
interface PortraitPal {
  skin: string
  skinHi: string
  skinShade: string
  hair: string
  hairHi: string
  hairDark: string
  /** 描边：白帽 / 银发这类浅色都靠它把自己与旁边的浅色分开 */
  outline?: string
  eye: string
  eyeHi: string
  eyeDark: string
  /** 上眼睑 / 上睫毛的一道线（比 eyeDark 更黑，眼睛才立得住） */
  eyeLid: string
  lip: string
  /** 眉：与头发同族的深色 */
  brow: string
  coat: string
  coatHi: string
  coatDark: string
  collar: string
  /** 领结（赫尔曼的银灰领结 / 彩蛋角色的蓝蝴蝶结） */
  bow?: string
  /** 围裙（艾玛 / 玛尔塔 / 彩蛋角色） */
  apron?: string
  /** 头巾（玛尔塔） */
  kerchief?: string
  /** 领口小饰物 */
  pin?: string
  hairStyle?: 'slick' | 'kerchief' | 'ringlet'
  /** 表情：只有配角用得上（grin 张嘴 / smile 嘴角抬）；两位主角各有自己的绘制函数 */
  mood?: 'calm' | 'cold' | 'quiet' | 'smile' | 'grin'
}

/** 眼白：偏冷的一档白（参考图里的眼白是 #f4f6fa 一类的冷白） */
const EYE_WHITE = '#f6f8fc'
const EYE_WHITE_LO = '#d2d8e4'

// ============================================================
// 弗里德里希 —— 长脸细眼
//   脸 y21..y58（38 行），刘海盖到 y22 → 可见 36 行，最宽 28 → 1.29 : 1
//   眼 6×2：虹膜 4px、左右各 1px 眼白；眼中心 y34.5，落在脸的上 1/3
// ============================================================

const FTZ_FACE_TOP = 21
const FTZ_BROW_Y = 30
const FTZ_EYE_TOP = 33      // 上眼睑：一道明确横线
const FTZ_EYE_MID = 34      // 虹膜上半（亮）
const FTZ_EYE_LOW = 35      // 虹膜下半（深）
const FTZ_NOSE_Y = 42
const FTZ_MOUTH_Y = 49
const FTZ_FACE_BOT = 58
const FTZ_NECK_TOP = 59
const FTZ_SHOULDER = 64
const FTZ_OUTLINE = '#5c1620'

/**
 * 脸型逐行宽度（38 行，y21..y58）。
 * 额头窄 → 颧骨 28 只在中间 → 下颌**一行一行地**收到 17（弧形），
 * 不是从 24 一落到底的 18：那一下就是"方下颌、平板脸"的全部来源。
 * 下巴底留两行 17，所以仍然是方的，只是有弧度。
 */
const FTZ_FACE: number[] = [
  20, 22, 24,                                           // y21..y23 额头顶（被刘海压住大半）
  25, 26, 27,                                           // y24..y26
  27, 28, 28, 28, 28, 28, 28, 28, 28,                   // y27..y35 太阳穴 → 颧骨
  27, 27, 27, 27,                                       // y36..y39
  27, 27, 27,                                           // y40..y42 鼻翼高度
  26, 26,                                               // y43..y44
  25, 25,                                               // y45..y46
  24, 24,                                               // y47..y48
  23, 23,                                               // y49..y50
  22, 22,                                               // y51..y52
  20, 20,                                               // y53..y54 下颌角
  18, 18,                                               // y55..y56
  17, 17,                                               // y57..y58 方下巴（平底但已收成弧）
]

/**
 * 头发轮廓（y0..y22）：[左缘, 宽]。
 * 最宽 44（x26..x69），比 28 宽的脸大 16px —— 参考图里头发与脸的宽度比约 1.5:1，
 * 头发若只宽出 4px，整颗头就会读成一顶扣在脸上的头盔。
 */
const FTZ_HAIR: [number, number][] = [
  [36, 18], [34, 22], [32, 26], [30, 30], [29, 32], [28, 34], [27, 38],
  [26, 42], [26, 44], [26, 44], [26, 44], [26, 44], [26, 44], [26, 44],
  [26, 44], [26, 44], [27, 42], [28, 40], [29, 38], [30, 36], [31, 34],
  [32, 32], [34, 28],
]

/** 肩：从 y64 的 30 宽展开到 y86 的 88 宽（32 行）—— 两侧各留 4px，
 *  摊到画布边缘的肩会读成一件"披风"，而不是一个人。 */
const FTZ_SHOULDER_W: number[] = [
  15, 18, 21, 24, 27, 30, 33,
  35, 37, 39, 40, 41, 42, 42,
  43, 43, 44, 44, 44, 44,
  44, 44, 44, 44, 44, 44, 44, 44, 44, 44, 44, 44,
]

const FTZ_PORTRAIT: PortraitPal = {
  skin: '#f7d2b8',
  skinHi: '#ffe2c8',
  skinShade: '#d6a68a',
  hair: '#c02a2f',
  hairHi: '#e85540',
  hairDark: '#7a1720',
  outline: FTZ_OUTLINE,
  eye: '#2f5aa8',
  eyeHi: '#6ea3e6',
  eyeDark: '#101a30',
  eyeLid: '#241f38',
  lip: '#b0705f',
  brow: '#7c2a24',
  coat: '#1a1d24',
  coatHi: '#2f3644',
  coatDark: '#0b0d11',
  collar: SILVER.mid,
}

/**
 * 弗里德里希的立绘。
 * cold：不换脸，只把眉压低一行、上眼睑压下来、嘴角收平 —— 脸型一律不动。
 */
function portraitFriedrich(cold = false): Sprite {
  const { c, g } = canvas(PW, PH)
  const p = FTZ_PORTRAIT
  const ol = FTZ_OUTLINE
  const both = (x: number, y: number, w: number, h: number, col: string): void => {
    r(g, x, y, w, h, col)
    r(g, mir(x, w), y, w, h, col)
  }

  // ---------- 肩与制服（最底层）----------
  for (let i = 0; i < FTZ_SHOULDER_W.length; i++) {
    const y = FTZ_SHOULDER + i
    const hw = FTZ_SHOULDER_W[i]
    const x0 = 48 - hw
    r(g, x0, y, hw * 2, 1, p.coat)
    r(g, x0, y, 3, 1, p.coatHi)               // 左上受光
    r(g, 45 + hw, y, 3, 1, p.coatDark)        // 右下背光
    if (i < 20) px(g, x0, y, '#54607a')       // 肩线的高光边（斜边上 1px）
  }
  // 袖子与身体的接缝：从肩点斜下的一道暗线，黑制服才不是一块黑板
  line(g, 30, 71, 20, 95, p.coatHi)
  line(g, 65, 71, 75, 95, p.coatDark)
  line(g, 29, 72, 19, 95, p.coatDark)
  line(g, 66, 72, 76, 95, p.coatHi)
  // 肩头的一道亮面：肩线下方 3 行，肩才有厚度（没有它，肩就是一个平面梯形）
  both(34, 66, 9, 1, '#3d4759')
  both(32, 67, 11, 1, '#39424f')
  both(30, 68, 11, 1, '#333c4a')
  both(27, 70, 11, 1, '#2c3442')
  // 袖子上的褶皱：几道短斜线，黑袖子才不是一片死黑
  line(g, 24, 78, 27, 84, p.coatDark)
  line(g, 22, 83, 24, 89, p.coatDark)
  line(g, 71, 78, 68, 84, p.coatDark)
  line(g, 73, 83, 71, 89, p.coatDark)
  line(g, 26, 76, 28, 80, '#3d4759')
  line(g, 69, 76, 67, 80, '#1f2530')

  // ---------- 胸前的 V 形银饰 ----------
  // 两道银线从立领两侧斜下，在胸口中央汇聚成尖；内侧是比袖子亮一档的胸甲板。
  const V_TOP = 67
  const V_SPAN = 26
  for (let i = 0; i <= V_SPAN; i++) {
    const y = V_TOP + i
    const xl = Math.round(35 + i * 0.42)
    const xr = Math.round(60 - i * 0.42)
    if (xr - xl > 3) r(g, xl + 2, y, xr - xl - 3, 1, '#2a3240')   // 胸甲板（比袖子亮）
    px(g, xl, y, SILVER.hi)                                        // 左斜线（受光）
    px(g, xl + 1, y, SILVER.mid)
    px(g, xr, y, SILVER.lo)                                        // 右斜线（背光）
    px(g, xr - 1, y, SILVER.mid)
  }
  r(g, 46, V_TOP + V_SPAN + 1, 4, 1, SILVER.mid)                   // V 的尖收口

  // ---- 中央的椭圆形宝石座（参考图 V 饰正中那颗：银座 + 暗色宝石）----
  const GEM_CX = 47
  const GEM_CY = 83
  const GEM_W = [4, 6, 8, 9, 10, 10, 10, 10, 10, 10, 10, 9, 8, 6, 4]
  for (let i = 0; i < GEM_W.length; i++) {
    const w = GEM_W[i]
    const y = GEM_CY - 7 + i
    const x0 = GEM_CX - (w >> 1)
    r(g, x0, y, w, 1, SILVER.mid)                        // 座圈
    if (w >= 6) r(g, x0 + 1, y, w - 2, 1, '#39445a')     // 宝石本体（暗，不是一块白椭圆）
    if (w >= 8) {
      px(g, x0 + 1, y, SILVER.hi)                        // 座圈的左上受光
      px(g, x0 + 2, y, '#8fa2bd')                        // 宝石的受光面
      px(g, x0 + w - 2, y, SILVER.lo)
    }
  }
  px(g, 46, 78, '#e8f2ff')                               // 宝石上的一点高光
  px(g, 47, 78, '#c8d8ee')

  // ---- 宝石座两侧的卷草回旋（两道向内卷的银线，不是直线）----
  const scroll = (cx: number, cy: number, sgn: number): void => {
    for (let t = 0; t < 9.5; t += 0.32) {
      const rad = 5 - t * 0.46
      const a = t - Math.PI
      const x = Math.round(cx + Math.cos(a) * rad * sgn)
      const y = Math.round(cy + Math.sin(a) * rad)
      px(g, x, y, t < 1.2 ? SILVER.hi : SILVER.mid)
    }
  }
  scroll(33, 82, 1)
  scroll(62, 82, -1)
  // 卷草与 V 线之间的一道亮钩（把纹样接回斜线）
  line(g, 38, 77, 41, 80, SILVER.hi)
  line(g, 57, 77, 54, 80, SILVER.mid)

  // ---- 肩章：三道短银线，平行于肩的斜边 ----
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < 5; i++) {
      both(36 + k * 3 - i, 65 + k + i, 1, 1, k === 0 ? SILVER.hi : SILVER.mid)
    }
  }

  // ---------- 颈（4 行，其余被立领吃掉）----------
  r(g, 42, FTZ_NECK_TOP, 12, 1, p.skinShade)         // 下颌投在颈上的阴影
  r(g, 41, FTZ_NECK_TOP + 1, 14, 3, p.skin)          // 颈干 y60..y62
  r(g, 41, FTZ_NECK_TOP + 1, 1, 3, p.skinHi)
  r(g, 54, FTZ_NECK_TOP + 1, 1, 3, p.skinShade)
  px(g, 47, FTZ_NECK_TOP + 2, p.skinShade)           // 颈中的一道浅影（脖子是圆柱）

  // ---------- 立领：银灰包边，一直立到下颌 ----------
  r(g, 38, 63, 20, 1, SILVER.mid)                    // 领口上缘
  r(g, 38, 63, 7, 1, SILVER.hi)                      // 左上受光
  r(g, 52, 63, 6, 1, SILVER.lo)                      // 右上背光
  r(g, 38, 64, 2, 6, SILVER.lo)                      // 左立边
  r(g, 55, 64, 2, 6, SILVER.lo)                      // 右立边
  r(g, 40, 64, 15, 6, '#0e1116')                     // 领内（高领包住脖子）
  r(g, 47, 64, 2, 5, SILVER.lo)                      // 领中的银扣缝
  px(g, 47, 65, SILVER.hi)
  px(g, 48, 68, SILVER.hi)
  r(g, 38, 70, 20, 1, '#0a0c10')                     // 领子下缘压进肩

  // ---------- 脸 ----------
  for (let i = 0; i < FTZ_FACE.length; i++) {
    const y = FTZ_FACE_TOP + i
    const w = FTZ_FACE[i]
    const x0 = midLeft(w)
    r(g, x0, y, w, 1, p.skin)
    // 右下背光：右缘 1px，只到下颌（再往里就成两颊凹陷）
    if (y >= 28 && y <= 54) px(g, x0 + w - 1, y, p.skinShade)
  }
  // ---- 面部的三块光：额头一道亮、左颊一道亮、右下颌一道暗 ----
  // 28×38 的纯色皮肤就是一张纸片；有这三块，才有一张有骨相的脸。
  for (let y = 24; y <= 32; y++) {
    const w = FTZ_FACE[y - FTZ_FACE_TOP]
    const x0 = midLeft(w)
    r(g, x0 + 2, y, w - 6, 1, p.skinHi)
  }
  for (let y = 33; y <= 42; y++) {
    const w = FTZ_FACE[y - FTZ_FACE_TOP]
    const x0 = midLeft(w)
    r(g, x0 + 1, y, 4, 1, p.skinHi)              // 左颧骨的受光
    r(g, x0 + w - 4, y, 3, 1, p.skinShade)       // 右颊的背光
  }
  for (let y = 43; y <= 54; y++) {
    const w = FTZ_FACE[y - FTZ_FACE_TOP]
    const x0 = midLeft(w)
    r(g, x0 + w - 4, y, 3, 1, p.skinShade)       // 右下颌的暗面
  }
  // 刘海投在额头上的影子：贴着每一绺的形状，参差地压一行
  r(g, 34, 28, 6, 1, p.skinShade)
  r(g, 40, 26, 4, 1, p.skinShade)
  r(g, 44, 24, 7, 1, p.skinShade)
  r(g, 52, 23, 7, 1, p.skinShade)
  // 下巴底：方下巴靠一道短平阴影收住，不靠尖
  r(g, 41, FTZ_FACE_BOT - 1, 14, 1, p.skinShade)
  both(40, 55, 1, 3, p.skinShade)                    // 下颌角的两处小暗（方，不圆）

  // ---------- 头发 ----------
  FTZ_HAIR.forEach(([x0, w], y) => {
    r(g, x0, y, w, 1, p.hair)
    r(g, x0, y, 3, 1, p.hairHi)                      // 左上受光带
    r(g, x0 + w - 3, y, 3, 1, p.hairDark)            // 右下背光带
    px(g, x0, y, ol)                                 // 描边：深红的一圈，头发才从纸面上立起来
    px(g, x0 + w - 1, y, ol)
  })
  // 卷发：几道大的明暗弧线（参考图的红发就是靠这些弧读出来的）。
  // 暗弧用中间色而不是最暗色 —— 亮暗两条平行弧一旦都拉满，头顶就会读成一个"发环"。
  curl(g, 44, 10, 16, 10, Math.PI * 1.12, Math.PI * 1.88, p.hairHi, p.hair)
  curl(g, 30, 13, 9, 8, -Math.PI * 0.1, Math.PI * 0.7, p.hairHi, p.hair)
  curl(g, 60, 14, 9, 8, Math.PI * 0.3, Math.PI * 1.1, p.hair, p.hairHi)
  curl(g, 38, 19, 10, 5, Math.PI * 1.1, Math.PI * 1.9, p.hairDark, p.hair)
  // 额前那一绺向上翻卷的刘海（参考图最显眼的识别点）：只留外缘的亮弧，
  // 内缘改用几段短暗线 —— 钩子画满一圈就成了发网。
  line(g, 40, 13, 36, 7, p.hairHi)
  line(g, 36, 7, 40, 2, p.hairHi)
  line(g, 40, 2, 48, 0, p.hairHi)
  line(g, 48, 0, 54, 3, p.hairHi)
  line(g, 54, 3, 56, 8, p.hairHi)
  line(g, 43, 11, 41, 7, p.hairDark)
  line(g, 46, 4, 50, 2, p.hairDark)
  line(g, 51, 4, 53, 6, p.hairDark)
  line(g, 39, 13, 47, 11, p.hairDark)                // 卷下的一道斜缝（不是横贯的一刀）
  // 层次：再补几道细发丝（一根一根的，不是一整片的明暗带）
  line(g, 34, 8, 39, 4, p.hairHi)
  line(g, 46, 6, 50, 2, p.hairDark)
  line(g, 58, 6, 63, 12, p.hairHi)
  line(g, 35, 16, 42, 12, p.hairDark)
  line(g, 50, 12, 57, 15, p.hairHi)
  line(g, 31, 20, 35, 17, p.hairDark)
  // 刘海：斜向左下的发绺 —— 参考图的发际线是斜的，
  // 齐平的一刀（哪怕只差一行）都会立刻把发型变成锅盖。
  // 刘海压得越低，头发的体量就越大 —— 参考图里头发几乎和脸一样高。
  r(g, 33, 22, 6, 4, p.hair)                         // x33..38 y22..y25（左额最长的一绺）
  r(g, 33, 26, 4, 2, p.hair)                         // x33..36 y26..y27（向下收成发梢）
  px(g, 35, 28, p.hair)
  r(g, 39, 22, 4, 5, p.hair)                         // x39..42 y22..y26
  r(g, 43, 22, 8, 3, p.hair)                         // x43..50 y22..y24
  r(g, 51, 22, 8, 3, p.hair)                         // x51..58 y22..y24
  px(g, 46, 25, p.hair)
  r(g, 54, 25, 4, 1, p.hair)
  r(g, 33, 22, 6, 1, p.hairHi)                       // 发尖的受光
  r(g, 39, 22, 4, 1, p.hairHi)
  r(g, 43, 22, 8, 1, p.hairHi)
  px(g, 34, 27, p.hairDark)                          // 左绺的收尾
  px(g, 38, 27, p.hairDark)
  px(g, 46, 25, p.hairDark)
  px(g, 56, 25, p.hairDark)
  // 鬓发：两侧垂下，压住脸缘（左长右短，3/4 侧面的重量在左）
  const sideL: [number, number, number][] = [
    [16, 27, 8], [17, 27, 8], [18, 27, 8], [19, 27, 8], [20, 27, 8],
    [21, 28, 7], [22, 28, 7], [23, 28, 7], [24, 28, 7], [25, 28, 7],
    [26, 28, 7], [27, 28, 7], [28, 28, 7], [29, 28, 7], [30, 28, 7],
    [31, 29, 6], [32, 29, 6], [33, 29, 6], [34, 29, 6], [35, 29, 6],
    [36, 29, 6], [37, 29, 6], [38, 29, 6], [39, 30, 4], [40, 30, 4],
    [41, 30, 4], [42, 30, 4], [43, 31, 3], [44, 31, 3],
  ]
  for (const [y, x0, w] of sideL) {
    for (const x of [x0, mir(x0, w)]) {
      r(g, x, y, w, 1, p.hair)
      px(g, x, y, p.hairHi)
      px(g, x + w - 1, y, p.hairDark)
      px(g, x, y, ol)
      px(g, x + w - 1, y, ol)
    }
  }
  // 鬓发末端向外翻的一个小卷
  both(33, 45, 3, 1, p.hair)
  both(31, 46, 3, 1, p.hair)
  px(g, 31, 46, p.hairHi)
  px(g, mir(31, 3) + 2, 46, p.hairDark)

  // ---------- 五官 ----------
  // 眉：平直 8px，内端多压一行（"略压"是冷，不是凶）
  r(g, 35, FTZ_BROW_Y, 8, 1, p.brow)
  r(g, 53, FTZ_BROW_Y, 8, 1, p.brow)
  r(g, 40, FTZ_BROW_Y + 1, 3, 1, p.brow)
  r(g, 53, FTZ_BROW_Y + 1, 3, 1, p.brow)
  if (cold) {
    r(g, 35, FTZ_BROW_Y + 1, 8, 1, p.brow)                 // 冷：整条眉压下来
    r(g, 53, FTZ_BROW_Y + 1, 8, 1, p.brow)
    px(g, 35, FTZ_BROW_Y, p.skin)                          // 并把外端的上一行还原成皮肤
    px(g, 42, FTZ_BROW_Y, p.skin)
    px(g, 53, FTZ_BROW_Y, p.skin)
    px(g, 60, FTZ_BROW_Y, p.skin)
  }

  // 眼：6×3 —— 上眼睑一道横线；虹膜三行（上亮下深），左右各 1px 眼白；高光偏左（光在左上）
  // 两行的虹膜在 96 画布上只占脸的 8%，读起来是"眯着眼"；三行才有一双清亮的细长眼。
  const lid = cold ? FTZ_EYE_MID : FTZ_EYE_TOP
  for (const ex of [37, 53]) {
    r(g, ex, lid, 6, 1, p.eyeLid)                         // 上眼睑
    r(g, ex, FTZ_EYE_MID, 1, 3, EYE_WHITE)                // 外眼角眼白
    px(g, ex + 5, FTZ_EYE_MID, EYE_WHITE)                 // 内眼角眼白
    px(g, ex + 5, FTZ_EYE_MID + 1, EYE_WHITE_LO)
    r(g, ex + 1, FTZ_EYE_MID, 4, 1, p.eyeHi)              // 虹膜上（亮）
    px(g, ex + 2, FTZ_EYE_MID, '#e6f4ff')                 // 高光
    r(g, ex + 1, FTZ_EYE_MID + 1, 4, 1, p.eye)            // 虹膜中
    px(g, ex + 4, FTZ_EYE_MID + 1, p.eyeDark)
    r(g, ex + 1, FTZ_EYE_LOW + 1, 4, 1, p.eyeDark)        // 虹膜下（深）
    px(g, ex + 2, FTZ_EYE_LOW + 1, p.eye)
    px(g, ex + 3, FTZ_EYE_LOW + 1, p.eye)
  }
  // 外眼角的一道短睫（向下半行），眼睛才细长而不是两个方块
  px(g, 37, 37, p.eyeLid)
  px(g, 58, 37, p.eyeLid)

  // 鼻：一道纵向的明暗（从眉间下方一直到鼻头），鼻子才有长度，
  // 脸才不会是一张只见眼与嘴的纸片。靠中轴偏右一格 = 3/4 侧面。
  r(g, 47, 40, 1, 4, p.skinHi)                                 // 鼻梁左（受光）
  r(g, 48, 40, 1, 4, p.skinShade)                              // 鼻梁右（背光）
  r(g, 46, FTZ_NOSE_Y + 2, 4, 1, p.skinShade)                  // 鼻头
  px(g, 50, FTZ_NOSE_Y + 2, '#bd8a6d')                         // 右鼻翼更暗
  px(g, 46, FTZ_NOSE_Y + 2, p.skinHi)                          // 鼻尖受光

  // 嘴：一道平直的窄唇线（嘴角不许下压）
  r(g, 45, FTZ_MOUTH_Y, 6, 1, cold ? p.skinShade : p.lip)
  if (!cold) {
    px(g, 45, FTZ_MOUTH_Y, '#96604f')
    px(g, 50, FTZ_MOUTH_Y, '#96604f')
    r(g, 47, FTZ_MOUTH_Y + 1, 3, 1, p.skinShade)               // 下唇的淡影（不是暗线）
  }

  return c
}

// ============================================================
// 艾玛 —— 圆脸大眼
//   脸 y17..y57（41 行），最宽 32（x32..x63），下颌 26，圆下巴 24
//   额头被刘海盖到 y31，**可见脸只有 y32..y57 = 26 行** → 26 : 32 ≈ 0.81（圆）
//   眼 8×8（上睫毛 1 + 竖椭圆虹膜 6 + 下睫毛 1）
//   眼中心 y41.5，落在可见脸自顶向下 38% 处 —— 与参考图逐格对量的结果
//   （最初一版把眼睛放在 26% 处，下巴那一大片空白立刻把她说成四十岁）
//
// 白帽、银发、浅肤三样都是浅色：**每一块都带一道深紫描边**，
// 没有描边它们就糊成一片，谁是谁都看不出来。
// ============================================================

const EMMA_FACE_TOP = 17
const EMMA_BROW_Y = 34          // 眉占 y34..y35 两行（细、略弯）
const EMMA_EYE_TOP = 38         // 上睫毛线
const EMMA_IRIS_TOP = 39
const EMMA_LASH_BOT = 45        // 下睫毛线
const EMMA_NOSE_Y = 48
const EMMA_MOUTH_Y = 52
const EMMA_FACE_BOT = 57
const EMMA_NECK_TOP = 58
const EMMA_SHOULDER = 62

/** 脸型逐行宽度（41 行，y17..y57）：上下都收、最宽 32 只在中间 —— 是个蛋形，不是方板。
 *  下颌从 31 一行一行收到 21（弧形）：24 → 18 那种一落到底的收法，
 *  画出来就是一张"方下颌的中年脸"——这正是上一版怎么调都显老的根。 */
const EMMA_FACE: number[] = [
  22, 24, 26,                                           // y17..y19 额头顶（帽与刘海之下）
  27, 29, 30,                                           // y20..y22
  31,                                                   // y23
  32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32,   // y24..y36 脸颊（饱满，13 行）
  31, 31, 31,                                           // y37..y39
  30, 30,                                               // y40..y41
  29, 29,                                               // y42..y43
  28, 28,                                               // y44..y45
  27, 27,                                               // y46..y47
  26, 26,                                               // y48..y49
  25, 25,                                               // y50..y51
  24, 24,                                               // y52..y53
  23, 23,                                               // y54..y55
  22,                                                   // y56
  21,                                                   // y57 圆下巴（弧线收口）
]

/** 头发轮廓（y6..y27）：[左缘, 宽]，最宽 40（x28..x67）—— 比 32 宽的脸大 8px */
const EMMA_HAIR: [number, number][] = [
  [36, 24], [34, 28], [32, 32], [30, 36], [29, 38],
  [28, 40], [28, 40], [28, 40], [28, 40], [28, 40],
  [28, 40], [28, 40], [28, 40], [28, 40], [28, 40],
  [28, 40], [28, 40], [28, 40], [28, 40], [28, 40],
  [28, 40], [28, 40],
]

/** 肩：从 y62 的 28 宽展开到 y88 的 88 宽（34 行）—— 两侧各留 4px */
const EMMA_SHOULDER_W: number[] = [
  14, 15, 16, 17, 18, 20, 21, 22, 23, 25,
  26, 27, 28, 30, 31, 32, 33, 35, 36, 37,
  38, 40, 41, 42, 43, 43, 44, 44, 44, 44,
  44, 44, 44, 44,
]

const EMMA_PORTRAIT: PortraitPal = {
  skin: '#fdf2e8',
  skinHi: '#fffaf4',
  skinShade: '#e8c8bc',
  // 银发压到偏紫的一档：与"近白的帽"必须拉开，否则帽、发、肤三样浅色会糊成一片
  hair: '#d2c4d9',
  hairHi: '#f2ecf6',
  hairDark: '#a898b8',
  // 描边：白帽与银发的共同外框（参考图的每个色块都有一道深紫边）
  outline: '#6b5c86',
  // 虹膜是紫蓝而不是纯紫，且整体压暗：亮紫在浅肤上会读成"两盏灯"，整张脸就假了
  eye: '#5844a0',
  eyeHi: '#7a66c4',
  eyeDark: '#2a1e4a',
  eyeLid: '#372a4a',
  lip: '#cf8f8c',
  brow: '#c6b0b8',
  coat: '#3b3254',
  coatHi: '#4f4574',
  coatDark: '#241f38',
  collar: LACE.mid,
}

/**
 * 艾玛的立绘。
 * quiet：只把上睫毛线压下一行（眼皮半垂），脸型、眼睛大小、嘴一律不动。
 */
function portraitEmma(quiet = false): Sprite {
  const { c, g } = canvas(PW, PH)
  const p = EMMA_PORTRAIT
  const ol = p.outline ?? '#6b5c86'
  const both = (x: number, y: number, w: number, h: number, col: string): void => {
    r(g, x, y, w, h, col)
    r(g, mir(x, w), y, w, h, col)
  }
  const cap = '#f8f5fd'
  const wHi = '#ffffff'
  const wLo = '#d8cee6'
  /** 脸在 y 行的左缘（长发的内缘跟着它走，绝不与脸之间留一道透明的缝） */
  const faceLeft = (y: number): number => {
    const i = Math.min(EMMA_FACE.length - 1, Math.max(0, y - EMMA_FACE_TOP))
    return midLeft(EMMA_FACE[i])
  }

  // ---------- 肩与女仆装（深紫黑，不是纯黑）----------
  for (let i = 0; i < EMMA_SHOULDER_W.length; i++) {
    const y = EMMA_SHOULDER + i
    const hw = EMMA_SHOULDER_W[i]
    const x0 = 48 - hw
    r(g, x0, y, hw * 2, 1, p.coat)
    r(g, x0, y, 3, 1, p.coatHi)
    r(g, 45 + hw, y, 3, 1, p.coatDark)
    if (i < 18) px(g, x0, y, '#625988')          // 肩线受光
  }
  // 泡泡袖：肩头两团圆弧的高光（参考图的袖子是鼓出来的）
  both(30, 67, 7, 1, p.coatHi)
  both(28, 68, 9, 1, '#554a78')
  both(27, 69, 10, 2, '#554a78')
  both(28, 71, 8, 1, p.coatDark)
  both(25, 71, 2, 2, p.coatDark)
  both(34, 73, 1, 22, p.coatDark)                // 袖子与身体的接缝
  // 袖口的荷叶边（参考图的袖子在手肘处收了一圈白边）
  both(24, 82, 10, 1, cap)
  both(24, 83, 10, 1, wLo)
  both(24, 84, 9, 1, wHi)
  // 胸衣的明暗：一道竖向的中缝 + 两侧的暗面，深紫衣身才不是一块板
  r(g, 47, 74, 1, 14, p.coatDark)
  both(38, 74, 1, 14, p.coatHi)
  both(40, 78, 6, 1, p.coatDark)
  both(40, 82, 6, 1, p.coatDark)

  // ---------- 颈（3 行，下 1 行被白领盖住）----------
  r(g, 43, EMMA_NECK_TOP, 10, 1, p.skinShade)    // 下颌投影（窄而短，不要拉长成一张长脸）
  r(g, 42, EMMA_NECK_TOP + 1, 12, 2, p.skin)     // 颈干 y59..y60
  r(g, 42, EMMA_NECK_TOP + 1, 1, 2, p.skinHi)
  r(g, 53, EMMA_NECK_TOP + 1, 1, 2, p.skinShade)

  // ---------- 脸 ----------
  for (let i = 0; i < EMMA_FACE.length; i++) {
    const y = EMMA_FACE_TOP + i
    const w = EMMA_FACE[i]
    const x0 = midLeft(w)
    r(g, x0, y, w, 1, p.skin)
    px(g, x0, y, p.skinHi)                       // 左缘受光
    // 两侧都不许出现竖暗部：脸颊一旦凹陷，立刻老十岁
    if (y >= 20 && y <= 30) px(g, x0 + w - 1, y, p.skinShade)
  }
  // ---- 面部的柔光：少女脸不做硬阴影，但一点起伏才能救掉扁平感 ----
  for (let y = 32; y <= 37; y++) {
    const w = EMMA_FACE[y - EMMA_FACE_TOP]
    const x0 = midLeft(w)
    r(g, x0 + 2, y, w - 5, 1, p.skinHi)          // 额头的受光面
  }
  for (let y = 38; y <= 46; y++) {
    const w = EMMA_FACE[y - EMMA_FACE_TOP]
    const x0 = midLeft(w)
    r(g, x0 + 1, y, 3, 1, p.skinHi)              // 左颊的柔光
    r(g, x0 + w - 3, y, 2, 1, '#f2cbbd')         // 右颊极淡的影（不贴轮廓，只在里侧）
  }
  for (let y = 47; y <= 56; y++) {
    const w = EMMA_FACE[y - EMMA_FACE_TOP]
    const x0 = midLeft(w)
    r(g, x0 + w - 3, y, 2, 1, '#f2cbbd')         // 右下颌
  }
  // 下巴底：一道短阴影把下巴"收住"，否则脸会一路平铺到脖子上
  r(g, 41, EMMA_FACE_BOT - 1, 14, 1, '#f0c9bb')
  // 刘海投在额头上的影（贴着脸的上缘，脸才不是一块贴纸）
  r(g, 34, 32, 8, 1, '#f4d3c6')
  r(g, 42, 32, 8, 1, '#f4d3c6')
  r(g, 53, 32, 8, 1, '#f4d3c6')
  // 腮红：紧贴眼下颧骨的粉（参考图里最显幼态的一笔）。
  // 位置千万不能低 —— 落到鼻翼的高度，立刻读成两道眼袋，人老十岁。
  both(35, 45, 6, 1, '#f9d9d3')
  both(34, 46, 5, 1, '#fbe4de')
  both(36, 47, 4, 1, '#fdece7')

  // ---------- 头发（银白偏淡紫）----------
  EMMA_HAIR.forEach(([x0, w], i) => {
    const y = 6 + i
    r(g, x0, y, w, 1, p.hair)
    r(g, x0, y, 3, 1, p.hairHi)                  // 左上受光带
    r(g, x0 + w - 3, y, 3, 1, p.hairDark)        // 右下背光带
    px(g, x0, y, ol)                             // 描边
    px(g, x0 + w - 1, y, ol)
  })
  // 发流：几道从发际向左上走的亮线，银发才不是一块白布
  line(g, 34, 26, 44, 10, p.hairHi)
  line(g, 32, 28, 40, 12, p.hairDark)
  line(g, 50, 9, 62, 25, p.hairHi)
  line(g, 45, 10, 57, 7, p.hairHi)
  line(g, 37, 15, 48, 9, wHi)
  line(g, 55, 22, 64, 27, p.hairDark)
  // 发丝的暗纹：几道细细的深线，把一整块银灰切开（参考图的头发是乱的、有层次的）
  line(g, 30, 24, 38, 14, p.hairDark)
  line(g, 36, 26, 42, 18, p.hairDark)
  line(g, 58, 12, 52, 22, p.hairDark)
  line(g, 62, 18, 57, 26, p.hairDark)
  line(g, 46, 12, 44, 24, p.hairDark)
  line(g, 42, 8, 39, 20, p.hairHi)
  line(g, 54, 8, 57, 20, p.hairHi)

  // ---------- 五官 ----------
  // 眉：细、略弯、2px 高，与眼睛之间留 2 行空白（"离眼远"）
  r(g, 38, EMMA_BROW_Y + 1, 8, 1, p.brow)
  r(g, 50, EMMA_BROW_Y + 1, 8, 1, p.brow)
  r(g, 40, EMMA_BROW_Y, 4, 1, p.brow)            // 拱顶
  r(g, 52, EMMA_BROW_Y, 4, 1, p.brow)

  // 眼：8 宽 × 8 高 —— 上睫毛 1 行 + 竖椭圆虹膜 6 行 + 下睫毛 1 行
  // 眼宽 8（占脸 25%，与参考图一致）；10 宽会占到 31%，那读起来是"外星人"不是少女
  // 虹膜最宽 6px（中间四行），上下端收到 4px：椭圆才有"圆眼"的弧，方块没有
  const lidY = quiet ? EMMA_EYE_TOP + 1 : EMMA_EYE_TOP
  // 虹膜几乎填满眼睛（最宽 6px，上下端只收 1px）：收得太狠会变成一个"杏核"，
  // 反而比方块更像贴上去的假眼。
  const irisW = [5, 6, 6, 6, 6, 5]
  const irisC = ['#3c2c66', '#4a3a90', '#6b56b8', '#8a76d0', '#7c68c6', '#9a86d8']
  // 眼白偏粉而不是纯白（参考图的眼白是皮肤色系，纯白会把眼睛"瞪"出来）
  const ewHi = '#fbe8e0'
  const ewLo = '#eccfc4'
  for (const ex of [37, 51]) {
    const cx = ex + 4                              // 眼心 x
    r(g, ex, lidY, 8, 1, p.eyeLid)                 // 上睫毛线（粗，是眼睛的"重量"）
    for (let i = 0; i < 6; i++) {
      const w = irisW[i]
      const y = EMMA_IRIS_TOP + i
      const ix = cx - (w >> 1)
      r(g, ix, y, w, 1, irisC[i])
      const wl = i === 0 || i === 5 ? ewLo : ewHi
      r(g, ex, y, ix - ex, 1, wl)                  // 外眼角的眼白
      r(g, ix + w, y, ex + 8 - (ix + w), 1, wl)    // 内眼角的眼白
    }
    // 高光：虹膜左上一大一小两个白点（光在左上）
    px(g, cx - 2, EMMA_IRIS_TOP + 1, '#ffffff')
    px(g, cx - 1, EMMA_IRIS_TOP + 1, '#ffffff')
    px(g, cx - 2, EMMA_IRIS_TOP + 2, '#f6f0ff')
    px(g, cx + 1, EMMA_IRIS_TOP + 2, '#2a1e4a')    // 瞳孔侧的暗
    px(g, cx + 1, EMMA_IRIS_TOP + 3, '#2a1e4a')
    // 下睫毛：淡褐色一道，绝不是深色（深下睫毛 = 显老）
    if (!quiet) r(g, ex + 1, EMMA_LASH_BOT, 6, 1, '#dcb0aa')
  }
  // 外眼角的一小笔上扬（眼睛因此是圆的，不是方的）
  px(g, 36, EMMA_EYE_TOP, p.eyeLid)
  px(g, 59, EMMA_EYE_TOP, p.eyeLid)
  // 双眼皮的一道极淡的线（只在外半段，画全了就是"疲惫"）
  both(39, EMMA_EYE_TOP - 1, 3, 1, '#f3d8cf')

  // 鼻：只有一个 1px 的点，不画鼻梁
  px(g, 47, EMMA_NOSE_Y, '#e2b6a6')

  // 嘴：5px 的一小段，中间两点深色 = 微张（参考图就是这样，不是一条冷线）
  r(g, 45, EMMA_MOUTH_Y, 5, 1, p.lip)
  px(g, 46, EMMA_MOUTH_Y, '#a86a68')
  px(g, 47, EMMA_MOUTH_Y, '#a86a68')
  r(g, 46, EMMA_MOUTH_Y + 1, 3, 1, '#f0c9bb')    // 下唇的淡影

  // ---------- 刘海（压在五官之上：参考图里刘海盖住眉的上缘）----------
  // 斜刘海：左额垂到 y33，右侧只到 y28 —— 参考图的刘海是从右上向左下斜的，
  // 平齐的一排发绺（哪怕高低参差）都会让这张脸变成"西瓜头"。
  const bang: [number, number, number][] = [
    // [左缘, 宽, 垂到的行] —— 左右只差 3 行：差得太开就成了"半边秃"
    [28, 6, 34], [34, 5, 34], [39, 4, 33], [42, 7, 33], [49, 4, 32],
    [53, 5, 32], [58, 5, 31], [63, 4, 31],
  ]
  for (const [x0, w, bot] of bang) {
    r(g, x0, 27, w, bot - 26, p.hair)
    r(g, x0, 27, 1, bot - 26, p.hairHi)
    r(g, x0 + w - 1, 27, 1, bot - 26, p.hairDark)
  }
  px(g, 44, 32, p.hair)
  px(g, 48, 32, p.hair)
  line(g, 42, 27, 45, 33, p.hairDark)            // 中央那一绺的内缘
  line(g, 49, 27, 47, 33, p.hairDark)
  r(g, 39, 27, 2, 1, p.hairDark)
  r(g, 53, 27, 2, 1, p.hairDark)

  // ---------- 两侧的长发（内缘贴住脸缘，垂到肩下，压在衣服之上）----------
  const locks: [number, number][] = [
    [14, 6], [15, 6], [16, 6], [17, 6], [18, 6],
    [19, 7], [20, 7], [21, 7], [22, 7], [23, 7],
    [24, 8], [25, 8], [26, 9], [27, 9], [28, 9],
    [29, 9], [30, 9], [31, 9], [32, 9], [33, 8],
    [34, 8], [35, 8], [36, 8], [37, 8], [38, 8],
    [39, 8], [40, 7], [41, 7], [42, 7], [43, 7],
    [44, 7], [45, 7], [46, 6], [47, 6], [48, 6],
    [49, 6], [50, 6], [51, 5], [52, 5], [53, 5],
    [54, 5], [55, 4], [56, 4], [57, 4], [58, 4],
    [59, 3], [60, 3], [61, 3], [62, 3], [63, 3],
    [64, 2], [65, 2], [66, 2], [67, 2],
  ]
  for (const [y, w] of locks) {
    const x0 = faceLeft(y) - w
    both(x0, y, w, 1, p.hair)
    both(x0, y, 1, 1, p.hairHi)                    // 外缘受光
    both(x0 + w - 1, y, 1, 1, p.hairDark)          // 内缘压暗（贴脸的一侧：暗一档，不是描边）
    both(x0, y, 1, 1, ol)                          // 描边只给外缘
  }
  // 发梢分叉 + 两侧飘出的细碎发丝（参考图耳际几根细发）
  both(29, 68, 2, 2, p.hair)
  both(30, 70, 1, 2, p.hair)
  line(g, 25, 32, 21, 39, p.hairDark)
  line(g, 25, 45, 22, 53, p.hair)
  line(g, 70, 34, 74, 41, p.hairDark)
  line(g, 69, 48, 72, 55, p.hair)

  // ---------- 白色立领（围住颈根，波浪上缘）----------
  for (let x = 38; x <= 57; x += 3) px(g, x, 61, cap)      // 领缘的小齿
  r(g, 38, 62, 20, 1, cap)
  r(g, 38, 63, 20, 4, cap)                                  // y63..y66
  r(g, 39, 67, 18, 1, cap)
  r(g, 38, 62, 8, 1, wHi)                                   // 左上受光
  r(g, 38, 63, 1, 4, wHi)
  r(g, 56, 63, 2, 4, wLo)                                   // 右下背光
  r(g, 39, 67, 18, 1, wLo)                                  // 领下缘的影

  // ---------- 领口的白色荷叶边（波浪下缘，比领子宽）----------
  r(g, 35, 68, 26, 1, cap)
  r(g, 34, 69, 28, 1, cap)
  r(g, 34, 70, 28, 1, cap)
  r(g, 35, 71, 26, 1, cap)
  r(g, 36, 72, 24, 1, cap)
  r(g, 34, 69, 6, 1, wHi)
  r(g, 37, 68, 8, 1, wHi)
  r(g, 57, 69, 5, 1, wLo)
  for (let x = 34; x <= 61; x += 3) px(g, x, 73, wLo)       // 下缘的齿

  // ---------- 绿色蝴蝶结（两翼各 9px，压在领口正中）----------
  // 左翼 x37..45 / 结心 x46..49 / 右翼 x50..58
  const bw: [number, number, number, number][] = [
    // [y, 左翼起 x, 左翼宽, 右翼宽]（右翼贴 x50 起）
    [64, 39, 7, 7], [65, 38, 8, 8], [66, 37, 9, 9], [67, 37, 9, 9],
    [68, 38, 8, 8], [69, 39, 7, 7], [70, 41, 5, 5],
  ]
  for (const [y, lx, lw, rw] of bw) {
    r(g, lx, y, lw, 1, BOW_G.hi)                  // 主体用最亮的一档：深紫衣上，暗绿会读成脏
    px(g, lx, y, '#d6f09a')
    px(g, lx + lw - 1, y, BOW_G.mid)
    r(g, 50, y, rw, 1, BOW_G.hi)
    px(g, 50, y, BOW_G.mid)
    px(g, 50 + rw - 1, y, BOW_G.mid)
  }
  r(g, 37, 66, 9, 1, '#d6f09a')                  // 左翼的上缘受光
  r(g, 50, 66, 9, 1, BOW_G.hi)
  r(g, 41, 68, 5, 1, BOW_G.mid)                  // 下缘压暗，翼才有厚度
  r(g, 50, 68, 5, 1, BOW_G.mid)
  // 结心（最亮的一块）
  r(g, 46, 64, 4, 5, BOW_G.hi)
  r(g, 46, 64, 4, 1, '#d6f09a')
  r(g, 46, 64, 1, 4, '#d6f09a')
  r(g, 48, 67, 1, 2, BOW_G.mid)
  // 垂下的两条短带
  r(g, 46, 69, 1, 6, BOW_G.hi)
  r(g, 49, 69, 1, 6, BOW_G.mid)

  // ---------- 白色荷叶边围裙（胸前的白方片，边缘是波浪）----------
  r(g, 38, 74, 20, 1, cap)
  r(g, 37, 75, 22, 2, cap)
  r(g, 36, 77, 24, 3, cap)
  r(g, 35, 80, 26, 7, cap)
  r(g, 34, 87, 28, 9, cap)
  r(g, 37, 75, 2, 20, wHi)                        // 左缘受光
  r(g, 58, 75, 2, 20, wLo)                        // 右缘背光
  r(g, 38, 74, 12, 1, wHi)
  for (let x = 34; x <= 61; x += 4) px(g, x, 95, wLo)

  // ---------- 白色蕾丝女仆帽（最上层）----------
  // 参考图的帽子不是一顶"扣在脑门上的小帽"，也不是"发卡"：
  // 它是一整圈蕾丝花冠压在头顶上，比头发宽一圈，下缘是波浪齿。
  const capRows: [number, number][] = [
    [40, 16], [36, 24], [33, 30], [31, 34], [29, 38], [28, 40],
    [27, 42], [26, 44], [26, 44], [27, 42], [28, 40], [29, 38],
  ]
  capRows.forEach(([x0, w], i) => {
    const y = 1 + i
    r(g, x0, y, w, 1, cap)                        // 冠顶与花边同白，只有高光再提亮
    r(g, x0, y, Math.max(2, Math.round(w * 0.22)), 1, wHi)
    r(g, x0 + w - Math.max(2, Math.round(w * 0.22)), y,
      Math.max(2, Math.round(w * 0.22)), 1, wLo)
    px(g, x0, y, ol)
    px(g, x0 + w - 1, y, ol)
  })
  // 冠顶的花瓣齿（蕾丝的轮廓不是平滑的半圆，是一瓣一瓣的）
  for (let x = 33; x < 63; x += 5) {
    r(g, x, 0, 3, 1, '#ffffff')
    px(g, x, 0, wHi)
  }
  // 花边的蕾丝齿：每隔 4px 一个 3px 的扇贝，垂到 y15
  for (let x = 26; x < 70; x += 4) {
    r(g, x, 13, 3, 1, cap)
    px(g, x, 14, cap)
    px(g, x + 1, 13, wHi)
    px(g, x, 15, ol)
    px(g, x + 2, 14, ol)
  }
  // 花边的褶：三道由内向外张开的亮线，白帽才不是一块白饼
  line(g, 40, 9, 30, 5, wHi)
  line(g, 55, 9, 65, 5, wLo)
  line(g, 38, 11, 29, 9, ol)
  line(g, 57, 11, 66, 9, wLo)

  return c
}

// ============================================================
// 配角（赫尔曼 / 玛尔塔 / 彩蛋角色）：沿用各自的设计，按 96×96 重新布局
//   骨架：发/头饰 y0..y13 → 脸 y14..y55（42 行）→ 颈 y56..y61 → 肩 y62..y95
//   三个人不再各写一套，只换脸型数组、眼睛大小与配件 ——
//   他们的脸本来就是同一族的"成人脸"，与两位主角的差异靠 spec 里的数字表达。
// ============================================================

/** 配角的三套脸型（42 行，y14..y55）：窄的给男人，宽的给妇女与少女 */
const GENERIC_FACE_NARROW: number[] = [
  22, 24, 26,                                              // y14..y16 额头顶
  27, 28, 28,                                              // y17..y19
  28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,   // y20..y37
  27, 27, 27,                                              // y38..y40
  26, 26, 26,                                              // y41..y43
  24, 24, 24,                                              // y44..y46
  22, 22, 22,                                              // y47..y49
  20, 20, 20,                                              // y50..y52
  17, 17, 17,                                              // y53..y55
]

const GENERIC_FACE_ROUND: number[] = [
  22, 24, 26,
  28, 29, 30,
  30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,   // y20..y37
  29, 29, 29,
  28, 28, 28,
  27, 27, 27,
  26, 26, 26,
  25, 25, 25,
  24, 23, 22,
]

const GENERIC_FACE_SOFT: number[] = [
  22, 24, 26,
  29, 31, 32,
  32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32,   // y20..y37
  31, 30, 29,
  28, 27, 27,
  26, 26, 26,
  25, 24, 24,
  23, 23, 23,
  22, 22, 21,
]

/** 配角的脸与五官行号（脸顶点固定在 y14） */
interface GenericSpec {
  face: number[]
  /** 脸最宽处（用于定位眼睛与配件） */
  maxW: number
  /** 6 = 细长眼（2 行虹膜）；10 = 大圆眼（5 行虹膜） */
  eyeW: number
  eyeH: number
  browY: number
  eyeTop: number
  noseY: number
  mouthY: number
  neckW: number
}

const SPEC_HERMANN: GenericSpec = {
  face: GENERIC_FACE_NARROW, maxW: 28,
  eyeW: 6, eyeH: 2, browY: 33, eyeTop: 36, noseY: 43, mouthY: 48, neckW: 14,
}

const SPEC_MARTA: GenericSpec = {
  face: GENERIC_FACE_ROUND, maxW: 30,
  eyeW: 6, eyeH: 3, browY: 32, eyeTop: 35, noseY: 42, mouthY: 48, neckW: 13,
}

const SPEC_DS: GenericSpec = {
  face: GENERIC_FACE_SOFT, maxW: 32,
  eyeW: 10, eyeH: 5, browY: 28, eyeTop: 31, noseY: 40, mouthY: 45, neckW: 12,
}

/** 肩：y62..y95（34 行），13 半宽 → 48 半宽 */
const GENERIC_SHOULDER_W: number[] = [
  13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 34, 35, 36, 37, 38, 39,
  40, 41, 42, 43, 44, 45, 46, 47, 47, 48, 48, 48, 48, 48, 48, 48, 48,
]

const GENERIC_FACE_TOP = 14
const GENERIC_NECK_TOP = 56
const GENERIC_SHOULDER = 62

/**
 * 通用立绘：肩 → 颈 → 脸 → 头发/头饰 → 五官 → 衣领配件。
 * 头发的分支只有三种：slick（后梳）、kerchief（圆顶头巾）、ringlet（长发 + 蕾丝帽）。
 */
function portraitGeneric(p: PortraitPal, spec: GenericSpec): Sprite {
  const { c, g } = canvas(PW, PH)
  const both = (x: number, y: number, w: number, h: number, col: string): void => {
    r(g, x, y, w, h, col)
    r(g, mir(x, w), y, w, h, col)
  }

  // ---------- 肩 ----------
  for (let i = 0; i < GENERIC_SHOULDER_W.length; i++) {
    const y = GENERIC_SHOULDER + i
    const hw = GENERIC_SHOULDER_W[i]
    const x0 = 48 - hw
    r(g, x0, y, hw * 2, 1, p.coat)
    r(g, x0, y, 3, 1, p.coatHi)
    r(g, 45 + hw, y, 3, 1, p.coatDark)
    if (i < 18) px(g, x0, y, p.coatHi)
  }
  both(32, 66, 1, 28, p.coatHi)

  // ---------- 颈 ----------
  const nk = spec.neckW
  r(g, 48 - ((nk - 2) >> 1), GENERIC_NECK_TOP, nk - 2, 1, p.skinShade)
  r(g, 48 - (nk >> 1), GENERIC_NECK_TOP + 1, nk, 5, p.skin)
  px(g, 48 - (nk >> 1), GENERIC_NECK_TOP + 1, p.skinHi)
  r(g, 47 + (nk >> 1), GENERIC_NECK_TOP + 1, 1, 5, p.skinShade)

  // ---------- 脸 ----------
  for (let i = 0; i < spec.face.length; i++) {
    const y = GENERIC_FACE_TOP + i
    const w = spec.face[i]
    const x0 = midLeft(w)
    r(g, x0, y, w, 1, p.skin)
    px(g, x0, y, p.skinHi)
    if (y >= 24 && y <= 44) px(g, x0 + w - 1, y, p.skinShade)
  }
  r(g, midLeft(spec.face[spec.face.length - 1]) + 2,
    GENERIC_FACE_TOP + spec.face.length - 1,
    spec.face[spec.face.length - 1] - 4, 1, p.skinShade)

  // ---------- 头发 / 头饰 ----------
  if (p.hairStyle === 'slick') {
    // 后梳：发际线高、额头整片露出（成年男性的骨相）
    const rows: [number, number][] = [
      [42, 12], [40, 16], [38, 20], [36, 24], [35, 26],
      [34, 28], [34, 28], [34, 28], [35, 26], [36, 24],
      [37, 22], [38, 20], [39, 18],
    ]
    rows.forEach(([x0, w], y) => {
      r(g, x0, y, w, 1, p.hair)
      r(g, x0, y, 3, 1, p.hairHi)
      r(g, x0 + w - 3, y, 3, 1, p.hairDark)
    })
    // 向后梳的三道深痕
    r(g, 41, 3, 1, 6, p.hairDark)
    r(g, 47, 2, 1, 7, p.hairDark)
    r(g, 53, 3, 1, 6, p.hairDark)
    // 发际线：一道横过前额的暗线，高额头才立得住
    r(g, 39, 13, 18, 1, p.hairDark)
    // 鬓角：细、短，只到颧骨
    both(33, 10, 4, 3, p.hair)
    both(34, 13, 3, 9, p.hair)
    both(34, 13, 1, 9, p.hairHi)
    both(36, 13, 1, 9, p.hairDark)
  } else if (p.hairStyle === 'kerchief') {
    // 圆顶头巾：亚麻布包住头顶（圆顶，不是方盒），两侧垂到肩
    const kc = p.kerchief ?? C.sugar
    const rows: [number, number][] = [
      [39, 18], [36, 24], [34, 28], [33, 30],
      [32, 32], [32, 32], [32, 32], [32, 32], [32, 32], [32, 32],
      [32, 32], [33, 30], [34, 28], [36, 24],
    ]
    rows.forEach(([x0, w], y) => {
      r(g, x0, y, w, 1, kc)
      r(g, x0, y, 3, 1, C.sugar)
      r(g, x0 + w - 4, y, 4, 1, C.bone)
    })
    r(g, 39, 0, 18, 1, C.sugar)                     // 圆顶的受光
    r(g, 36, 1, 8, 1, C.sugar)
    r(g, 50, 2, 6, 1, C.bone)                       // 右下压暗
    r(g, 34, 13, 28, 1, C.bone)                     // 下缘压住额头的一道暗线
    // 头巾两侧垂到肩的布尾
    both(30, 12, 5, 16, kc)
    both(30, 12, 1, 16, C.sugar)
    both(34, 12, 1, 16, C.bone)
    both(31, 28, 4, 3, kc)
    both(30, 31, 3, 2, kc)
    // 额前垂下的两缕头发
    both(35, 14, 3, 3, p.hair)
    both(36, 17, 2, 6, p.hair)
    both(36, 17, 1, 6, p.hairHi)
    both(30, 12, 1, 16, C.sugar)
  } else {
    // ringlet：及肩长发 + 中分刘海（帽檐最后压上去）
    for (let x = 30; x <= 65; x++) r(g, x, 6, 1, 12, p.hair)
    r(g, 30, 6, 4, 12, p.hairHi)
    r(g, 62, 6, 4, 12, p.hairDark)
    // 中分刘海：额心（x42..53）露出一块，两侧盖到眉
    r(g, 30, 18, 13, 5, p.hair)                     // x30..42
    r(g, 53, 18, 13, 5, p.hair)                     // x53..65
    r(g, 32, 18, 11, 3, p.hair)
    r(g, 53, 18, 11, 3, p.hair)
    line(g, 33, 22, 41, 18, p.hairHi)
    line(g, 62, 22, 54, 18, p.hairDark)
    // 及肩的鬓发（压在衣服之上）
    both(27, 16, 6, 40, p.hair)
    both(26, 22, 5, 34, p.hair)
    both(26, 22, 1, 34, p.hairHi)
    both(31, 16, 1, 40, p.hairDark)
    both(30, 22, 1, 34, p.hairDark)
    both(28, 54, 3, 4, p.hair)
    both(29, 58, 2, 3, p.hair)
  }

  // ---------- 五官 ----------
  if (spec.eyeW >= 10) {
    // 大圆眼（彩蛋角色）：10 宽，虹膜 8px + 两侧各 1px 眼白
    const exs = [35, 51]
    for (const ex of exs) {
      const ix = ex + 1
      r(g, ex, spec.eyeTop, 10, 1, p.eyeLid)
      px(g, ex, spec.eyeTop + 1, EYE_WHITE)
      px(g, ex + 9, spec.eyeTop + 1, EYE_WHITE)
      for (let i = 1; i <= spec.eyeH; i++) {
        const t = (i - 1) / Math.max(1, spec.eyeH - 1)
        const col = t < 0.34 ? '#4a3890' : t < 0.7 ? p.eye : p.eyeHi
        r(g, ix, spec.eyeTop + i, 8, 1, col)
        px(g, ex, spec.eyeTop + i, EYE_WHITE_LO)
        px(g, ex + 9, spec.eyeTop + i, EYE_WHITE_LO)
      }
      px(g, ix + 1, spec.eyeTop + 2, '#ffffff')
      px(g, ix + 2, spec.eyeTop + 2, '#ffffff')
      px(g, ix + 1, spec.eyeTop + 3, '#efe8ff')
      r(g, ex + 1, spec.eyeTop + spec.eyeH + 1, 8, 1, '#d8aca6')
    }
  } else {
    // 细长眼：宽 6，虹膜 4px，左右各 1px 眼白
    const exs = [37, 53]
    for (const ex of exs) {
      r(g, ex, spec.eyeTop, spec.eyeW, 1, p.eyeLid)
      if (spec.eyeH <= 2) {
        px(g, ex, spec.eyeTop + 1, EYE_WHITE)
        px(g, ex + 1, spec.eyeTop + 1, p.eyeHi)
        px(g, ex + 2, spec.eyeTop + 1, '#e2f1ff')
        px(g, ex + 3, spec.eyeTop + 1, p.eyeHi)
        px(g, ex + 4, spec.eyeTop + 1, p.eye)
        px(g, ex + 5, spec.eyeTop + 1, EYE_WHITE)
        px(g, ex, spec.eyeTop + 2, EYE_WHITE_LO)
        px(g, ex + 1, spec.eyeTop + 2, p.eye)
        px(g, ex + 2, spec.eyeTop + 2, p.eyeDark)
        px(g, ex + 3, spec.eyeTop + 2, p.eyeDark)
        px(g, ex + 4, spec.eyeTop + 2, p.eye)
        px(g, ex + 5, spec.eyeTop + 2, EYE_WHITE_LO)
      } else {
        // 圆一点的 6×3（玛尔塔）
        px(g, ex, spec.eyeTop + 1, EYE_WHITE)
        px(g, ex + 5, spec.eyeTop + 1, EYE_WHITE)
        r(g, ex + 1, spec.eyeTop + 1, 4, 1, p.eyeHi)
        r(g, ex + 1, spec.eyeTop + 2, 4, 1, p.eye)
        px(g, ex + 2, spec.eyeTop + 1, '#ffffff')
        r(g, ex + 2, spec.eyeTop + 3, 3, 1, p.eyeDark)
        px(g, ex, spec.eyeTop + 2, EYE_WHITE_LO)
        px(g, ex + 5, spec.eyeTop + 2, EYE_WHITE_LO)
      }
    }
  }

  // 眉：一道 8px 的平线（配角不细画，只要位置对）
  r(g, 35, spec.browY, 8, 1, p.brow)
  r(g, 53, spec.browY, 8, 1, p.brow)
  r(g, 40, spec.browY + 1, 3, 1, p.brow)
  r(g, 53, spec.browY + 1, 3, 1, p.brow)

  // 鼻
  px(g, 47, spec.noseY, p.skinHi)
  px(g, 48, spec.noseY, p.skinShade)
  r(g, 46, spec.noseY + 1, 4, 1, p.skinShade)
  px(g, 46, spec.noseY + 1, p.skinHi)

  // 嘴：grin 张嘴（4px），否则一段 5px 的唇线，嘴角上扬 1px（smile）
  const my = spec.mouthY
  if (p.mood === 'grin') {
    r(g, 46, my, 4, 2, '#3a2024')
    r(g, 47, my, 2, 1, C.bone)
    px(g, 45, my, p.lip)
    px(g, 50, my, p.lip)
  } else {
    r(g, 46, my, 5, 1, p.lip)
    px(g, 45, my - 1, p.lip)
    px(g, 51, my - 1, p.lip)
  }

  // ---------- 衣领 / 配件 ----------
  if (p.bow) {
    // 燕尾服 + 白衬衫 + 银灰领结
    both(31, 60, 3, 6, p.coatHi)
    both(31, 60, 1, 6, p.coatDark)
    r(g, 38, 60, 20, 4, p.collar)                   // 白衬衫 y60..y63
    r(g, 38, 60, 20, 1, C.sugar)
    r(g, 38, 60, 1, 4, C.sugar)
    r(g, 56, 60, 2, 4, C.pale)
    r(g, 38, 64, 20, 1, C.pale)                     // 领口下缘的影
    // 银灰领结：两翼各 8px + 结心 6px
    both(36, 64, 8, 4, p.bow)
    both(36, 64, 8, 1, C.sugar)                     // 翼的上缘受光
    both(36, 67, 8, 1, p.coatDark)                  // 翼的下缘压暗
    r(g, 45, 64, 7, 4, p.bow)
    r(g, 45, 64, 5, 1, C.sugar)
    px(g, 45, 65, C.sugar)
    px(g, 49, 67, p.coatDark)
    r(g, 47, 68, 3, 2, p.coatDark)                  // 结心垂下的窄尾
  } else if (p.kerchief) {
    // 围裙 + 领巾
    r(g, 38, 60, 20, 4, p.collar)
    r(g, 38, 60, 20, 1, C.sugar)
    r(g, 38, 60, 1, 4, C.sugar)
    r(g, 34, 68, 28, 10, p.apron ?? p.collar)       // 围裙的胸片
    r(g, 34, 68, 28, 1, C.sugar)
    r(g, 34, 68, 1, 10, C.sugar)
    r(g, 60, 68, 2, 10, C.pale)
    r(g, 42, 64, 12, 4, p.kerchief ?? C.bone)       // 领巾
    r(g, 43, 64, 10, 1, C.sugar)
    for (let x = 34; x <= 61; x += 4) px(g, x, 78, C.pale)   // 围裙下缘的波浪齿
  } else {
    // 默认：深色立领 + 领口的银灰边 + 铜扣
    r(g, 36, 60, 24, 6, p.coat)
    r(g, 36, 60, 24, 1, p.collar)
    r(g, 36, 60, 1, 6, p.coatHi)
    r(g, 59, 60, 1, 6, p.coatDark)
    r(g, 47, 61, 2, 4, p.collar)
    r(g, 47, 62, 2, 1, C.brass)
    both(32, 66, 4, 8, p.coatHi)
    both(32, 66, 1, 8, p.coatDark)
  }

  return c
}

// ------------------------------------------------------------
// 配色
// ------------------------------------------------------------

const HERMANN_PORTRAIT: PortraitPal = {
  skin: '#e6e0d8', skinHi: '#f6f2ea', skinShade: '#b9b0a6',
  // 银灰发比皮肤压暗一档：否则近白的脸与近白的头发糊成一个石膏像
  hair: '#98a1ae', hairHi: '#c4cad4', hairDark: '#626b78',
  eye: C.pale, eyeHi: C.sugar, eyeDark: C.cold,
  eyeLid: '#3a424e', lip: '#8a7f7a', brow: '#646d7a',
  coat: '#12151a', coatHi: C.graphite, coatDark: C.night,
  collar: C.bone, hairStyle: 'slick', mood: 'smile', bow: C.pale,
}

const MARTA_PORTRAIT: PortraitPal = {
  skin: '#e4c4a4', skinHi: '#f6dcc4', skinShade: '#bd9c7c',
  hair: '#6b4a2f', hairHi: '#8a6440', hairDark: '#4a3320',
  eye: '#4a3520', eyeHi: C.sugar, eyeDark: '#2a1a10',
  eyeLid: '#3a2618', lip: '#a8625a', brow: '#4a3320',
  coat: '#5c4630', coatHi: '#77603f', coatDark: '#3f2f1c',
  collar: C.sugar, hairStyle: 'kerchief', mood: 'grin',
  apron: C.bone, kerchief: C.sugar,
}

/**
 * 彩蛋角色：蓝紫单色阶的冷调 —— 头发、眼睛、蝴蝶结全部取自 DEEPBLUE 一阶，
 * 皮肤压成带紫的冷白；衣身深蓝，帽与围裙用冷白 LACE。
 */
const DS_PORTRAIT: PortraitPal = {
  skin: '#ece0e8', skinHi: '#faf2f6', skinShade: '#c6b3c1',
  hair: DEEPBLUE.mid, hairHi: DEEPBLUE.hi, hairDark: DEEPBLUE.lo,
  eye: DEEPBLUE.mid, eyeHi: '#b8c4f8', eyeDark: '#2a3568',
  eyeLid: '#3b3a6e', lip: '#c08ca6', brow: '#6b78c0',
  coat: '#2b3358', coatHi: '#414d80', coatDark: '#181d33',
  collar: LACE.mid, hairStyle: 'ringlet', mood: 'smile',
}

/**
 * 立绘注册表（96×96，对话时放在左侧，按 2 倍显示为 192×192）。
 * 艾玛只有平静一种表情：emmaQuiet 只是上睫毛线压低 1 行，脸与眼睛一律不动。
 * ftzCold 不换脸：只压低眉与上眼睑、把嘴角收平。
 */
export const PORTRAITS: Record<string, HTMLCanvasElement> = {
  ftz: portraitFriedrich(false),
  ftzCold: portraitFriedrich(true),
  emma: portraitEmma(false),
  emmaQuiet: portraitEmma(true),
  hermann: portraitGeneric(HERMANN_PORTRAIT, SPEC_HERMANN),
  marta: portraitGeneric(MARTA_PORTRAIT, SPEC_MARTA),
  ds: portraitGeneric(DS_PORTRAIT, SPEC_DS),
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
 * 原素材每帧 24×24，这里放大到 32×32（NEAREST，每个源像素 1.33px，
 * 会有极轻微的不均匀，但她在场景里不会比 24×32 的主角矮一头）。
 * 帧内脚底在 y30/31，与其它角色（脚底 y30、影子 y31）齐平，站在地上。
 */
function loadCameoWalk(): void {
  const img = new Image()
  img.onload = () => {
    /** 从素材表里切一帧并放大到 32×32：row = 0..3（down/left/right/up），col = 0..2 */
    const cut = (row: number, col: number): Sprite => {
      const { c, g } = canvas(32, 32)
      g.imageSmoothingEnabled = false
      g.drawImage(img, col * 24, row * 24, 24, 24, 0, 0, 32, 32)
      return c
    }
    /** 一行的三帧：原图 [左步, 站立, 右步] → 引擎 [站立, 左步, 右步] */
    const walk = (row: number): Sprite[] => [cut(row, 1), cut(row, 0), cut(row, 2)]
    for (const [key, row] of Object.entries(CAMEO_WALK_ROW)) SPRITES[key] = walk(row)
  }
  img.src = './portraits/ds-walk.png'
}

loadCameoWalk()
