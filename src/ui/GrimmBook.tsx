import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { setFlag, setModal, startScript, unlockAch, useGame } from '../game/store'
import { Snd } from '../game/audio'

/**
 * 场景 12：深夜书房 ·《黑格林童话：苍蓝革新的箱庭》。
 *
 * 原作（novel-01.md L893–L1041）里主角翻到的那本书，全篇里线的钥匙。
 * 这本「书」是一段可翻页的 UI，不是对话框：
 *   - 视觉与礼仪课同一套语言（米色书页 / 横格纸纹 / 书脊暗边 / 页眉页脚），
 *     但更旧：羊皮纸更黄，外面包一层黑色皮革封面。
 *   - 正文逐字打出来（与 DialogBox 同一种阅读节奏）。
 *   - 第 3 页的【】用 1px 金色描边框单独框住，出现时 sting + 200ms 震动；
 *     第 5 页（维多利亚）整页是主角的旁白：灰蓝、缩进、字距宽，
 *     翻到那里时 low bell + 300ms 震动。
 *   - 第 10 页是程序化木刻插图（fillRect 画的黑白版画）。
 *   - Esc 合不上：这本书要读完，读完最后一页才出现「合上书」。
 *
 * 由剧本 Effect.book = 'grimm' 打开（store.startBook 立 grimmBookActive），
 * 合上时自己接 grimmAfter。
 */

/** 一个「字」。【】 是一个整体：描边框不能拆成两半显示 */
interface Unit {
  ch: string
  rune?: boolean
}

interface PageSpec {
  /** 页脚左侧的小节标记 */
  mark: string
  /** 书页正文（每段一段） */
  lines?: string[]
  /** 主角的旁白（不是书里的字） */
  aside?: string[]
  /** 木刻插图页 */
  plate?: boolean
  /** 图下小字（插图页的正文，同样逐字打） */
  caption?: string
}

/** 页眉：原作强调这本书排版古怪、字体古老，所以用繁体 / 日文汉字 */
const RUNHEAD = '黑格林童話：蒼藍革新的箱庭'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

/**
 * 十页书。文字对齐 novel-01.md 场景 12（L939–L1005），几乎全文保留。
 * 三处一字不动：「这个世界是【】创造的」「写故事的人要对故事里的人负责」「维多利亚」。
 */
