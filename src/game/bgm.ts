// ============================================================
// BGM：WebAudio 实时合成的小型音序器（零外部音频文件）
//
// 气质参考 BLACK SOULS II 的标题/城堡曲：低音管风琴长音 + 极慢旋律 +
// 大量混响，「安静的、正在腐烂的庄严」。三首曲子全部用振荡器 + 滤波器 +
// 包络合成，混响用代码生成的脉冲响应（ConvolverNode）。
//
// ---- 防泄漏设计（参考仓库踩过"每循环泄漏一点、越玩越卡"的坑）----
// 1. AudioContext 全程只有一个（由 Snd 单例持有并传进来）。
// 2. ConvolverNode 与 IR buffer 只建一次（attach 时），换曲不重建。
// 3. 整个引擎只有一个调度器 setInterval，间隔 120ms、向前看 0.5s，
//    基于 ctx.currentTime 绝对时间推进；音符内部不再排任何定时器。
// 4. 每个音符 = 一个 Voice，节点列表登记在案；onended 时
//    stop 之外的所有节点立即 disconnect 并从活跃表移除。
// 5. 同时存活的 Voice 有硬上限（24），超限直接丢弃该音并只警告一次。
// 6. 停曲 / 切曲 / 关 BGM：清调度器、所有 Voice 立即 stop+disconnect、
//    清空事件表与活跃表。反复切换后活跃节点数归零。
// ============================================================

export type BgmName =
  | 'title'      // 标题「宝石」
  | 'opening'    // 开场分镜「群山」
  | 'train'      // 南下黑森林的列车
  | 'station'    // 糖堡站
  | 'road'       // 山路
  | 'gate'       // 城堡正门（与桥共用）
  | 'interior'   // 聚斯霍芬堡内部（门厅 / 走廊 / 图书室 / 接待厅 / 卧室 / 餐厅）
  | 'hall'       // interior 的旧名，保留为别名

type Inst = 'organ' | 'strings' | 'pedal' | 'pulse' | 'pizz'

/** 时间单位一律是四分音符（beat）：t = 起点，d = 长度 */
interface Note { t: number; d: number; n: number; v: number }

/** 和弦 / 低音铺底：notes 是同时发声的 MIDI 音高 */
interface Span { at: number; d: number; notes: number[]; inst: Inst; v: number }

/**
 * 显式落点事件：拨弦、脚步这类需要精确控制在第几拍、哪一下重哪一下轻的声部。
 * spans 只能整块铺底，做不到「轻重交替」的节奏感，所以单独留一条通道。
 */
interface Hit { inst: Inst; t: number; n: number; v: number; d?: number }

interface Track {
  bpm: number
  beatsPerBar: number
  bars: number
  spans: Span[]
  organ?: Note[]
  hits?: Hit[]
  /** 每小节一个低音脉冲根音（列车轮子） */
  pulseRoots?: number[]
  /** 弦乐加 6.2Hz 颤音，模仿铁轨的金属抖动 */
  trem?: boolean
  /** 整曲电平（相对 BGM 总线）。开场最克制，给得最低 */
  level?: number
}

interface Ev { inst: Inst; n: number; t: number; d: number; v: number }

/** 一个音符产生的全部节点；ended 时整组回收 */
interface Voice {
  oscs: OscillatorNode[]
  nodes: AudioNode[]
  ended: boolean
}

/** 全局音符预算：跨曲目共享，切歌时也不会瞬时堆节点 */
interface VoiceBudget {
  count: number
  limit: number
  warned: boolean
}

const STORE_KEY = 'vz.settings'
/** BGM 总线电平：压在环境音之下，不盖过对话 */
const BGM_VOLUME = 0.34
const DRY_MIX = 0.78
const WET_MIX = 0.32
const STEPS_PER_BEAT = 4
/** 调度器唯一：120ms 一次，向前看 0.5s */
const SCHED_INTERVAL_MS = 120
const LOOKAHEAD = 0.5
/** 同时存活的音符组上限：宁可少一个音，也不让节点堆积 */
const MAX_VOICES = 24
/** 地图间切曲的默认交叉淡变；开场那一刀由 audio.ts 传 2.0 / 2.0（借黑场） */
const DEFAULT_FADE_OUT = 1.2
const DEFAULT_FADE_IN = 2.4

const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12)

// ------------------------------------------------------------
// 曲目数据
// 旋律刻意稀疏（每分钟 8–14 个音）：留白才是黑暗感的来源。
// ------------------------------------------------------------

/**
 * 「聚斯霍芬堡」：D 小调，44 BPM，4/4，8 小节 ≈ 43.6s
 * 和弦：Dm – E♭ –（留白）– C♯dim。减和弦 + 大段留白，管风琴只出现在长音上。
 *
 * 这首原名叫 hall，现在作为整个城堡内部的共用曲：门厅、东西走廊、图书室、
 * 接待厅、卧室、餐厅都用它。曲子本身一个字没改，只是把 key 正名为 interior；
 * hall 仍作为别名保留，两把 key 指向同一个对象，不会重复造一份数据。
 */
