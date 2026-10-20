// ============================================================
// 远景层：唯一允许外部图片的渲染位置（ART_AUDIO_SPEC §6）
// 素材 public/bg/gothic.png（1920×1080 哥特城堡）。
// 写实图必须"退后"：预烘焙到内部分辨率时做降饱和 + 冷蓝压暗，
// 再叠固定 seed 的 2×2 像素颗粒；每帧只做一次 drawImage + 一层压暗。
// ============================================================
import { VIEW_W, VIEW_H, GOTHIC_BG_SRC } from '../constants'

/** 远景纵向视差速率：远景比前景瓦片慢，camY * 0.25 */
const PARALLAX_RATE = 0.25
/** 烘焙画布比屏幕高出的像素，给纵向视差留余量 */
const PARALLAX_PAD = 32

let ready = false

const img = new Image()

/**
 * 预烘焙画布：把 1920×1080 缩到内部像素分辨率并完成调色、颗粒。
 * 每帧直接贴这张小图，避免逐帧缩放 1080p 大图。
 */
const poster = document.createElement('canvas')
poster.width = VIEW_W
poster.height = VIEW_H + PARALLAX_PAD
const posterCtx = poster.getContext('2d')

img.onload = () => {
  ready = true
  bakePoster()
}
img.onerror = () => {
  // 素材缺失时静默跳过（远景是可选装饰，不阻塞游戏）
  ready = false
}
img.src = GOTHIC_BG_SRC

/** 固定 seed 的伪随机：颗粒必须每帧一致，否则会闪 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 2×2 抖动点：把写实图的连续调子打碎成像素颗粒，向像素画靠拢 */
function paintGrain(g: CanvasRenderingContext2D): void {
  const rnd = mulberry32(0x5eed1e55)
  const dots = Math.floor((poster.width * poster.height) / 70)
  for (let i = 0; i < dots; i++) {
    const x = Math.floor(rnd() * poster.width)
    const y = Math.floor(rnd() * poster.height)
    const light = rnd() > 0.42
    g.fillStyle = light ? 'rgba(154,166,184,0.10)' : 'rgba(5,6,11,0.18)'
    g.fillRect(x, y, 2, 2)
  }
}

function bakePoster(): void {
  const g = posterCtx
  if (!g || img.naturalWidth === 0 || img.naturalHeight === 0) return

  // cover：以高度铺满烘焙画布（源图 16:9，画布略高，两侧各裁掉一点）
  const scale = poster.height / img.naturalHeight
  const dw = img.naturalWidth * scale
  const dx = (VIEW_W - dw) / 2

  g.setTransform(1, 0, 0, 1, 0, 0)
  g.clearRect(0, 0, poster.width, poster.height)
  g.drawImage(img, dx, 0, dw, poster.height)
  g.globalAlpha = 1

  // 降饱和：saturation 混合模式把整幅远景压成灰阶（保留亮度），
  // 写实插画的艳色被抹掉，和 16 色像素画不再打架。
  g.globalCompositeOperation = 'saturation'
  g.fillStyle = '#808080'
  g.fillRect(0, 0, poster.width, poster.height)

  // 冷蓝叠加：统一到深蓝夜空，再压一层近黑让暗部沉下去
  g.globalCompositeOperation = 'source-over'
  g.fillStyle = 'rgba(18,30,52,0.38)'
  g.fillRect(0, 0, poster.width, poster.height)
  g.fillStyle = 'rgba(6,8,14,0.12)'
  g.fillRect(0, 0, poster.width, poster.height)

  paintGrain(g)
}

/**
 * 在瓦片之下画地图远景。
 * @param mapId 当前地图；只有 gate（抵达古堡的正门）有远景
 * @param camX  相机横向坐标（横向锁死，远景不横移）
 * @param camY  相机纵向坐标（远景按 camY * 0.25 偏移）
 */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  mapId: string,
  camX: number,
  camY: number,
): void {
  void camX // 远景横向固定，只做纵向视差
  if (mapId !== 'gate') return
  if (!ready) return // 未加载完就跳过绘制，绝不阻塞游戏循环

  const offset = Math.max(0, Math.min(PARALLAX_PAD, Math.round(camY * PARALLAX_RATE)))

  ctx.save()
  ctx.imageSmoothingEnabled = false // 颗粒保持锐利，不做二次插值
  ctx.drawImage(poster, 0, -offset)
  // 压暗，让它沉到瓦片下面
  ctx.fillStyle = 'rgba(8,10,16,0.45)'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  ctx.restore()
}
