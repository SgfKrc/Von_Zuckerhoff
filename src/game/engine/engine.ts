// ============================================================
// 主循环：移动、碰撞、交互、传送、相机、图纸模式
// ============================================================
import { MAPS } from '../world/maps'
import { SOLID_TILES } from '../art/tiles'
import { TILE } from '../art/build'
import type { Dir, EntityDef, GameMap, MapId } from '../types'
import { Input } from './input'
import { useGame, addPlayTime, changeConviction, setBlueprint, toggleBlueprint, addToast } from '../store'
import { bridge } from '../bridge'
import { handleInteract, onEnterMap } from '../world/events'
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
  const pts: [number, number][] = [
    [x - 5, y - 3], [x + 5, y - 3],
    [x - 5, y + 2], [x + 5, y + 2],
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
  const reach = 18
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
    const d = Math.min(d1, d2 * 2.2)
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
