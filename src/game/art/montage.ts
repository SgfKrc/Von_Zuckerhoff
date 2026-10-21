// ============================================================
// 木刻蒙太奇 · 法兰克福的前半生（七张版画）
// ------------------------------------------------------------
// 依据 docs/_research/novel-01.md 场景 4（L250–L332）：孤儿院、工厂、
// 夜校阁楼、考场、放榜、船厂、回到古堡。
//
// 技法全部照 src/ui/GrimmBook.tsx 的 drawPlate（不改那个文件，只学它）：
//   · 只用 fillRect，坐标一律取整 —— 两色（墨黑 #171310 / 纸白 #e8d9b4），
//     整数坐标才不会在边缘烧出灰阶抗锯齿。
//   · 横线刻天空（越靠地平线越长越密）、实心黑块刻建筑、
//     密集短竖线刻地面与人群、留白刻轮廓。
//   · 人一律剪影：先画外扩 2px 的纸白，再压黑色本体 ——
//     这样人从密排刻线里"凿"出来，且永远不画五官，只靠姿态与大小分身份。
//   · 确定性 hash：同一张版画每次印出来都一模一样（只有时间驱动的部分在动）。
//
// 版面（384×216，与游戏逻辑分辨率一致）：
//   [8,8 – 376,146]  画面区（木刻版画本体）
//   [8,147 – 376,206] 图说带（纸白 + 墨黑旁白，逐字打出）+ 右下角版号
//   外面一圈纸边 + 双线版框
//
// renderFrame(g, t) 是纯函数：给任意秒数都能画出那一帧（跳过与定帧调试都靠它）。
// ============================================================

type Ctx = CanvasRenderingContext2D

const INK = '#171310'
const PAPER = '#e8d9b4'

export const MONTAGE_W = 384
export const MONTAGE_H = 216

/** 画面区（版画本体） */
const PX = 8
const PY = 8
const PW = 368
const PH = 138

/** 图说带 */
const SEAM = 147          // 上缘分隔线（2px）
const CAP_TOP = 156       // 第一行中心（离画面底边留一口气）
const CAP_LINE = 14       // 行距
const CAP_SIZE = 11
const CAP_GAP = 0.6
const CAP_LEFT = 22
const CAP_W = 300         // 文字可用宽度（右侧留给版号）

const SERIF = '"Georgia", "Songti SC", "SimSun", "Noto Serif SC", serif'

/** 只画整数矩形：两色版画不能出现抗锯齿的灰边 */
function fill(g: Ctx, x: number, y: number, w: number, h: number): void {
  const x0 = Math.round(x)
  const y0 = Math.round(y)
  const w0 = Math.round(w)
  const h0 = Math.round(h)
  if (w0 <= 0 || h0 <= 0) return
  g.fillRect(x0, y0, w0, h0)
}

