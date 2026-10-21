// ============================================================
// 场景渲染：瓦片 / 实体 / 角色 / 光照 / 雾 / 图纸层
// ============================================================
import {
  world, entTileW, visibleEntities,
  BROADCAST_FADE_SEC, TITLE_FADE_IN_SEC, TITLE_FADE_OUT_SEC,
} from '../engine/engine'
import { VIEW_W, VIEW_H } from '../constants'
import { TILES, SOLID_TILES, C, STRUCT_SYMBOL } from '../art/tiles'
import { TILE } from '../art/build'
import { useGame } from '../store'
import { SPRITES } from '../art/sprites'
import { drawBackdrop } from './backdrop'
import { drawBridgeBackdrop } from './bridgeBackdrop'
import {
  drawStationBackdrop, drawStationFore, drawRoadBackdrop, drawRoadFore,
  type LampPos,
} from './forestBackdrop'
import type { Dir, EntityDef } from '../types'

const paper = document.createElement('canvas')
paper.width = VIEW_W
paper.height = VIEW_H

/** 煤气灯的位置（每帧复用同一个数组，别在渲染循环里造垃圾） */
const lampPositions: LampPos[] = []

/**
 * 糖堡站那两盏煤气灯的世界坐标（灯头，不是格子中心）。
 * 精灵是 16×32 底对齐，灯头在精灵顶端往下十来像素处 —— 暖光晕要落在那里。
 * 站台上的灯用 gasLamp 精灵；别处的烛台（candelabra）不参与这层暖光。
 */
function stationLamps(): LampPos[] {
  lampPositions.length = 0
  for (const e of world.map.entities) {
    if (e.sprite !== 'gasLamp') continue
    lampPositions.push({ x: e.x * TILE + TILE / 2, y: e.y * TILE + TILE - 24 })
  }
  return lampPositions
}

export function drawScene(ctx: CanvasRenderingContext2D): void {
  const g = useGame.getState()
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, VIEW_W, VIEW_H)
  ctx.fillStyle = C.night
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  // 震屏（剧情）：帧计数 + 随机，幅度大
  let ox = 0
  let oy = 0
  if (world.shakeT > 0) {
    ox = (Math.random() - 0.5) * 3
    oy = (Math.random() - 0.5) * 3
  }

  // 行进抖动（列车）：确定性、±1px、约 10Hz。
  // 只加到下面这两行相机偏移上 —— 绝不进 world.px / world.py，
  // 否则碰撞盒、传送门与交互距离会跟着一起抖。
  const rum = world.rumbleAmp
  if (rum > 0) {
    const t = world.rumbleT
    // 两组不成倍数的正弦叠加：不会读出「每 7 帧抖一次」的机械感，
    // 又不是每帧 Math.random 那种故障噪点。
    const rx = Math.sin(t * 61.0) * 0.74 + Math.sin(t * 27.0 + 1.7) * 0.26
    const ry = Math.sin(t * 73.0 + 2.1) * 0.68 + Math.sin(t * 33.0 + 0.4) * 0.32
    ox += Math.round(rx * rum)
    oy += Math.round(ry * rum)
  }

  const camX = Math.round(world.camX + ox)
  const camY = Math.round(world.camY + oy)
  const mapId = world.map.id

  // 远景放在 translate 之前：用屏幕坐标绘制，自己处理视差，
  // 且必须早于 drawTiles —— 它要垫在瓦片下面。
  // gate 用一张写实图（render/backdrop.ts），bridge 与 station / road 用程序化的多层视差。
  drawBackdrop(ctx, mapId, camX, camY)
  if (mapId === 'bridge') drawBridgeBackdrop(ctx, camX, camY, world.t)
  if (mapId === 'station') drawStationBackdrop(ctx, camX, camY, world.t)
  if (mapId === 'road') drawRoadBackdrop(ctx, camX, camY, world.t)

  // ---------------- 图纸模式 ----------------
  // 一张纸盖掉整个现实层，结构符号与「告示牌」都画在纸上。
  // 顺序是有讲究的：纸必须先铺，图纸专属实体（blueprintOnly）才能压在纸上面被看见；
  // 夜里那套光照 / 雾 / 天光在这里整套跳过 —— 图纸是一张白天的图，不吃暗角。
  if (g.blueprint) {
    drawBlueprint(ctx, camX, camY)
    ctx.save()
    ctx.translate(-camX, -camY)
    drawEntities(ctx, camX, camY)
    ctx.restore()
    drawInteractHint(ctx, camX, camY)
    drawVignette(ctx)
    drawFade(ctx)
    drawChapterTitle(ctx)
    drawBroadcast(ctx)
    return
  }

  ctx.save()
  ctx.translate(-camX, -camY)

  drawTiles(ctx, camX, camY)
  drawEntities(ctx, camX, camY)
  drawPlayer(ctx)

  ctx.restore()

  drawLighting(ctx)
  // gate：镜头朝上的夜空不能被径向暗角压成纯黑，补一层月光天光，
  // 让瓦片下的远景（城堡正面）透出来。
  if (mapId === 'gate') drawSkyLight(ctx)
  drawFog(ctx)
  // 站台 / 山路的天气层：必须压在瓦片之上 —— 雨要落在站台上、灯光要摊在木板上、
  // 雾要在山道上走；画在瓦片下面会被整片地面盖掉。
  if (mapId === 'station') drawStationFore(ctx, camX, camY, world.t, stationLamps())
  if (mapId === 'road') drawRoadFore(ctx, camX, camY, world.t)
  drawInteractHint(ctx, camX, camY)
  drawVignette(ctx)
  // 淡出层在最后：全黑时连暗角一起吃掉。
  // 广播字幕压在淡出层之上 —— 车停稳前那一句要在黑里也能读到。
  drawFade(ctx)
  // 章标题卡压在淡出层之上：到站演出的收尾段，画面已经是全黑，只剩它在淡
  drawChapterTitle(ctx)
  drawBroadcast(ctx)
}