const PAGES: PageSpec[] = [
  // ① 献词（L939–L941）
  {
    mark: '§ 獻詞',
    lines: [
      '这个故事是献给格林的。格林当然不是我的名字，也不是格林本人的名字。但既然所有人都这么叫他，那就这么叫吧。',
      '总之，我把格林的故事，格林告诉我的故事写在这里。',
    ],
  },
  // ② 世界设定（L943）
  {
    mark: '§ 箱庭',
    lines: [
      '从前有一个被浓雾笼罩的国度。雾将人类变成野兽，让世界陷入绝望。',
      '战火连绵，勇者们渴求显赫的声名，娼妇梦想着城堡里的舞会，还有那些藏在秘密花园里的、没有人见过的珍宝。',
      '人们从四面八方聚来，又消失不见。就在这样的地方，一个没有名字的不死人，或者说格林，就此醒来了。',
    ],
  },
  // ③ 创世说（L945）：【】 出现两次，全页最重要的符号
  {
    mark: '§ 創世',
    lines: [
      '这是格林讲给我的第一个故事。他说，这个世界是【】创造的。',
      '【】在梦里梦见了一位艺术家，于是艺术家遵循着【】的意志，用雾做颜料，用恐惧做画布，一笔一笔地画出那些发疯的野兽、那些燃烧的城堡、那些在血泊里跳舞的公主。',
      '那个艺术家画了很久。画了很多遍。每一遍都不太一样，但结局总是一样的——所有的角色都死了，所有的灯都灭了，所有的颜色都混在一起，变成黑色。',
    ],
  },
  // ④ 角色名录（L951）：维多利亚在名录里
  {
    mark: '§ 角色',
    lines: [
      '格林说，那个世界叫箱庭。箱庭里住着很多被画出来的角色。',
      '小红帽，灰姑娘，红帽、贞德、叶子、多萝西、伊丽莎白、维多利亚、米兰达、凯瑟琳、艾尔玛。',
      '她们都很漂亮，都很温柔，都很像真的。但她们不是真的。她们只是某个艺术家在某个很深的夜里，用手一笔一笔画出来的影子。',
    ],
  },
  // ⑤ 命中注定的名字（L953–L959）：这一页不是书里的字，是他脑子里的字
  {
    mark: '（旁註）',
    aside: [
      '维多利亚。',
      '他的曾祖母。来自卡美洛的公主。画像上那个红发深蓝色眼睛的女人。',
      '这是巧合吗？',
    ],
  },
  // ⑥ 影子们的愿望（L963）
  {
    mark: '§ 影子',
    lines: [
      '格林说，永远无法陷入长眠的他也很孤独。所以他去找那些影子说话。',
      '小红帽说她想回家，但不知道家在哪里。灰姑娘说她想参加舞会，但没有人请她。贞德的骨灰说这个世界是假的，一切都是假的，神是假的，作为圣女的她自己也是假的。',
      '格林说，假的也没关系。只要还有人记得，假的也可以是真的。',
    ],
  },
  // ⑦ 写作伦理（L967）
  {
    mark: '§ 責任',
    lines: [
      '这是《苍蓝革新的箱庭》的第一页。后面还有很多页。',
      '格林说，他写得很慢。因为每一页都要写很久，每一页都要想很久。',
      '他怕写错了，怕写坏了，怕把那些影子写没了。',
      '他说，写故事的人要对故事里的人负责。',
    ],
  },
  // ⑧ 主线摘要（L971）
  {
    mark: '§ 格林',
    lines: [
      '格林说，他在图书馆醒来，金发少女爱丽丝刚对他说完「你是主角」，就当场爆体而亡。',
      '然后格林莫名其妙地变成不死人，在监狱被女骑士救出，来到圣森。',
      '绿衣妖精告诉他：灰姑娘放出了魔雾黑化世界，你要讨伐四大魔姬——白雪、长发、青蛙、人鱼，拯救王国。',
    ],
  },
  // ⑨ 师徒设定（L973）
  {
    mark: '§ 旅程',
    lines: [
      '于是格林踏上了旅途。',
      '他遇到了曾是男性的魔女多萝西，并被他，或者她收为弟子。',
      '这就是第一个故事。',
    ],
  },
  // ⑩ 木刻插图（L1001–L1005）
  {
    mark: '§ 圖版',
    plate: true,
    caption: '这就是我。这就是我做的。这就是我必须做的。',
  },
]

/** 把一段文字切成「字」。中文一个字一个码点；【】 合成一个不可分的整体 */
function toUnits(line: string): Unit[] {
  const out: Unit[] = []
  let i = 0
  while (i < line.length) {
    if (line.startsWith('【】', i)) {
      out.push({ ch: '【】', rune: true })
      i += 2
      continue
    }
    const cp = line.codePointAt(i)
    if (cp === undefined) break
    const ch = String.fromCodePoint(cp)
    out.push({ ch })
    i += ch.length
  }
  return out
}

/** 每页每行的字（模块加载时算一次） */
const PAGE_UNITS: Unit[][][] = PAGES.map(p =>
  p.plate ? [toUnits(p.caption ?? '')] : (p.aside ?? p.lines ?? []).map(toUnits),
)

const PAGE_TOTAL: number[] = PAGE_UNITS.map(lines => lines.reduce((a, l) => a + l.length, 0))

const PAGE_HAS_RUNE: boolean[] = PAGE_UNITS.map(lines => lines.some(l => l.some(u => u.rune)))

/** 第 i 个字（跨行计数） */
function unitAt(pg: number, index: number): Unit | undefined {
  let i = index
  if (i < 0) return undefined
  for (const line of PAGE_UNITS[pg]) {
    if (i < line.length) return line[i]
    i -= line.length
  }
  return undefined
}

/** 一个字之后停多久（与 DialogBox 的节奏同源，读起来慢一点） */
function delayOf(prev: Unit | undefined, ch: string): number {
  if (prev?.rune) return 520          // 读到【】，他停一下
  switch (ch) {
    case '。': case '？': case '！': return 210
    case '，': case '、': case '；': case '：': return 85
    case '—': case '…': return 130
    case '」': case '）': return 140
    default: return 34
  }
}

