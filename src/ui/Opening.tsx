// ============================================================
// 开场分镜播放器（31.6s）：三个镜头 + 一次遮挡转场 + 一段车厢内收尾
//
//  镜头 A（纵向铁轨、车头迎面）
//   0.0–1.0   全黑
//   1.0–3.4   群山渐显（黑森林 / 雾中月 / 三层视差）
//   3.4–6.4   镜头下移：谷地露出纵向铁轨，双轨向深处收束于一点
//   6.4–10.4  车头沿纵向铁轨迎面驶来，透视放大（18px → 380px）
//   10.4–11.4 车头继续逼近，锅炉前脸 + 车灯白光把画面填满
//   11.4–11.9 纯黑 0.5s —— 「镜头被车头擦过」的标点
//
//  镜头 B（横向铁轨、侧视跟拍）—— 列车全程匀速，从不停车
//   11.9–13.0 切侧视：固定机位，列车从左横穿，车头先入画再驶出，车窗逐扇亮起
//   13.0–14.4 镜头摇起来、越摇越快，追上最后一节车厢的那扇窗（车没停）
//   14.4–16.4 与车同速跟拍：窗锁在画面中右，道砟 / 树 / 雾整幅向左滚，
//             车厢随铁轨接缝 ±1px 起伏；其余压暗、只留这扇窗在光里
//
//  镜头 C（车厢内，16.4–31.6）
//   16.4–18.6 从跟拍的窗推进到弗里德里希的侧脸：他望向窗外，
//             窗外流过的黑与偶发的灯在他脸上一道道闪过（车还在跑）
//   18.6–21.0 内心独白 ①「列车开了六个小时。」
//   21.0–23.8 内心独白 ②「对面坐着的叫艾玛。祖克霍夫家派她来接我。」
//   23.8–26.2 内心独白 ③「我从没听过这个姓。」
//   26.2–28.4 镜头转向艾玛：只给脸与上半身，不放任何字
//   28.4–30.4 回到弗里德里希，他说：「我去一趟盥洗室。」
//   30.4–31.6 淡出到黑 → finishOpening()
//
//  声音（整条分镜只有一个连续的现场，不切歌）：
//   0.0–6.4   没有行车声 —— 列车还在群山后面（从标题过来时开场 BGM 已经起了）
//   6.4       setScene('railway')：远处行车声渐起，车头越来越近越来越响
//   10.4      汽笛 ①：车头把画面填满的那一下
//   11.9      汽笛 ②：黑场结束、侧视第一帧（列车横穿）
//   16.4      车厢内：一声轻碰撞；行车声交给 engine 在进车厢时接手的 train 场景
//   跳过时    不补放错过的汽笛；先把开场自己的行车声收干净，再交给 engine
//
// 任意键 / 点击可跳过（落到 30.4s：他说完那句话的那一帧）
// ============================================================
import { useEffect, useRef } from 'react'
import { finishOpening } from '../game/store'
import { Snd } from '../game/audio'
import { VIEW_W, VIEW_H } from '../game/constants'
import {
  CAM_END,
  HERO_X,
  HERO_Y,
  drawEmmaShot,
  drawFocusWindow,
  drawLocoFront,
  drawMist,
  drawNarration,
  drawSideScene,
  drawSpokenLine,
  drawTitleCard,
  drawVignette,
  drawWatchShot,
  farLayers,
  heroWindowScreenX,
  preloadPortraits,
  sideZoom,
} from '../game/art/farback'

/** 分镜总时长（秒） */
const TOTAL = 31.6
/** 跳过时落到的时刻：他说完那句台词的那一帧（台词刚好开始淡出，仍是满亮） */
const SKIP_AT = 30.4
/**
 * 6.4s 车头开始沿纵向铁轨迎面驶来（farback.ts 的 T_FRONT）：
 * 远处的行车声从这一刻起来 —— 0–6.4s 列车还在群山后面，行车声不该响。
 */
const T_RAIL = 6.4
/** 10.4s 车头把画面填满的那一下：第一声汽笛（原来这里的站钟 bell 换掉了 —— 车在行驶中，不敲站钟） */
const WHISTLE_A_AT = 10.4
/** 11.9s 黑场结束、侧视第一帧：第二声汽笛（像列车经过道口） */
const WHISTLE_B_AT = 11.9
/**
 * 16.4s 进车厢内（= T_CABIN）：车厢连接处很轻的一记碰撞（不是刹车，车一直在跑）。
 * 行车声的「隔着一层车厢壁」不在这里切场景 —— 那一步交给 engine 在进车厢时接手。
 */