/**
 * 画面淡出：world.fade 0 = 正常，1 = 全黑。
 * 到站演出由 engine.ts 用 tween 推这个数（0.9s 推到 1，再 0.9s 推回 0）。
 */
function drawFade(ctx: CanvasRenderingContext2D): void {
  const f = world.fade
  if (f <= 0) return
  ctx.fillStyle = `rgba(5,6,11,${Math.min(1, f)})`
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
}

/** 字幕字体：画在画布上的中文一律走这一条衬线（canvas 里没有 DOM 的 font-family 继承） */
const SERIF_FONT = '"Songti SC", "SimSun", "Noto Serif SC", serif'

// ---------------- 列车广播字幕 ----------------

/**
 * 列车广播：一条居中横条，深灰底 + 米白字 + 方括号。
 * 与所有 UI 都不同 —— HUD / toast / 对话框都是 DOM，这一条画在画布上，
 * 所以它压得住淡出层，也在图纸模式与对话之上。
 */
function drawBroadcast(ctx: CanvasRenderingContext2D): void {
  const remain = world.broadcastT
  if (remain <= 0 || !world.broadcastText) return
  const dur = Math.max(0.2, world.broadcastDur)
  const age = dur - remain
  // 0.15s 淡入、BROADCAST_FADE_SEC 淡出（和 engine 推的广播时长是同一组数）
  const alpha = Math.max(0, Math.min(1, age / 0.15, remain / BROADCAST_FADE_SEC))
  if (alpha <= 0) return

  const label = `[ ${world.broadcastText} ]`
  const FONT = SERIF_FONT

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `10px ${FONT}`
  const tw = ctx.measureText(label).width
  const w = Math.round(Math.max(196, Math.min(VIEW_W - 24, tw + 40)))
  const h = 26
  const x = Math.round((VIEW_W - w) / 2)
  // 放在画面下半部的过道上：不挡到站后坐回座位的那个位置（座位行在 y≈80）
  const y = 104

  ctx.globalAlpha = alpha
  // 面板：深灰铁牌
  ctx.fillStyle = 'rgba(18,20,25,0.92)'
  ctx.fillRect(x, y, w, h)
  // 上下两道黄铜线 + 两端各一道短竖线 —— 像车厢里挂的铁牌，不是对话框
  ctx.fillStyle = 'rgba(122,106,58,0.95)'
  ctx.fillRect(x, y, w, 1)
  ctx.fillRect(x, y + h - 1, w, 1)
  ctx.fillStyle = 'rgba(111,122,140,0.55)'
  ctx.fillRect(x, y, 1, h)
  ctx.fillRect(x + w - 1, y, 1, h)
  // 两端各一枚黄铜小菱形（广播牌的花头；不用小字，10px 以下的中文会糊）
  ctx.fillStyle = 'rgba(200,160,64,0.85)'
  const dy = y + Math.floor(h / 2)
  ctx.fillRect(x + 8, dy - 1, 1, 2)
  ctx.fillRect(x + 9, dy, 1, 1)
  ctx.fillRect(x + w - 9, dy - 1, 1, 2)
  ctx.fillRect(x + w - 10, dy, 1, 1)
  // 广播词
  ctx.fillStyle = '#f2ece0'
  ctx.font = `10px ${FONT}`
  ctx.fillText(label, VIEW_W / 2, dy + 1)
  ctx.restore()
}

