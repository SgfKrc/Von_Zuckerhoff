// ============================================================
// 时钟转场：他躺了两个小时，睡不着（第一夜 · 卧室）
//
// 原作里他第一次躺下并没有立刻爬起来 —— 中间有两个小时是空的，
// 钟从十一下走到一点。剧本（script.ts 追加区 12）只在 cannotSleep
// 末尾立一个 flags.clockInterlude；这个组件认领那个 flag 接管画面。
//
// 时间轴（合计 4.4s，不可跳过，不进存档）：
//   0.00 – 0.90s  画面淡出到黑（黑幕 0 → 1，那 0.9s 与到站演出同一拍）
//   0.85 – 1.25s  钟表从黑里浮出来（画面全黑的那一刻才起，指针此时还在 11:00）
//   1.00 – 3.50s  指针走 11:00 → 1:00（2.5s），先快、后慢、再快
//   3.50 – 4.40s  淡入；指针不停，钟表比黑幕早一点点收
//
// 画法：一张 384×216 的逻辑画布（与游戏同一套分辨率 / pixelated 放大），
// 所以不需要知道屏幕多大 —— 黑幕、表盘、投影全按逻辑像素算。
// 表盘 96×96，居中 (144,60)。半写实黄铜壳 + 象牙表盘 + 六十道极细刻度。
//
// 三处细节是刻意做的：
//   · 12 点位置那一道刻度是【断的】（上下两截之间空一道缝）——
//     呼应原作「十二下。可我数的时候，只到十一。」
//   · 指针不是匀速：速度曲线先快后慢再快（smoothstep 混合 + 数值积分成查表），
//     像他数着时间，时而清醒时而迷糊。
//   · 每走过一个整点（12:00 / 1:00）：表盘往下沉 1px 抖三下 + 一记很轻的 bell。
//     最后淡出时钟还在走 —— 时间没有停。
// ============================================================
import { useEffect, useRef } from 'react'
import { Snd } from '../game/audio'
import { VIEW_W, VIEW_H } from '../game/constants'
import { finishClockInterlude, startClockInterlude } from '../game/store'

// ---------------- 时间轴 ----------------

/** 淡出到黑：0 → 0.9s（与到站演出同一拍） */
const FADE_OUT_SEC = 0.9
/** 钟表从黑里浮出来：从画面全黑的那一刻起，0.4s 浮现完毕 */
const CLOCK_IN_AT = 0.85
const CLOCK_IN_SEC = 0.4
/** 指针 11:00 → 1:00（2.5s，先快后慢再快） */
const HANDS_AT = 1.0
const HANDS_SEC = 2.5
/** 淡入：黑幕 1 → 0 */
const FADE_IN_AT = HANDS_AT + HANDS_SEC
const FADE_IN_SEC = 0.9
const TOTAL_SEC = FADE_IN_AT + FADE_IN_SEC

/** 钟表开始收 / 收完：跟淡入一起淡（比黑幕早 0.15s 收干净），
 *  最后一帧它还看得见在走 —— 时间没有停。 */
const CLOCK_OUT_AT = FADE_IN_AT + 0.3
const CLOCK_OUT_SEC = 0.45

/**
 * rAF 兜底：后台标签页里 requestAnimationFrame 不跑，
 * 转场会永久停在黑屏上（世界还冻着）。到点直接收尾。
 */
const FALLBACK_MS = (TOTAL_SEC + 2.5) * 1000

// ---------------- 表盘尺寸 ----------------

const CLOCK_SIZE = 96
const CLOCK_X = Math.round((VIEW_W - CLOCK_SIZE) / 2)
const CLOCK_Y = Math.round((VIEW_H - CLOCK_SIZE) / 2)
const CX = CLOCK_SIZE / 2
const CY = CLOCK_SIZE / 2
/** 表壳半径（含外圈） */
const R = 46
/** 表盘半径（表壳内沿） */
const FR = R - 6

/** 表盘上的做旧斑（相对 FR 的比例，固定不变 —— 半写实的那点脏，不是噪点） */
const SPOTS: [number, number, number][] = [
  [-0.34, 0.22, 0.20],
  [0.30, -0.34, 0.15],
  [0.10, 0.44, 0.24],
  [-0.52, -0.30, 0.12],
  [0.46, 0.30, 0.10],
]

// ---------------- 指针速度曲线 ----------------

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/**
 * 指针的瞬时速度（相对值）。三段：起手快 → 中段慢下来（迷糊）→ 末尾又快起来。
 * 值本身没有量纲，最后会按「总距离 = 2 小时」归一化。
 */
function speedAt(u: number): number {
  const fast = 1.7
  const slow = 0.38
  const back = 1.55
  const fall = smoothstep(0.26, 0.54, u)
  const rise = smoothstep(0.6, 0.86, u)
  return fast + (slow - fast) * fall + (back - slow) * rise
}