const DOOR_AT = 16.4
/** 跳过时把落点那一帧留一下再进车厢 */
const SKIP_HOLD_MS = 160

/** 镜头 A：相机下移 */
const T_CAM_START = 3.4
const T_CAM_END = 6.4
/** 车头占满画面 → 黑场 → 切侧视 */
const T_COVER = 11.4
const T_BLACK_END = 11.9
/** 镜头 B：跟拍压暗的时间窗（窗外一圈暗下去，窗留在光里） */
const T_DIM_START = 14.3
const T_DIM_END = 15.7
/** 进车厢：定格车窗继续推进 0.9s，同时新机位淡入 */
const T_CABIN = 16.4
const T_CABIN_ZOOM = 17.3
const T_WATCH_IN = 16.7
const T_WATCH_FULL = 17.4
/** 26.2s 镜头转向艾玛：他 0.4s 淡出，她略晚一点淡入（叠影一闪就过）；28.4s 硬切回 */
const T_EMMA = 26.2
const T_WATCH_GONE = 26.6
const T_EMMA_IN = 26.36
const T_EMMA_FULL = 26.68
const T_BACK = 28.4
/** 淡出 */
const T_FADE_START = 30.4
const T_FADE_END = 31.6

// ---- 字幕时间轴：[淡入起, 淡入满, 淡出起, 淡出完] ----
// 全部用 smoothstep，不用线性：进出都要有「电影字幕」的缓起缓收。
// 三句独白首尾相接、互不重叠；艾玛那 2 秒一个字都没有。
// 台词的淡出压在 30.4–30.8：跳过落在 30.4 时它还是满亮的一帧。

/** 地名 ①：巴伐利亚帝国 · 多特蒙德行省（群山渐显 → 镜头开始下移后淡出） */
const T_CARD_A = [1.6, 2.3, 3.5, 4.2] as const
/** 地名 ②：东弗里斯兰群山（铁轨露出 → 车头逼近前淡出） */
const T_CARD_B = [4.6, 5.3, 6.5, 7.2] as const
/** 旁白 ①：原作开篇第一句（车头迎面驶来时） */
const T_NARR_A = [7.6, 8.5, 9.3, 10.2] as const
/** 旁白 ②：侧视列车横穿时 */
const T_NARR_B = [12.4, 13.2, 13.8, 14.6] as const
/** 内心独白 ① / ② / ③：各 0.5s 淡入、0.4s 淡出 */
const T_MONO_A = [18.6, 19.1, 20.6, 21.0] as const
const T_MONO_B = [21.0, 21.5, 23.4, 23.8] as const
const T_MONO_C = [23.8, 24.3, 25.8, 26.2] as const
/** 台词：28.4s 起，0.5s 淡入、0.4s 淡出（30.4 时仍满亮） */
const T_SPOKEN = [28.4, 28.9, 30.4, 30.8] as const

/** 地名卡文案：主标题 + 一行注脚（年代用原作占位 XX，不编具体年份） */
const CARD_A = { title: '巴伐利亚帝国 · 多特蒙德行省', note: 'ANNO XX' }
const CARD_B = { title: '东弗里斯兰群山', note: '黑森林 · 深处' }
/** 旁白文案：\n 断行，左对齐落在左下角，不压车头与车身 */
const NARR_A = '六月的雨\n下了一整个星期。'
const NARR_B = '列车穿过黑森林，\n往帝国的东部边境飞驰而去。'
/**
 * 车厢内的三句内心独白：括号包裹，沿用旁白的 14px 灰蓝、左下角。
 * 第二句最长，折成两行，免得顶到画面右缘。
 */
const MONO_A = '（列车开了六个小时。）'
const MONO_B = '（对面坐着的叫艾玛。\n祖克霍夫家派她来接我。）'
const MONO_C = '（我从没听过这个姓。）'
/** 说出口的一句：不套括号、居中浅金，视觉上与独白区分开 */
const SPOKEN = '「我去一趟盥洗室。」'

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

