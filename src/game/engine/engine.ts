// ============================================================
// 主循环：移动、碰撞、交互、传送、相机、图纸模式
// ============================================================
import { MAPS } from '../world/maps'
import { SOLID_TILES } from '../art/tiles'
import { TILE } from '../art/build'
import type { Dir, EntityDef, GameMap, MapId } from '../types'
import { Input } from './input'
import {
  useGame, addPlayTime, changeConviction, setBlueprint, toggleBlueprint, addToast,
  hasFlag, setFlag, startScript,
} from '../store'
import { bridge } from '../bridge'
import { handleInteract, onEnterMap, trainTasksCleared } from '../world/events'
import { Snd, sceneForMap } from '../audio'
import { drawScene } from '../render/renderer'

import { VIEW_W, VIEW_H } from '../constants'
export { VIEW_W, VIEW_H }

export interface FogP { x: number; y: number; spd: number; a: number; r: number }

export interface World {
  map: GameMap
  px: number
  py: number
  dir: Dir
  moving: boolean
  animT: number
  camX: number
  camY: number
  shakeT: number
  /** 行进抖动相位（秒，确定性叠加正弦，不逐帧随机） */
  rumbleT: number
  /** 行进抖动幅度倍率 0..1：行驶中 1，到站后 0.6 秒内衰减到 0 */
  rumbleAmp: number
  /** 画面淡出：0 = 正常，1 = 全黑（到站演出用，renderer 最后叠一层黑） */
  fade: number
  /** 列车广播字幕：剩余秒数（<=0 不显示） */
  broadcastT: number
  /** 列车广播字幕：总时长（用来算淡入淡出） */
  broadcastDur: number
  /** 列车广播字幕文本 */
  broadcastText: string
  /** 章标题卡：剩余秒数（<=0 不显示），和广播牌一样由 renderer 画在画布上 */
  titleCardT: number
  /** 章标题卡：总时长（用来算淡入 / 停留 / 淡出） */
  titleCardDur: number
  fog: FogP[]
  t: number
  /** 累计秒，用于确信/甜度节流 */
  clock: number
  blueprintTick: number
  interactTarget: { ent: EntityDef; sx: number; sy: number } | null
}

export const world: World = {
  map: MAPS.train,
  px: 3 * TILE + 8,
  py: 6 * TILE + 12,
  dir: 'right',
  moving: false,
  animT: 0,
  camX: 0,
  camY: 0,
  shakeT: 0,
  rumbleT: 0,
  rumbleAmp: 0,
  fade: 0,
  broadcastT: 0,
  broadcastDur: 0,
  broadcastText: '',
  titleCardT: 0,
  titleCardDur: 0,
  fog: [],
  t: 0,
  clock: 0,
  blueprintTick: 0,
  interactTarget: null,
}

function seedFog(): void {
  world.fog = []
  const n = world.map.ambient === 'indoor' ? 5 : 16
  const w = world.map.tiles[0].length * TILE
  const h = world.map.tiles.length * TILE
  for (let i = 0; i < n; i++) {
    world.fog.push({
      x: Math.random() * w,
      y: Math.random() * h,
      spd: 0.08 + Math.random() * 0.25,
      a: 0.05 + Math.random() * 0.12,
      r: 24 + Math.random() * 46,
    })
  }
}

function syncCamera(): void {
  const mw = world.map.tiles[0].length * TILE
  const mh = world.map.tiles.length * TILE
  world.camX = mw <= VIEW_W ? (mw - VIEW_W) / 2 : Math.max(0, Math.min(mw - VIEW_W, world.px - VIEW_W / 2))
  const biasY = world.map.camBiasY ?? 0
  world.camY = mh <= VIEW_H ? (mh - VIEW_H) / 2 : Math.max(0, Math.min(mh - VIEW_H, world.py - VIEW_H / 2 + biasY))
}

// ---- bridge 实装 ----
bridge.getPos = () => ({
  map: world.map.id,
  x: Math.round((world.px - 8) / TILE),
  y: Math.round((world.py - 12) / TILE),
})

let teleportToken = 0
let enterMapTimer: number | null = null
let portalCooldown = 0