const INTERIOR: Track = {
  bpm: 44,
  beatsPerBar: 4,
  bars: 8,
  spans: [
    { at: 0, d: 8, notes: [50, 53, 57], inst: 'organ', v: 0.13 },    // Dm
    { at: 8, d: 8, notes: [51, 55, 58], inst: 'organ', v: 0.12 },    // E♭
    { at: 24, d: 8, notes: [49, 52, 55], inst: 'organ', v: 0.14 },   // C♯dim
    { at: 0, d: 8, notes: [38], inst: 'pedal', v: 0.20 },            // D2
    { at: 8, d: 8, notes: [39], inst: 'pedal', v: 0.20 },            // E♭2
    { at: 16, d: 8, notes: [38], inst: 'pedal', v: 0.18 },           // D2（这两小节只有地板）
    { at: 24, d: 8, notes: [37], inst: 'pedal', v: 0.17 },           // C♯2
  ],
}

const TRACKS: Record<BgmName, Track> = {
  // 「宝石」：D 小调，52 BPM，4/4，8 小节 ≈ 36.9s
  // 和弦：Dm – B♭ – Gm – A（A 借和声小调的大三度，循环回 Dm 时留下悬置）
  // 管风琴主奏 + 低音持续，旋律全曲只有 7 个音。
  title: {
    bpm: 52,
    beatsPerBar: 4,
    bars: 8,
    spans: [
      { at: 0, d: 8, notes: [50, 53, 57], inst: 'organ', v: 0.15 },   // Dm
      { at: 8, d: 8, notes: [46, 50, 53], inst: 'organ', v: 0.15 },   // B♭
      { at: 16, d: 8, notes: [43, 46, 50], inst: 'organ', v: 0.14 },  // Gm
      { at: 24, d: 8, notes: [45, 49, 52], inst: 'organ', v: 0.16 },  // A
      { at: 0, d: 8, notes: [38], inst: 'pedal', v: 0.18 },           // D2
      { at: 8, d: 8, notes: [34], inst: 'pedal', v: 0.18 },           // B♭1
      { at: 16, d: 8, notes: [43], inst: 'pedal', v: 0.16 },          // G2
      { at: 24, d: 8, notes: [45], inst: 'pedal', v: 0.16 },          // A2
    ],
    organ: [
      { t: 0, d: 4, n: 62, v: 0.30 },   // bar1  D4 整小节
      { t: 8, d: 3, n: 65, v: 0.28 },   // bar3  F4
      { t: 12, d: 2, n: 64, v: 0.24 },  // bar4  E4
      { t: 20, d: 2, n: 69, v: 0.26 },  // bar6  A4
      { t: 22, d: 2, n: 70, v: 0.25 },  // bar6  B♭4
      { t: 26, d: 2, n: 64, v: 0.27 },  // bar7  E4
      { t: 28, d: 4, n: 61, v: 0.30 },  // bar8  C♯4（导音，回到 Dm 却不肯落定）
    ],
  },

  // 「南下的列车」：A 小调，66 BPM，4/4，10 小节 ≈ 36.4s
  // 和弦：Am – F – Dm – E（和声小调，E 大三和弦带 G♯）
  // 弦乐颤音 = 铁轨；每拍一记低音脉冲 = 轮子；旋律 7 个音。
  train: {
    bpm: 66,
    beatsPerBar: 4,
    bars: 10,
    trem: true,
    spans: [
      { at: 0, d: 8, notes: [45, 48, 52], inst: 'strings', v: 0.09 },   // Am
      { at: 8, d: 8, notes: [41, 45, 48], inst: 'strings', v: 0.09 },   // F
      { at: 16, d: 8, notes: [50, 53, 57], inst: 'strings', v: 0.09 },  // Dm
      { at: 24, d: 8, notes: [40, 44, 47], inst: 'strings', v: 0.10 },  // E
      { at: 32, d: 8, notes: [45, 48, 52], inst: 'strings', v: 0.09 },  // Am
      { at: 0, d: 8, notes: [45], inst: 'pedal', v: 0.13 },
      { at: 8, d: 8, notes: [41], inst: 'pedal', v: 0.13 },
      { at: 16, d: 8, notes: [38], inst: 'pedal', v: 0.13 },
      { at: 24, d: 8, notes: [40], inst: 'pedal', v: 0.13 },
      { at: 32, d: 8, notes: [45], inst: 'pedal', v: 0.13 },
    ],
    pulseRoots: [45, 45, 41, 41, 38, 38, 40, 40, 45, 45],
    organ: [
      { t: 6, d: 2, n: 64, v: 0.26 },   // bar2  E4
      { t: 8, d: 3, n: 60, v: 0.26 },   // bar3  C4
      { t: 17, d: 2, n: 62, v: 0.24 },  // bar5  D4
      { t: 20, d: 2, n: 65, v: 0.26 },  // bar6  F4
      { t: 23, d: 2, n: 64, v: 0.23 },  // bar6  E4
      { t: 33, d: 2, n: 59, v: 0.24 },  // bar9  B3
      { t: 36, d: 4, n: 57, v: 0.27 },  // bar10 A3（回到 Am）
    ],
  },

  // 「群山」：D 小调，60 BPM，4/4，8 小节 = 32.0s（开场分镜 31.6s，正好对齐）
  // 全曲只有两样东西：地板（pedal）与三组弦乐长音，没有旋律。
  // 结构就是「从静到紧」：前 16 秒只有 D2 / A1 两个低音，第 16 秒（画面切进车头）
  // 弦乐才从远处浮上来；最后两小节把 B♭ 换成 C♯ —— 半音导音，在切进车厢之前留一根绷紧的弦。
  opening: {
    bpm: 60,
    beatsPerBar: 4,
    bars: 8,
    level: 0.86,
    spans: [
      { at: 0, d: 8, notes: [38], inst: 'pedal', v: 0.20 },           // D2  前两小节只有地板
      { at: 8, d: 8, notes: [33], inst: 'pedal', v: 0.17 },           // A1  空五度
      { at: 16, d: 8, notes: [38], inst: 'pedal', v: 0.19 },          // D2
      { at: 24, d: 4, notes: [34], inst: 'pedal', v: 0.17 },          // B♭1
      { at: 28, d: 4, notes: [37], inst: 'pedal', v: 0.18 },          // C♯2 收紧
      { at: 16, d: 8, notes: [50, 57], inst: 'strings', v: 0.045 },   // D3+A3 空五度
      { at: 24, d: 4, notes: [46, 53], inst: 'strings', v: 0.055 },   // B♭2+F3
      { at: 28, d: 4, notes: [49, 52], inst: 'strings', v: 0.065 },   // C♯3+E3 小三度
    ],
  },

  // 「糖堡站」：A 小调，80 BPM，4/4，8 小节 = 24.0s
  // 和弦：Am – F – Dm – E（第 7 小节提前露 G♯ —— 属和弦的导音 =「不祥的期待」）
  // 雨夜站台的三层：pedal 低音地板、极弱的弦乐雾、pizz 拨弦像雨滴落在雨棚上，
  // 管风琴只在句尾冒四次头，每次都很短。
  station: {
    bpm: 80,
    beatsPerBar: 4,
    bars: 8,
    level: 0.92,
    spans: [
      { at: 0, d: 8, notes: [45], inst: 'pedal', v: 0.12 },   // A2
      { at: 8, d: 8, notes: [41], inst: 'pedal', v: 0.12 },   // F2
      { at: 16, d: 8, notes: [38], inst: 'pedal', v: 0.12 },  // D2
      { at: 24, d: 8, notes: [40], inst: 'pedal', v: 0.13 },  // E2
      { at: 0, d: 8, notes: [57, 60, 64], inst: 'strings', v: 0.032 },   // Am
      { at: 8, d: 8, notes: [53, 57, 60], inst: 'strings', v: 0.034 },   // F
      { at: 16, d: 8, notes: [50, 53, 57], inst: 'strings', v: 0.036 },  // Dm
      { at: 24, d: 8, notes: [52, 56, 59], inst: 'strings', v: 0.038 },  // E
    ],
    organ: [
      { t: 7, d: 1.5, n: 59, v: 0.17 },   // bar2 末 B3
      { t: 15, d: 2, n: 56, v: 0.17 },    // bar4 末 G♯3（E 的导音，提前露出来）
      { t: 21, d: 2, n: 62, v: 0.18 },    // bar6 末 D4
      { t: 29, d: 3, n: 64, v: 0.20 },    // bar8  E4，停在属音上
    ],
    // 拨弦动机：每小节 2–3 记，落点故意不齐（1.75 / 2.5 之类的反拍），像雨滴
    hits: [
      { inst: 'pizz', t: 0, n: 57, v: 0.10 },
      { inst: 'pizz', t: 1.75, n: 60, v: 0.07 },
      { inst: 'pizz', t: 2.5, n: 64, v: 0.085 },
      { inst: 'pizz', t: 4, n: 64, v: 0.075 },
      { inst: 'pizz', t: 6, n: 57, v: 0.065 },
      { inst: 'pizz', t: 8, n: 53, v: 0.10 },
      { inst: 'pizz', t: 9.75, n: 57, v: 0.075 },
      { inst: 'pizz', t: 11, n: 60, v: 0.07 },
      { inst: 'pizz', t: 12, n: 60, v: 0.075 },
      { inst: 'pizz', t: 14, n: 53, v: 0.065 },
      { inst: 'pizz', t: 16, n: 62, v: 0.10 },
      { inst: 'pizz', t: 17.75, n: 65, v: 0.075 },
      { inst: 'pizz', t: 19, n: 57, v: 0.07 },
      { inst: 'pizz', t: 20, n: 57, v: 0.075 },
      { inst: 'pizz', t: 22, n: 62, v: 0.065 },
      { inst: 'pizz', t: 24, n: 64, v: 0.10 },
      { inst: 'pizz', t: 25.75, n: 68, v: 0.085 },   // G♯4
      { inst: 'pizz', t: 27, n: 59, v: 0.07 },
      { inst: 'pizz', t: 28, n: 59, v: 0.08 },
      { inst: 'pizz', t: 30, n: 64, v: 0.07 },
    ],
  },

  // 「山路」：D 小调，76 BPM，4/4，8 小节 ≈ 25.3s
  // 和弦：Dm – C – B♭ – A（自然小调的七级、六级，走起来的感觉）
  // 节奏感全在脚下：pulse 每小节三记 —— 0 拍落地（重）、2 拍换脚（次重）、
  // 2.75 拍拖一下（轻）。不是轮子那种均匀脉冲，是「一重两轻」的脚步。
  // 弦乐只做长音铺底，管风琴偶尔喘一口气。
  road: {
    bpm: 76,
    beatsPerBar: 4,
    bars: 8,
    level: 0.95,
    spans: [
      { at: 0, d: 8, notes: [50, 53, 57], inst: 'strings', v: 0.065 },   // Dm
      { at: 8, d: 8, notes: [48, 52, 55], inst: 'strings', v: 0.065 },   // C
      { at: 16, d: 8, notes: [46, 50, 53], inst: 'strings', v: 0.07 },   // B♭
      { at: 24, d: 8, notes: [45, 49, 52], inst: 'strings', v: 0.075 },  // A
      { at: 0, d: 8, notes: [38], inst: 'pedal', v: 0.14 },   // D2
      { at: 8, d: 8, notes: [36], inst: 'pedal', v: 0.14 },   // C2
      { at: 16, d: 8, notes: [34], inst: 'pedal', v: 0.14 },  // B♭1
      { at: 24, d: 8, notes: [33], inst: 'pedal', v: 0.15 },  // A1
    ],
    organ: [
      { t: 10, d: 1.5, n: 64, v: 0.17 },   // bar3  E4
      { t: 22, d: 1.5, n: 65, v: 0.17 },   // bar6  F4
      { t: 30.5, d: 1.5, n: 57, v: 0.19 }, // bar8  A3（回到 Dm 之前的属音）
    ],
    hits: [
      // bar1 Dm
      { inst: 'pulse', t: 0, n: 38, v: 0.17 },
      { inst: 'pulse', t: 2, n: 38, v: 0.10 },
      { inst: 'pulse', t: 2.75, n: 38, v: 0.055 },
      // bar2 Dm
      { inst: 'pulse', t: 4, n: 38, v: 0.17 },
      { inst: 'pulse', t: 6, n: 38, v: 0.10 },
      { inst: 'pulse', t: 6.75, n: 38, v: 0.055 },
      // bar3 C
      { inst: 'pulse', t: 8, n: 36, v: 0.17 },
      { inst: 'pulse', t: 10, n: 36, v: 0.10 },
      { inst: 'pulse', t: 10.75, n: 36, v: 0.055 },
      // bar4 C
      { inst: 'pulse', t: 12, n: 36, v: 0.17 },
      { inst: 'pulse', t: 14, n: 36, v: 0.10 },
      { inst: 'pulse', t: 14.75, n: 36, v: 0.055 },
      // bar5 B♭
      { inst: 'pulse', t: 16, n: 34, v: 0.17 },
      { inst: 'pulse', t: 18, n: 34, v: 0.10 },
      { inst: 'pulse', t: 18.75, n: 34, v: 0.055 },
      // bar6 B♭
      { inst: 'pulse', t: 20, n: 34, v: 0.17 },
      { inst: 'pulse', t: 22, n: 34, v: 0.10 },
      { inst: 'pulse', t: 22.75, n: 34, v: 0.055 },
      // bar7 A
      { inst: 'pulse', t: 24, n: 33, v: 0.18 },
      { inst: 'pulse', t: 26, n: 33, v: 0.105 },
      { inst: 'pulse', t: 26.75, n: 33, v: 0.06 },
      // bar8 A
      { inst: 'pulse', t: 28, n: 33, v: 0.18 },
      { inst: 'pulse', t: 30, n: 33, v: 0.105 },
      { inst: 'pulse', t: 30.75, n: 33, v: 0.06 },
    ],
  },

  // 「大门」：D 小调，50 BPM，4/4，8 小节 = 38.4s
  // 和弦：Dm – B♭ – Gm – A（和 title 同一套骨架，但管风琴电平提上去、低音压下去：
  // interior 是「空的」，gate 是「压下来的」。）
  // 动机只有一条：每小节一个音的极慢上行音阶 D4 → D5（D 和声小调，带 C♯），
  // 最后一小节落在高八度的 D 上，循环回 Dm 不会断。
  gate: {
    bpm: 50,
    beatsPerBar: 4,
    bars: 8,
    level: 1,
    spans: [
      { at: 0, d: 8, notes: [50, 53, 57], inst: 'organ', v: 0.185 },   // Dm
      { at: 8, d: 8, notes: [46, 50, 53], inst: 'organ', v: 0.18 },    // B♭
      { at: 16, d: 8, notes: [43, 46, 50], inst: 'organ', v: 0.175 },  // Gm
      { at: 24, d: 8, notes: [45, 49, 52], inst: 'organ', v: 0.19 },   // A
      { at: 0, d: 8, notes: [38], inst: 'pedal', v: 0.23 },   // D2
      { at: 8, d: 8, notes: [34], inst: 'pedal', v: 0.22 },   // B♭1
      { at: 16, d: 8, notes: [43], inst: 'pedal', v: 0.20 },  // G2
      { at: 24, d: 8, notes: [33], inst: 'pedal', v: 0.21 },  // A1
      { at: 0, d: 4, notes: [62], inst: 'organ', v: 0.20 },   // D4
      { at: 4, d: 4, notes: [64], inst: 'organ', v: 0.19 },   // E4
      { at: 8, d: 4, notes: [65], inst: 'organ', v: 0.20 },   // F4
      { at: 12, d: 4, notes: [67], inst: 'organ', v: 0.19 },  // G4
      { at: 16, d: 4, notes: [69], inst: 'organ', v: 0.20 },  // A4
      { at: 20, d: 4, notes: [70], inst: 'organ', v: 0.19 },  // B♭4
      { at: 24, d: 4, notes: [73], inst: 'organ', v: 0.21 },  // C♯5 导音
      { at: 28, d: 4, notes: [74], inst: 'organ', v: 0.23 },  // D5 落定
    ],
  },

  // 「城堡」：见文件上方的 INTERIOR 常量
  interior: INTERIOR,
  hall: INTERIOR,
}

