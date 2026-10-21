// ============================================================
// 木刻蒙太奇播放器：法兰克福的前半生（七张版画，31.6s）
//
// 与 Opening.tsx 同一付骨架：
//   · 全屏 canvas，384×216 逻辑分辨率（与游戏一致），木刻只有墨黑与纸白两色；
//   · renderFrame(g, t) 是纯函数，任意一秒都能直接画出来 —— 跳过就靠这条性质；
//   · rAF 驱动，组件卸载 / 跳过时一定 cancelAnimationFrame；
//   · 另加一道 setTimeout 兜底：后台标签页里 rAF 不跑，过场不能永久卡在那一帧。
//
// 时间轴（每镜头：木刻淡入 0.5s → 旁白逐字打出 → 停留 → 淡出 0.4s）：
//    I   3.8s  孤儿院门口
//    II  4.8s  工厂车间（+ 一记钟声：时间被吃掉的标点）
//    III 4.8s  夜校阁楼
//    IV  4.8s  考场
//    V   4.0s  放榜
//    VI  4.8s  船厂
//    VII 4.6s  回到古堡（libraryDream 淡入：从梦回到现实）
//   合计 31.6s
//
// 声音：
//   镜头 1–6  setScene('night') —— 只剩极轻的低音 drone，BGM 让位给版画；
//   镜头 2    一声 bell，正好落在工头把童工领进车间的那个节拍上；
//   镜头 7    setBgm('libraryDream') 淡入 —— 全片唯一的旋律出现在「古堡」；
//   旁白      每 3 个字一次 Snd.sfx('type')（与 DialogBox 的击键音同源）。
//
// 跳过：任意键 / 点击 → 落到最后一个镜头的最后一帧（淡出前那一帧），
//       停 160ms 再结束；错过的钟声不补放。
//
// 调试：?ui=montage 直接铺在标题画面上看全片；
//       ?ui=montage&montage=<秒> 定帧（静音、不播放，用来截图）。
// ============================================================
import { useEffect, useRef } from 'react'
import { Snd } from '../game/audio'
import {
  MONTAGE_BELL_AT,
  MONTAGE_BGM_AT,
  MONTAGE_H,
  MONTAGE_SKIP_AT,
  MONTAGE_TOTAL,
  MONTAGE_W,
  renderFrame,
  typedAt,
} from '../game/art/montage'

/** 跳过时把落点那一帧留一下再交还画面 */
const SKIP_HOLD_MS = 160

/**
 * rAF 兜底：后台标签页 / 系统休眠时 requestAnimationFrame 不跑，
 * 过场会永久停在最后一帧。这条 setTimeout 不依赖帧，到点直接收尾。
 */
const FALLBACK_MS = (MONTAGE_TOTAL + 2.5) * 1000

/**
 * 定帧入口：URL 里带 ?montage=<秒> 时只画那一帧（不播放、不发声）。
 * 平时返回 null，播放流程完全不受影响。
 */
function freezeAt(): number | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('montage')
  if (raw == null || raw === '') return null
  const t = Number(raw)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.min(t, MONTAGE_TOTAL))
}

export function Montage({ demo = false, onFinish }: { demo?: boolean; onFinish: () => void }) {
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
    // 镜头 1–6：静音，只留一层极轻的低音 drone（夜）。
    // 不用 'silent'：audio.ts 对「从标题切 silent」有开场曲特判，会把开场曲拉起来。
    Snd.setScene('night')
    Snd.setBgm(null)

    const start = performance.now()
    let raf = 0
    let stopped = false
    let finished = false
    let holdTimer = 0
    let fallbackTimer = 0
    /** 钟声 / BGM 各只触发一次（掉帧跨过锚点也不会补两遍） */
    let bellFired = false
    let bgmFired = false
    /** 上一帧的打字进度：用来每 3 个字响一下击键音 */
    let prevShot = 0
    let prevShown = 0

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
      // 把音乐还给外面那一层：游戏里是古堡内部，调试入口是标题曲。
      // （游戏里 engine 下一帧还会 setScene('interior') 把环境层也接回去。）
      Snd.setBgm(demo ? 'title' : 'interior')
      finishRef.current()
    }

    // 跳过：直接落到最后一个镜头的最后一帧，停一下再结束。
    // 错过的钟声不补放；第 7 镜头的 BGM 该在就让它进来。
    const skip = (): void => {
      if (stopped || finished) return
      stopped = true
      cancelAnimationFrame(raf)
      window.clearTimeout(fallbackTimer)
      removeListeners()
      if (!bgmFired) {
        bgmFired = true
        Snd.setBgm('libraryDream')
      }
      renderFrame(g, MONTAGE_SKIP_AT)
      holdTimer = window.setTimeout(finishNow, SKIP_HOLD_MS)
    }
    skipRef.current = skip

    const loop = (): void => {
      if (stopped || finished) return
      const t = (performance.now() - start) / 1000

      // 镜头 2：一声钟 —— 时间被吃掉的那个标点
      if (!bellFired && t >= MONTAGE_BELL_AT) {
        bellFired = true
        Snd.sfx('bell')
      }
      // 镜头 7：古堡的八音盒淡入 —— 从梦回到现实
      if (!bgmFired && t >= MONTAGE_BGM_AT) {
        bgmFired = true
        Snd.setBgm('libraryDream')
      }
      // 旁白逐字：每 3 个字一下击键音（每字都响会变成节拍器）
      const prog = typedAt(t)
      if (prog.shot === prevShot &&
        Math.floor(prog.shown / 3) > Math.floor(prevShown / 3)) {
        Snd.sfx('type')
      }
      prevShot = prog.shot
      prevShown = prog.shown

      renderFrame(g, Math.min(t, MONTAGE_TOTAL))
      if (t >= MONTAGE_TOTAL) {
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
    <div className="montage-overlay" onClick={() => skipRef.current()}>
      <canvas
        ref={canvasRef}
        width={MONTAGE_W}
        height={MONTAGE_H}
        className="montage-canvas"
      />
      <div className="montage-hint">任意键跳过</div>
    </div>
  )
}