/** 木刻的确定性伪随机：与 GrimmBook.drawPlate 同一套 */
function hash(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

// ------------------------------------------------------------
// 三个通用笔法（七个镜头共用，改一处七张版画一起变）
// ------------------------------------------------------------

/**
 * 横线刻天空：上面稀、下面密，长度随高度增长 —— 天光是从上方斜着退远的。
 * 每行再错开一段，才不会看成一把梯子。
 */
function skyHatch(g: Ctx, y0: number, y1: number, seed = 1, maxLen = 170, step = 3): void {
  g.fillStyle = INK
  for (let y = y0; y < y1; y += step) {
    const t = (y - y0) / Math.max(1, y1 - y0)      // 0 顶 → 1 近地平线
    const x0 = PX + 2 + Math.round(hash(y * 7 + seed) * 26)
    const len = Math.round(24 + t * maxLen * 0.7 + hash(y * 13 + seed) * 46)
    fill(g, x0, y, Math.min(len, PX + PW - 3 - x0), 1)
    if (hash(y * 31 + seed) < 0.55) {
      const x1 = PX + 120 + Math.round(hash(y * 17 + seed) * 180)
      const l2 = Math.round(16 + t * maxLen * 0.4)
      fill(g, x1, y, Math.min(l2, PX + PW - 3 - x1), 1)
    }
    if (step >= 4 && hash(y * 23 + seed) < 0.4) {
      fill(g, PX + 20 + Math.round(hash(y * 29 + seed) * 300), y - 1, 6 + Math.round(hash(y * 3) * 22), 1)
    }
  }
}

/** 密集短竖线：地面、人群脚下的排线 —— 木刻刻地板的办法（一行一行错开） */
function groundHatch(g: Ctx, y0: number, y1: number, seed = 3, step = 6): void {
  g.fillStyle = INK
  for (let y = y0; y < y1; y += 4) {
    const off = ((y - y0) >> 2) % 2 === 0 ? 0 : 3
    for (let x = PX + 2 + off; x < PX + PW - 2; x += step) {
      const h = 3 + Math.round(hash(x * 13 + y * 7 + seed) * 4)
      fill(g, x, y, 1, Math.min(h, y1 - y))
    }
  }
}

/**
 * 剪影：先把全部部件外扩 pad 的纸白画一遍，再压黑色本体。
 * 这是 GrimmBook.drawPlate 里人物"从满版黑草里凿出来"的那一手。
 */
function silhouette(g: Ctx, paint: (pad: number) => void): void {
  g.fillStyle = PAPER
  paint(2)
  g.fillStyle = INK
  paint(0)
}

/** 梯形竖块：上宽 w0、下宽 w1，从 y0 长到 y1（人身、篮子、纱锭都用它） */
function taper(g: Ctx, cx: number, y0: number, y1: number, w0: number, w1: number, pad = 0): void {
  const h = Math.max(1, y1 - y0)
  for (let i = 0; i < h; i++) {
    const p = i / h
    const w = w0 + (w1 - w0) * p
    fill(g, cx - w / 2 - pad, y0 + i, w + pad * 2, 1)
  }
}

/** 尖顶（塔楼 / 屋顶）：逐行收窄的三角，边缘是台阶 —— 木刻里没有斜线 */
function spire(g: Ctx, cx: number, baseY: number, baseW: number, h: number): void {
  for (let i = 0; i < h; i += 2) {
    const w = Math.max(2, Math.round(baseW * (1 - i / h)))
    fill(g, cx - w / 2, baseY - i, w, 2)
  }
}

// ============================================================
// 镜头 1 · 孤儿院门口
// ------------------------------------------------------------
// 焦点：台阶上的篮子（周围刻掉一圈纸白）。
// 天空在下斜雨；一扇石拱门，门下三级台阶；一只手从右下伸上来敲门。
// ============================================================

function paintOrphanage(g: Ctx, t: number): void {
  const HZ = 102

  // ---- ① 天空：横向刻线 ----
  skyHatch(g, PY + 2, HZ - 2, 11, 150)

  // ---- ② 斜雨：刻线。整片雨随镜头缓缓往下走 ----
  g.fillStyle = INK
  const drift = Math.round(t * 16) % 9
  for (let row = 0; row < 26; row++) {
    const by = PY + 2 + row * 4 + drift
    if (by > HZ - 3) continue
    for (let k = 0; k < 3; k++) {
      const bx = PX + 4 + Math.round(hash(row * 17 + k * 41 + 3) * 208)
      // 45° 斜划：三格拼成一道雨线
      for (let s = 0; s < 3; s++) {
        const x = bx - s * 2
        const y = by + s * 2
        if (x < PX + 1 || x > PX + 222 || y > HZ - 3) continue
        fill(g, x, y, 3, 1)
      }
    }
  }

  // ---- ③ 孤儿院：实心黑块 + 阶梯山墙 ----
  g.fillStyle = INK
  fill(g, 228, 34, PX + PW - 228, HZ - 34)
  // 山墙：从墙顶逐行收窄
  for (let i = 0; i < 14; i++) {
    const w = 148 - i * 10
    fill(g, 302 - w / 2, 34 - i * 2, Math.max(8, w), 2)
  }

  // 墙上的窗：纸白内芯 + 黑窗棂 + 1px 黑框
  for (const [wx, wy] of [[236, 52], [264, 52], [330, 52], [358, 52]] as const) {
    g.fillStyle = PAPER
    fill(g, wx + 1, wy + 1, 10, 14)
    g.fillStyle = INK
    fill(g, wx + 5, wy + 1, 2, 14)
    fill(g, wx + 1, wy + 8, 10, 1)
    fill(g, wx, wy, 12, 1)
    fill(g, wx, wy + 15, 12, 1)
    fill(g, wx, wy, 1, 16)
    fill(g, wx + 11, wy, 1, 16)
  }

  // ---- ④ 石拱门：纸白拱圈（留白刻轮廓）+ 黑洞口的门板 ----
  const arcCX = 302
  const arcR = 22
  const arcSpring = 76
  const arch = (grow: number, top: number): void => {
    for (let y = top; y < HZ; y++) {
      const dy = arcSpring - y
      const r = arcR + grow
      const hw = dy <= 0 ? r : Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)))
      if (hw <= 0) continue
      fill(g, arcCX - hw, y, hw * 2, 1)
    }
  }
  g.fillStyle = PAPER
  arch(5, arcSpring - arcR - 5)
  g.fillStyle = INK
  arch(0, arcSpring - arcR)
  // 门板的竖缝：门洞里唯一的亮线
  g.fillStyle = PAPER
  for (const k of [-1, 0, 1]) fill(g, arcCX + k * 12, arcSpring - 8, 1, HZ - arcSpring + 8)

  // ---- ⑤ 地面刻线 → 台阶（每级之间留一道纸白缝） ----
  groundHatch(g, HZ + 2, PY + PH - 2, 21)
  g.fillStyle = INK
  fill(g, arcCX - 26, HZ, 52, 3)
  fill(g, arcCX - 32, HZ + 5, 64, 3)
  fill(g, arcCX - 38, HZ + 10, 76, 3)

  // ---- ⑥ 焦点：篮子。先把周围刻线刻掉一圈纸白，再压黑篮子 ----
  g.fillStyle = PAPER
  fill(g, 112, 94, 74, 52)

  // 襁褓：纸白包裹 + 1px 黑轮廓（不然纸白会化进纸白的留白里）
  g.fillStyle = INK
  for (let y = 99; y < 118; y++) {
    const p = (118 - y) / 19
    const w = Math.round(28 - p * 12)
    fill(g, 148 - w / 2, y, w, 1)
  }
  g.fillStyle = PAPER
  for (let y = 100; y < 117; y++) {
    const p = (117 - y) / 17
    const w = Math.round(26 - p * 12)
    fill(g, 148 - w / 2, y, w, 1)
  }
  // 襁褓上的两道褶（黑刻线）
  g.fillStyle = INK
  fill(g, 139, 106, 18, 1)
  fill(g, 141, 112, 14, 1)
  // 婴儿的头：黑，露在襁褓上沿
  fill(g, 144, 96, 9, 7)

  // 篮身：上宽下窄的梯形；篮沿是一道黑
  g.fillStyle = INK
  taper(g, 148, 116, 140, 38, 26)
  fill(g, 148 - 19, 114, 38, 3)
  // 篮口：纸白一圈（襁褓从这里冒出来）
  g.fillStyle = PAPER
  fill(g, 148 - 17, 115, 34, 1)
  // 编织纹：三道纸白横线 + 五道竖刻线
  g.fillStyle = PAPER
  for (const wy of [122, 128, 134]) {
    const p = (wy - 116) / 24
    const w = Math.round(34 - p * 9)
    fill(g, 148 - w / 2, wy, w, 1)
  }
  for (const k of [-2, -1, 0, 1, 2]) fill(g, 148 + k * 8, 118, 1, 20)

  // ---- ⑦ 手：从画面右下伸上来，指节按在门板上 ----
  const knock = Math.min(1, Math.max(0, (t - 0.5) / 1.2))
  const tipY = Math.round(96 + 7 * (1 - knock))
  silhouette(g, pad => {
    // 前臂：从画面右下角斜上来
    for (let i = 0; i <= 34; i++) {
      const p = i / 34
      const x = 352 + (318 - 352) * p
      const y = 158 + (tipY + 30 - 158) * p
      fill(g, x - 7 - pad, y - pad, 15 + pad * 2, 13 + pad * 2)
    }
    // 手掌（按在门洞下沿，一半压在台阶上）
    fill(g, 296 - pad, tipY + 13 - pad, 30 + pad * 2, 23 + pad * 2)
    // 四根手指朝上，指节抵着门板
    for (let k = 0; k < 4; k++) {
      fill(g, 298 + k * 7 - pad, tipY - pad, 4 + pad * 2, 19 + pad * 2)
    }
    // 拇指
    fill(g, 288 - pad, tipY + 18 - pad, 9 + pad * 2, 10 + pad * 2)
  })
  // 手指之间的缝：纸白的一道细线，把手从一块黑里分出来
  g.fillStyle = PAPER
  for (let k = 0; k < 3; k++) fill(g, 302 + k * 7, tipY + 2, 1, 13)

  // ---- ⑨ 印痕噪点：版子的粗糙感 ----
  for (let i = 0; i < 150; i++) {
    const x = PX + Math.round(hash(i * 19 + 1) * (PW - 2))
    const y = PY + Math.round(hash(i * 7 + 3) * (PH - 2))
    g.fillStyle = INK
    fill(g, x, y, i % 3 === 0 ? 2 : 1, 1)
  }
}

// ============================================================
// 镜头 2 · 工厂车间
// ------------------------------------------------------------
// 焦点：一排巨大的纱锭架（密集短竖线 + 实心黑轮），
// 架子下一个矮小的人影抱着四个纱锭，右侧是高大工头的剪影。
// 两个剪影的身高差就是全部台词：1 : 1.9。
// ============================================================