/**
 * 别名 → 正名：hall 是 interior 的旧名。
 * 切歌前先归一化，这样『hall → interior』不会被当成换曲而重来一遍。
 */
const CANONICAL: Record<BgmName, BgmName> = {
  title: 'title',
  opening: 'opening',
  train: 'train',
  station: 'station',
  road: 'road',
  gate: 'gate',
  interior: 'interior',
  hall: 'interior',
}

/** 交叉淡变时长（秒）：audio.ts 在开场那一刀传 2.0 / 2.0，地图之间用默认值 */
export interface BgmFade { out: number; in: number }

// ------------------------------------------------------------
// 混响：代码生成的指数衰减噪声 + 几个早期反射（教堂 / 大厅）
// 只在 attach 时生成一次；音效（汽笛）也借这一份 IR，不另建第二个 Convolver。
// ------------------------------------------------------------

export function makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate
  const len = Math.max(1, Math.floor(rate * seconds))
  const ir = ctx.createBuffer(2, len, rate)
  const fade = Math.max(1, Math.floor(rate * 0.008))
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch)
    // 白噪声直接当 IR 会留下"嘶嘶"的高频尾巴；先过一阶低通，让混响偏暗，
    // 像石墙和木地板吸掉高频之后的样子。
    let low = 0
    for (let i = 0; i < len; i++) {
      const p = i / len
      low = low * 0.72 + (Math.random() * 2 - 1) * 0.28
      data[i] = low * 1.6 * Math.pow(1 - p, decay)
    }
    for (let i = 0; i < fade; i++) data[i] *= i / fade
  }
  // 石墙的早期反射：几个稀疏的离散回声
  const taps: Array<[number, number]> = [[0.011, 0.48], [0.019, 0.34], [0.031, 0.26], [0.047, 0.2]]
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch)
    for (const [at, amp] of taps) {
      const idx = Math.floor(at * rate) + (ch === 0 ? 0 : 13)
      if (idx < len) data[idx] += amp
    }
  }
  return ir
}