/**
 * 镜头 B：侧视跟拍。列车从头到尾匀速向右跑 —— 它从不减速、从不停，
 * 是镜头在 13.0s 摇起来、14.4s 与车同速追上去。
 * 追上之后窗在画面中右基本定住，道砟 / 树 / 雾整幅向左滚，车厢随铁轨接缝起伏。
 * 这样「侧视驶过」到「贴近车窗」是一个连续的跟拍，车上的人一直在赶路。
 */
function shotB(g: CanvasRenderingContext2D, t: number, alpha: number, extraZoom = 0): void {
  const zoom = sideZoom(t) + extraZoom
  const dim = smooth(T_DIM_START, T_DIM_END, t)
  const lockX = heroWindowScreenX(t)

  g.globalAlpha = alpha
  g.save()
  g.translate(HERO_X, HERO_Y)
  g.scale(zoom, zoom)
  g.translate(-HERO_X, -HERO_Y)

  drawSideScene(g, t)

  // 跟拍压暗：窗四周暗下去、窗留在光里。不整幅压黑 —— 滚动的背景要读得出来，
  // 那正是「车还在跑」的证据，所以外围只压到 0.6，道砟与树影仍然可见。
  if (dim > 0.004) {
    const shade = g.createRadialGradient(lockX, HERO_Y, 14, lockX, HERO_Y, 168)
    shade.addColorStop(0, 'rgba(0,0,0,0)')
    shade.addColorStop(0.45, `rgba(0,0,0,${(0.24 * dim).toFixed(3)})`)
    shade.addColorStop(1, `rgba(0,0,0,${(0.6 * dim).toFixed(3)})`)
    g.fillStyle = shade
    g.fillRect(lockX - 230, HERO_Y - 170, 460, 340)
    drawFocusWindow(g, t, dim)
  }
  g.restore()

  drawVignette(g, alpha * (0.42 + 0.28 * dim))
  g.globalAlpha = 1
}

/** 车厢内两个机位的不透明度：26.2–26.6 他淡出、她 26.36 起淡入；28.4 硬切回 */
function watchAlpha(t: number): number {
  if (t < T_CABIN) return 0
  if (t < T_EMMA) return smooth(T_WATCH_IN, T_WATCH_FULL, t)
  if (t < T_BACK) return 1 - smooth(T_EMMA, T_WATCH_GONE, t)
  return 1
}

function emmaAlpha(t: number): number {
  if (t < T_EMMA_IN || t >= T_BACK) return 0
  return smooth(T_EMMA_IN, T_EMMA_FULL, t)
}

/** 把某一时刻的字幕叠到 canvas 上：地名卡（居中偏下）+ 旁白（左下角）+ 车厢内独白 / 台词 */
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

  // 三句内心独白：括号包住，仍是左下角的灰蓝小字
  const ma = envelope(t, T_MONO_A)
  if (ma > 0.004) drawNarration(g, MONO_A, ma)
  const mb = envelope(t, T_MONO_B)
  if (mb > 0.004) drawNarration(g, MONO_B, mb)
  const mc = envelope(t, T_MONO_C)
  if (mc > 0.004) drawNarration(g, MONO_C, mc)

  // 说出口的那句：居中浅金，与独白分开
  const sp = envelope(t, T_SPOKEN)
  if (sp > 0.004) drawSpokenLine(g, SPOKEN, sp)
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
    if (t < T_BLACK_END) {
      shotA(g, t, fade)
    } else if (t < T_CABIN) {
      shotB(g, t, fade)
    } else {
      // 跟拍的窗继续推近、淡出；同一时刻弗里德里希的机位淡入 —— 一个连续镜头
      const outA = 1 - smooth(T_CABIN, T_CABIN_ZOOM, t)
      if (outA > 0.004) {
        shotB(g, t, fade * outA, 0.95 * smooth(T_CABIN, T_CABIN_ZOOM, t))
      }
      const wa = watchAlpha(t)
      if (wa > 0.004) drawWatchShot(g, t, fade * wa)
      const ea = emmaAlpha(t)
      if (ea > 0.004) drawEmmaShot(g, t, fade * ea)
    }
  }
  // 字幕画在画面最上层：自己有淡入淡出，不跟 fadeIn / fadeOut 走
  drawCaptions(g, t)
  g.restore()
}

/**
 * 验收 / 调试用的定帧入口：URL 里带 ?opening=<秒> 时只渲染那一帧。
 * 平时（不带参数）返回 null，播放流程完全不受影响。
 */