bridge.teleport = (map: MapId, x: number, y: number, dir?: Dir) => {
  const token = ++teleportToken
  const target = MAPS[map]
  if (!target) return
  world.map = target
  world.px = x * TILE + 8
  world.py = y * TILE + 12
  if (dir) world.dir = dir
  world.moving = false
  world.interactTarget = null
  portalCooldown = 16
  // 换图 / 读档：把上一段演出留下的淡出、抖动与广播字幕清干净，
  // 免得在任何一张图上卡着一层黑或一条不属于它的广播。
  world.fade = 0
  world.rumbleAmp = 0
  world.broadcastT = 0
  world.titleCardT = 0
  trainPhase = 'idle'
  trainPhaseT = 0
  Input.flush()
  seedFog()
  syncCamera()
  // 等章节卡与对话结束后再触发入场脚本
  const attempt = (): void => {
    if (token !== teleportToken) return
    const g = useGame.getState()
    if (g.mode !== 'explore' || g.dialog || g.chapterCard) {
      enterMapTimer = window.setTimeout(attempt, 40)
      return
    }
    enterMapTimer = null
    onEnterMap(map)
  }
  if (enterMapTimer != null) window.clearTimeout(enterMapTimer)
  enterMapTimer = window.setTimeout(attempt, 30)
}

bridge.shake = (frames: number) => { world.shakeT = Math.max(world.shakeT, frames) }

// ============================================================
// 列车：行进抖动 + 到站任务演出
// ============================================================
//
// 抖动与震屏是两套东西：
//   world.shakeT  剧情震屏 —— 帧计数、随机、±1.5px；
//   world.rumble* 行进抖动 —— 秒计数、确定性正弦、±1px、到站后 0.6s 衰减。
// 两者都只进相机偏移（renderer 的 ox / oy），绝不进 world.px / world.py：
// 碰撞、传送门、交互距离全都读世界坐标，抖进去会把人抖进墙里。

/** 玩家在车厢里的座位：emmaSeat（20,2）右边那一格，面朝左正对着她 */
const SEAT_X = 21
const SEAT_Y = 2

/** 淡出到全黑、抖停、再淡入，各段的秒数 */
const FADE_OUT_SEC = 0.9
const RUMBLE_STOP_SEC = 0.6
const FADE_IN_SEC = 0.9
/** 广播字幕在屏幕上满亮的秒数（够读完这一句）；末尾另有一道淡出 */
const BROADCAST_SEC = 5.5
/** 广播字幕的淡出秒数：念完先收掉这条铁牌，再让章标题卡落下来（renderer 用它算包络） */
export const BROADCAST_FADE_SEC = 0.6
/**
 * 章标题卡：淡入 0.7 / 停留 1.8 / 淡出 0.7 = 3.2s，全程压在黑底上。
 * 广播牌收掉之后才起，起的那一刻敲一记很轻的钟（「章」的标点）。
 */
export const TITLE_FADE_IN_SEC = 0.7
export const TITLE_FADE_OUT_SEC = 0.7
const TITLE_HOLD_SEC = 1.8
const TITLE_SEC = TITLE_FADE_IN_SEC + TITLE_HOLD_SEC + TITLE_FADE_OUT_SEC
/** 到站广播词（单条 ≤64 字） */
const STATION_BROADCAST = '本次列车即将到达——糖堡站。'

type TrainPhase = 'idle' | 'fadeOut' | 'settle' | 'title' | 'fadeIn'
let trainPhase: TrainPhase = 'idle'
let trainPhaseT = 0

/**
 * 到站序列。4 件主线交互全部做完（见 events.ts 的 TRAIN_TASKS）之后自动开演：
 *
 *   淡出 0.9s → 全黑时把玩家搬到艾玛对面的座位、放广播字幕 →
 *   抖动 0.6s 内衰减到 0（车停稳）→ 广播念完再淡出 0.6s →
 *   章标题卡 3.2s（黑底上淡入 / 停留 / 淡出，一记轻钟）→
 *   淡入 0.9s → 艾玛自动开口（trainArrivalEmma）。
 *
 * 标题卡是这一段的落点：广播只说「到哪儿了」，章标题说的是「这是第几章」。
 * 只演一次：flag `trainArrived` 守卫，读档重进列车不会再演一遍。
 * 玩家正在对话 / 图纸 / 背包 / 章节卡里时不动，等它们关掉再开演。
 * 返回 true 表示本帧由演出接管，玩家操作被冻结（只冻结输入，不动相机坐标）。
 */