// ------------------------------------------------------------
// 一个曲目的播放实例（不含定时器；由 BgmEngine 统一 pump）
// ------------------------------------------------------------

class Player {
  private readonly ctx: AudioContext
  private readonly gain: GainNode
  private readonly budget: VoiceBudget
  private events: Map<number, Ev[]>
  private readonly totalSteps: number
  private readonly stepDur: number
  private readonly beatDur: number
  private readonly trem: boolean
  private voices: Voice[] = []
  private step = 0
  private nextTime = 0
  private started = false
  private disposed = false
  /** 整曲电平：淡入淡出的目标值（开场最克制，给得比别的曲子低） */
  private readonly level: number
  /** 切曲淡出：到点后由引擎自动 dispose */
  retireAt = Number.POSITIVE_INFINITY

  constructor(ctx: AudioContext, dest: AudioNode, track: Track, budget: VoiceBudget) {
    this.ctx = ctx
    this.budget = budget
    this.trem = track.trem === true
    this.level = track.level ?? 1
    this.events = compile(track)
    this.totalSteps = track.bars * track.beatsPerBar * STEPS_PER_BEAT
    this.beatDur = 60 / track.bpm
    this.stepDur = this.beatDur / STEPS_PER_BEAT
    this.gain = ctx.createGain()
    this.gain.gain.value = 0
    this.gain.connect(dest)
  }