function paintFactory(g: Ctx, t: number): void {
  const HZ = 104

  // ---- ① 屋顶 / 天窗：上缘一条黑，凿出两条亮的窗带 ----
  g.fillStyle = INK
  fill(g, PX, PY, PW, 26)
  g.fillStyle = PAPER
  for (let k = 0; k < 4; k++) {
    fill(g, PX + 26 + k * 90, PY + 6, 52, 2)
    fill(g, PX + 26 + k * 90, PY + 14, 52, 2)
  }

  // ---- ② 两根横梁 + 五根立柱（机器骨架） ----
  g.fillStyle = INK
  fill(g, PX, 34, PW, 7)
  fill(g, PX, 84, PW, 7)
  for (const lx of [24, 114, 206, 298, 362]) fill(g, lx, 34, 5, HZ - 34)

  // ---- ③ 纱锭：黑框 + 纸白身 + 随机器上卷的缠纱线 ----
  const ph = (t * 12) % 5
  for (let x = 34; x < PX + PW - 10; x += 9) {
    // 黑框（含头部）把纸白身从纸白的墙里定出来
    g.fillStyle = INK
    fill(g, x - 1, 43, 7, 41)
    // 头：切角的黑轮
    fill(g, x - 2, 41, 8, 2)
    fill(g, x - 1, 43, 6, 4)
    fill(g, x - 2, 47, 8, 2)
    // 纸白的纱锭身
    g.fillStyle = PAPER
    fill(g, x + 1, 49, 3, 32)
    // 缠纱：缠线随机器往上卷
    g.fillStyle = INK
    for (let y = 50 + Math.round(ph); y < 80; y += 5) fill(g, x + 1, y, 3, 1)
  }

  // ---- ④ 地面刻线 ----
  groundHatch(g, HZ + 1, PY + PH - 2, 33)
  g.fillStyle = INK
  fill(g, PX, HZ, PW, 2)

  // ---- ⑤ 童工：抱着五个纱锭，身高 52（工头的一半） ----
  const boyX = 132
  const boyTop = 80
  silhouette(g, pad => {
    fill(g, boyX - 7 - pad, boyTop - pad, 14 + pad * 2, 12 + pad * 2)        // 头
    taper(g, boyX, boyTop + 12, boyTop + 36, 21, 14, pad)                    // 上身
    fill(g, boyX - 8 - pad, boyTop + 36 - pad, 6 + pad * 2, 16 + pad * 2)    // 左腿
    fill(g, boyX + 2 - pad, boyTop + 36 - pad, 6 + pad * 2, 16 + pad * 2)    // 右腿
  })
  // 怀里那一抱纱锭：五根纸白的竖条，被两条黑手臂箍住
  g.fillStyle = PAPER
  for (let k = 0; k < 5; k++) fill(g, boyX - 12 + k * 5, boyTop + 11, 3, 24)
  g.fillStyle = INK
  fill(g, boyX - 15, boyTop + 22, 30, 4)     // 前臂
  fill(g, boyX - 16, boyTop + 12, 12, 4)     // 上臂
  // 箍住纱锭的两只手
  fill(g, boyX - 16, boyTop + 20, 5, 8)
  fill(g, boyX + 11, boyTop + 20, 5, 8)

  // ---- ⑥ 工头：身高 86，一条手臂横指过来 ----
  const manX = 302
  const manTop = 52
  silhouette(g, pad => {
    fill(g, manX - 12 - pad, manTop - 6 - pad, 24 + pad * 2, 5 + pad * 2)    // 帽子
    fill(g, manX - 7 - pad, manTop - pad, 14 + pad * 2, 14 + pad * 2)        // 头
    taper(g, manX, manTop + 14, manTop + 48, 30, 20, pad)                    // 上身
    fill(g, manX - 9 - pad, manTop + 48 - pad, 7 + pad * 2, 38 + pad * 2)    // 左腿
    fill(g, manX + 2 - pad, manTop + 48 - pad, 7 + pad * 2, 38 + pad * 2)    // 右腿
    fill(g, manX - 30 - pad, manTop + 20 - pad, 24 + pad * 2, 6 + pad * 2)   // 指过来的手臂
    fill(g, manX - 34 - pad, manTop + 22 - pad, 6 + pad * 2, 4 + pad * 2)    // 手
  })

  // ---- ⑦ 印痕噪点 ----
  for (let i = 0; i < 130; i++) {
    const x = PX + Math.round(hash(i * 19 + 5) * (PW - 2))
    const y = PY + Math.round(hash(i * 7 + 9) * (PH - 2))
    g.fillStyle = INK
    fill(g, x, y, i % 4 === 0 ? 2 : 1, 1)
  }
}

// ============================================================
// 镜头 3 · 夜校阁楼
// ------------------------------------------------------------
// 焦点：煤气灯（光的放射用点状刻线，一格一格点出来）。
// 桌上一本摊开的书、一张抄写纸、一只手、一支羽毛笔；
// 窗外是城市的烟囱剪影，烟在往上走。
// ============================================================