function updateTrainSequence(dt: number): boolean {
  // 广播牌与章标题卡的计时与 UI 无关：对话里也在走。
  if (world.broadcastT > 0) world.broadcastT = Math.max(0, world.broadcastT - dt)
  if (world.titleCardT > 0) world.titleCardT = Math.max(0, world.titleCardT - dt)

  if (trainPhase === 'idle') {
    const riding = world.map.id === 'train' && !hasFlag('trainArrived')
    if (!riding) {
      world.rumbleAmp = 0
      return false
    }
    // 行驶中：幅度拉满，相位继续走
    world.rumbleT += dt
    world.rumbleAmp = 1

    const g = useGame.getState()
    // 对话 / 图纸 / 背包 / 章节卡 / 非探索模式：等它们关掉再演
    const busy = g.mode !== 'explore' || !!g.dialog || !!g.chapterCard || !!g.modal || g.blueprint
    if (busy || !trainTasksCleared()) return false

    trainPhase = 'fadeOut'
    trainPhaseT = 0
    Input.flush()
    return true
  }

  trainPhaseT += dt

  if (trainPhase === 'fadeOut') {
    world.rumbleT += dt
    world.rumbleAmp = 1
    world.fade = Math.min(1, trainPhaseT / FADE_OUT_SEC)
    if (trainPhaseT >= FADE_OUT_SEC) {
      world.fade = 1
      // 全黑：到站了。先落 flag，抖动从此不再重新起。
      setFlag('trainArrived', true)
      world.px = SEAT_X * TILE + 8
      world.py = SEAT_Y * TILE + 12
      world.dir = 'left'          // 对着艾玛
      world.moving = false
      world.interactTarget = null
      portalCooldown = 16
      syncCamera()
      // 广播
      world.broadcastText = STATION_BROADCAST
      world.broadcastDur = BROADCAST_SEC + BROADCAST_FADE_SEC
      world.broadcastT = BROADCAST_SEC + BROADCAST_FADE_SEC
      Snd.sfx('bell')
      trainPhase = 'settle'
      trainPhaseT = 0
    }
    return true
  }

  if (trainPhase === 'settle') {
    // 全黑里衰减：0.6 秒从满幅减到 0，不硬切
    world.rumbleT += dt
    world.rumbleAmp = Math.max(0, 1 - trainPhaseT / RUMBLE_STOP_SEC)
    if (trainPhaseT >= RUMBLE_STOP_SEC) world.rumbleAmp = 0
    // 车早就停稳了，这里等的是「广播念完 + 收掉」：黑场一直撑到牌子淡出为止
    if (world.broadcastT <= 0) {
      world.broadcastT = 0
      world.titleCardDur = TITLE_SEC
      world.titleCardT = TITLE_SEC
      Snd.sfx('bell')            // 「章」的标点：很轻的一记钟，压在黑底上
      trainPhase = 'title'
      trainPhaseT = 0
    }
    return true
  }

  if (trainPhase === 'title') {
    // 章标题卡整段都在黑底上淡入淡出，画面不做任何别的变化 ——
    // 连淡出层都不用动：world.fade 还停在 1。
    world.rumbleAmp = 0
    if (trainPhaseT >= TITLE_SEC) {
      trainPhase = 'fadeIn'
      trainPhaseT = 0
    }
    return true
  }

  // fadeIn：车已经停稳，抖幅为 0，画面淡回来
  world.rumbleAmp = 0
  world.fade = Math.max(0, 1 - trainPhaseT / FADE_IN_SEC)
  if (trainPhaseT >= FADE_IN_SEC) {
    world.fade = 0
    trainPhase = 'idle'
    trainPhaseT = 0
    // 艾玛自动开口（不需要玩家按 E），最后一句落 canDisembark
    startScript('trainArrivalEmma')
  }
  return true
}

// ---- 碰撞 ----
function solidAt(x: number, y: number): boolean {
  const tx = Math.floor(x / TILE)
  const ty = Math.floor(y / TILE)
  const row = world.map.tiles[ty]
  if (!row) return true
  const ch = row[tx]
  if (ch === undefined) return true
  return SOLID_TILES.has(ch)
}