  play(fadeIn = DEFAULT_FADE_IN): void {
    if (this.started) return
    this.started = true
    const now = this.ctx.currentTime
    this.nextTime = now + 0.15
    this.gain.gain.setValueAtTime(0, now)
    this.gain.gain.linearRampToValueAtTime(this.level, now + Math.max(0.05, fadeIn))
  }

  /** 淡出到 0，到点由引擎回收（不再由本实例排定时器） */
  retire(seconds: number): void {
    if (this.disposed) return
    const now = this.ctx.currentTime
    this.retireAt = now + seconds
    const g = this.gain.gain
    try {
      g.cancelScheduledValues(now)
      g.setValueAtTime(Math.max(0, g.value), now)
      g.linearRampToValueAtTime(0, now + seconds)
    } catch { /* ignore */ }
  }

  isExpired(now: number): boolean {
    return this.disposed || now >= this.retireAt
  }

  /** 提前调度：只依赖 AudioContext 绝对时间，不依赖 interval 精度 */
  pump(now: number): void {
    if (this.disposed) return
    // 页面后台被节流 / 音频线程被挂起后重新对齐，避免一次性补发一堆音符
    if (this.nextTime < now - 0.6) {
      this.nextTime = now + 0.06
      this.step = 0
    }
    let guard = 0
    while (this.nextTime < now + LOOKAHEAD && guard++ < 64) {
      const list = this.events.get(this.step)
      if (list) {
        for (const ev of list) this.fire(ev, this.nextTime)
      }
      this.nextTime += this.stepDur
      this.step = (this.step + 1) % this.totalSteps
    }
  }