// ---------------- 章标题卡 ----------------

/**
 * 章标题卡：列车停稳、广播收掉之后，在黑底上淡入淡出的一张小卡。
 *
 * 这一章（游戏序章）对应原作的序章 + 第一章 —— 糖堡站 + 糖庄。
 * 「霜」是六月里车窗上结了六个小时的那层霜、也是碑上的霜，开头与结尾都在；
 * 「糖」是糖庄的甜。两个意象并成四个字的章名。
 *
 * 和广播牌一样画在 384×216 的逻辑画布上（不是 DOM）：
 * 因此它天然跟着淡出层一起走，也不需要额外压暗 —— 这一段舞台本来就是全黑的。
 */
const CHAPTER_LABEL = '序章'
const CHAPTER_TITLE = '霜与糖'
const CHAPTER_NOTE = 'PROLOGUE · FROST AND SUGAR'

/** 一行文案：中心 y / 字号 / 字距 / 颜色（canvas 没有 letter-spacing，字距要自己撑） */
interface ChapterLine {
  y: number
  size: number
  gap: number
  color: string
}

/** 三行的垂直节奏：序章（小、宽字距、偏暗）→ 空 8px → 霜与糖（大、衬线、骨白）→ 英文注脚 */
const CH_LABEL_LINE: ChapterLine = { y: 90, size: 14, gap: 6, color: '#8a94a6' }
const CH_TITLE_LINE: ChapterLine = { y: 116, size: 22, gap: 4, color: '#e8e0d0' }
const CH_NOTE_LINE: ChapterLine = { y: 141, size: 10, gap: 1, color: '#6a7280' }

/**
 * 逐字撑开一行，整行以 cx 为轴居中。
 * 逐字落笔而不是用 textAlign='center'：只有自己排版才带得上字距，
 * 宽字距的「序 章」才不会读成一个词。
 */
function paintCenteredSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  gap: number,
): void {
  const chars = Array.from(text)
  if (chars.length === 0) return
  let w = 0
  for (const ch of chars) w += ctx.measureText(ch).width + gap
  w = Math.max(0, w - gap)
  let pen = cx - w / 2
  for (const ch of chars) {
    ctx.fillText(ch, Math.round(pen), y)
    pen += ctx.measureText(ch).width + gap
  }
}

/**
 * 章标题卡。不透明度由 engine 的 world.titleCardT / titleCardDur 算出来：
 * 淡入 0.7s / 停留 1.8s / 淡出 0.7s，与 TITLE_FADE_IN_SEC / TITLE_FADE_OUT_SEC 同一来源。
 * 底色不用管 —— 调用点在 drawFade 之后，此时画面已经被到站演出压成全黑。
 */
