// ============================================================
// 共享类型定义（垂直切片：序章 + 第一章）
// 所有模块的接口契约。改动此文件前先跑 tsc。
// ============================================================
import type { ItemId } from './data/items'

export type GameMode =
  | 'title'      // 标题
  | 'opening'    // 开场分镜（群山 → 铁轨 → 列车 → 车窗）
  | 'chapter'    // 章节卡
  | 'explore'    // 探索（对话作为覆盖层）
  | 'ending'     // 结局演出

export type Dir = 'up' | 'down' | 'left' | 'right'

/** 垂直切片只实现序章与第一章 */
export type ChapterId = 0 | 1

// ---- 结构层（图纸） ----
export type StructKind =
  | 'void' | 'floor' | 'stone' | 'brick' | 'fake'
  | 'beam' | 'arch' | 'pipe' | 'rail' | 'gear' | 'weight'
  | 'shaft' | 'stair' | 'cavity' | 'inkblot' | 'torn'

/** 结构层单字符码 → StructKind */
export const STRUCT_CHARS: Record<string, StructKind> = {
  V: 'void', F: 'floor', S: 'stone', B: 'brick', K: 'fake',
  M: 'beam', A: 'arch', P: 'pipe', R: 'rail', G: 'gear', W: 'weight',
  H: 'shaft', T: 'stair', C: 'cavity', I: 'inkblot', X: 'torn',
}

export type Ambient = 'indoor' | 'fog' | 'alley' | 'night' | 'dream' | 'fire'

export type MapId =
  | 'train' | 'station' | 'road' | 'gate' | 'hall' | 'corridorE' | 'bedroom1'
  | 'dining' | 'library' | 'corridorMain' | 'bridge' | 'cellar' | 'garden' | 'parlor'

export interface EntityDef {
  id: string
  x: number
  y: number
  sprite: string
  solid?: boolean
  /** 仅图纸模式下可见 */
  blueprintOnly?: boolean
  /** 该 flag 为真时隐藏 */
  hideFlag?: string
  /** 该 flag 为真时才显示 */
  showFlag?: string
  /** events.ts 中的处理函数 id */
  interact?: string
  face?: Dir
  tall?: boolean
  /**
   * 精灵是否为四方向角色，且应随时面朝玩家
   * （walk 图必须有 _down/_up/_left/_right 四个变体）。
   * e.sprite 仍写 _down 作为兜底；渲染器每帧按玩家相对位置覆盖方向，
   * 所以玩家走近 / 对话期间她都会转身看着玩家。
   */
  facePlayer?: boolean
}

export interface Portal {
  x: number
  y: number
  to: MapId
  tx: number
  ty: number
  dir: Dir
  /** 该 flag 为真才可通过 */
  lockFlag?: string
  lockMsg?: string
  /** 永远不可通过（看得见但过不去） */
  neverOpen?: boolean
}

export interface Revision {
  chapter: number
  cells: { x: number; y: number; struct: string }[]
  note?: string
}

export interface GameMap {
  id: MapId
  name: string
  ambient: Ambient
  dark: number
  /** 现实层字符网格（每行等宽） */
  tiles: string[]
  /** 结构层字符网格（尺寸必须与 tiles 完全一致） */
  struct: string[]
  entities: EntityDef[]
  portals: Portal[]
  revisions?: Revision[]
  /** 相机纵向偏移（负值 = 镜头上抬，露出更多上方内容）。用于远景可见的场景 */
  camBiasY?: number
}

// ---- 对话与效果 ----
export type SpeakerId =
  | 'none' | 'ftz' | 'ftzCold'          // 旁白 / 主角 / 主角（冷）
  | 'emma' | 'emmaQuiet'                 // 艾玛 / 艾玛（极轻）
  | 'hermann' | 'hermannVoid' | 'marta' | 'voice'  // 赫尔曼 / 赫尔曼（无面，里线） / 玛尔塔 / 无形之声
  | 'ds'                                 // 彩蛋角色（立绘 key 同为 ds）

export interface DialogChoice {
  text: string
  do?: Effect[]
  next?: string
  /** 需要该 flag 为真才显示 */
  requires?: string
  /** 该 flag 为真时不显示 */
  hides?: string
}

export type Step =
  | { t: 'line'; sp?: SpeakerId; text: string }
  | { t: 'choice'; opts: DialogChoice[] }
  | { t: 'do'; do: Effect[] }

export interface Effect {
  conviction?: number
  sweetness?: number
  sugar?: number
  ink?: number
  flag?: [string, boolean | number]
  next?: string
  teleport?: { map: MapId; x: number; y: number; dir?: Dir }
  toast?: string
  toastKind?: 'info' | 'warn' | 'sugar' | 'conviction'
  shake?: number
  sound?: string
  chapter?: { num: string; name: string; quote: string }
  achievement?: string
  ending?: EndingId
  /** 强制开关图纸模式 */
  blueprint?: 'open' | 'close' | 'toggle'
  /** 背包增减：[物品 id, 数量]。数量 >0 入包（去重），<0 出包 */
  item?: [ItemId, number]
  /**
   * 打开一场问答小游戏（礼仪课）。
   * 只负责把 flag 立起来：小游戏组件监听 flag，自己接管画面。
   * 目前只有 'etiquette'，留成字符串是为了别的小游戏也能走同一条路。
   */
  quiz?: string
  /**
   * 礼仪分：累加到 flags.etiquetteScore。
   * 第六章千面之月的宴会上用得到（分数低会被当成糖贩子的后代）。
   * 小游戏是运行时算的分，所以除了剧本，EtiquetteQuiz 也直接调这个入口。
   */
  etiquette?: number
}

export type EndingId =
  | 'foundling'   // 弃婴：确信归零
  | 'void'        // 切片占位：其余死法未实装

// ---- 成就 ----
export interface Achievement {
  id: string
  name: string
  desc: string
  /** 未解锁时隐藏描述 */
  secret?: boolean
  group: 'chapter' | 'explore' | 'secret'
}

// ---- 存档 ----
export interface SaveData {
  version: 2
  savedAt: string
  chapter: ChapterId
  map: MapId
  x: number
  y: number
  dir: Dir
  conviction: number
  sweetness: number
  sugar: number
  ink: number
  flags: Record<string, boolean | number>
  /** 只增不减的账本 */
  traces: Traces
  revisionsApplied: number[]
  playSeconds: number
  /**
   * 背包内容（物品 id 列表，按取得顺序）。
   * 旧档没有这个字段：读档时按空数组处理（store.ts 的 applySaveData）。
   */
  inventory: ItemId[]
}

export interface Traces {
  sugar: number
  vision: number
  rude: number
  forgot: string[]
  chaptersDone: number[]
}

export interface RunMeta {
  version: 2
  completedRuns: number
  endingHistory: { ending: EndingId; at: string; run: number }[]
  unlockedInner: boolean
  achievements: string[]
}

export interface SaveSlotSummary {
  slot: number
  savedAt: string
  chapter: ChapterId
  map: MapId
  conviction: number
  sugar: number
}

export interface SaveFileData {
  format: 'von-zuckerhoff-save'
  version: 2
  savedAt: string
  game: SaveData
  meta: RunMeta
}

// ---- 对话中的角色显示名 ----
export const SPEAKER_NAMES: Record<SpeakerId, string> = {
  none: '',
  ftz: '弗里德里希',
  ftzCold: '弗里德里希',
  emma: '艾玛',
  emmaQuiet: '艾玛',
  hermann: '赫尔曼',
  hermannVoid: '赫尔曼',
  marta: '玛尔塔',
  voice: '',
  ds: '？？？',
}