  /** 彻底销毁：所有节点 stop + disconnect，清空事件表与活跃表 */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const now = this.ctx.currentTime
    for (const voice of [...this.voices]) {
      for (const osc of voice.oscs) {
        try { osc.stop(now) } catch { /* already stopped */ }
      }
      this.endVoice(voice)
    }
    this.voices = []
    this.events.clear()
    try { this.gain.disconnect() } catch { /* ignore */ }
  }

  private beginVoice(): Voice | null {
    if (this.budget.count >= this.budget.limit) {
      if (!this.budget.warned) {
        this.budget.warned = true
        console.warn('[bgm] voice cap reached, dropping notes')
      }
      return null
    }
    const voice: Voice = { oscs: [], nodes: [], ended: false }
    this.voices.push(voice)
    this.budget.count++
    return voice
  }

  /**
   * 登记一个音符的整条链路。主振荡器结束时（ended，只监听一次）整组回收：
   * 每个节点都 disconnect —— 只 stop 不 disconnect 会让节点继续被 AudioContext 持有，
   * 那是"每循环泄漏一点"的根源。
   */
  private register(voice: Voice, main: OscillatorNode, oscs: OscillatorNode[], nodes: AudioNode[]): void {
    for (const osc of oscs) voice.oscs.push(osc)
    for (const node of nodes) voice.nodes.push(node)
    main.addEventListener('ended', () => this.endVoice(voice), { once: true })
  }

  private endVoice(voice: Voice): void {
    if (voice.ended) return
    voice.ended = true
    const i = this.voices.indexOf(voice)
    if (i >= 0) this.voices.splice(i, 1)
    this.budget.count = Math.max(0, this.budget.count - 1)
    for (const osc of voice.oscs) {
      try { osc.disconnect() } catch { /* ignore */ }
    }
    for (const node of voice.nodes) {
      try { node.disconnect() } catch { /* ignore */ }
    }
  }

  private fire(ev: Ev, t: number): void {
    const dur = Math.max(0.12, ev.d * this.beatDur)
    switch (ev.inst) {
      case 'organ': this.organ(ev.n, t, dur, ev.v); return
      case 'strings': this.strings(ev.n, t, dur, ev.v); return
      case 'pedal': this.pedal(ev.n, t, dur, ev.v); return
      case 'pulse': this.pulse(ev.n, t, ev.v); return
      case 'pizz': this.pizz(ev.n, t, ev.v); return
    }
  }

  // ---- 音色 ----

  /** 管风琴：方波 + 三角波 + 低八度正弦音栓，5Hz 颤音，慢起慢收 */
  private organ(midi: number, t: number, dur: number, v: number): void {
    const voice = this.beginVoice()
    if (!voice) return
    const ctx = this.ctx
    const f = hz(midi)
    const atk = Math.min(1.4, Math.max(0.28, dur * 0.18))
    const rel = 1.6
    const hold = t + Math.max(atk + 0.06, dur)
    const end = hold + rel

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(1400, t)
    lp.frequency.linearRampToValueAtTime(2200, t + Math.max(0.4, dur))
    lp.Q.value = 0.6

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.linearRampToValueAtTime(v, t + atk)
    env.gain.setValueAtTime(v, hold)
    env.gain.linearRampToValueAtTime(0.0001, end)

    const square = ctx.createOscillator()
    square.type = 'square'
    square.frequency.value = f
    const tri = ctx.createOscillator()
    tri.type = 'triangle'
    tri.frequency.value = f
    tri.detune.value = 6
    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = f / 2

    const gSq = ctx.createGain(); gSq.gain.value = 0.32
    const gTri = ctx.createGain(); gTri.gain.value = 0.30
    const gSub = ctx.createGain(); gSub.gain.value = 0.20

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 5
    const lfoAmt = ctx.createGain()
    lfoAmt.gain.value = f * 0.0038

    square.connect(gSq); tri.connect(gTri); sub.connect(gSub)
    gSq.connect(lp); gTri.connect(lp); gSub.connect(lp)
    lp.connect(env)
    env.connect(this.gain)
    lfo.connect(lfoAmt)
    lfoAmt.connect(square.frequency)
    lfoAmt.connect(tri.frequency)

    this.register(voice, square, [square, tri, sub, lfo], [lp, env, gSq, gTri, gSub, lfoAmt])

    const stopAt = end + 0.06
    square.start(t); tri.start(t); sub.start(t); lfo.start(t)
    square.stop(stopAt); tri.stop(stopAt); sub.stop(stopAt); lfo.stop(stopAt)
  }

  /** 弦乐：双锯齿失谐 + 低通 ~980Hz，0.8s 起音；火车里再加 6.2Hz 振幅颤音 */
  private strings(midi: number, t: number, dur: number, v: number): void {
    const voice = this.beginVoice()
    if (!voice) return
    const ctx = this.ctx
    const f = hz(midi)
    const atk = 0.8
    const rel = 1.8
    const hold = t + Math.max(atk + 0.1, dur)
    const end = hold + rel

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 980
    lp.Q.value = 0.7

    const trem = ctx.createGain()
    trem.gain.value = 1

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.linearRampToValueAtTime(v, t + atk)
    env.gain.setValueAtTime(v, hold)
    env.gain.linearRampToValueAtTime(0.0001, end)

    const sawA = ctx.createOscillator()
    sawA.type = 'sawtooth'
    sawA.frequency.value = f
    const sawB = ctx.createOscillator()
    sawB.type = 'sawtooth'
    sawB.frequency.value = f
    sawB.detune.value = -8
    const gA = ctx.createGain(); gA.gain.value = 0.33
    const gB = ctx.createGain(); gB.gain.value = 0.33

    sawA.connect(gA); sawB.connect(gB)
    gA.connect(lp); gB.connect(lp)
    lp.connect(trem)
    trem.connect(env)
    env.connect(this.gain)

    const oscs: OscillatorNode[] = [sawA, sawB]
    const nodes: AudioNode[] = [gA, gB, lp, trem, env]

    // 弓弦的 4.6Hz 微颤
    const vib = ctx.createOscillator()
    vib.frequency.value = 4.6
    const vibAmt = ctx.createGain()
    vibAmt.gain.value = f * 0.0022
    vib.connect(vibAmt)
    vibAmt.connect(sawA.frequency)
    vibAmt.connect(sawB.frequency)
    oscs.push(vib)
    nodes.push(vibAmt)

    // 铁轨的金属抖动：6.2Hz 的振幅颤音
    if (this.trem) {
      const tLfo = ctx.createOscillator()
      tLfo.frequency.value = 6.2
      const tAmt = ctx.createGain()
      tAmt.gain.value = 0.22
      tLfo.connect(tAmt)
      tAmt.connect(trem.gain)
      oscs.push(tLfo)
      nodes.push(tAmt)
    }

    this.register(voice, sawA, oscs, nodes)

    const stopAt = end + 0.06
    for (const osc of oscs) {
      osc.start(t)
      osc.stop(stopAt)
    }
  }

  /** 低音持续：正弦 + 三角，极慢起音，当作和声地板 */
  private pedal(midi: number, t: number, dur: number, v: number): void {
    const voice = this.beginVoice()
    if (!voice) return
    const ctx = this.ctx
    const f = hz(midi)
    const atk = 1.3
    const rel = 2.8
    const hold = t + Math.max(atk + 0.1, dur)
    const end = hold + rel

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 240

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.linearRampToValueAtTime(v, t + atk)
    env.gain.setValueAtTime(v, hold)
    env.gain.linearRampToValueAtTime(0.0001, end)

    const sine = ctx.createOscillator()
    sine.type = 'sine'
    sine.frequency.value = f
    const tri = ctx.createOscillator()
    tri.type = 'triangle'
    tri.frequency.value = f
    const gS = ctx.createGain(); gS.gain.value = 0.62
    const gT = ctx.createGain(); gT.gain.value = 0.38

    sine.connect(gS); tri.connect(gT)
    gS.connect(lp); gT.connect(lp)
    lp.connect(env)
    env.connect(this.gain)

    this.register(voice, sine, [sine, tri], [gS, gT, lp, env])

    const stopAt = end + 0.06
    sine.start(t); tri.start(t)
    sine.stop(stopAt); tri.stop(stopAt)
  }

  /** 轮子：pedal 音色的短包络变体，每拍一记 */
  private pulse(midi: number, t: number, v: number): void {
    const voice = this.beginVoice()
    if (!voice) return
    const ctx = this.ctx
    const f = hz(midi)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 320

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.linearRampToValueAtTime(v, t + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)

    const sine = ctx.createOscillator()
    sine.type = 'sine'
    sine.frequency.value = f
    const tri = ctx.createOscillator()
    tri.type = 'triangle'
    tri.frequency.value = f * 2
    const gS = ctx.createGain(); gS.gain.value = 0.6
    const gT = ctx.createGain(); gT.gain.value = 0.25

    sine.connect(gS); tri.connect(gT)
    gS.connect(lp); gT.connect(lp)
    lp.connect(env)
    env.connect(this.gain)

    this.register(voice, sine, [sine, tri], [gS, gT, lp, env])

    sine.start(t); tri.start(t)
    sine.stop(t + 0.32); tri.stop(t + 0.32)
  }

  /**
   * 拨弦（pizzicato）：6ms 起音 + 指数衰减，低通从 3.2kHz 一路收到 900Hz ——
   * 起音瞬间是弓毛离开琴弦的「嗒」，尾巴是琴箱的木头共鸣。
   * 时长固定 0.45s，与 BPM 无关：拨弦本来就该在下一拍之前散掉。
   */
  private pizz(midi: number, t: number, v: number): void {
    const voice = this.beginVoice()
    if (!voice) return
    const ctx = this.ctx
    const f = hz(midi)
    const body = 0.45
    const end = t + body

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(3200, t)
    lp.frequency.exponentialRampToValueAtTime(900, end)
    lp.Q.value = 0.8

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.linearRampToValueAtTime(v, t + 0.006)
    env.gain.exponentialRampToValueAtTime(0.0001, end)

    const saw = ctx.createOscillator()
    saw.type = 'sawtooth'
    saw.frequency.value = f
    const tri = ctx.createOscillator()
    tri.type = 'triangle'
    tri.frequency.value = f * 2
    const gS = ctx.createGain(); gS.gain.value = 0.42
    const gT = ctx.createGain(); gT.gain.value = 0.22

    saw.connect(gS); tri.connect(gT)
    gS.connect(lp); gT.connect(lp)
    lp.connect(env)
    env.connect(this.gain)

    this.register(voice, saw, [saw, tri], [gS, gT, lp, env])

    const stopAt = end + 0.04
    saw.start(t); tri.start(t)
    saw.stop(stopAt); tri.stop(stopAt)
  }
}