const WIDE: Record<string, number> = {
  portrait: 2, bigPainting: 2, bed: 2, fireplace: 2, table: 2,
  piano: 2, bookshelfWall: 2, graveRow: 2, gearBig: 2,
  // 两格宽的装饰：推车 / 长椅 / 倒木是 48×16 的宽画（内容占 32px），旗是 32×40。
  // 别按画布宽（48）算 —— 内容只占两格，碰撞盒与调查中心点都该是两格。
  cart: 2, bench: 2, fallenTrunk: 2, banner: 2,
}

export function entTileW(sprite: string): number {
  return WIDE[sprite] ?? 1
}

function entitySolidAt(x: number, y: number): boolean {
  for (const e of visibleEntities()) {
    if (!e.solid) continue
    const w = entTileW(e.sprite) * TILE
    const ex = e.x * TILE
    const ey = e.y * TILE
    if (x >= ex + 1 && x < ex + w - 1 && y >= ey + 2 && y < ey + TILE) return true
  }
  return false
}

function blocked(x: number, y: number): boolean {
  // 24×32 的精灵宽了 8px：脚部碰撞盒同步加宽到 14×6（x±7）。
  // 高度仍然是 y-3 / y+2 —— 脚部方框不该跟着长高，否则进门洞会卡。
  const pts: [number, number][] = [
    [x - 7, y - 3], [x + 7, y - 3],
    [x - 7, y + 2], [x + 7, y + 2],
  ]
  return pts.some(([ax, ay]) => solidAt(ax, ay) || entitySolidAt(ax, ay))
}

function stuck(): boolean {
  return blocked(world.px, world.py)
}

const _visible: EntityDef[] = []
export function visibleEntities(target: EntityDef[] = _visible): EntityDef[] {
  const g = useGame.getState()
  target.length = 0
  for (const e of world.map.entities) {
    if (e.hideFlag && g.flags[e.hideFlag]) continue
    if (e.showFlag && !g.flags[e.showFlag]) continue
    if (e.blueprintOnly && !g.blueprint) continue
    target.push(e)
  }
  return target
}

function findInteract(): { ent: EntityDef; sx: number; sy: number } | null {
  let fx = world.px
  let fy = world.py
  const reach = 20
  if (world.dir === 'up') fy -= reach
  if (world.dir === 'down') fy += reach
  if (world.dir === 'left') fx -= reach
  if (world.dir === 'right') fx += reach

  let best: { ent: EntityDef; sx: number; sy: number; d: number } | null = null
  for (const e of visibleEntities()) {
    if (!e.interact) continue
    const w = entTileW(e.sprite)
    const cx = e.x * TILE + (w * TILE) / 2
    const cy = e.y * TILE + TILE / 2
    const d1 = Math.hypot(cx - fx, cy - fy)
    const d2 = Math.hypot(cx - world.px, cy - world.py)
    // 取「面朝方向上的距离」优先：只有前方够不着（d1 >= 24）时才退回「脚下的距离」。
    // 原来写的是 min(d1, d2 * 2.2) —— 门槛刻痕铺在门前地面上，
    // 玩家一站上去 d2 就是 0，永远赢过 4px 外的大门（实测要敲两次门才敲到）。
    const d = d1 < 24 ? d1 : d2 * 2.2
    if (d < 24 && (!best || d < best.d)) best = { ent: e, sx: cx, sy: e.y * TILE, d }
  }
  return best ? { ent: best.ent, sx: best.sx, sy: best.sy } : null
}

// ---- 主循环 ----
let rafId = 0
let lastCanvas: HTMLCanvasElement | null = null
let wasUiOpen = false
let engineGeneration = 0
let lastTime = 0

export function startEngine(canvas: HTMLCanvasElement): void {
  const generation = ++engineGeneration
  lastCanvas = canvas
  ;(window as unknown as Record<string, unknown>).__vz = { store: useGame, world, bridge }
  cancelAnimationFrame(rafId)
  seedFog()
  lastTime = performance.now()
  const loop = (now: number): void => {
    if (generation !== engineGeneration || !lastCanvas) return
    rafId = requestAnimationFrame(loop)
    const dt = Math.min(0.1, (now - lastTime) / 1000)
    lastTime = now
    tick(dt)
    const ctx = lastCanvas?.getContext('2d')
    if (ctx) drawScene(ctx)
  }
  rafId = requestAnimationFrame(loop)
}

