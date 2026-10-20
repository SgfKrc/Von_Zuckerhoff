// ============================================================
// 开场分镜播放器（18.5s）：两个镜头 + 一次遮挡转场
//
//  镜头 A（纵向铁轨、车头迎面）
//   0.0–1.0   全黑
//   1.0–3.4   群山渐显（黑森林 / 雾中月 / 三层视差）
//   3.4–6.4   镜头下移：谷地露出纵向铁轨，双轨向深处收束于一点
//   6.4–10.4  车头沿纵向铁轨迎面驶来，透视放大（18px → 380px）
//   10.4–11.4 车头继续逼近，锅炉前脸 + 车灯白光把画面填满
//   11.4–11.9 纯黑 0.5s —— 「镜头被车头擦过」的标点
//
//  镜头 B（横向铁轨、侧视）
//   11.9–14.4 切侧视：横向铁轨 + 列车从左横穿，车窗逐扇亮起
//   14.4–16.4 定格在最右那扇窗：轻微放大 + 其余压暗 + 窗内两个剪影
//   16.4–18.0 淡出到黑 → finishOpening()（18.0–18.5 留黑）
//
// 任意键 / 点击可跳过（直接落到 16.4s 的定格帧）
// ============================================================
import { useEffect, useRef } from 'react'
import { finishOpening } from '../game/store'
import { Snd } from '../game/audio'
import { VIEW_W, VIEW_H } from '../game/constants'
import {
  CAM_END,
  HERO_X,
  HERO_Y,
  drawFocusWindow,
  drawLocoFront,
  drawMist,
  drawNarration,
  drawTitleCard,
  drawTrain,
  drawVignette,
  farLayers,
} from '../game/art/farback'

/** 分镜总时长（秒） */
const TOTAL = 18.5
/** 跳过时落到的时刻：定格车窗那一帧 */
const SKIP_AT = 16.4
/** 车头占满画面 / 擦过镜头时敲一声：当作汽笛 / 站钟 */
const BELL_AT = 10.4
/** 跳过时把定格帧留一下再进车厢 */
const SKIP_HOLD_MS = 160

/** 镜头 A：相机下移 */
const T_CAM_START = 3.4
const T_CAM_END = 6.4
/** 车头占满画面 → 黑场 → 切侧视 */
const T_COVER = 11.4
const T_BLACK_END = 11.9
/** 镜头 B：停稳后定格 + 压暗 */
const T_HOLD_START = 14.6
const T_DIM_END = 15.9
const T_ZOOM_END = 16.0
/** 淡出 */
const T_FADE_START = 16.4
const T_FADE_END = 18.0

// ---- 字幕时间轴：[淡入起, 淡入满, 淡出起, 淡出完] ----
// 全部用 smoothstep，不用线性：进出都要有「电影字幕」的缓起缓收。
// 任一窗口在 SKIP_AT(16.4s) 之前早已归零，所以跳过落到定格帧时不会带字。

/** 地名 ①：巴伐利亚帝国 · 多特蒙德行省（群山渐显 → 镜头开始下移后淡出） */
const T_CARD_A = [1.6, 2.3, 3.5, 4.2] as const
/** 地名 ②：东弗里斯兰群山（铁轨露出 → 车头逼近前淡出） */
const T_CARD_B = [4.6, 5.3, 6.5, 7.2] as const
/** 旁白 ①：原作开篇第一句（车头迎面驶来时） */
const T_NARR_A = [7.6, 8.5, 9.3, 10.2] as const
/** 旁白 ②：侧视列车横穿时 */
const T_NARR_B = [12.4, 13.2, 13.8, 14.6] as const