function freezeAt(): number | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('opening')
  if (raw == null || raw === '') return null
  const t = Number(raw)
  if (!Number.isFinite(t)) return null
  return t < 0 ? 0 : t > TOTAL ? TOTAL : t
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
    preloadPortraits()   // 车厢内两镜的立绘：先拉，没拉完就用剪影兜底

    // 验收 / 调试：?start=1&opening=17.5 把画面定在任意一帧（不播放、不进车厢）。
    // 正是靠 renderFrame(g, t) 的纯函数性：给任意 t 都能画出那一帧。
    // 这里不碰任何音频接口 —— 不进播放循环就没有 Snd.start() / setScene，也没有汽笛，
    // 所以逐帧调试入口是彻底静音的（跳帧不会让音效错乱，因为它根本不发声）。
    const frozen = freezeAt()
    if (frozen != null) {
      let raf2 = 0
      const redraw = (): void => {
        renderFrame(g, frozen)
        raf2 = requestAnimationFrame(redraw)
      }
      redraw()
      return () => cancelAnimationFrame(raf2)
    }

    Snd.start()          // 用户已按键 / 点击过，允许发声
    // 0–6.4s：群山 + 镜头下移，列车还在远处的山后 —— 这里不要行车层。
    // audio.ts 对「从标题过来的 silent」有特判（openingEntry）：BGM 会在这一步就切成
    // opening 曲，所以这段不是真空，只是没有轮轨声。行车声留到 6.4s 车头驶来时再加。
    Snd.setScene('silent')

    const start = performance.now()
    let raf = 0
    let railFired = false
    let whistleAFired = false
    let whistleBFired = false
    let doorFired = false
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

    // 跳过：直接落到 30.4s（他说完那句话的那一帧），停一下再进车厢。
    // 错过的汽笛不补放（错过就错过），但开场自己起的行车声不能留成孤儿：
    // 先静音收干净，160ms 后 finishOpening() 进车厢，engine 第一帧 setScene('train')
    // 会重新起 BGM 与「隔着车厢壁」的行车声 —— 那 160ms 的空档就是交接本身。
    const skip = (): void => {
      if (stopped) return
      stopped = true
      cancelAnimationFrame(raf)
      removeListeners()
      Snd.setScene('silent')
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

      // 6.4s：车头开始迎面驶来 —— 远处的行车声从这一刻起来。
      // BGM 在挂载那一步就已经是 opening 曲了，这里 setTrack 同名是空操作：
      // 换进来的只有轮轨 / 机体震动这一层，而且它自己有 2s 渐入，
      // 正好对上「车头从远处一点点变大」。
      if (!railFired && t >= T_RAIL) {
        railFired = true
        Snd.setScene('railway')
      }
      // 10.4s：车头把画面填满的那一下 —— 第一声汽笛
      if (!whistleAFired && t >= WHISTLE_A_AT) {
        whistleAFired = true
        // 掉帧一次跨过两个汽笛锚点时，只留更近的那一声，别叠在一起响
        if (t < WHISTLE_B_AT) Snd.sfx('whistle')
      }
      // 11.9s：黑场结束、侧视第一帧 —— 第二声汽笛（列车横穿 / 经过道口）
      if (!whistleBFired && t >= WHISTLE_B_AT) {
        whistleBFired = true
        Snd.sfx('whistle')
      }
      // 16.4s：切进车厢内部 —— 车厢连接处很轻的一记碰撞（不是刹车，车一直在跑）。
      // 行车声这里**不切场景**，两个原因：
      //   · audio.ts 的 railway 与 train 是同一组音层（48Hz 锯齿 + railway(0.035)），
      //     切过去也听不出「变轻」，只会把音层推倒重建一遍；
      //   · setScene 会把 BGM 一起换掉 —— opening 曲是 32s、按 31.6s 编好的（第 28 小节
      //     的 C♯ 一直悬到曲尾，进车厢那一刻才解决），16.4s 切 train 会把它砍掉一半。
      // 所以「隔着车厢壁」的那一层交给 engine：finishOpening() 之后 engine 第一帧
      // setScene('train') 接手，音层重建 + 2s/2s 交叉淡变，正是进车厢的那一下。
      // 若 audio 侧日后给出只缩环境音、不动 BGM 的接口（如 setAmbientVolume），
      // 这里就是该做 1 → 0.45 淡出的地方，届时不必再切场景。
      if (!doorFired && t >= DOOR_AT) {
        doorFired = true
        Snd.sfx('door')
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