function paintAttic(g: Ctx, t: number): void {
  const TABLE = 92                       // 桌面高度

  // ---- ① 夜：整面墙压成密排横刻线。木板刻出来的夜是黑的，光要靠留白刻 ----
  g.fillStyle = INK
  for (let y = PY + 1; y < TABLE; y += 2) fill(g, PX, y, PW, 1)

  // ---- ② 阁楼的斜梁：两道纸白刻线（留白） ----
  g.fillStyle = PAPER
  for (let x = PX; x < PX + 216; x++) {
    const y = Math.round(38 - (x - PX) * 0.1)
    fill(g, x, y, 1, 4)
    fill(g, x, y + 15, 1, 3)
  }

  // ---- ③ 焦点：煤气灯的光。放射的纸白刻线，随呼吸一长一短 ----
  const breath = Math.sin(t * 1.9)
  g.fillStyle = PAPER
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2 + 0.08
    const len = 30 + (i % 6) * 6 + breath * 3
    for (let r = 18; r < len; r += 2) {
      const x = Math.round(96 + Math.cos(a) * r)
      const y = Math.round(46 + Math.sin(a) * r * 0.92)
      if (x < PX + 1 || x > PX + PW - 2 || y < PY + 1 || y > TABLE - 2) continue
      fill(g, x, y, 1, 1)
    }
  }

  // ---- ④ 窗：纸白窗洞 + 黑窗框 + 窗外城市的烟囱（烟在往上走） ----
  g.fillStyle = PAPER
  fill(g, 272, 18, 80, 50)
  g.fillStyle = INK
  fill(g, 268, 14, 88, 4)
  fill(g, 268, 68, 88, 4)
  fill(g, 268, 14, 4, 58)
  fill(g, 352, 14, 4, 58)
  fill(g, 314, 18, 3, 50)     // 窗棂竖
  fill(g, 272, 40, 80, 3)     // 窗棂横
  const chimneys: [number, number, number][] = [
    [278, 42, 9], [290, 34, 7], [301, 48, 10], [326, 40, 8], [338, 52, 11],
  ]
  for (const [cx, cy, cw] of chimneys) {
    fill(g, cx, cy, cw, 68 - cy)
    fill(g, cx + 1, cy - 3, Math.max(2, cw - 2), 3)
    for (let k = 0; k < 4; k++) {
      const yy = cy - 6 - k * 4 - Math.round((t * 5) % 4)
      if (yy < 18) continue
      fill(g, cx + 1 + k + Math.round(hash(cx + k) * 3), yy, Math.max(2, cw - k * 2), 1)
    }
  }

  // ---- ⑤ 煤气灯本尊：黑的罩子，罩里一团纸白的火 ----
  g.fillStyle = INK
  fill(g, 94, 20, 4, 12)                 // 吊杆
  fill(g, 82, 30, 28, 4)                 // 顶盖
  for (let y = 34; y < 56; y++) {        // 罩身：上窄下宽的喇叭口
    const p = (y - 34) / 22
    const w = Math.round(20 + p * 14)
    fill(g, 96 - w / 2, y, w, 1)
  }
  fill(g, 78, 56, 36, 3)                 // 罩口
  g.fillStyle = PAPER
  for (let y = 38; y < 54; y++) {        // 火焰
    const p = (54 - y) / 16
    const w = Math.max(1, Math.round(9 * p))
    fill(g, 96 - w / 2, y, w, 1)
  }

  // ---- ⑥ 桌子：被灯照亮的那一块，是纸白的 ----
  g.fillStyle = PAPER
  fill(g, 26, TABLE, 332, 12)
  g.fillStyle = INK
  fill(g, 26, TABLE, 332, 2)
  fill(g, 26, TABLE + 12, 332, 2)
  // 桌下那一片暗：密集横刻线（比地面更黑，桌子才浮得起来）
  const legH = PY + PH - TABLE - 14
  for (let y = TABLE + 14; y < PY + PH - 2; y += 3) fill(g, PX, y, PW, 1)
  // 两条桌腿 + 左缘的一道纸白高光
  g.fillStyle = INK
  fill(g, 44, TABLE + 14, 10, legH)
  fill(g, 300, TABLE + 14, 10, legH)
  g.fillStyle = PAPER
  fill(g, 44, TABLE + 14, 1, legH)
  fill(g, 300, TABLE + 14, 1, legH)

  // ---- ⑦ 桌上：摊开的书（近景大书）/ 手 / 羽毛笔 / 墨水瓶 ----
  // 书：两页纸白 + 中书脊；左页是抄来的，右页是正在写的
  g.fillStyle = PAPER
  fill(g, 130, 68, 140, 30)
  g.fillStyle = INK
  fill(g, 130, 68, 140, 2)
  fill(g, 130, 96, 140, 2)
  fill(g, 130, 68, 2, 30)
  fill(g, 268, 68, 2, 30)
  fill(g, 196, 68, 5, 30)                      // 书脊
  // 左页：抄完的字行
  for (let k = 0; k < 8; k++) fill(g, 138, 74 + k * 2, 48 - (k % 3) * 8, 1)
  // 右页：正在写的行
  for (let k = 0; k < 8; k++) fill(g, 206, 74 + k * 2, 54 - (k % 4) * 9, 1)
  // 墨水瓶
  g.fillStyle = INK
  fill(g, 276, 78, 13, 18)
  fill(g, 280, 72, 6, 6)
  // 抄书的手：黑剪影压在右页上，食指顺着字行
  const penX = 190 + Math.round(Math.sin(t * 2.1) * 7)
  silhouette(g, pad => {
    fill(g, 218 - pad, 58 - pad, 32 + pad * 2, 22 + pad * 2)     // 手掌
    fill(g, 192 - pad, 69 - pad, 28 + pad * 2, 8 + pad * 2)      // 食指
    fill(g, 246 - pad, 48 - pad, 12 + pad * 2, 16 + pad * 2)     // 手腕
  })
  // 蜷起来的另外三根手指：手掌上两道纸白缝
  g.fillStyle = PAPER
  fill(g, 226, 63, 1, 15)
  fill(g, 236, 63, 1, 15)
  // 羽毛笔：从手腕斜着落到纸上
  g.fillStyle = INK
  for (let i = 0; i <= 34; i++) {
    const p = i / 34
    const x = 250 + (penX - 250) * p
    const y = 52 + (88 - 52) * p
    fill(g, x, y, 2, 2)
  }
  fill(g, penX - 1, 86, 3, 5)                  // 笔尖
}

// ============================================================
// 镜头 4 · 考场
// ------------------------------------------------------------
// 焦点：最前面那个穿工装裤的矮小身影 —— 没有白领、两条背带、
// 比旁边的人矮半个头，四周刻了一圈纸白，从人群里被孤立出来。
// ============================================================