/**
 * 把速度曲线数值积分成一张累积表：CURVE.cum[i] 是前 i 段的累积速度，
 * 除以 total 就是归一化进度（走完全部 2 小时 = 1）。
 * 这样「一段快一段慢」既严格单调、又不用解微分方程。
 */
const SAMPLE = 512
const CURVE = (() => {
  const cum: number[] = [0]
  let acc = 0
  for (let i = 1; i <= SAMPLE; i++) {
    acc += speedAt((i - 0.5) / SAMPLE)
    cum.push(acc)
  }
  return { cum, total: acc, endSpeed: speedAt(0.995) }
})()

/** τ ∈ [0,1] → 进度 P ∈ [0,1]（线性插值查表） */
function progressAt(tau: number): number {
  if (tau <= 0) return 0
  if (tau >= 1) return 1
  const x = tau * SAMPLE
  const i = Math.floor(x)
  const f = x - i
  const a = CURVE.cum[i]
  const b = CURVE.cum[Math.min(SAMPLE, i + 1)]
  return (a + (b - a) * f) / CURVE.total
}

/**
 * 表盘上的时刻：11 点起算，2.5s 走完 2 小时（→ 13 点，即 1:00）。
 * 走完之后不刹车 —— 淡出时指针还在往前爬（按末尾那段速度），
 * 这就是「时间没停」。
 */
function hourAt(t: number): number {
  const tau = (t - HANDS_AT) / HANDS_SEC
  if (tau <= 0) return 11
  const p = tau <= 1
    ? progressAt(tau)
    : 1 + (tau - 1) * (CURVE.endSpeed / CURVE.total)
  return 11 + 2 * p
}

// ---------------- 画表 ----------------

/** 一根指针：从轴心往外的锥形，尾部略过中心（真表就是这样） */
function drawHand(
  g: CanvasRenderingContext2D,
  rad: number,
  len: number,
  w: number,
  color: string,
  dy: number,
): void {
  g.save()
  g.rotate(rad)
  g.translate(0, dy)
  g.beginPath()
  g.moveTo(-w / 2, 4)
  g.lineTo(-w * 0.34, -len * 0.84)
  g.lineTo(0, -len)
  g.lineTo(w * 0.34, -len * 0.84)
  g.lineTo(w / 2, 4)
  g.closePath()
  g.fillStyle = color
  g.fill()
  g.restore()
}

/**
 * 画那只表。坐标原点在表盘圆心，画完由调用方 restore。
 * @param hour  11 → 13（11:00 → 1:00）
 * @param alpha 整体不透明度
 * @param sink  整只表下沉的像素数（整点那一下的 1px 震动）
 */