function drawChapterTitle(ctx: CanvasRenderingContext2D): void {
  const remain = world.titleCardT
  if (remain <= 0) return
  const dur = Math.max(0.2, world.titleCardDur)
  const age = dur - remain
  const alpha = Math.max(0, Math.min(1, age / TITLE_FADE_IN_SEC, remain / TITLE_FADE_OUT_SEC))
  if (alpha <= 0.004) return

  const lines: [string, ChapterLine][] = [
    [CHAPTER_LABEL, CH_LABEL_LINE],
    [CHAPTER_TITLE, CH_TITLE_LINE],
    [CHAPTER_NOTE, CH_NOTE_LINE],
  ]

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.textAlign = 'left' // 居中靠 paintCenteredSpaced 自己算，才能带上字距
  ctx.textBaseline = 'middle'
  for (const [text, line] of lines) {
    ctx.font = `${line.size}px ${SERIF_FONT}`
    ctx.fillStyle = line.color
    paintCenteredSpaced(ctx, text, VIEW_W / 2, line.y, line.gap)
  }
  ctx.restore()
}

function drawTiles(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
  const map = world.map
  const tx0 = Math.max(0, Math.floor(camX / TILE))
  const ty0 = Math.max(0, Math.floor(camY / TILE))
  const tx1 = Math.min(map.tiles[0].length - 1, Math.floor((camX + VIEW_W) / TILE) + 1)
  const ty1 = Math.min(map.tiles.length - 1, Math.floor((camY + VIEW_H) / TILE) + 1)
  for (let y = ty0; y <= ty1; y++) {
    const row = map.tiles[y]
    for (let x = tx0; x <= tx1; x++) {
      const ch = row[x] ?? '#'
      const img = TILES[ch] ?? TILES['#']
      ctx.drawImage(img, x * TILE, y * TILE)
    }
  }
}

/** 精灵名末尾的方向后缀：`ds_down` → 基名 `ds` */
const DIR_SUFFIX = /_(?:down|up|left|right)$/

/**
 * facePlayer 实体该用的方向：玩家站在它的哪一侧，它就朝哪一侧转身。
 * 用节点坐标差（玩家 vs 实体格子中心）比较，取绝对值大的轴；
 * 相等时优先水平 —— 左右转身比上下更能读出「她在看你」。
 */
function facingToPlayer(e: EntityDef): Dir {
  const cx = e.x * TILE + TILE / 2
  const cy = e.y * TILE + TILE / 2
  const dx = world.px - cx
  const dy = world.py - cy
  // 正好站在她格子里（两个差都是 0，她不是 solid 实体，玩家能走进去）：
  // 别硬选左右，退回正面。
  if (dx === 0 && dy === 0) return 'down'
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'up' : 'down'
}

/**
 * facePlayer 实体的精灵：把 e.sprite 的基名取出（如 ds），
 * 按玩家方位取 `<基名>_<dir>`；该变体不存在时退回 e.sprite（通常是 _down）。
 * 每帧重算 —— 对话中世界冻结、玩家不动，所以对话时她同样一直看着玩家。
 */
function facePlayerSprite(e: EntityDef): HTMLCanvasElement | HTMLCanvasElement[] | undefined {
  const base = e.sprite.replace(DIR_SUFFIX, '')
  return SPRITES[`${base}_${facingToPlayer(e)}`] ?? SPRITES[e.sprite]
}

