// ============================================================
// 交互与入场事件
// 每个实体的 interact 在这里分派到 script.ts 的脚本
// ============================================================
import { startScript, setFlag, hasFlag, useGame, addToast, unlockAch, eatSugar } from '../store'
import { SCRIPTS } from '../data/script'
import type { MapId } from '../types'

/** 每个地图首次进入时触发的脚本 */
const ENTER: Partial<Record<MapId, string>> = {
  train: 'arriveTrain',
  station: 'arriveStation',
  road: 'arriveRoad',
  gate: 'arriveGate',
  hall: 'arriveHall',
  corridorE: 'arriveCorridorE',
  bedroom1: 'arriveBedroom',
  dining: 'arriveDining',
  library: 'arriveLibrary',
  corridorMain: 'arriveCorridorMain',
  bridge: 'arriveBridge',
  cellar: 'arriveCellar',
  garden: 'arriveGarden',
  parlor: 'arriveParlor',
}

/**
 * 第一夜的「夜游」还没结束吗。
 *
 * 从「按床睡不着」到「赫尔曼把人送回房」这一段，东翼是被隔开的：
 * 走廊尽头那扇通往门厅的门锁着 —— 他以为自己只是走到走廊口看一眼，
 * 可不管往哪边走，都回不到大厅（见 maps.ts 的 corridorE portal）。
 *
 * 赫尔曼拦过他一次（hermannSawNight）之后，戏里的「送回房」已经发生，
 * 这扇门就恢复通行；睡到第一章之后自然也通。
 */
function eastWingSealed(): boolean {
  const g = useGame.getState()
  return g.chapter === 0 && hasFlag('nightWalk') && !hasFlag('hermannSawNight')
}

export function onEnterMap(map: MapId): void {
  // 通行权限：进入某地图即解锁对应的门（幂等）
  if (map === 'hall') setFlag('hallOpen', true)
  if (map === 'dining') setFlag('cellarOpen', true)
  // 走廊 → 门厅：每次进走廊都按剧情状态重算（白天通，夜游锁）。
  // 门本身默认是锁的，所以这一行必须跑在「门还能不能用」之前 —— 它就在这。
  if (map === 'corridorE') setFlag('corridorToHallOpen', !eastWingSealed())

  const key = 'seen_' + map
  if (hasFlag(key)) return
  const scriptId = ENTER[map]
  if (!scriptId || !SCRIPTS[scriptId]) return
  setFlag(key, true)
  startScript(scriptId)
}

/** 需要特殊逻辑（不只是播放剧本）的交互 */
const SPECIAL: Record<string, () => void> = {
  hallArch: () => {
    // 门厅拱肋：教学补图
    const g = useGame.getState()
    if (hasFlag('archRepaired')) {
      speak('archDone')
      return
    }
    if (!g.blueprint) {
      speak('archNeedBlueprint')
      return
    }
    speak('archRepairStart')
  },
  lookVictoria: () => {
    const g = useGame.getState()
    if (g.blueprint) unlockAch('portraitBreath')
    speak('lookVictoria')
  },
  eat: () => {
    eatSugar()
  },
  knockGate: () => {
    if (hasFlag('gateOpen')) { speak('gateAlreadyOpen'); return }
    speak('knockGate')
  },
  /**
   * 大门前 (13,17) 那个看不见的锚点：回山路的那一格已经封死（maps.ts 的 neverOpen）。
   * 走进 (12,17) 什么也不会发生 —— 这一句是给「什么也没发生」一个能按得到的解释。
   * 不走剧本：script.ts 不归这一段管，一条 toast 就够了。
   */
  gateBackRoad: () => {
    addToast('（来路在雨里断了。回头已经没有路。）', 'info')
  },
  enterBedroom: () => {
    setFlag('nightWalk', true)
    speak('enterBedroom')
  },
  /**
   * 走廊里的赫尔曼。那句「我送您回房间」在戏里就是夜游的终点 ——
   * 搭话的一刻，走廊尽头通往门厅的门就重新通了（门上的 flag 只有真假，
   * 没有「赫尔曼说过话」这个条件，所以在这里补一笔）。
   *
   * 对话期间世界是冻结的，早设一步没有副作用；仍然走 speak()：
   * 第二次搭话的 _again 规则一条不改。
   */
  talkHermannNight: () => {
    speak('talkHermannNight')
    setFlag('corridorToHallOpen', true)
  },
  toBridge: () => {
    speak('toBridge')
  },
  lookTower: () => {
    const g = useGame.getState()
    if (hasFlag('towerMeasured')) {
      addToast('（量过了。它比看上去深得多。）', 'info')
      return
    }
    if (!g.blueprint) {
      speak('lookTower')
      return
    }
    setFlag('towerMeasureActive', true)
  },
  lookBed: () => {
    // 例外：睡觉是推进章节的开关，第二次调查也必须能推进，
    // 所以这里不走 speak()（否则会被 endPrologue_again 之类吃掉）。
    const g = useGame.getState()
    // 第一夜分两段 —— 原作里他第一次躺下是睡不着的：
    //   第一次躺下 → 睡不着，起来闲逛 → 出门（nightWalk 开放东走廊）
    //   夜游遇到赫尔曼，被送回房 → 再躺下 → 这才真的睡着
    // 所以「第一次」只播 cannotSleep，不推进章节。
    if (g.chapter === 0 && !hasFlag('nightWalk')) {
      setFlag('nightWalk', true)
      // 夜游开始的那一刻就把东翼封上：走廊尽头通往门厅的门锁起来，
      // 他只能在卧室与这条走廊之间来回（门在 onEnterMap('corridorE') 里还会再算一次）。
      setFlag('corridorToHallOpen', false)
      startScript('cannotSleep')
      return
    }
    // 第二段：睡着之后接法兰克福的蒙太奇（「纱锭与煤气灯」），
    // 章节卡在蒙太奇之后才切（见 script.ts 的 wakeAfterMontage）。
    if (g.chapter === 0 && !hasFlag('sawFrankfurt')) setFlag('montagePending', true)
    startScript(g.chapter === 1 ? 'endChapter1' : 'endPrologue')
  },
}