function drawWatch(g: CanvasRenderingContext2D, hour: number, alpha: number, sink: number): void {
  g.save()
  g.globalAlpha = alpha
  g.translate(CLOCK_X + CX, CLOCK_Y + CY + sink)

  // 1) 投影：钟盘下方的软影（半写实：不是硬像素边）
  g.beginPath()
  g.ellipse(1.5, 4, R * 0.97, R * 0.9, 0, 0, Math.PI * 2)
  g.fillStyle = 'rgba(0,0,0,0.55)'
  g.fill()

  // 2) 表壳：黄铜，左上受光，右下背光
  const shell = g.createRadialGradient(-R * 0.4, -R * 0.45, R * 0.08, 0, 0, R)
  shell.addColorStop(0, '#a48d50')
  shell.addColorStop(0.42, '#6e5b2f')
  shell.addColorStop(0.78, '#3b3018')
  shell.addColorStop(1, '#1a160b')
  g.beginPath()
  g.arc(0, 0, R, 0, Math.PI * 2)
  g.fillStyle = shell
  g.fill()

  // 3) 表壳的受光细边 + 表盘与壳之间的暗沟
  g.lineWidth = 1
  g.strokeStyle = 'rgba(226,203,143,0.5)'
  g.beginPath()
  g.arc(0, 0, R - 0.5, Math.PI * 0.8, Math.PI * 1.86)
  g.stroke()
  g.strokeStyle = 'rgba(6,5,3,0.92)'
  g.lineWidth = 1.4
  g.beginPath()
  g.arc(0, 0, R - 1.8, 0, Math.PI * 2)
  g.stroke()

  // 4) 表盘：象牙色，中心偏亮
  const face = g.createRadialGradient(-FR * 0.35, -FR * 0.4, FR * 0.12, 0, 0, FR)
  face.addColorStop(0, '#f1e9d3')
  face.addColorStop(0.55, '#ded3b7')
  face.addColorStop(1, '#b8a98a')
  g.beginPath()
  g.arc(0, 0, FR, 0, Math.PI * 2)
  g.fillStyle = face
  g.fill()

  // 5) 表盘做旧：几块很淡的黄斑（边缘化开，不做成硬边圆）
  for (const [bx, by, br] of SPOTS) {
    const px = bx * FR
    const py = by * FR
    const rad = br * FR
    const spot = g.createRadialGradient(px, py, rad * 0.1, px, py, rad)
    spot.addColorStop(0, 'rgba(150,118,56,0.075)')
    spot.addColorStop(1, 'rgba(150,118,56,0)')
    g.fillStyle = spot
    g.beginPath()
    g.arc(px, py, rad, 0, Math.PI * 2)
    g.fill()
  }
  // 表盘外沿的内阴影：让盘面凹进壳里
  g.strokeStyle = 'rgba(38,30,16,0.5)'
  g.lineWidth = 1.2
  g.beginPath()
  g.arc(0, 0, FR - 0.6, 0, Math.PI * 2)
  g.stroke()

  // 6) 刻度：六十道极细的分钟刻度，十二道整点刻度。
  //    i = 0 是 12 点那一道 —— 它是【断的】：上下两截，中间空一道缝。
  const seg = (dx: number, dy: number, r1: number, r2: number): void => {
    g.moveTo(dx * r1, dy * r1)
    g.lineTo(dx * r2, dy * r2)
  }
  g.lineCap = 'butt'
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const major = i % 5 === 0
    const inner = major ? FR - 8.5 : FR - 4.5
    const outer = FR - 1.5
    if (i === 0) {
      // 12 点这一道是断的：内外两截，中间空出 2px 的缝
      // （缝比线宽宽，放大到屏幕上看得见「断」而不是「短」）
      g.beginPath()
      g.strokeStyle = 'rgba(28,23,13,0.95)'
      g.lineWidth = 1.3
      seg(dx, dy, inner, inner + 2.7)
      seg(dx, dy, outer - 2.3, outer)
      g.stroke()
      continue
    }
    g.beginPath()
    g.strokeStyle = major ? 'rgba(34,28,17,0.9)' : 'rgba(44,37,24,0.6)'
    // 整点刻度也压到 1px：3 / 6 / 9 点是水平 / 垂直的线，
    // 1.2px 会被抗锯齿铺成两行，放大后比斜的刻度粗一倍。
    g.lineWidth = major ? 1 : 0.8
    seg(dx, dy, inner, outer)
    g.stroke()
  }

  // 7) 指针：先一层 1px 的投影，再画本体。
  //    drawHand 的尖端画在本地 -y（十二点方向），所以旋转角直接用「从 12 点顺时针」
  //    的角度：时角 = 小时数 × 30°，分角 = 小时数的小数部分 × 360°。
  const hourRad = ((hour % 12) * 30) * Math.PI / 180
  const minRad = ((hour % 1) * 360) * Math.PI / 180
  const HOUR_LEN = 20
  const MIN_LEN = 28.5
  drawHand(g, hourRad, HOUR_LEN, 4.2, 'rgba(52,42,22,0.32)', 1)
  drawHand(g, minRad, MIN_LEN, 2.8, 'rgba(52,42,22,0.32)', 1)
  drawHand(g, hourRad, HOUR_LEN, 4.2, '#2b2417', 0)
  drawHand(g, minRad, MIN_LEN, 2.8, '#241d12', 0)

  // 8) 轴帽：黄铜小圆 + 一点高光
  const hub = g.createRadialGradient(-1, -1.2, 0.3, 0, 0, 3.7)
  hub.addColorStop(0, '#e8d7a5')
  hub.addColorStop(0.55, '#8d7440')
  hub.addColorStop(1, '#382d17')
  g.beginPath()
  g.arc(0, 0, 3.7, 0, Math.PI * 2)
  g.fillStyle = hub
  g.fill()
  g.strokeStyle = 'rgba(18,14,7,0.85)'
  g.lineWidth = 0.8
  g.beginPath()
  g.arc(0, 0, 3.7, 0, Math.PI * 2)
  g.stroke()

  // 9) 玻璃：一条左上斜向的宽反光 + 一小片弧形反光，裁在表盘里
  g.save()
  g.beginPath()
  g.arc(0, 0, FR - 0.4, 0, Math.PI * 2)
  g.clip()
  const glare = g.createLinearGradient(-FR, -FR, FR * 0.2, FR * 0.35)
  glare.addColorStop(0, 'rgba(255,255,255,0.16)')
  glare.addColorStop(0.4, 'rgba(255,255,255,0.045)')
  glare.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = glare
  g.fillRect(-FR, -FR, FR * 2, FR * 2)
  g.strokeStyle = 'rgba(255,255,255,0.09)'
  g.lineWidth = 1.6
  g.beginPath()
  g.arc(-R * 0.18, -R * 0.22, FR * 0.76, Math.PI * 1.04, Math.PI * 1.4)
  g.stroke()
  g.restore()

  // 10) 表壳外圈最后一道高光（压在玻璃之上，像壳沿的一线反光）
  g.strokeStyle = 'rgba(240,222,170,0.3)'
  g.lineWidth = 0.8
  g.beginPath()
  g.arc(0, 0, R - 3.4, Math.PI * 0.94, Math.PI * 1.88)
  g.stroke()

  g.restore()
}

