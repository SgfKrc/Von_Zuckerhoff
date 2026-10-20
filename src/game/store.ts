// ============================================================
// 全局状态 + 对话解释器 + 存档 + 成就
// 数据驱动：剧本在 data/script.ts，效果在 types.ts 的 Effect
// ============================================================
import { create } from './tinyStore'
import { bridge } from './bridge'
import { SCRIPTS } from './data/script'
import { ACHIEVEMENTS } from './data/achievements'
import { CHAPTERS, chapter } from './data/chapters'
import { ITEMS, isItemId } from './data/items'
import type { ItemId } from './data/items'
import { Snd } from './audio'
import type {
  ChapterId, DialogChoice, Dir, Effect, EndingId, GameMode, MapId,
  RunMeta, SaveData, SaveFileData, SaveSlotSummary, SpeakerId, Step, Traces, Achievement,
} from './types'

const KEY_SAVE = 'vz.save.slot'
const KEY_AUTO = 'vz.save.auto'
const KEY_META = 'vz.meta'
const KEY_ACH = 'vz.achievements'

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'warn' | 'sugar' | 'conviction'
}

interface DialogState {
  scriptId: string
  /** 下一条要执行的 step 下标 */
  i: number
  line: { sp: SpeakerId; text: string } | null
  choices: DialogChoice[] | null
}

export interface GameState {
  mode: GameMode
  chapter: ChapterId
  conviction: number
  sweetness: number
  sugar: number
  ink: number
  flags: Record<string, boolean | number>
  traces: Traces
  blueprint: boolean
  dialog: DialogState | null
  toasts: Toast[]
  achievements: string[]
  ending: EndingId | null
  playSeconds: number
  chapterCard: { num: string; name: string; quote: string } | null
  /** 补图已成功次数（切片只有 1 次） */
  repairsDone: number
  repairErrors: number
  /** 非对话的全屏模态（补图等），非空时冻结世界 */
  modal: string | null
  /** 背包内容（去重、按取得顺序） */
  inventory: ItemId[]
  /** 背包界面是否打开（打开时同时把 modal 设成 'inventory' 冻结世界） */
  inventoryOpen: boolean
  /** 打开背包时要预先选中的物品（HUD 点糖数字用）；仅 UI 态，不进存档 */
  inventoryPick: ItemId | null
}

let toastSeq = 0
/** 打开对话后的短暂冷却：吞掉触发对话的那一次按键 */
let dialogCooldownUntil = 0

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function freshTraces(): Traces {
  return { sugar: 0, vision: 0, rude: 0, forgot: [], chaptersDone: [] }
}

function initialFlags(): Record<string, boolean | number> {
  return {
    introStarted: true,
    tutMove: true,
  }
}

export const useGame = create<GameState>((set, get) => ({
  mode: 'title',
  chapter: 0,
  conviction: 72,
  sweetness: 0,
  sugar: 3,
  ink: 8,
  flags: initialFlags(),
  traces: freshTraces(),
  blueprint: false,
  dialog: null,
  toasts: [],
  achievements: loadAchievements(),
  ending: null,
  playSeconds: 0,
  chapterCard: null,
  repairsDone: 0,
  repairErrors: 0,
  modal: null,
  inventory: [],
  inventoryOpen: false,
  inventoryPick: null,
}))

// ---------------- 基础工具 ----------------

export function hasFlag(k: string): boolean {
  return !!useGame.getState().flags[k]
}

export function setFlag(k: string, v: boolean | number): void {
  useGame.setState(s => ({ flags: { ...s.flags, [k]: v } }))
}