/**
 * 播一条脚本，并记下「看过」。
 * 第二次及以后：如果 script.ts 末尾追加了 <id>_again，就只播那一段短回应；
 * 没有 _again 的脚本（世界的其它地方）照原样再播一遍。
 * 特殊交互（SPECIAL）在内部播脚本时也走这里，规则完全一致。
 */
function speak(id: string): void {
  if (SCRIPTS[id + '_again'] && hasFlag('seen_' + id)) {
    startScript(id + '_again')
    return
  }
  if (!SCRIPTS[id]) return
  startScript(id)
  setFlag('seen_' + id, true)
}

/**
 * 彩蛋的开门条件：在列车上调查过 4 件不同的东西。
 * 计的是「不同的东西」而不是次数 —— 同一只猫看十遍也还是只算一件。
 * 信 / 胸针 / 线图不再占单独的交互点（它们在背包里），
 * 所以车上的 NPC 与装饰也算「车上的东西」。
 */
const TRAIN_LOOKS = [
  'lookCat', 'talkEmmaTrain',
  'trainSleeper', 'trainNewspaper', 'trainMother', 'trainCane',
  'trainRack', 'trainCurtain', 'trainBin', 'trainFootstep', 'trainFrost', 'trainSmoke',
]
const CAMEO_LOOKS = 4

/**
 * 数一件调查过的东西；满 4 件就把左端门洞里的 dsCameo 放出来。
 * 只动 flag 与一条 toast：不打开对话，也不推进当前对话。
 * 第二次及以后的同一件东西不计数（_again 的重复触发不算「看过」）。
 */
function noteTrainLook(id: string): void {
  if (!TRAIN_LOOKS.includes(id)) return
  if (hasFlag('dsOpen') || hasFlag('dsGone')) return
  const key = 'dsLooked_' + id
  if (hasFlag(key)) return
  setFlag(key, true)
  let n = 0
  for (const k of TRAIN_LOOKS) if (hasFlag('dsLooked_' + k)) n++
  setFlag('dsCount', n)
  if (n >= CAMEO_LOOKS) {
    setFlag('dsOpen', true)
    addToast('（车厢尽头好像多了点什么。）', 'info')
  }
}

/**
 * 列车主线任务：只有这 4 件算（npc_* / cat / 装饰物都不算）。
 * 全部做完 → engine.ts 的 updateTrainSequence 开演到站流程；
 * 单件完成时给一条「记下了」的 toast，玩家自己数得到进度。
 *
 * 车厢尽头没有钟的实体（arriveTrain 里只提了一句「钟停在四点十七分」），
 * 所以第四件用「车头方向的煤烟味」（trainSmoke）代替：
 * 它就在车厢左端、车头那一侧，是这条线上最靠「尽头」的一件。
 */
const TRAIN_TASKS: Record<string, string> = {
  talkEmmaTrain: 'taskEmma',    // 与艾玛交谈
  trainWindow: 'taskWindow',    // 看车窗
  trainFrost: 'taskWindow',     // 车窗上的霜（同一个窗户）
  trainRack: 'taskLuggage',     // 看行李架
  trainSmoke: 'taskClock',      // 车厢尽头的煤烟味
}

/** 四件主线任务的 flag（顺序即提示里的编号顺序） */
const TRAIN_TASK_FLAGS = ['taskEmma', 'taskWindow', 'taskLuggage', 'taskClock'] as const

/** 四件都做完了吗（engine 用它决定要不要开演到站） */
export function trainTasksCleared(): boolean {
  return TRAIN_TASK_FLAGS.every(f => hasFlag(f))
}

/** 记一件主线任务；重复调查不算，完成了给一条进度 toast */
function noteTrainTask(id: string): void {
  const flag = TRAIN_TASKS[id]
  if (!flag || hasFlag(flag)) return
  setFlag(flag, true)
  let n = 0
  for (const f of TRAIN_TASK_FLAGS) if (hasFlag(f)) n++
  if (n >= TRAIN_TASK_FLAGS.length) addToast('（车厢里该看的都看过了。）', 'info')
  else addToast(`（记下了一件事 · ${n}/4）`, 'info')
}

export function handleInteract(id: string): void {
  noteTrainTask(id)
  const firstTime = !hasFlag('seen_' + id)
  const special = SPECIAL[id]
  if (special) {
    special()
    setFlag('seen_' + id, true)
    // 只有第一次调查在这个交互点上算「看过」；再来一次只给 _again 的短回应。
    if (firstTime) noteTrainLook(id)
    return
  }
  if (SCRIPTS[id]) {
    speak(id)
    setFlag('seen_' + id, true)
    if (firstTime) noteTrainLook(id)
    return
  }
  // 兜底：避免玩家点了没反应
  addToast('（这里什么也没有。）', 'info')
}