function drawEntities(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
  const g = useGame.getState()
  const list = visibleEntities()
  for (const e of list) {
    // 图纸模式下现实实体不显示；只显示 blueprintOnly 的结构标记与告示牌
    if (g.blueprint && !e.blueprintOnly) continue
    // 纯瓦片装饰（水洼 'u' / 铁链护栏 'y' / 水沟 's' / 门槛 'w'）由瓦片本身画完，
    // 但它们仍然需要能被按 E 观察 —— 这类实体 sprite 留空，只当交互锚点，不画任何东西。
    if (!e.sprite) continue
    const img = e.facePlayer ? facePlayerSprite(e) : SPRITES[e.sprite]
    if (!img) {
      // 没有精灵的实体画一个占位方块，便于关卡调试
      ctx.fillStyle = '#c0392b'
      ctx.fillRect(e.x * TILE + 2, e.y * TILE + 2, TILE - 4, TILE - 4)
      continue
    }
    const single = Array.isArray(img) ? img[0] : img
    if (!single) continue
    const w = single.width
    const h = single.height
    const dx = e.x * TILE + (TILE - w) / 2
    // 角色精灵（主角/配角 24×32，彩蛋角色 24×24）比格子（16）高：
    // 精灵的脚画在它自己画布的最底部，所以必须"底对齐"到格子底边
    // （dy = y*TILE + TILE - h），否则会下沉一格。
    // 24×24 的彩蛋角色照样底对齐：她比主角矮 8px，脚落在同一基线。
    // 注意：不能用 Math.max(0, 24 - h) —— h = 32 时那恒为 0，分支永远不生效。
    // 角色一并在这里处理，地图实体就不需要各自写 tall 了。
    // 装饰画布同理：16×32 的石像鬼 / 枯树 / 煤气灯靠 tall 底对齐，
    // 32×16 的推车 / 长椅 / 倒木是 48 宽的画布（内容居中偏右），与两格宽的碰撞盒对齐。
    const isChar = /^(hero|emma|hermann|marta|ds|npc)_/.test(e.sprite)
    const dy = e.tall || isChar ? e.y * TILE + TILE - h : e.y * TILE
    if (dx + w < camX - 32 || dx > camX + VIEW_W + 32) continue
    if (dy + h < camY - 32 || dy > camY + VIEW_H + 32) continue
    ctx.drawImage(single, Math.round(dx), Math.round(dy))
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D): void {
  const g = useGame.getState()
  if (g.blueprint) return
  const frames = SPRITES['hero_' + world.dir] ?? SPRITES['hero_down']
  if (!frames) {
    ctx.fillStyle = '#d8dde5'
    ctx.fillRect(world.px - 6, world.py - 18, 12, 20)
    return
  }
  const list = Array.isArray(frames) ? frames : [frames]
  let idx = 0
  if (world.moving) idx = Math.floor(world.animT / 8) % list.length
  else idx = 0
  const img = list[idx] ?? list[0]
  const dx = Math.round(world.px - img.width / 2)
  const dy = Math.round(world.py - img.height + 3)
  ctx.drawImage(img, dx, dy)

  // 甜醉：糖霜边缘
  if (g.sweetness >= 70) {
    ctx.fillStyle = 'rgba(242,236,224,0.10)'
    ctx.fillRect(dx - 2, dy - 2, img.width + 4, img.height + 4)
  }
}

function drawLighting(ctx: CanvasRenderingContext2D): void {
  const dark = world.map.dark
  if (dark <= 0) return
  ctx.save()
  // 以主角为中心的径向暗角
  const cx = world.px - world.camX
  const cy = world.py - world.camY
  const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 150)
  grad.addColorStop(0, `rgba(5,6,11,0)`)
  grad.addColorStop(0.55, `rgba(5,6,11,${dark * 0.55})`)
  grad.addColorStop(1, `rgba(5,6,11,${Math.min(0.92, dark + 0.25)})`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  ctx.restore()
}

/**
 * gate 专用：城门上方的月光。
 * 径向暗角以主角为中心，会把画面顶部的远景压成黑块；
 * 这层用 lighter 叠一小段冷蓝，让远景的城堡剪影与颗粒保留下来。
 */
function drawSkyLight(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const grad = ctx.createLinearGradient(0, 0, 0, 120)
  grad.addColorStop(0, 'rgba(52,74,116,0.50)')
  grad.addColorStop(0.55, 'rgba(36,52,84,0.22)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, VIEW_W, 120)
  ctx.restore()
}

function drawFog(ctx: CanvasRenderingContext2D): void {
  if (world.map.ambient === 'indoor') return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const f of world.fog) {
    const x = f.x - world.camX
    const y = f.y - world.camY
    const grad = ctx.createRadialGradient(x, y, 0, x, y, f.r)
    grad.addColorStop(0, `rgba(111,122,140,${f.a})`)
    grad.addColorStop(1, 'rgba(111,122,140,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, f.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawVignette(ctx: CanvasRenderingContext2D): void {
  const g = useGame.getState()
  // 确信低：画面边缘泛红
  if (g.conviction < 30) {
    const a = (30 - g.conviction) / 30
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 90, VIEW_W / 2, VIEW_H / 2, 230)
    grad.addColorStop(0, 'rgba(140,31,40,0)')
    grad.addColorStop(1, `rgba(140,31,40,${0.30 * a})`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  }
  // 常驻暗角
  const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 120, VIEW_W / 2, VIEW_H / 2, 260)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.42)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
}

// ---------------- 图纸层 ----------------

function drawBlueprint(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
  const map = world.map
  // 纸底
  ctx.save()
  ctx.fillStyle = 'rgba(232,224,208,0.90)'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  // 网格（极淡）
  ctx.strokeStyle = 'rgba(58,54,48,0.055)'
  ctx.lineWidth = 1
  for (let x = (-camX % 64); x < VIEW_W; x += 64) {
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, VIEW_H); ctx.stroke()
  }
  for (let y = (-camY % 64); y < VIEW_H; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(VIEW_W, y + 0.5); ctx.stroke()
  }

  const t = world.t
  const tx0 = Math.max(0, Math.floor(camX / TILE))
  const ty0 = Math.max(0, Math.floor(camY / TILE))
  const tx1 = Math.min((map.struct[0]?.length ?? 0) - 1, Math.floor((camX + VIEW_W) / TILE) + 1)
  const ty1 = Math.min(map.struct.length - 1, Math.floor((camY + VIEW_H) / TILE) + 1)

  for (let y = ty0; y <= ty1; y++) {
    const row = map.struct[y]
    if (!row) continue
    for (let x = tx0; x <= tx1; x++) {
      const ch = row[x]
      if (!ch) continue
      const info = STRUCT_SYMBOL[ch]
      if (!info || !info.color || info.color === '#00000000') continue
      const sx = x * TILE - camX
      const sy = y * TILE - camY
      if (info.kind === 'inkblot') {
        // 抖动乱线
        const jx = Math.round(Math.sin(t * 0.3 + x) * 1.2)
        const jy = Math.round(Math.cos(t * 0.27 + y) * 1.2)
        ctx.strokeStyle = info.color
        ctx.beginPath()
        for (let i = 0; i < 3; i++) {
          const yy = sy + 3 + i * 5 + jy
          ctx.moveTo(sx + 1 + jx, yy)
          ctx.lineTo(sx + 15 + jx, yy + (i % 2 ? 1 : -1))
        }
        ctx.stroke()
        continue
      }
      if (info.kind === 'torn') {
        ctx.fillStyle = 'rgba(242,236,224,0.9)'
        ctx.fillRect(sx, sy, TILE, TILE)
        ctx.strokeStyle = info.color
        ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1)
        // 折角
        ctx.beginPath()
        ctx.moveTo(sx + TILE - 6, sy)
        ctx.lineTo(sx + TILE, sy + 6)
        ctx.stroke()
        continue
      }
      drawStructGlyph(ctx, info.kind, sx, sy, info.color)
    }
  }

  // 玩家在图纸上的位置：一个图钉
  const px0 = Math.round(world.px - camX)
  const py0 = Math.round(world.py - camY)
  ctx.strokeStyle = '#2f4a6b'
  ctx.beginPath()
  ctx.arc(px0, py0 - 6, 4.5, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#2f4a6b'
  ctx.fillRect(px0 - 1, py0 - 7, 2, 2)
  ctx.beginPath()
  ctx.moveTo(px0, py0 - 1.5); ctx.lineTo(px0, py0 + 2)
  ctx.stroke()

  ctx.restore()
}