function paintExam(g: Ctx, t: number): void {
  const HZ = 96                // 地平线：后排学生的脚正好落在这里

  // ---- ① 墙：横刻线 ----
  g.fillStyle = INK
  for (let y = PY + 4; y < HZ; y += 5) fill(g, PX + 2, y, PW - 4, 1)

  // ---- ② 黑板（黑块 + 纸白外框 + 几行粉笔字） ----
  g.fillStyle = PAPER
  fill(g, 96, 16, 142, 48)
  g.fillStyle = INK
  fill(g, 100, 20, 134, 40)
  g.fillStyle = PAPER
  for (let k = 0; k < 3; k++) fill(g, 108 + k * 5, 28 + k * 9, 62 - k * 10, 1)

  // ---- ③ 地面刻线（先画，人物站在它上面） ----
  groundHatch(g, HZ, PY + PH - 2, 41)

  // ---- ④ 讲台 ----
  g.fillStyle = INK
  fill(g, 266, 92, 110, 32)
  g.fillStyle = PAPER
  fill(g, 270, 90, 102, 2)

  // ---- ⑤ 考官：秃顶 + 眼镜（用留白刻，不画五官） ----
  const ex = 306
  const exTop = 40
  g.fillStyle = INK
  fill(g, ex - 10, exTop, 20, 17)                   // 头
  taper(g, ex, exTop + 18, 72, 22, 38)              // 肩
  taper(g, ex, 72, 97, 38, 30)                      // 身体
  fill(g, ex + 14, 78, 18, 6)                       // 手臂搭在讲台上
  g.fillStyle = PAPER
  fill(g, ex - 7, exTop + 1, 14, 3)                 // 秃顶
  fill(g, ex - 9, exTop + 8, 18, 1)                 // 眼镜
  fill(g, ex - 9, exTop + 6, 3, 3)
  fill(g, ex + 6, exTop + 6, 3, 3)
  // 眼镜摘下又戴上的那一下：t≈1.6s 起一行小纸白在镜框下缘闪一下
  if (t > 1.6 && t < 2.0) fill(g, ex - 9, exTop + 10, 18, 1)

  // ---- ⑥ 后排：五个背影（小，脚落在 96 的地平线上） ----
  for (const bx of [40, 96, 148, 200, 248]) {
    g.fillStyle = INK
    fill(g, bx - 5, 66, 10, 9)
    taper(g, bx, 75, 96, 15, 22)
    g.fillStyle = PAPER
    fill(g, bx - 5, 76, 11, 2)                      // 白领
    fill(g, bx, 78, 1, 6)                           // 领口那道竖线
  }

  // ---- ⑦ 前排：两个穿校服的（大，脚落在 128） ----
  for (const fx of [60, 230]) {
    g.fillStyle = INK
    fill(g, fx - 8, 84, 16, 14)
    taper(g, fx, 98, 128, 21, 31)
    g.fillStyle = PAPER
    fill(g, fx - 6, 99, 13, 3)                      // 白领
    fill(g, fx, 102, 1, 8)                          // 领口竖线
  }

  // ---- ⑧ 焦点：工装裤的矮小身影（前排正中，四周刻掉一圈纸白） ----
  const gx = 150
  silhouette(g, pad => {
    fill(g, gx - 7 - pad, 92 - pad, 14 + pad * 2, 12 + pad * 2)      // 头
    fill(g, gx - 9 - pad, 104 - pad, 18 + pad * 2, 19 + pad * 2)     // 上身（窄肩、没有白领）
    fill(g, gx - 13 - pad, 123 - pad, 26 + pad * 2, 17 + pad * 2)    // 工装裤（宽、两条裤腿）
  })
  // 工装的记号：两条背带 + 裤腰 + 裤缝，全是纸白细线
  g.fillStyle = PAPER
  fill(g, gx - 5, 105, 2, 18)                       // 左背带
  fill(g, gx + 4, 105, 2, 18)                       // 右背带
  fill(g, gx - 12, 122, 25, 1)                      // 裤腰
  fill(g, gx, 124, 1, 16)                           // 裤缝
}

// ============================================================
// 镜头 5 · 放榜
// ------------------------------------------------------------
// 焦点：一只手的手指，停在长榜最下面第二行。
// 榜是纸白的，名字是一道道横刻线 —— 越往下越短，倒数第二行被手指压住。
// ============================================================

function paintResults(g: Ctx, t: number): void {
  // ---- ① 墙：整幅横刻线 ----
  g.fillStyle = INK
  for (let y = PY + 3; y < PY + PH; y += 4) fill(g, PX, y, PW, 1)

  // ---- ② 长榜：纸白 + 双线框 ----
  g.fillStyle = PAPER
  fill(g, 88, 12, 214, 126)
  g.fillStyle = INK
  fill(g, 86, 10, 218, 2)
  fill(g, 86, 10, 2, 130)
  fill(g, 302, 10, 2, 130)
  fill(g, 86, 138, 218, 2)
  fill(g, 92, 16, 206, 1)
  fill(g, 92, 16, 1, 118)
  fill(g, 297, 16, 1, 118)
  fill(g, 92, 133, 206, 1)
  // 榜顶两颗钉子
  fill(g, 100, 6, 5, 5)
  fill(g, 286, 6, 5, 5)

  // ---- ③ 名字：一道横线就是一个名字，一行压着一行，一直排到榜底 ----
  for (let r = 0; r < 21; r++) {
    const y = Math.round(21 + r * 5.2)
    if (y > 130) break
    const w = 26 + Math.round(hash(r * 13 + 7) * 66)
    fill(g, 100, y, w, 1)
    fill(g, 172 + Math.round(hash(r * 7 + 3) * 10), y, 9, 1)   // 名次那一列
  }

  // ---- ④ 倒数第二行：加粗 + 左边一个小方框标出来 ----
  const markY = Math.round(21 + 17 * 5.2)          // 109 → 榜上最下面那几行
  fill(g, 100, markY - 1, 62, 2)
  fill(g, 172, markY - 1, 11, 2)
  fill(g, 95, markY - 4, 1, 8)                     // 小括号
  fill(g, 95, markY - 4, 3, 1)
  fill(g, 95, markY + 3, 3, 1)

  // ---- ⑤ 焦点：手指从右下伸上来，停在那一行 ----
  const slide = Math.min(1, Math.max(0, (t - 0.25) / 0.9))
  const tipY = Math.round(124 - 7 * slide)
  silhouette(g, pad => {
    // 前臂：从画面右下角伸进来
    for (let i = 0; i <= 44; i++) {
      const p = i / 44
      const x = 380 + (296 - 380) * p
      const y = 156 + (tipY + 16 - 156) * p
      fill(g, x - 8 - pad, y - pad, 17 + pad * 2, 13 + pad * 2)
    }
    // 手掌
    fill(g, 252 - pad, tipY + 1 - pad, 38 + pad * 2, 24 + pad * 2)
    // 食指：从手掌斜着伸上去，指尖压在倒数第二行上
    for (let i = 0; i <= 56; i++) {
      const p = i / 56
      const x = 186 + (254 - 186) * p
      const y = (tipY - 12) + (tipY + 4 - (tipY - 12)) * p
      fill(g, x - pad, y - 3 - pad, 5 + pad * 2, 7 + pad * 2)
    }
    // 指尖
    fill(g, 180 - pad, tipY - 14 - pad, 10 + pad * 2, 7 + pad * 2)
  })
  // 蜷起来的另外三根手指：手掌上两道纸白缝，让它读成「手」而不是一根棒
  g.fillStyle = PAPER
  fill(g, 258, tipY + 4, 1, 16)
  fill(g, 270, tipY + 4, 1, 16)
  fill(g, 282, tipY + 6, 1, 12)
}

// ============================================================
// 镜头 6 · 船厂
// ------------------------------------------------------------
// 焦点：船台上一排巨大的弧形肋材骨架（左弧 + 右弧 + 三道横板条），
// 骨架下站着一个很小的人，面前是一张图纸；远处烟囱在冒烟。
// ============================================================