// ---------------- 一帧 ----------------

function renderFrame(g: CanvasRenderingContext2D, t: number, sink: number): void {
  g.clearRect(0, 0, VIEW_W, VIEW_H)

  // 黑幕：0.9s 淡出 → 停在全黑 → 0.9s 淡入
  const fadeOut = clamp01(t / FADE_OUT_SEC)
  const fadeIn = clamp01((t - FADE_IN_AT) / FADE_IN_SEC)
  const black = fadeOut * (1 - fadeIn)
  if (black > 0.002) {
    // 与 renderer 的 drawFade 同一个黑
    g.fillStyle = `rgba(5,6,11,${black})`
    g.fillRect(0, 0, VIEW_W, VIEW_H)
  }

  // 钟表：映在黑上（先黑后钟，所以全黑的那一刻它已经在了）
  const clockIn = clamp01((t - CLOCK_IN_AT) / CLOCK_IN_SEC)
  const clockOut = clamp01((t - CLOCK_OUT_AT) / CLOCK_OUT_SEC)
  const clockA = clockIn * (1 - clockOut)
  if (clockA > 0.002) drawWatch(g, hourAt(t), clockA, sink)
}

// ---------------- 组件 ----------------

export function ClockInterlude({ onFinish }: { onFinish: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  /** 最新的 onFinish：父组件重渲染不会把这段转场重播一遍 */
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish
  /**
   * 组件此刻是否真的在树上。
   * 用来区分「真的被拔掉」和 StrictMode 开发期的 mount → unmount → mount ——
   * 后者如果当场清 flag，转场会在挂载的第一帧就被自己掐掉。
   */
  const mountedRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const g = canvas.getContext('2d')
    if (!g) return
    g.imageSmoothingEnabled = false
    mountedRef.current = true

    // modal 一立，engine 的 uiOpen 就冻住世界：黑幕底下没人会走动。
    startClockInterlude()

    // 转场期间吞掉按键（window 捕获阶段）：不跳对话、不开暂停菜单、不跑图。
    const onKey = (e: KeyboardEvent): void => {
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)

    const start = performance.now()
    let raf = 0
    let fallback = 0
    let finished = false
    /** 下一个要敲的整点（12 → 13，只敲这两下） */
    let nextHour = 12
    /** 整点那一下的震动结束时刻（秒） */
    let shakeUntil = -1

    const cleanup = (): void => {
      cancelAnimationFrame(raf)
      window.clearTimeout(fallback)
      window.removeEventListener('keydown', onKey, true)
    }

    const finishNow = (): void => {
      if (finished) return
      finished = true
      cleanup()
      finishRef.current()
    }

    const loop = (): void => {
      if (finished) return
      const t = (performance.now() - start) / 1000

      // 整点：走过 12:00 与 1:00 各一下 —— 一记很轻的钟 + 表盘下沉 1px
      const hour = hourAt(t)
      while (hour >= nextHour) {
        if (nextHour <= 13) {
          Snd.sfx('bell')
          shakeUntil = t + 0.18
        }
        nextHour++
      }
      // 「轻轻震一下」：整只表往下沉 1px，0.18s 后弹回原位
      const sink = t < shakeUntil ? 1 : 0

      renderFrame(g, t, sink)

      if (t >= TOTAL_SEC) {
        finishNow()
        return
      }
      raf = requestAnimationFrame(loop)
    }

    renderFrame(g, 0, 0)
    raf = requestAnimationFrame(loop)
    fallback = window.setTimeout(finishNow, FALLBACK_MS)

    return () => {
      finished = true
      mountedRef.current = false
      cleanup()
      // 组件被外面拔掉（切标题 / 读档）时也要把 modal 交还，否则世界一直冻着。
      // 但 StrictMode 开发期会先 unmount 再 mount 一次 —— 那不是真的卸载，
      // 当场清 flag 会把转场掐死在第一帧。推迟到下一轮事件循环：
      // 真卸载时 mountedRef 还是 false，重新挂载的 effect 已经把它设回 true。
      window.setTimeout(() => {
        if (!mountedRef.current) finishClockInterlude()
      }, 0)
    }
  }, [])

  return (
    <div className="clock-overlay">
      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        className="clock-canvas"
      />
    </div>
  )
}