function compile(track: Track): Map<number, Ev[]> {
  const map = new Map<number, Ev[]>()
  const totalSteps = track.bars * track.beatsPerBar * STEPS_PER_BEAT
  const add = (ev: Ev): void => {
    const step = Math.round(ev.t * STEPS_PER_BEAT)
    if (step < 0 || step >= totalSteps) return
    const list = map.get(step)
    if (list) list.push(ev)
    else map.set(step, [ev])
  }
  for (const span of track.spans) {
    for (const n of span.notes) {
      add({ inst: span.inst, n, t: span.at, d: span.d, v: span.v })
    }
  }
  for (const note of track.organ ?? []) add({ inst: 'organ', n: note.n, t: note.t, d: note.d, v: note.v })
  for (const hit of track.hits ?? []) {
    add({ inst: hit.inst, n: hit.n, t: hit.t, d: hit.d ?? 0.25, v: hit.v })
  }
  if (track.pulseRoots) {
    for (let bar = 0; bar < track.pulseRoots.length; bar++) {
      const root = track.pulseRoots[bar]
      for (let beat = 0; beat < track.beatsPerBar; beat++) {
        add({
          inst: 'pulse',
          n: root,
          t: bar * track.beatsPerBar + beat,
          d: 0.24,
          v: beat % 2 === 0 ? 0.14 : 0.085,
        })
      }
    }
  }
  return map
}