function paintShipyard(g: Ctx, t: number): void {
  const BOT = 124            // 船台地面

  // ---- ① 天空：只在最上面压一层横刻线（下面的留白全让给肋骨的剪影） ----
  skyHatch(g, PY + 2, 32, 51, 130)

  // ---- ② 远处烟囱（画面最右，避开肋骨）：阶梯顶 + 往上走的烟 ----
  g.fillStyle = INK
  fill(g, 360, 62, 12, BOT - 62)
  fill(g, 362, 56, 8, 6)
  fill(g, 364, 50, 4, 6)
  for (let k = 0; k < 7; k++) {
    const yy = 46 - k * 4 + Math.round((t * 7) % 4)
    if (yy < PY + 3) continue
    fill(g, 365 + Math.round(k * 1.2), yy, Math.max(2, 7 - k), 1)
  }

  // ---- ③ 焦点：六根肋骨。左右两条弧 + 三道横板条 + 顶端一道长横梁 ----
  for (let j = 0; j < 6; j++) {
    const cx = 46 + j * 56
    const k = 1 - j * 0.07
    const top = 34
    const H = BOT - top
    g.fillStyle = INK
    for (let y = 0; y < H; y += 2) {
      const p = y / H
      const half = Math.round(2 + 27 * k * Math.sqrt(Math.max(0, 1 - p * p * 0.86)))
      fill(g, cx - half, top + y, 2, 2)
      fill(g, cx + half - 2, top + y, 2, 2)
    }
    for (const q of [0.24, 0.52, 0.8]) {
      const yy = Math.round(top + H * q)
      const hw = Math.round(2 + 27 * k * Math.sqrt(Math.max(0, 1 - q * q * 0.86)))
      if (hw > 5) fill(g, cx - hw, yy, hw * 2, 1)
    }
  }
  // 顶端的长横梁：把六根肋骨挂在同一条船台上
  g.fillStyle = INK
  fill(g, PX, 30, PW, 4)

  // ---- ④ 龙骨 + 地面 ----
  fill(g, PX, BOT, PW, 5)
  groundHatch(g, BOT + 6, PY + PH - 2, 61)

  // ---- ⑤ 图纸架 + 图纸 ----
  g.fillStyle = INK
  fill(g, 74, 96, 5, 28)
  fill(g, 124, 96, 5, 28)
  g.fillStyle = PAPER
  fill(g, 68, 76, 68, 34)
  g.fillStyle = INK
  fill(g, 68, 76, 68, 2)
  fill(g, 68, 108, 68, 2)
  fill(g, 68, 76, 2, 34)
  fill(g, 134, 76, 2, 34)
  for (let r = 0; r < 6; r++) {
    fill(g, 76, 82 + r * 4, 18 + r * 8, 1)
    if (r % 2 === 1) fill(g, 80 + r * 5, 80 + r * 4, 1, 7)
  }

  // ---- ⑥ 站在图纸前的人：很小，只是一个剪影 ----
  const px2 = 158
  silhouette(g, pad => {
    fill(g, px2 - 6 - pad, 76 - pad, 13 + pad * 2, 11 + pad * 2)
    taper(g, px2, 87, 110, 17, 13, pad)
    fill(g, px2 - 7 - pad, 110 - pad, 6 + pad * 2, 14 + pad * 2)
    fill(g, px2 + 1 - pad, 110 - pad, 6 + pad * 2, 14 + pad * 2)
  })
}

// ============================================================
// 镜头 7 · 回到古堡
// ------------------------------------------------------------
// 焦点：前景的窗棂（十字格），透过它看聚斯霍芬堡的剪影 ——
// 尖顶、塔楼、雉堞、飞扶壁，只有一扇窗亮着灯。
// 这个镜头是 BGM 的入口：从梦回到现实。
// ============================================================

function paintCastle(g: Ctx, t: number): void {
  const HZ = 132

  // ---- ① 夜空：稀疏的横刻线（夜是刻出来的，不是涂出来的） ----
  g.fillStyle = INK
  for (let row = 0; row < 22; row++) {
    const y = PY + 3 + row * 5
    if (y > HZ - 6) break
    for (let k = 0; k < 4; k++) {
      const x = PX + 3 + Math.round(hash(row * 11 + k * 29) * (PW - 56))
      const len = 8 + Math.round(hash(row * 7 + k * 13) * 32)
      fill(g, x, y, len, 1)
    }
  }
  // 月亮：留白的一个圆 + 一圈短刻线做月晕
  g.fillStyle = PAPER
  for (let y = -10; y <= 10; y++) {
    const w = Math.round(Math.sqrt(Math.max(0, 100 - y * y)) * 2)
    if (w > 0) fill(g, 58 - w / 2, 40 + y, w, 1)
  }
  // 月亮的黑轮廓：纸白底上的白月亮要靠这一圈刻痕才立得起来
  g.fillStyle = INK
  for (let y = -10; y <= 10; y++) {
    const w = Math.round(Math.sqrt(Math.max(0, 100 - y * y)))
    if (w <= 0) continue
    fill(g, 58 - w, 40 + y, 1, 1)
    fill(g, 58 + w, 40 + y, 1, 1)
  }
  g.fillStyle = PAPER
  for (let a = 0; a < 14; a++) {
    const ang = (a / 14) * Math.PI * 2 + 0.15
    for (let r = 12; r < 16; r += 2) {
      fill(g, 58 + Math.cos(ang) * r, 40 + Math.sin(ang) * r, 1, 1)
    }
  }
  g.fillStyle = INK
  fill(g, 53, 35, 3, 3)          // 月面上的一点刻痕
  fill(g, 60, 43, 3, 2)

  // ---- ② 山脊 ----
  g.fillStyle = INK
  fill(g, PX, HZ - 3, PW, 4)

  // ---- ③ 聚斯霍芬堡：实心黑块的剪影 ----
  const groundY = HZ
  g.fillStyle = INK
  fill(g, 152, 52, 80, groundY - 52)                          // 主楼
  for (let k = 0; k < 5; k++) fill(g, 156 + k * 15, 45, 9, 8)  // 雉堞
  // 左塔 + 尖顶（全画面最高的那根）
  fill(g, 116, 38, 26, groundY - 38)
  spire(g, 129, 38, 26, 26)
  // 右塔 + 尖顶
  fill(g, 242, 46, 26, groundY - 46)
  spire(g, 255, 46, 26, 28)
  // 飞扶壁：把塔楼与主楼拉在一起的两串阶梯
  for (let i = 0; i < 6; i++) {
    fill(g, 142 + i, 92 + i * 4, 10 - i, 3)
    fill(g, 232 - i, 86 + i * 4, 10 - i, 3)
  }
  // 旗杆 + 一发塔尖上的十字
  fill(g, 129, 6, 2, 8)
  fill(g, 126, 8, 8, 1)

  // ---- ④ 窗：大部分黑着，左塔那扇亮着灯 ----
  g.fillStyle = PAPER
  for (const [wx, wy] of [
    [160, 64], [176, 64], [192, 64], [208, 64],
    [160, 84], [192, 84], [250, 62],
  ] as const) fill(g, wx, wy, 4, 6)
  // 焦点：那一点灯火 —— 窗口本身，外面几点纸白的刻痕当光
  const flick = Math.round(1 + Math.sin(t * 3.4))
  fill(g, 123, 55, 8, 10)                     // 亮着的那扇窗
  g.fillStyle = INK
  fill(g, 126, 55, 1, 10)                     // 一道窗棂，把灯火切成两半
  g.fillStyle = PAPER
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2 + 0.35
    const r = 8 + (a % 3) + flick
    fill(g, 127 + Math.cos(ang) * r, 60 + Math.sin(ang) * r, 1, 1)
  }

  // ---- ⑤ 前景：窗棂（十字格）。这是整个镜头的视觉焦点 ----
  g.fillStyle = INK
  fill(g, PX, PY, PW, 9)                     // 上框
  fill(g, PX, PY + PH - 9, PW, 9)            // 下框
  fill(g, PX, PY, 9, PH)                     // 左框
  fill(g, PX + PW - 9, PY, 9, PH)            // 右框
  fill(g, 186, PY, 8, PH)                    // 竖棂
  fill(g, PX, 74, PW, 8)                     // 横棂
  // 木纹：窗棂上各一道留白刻线（木头顶面被月光照着的那一条）
  g.fillStyle = PAPER
  fill(g, 189, PY + 9, 2, 74 - PY - 9)
  fill(g, 189, 84, 2, PY + PH - 9 - 84)
  fill(g, PX + 9, 76, 186 - PX - 9, 2)
  fill(g, 196, 76, PX + PW - 9 - 196, 2)

  // ---- ⑥ 印痕噪点 ----
  for (let i = 0; i < 120; i++) {
    const x = PX + Math.round(hash(i * 19 + 7) * (PW - 2))
    const y = PY + Math.round(hash(i * 7 + 11) * (PH - 2))
    g.fillStyle = INK
    fill(g, x, y, i % 4 === 0 ? 2 : 1, 1)
  }
}

