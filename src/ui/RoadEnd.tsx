// ============================================================
// 山路尽头的过场播放器：第一视角，雨中上山，尽头是聚斯霍芬堡（16.2s）
//
// 与 Montage.tsx 同一付骨架（照抄那套骨架，不照抄画法）：
//   · 全屏 canvas，384×216 逻辑分辨率（与游戏一致）；
//   · renderFrame(g, t) 是纯函数，任意一秒都能直接画出来 —— 跳过就靠这条性质；
//   · rAF 驱动，组件卸载 / 跳过时一定 cancelAnimationFrame；
//   · 另加一道 setTimeout 兜底：后台标签页里 rAF 不跑，过场不能永久卡在那一帧。
//
// 声音（这一段只调 audio.ts 已有的入口，不改那个文件）：
//   0.0   Snd.setScene('station') + Snd.setBgm(null)
//         —— station 那一层的第一条就是 1700Hz 的噪声，也就是「雨打在雨棚上」；
//            它是这一整段里唯一稳定的雨声。BGM 立刻压掉（过场不该有旋律）。
//   每步  Snd.sfx('type') —— 18~25ms 的低频敲击，正好是踩进泥里的那种闷响；
//   每两步 Snd.sfx('door') —— 88Hz 一个短促的低音，听感是一声粗重的呼气；
//   11.2  Snd.sfx('bell') —— 轮廓从雾里浮出来那一记低沉的钟；
//   13.6  Snd.setScene('night') —— 雨收掉，只留极低频的一点空气。
//   结束  交还场景（游戏里 engine 下一帧就把 gate 的那一层接回去）。
//
// 跳过：任意键 / 点击 → 落到轮廓占满画面的那一帧（ROAD_END_SKIP_AT），
//       停 160ms 再结束；错过的脚步声与钟声不补放，静音该到就到。
//
// 调试：?ui=roadend 直接铺在标题画面上看全片；
//       ?roadend=<秒> 定帧（静音、不播放，用来截图）。
// ============================================================
import { useEffect, useRef } from 'react'
import { Snd } from '../game/audio'
import {
  ROADEND_H,
  ROADEND_SKIP_AT,
  ROADEND_TOTAL,
  ROADEND_W,
  ROAD_END_BELL_AT,
  ROAD_END_BREATHS,
  ROAD_END_FOOTSTEPS,
  ROAD_END_SILENT_AT,
  renderFrame,
} from '../game/art/roadEnd'

/** 跳过时把落点那一帧留一下再交还画面 */
const SKIP_HOLD_MS = 160

/**
 * rAF 兜底：后台标签页 / 系统休眠时 requestAnimationFrame 不跑，
 * 过场会永久停在最后一帧。这条 setTimeout 不依赖帧，到点直接收尾。
 */
const FALLBACK_MS = (ROADEND_TOTAL + 2.5) * 1000

/**
 * 定帧入口：URL 里带 ?roadend=<秒> 时只画那一帧（不播放、不发声）。
 * 平时返回 null，播放流程完全不受影响。
 */
function freezeAt(): number | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('roadend')
  if (raw == null || raw === '') return null
  const t = Number(raw)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.min(t, ROADEND_TOTAL))
}

export function RoadEnd({ demo = false, onFinish }: { demo?: boolean; onFinish: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  /** 跳过：effect 内部定义，React 的点击回调通过 ref 拿到它 */
  const skipRef = useRef<() => void>(() => {})
  /** 最新的 onFinish（父组件重渲染不会重启播放） */
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const g = canvas.getContext('2d')
    if (!g) return
    g.imageSmoothingEnabled = false

    // ---- 定帧调试：只画那一帧，不碰音频 ----
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

    Snd.start()
    // 雨：station 那一层（1700Hz 噪声）就是雨；BGM 立刻压掉。
    Snd.setScene('station')
    Snd.setBgm(null)

    const start = performance.now()
    let raf = 0
    let stopped = false
    let finished = false
    let holdTimer = 0
    let fallbackTimer = 0
    /** 脚步 / 呼吸各走一个游标：掉帧跨过多步也不会漏（while 一次补齐） */
    let stepIdx = 0
    let breathIdx = 0
    let bellFired = false
    let silentFired = false

    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      e.stopPropagation()
      skip()
    }

    const removeListeners = (): void => {
      window.removeEventListener('keydown', onKey, true)
    }

    const finishNow = (): void => {
      if (finished) return
      finished = true
      cancelAnimationFrame(raf)
      window.clearTimeout(fallbackTimer)
      window.clearTimeout(holdTimer)
      removeListeners()
      // 把音乐还给外面那一层：游戏里下一帧 engine 就会 setScene('gate')，
      // 调试入口回到标题曲。
      Snd.setBgm(demo ? 'title' : null)
      finishRef.current()
    }

    // 跳过：直接落到轮廓占满画面的那一帧，停一下再结束。
    const skip = (): void => {
      if (stopped || finished) return
      stopped = true
      cancelAnimationFrame(raf)
      window.clearTimeout(fallbackTimer)
      removeListeners()
      // 雨该停了：跳到最后一帧时不该还下着 13.6s 之前的雨
      if (!silentFired) {
        silentFired = true
        Snd.setScene('night')
      }
      renderFrame(g, ROADEND_SKIP_AT)
      holdTimer = window.setTimeout(finishNow, SKIP_HOLD_MS)
    }
    skipRef.current = skip

    const loop = (): void => {
      if (stopped || finished) return
      const t = (performance.now() - start) / 1000

      // 脚步：踩进泥里的那一下
      while (stepIdx < ROAD_END_FOOTSTEPS.length && t >= ROAD_END_FOOTSTEPS[stepIdx].t0) {
        stepIdx++
        Snd.sfx('type')
      }
      // 呼吸：每两步一次，越到后面越重（audio.ts 的 'door' 是 88Hz 的一个短低音）
      while (breathIdx < ROAD_END_BREATHS.length && t >= ROAD_END_BREATHS[breathIdx]) {
        breathIdx++
        Snd.sfx('door')
      }
      // 钟：轮廓浮出到一半
      if (!bellFired && t >= ROAD_END_BELL_AT) {
        bellFired = true
        Snd.sfx('bell')
      }
      // 雨收掉
      if (!silentFired && t >= ROAD_END_SILENT_AT) {
        silentFired = true
        Snd.setScene('night')
      }

      renderFrame(g, Math.min(t, ROADEND_TOTAL))
      if (t >= ROADEND_TOTAL) {
        finishNow()
        return
      }
      raf = requestAnimationFrame(loop)
    }

    window.addEventListener('keydown', onKey, true)
    fallbackTimer = window.setTimeout(finishNow, FALLBACK_MS)
    renderFrame(g, 0)
    raf = requestAnimationFrame(loop)

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      window.clearTimeout(fallbackTimer)
      window.clearTimeout(holdTimer)
      removeListeners()
    }
  }, [demo])

  return (
    <div className="roadend-overlay" onClick={() => skipRef.current()}>
      <canvas
        ref={canvasRef}
        width={ROADEND_W}
        height={ROADEND_H}
        className="roadend-canvas"
      />
      <div className="roadend-hint">任意键跳过</div>
    </div>
  )
}