function drawStructGlyph(
  ctx: CanvasRenderingContext2D, kind: string, sx: number, sy: number, color: string,
): void {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1
  switch (kind) {
    case 'stone':
      ctx.beginPath()
      for (let i = -TILE; i < TILE; i += 8) {
        ctx.moveTo(sx + i, sy + TILE); ctx.lineTo(sx + i + TILE, sy)
      }
      ctx.stroke()
      ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1)
      break
    case 'brick':
      ctx.beginPath()
      for (let i = -TILE; i < TILE; i += 6) {
        ctx.moveTo(sx + i, sy); ctx.lineTo(sx + i + TILE, sy + TILE)
      }
      ctx.stroke()
      break
    case 'fake':
      ctx.strokeRect(sx + 1.5, sy + 1.5, TILE - 3, TILE - 3)
      ctx.beginPath()
      ctx.moveTo(sx + 3, sy + 3); ctx.lineTo(sx + TILE - 3, sy + TILE - 3)
      ctx.moveTo(sx + TILE - 3, sy + 3); ctx.lineTo(sx + 3, sy + TILE - 3)
      ctx.stroke()
      break
    case 'beam':
      ctx.beginPath()
      ctx.moveTo(sx, sy + 4); ctx.lineTo(sx + TILE, sy + 4)
      ctx.moveTo(sx, sy + 11); ctx.lineTo(sx + TILE, sy + 11)
      ctx.stroke()
      break
    case 'arch':
      ctx.beginPath()
      ctx.arc(sx + TILE / 2, sy + TILE, TILE / 2 - 1, Math.PI, 0)
      ctx.stroke()
      break
    case 'pipe':
      ctx.beginPath()
      ctx.moveTo(sx, sy + 8); ctx.lineTo(sx + TILE, sy + 8)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(sx + 9, sy + 5); ctx.lineTo(sx + 13, sy + 8); ctx.lineTo(sx + 9, sy + 11)
      ctx.stroke()
      break
    case 'rail':
      ctx.beginPath()
      ctx.moveTo(sx, sy + 6); ctx.lineTo(sx + TILE, sy + 6)
      ctx.moveTo(sx, sy + 10); ctx.lineTo(sx + TILE, sy + 10)
      ctx.stroke()
      break
    case 'gear':
      ctx.beginPath()
      ctx.arc(sx + TILE / 2, sy + TILE / 2, 5.5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(sx + TILE / 2, sy + TILE / 2, 2, 0, Math.PI * 2)
      ctx.stroke()
      break
    case 'weight':
      ctx.strokeRect(sx + 5.5, sy + 3.5, 5, 5)
      ctx.beginPath()
      ctx.moveTo(sx + 8, sy + 9); ctx.lineTo(sx + 8, sy + 13)
      ctx.moveTo(sx + 6, sy + 11); ctx.lineTo(sx + 8, sy + 13); ctx.lineTo(sx + 10, sy + 11)
      ctx.stroke()
      break
    case 'cavity':
      ctx.setLineDash([2, 2])
      ctx.strokeRect(sx + 2.5, sy + 2.5, TILE - 5, TILE - 5)
      ctx.setLineDash([])
      break
    case 'shaft':
      ctx.beginPath()
      ctx.moveTo(sx + 8, sy + 2); ctx.lineTo(sx + 8, sy + 14)
      ctx.moveTo(sx + 4, sy + 2); ctx.lineTo(sx + 12, sy + 2)
      ctx.stroke()
      break
    case 'stair':
      ctx.beginPath()
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(sx, sy + 3 + i * 4); ctx.lineTo(sx + TILE, sy + 3 + i * 4)
      }
      ctx.stroke()
      break
    case 'seat':
      // 座椅：一条靠背横线 + 一个 U 形坐垫（俯视的椅子）
      ctx.beginPath()
      ctx.moveTo(sx + 4, sy + 3)
      ctx.lineTo(sx + 12, sy + 3)
      ctx.moveTo(sx + 4, sy + 6)
      ctx.lineTo(sx + 4, sy + 12)
      ctx.lineTo(sx + 12, sy + 12)
      ctx.lineTo(sx + 12, sy + 6)
      ctx.stroke()
      break
    default:
      break
  }
}

// ---------------- 交互提示 ----------------

function drawInteractHint(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
  const t = world.interactTarget
  if (!t) return
  const g = useGame.getState()
  if (g.dialog) return
  const sx = t.sx - camX
  const sy = t.sy - camY - 20
  const bob = Math.round(Math.sin(world.t * 0.12) * 1.5)
  ctx.fillStyle = g.blueprint ? '#2f4a6b' : '#c8a040'
  ctx.fillRect(Math.round(sx) - 1, Math.round(sy) + bob, 2, 5)
  ctx.fillRect(Math.round(sx) - 2, Math.round(sy) + bob + 5, 4, 2)
  ctx.fillRect(Math.round(sx) - 1, Math.round(sy) + bob + 7, 2, 1)
}

export { paper }