// ============================================================
// 分镜表
// ============================================================

export interface MontageShot {
  /** 右下角的版号（罗马数字） */
  mark: string
  /** 旁白：一条一段，逐字打出 */
  lines: string[]
  /** 本镜头时长（秒）。全片 3.5–5 秒一镜 */
  dur: number
  /** 只画画面区；纸底、图说带、版框由 renderFrame 统一负责 */
  paint: (g: Ctx, t: number) => void
}

/**
 * 七张版画。旁白全部照 novel-01.md 场景 4（L250–L332），
 * 单条 ≤64 字；最后一句「这一切都不真实。像梦一样。」原样保留。
 */
export const SHOTS: MontageShot[] = [
  {
    mark: 'I',
    dur: 3.8,
    paint: paintOrphanage,
    lines: ['（法兰克福。孤儿院。那年我三天大。）'],
  },
  {
    mark: 'II',
    dur: 4.8,
    paint: paintFactory,
    lines: [
      '（十二岁。木底鞋，帆布手套。一天两百趟，一月六千趟。）',
      '（三个月后，手指肿得握不住筷子。）',
    ],
  },
  {
    mark: 'III',
    dur: 4.8,
    paint: paintAttic,
    lines: [
      '（白天搬纱锭，晚上学代数。凌晨在阁楼抄书。）',
      '（抄完《算术原理》，抄了半本《解析几何》，三分之一《自然哲学的数学原理》。）',
    ],
  },
  {
    mark: 'IV',
    dur: 4.8,
    paint: paintExam,
    lines: [
      '（全帝国每年只招六十个人。我穿工装裤站在他们中间。）',
      '（考官摘下眼镜擦了擦又戴上，说：那你应该考不上。）',
    ],
  },
  {
    mark: 'V',
    dur: 4.0,
    paint: paintResults,
    lines: [
      '（我考上了。第五十九名。倒数第二。）',
      '（但倒数第二也是考上了。）',
    ],
  },
  {
    mark: 'VI',
    dur: 4.8,
    paint: paintShipyard,
    lines: [
      '（后来我去了基尔造船厂。设计师助理，月薪一百二十马克。）',
      '（真实的工作是整理图纸、计算数据、写报告，以及在会议上端茶倒水。）',
    ],
  },
  {
    mark: 'VII',
    dur: 4.6,
    paint: paintCastle,
    lines: [
      '（现在我有了一座古堡，一个管家，一个女仆，和一个我从未听说过的姓氏。）',
      '（这一切都不真实。像梦一样。）',
    ],
  },
]

// ------------------------------------------------------------
// 时间轴
// ------------------------------------------------------------

/** 每镜头的起始秒 */
export const SHOT_START: number[] = (() => {
  const out: number[] = []
  let acc = 0
  for (const s of SHOTS) { out.push(acc); acc += s.dur }
  return out
})()

/** 全片总时长（秒） */
export const MONTAGE_TOTAL: number = SHOT_START[SHOT_START.length - 1] + SHOTS[SHOTS.length - 1].dur

/** 跳过时落到的时刻：最后一个镜头的最后一帧（淡出刚起，画面与旁白都还在） */
export const MONTAGE_SKIP_AT = MONTAGE_TOTAL - 0.45

/** 镜头 2（工厂）里的那一下钟声：时间被吃掉的标点 */
export const MONTAGE_BELL_AT = SHOT_START[1] + 0.45

/** 镜头 7 起：古堡的 BGM 淡入（梦回到现实） */
export const MONTAGE_BGM_AT = SHOT_START[6] + 0.15

/** 镜头内：画面淡入的时长 */
const FADE_IN = 0.5
/** 镜头内：画面淡出的时长 */
const FADE_OUT = 0.4
/** 镜头内：第一个字出现的时刻 */
const TYPE_START = 0.55
/** 镜头内：最后一个字最晚落在这个时刻之前（之后留 0.5s 静看 + 0.4s 淡出） */
const TYPE_TAIL = 0.9
/** 自然打字节拍（秒/字）——26 字/秒 */
const CHAR_DT = 0.038

/** 标点之后的额外停顿（倍率） */
const PUNCT: Record<string, number> = {
  '。': 2.4, '，': 1.7, '、': 1.7, '；': 1.7, '：': 1.7,
  '（': 1.6, '）': 1.6, '《': 1.3, '》': 1.3, '—': 2, '…': 2,
}

/** 每个镜头的字符序列 + 每个字出现的镜头内时刻 */
interface TypingPlan {
  chars: string[]
  at: number[]
}

const TYPING: TypingPlan[] = SHOTS.map(s => {
  const chars: string[] = []
  const gaps: number[] = []
  for (const line of s.lines) {
    for (const ch of Array.from(line)) {
      chars.push(ch)
      gaps.push(CHAR_DT * (PUNCT[ch] ?? 1))
    }
  }
  const span = gaps.reduce((a, b) => a + b, 0)
  const room = Math.max(0.5, s.dur - TYPE_TAIL - TYPE_START)
  // 时间不够就整体加速（时间富余则保留自然节奏，剩下的时间用来停留）
  const scale = span > room ? room / span : 1
  const at: number[] = []
  let acc = TYPE_START
  for (let i = 0; i < gaps.length; i++) {
    at.push(acc)
    acc += gaps[i] * scale
  }
  return { chars, at }
})