export function addToast(text: string, kind: Toast['kind'] = 'info'): void {
  const id = ++toastSeq
  useGame.setState(s => ({ toasts: [...s.toasts, { id, text, kind }] }))
  // 每条 toast 自己定时移除。
  // （原来是共享一个 timer：新 toast 会清掉旧 timer，旧 toast 就永远留在屏幕上。
  //   背包连续入包时会一眼看出来，所以改成逐条计时。）
  window.setTimeout(() => {
    useGame.setState(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
  }, 2600)
}

export function changeConviction(delta: number): void {
  const s = useGame.getState()
  const next = clamp(s.conviction + delta, 0, 100)
  useGame.setState({ conviction: next })
  if (delta < 0) {
    addToast(`确信 ${delta}`, 'conviction')
  } else if (delta > 0) {
    addToast(`确信 +${delta}`, 'conviction')
  }
  if (next <= 0 && s.mode !== 'ending') {
    endGame('foundling')
  }
}

export function eatSugar(): void {
  const s = useGame.getState()
  if (s.sugar <= 0) { addToast('糖罐空了。', 'warn'); return }
  useGame.setState({
    sugar: s.sugar - 1,
    sweetness: clamp(s.sweetness + 15, 0, 100),
    traces: { ...s.traces, sugar: s.traces.sugar + 1 },
  })
  addToast('糖在舌下化了。老式白糖的味道。', 'sugar')
  unlockAch('firstSugar')
}

// ---------------- 背包 ----------------

/**
 * 把物品收进背包（去重）。返回是否真的新入包。
 * 已拥有时静默返回，避免重复调查刷 toast。
 */
export function addItem(id: ItemId): boolean {
  const def = ITEMS[id]
  if (!def) return false
  const s = useGame.getState()
  if (s.inventory.includes(id)) return false
  useGame.setState({ inventory: [...s.inventory, id] })
  addToast(`收进背包 · ${def.name}`, 'info')
  unlockAch('firstItem')
  return true
}

/** 从背包移除（不在包里时什么也不做） */
export function removeItem(id: ItemId): void {
  const s = useGame.getState()
  if (!s.inventory.includes(id)) return
  useGame.setState({ inventory: s.inventory.filter(x => x !== id) })
}

/**
 * 使用背包里的物品。
 * - 糖：走 eatSugar()，糖罐 -1、甜度 +15、账本 +1（物品本身不消耗：那是那一包糖）
 * - 墨水：本切片只查看剩余量（真正补图在 BlueprintRepair 里）
 * - 其余物品不可使用
 */
export function useItem(id: ItemId): void {
  const s = useGame.getState()
  const def = ITEMS[id]
  if (!def) return
  if (!s.inventory.includes(id)) { addToast('背包里没有这件东西。', 'warn'); return }
  if (!def.usable) { addToast('这件东西不能这样用。', 'warn'); return }
  if (id === 'sugar') { eatSugar(); return }
  if (id === 'ink') {
    addToast(`墨水瓶里还剩 ${s.ink} 格。补图时一格一格地用。`, 'info')
    return
  }
  if (def.useText) addToast(def.useText, 'info')
}

/** 打开背包（可指定预选物品）。对话中 / 别的模态开着 / 非探索模式时不开 */
export function openInventory(pick: ItemId | null = null): void {
  const s = useGame.getState()
  if (s.mode !== 'explore') return
  if (s.dialog) return
  if (s.modal && s.modal !== 'inventory') return
  // modal = 'inventory'：engine.ts 的 uiOpen 会因此冻结世界（不需要改 engine）
  useGame.setState({ inventoryOpen: true, inventoryPick: pick, modal: 'inventory' })
}

/** I 键：开 / 关背包 */
export function toggleInventory(): void {
  const s = useGame.getState()
  if (s.inventoryOpen) {
    useGame.setState({
      inventoryOpen: false,
      inventoryPick: null,
      modal: s.modal === 'inventory' ? null : s.modal,
    })
    return
  }
  openInventory()
}

export function toggleBlueprint(): void {
  const s = useGame.getState()
  if (s.mode !== 'explore') return
  const on = !s.blueprint
  useGame.setState({ blueprint: on })
  if (on) {
    changeConviction(-2)
    unlockAch('firstBlueprint')
  }
}

export function setBlueprint(on: boolean): void {
  useGame.setState({ blueprint: on })
}

export function setModal(m: string | null): void {
  useGame.setState({ modal: m })
}

// ---------------- 成就 ----------------

function loadAchievements(): string[] {
  try {
    const raw = localStorage.getItem(KEY_ACH)
    if (!raw) return []
    const arr = JSON.parse(raw) as string[]
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

export function unlockAch(id: string): void {
  const s = useGame.getState()
  if (s.achievements.includes(id)) return
  const def = ACHIEVEMENTS.find(a => a.id === id)
  if (!def) return
  const next = [...s.achievements, id]
  useGame.setState({ achievements: next })
  try { localStorage.setItem(KEY_ACH, JSON.stringify(next)) } catch { /* ignore */ }
  addToast(`成就 · ${def.name}`, 'info')
}

export function achievementList(): Achievement[] {
  return ACHIEVEMENTS
}

// ---------------- 对话解释器 ----------------

export function startScript(id: string): void {
  dialogCooldownUntil = performance.now() + 220
  exec(id, 0)
}

function setLine(sp: SpeakerId, text: string, scriptId: string, i: number): void {
  useGame.setState({ dialog: { scriptId, i, line: { sp, text }, choices: null } })
}

function setChoices(opts: DialogChoice[], scriptId: string, i: number): void {
  useGame.setState({ dialog: { scriptId, i, line: null, choices: opts } })
}

/** 从脚本的第 i 条开始执行，直到遇到 line / choice / 结束 */
function exec(scriptId: string, startIdx: number): void {
  const queue = SCRIPTS[scriptId]
  if (!queue) {
    useGame.setState({ dialog: null })
    return
  }
  let i = startIdx
  let guard = 0
  while (i < queue.length) {
    if (++guard > 2000) { useGame.setState({ dialog: null }); return }
    const st: Step = queue[i]
    i++
    if (st.t === 'do') {
      const jump = applyEffects(st.do)
      if (jump) { exec(jump, 0); return }
      continue
    }
    if (st.t === 'line') {
      setLine(st.sp ?? 'none', st.text, scriptId, i)
      return
    }
    if (st.t === 'choice') {
      const g = useGame.getState()
      const opts = st.opts.filter(o =>
        (!o.requires || !!g.flags[o.requires]) &&
        (!o.hides || !g.flags[o.hides]))
      if (opts.length === 0) continue
      setChoices(opts, scriptId, i)
      return
    }
  }
  useGame.setState({ dialog: null })
}

/** 玩家推进对话（line 状态下） */
export function advance(): void {
  if (performance.now() < dialogCooldownUntil) return
  const d = useGame.getState().dialog
  if (!d) return
  if (d.choices) return
  exec(d.scriptId, d.i)
}

/** 玩家选择（choice 状态下） */
export function choose(index: number): void {
  if (performance.now() < dialogCooldownUntil) return
  const d = useGame.getState().dialog
  if (!d || !d.choices) return
  const opt = d.choices[index]
  if (!opt) return
  useGame.setState({ dialog: { ...d, choices: null } })
  let jump: string | null = null
  if (opt.do) jump = applyEffects(opt.do)
  if (jump) { exec(jump, 0); return }
  if (opt.next) { exec(opt.next, 0); return }
  exec(d.scriptId, d.i)
}

/** 应用一组效果；返回需要跳转的脚本 id（如果有） */
function applyEffects(effects: Effect[]): string | null {
  let jump: string | null = null
  for (const e of effects) {
    if (typeof e.conviction === 'number') changeConviction(e.conviction)
    if (typeof e.sugar === 'number') {
      useGame.setState(s => ({ sugar: clamp(s.sugar + e.sugar!, 0, 9) }))
    }
    if (typeof e.ink === 'number') {
      useGame.setState(s => ({ ink: clamp(s.ink + e.ink!, 0, 20) }))
    }
    if (typeof e.sweetness === 'number') {
      useGame.setState(s => ({ sweetness: clamp(s.sweetness + e.sweetness!, 0, 100) }))
    }
    if (e.flag) setFlag(e.flag[0], e.flag[1])
    // 背包增减：数量 >0 入包（去重），<0 出包
    if (e.item) {
      const [itemId, n] = e.item
      if (n > 0) addItem(itemId)
      else if (n < 0) removeItem(itemId)
    }
    if (e.next) jump = e.next
    if (e.teleport) bridge.teleport(e.teleport.map, e.teleport.x, e.teleport.y, e.teleport.dir)
    if (e.chapter) {
      useGame.setState({ mode: 'chapter', chapterCard: e.chapter, dialog: null })
    }
    if (e.ending) endGame(e.ending)
    if (e.achievement) unlockAch(e.achievement)
    if (e.toast) addToast(e.toast, e.toastKind ?? 'info')
    if (typeof e.shake === 'number') bridge.shake(e.shake)
    if (e.sound) playSfx(e.sound)
    if (e.blueprint === 'open') setBlueprint(true)
    if (e.blueprint === 'close') setBlueprint(false)
    if (e.blueprint === 'toggle') toggleBlueprint()
  }
  return jump
}

// ---------------- 音效（转发到 audio.ts） ----------------

export function playSfx(name: string): void {
  Snd.sfx(name)
}
// ---------------- 章节与结局 ----------------

export function showChapterCard(no: ChapterId): void {
  const c = chapter(no)
  useGame.setState({
    chapter: no,
    mode: 'chapter',
    chapterCard: { num: c.num, name: c.name, quote: c.quote },
    dialog: null,
  })
}

export function beginExplore(): void {
  const g = useGame.getState()
  if (g.chapter === 1) {
    setFlag('ch1_started', true)
    unlockAch('ch1')
  } else {
    unlockAch('ch0')
  }
  useGame.setState({ mode: 'explore', chapterCard: null })
}

export function finishChapter(no: ChapterId): void {
  const s = useGame.getState()
  if (!s.traces.chaptersDone.includes(no)) {
    useGame.setState({ traces: { ...s.traces, chaptersDone: [...s.traces.chaptersDone, no] } })
  }
}

export function endGame(id: EndingId): void {
  const s = useGame.getState()
  useGame.setState({
    mode: 'ending',
    ending: id,
    dialog: null,
    // 结局演出接管画面：背包不再保持打开
    inventoryOpen: false,
    inventoryPick: null,
    modal: s.modal === 'inventory' ? null : s.modal,
  })
  const meta = loadMeta()
  meta.completedRuns += 1
  meta.endingHistory.push({ ending: id, at: new Date().toISOString(), run: meta.completedRuns })
  meta.unlockedInner = true
  saveMeta(meta)
}

// ---------------- 存档 ----------------

function currentSaveData(): SaveData {
  const s = useGame.getState()
  const pos = bridge.getPos()
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    chapter: s.chapter,
    map: pos.map,
    x: pos.x,
    y: pos.y,
    dir: 'down',
    conviction: s.conviction,
    sweetness: s.sweetness,
    sugar: s.sugar,
    ink: s.ink,
    flags: { ...s.flags },
    traces: { ...s.traces },
    revisionsApplied: [],
    playSeconds: s.playSeconds,
    inventory: [...s.inventory],
  }
}

function applySaveData(d: SaveData): void {
  // 旧档没有 inventory 字段：按空数组处理；顺便滤掉不认识的和重复的 id
  const inv: ItemId[] = Array.isArray(d.inventory)
    ? Array.from(new Set(d.inventory.filter(isItemId)))
    : []
  useGame.setState({
    mode: 'explore',
    chapter: d.chapter,
    conviction: d.conviction,
    sweetness: d.sweetness,
    sugar: d.sugar,
    ink: d.ink,
    flags: { ...d.flags },
    traces: { ...d.traces },
    dialog: null,
    blueprint: false,
    ending: null,
    chapterCard: null,
    playSeconds: d.playSeconds ?? 0,
    inventory: inv,
    inventoryOpen: false,
    inventoryPick: null,
    modal: null,
  })
  bridge.teleport(d.map, d.x, d.y, d.dir)
}

export function saveTo(slot: number): boolean {
  try {
    localStorage.setItem(KEY_SAVE + slot, JSON.stringify(currentSaveData()))
    addToast(`已存档 · 槽 ${slot + 1}`, 'info')
    return true
  } catch { addToast('存档失败（存储空间不足？）', 'warn'); return false }
}

export function loadFrom(slot: number): boolean {
  try {
    const raw = localStorage.getItem(KEY_SAVE + slot)
    if (!raw) { addToast('这个槽是空的。', 'warn'); return false }
    const d = JSON.parse(raw) as SaveData
    applySaveData(d)
    addToast(`已读取 · 槽 ${slot + 1}`, 'info')
    return true
  } catch { addToast('存档已损坏。', 'warn'); return false }
}

export function autoSave(): void {
  try { localStorage.setItem(KEY_AUTO, JSON.stringify(currentSaveData())) } catch { /* ignore */ }
}

export function loadAuto(): boolean {
  try {
    const raw = localStorage.getItem(KEY_AUTO)
    if (!raw) { addToast('没有自动存档。', 'warn'); return false }
    applySaveData(JSON.parse(raw) as SaveData)
    return true
  } catch { return false }
}

export function deleteSlot(slot: number): void {
  try { localStorage.removeItem(KEY_SAVE + slot) } catch { /* ignore */ }
}

export function listSaves(): SaveSlotSummary[] {
  const out: SaveSlotSummary[] = []
  for (let i = 0; i < 8; i++) {
    try {
      const raw = localStorage.getItem(KEY_SAVE + i)
      if (!raw) {
        out.push({ slot: i, savedAt: '', chapter: 0, map: 'train', conviction: 0, sugar: 0 })
        continue
      }
      const d = JSON.parse(raw) as SaveData
      out.push({
        slot: i, savedAt: d.savedAt, chapter: d.chapter, map: d.map,
        conviction: d.conviction, sugar: d.sugar,
      })
    } catch {
      out.push({ slot: i, savedAt: '', chapter: 0, map: 'train', conviction: 0, sugar: 0 })
    }
  }
  return out
}

function loadMeta(): RunMeta {
  try {
    const raw = localStorage.getItem(KEY_META)
    if (raw) {
      const m = JSON.parse(raw) as RunMeta
      if (m && typeof m.completedRuns === 'number') return m
    }
  } catch { /* ignore */ }
  return { version: 2, completedRuns: 0, endingHistory: [], unlockedInner: false, achievements: [] }
}

function saveMeta(m: RunMeta): void {
  try { localStorage.setItem(KEY_META, JSON.stringify(m)) } catch { /* ignore */ }
}

export function getMeta(): RunMeta {
  return loadMeta()
}

export function exportSaveText(): string {
  const data: SaveFileData = {
    format: 'von-zuckerhoff-save',
    version: 2,
    savedAt: new Date().toISOString(),
    game: currentSaveData(),
    meta: loadMeta(),
  }
  return JSON.stringify(data, null, 2)
}

export function importSaveText(text: string): boolean {
  try {
    const d = JSON.parse(text) as SaveFileData
    if (d.format !== 'von-zuckerhoff-save' || !d.game) { addToast('不是本作的存档。', 'warn'); return false }
    applySaveData(d.game)
    if (d.meta) saveMeta(d.meta)
    addToast('存档已导入。', 'info')
    return true
  } catch { addToast('导入失败：JSON 解析错误。', 'warn'); return false }
}

// ---------------- 新游戏 / 标题 ----------------

/**
 * 随身物：开局就带在身上的三件。
 * 糖罐与墨水瓶在 HUD 上是数字，它们的「物品形态」放在背包里，
 * 这样打开背包就能查看 / 吃糖 / 看墨水余量（验收要求背包里的糖能用）。
 * 信、胸针、线图也在背包里：它们本来就在身上，不作为场景里的独立交互点。
 */
const STARTING_ITEMS: ItemId[] = ['sugar', 'ink', 'watch', 'letter', 'brooch', 'luggage']

export function newGame(): void {
  useGame.setState({
    mode: 'opening',
    chapter: 0,
    conviction: 72,
    sweetness: 0,
    sugar: 3,
    ink: 8,
    flags: initialFlags(),
    traces: freshTraces(),
    dialog: null,
    blueprint: false,
    ending: null,
    chapterCard: null,
    playSeconds: 0,
    repairsDone: 0,
    repairErrors: 0,
    modal: null,
    inventory: [...STARTING_ITEMS],
    inventoryOpen: false,
    inventoryPick: null,
  })
}

/** 开场分镜放完：进车厢，站在过道靠右的位置 */
export function finishOpening(): void {
  if (useGame.getState().mode !== 'opening') return
  useGame.setState({ mode: 'explore' })
  bridge.teleport('train', 2, 4, 'right')
}

export function toTitle(): void {
  const s = useGame.getState()
  useGame.setState({
    mode: 'title',
    dialog: null,
    ending: null,
    chapterCard: null,
    inventoryOpen: false,
    inventoryPick: null,
    modal: s.modal === 'inventory' ? null : s.modal,
  })
}

export function addPlayTime(dt: number): void {
  const s = useGame.getState()
  if (s.mode === 'explore') {
    useGame.setState({ playSeconds: s.playSeconds + dt })
  }
}

export { CHAPTERS }