/** 页脚那枚极小的秃鹫纹章（铁十字黑秃鹫的剪影，12px） */
function VultureMark() {
  return (
    <svg className="grimm-vulture" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
      <path
        d="M1.5 4.2 L5.4 5.6 L7 4.9 L8 5.4 L8.6 4.4 L9.4 5.4 L10.2 4.9 L11.8 5.6 L15 4.2 L12.6 8.4 L14.2 11.8 L10.6 10.6 L9.2 13.6 L8 10.9 L6.6 13.6 L5.2 10.6 L1.6 11.8 L3.2 8.4 Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** 木刻插图的确定性伪随机：同一张版画每次印出来都一样 */
function hash(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

const PLATE_W = 348
const PLATE_H = 300

/**
 * 木刻插图：一个年轻男人站在荒原上，身后是燃烧的城堡，脚下满地白骨。
 *
 * 参照 tiles.ts 的画法：只用 fillRect，两种颜色（墨黑 / 纸白），没有一条曲线。
 * 层次（从下往上）：
 *   纸底 → 天空横向刻线（右上方是压下来的浓烟）→ 锯齿状黑块城堡 + 窗口透出的火
 *   → 地平线 → 荒原密集短竖线 → 白骨 → 人物剪影与插在地里的剑
 *   → 印痕噪点 → 双线版框
 */
function drawPlate(g: CanvasRenderingContext2D): void {
  const W = PLATE_W
  const H = PLATE_H
  const INK = '#171310'
  const PAPER = '#e8d9b4'
  const horizon = 168

  g.imageSmoothingEnabled = false
  g.fillStyle = PAPER
  g.fillRect(0, 0, W, H)

  // ---- ① 天空：横向刻线。上面稀（天光从那里漏下来），下面密（烟压下来） ----
  for (let y = 14; y < horizon - 3; y += 4) {
    const row = (y - 14) / 4
    const t = (y - 14) / (horizon - 17)             // 0 顶部 → 1 近地平线
    g.fillStyle = INK
    // 左侧：长排线。顶部短、靠地平线长 —— 刻出来的天光是斜着退远的
    const lead = 9 + Math.round(hash(row * 7 + 2) * 15)
    g.fillRect(lead, y, Math.round(18 + t * 88 + hash(row * 31 + 1) * 22), 1)
    // 中段：错位的短排线（避开人物所在的竖带，好让人物读得出来）
    if (row % 2 === 0) {
      const midX = 58 + Math.round(hash(row * 17 + 5) * 82)
      g.fillRect(midX, y, Math.round(10 + t * 44 + hash(row * 13 + 9) * 18), 1)
    }
    // 右侧：城堡上方的浓烟，越往下越厚、越长
    const x3 = 160 + Math.round(hash(row * 7 + 3) * 24)
    const smoke = Math.min(Math.round(56 + t * 160), W - 12 - x3)
    g.fillRect(x3, y, Math.max(0, smoke), t > 0.55 ? 2 : 1)
    // 高空的零星短划
    if (row % 3 === 1) {
      g.fillRect(14 + Math.round(hash(row * 23 + 11) * 300), y - 1,
        8 + Math.round(hash(row * 29) * 22), 1)
    }
  }
  // 城堡正上方再压几团烟
  for (let i = 0; i < 26; i++) {
    const y = 20 + Math.round(hash(i * 37) * 54)
    const x = 178 + Math.round(hash(i * 11 + 2) * 124)
    g.fillRect(x, y, 12 + Math.round(hash(i * 5) * 52), 2)
  }

  // ---- ② 燃烧的城堡：锯齿状黑块（右后方） ----
  g.fillStyle = INK
  g.fillRect(214, 112, 84, horizon - 112)    // 主楼
  g.fillRect(200, 88, 26, horizon - 88)      // 左塔
  g.fillRect(298, 98, 30, horizon - 98)      // 右塔
  // 塔顶：逐行收窄的坡顶（木刻里的三角，边缘是台阶）
  for (let i = 0; i < 13; i++) g.fillRect(200 + i, 88 - i * 2, 26 - i * 2, 2)
  for (let i = 0; i < 10; i++) g.fillRect(298 + Math.round(i * 1.4), 98 - i * 2, 30 - i * 3, 2)
  // 主楼城垛：四个方形垛口
  for (let k = 0; k < 4; k++) g.fillRect(218 + k * 20, 104, 9, 8)
  // 楼顶喷出的火：火舌从屋顶轮廓线往上长（不是一排悬在空中的栅栏）。
  // 每根 2px 宽、高低不一，上沿连成参差的锯齿 —— 这就是「锯齿状的黑块」。
  const roofTop = (x: number): number => {
    // 左塔尖：中心 213，顶尖 64，坡边每格升 2px
    if (x >= 198 && x < 214) return Math.min(104, 64 + Math.abs(x - 213) * 2)
    // 主楼：顶 104
    if (x >= 214 && x <= 298) return 104
    // 右塔尖：中心 313，顶尖 80
    if (x > 298 && x <= 332) return Math.min(104, 80 + Math.abs(x - 313) * 1.6)
    return 104
  }
  // 楼顶的火焰锯齿：一排三角形火舌，与城堡连成一块参差的黑色剪影 ——
  // 这就是「锯齿状的黑块」。三角之间的缝里还看得见天空的排线（那是烟）。
  let fx = 198
  while (fx < 328) {
    const w = 6 + Math.round(hash(fx * 11) * 7)      // 底宽 6..13
    const hgt = 6 + Math.round(hash(fx * 7) * 18)    // 高 6..24
    const top = roofTop(fx + (w >> 1))
    for (let j = 0; j < hgt; j++) {
      const ww = Math.max(1, Math.round(w * (1 - j / hgt)))
      g.fillRect(Math.round(fx + (w - ww) / 2), top - j - 1, ww, 1)
    }
    fx += w + 1 + Math.round(hash(fx * 3) * 2)
  }
  // 楼身上几道竖直的刻线（砖缝）
  for (let x = 218; x < 296; x += 12) {
    if (hash(x * 3 + 5) < 0.6) g.fillRect(x, 118, 1, 48)
  }
  // 窗口：只有几扇，窗里透出火（纸色 = 亮部）
  const windows: [number, number][] = [
    [210, 98], [210, 122], [210, 144],      // 左塔
    [232, 126], [254, 126], [276, 126],     // 主楼上层
    [232, 148], [254, 148],                 // 主楼下层
    [308, 110], [308, 134], [308, 154],     // 右塔
  ]
  for (const [x, y] of windows) {
    g.fillStyle = PAPER
    g.fillRect(x, y, 4, 5)
    // 火舌从部分窗里往上窜（在黑块里是亮的刻线）
    if (hash(x * 3 + y * 7) < 0.45) g.fillRect(x + 1, y - 4, 1, 4)
  }
  // 窗棂的一道黑线
  g.fillStyle = INK
  for (const [x, y] of windows) {
    if (hash(x + y * 5) < 0.6) g.fillRect(x + 1, y + 2, 2, 1)
  }

  // ---- ③ 地平线 ----
  g.fillStyle = INK
  g.fillRect(7, horizon, W - 14, 2)

  // ---- ④ 荒原：密集的短竖线（木刻的排线，比天空更乱） ----
  for (let x = 14; x < W - 14; x += 4) {
    const n = 1 + Math.floor(hash(x * 3 + 1) * 2)
    for (let k = 0; k < n; k++) {
      const y = horizon + 6 + Math.round(hash(x * 17 + k * 53) * (H - horizon - 28))
      const hgt = 5 + Math.round(hash(x * 29 + k * 7) * 22)
      g.fillRect(x, y, 1, hgt)
    }
  }

  // ---- ⑤ 白骨：铺满整片大地，有人的也有动物的 ----
  const bones: [number, number][] = []
  // 人物脚下先铺一层（近景更密更大），再往两边散
  for (let i = 0; i < 96; i++) {
    const near = i % 2 === 0
    const y = near
      ? 232 + Math.round(hash(i * 41 + 9) * 52)
      : horizon + 6 + Math.round(hash(i * 41 + 9) * (H - horizon - 20))
    bones.push([
      near
        ? 32 + Math.round(hash(i * 61 + 3) * 168)
        : 12 + Math.round(hash(i * 61 + 3) * (W - 24)),
      y,
    ])
  }
  for (const [x, y] of bones) {
    const kind = hash(x * 5 + y * 3)
    g.fillStyle = PAPER
    if (kind < 0.4) {
      // 长骨：两道横线 + 两端的骨节
      const len = 13 + Math.round(kind * 26)
      g.fillRect(x, y, len, 2)
      g.fillRect(x + 2, y + 5, len - 4, 1)
      g.fillRect(x - 1, y - 2, 4, 6)
      g.fillRect(x + len - 2, y - 2, 4, 6)
    } else if (kind < 0.78) {
      // 头骨：亮块 + 颚 + 两个黑眼窝
      g.fillRect(x, y, 11, 8)
      g.fillRect(x + 2, y + 8, 7, 2)
      g.fillStyle = INK
      g.fillRect(x + 1, y + 2, 3, 3)
      g.fillRect(x + 7, y + 2, 3, 3)
      g.fillRect(x + 5, y + 6, 1, 2)
    } else {
      // 零散骨片 / 断掉的肋骨
      g.fillRect(x, y, 5, 2)
      g.fillRect(x + 6, y + 3, 7, 1)
      g.fillRect(x + 13, y, 1, 4)
    }
  }

  // ---- ⑥ 人：站在荒原上的年轻男人 ----
  // 木刻的常用手法：先把人形周围的排线刻掉（留一圈 2px 纸白），再压上黑剪影 ——
  // 这样人在满版黑草里才跳得出来，像从版上凿出来的。
  const cx = 114
  const groundY = 278
  // 斗篷：肩 36 → 腰 24 → 下摆 42，逐行改宽
  const cloak: [number, number, number][] = []      // [y, w, x]
  for (let i = 0; i < 38; i++) {
    const t = i / 37
    const w = t < 0.35
      ? Math.round(36 - (t / 0.35) * 12)
      : Math.round(24 + ((t - 0.35) / 0.65) * 18)
    cloak.push([164 + i * 3, w, cx - (w >> 1)])
  }
  const sx = cx + 34

  // 纸白：每个部件外扩 2px（先全部画完，再压黑色本体）
  g.fillStyle = PAPER
  g.fillRect(cx - 16, 118, 32, 36)      // 头
  g.fillRect(cx - 9, 148, 18, 14)       // 脖子
  g.fillRect(cx - 23, 154, 46, 12)      // 肩
  for (const [y, w, x] of cloak) g.fillRect(x - 2, y, w + 4, 3)
  // 剑的纸白：每个部件各自外扩 2px（不是一整块 —— 否则人旁边会立一根白柱子）
  g.fillRect(sx - 4, 172, 13, 12)
  g.fillRect(sx - 4, 180, 13, 18)
  g.fillRect(sx - 13, 194, 31, 8)
  g.fillRect(sx - 4, 198, 14, 90)

  // 黑剪影：头 -> 脖子 -> 肩 -> 斗篷
  g.fillStyle = INK
  for (const [y, w, x] of cloak) g.fillRect(x, y, w, 3)
  g.fillRect(cx - 11, 119, 22, 5)       // 头顶（窄）
  g.fillRect(cx - 13, 124, 26, 7)       // 额
  g.fillRect(cx - 14, 131, 28, 12)      // 脸
  g.fillRect(cx - 11, 143, 22, 5)       // 下巴（收窄）
  g.fillRect(cx - 6, 148, 12, 14)       // 脖子
  g.fillRect(cx - 21, 156, 42, 12)      // 肩

  // 脸：只露出半边（纸色），右边被长发盖住
  g.fillStyle = PAPER
  g.fillRect(cx - 12, 132, 8, 10)
  g.fillRect(cx - 11, 142, 5, 4)
  // 头发：刘海 + 盖住右半张脸 + 两侧垂到胸口
  g.fillStyle = INK
  g.fillRect(cx - 4, 128, 15, 20)
  g.fillRect(cx - 7, 120, 19, 8)
  g.fillRect(cx - 20, 126, 7, 72)
  g.fillRect(cx + 11, 124, 8, 80)
  g.fillRect(cx - 2, 144, 3, 12)
  // 衣褶：斗篷上的两道亮刻线
  g.fillStyle = PAPER
  g.fillRect(cx - 12, 196, 1, 56)
  g.fillRect(cx + 4, 192, 1, 62)
  // 斗篷左缘的刀口 + 腰带：让人看出腰身，不至于是一根黑柱子
  for (let i = 2; i < 38; i += 3) {
    const [, , x] = cloak[i]
    g.fillRect(x + 1, cloak[i][0], 1, 3)
  }
  g.fillStyle = PAPER
  g.fillRect(cx - 11, 214, 22, 1)
  g.fillRect(cx - 1, 228, 1, 30)
  // 握剑的手臂：先用纸白把手臂从斗篷上刻开，再压黑色
  g.fillStyle = PAPER
  g.fillRect(cx + 12, 164, 20, 11)
  g.fillRect(cx + 25, 170, 11, 26)
  g.fillStyle = INK
  g.fillRect(cx + 13, 166, 18, 9)
  g.fillRect(cx + 26, 172, 9, 24)
  // 剑：剑首 / 握把 / 护手 / 剑身 / 插进地里的剑尖
  g.fillRect(sx - 2, 174, 9, 8)        // 剑首
  g.fillRect(sx, 182, 5, 14)           // 握把
  g.fillRect(sx - 10, 196, 25, 4)      // 护手
  g.fillRect(sx, 200, 6, 76)           // 剑身
  g.fillRect(sx + 1, 276, 4, 7)        // 剑尖
  g.fillRect(sx + 2, 283, 2, 3)
  // 刃口的一道高光
  g.fillStyle = PAPER
  g.fillRect(sx + 1, 203, 1, 72)
  // 剑尖入土的刻痕
  g.fillStyle = INK
  g.fillRect(sx - 9, 278, 7, 1)
  g.fillRect(sx + 8, 282, 7, 1)
  // 脚下的土渍：把人物按在地上
  g.fillRect(cx - 32, groundY - 1, 70, 3)

  // ---- ⑦ 印痕噪点：木刻版的粗糙感 ----
  for (let i = 0; i < 240; i++) {
    const x = 7 + Math.round(hash(i * 19 + 1) * (W - 14))
    const y = 7 + Math.round(hash(i * 7 + 3) * (H - 14))
    g.fillStyle = INK
    g.fillRect(x, y, i % 3 === 0 ? 2 : 1, 1)
  }

  // ---- ⑧ 版框：双线 ----
  g.strokeStyle = INK
  g.lineWidth = 2
  g.strokeRect(3, 3, W - 6, H - 6)
  g.lineWidth = 1
  g.strokeRect(9, 9, W - 18, H - 18)
}

/** 第 10 页：木刻插图 + 图下小字（小字也逐字打） */
function Plate({ shown }: { shown: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const g = cv.getContext('2d')
    if (!g) return
    drawPlate(g)
  }, [])

  return (
    <div className="grimm-plate">
      <div className="grimm-plate-frame">
        <canvas ref={ref} width={PLATE_W} height={PLATE_H} className="grimm-woodcut" />
      </div>
      <p className="grimm-caption">
        {renderUnits(PAGE_UNITS[PAGES.length - 1][0], shown)}
      </p>
    </div>
  )
}

/** 把前 n 个字渲染出来；【】 落成一个带金色描边框的独立块 */
function renderUnits(units: Unit[], n: number): ReactNode[] {
  const out: ReactNode[] = []
  let buf = ''
  let key = 0
  for (let i = 0; i < n && i < units.length; i++) {
    const u = units[i]
    if (u.rune) {
      if (buf) { out.push(<span key={key++}>{buf}</span>); buf = '' }
      out.push(<span key={key++} className="grimm-rune">{u.ch}</span>)
    } else {
      buf += u.ch
    }
  }
  if (buf) out.push(<span key={key++}>{buf}</span>)
  return out
}

/** 书页正文：按段渲染，每段只显示已经打过的那几个字 */
function Lines({ pg, shown }: { pg: number; shown: number }) {
  const isAside = !!PAGES[pg].aside
  let used = 0
  return (
    <>
      {PAGE_UNITS[pg].map((units, i) => {
        const start = used
        used += units.length
        const n = Math.max(0, Math.min(units.length, shown - start))
        if (n === 0) return null
        return (
          <p key={i} className={isAside ? 'grimm-line grimm-aside' : 'grimm-line'}>
            {renderUnits(units, n)}
          </p>
        )
      })}
    </>
  )
}

export function GrimmBook() {
  const active = useGame(s => !!s.flags['grimmBookActive'])
  const wasActive = useRef(false)
  /** 合书只走一次 */
  const closedRef = useRef(false)
  /** 已经震过的页（第 5 页只响一次低音） */
  const seenRef = useRef<Set<number>>(new Set())
  /** 已经为【】响过 sting 的页（补完时兜底用） */
  const runeSoundedRef = useRef<Set<number>>(new Set())
  const leafRef = useRef<HTMLDivElement | null>(null)
  const flipTimer = useRef<number | null>(null)
  const noticeTimer = useRef<number | null>(null)

  const [page, setPage] = useState(0)
  const [typing, setTyping] = useState(0)
  const [flip, setFlip] = useState<{ from: number; dir: 1 | -1 } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const total = PAGE_TOTAL[page] ?? 0
  const leafDone = typing >= total
  const isLast = page === PAGES.length - 1

  /** 页面轻微震动：作用在内层 leaf 上，不打断翻页动画的 transform */
  const doShake = useCallback((px: number, ms: number): void => {
    const el = leafRef.current
    if (!el || typeof el.animate !== 'function') return
    el.animate(
      [
        { transform: 'translate(0, 0)' },
        { transform: `translate(${px}px, 0)` },
        { transform: `translate(${-px}px, 0)` },
        { transform: `translate(${px * 0.5}px, 0)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: ms, easing: 'ease-out' },
    )
  }, [])

  const flash = useCallback((msg: string): void => {
    setNotice(msg)
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2200)
  }, [])

  // ---- 打开 / 关闭 ----
  useEffect(() => {
    if (active) {
      setPage(0)
      setTyping(0)
      setFlip(null)
      setNotice(null)
      closedRef.current = false
      seenRef.current = new Set()
      runeSoundedRef.current = new Set()
      setModal('book')
      // 八音盒，30 BPM，C♯ 小调：书房在深夜里变成另一个地方
      Snd.setBgm('libraryDream')
    } else if (wasActive.current) {
      setModal(null)
      Snd.setBgm('interior')
    }
    wasActive.current = active
  }, [active])

  // 计时器清理
  useEffect(() => () => {
    if (flipTimer.current) window.clearTimeout(flipTimer.current)
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
  }, [])

  // ---- 打字机：逐字推进 ----
  useEffect(() => {
    if (!active) return
    if (typing >= total) return
    const prev = unitAt(page, typing - 1)
    const next = unitAt(page, typing)
    if (!next) return
    const delay = typing === 0 ? 320 : delayOf(prev, next.ch)
    const t = window.setTimeout(() => setTyping(n => n + 1), delay)
    return () => window.clearTimeout(t)
  }, [active, page, typing, total])

  // ---- 刚打出来的这个字要发生什么 ----
  useEffect(() => {
    if (!active || typing === 0) return
    const u = unitAt(page, typing - 1)
    if (!u) return
    if (u.rune) {
      // 【】：金色描边框出现的那一刻，响一下，停一下
      runeSoundedRef.current.add(page)
      Snd.sfx('sting')
      doShake(1.5, 200)
      return
    }
    // 翻书页上的笔尖声：每 6 个字一下（太密会盖住音乐）
    if (typing % 6 === 0 && !PAGES[page].plate) Snd.sfx('type')
  }, [active, page, typing, doShake])

  // ---- 翻到第 5 页：那一声低音与震动 ----
  useEffect(() => {
    if (!active) return
    if (!PAGES[page].aside) return
    if (seenRef.current.has(page)) return
    seenRef.current.add(page)
    Snd.sfx('bell')
    doShake(2, 300)
  }, [active, page, doShake])

  // ---- 翻页 ----
  const turn = useCallback((dir: 1 | -1): void => {
    const n = page + dir
    if (n < 0 || n >= PAGES.length) {
      flash(dir < 0 ? '（前面没有页了。）' : '（这是最后一页。）')
      return
    }
    setFlip({ from: page, dir })
    setPage(n)
    setTyping(0)
    Snd.sfx('page')
    if (flipTimer.current) window.clearTimeout(flipTimer.current)
    flipTimer.current = window.setTimeout(() => setFlip(null), 360)
  }, [page, flash])

  // ---- 合上书：成就 + 音乐 + 接 grimmAfter ----
  const closeBook = useCallback((): void => {
    if (closedRef.current) return
    closedRef.current = true
    setFlag('grimmBookActive', false)
    setModal(null)
    unlockAch('grimmRead')
    Snd.setBgm('interior')
    if (useGame.getState().mode === 'explore') startScript('grimmAfter')
  }, [])

  // ---- 一次推进输入 ----
  const advanceRead = useCallback((): void => {
    if (typing < total) {
      // 还没打完：一口气补完（补完时若跨过了【】，也要响一回）
      setTyping(total)
      if (PAGE_HAS_RUNE[page] && !runeSoundedRef.current.has(page)) {
        runeSoundedRef.current.add(page)
        Snd.sfx('sting')
        doShake(1.5, 200)
      }
      return
    }
    if (!isLast) { turn(1); return }
    closeBook()
  }, [typing, total, page, isLast, turn, closeBook, doShake])

  // ---- 键盘：捕获阶段全接管。Esc 合不上这本书 ----
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  onKeyRef.current = (e: KeyboardEvent): void => {
    const k = e.key
    const isAdvance = k === 'Enter' || k === ' ' || k === 'e' || k === 'E'
    const isHandled =
      isAdvance || k === 'ArrowLeft' || k === 'ArrowRight' ||
      k === 'a' || k === 'A' || k === 'd' || k === 'D' ||
      k === 'Escape' || k === 'Esc'
    if (!isHandled) return
    e.preventDefault()
    e.stopPropagation()

    if (k === 'Escape' || k === 'Esc') {
      // 这本书要读完。读完最后一页才出现「合上书」。
      flash(isLast && leafDone ? '（Enter 合上书。）' : '（这本书还没有读完。）')
      return
    }
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { turn(-1); return }
    if (k === 'ArrowRight' || k === 'd' || k === 'D') { turn(1); return }
    if (isAdvance) advanceRead()
  }

  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent): void => onKeyRef.current(e)
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [active])

  if (!active) return null

  /** 一张纸（页眉 / 正文 / 页脚）。old = 翻页时压在下面的那张，文字一次性全给。 */
  const sheet = (pg: number, shown: number, isCurrent: boolean): ReactNode => (
    <div className="grimm-leaf" ref={isCurrent ? leafRef : undefined}>
      <div className="grimm-runhead">
        <span className="grimm-runhead-title">{RUNHEAD}</span>
        <span className="grimm-runhead-folio">FOL. {ROMAN[pg]}</span>
      </div>
      <div className={'grimm-body' + (PAGES[pg].aside ? ' aside-page' : '') + (PAGES[pg].plate ? ' plate-page' : '')}>
        <div className="grimm-flow">
          {PAGES[pg].plate
            ? <Plate shown={shown} />
            : <Lines pg={pg} shown={shown} />}
        </div>
      </div>
      <div className="grimm-footer">
        <span className="grimm-mark">{PAGES[pg].mark}</span>
        <span className="grimm-page-no">— 第 {pg + 1} 页 —</span>
        <VultureMark />
      </div>
    </div>
  )

  const foot = notice ?? (leafDone
    ? isLast
      ? 'Enter　合上书'
      : '← → 翻页　·　Enter 翻到下一页'
    : '← → 翻页　·　Enter 让他读快一点　·　Esc 合不上这一页')

  return (
    <div className="grimm-overlay">
      <div className="grimm-book">
        <div className="grimm-gilt">
          <span>{RUNHEAD}</span>
          <span className="grimm-gilt-sub">威廉·斯卡里特·冯·祖克霍夫 著</span>
        </div>

        <div className="grimm-open">
          {/* 旧页：不动，压在新页下面 —— 翻页时看得到它的纸边 */}
          {flip && (
            <div className="grimm-sheet under" aria-hidden="true">
              {sheet(flip.from, PAGE_TOTAL[flip.from], false)}
            </div>
          )}

          {/* 新页：从右（或左）向左覆盖，0.35s */}
          <div className={'grimm-sheet' + (flip ? (flip.dir > 0 ? ' turn-fwd' : ' turn-back') : '')}>
            {sheet(page, typing, true)}
            <button
              className="grimm-edge left"
              onClick={(e) => { e.stopPropagation(); turn(-1) }}
              aria-label="上一页"
            >←</button>
            <button
              className="grimm-edge right"
              onClick={(e) => { e.stopPropagation(); turn(1) }}
              aria-label="下一页"
            >→</button>
            <div className="grimm-tap" onClick={() => advanceRead()} />
          </div>
        </div>

        <div className={'grimm-foot' + (isLast && leafDone ? ' ready' : '')}>{foot}</div>
      </div>
    </div>
  )
}