// ------------------------------------------------------------
// BGM 引擎：总线 + 混响 + 唯一调度器 + 曲目交叉淡变 + 开关持久化
// ------------------------------------------------------------

function readSettings(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const data = raw ? JSON.parse(raw) as unknown : null
    return data && typeof data === 'object' ? data as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function readBgmPref(): boolean {
  const data = readSettings()
  return typeof data.bgm === 'boolean' ? data.bgm : true
}

function writeBgmPref(on: boolean): void {
  try {
    const data = readSettings()
    data.bgm = on
    localStorage.setItem(STORE_KEY, JSON.stringify(data))
  } catch { /* ignore */ }
}

export class BgmEngine {
  private ctx: AudioContext | null = null
  private bus: GainNode | null = null
  private current: BgmName | null = null
  private players: Player[] = []
  private timer: number | null = null
  private enabled = readBgmPref()
  /** 跨曲目共享的音符预算：同时存活的音源组不超过 MAX_VOICES */
  private readonly budget: VoiceBudget = { count: 0, limit: MAX_VOICES, warned: false }

  /** 在 AudioContext 建好后接入；ctx 与 IR 全局只一份 */
  attach(ctx: AudioContext, dest: AudioNode): void {
    if (this.ctx) return
    this.ctx = ctx
    const bus = ctx.createGain()
    bus.gain.value = BGM_VOLUME
    const dry = ctx.createGain()
    dry.gain.value = DRY_MIX
    const wet = ctx.createGain()
    wet.gain.value = WET_MIX
    const conv = ctx.createConvolver()
    conv.buffer = makeImpulse(ctx, 3.0, 2.6)
    // 湿声再削一次高频，避免长混响把琴声糊成一片"嗡嗡"
    const wetLow = ctx.createBiquadFilter()
    wetLow.type = 'lowpass'
    wetLow.frequency.value = 2200
    bus.connect(dry)
    dry.connect(dest)
    bus.connect(conv)
    conv.connect(wetLow)
    wetLow.connect(wet)
    wet.connect(dest)
    this.bus = bus
    if (this.enabled && this.current) this.startTrack(this.current)
  }

  /**
   * 切换曲目（null = 只留环境音）。
   * fade 不传就用默认交叉淡变；开场那一刀由 audio.ts 传 2.0 / 2.0（借最后的黑场）。
   */
  setTrack(name: BgmName | null, fade?: BgmFade): void {
    // ?? null：场景表里出现未知 key 时宁可静音，也不要把 current 写成 undefined
    const next = name === null ? null : (CANONICAL[name] ?? null)
    if (next === this.current) {
      this.ensurePlaying()
      return
    }
    this.current = next
    if (!this.ctx || !this.bus || !this.enabled) {
      this.stopPlayers(fade)
      return
    }
    this.startTrack(next, fade)
  }

  getTrack(): BgmName | null { return this.current }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return
    this.enabled = on
    writeBgmPref(on)
    if (on) this.ensurePlaying()
    else this.stopPlayers()
  }

  isEnabled(): boolean { return this.enabled }

  /** ctx 已就绪但播放实例丢失时补播（例如从 suspended 恢复） */
  ensurePlaying(): void {
    if (!this.enabled || !this.ctx || !this.bus || !this.current) return
    if (this.players.length === 0) this.startTrack(this.current)
  }

  /** 诊断用：活跃播放实例与音符组数量（验收时采样） */
  debugState(): { players: number; voices: number; track: BgmName | null; enabled: boolean } {
    return {
      players: this.players.length,
      voices: this.budget.count,
      track: this.current,
      enabled: this.enabled,
    }
  }

  private startTrack(name: BgmName | null, fade?: BgmFade): void {
    if (!this.ctx || !this.bus) return
    this.stopPlayers(fade)
    if (!name) return
    const player = new Player(this.ctx, this.bus, TRACKS[name], this.budget)
    this.players.push(player)
    player.play(fade?.in ?? DEFAULT_FADE_IN)
    this.startLoop()
  }

  private stopPlayers(fade?: BgmFade): void {
    // 先淡出，等 retireAt 到点由 pumpAll 统一销毁（不留定时器）
    const out = fade?.out ?? DEFAULT_FADE_OUT
    for (const player of this.players) player.retire(out)
    this.startLoop()
  }

  private startLoop(): void {
    if (this.timer != null) return
    this.timer = window.setInterval(() => this.pumpAll(), SCHED_INTERVAL_MS)
  }

  private stopLoop(): void {
    if (this.timer == null) return
    window.clearInterval(this.timer)
    this.timer = null
  }

  private pumpAll(): void {
    const ctx = this.ctx
    if (!ctx) { this.stopLoop(); return }
    const now = ctx.currentTime
    const alive: Player[] = []
    for (const player of this.players) {
      if (player.isExpired(now)) {
        player.dispose()
        continue
      }
      player.pump(now)
      alive.push(player)
    }
    this.players = alive
    if (this.players.length === 0) {
      this.stopLoop()
      // 快速「关 → 开」或切曲恰好撞上淡出末尾时，这里补播
      this.ensurePlaying()
    }
  }
}