// ------------------------------------------------------------
// 图说：按估算宽度折行（不依赖 measureText，换行位置每次都一样）
// ------------------------------------------------------------

/** 一个字推进多宽（全角 = 字号，半角 = 0.55 字号） */
function charW(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0
  return cp < 0x2e80 ? CAP_SIZE * 0.56 : CAP_SIZE
}

/** 不能当行首的字符（它们要跟着上一行走） */
const BAD_HEAD = '）》」，。、；：！？'

function wrapLine(text: string): string[] {
  const rows: string[] = []
  let cur: string[] = []
  let w = 0
  for (const ch of Array.from(text)) {
    const cw = charW(ch) + CAP_GAP
    if (w + cw > CAP_W && cur.length > 0 && !BAD_HEAD.includes(ch)) {
      rows.push(cur.join(''))
      cur = []
      w = 0
    }
    cur.push(ch)
    w += cw
  }
  if (cur.length) rows.push(cur.join(''))

  // 尾部平衡：末行只剩两三个字时，从上一行借几个字下来 ——
  // 旁白是一句散文，不该折出「马克」「个我」这种孤零零的尾巴。
  if (rows.length > 1) {
    const lastChars = Array.from(rows[rows.length - 1])
    const prevChars = Array.from(rows[rows.length - 2])
    if (lastChars.length < 8 && prevChars.length > 12) {
      let take = Math.min(Math.ceil((prevChars.length - lastChars.length) / 2), 8)
      while (take > 0 && BAD_HEAD.includes(prevChars[prevChars.length - take])) take--
      if (take > 0) {
        rows[rows.length - 2] = prevChars.slice(0, prevChars.length - take).join('')
        rows[rows.length - 1] = prevChars.slice(prevChars.length - take).join('') + lastChars.join('')
      }
    }
  }
  return rows
}

/** 每个镜头的旁白折行结果（模块加载时算一次） */
const CAPTION_ROWS: string[][] = SHOTS.map(s => s.lines.flatMap(wrapLine))

// ------------------------------------------------------------
// 纯函数：任意一秒的那一帧
// ------------------------------------------------------------

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function smooth(a: number, b: number, v: number): number {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** 这一秒落在第几个镜头、镜头内第几秒 */
export function shotAt(t: number): { i: number; local: number } {
  const clamped = Math.max(0, Math.min(t, MONTAGE_TOTAL))
  for (let i = SHOTS.length - 1; i >= 0; i--) {
    if (clamped >= SHOT_START[i]) return { i, local: clamped - SHOT_START[i] }
  }
  return { i: 0, local: 0 }
}

/** 这一秒已经打出多少个字（给播放器判断击键音，画面那边自己也用一次） */
export function typedAt(t: number): { shot: number; shown: number } {
  const { i, local } = shotAt(t)
  const at = TYPING[i].at
  let n = 0
  while (n < at.length && at[n] <= local) n++
  return { shot: i, shown: n }
}

/** 版框：外面一圈纸边 + 双线框（GrimmBook 的收尾手法，改用整数 fillRect） */
function drawBorder(g: Ctx): void {
  g.fillStyle = INK
  // 外框 2px
  fill(g, 2, 2, MONTAGE_W - 4, 2)
  fill(g, 2, MONTAGE_H - 4, MONTAGE_W - 4, 2)
  fill(g, 2, 2, 2, MONTAGE_H - 4)
  fill(g, MONTAGE_W - 4, 2, 2, MONTAGE_H - 4)
  // 内框 1px
  fill(g, 7, 7, MONTAGE_W - 14, 1)
  fill(g, 7, MONTAGE_H - 8, MONTAGE_W - 14, 1)
  fill(g, 7, 7, 1, MONTAGE_H - 14)
  fill(g, MONTAGE_W - 8, 7, 1, MONTAGE_H - 14)
}

/** 图说带：纸白底 + 上缘分隔线 + 版号 + 逐字打出的旁白 */
function drawCaption(g: Ctx, i: number, local: number): void {
  // 图说带（把版画底部那一截密线盖成纸白，像版画下的题签）
  g.fillStyle = PAPER
  fill(g, PX, SEAM, PW, 58)
  g.fillStyle = INK
  fill(g, PX, SEAM, PW, 2)
  fill(g, PX, SEAM + 58, PW, 1)

  // 版号：右侧，一道短竖线隔开
  g.fillStyle = INK
  fill(g, PX + PW - 32, 160, 1, 26)
  g.font = `9px ${SERIF}`
  g.textAlign = 'right'
  g.textBaseline = 'middle'
  g.fillStyle = INK
  g.fillText(SHOTS[i].mark, PX + PW - 8, 173)
  g.textAlign = 'left'

  // 旁白：前 n 个字。行数少于四行时整块往中间挪一点，图说带才不会头重脚轻
  const at = TYPING[i].at
  let n = 0
  while (n < at.length && at[n] <= local) n++
  if (n <= 0) return
  const rows = CAPTION_ROWS[i]
  const shift = Math.round((4 - Math.min(4, rows.length)) * CAP_LINE / 2)
  g.font = `${CAP_SIZE}px ${SERIF}`
  g.fillStyle = INK
  g.textBaseline = 'middle'
  let left = n
  for (let r = 0; r < rows.length && left > 0; r++) {
    const y = CAP_TOP + shift + r * CAP_LINE
    let x = CAP_LEFT
    for (const ch of rows[r]) {
      if (left <= 0) break
      g.fillText(ch, x, y)
      x += charW(ch) + CAP_GAP
      left--
    }
  }
}

/**
 * 把某一时刻的整幅画面画到 canvas 上（纯函数）。
 *
 * 底是墨黑：每个镜头从墨黑里"印"出纸白来，淡出时再回到墨黑 ——
 * 这是版画的显影，也是七个镜头之间唯一的转场。
 */
export function renderFrame(g: Ctx, t: number): void {
  const { i, local } = shotAt(t)
  const shot = SHOTS[i]

  g.save()
  g.imageSmoothingEnabled = false

  // 墨黑底：淡入淡出全靠它透出来
  g.fillStyle = INK
  g.fillRect(0, 0, MONTAGE_W, MONTAGE_H)

  const fade = smooth(0, FADE_IN, local) * (1 - smooth(shot.dur - FADE_OUT, shot.dur, local))
  if (fade > 0.004) {
    g.globalAlpha = fade
    // 纸底
    g.fillStyle = PAPER
    fill(g, 3, 3, MONTAGE_W - 6, MONTAGE_H - 6)
    // 画面区：所有绘制都裁在图框里，绝不出血到纸边
    g.save()
    g.beginPath()
    g.rect(PX, PY, PW, PH)
    g.clip()
    shot.paint(g, local)
    g.restore()
    // 图说（纸白带 + 旁白）
    drawCaption(g, i, local)
    // 版框最后压上
    drawBorder(g)
    g.globalAlpha = 1
  }

  g.restore()
}