export function stopEngine(): void {
  engineGeneration++
  cancelAnimationFrame(rafId)
  rafId = 0
  if (enterMapTimer != null) window.clearTimeout(enterMapTimer)
  enterMapTimer = null
  lastCanvas = null
  teleportToken++
}

function tick(dt: number): void {
  world.t++
  world.clock += dt
  if (world.shakeT > 0) world.shakeT--
  if (portalCooldown > 0) portalCooldown--

  const g = useGame.getState()

  // 场景音频（内部去重）
  Snd.setScene(sceneForMap(world.map.id, world.map.ambient))

  // 时间统计
  addPlayTime(dt)

  // 甜度自然衰减：每 120 秒 -1
  if (g.mode === 'explore' && world.clock > 120) {
    world.clock = 0
    if (g.sweetness > 0) useGame.setState({ sweetness: Math.max(0, g.sweetness - 1) })
  }

  // 图纸模式的确信消耗：每 10 秒 -1（进入时已扣 2）
  if (g.mode === 'explore' && g.blueprint) {
    world.blueprintTick = (world.blueprintTick ?? 0) + dt
    if (world.blueprintTick > 10) {
      world.blueprintTick = 0
      changeConviction(-1)
    }
  } else {
    world.blueprintTick = 0
  }

  const uiOpen = !!g.dialog || !!g.chapterCard || !!g.modal

  // 到站演出（列车）：这段由内向外接管画面，只冻结输入。
  // 放在 uiOpen 判定之前 —— 淡出与广播字幕在对话里也要继续走完。
  if (updateTrainSequence(dt)) {
    Input.flush()
    world.moving = false
    syncCamera()
    return
  }

  if (g.mode !== 'explore' || uiOpen) {
    if (uiOpen) {
      wasUiOpen = true
    }
    Input.flush()
    return
  }

  if (wasUiOpen) {
    wasUiOpen = false
    Input.flush()
    world.moving = false
    return
  }

  // Tab：切换图纸
  if (Input.consume('Tab')) {
    toggleBlueprint()
    Input.flush()
    return
  }

  const pE = Input.consume('e')
  const pSpace = Input.consume(' ')
  const pEnter = Input.consume('Enter')
  if (pE || pSpace || pEnter) {
    const target = findInteract()
    if (target?.ent.interact) {
      handleInteract(target.ent.interact)
      Input.flush()
      return
    }
  }

  // 移动
  const ax = Input.axis()
  const speed = g.blueprint ? 0.85 : 1.5
  let dx = ax.x * speed
  let dy = ax.y * speed
  if (dx && dy) { dx *= 0.707; dy *= 0.707 }
  world.moving = !!(dx || dy)
  if (dx < 0) world.dir = 'left'
  else if (dx > 0) world.dir = 'right'
  else if (dy < 0) world.dir = 'up'
  else if (dy > 0) world.dir = 'down'

  const free = stuck()
  if (dx && (free || !blocked(world.px + dx, world.py))) world.px += dx
  if (dy && (free || !blocked(world.px, world.py + dy))) world.py += dy
  if (world.moving) world.animT++

  // 传送门
  if (portalCooldown === 0) {
    const tx = Math.floor(world.px / TILE)
    const ty = Math.floor((world.py + 2) / TILE)
    for (const p of world.map.portals) {
      if (p.x === tx && p.y === ty) {
        if (p.neverOpen || (p.lockFlag && !g.flags[p.lockFlag])) {
          pushBack()
          if (p.lockMsg) addToast(p.lockMsg, 'warn')
          break
        }
        bridge.teleport(p.to, p.tx, p.ty, p.dir)
        break
      }
    }
  }

  syncCamera()

  const mw = world.map.tiles[0].length * TILE
  for (const f of world.fog) {
    f.x += f.spd
    if (f.x - f.r > mw) f.x = -f.r
  }

  world.interactTarget = findInteract()
  Input.flush()
}

function pushBack(): void {
  if (world.dir === 'up') world.py += 4
  if (world.dir === 'down') world.py -= 4
  if (world.dir === 'left') world.px += 4
  if (world.dir === 'right') world.px -= 4
}

export { setBlueprint }
