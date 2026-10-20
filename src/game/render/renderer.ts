// ============================================================
// 场景渲染：瓦片 / 实体 / 角色 / 光照 / 雾 / 图纸层
// ============================================================
import { world, entTileW, visibleEntities } from '../engine/engine'
import { VIEW_W, VIEW_H } from '../constants'
import { TILES, SOLID_TILES, C, STRUCT_SYMBOL } from '../art/tiles'
import { TILE } from '../art/build'
import { useGame } from '../store'
import { SPRITES } from '../art/sprites'
import { drawBackdrop } from './backdrop'

const paper = document.createElement('canvas')
paper.width = VIEW_W
paper.height = VIEW_H

export function drawScene(ctx: CanvasRenderingContext2D): void {
  const g = useGame.getState()
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, VIEW_W, VIEW_H)
  ctx.fillStyle = C.night
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  // 震屏
  let ox = 0
  let oy = 0
  if (world.shakeT > 0) {
    ox = (Math.random() - 0.5) * 3
    oy = (Math.random() - 0.5) * 3
  }

  const camX = Math.round(world.camX + ox)
  const camY = Math.round(world.camY + oy)

  // 远景放在 translate 之前：用屏幕坐标绘制，自己处理视差，
  // 且必须早于 drawTiles —— 它要垫在瓦片下面。
  drawBackdrop(ctx, world.map.id, camX, camY)

  ctx.save()
  ctx.translate(-camX, -camY)

  drawTiles(ctx, camX, camY)
  drawEntities(ctx, camX, camY)
  drawPlayer(ctx)

  ctx.restore()

  drawLighting(ctx)
  // gate：镜头朝上的夜空不能被径向暗角压成纯黑，补一层月光天光，
  // 让瓦片下的远景（城堡剪影）透出来。
  if (world.map.id === 'gate') drawSkyLight(ctx)
  drawFog(ctx)
  if (g.blueprint) drawBlueprint(ctx, camX, camY)
  drawInteractHint(ctx, camX, camY)
  drawVignette(ctx)
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

function drawEntities(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
  const g = useGame.getState()
  const list = visibleEntities()
  for (const e of list) {
    // 图纸模式下现实实体不显示；只显示 blueprintOnly 的结构标记
    if (g.blueprint && !e.blueprintOnly) continue
    const img = SPRITES[e.sprite]
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
    const dy = e.tall ? e.y * TILE + TILE - h : e.y * TILE
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