/** 地名卡文案：主标题 + 一行注脚（年代用原作占位 XX，不编具体年份） */
const CARD_A = { title: '巴伐利亚帝国 · 多特蒙德行省', note: 'ANNO XX' }
const CARD_B = { title: '东弗里斯兰群山', note: '六月的雨 · 第七天' }
/** 旁白文案：\n 断行，左对齐落在左下角，不压车头与车身 */
const NARR_A = '六月的雨\n下了一整个星期。'
const NARR_B = '列车穿过黑森林，\n往一座不在地图上的庄园去。'

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function smooth(a: number, b: number, v: number): number {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** 三段式淡入淡出：淡入 smoothstep → 停留 1 → 淡出 smoothstep → 0 */
function envelope(t: number, w: readonly [number, number, number, number]): number {
  return smooth(w[0], w[1], t) * (1 - smooth(w[2], w[3], t))
}

/** 相机下移量：3.4–6.4s 先快后缓地滚到 CAM_END（5.0s 时铁轨已露出大半） */
function cameraY(t: number): number {
  const p = clamp01((t - T_CAM_START) / (T_CAM_END - T_CAM_START))
  return CAM_END * (1 - Math.pow(1 - p, 2))
}

/** 镜头 A：群山 → 纵向铁轨 → 车头迎面 → 被车头填满 */
function shotA(g: CanvasRenderingContext2D, t: number, fade: number): void {
  const L = farLayers()
  const camY = cameraY(t)

  // 三层视差：远山滚得慢，近景滚得满，越近越快
  const cSky = camY * 0.5
  const cFar = camY * 0.68
  const cMid = camY * 0.86
  const cForest = camY * 0.94

  g.globalAlpha = fade
  g.drawImage(L.sky, 0, -cSky)
  g.drawImage(L.ridgeFar, 0, -cFar)
  g.drawImage(L.ridgeMid, 0, -cMid)
  g.drawImage(L.forest, 0, -cForest)
  // 谷地 + 纵向铁轨：双轨从画面下缘向消失点 (192,96) 收束
  g.drawImage(L.railV, 0, -camY)
  // 两侧近景坡：中间是铁轨走廊，压不住轨道
  g.drawImage(L.near, 0, -camY)
  // 铁轨上的薄雾：雾片中心压在消失点上，钢轨收束处不露硬接缝
  drawMist(g, t, -camY + 188, 0.22, 3.2)
  drawLocoFront(g, t)
  // 近处低雾：贴着画面下缘，压住构图
  drawMist(g, t, -camY + 306, 0.13, 8)
  drawVignette(g, fade * 0.42)
  // 车灯贴脸的最后一爆：白光扫过一帧，然后硬切黑
  const flash = smooth(11.05, T_COVER, t)
  if (flash > 0.002) {
    g.globalAlpha = fade * 0.42 * flash
    g.fillStyle = '#f2ece0'
    g.fillRect(0, 0, VIEW_W, VIEW_H)
  }
  g.globalAlpha = 1
}

/** 镜头 B：横向铁轨，列车自左驶过，定格在最后一扇窗 */
function shotB(g: CanvasRenderingContext2D, t: number, fade: number): void {
  const L = farLayers()
  const camY = CAM_END
  const zoom = 1 + 0.9 * smooth(T_HOLD_START, T_ZOOM_END, t)
  const dim = smooth(T_HOLD_START, T_DIM_END, t)

  const cSky = camY * 0.5
  const cFar = camY * 0.68
  const cMid = camY * 0.86
  const cForest = camY * 0.94

  g.globalAlpha = fade
  g.save()
  g.translate(HERO_X, HERO_Y)
  g.scale(zoom, zoom)
  g.translate(-HERO_X, -HERO_Y)

  g.drawImage(L.sky, 0, -cSky)
  g.drawImage(L.ridgeFar, 0, -cFar)
  g.drawImage(L.ridgeMid, 0, -cMid)
  g.drawImage(L.forest, 0, -cForest)
  g.drawImage(L.rail, 0, -camY)
  drawMist(g, t, -camY + 198, 0.26, 3.5) // 谷地薄雾：从山脚漫到轨道
  drawTrain(g, t, camY)
  g.drawImage(L.near, 0, -camY)
  drawMist(g, t, -camY + 292, 0.16, 8)   // 近处低雾，压住画面下缘
  g.restore()

  // 定格：除这扇窗以外整体压暗，再把窗重新点亮一次
  if (dim > 0.001) {
    g.globalAlpha = fade * 0.8 * dim
    g.fillStyle = '#000000'
    g.fillRect(0, 0, VIEW_W, VIEW_H)
    g.globalAlpha = fade
    g.save()
    g.translate(HERO_X, HERO_Y)
    g.scale(zoom, zoom)
    g.translate(-HERO_X, -HERO_Y)
    drawFocusWindow(g, dim)
    g.restore()
  }

  drawVignette(g, fade * (0.42 + 0.5 * dim))
  g.globalAlpha = 1
}

/** 把某一时刻的字幕叠到 canvas 上：地名卡（居中偏下）+ 旁白（左下角） */
function drawCaptions(g: CanvasRenderingContext2D, t: number): void {
  // 两段地名卡互不重叠（① 4.2s 收完，② 4.6s 才起），不会同屏出现两行大字
  const a = envelope(t, T_CARD_A)
  if (a > 0.004) drawTitleCard(g, { ...CARD_A, alpha: a })
  const b = envelope(t, T_CARD_B)
  if (b > 0.004) drawTitleCard(g, { ...CARD_B, alpha: b })

  // 旁白更小更暗，淡入淡出也更长（0.9s），读到半句就化开
  const na = envelope(t, T_NARR_A)
  if (na > 0.004) drawNarration(g, NARR_A, na)
  const nb = envelope(t, T_NARR_B)
  if (nb > 0.004) drawNarration(g, NARR_B, nb)
}

/** 把某一时刻的整幅画面画到 canvas 上（纯函数：跳过时可直接取任意 t） */
export function renderFrame(g: CanvasRenderingContext2D, t: number): void {
  const fadeIn = smooth(1.0, 3.4, t)
  const fadeOut = 1 - smooth(T_FADE_START, T_FADE_END, t)
  const fade = fadeIn * fadeOut
  // 转场：一帧纯黑（0.5s），不做旋转 / 叠化
  const blackout = t >= T_COVER && t < T_BLACK_END

  g.save()
  g.imageSmoothingEnabled = false
  g.fillStyle = '#000000'
  g.fillRect(0, 0, VIEW_W, VIEW_H)

  if (!blackout && fade > 0.001) {
    if (t < T_BLACK_END) shotA(g, t, fade)
    else shotB(g, t, fade)
  }
  // 字幕画在画面最上层：自己有淡入淡出，不跟 fadeIn / fadeOut 走
  drawCaptions(g, t)
  g.restore()
}

export function Opening() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const g = canvas.getContext('2d')
    if (!g) return
    g.imageSmoothingEnabled = false

    farLayers()          // 首帧之前一次性把远景画好
    Snd.start()          // 用户已按键 / 点击过，允许发声
    Snd.setScene('silent')

    const start = performance.now()
    let raf = 0
    let bellFired = false
    let stopped = false
    let holdTimer = 0

    const removeListeners = (): void => {
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('pointerdown', onSkip)
    }

    const finish = (): void => {
      if (stopped) return
      stopped = true
      cancelAnimationFrame(raf)
      removeListeners()
      finishOpening()
    }

    // 跳过：直接落到 16.4s 的定格帧，停一下再进车厢
    const skip = (): void => {
      if (stopped) return
      stopped = true
      cancelAnimationFrame(raf)
      removeListeners()
      renderFrame(g, SKIP_AT)
      holdTimer = window.setTimeout(finishOpening, SKIP_HOLD_MS)
    }

    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      skip()
    }
    const onSkip = (): void => skip()

    const loop = (): void => {
      if (stopped) return
      const t = (performance.now() - start) / 1000
      if (!bellFired && t >= BELL_AT) {
        bellFired = true
        Snd.sfx('bell')
      }
      renderFrame(g, Math.min(t, TOTAL))
      if (t >= TOTAL) {
        finish()
        return
      }
      raf = requestAnimationFrame(loop)
    }

    window.addEventListener('keydown', onKey)
    canvas.addEventListener('pointerdown', onSkip)
    renderFrame(g, 0)
    raf = requestAnimationFrame(loop)

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      if (holdTimer) window.clearTimeout(holdTimer)
      removeListeners()
    }
  }, [])

  return (
    <div className="stage">
      <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} className="game-canvas" />
    </div>
  )
}
