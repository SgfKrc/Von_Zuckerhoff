// ============================================================
// 章末演出的播放器：序章结束时的独角戏（约 53 秒）
//
// 与 RoadEnd.tsx / Montage.tsx 同一付骨架（照抄那套骨架，不照抄画法）：
//   · 全屏 canvas，384×216 逻辑分辨率（与游戏一致）；
//   · renderFrame(g, t) 是纯函数，任意一秒都能直接画出来 —— 跳段靠这条性质；
//   · rAF 驱动，组件卸载 / 结束时一定 cancelAnimationFrame；
//   · 另加一道 setTimeout 兜底：后台标签页里 rAF 不跑，过场不能永久卡在那一帧。
//
// 谁挂起它：script.ts 里 talkHermannHall 的最后一步立 flags.chapterFinale，
// App.tsx 认这个 flag，本组件挂载时调 startChapterFinale() 立 modal（世界冻结）
// —— 与 ClockInterlude 同一条路。播完调 finishChapterFinale()：
// 切章节卡「第一章 糖庄」，并把玩家送进卧室（第一章的起点）。
//
// 声音（只调 audio.ts 已有的入口，不改那个文件）：
//   0.0  Snd.setScene('night') + setBgm(null)
//        —— 窗外、黑森林、莱茵河这三段只有夜的低频；过场不该有旋律。
//   15.0 Snd.setScene('interior') —— 回到大厅，那一层有 58Hz 的呼吸与稀疏的钟。
//   其余 CF_BEATS：闷响、钟、火花的噼啪、嘴唇特写那一记下坠的锯齿。
//
// 跳过（按段跳）：每按一次跳过键，落到 CF_SHOTS 里**下一个镜头的起点**；
//   连按就连跳。跳到最后一个镜头之后，再按一次才整段结束（停 160ms）。
//   每次跳段右下角显示一行「跳过 · n / m」，1 秒后淡出；
//   错过的音效一律不补放（游标直接推过去），场景层该换就换。
//
// 调试：?ui=chapterfinale 直接铺在标题画面上看全片；
//       &chapterfinale=<秒> 定帧（静音、不播放，用来截图）。
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { Snd } from '../game/audio'
import { abortChapterFinale, finishChapterFinale, startChapterFinale } from '../game/store'
import {
  CF_BEATS,
  CF_H,
  CF_SCENE_AT,
  CF_SHOTS,
  CF_SKIP_AT,
  CF_TOTAL,
  CF_W,
  renderFrame,
} from '../game/art/chapterFinale'

/** 跳过时把落点那一帧留一下再交还画面 */
const SKIP_HOLD_MS = 160

/** 十四个镜头的起点（秒）。按段跳就是在这张表上前进一格。 */
const SHOT_STARTS: ReadonlyArray<number> = CF_SHOTS.map(s => s.t0)

/**
 * rAF 兜底：后台标签页 / 系统休眠时 requestAnimationFrame 不跑，
 * 过场会永久停在最后一帧。这条 setTimeout 不依赖帧，到点直接收尾。
 */
const FALLBACK_MS = (CF_TOTAL + 2.5) * 1000

/**
 * 定帧入口：URL 里带 ?chapterfinale=<秒> 时只画那一帧（不播放、不发声）。
 * 平时返回 null，播放流程完全不受影响。
 */
function freezeAt(): number | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('chapterfinale')
  if (raw == null || raw === '') return null
  const t = Number(raw)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.min(t, CF_TOTAL))
}

export function ChapterFinale({ demo = false, onFinish }: { demo?: boolean; onFinish: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  /** 跳过：effect 内部定义，React 的点击回调通过 ref 拿到它 */
  const skipRef = useRef<() => void>(() => {})
  /** 最新的 onFinish（父组件重渲染不会重启播放） */
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish
  /**
   * 组件此刻是否真的在树上：区分「真的被拔掉」与 StrictMode 的
   * mount → unmount → mount（后者不能当场把 modal 交还）。
   */
  const mountedRef = useRef(false)
  /** 右下角那行「跳过 · n / m」；seq 只用来重启 CSS 动画 */
  const [skipNote, setSkipNote] = useState<{ n: number; m: number; seq: number } | null>(null)
  const noteSeq = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const g = canvas.getContext('2d')
    if (!g) return
    g.imageSmoothingEnabled = false
    mountedRef.current = true

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

    // modal 一立，engine 的 uiOpen 就冻住世界：演出期间没人会走、也没人能按 E。
    startChapterFinale()

    Snd.start()
    // 窗外 / 远景：只有夜的低频。BGM 立刻压掉（过场不该有旋律）。
    Snd.setScene('night')
    Snd.setBgm(null)

    const start = performance.now()
    let raf = 0
    let stopped = false
    let finished = false
    let holdTimer = 0
    let fallbackTimer = 0
    /** 音效游标：掉帧跨过几个锚点也不会漏（while 一次补齐） */
    let beatIdx = 0
    let sceneFired = false
    /** 按段跳的偏移量：跳过的秒数加在这里，播放头不会真的「倒回去再走」 */
    let tOffset = 0

    /** 此刻的播放时间（秒）：自然流逝 + 跳段偏移 */
    const nowT = (): number => (performance.now() - start) / 1000 + tOffset

    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      e.stopPropagation()
      if (e.repeat) return   // 按住不放不连跳：连按是「按」，不是「压」
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
      // 把音乐还给外面那一层：游戏里下一帧 engine 就会 setScene('bedroom1')，
      // 调试入口回到标题曲。
      Snd.setBgm(demo ? 'title' : null)
      finishRef.current()
    }

    /** 跳段时把错过的音效锚点与场景切换吞掉（不补放，只把状态推到位） */
    const catchUp = (to: number): void => {
      while (beatIdx < CF_BEATS.length && CF_BEATS[beatIdx].t < to - 1e-3) beatIdx++
      if (!sceneFired && to >= CF_SCENE_AT) {
        sceneFired = true
        Snd.setScene('interior')
      }
    }

    /** 已经在最后一段：再按一次才结束整段（停在落点那一帧，160ms 后交还画面） */
    const endSegment = (): void => {
      if (stopped || finished) return
      stopped = true
      cancelAnimationFrame(raf)
      window.clearTimeout(fallbackTimer)
      removeListeners()
      if (!sceneFired) {
        sceneFired = true
        Snd.setScene('interior')
      }
      renderFrame(g, CF_SKIP_AT)
      holdTimer = window.setTimeout(finishNow, SKIP_HOLD_MS)
    }

    // 跳过：落到下一个镜头的起点。连按就连跳；最后一段之后再按才结束。
    const skip = (): void => {
      if (stopped || finished) return
      const t = nowT()
      let next = SHOT_STARTS.length
      for (let i = 0; i < SHOT_STARTS.length; i++) {
        if (SHOT_STARTS[i] > t + 0.02) { next = i; break }
      }
      if (next >= SHOT_STARTS.length) {
        endSegment()
        return
      }
      tOffset += SHOT_STARTS[next] - t
      catchUp(SHOT_STARTS[next])
      renderFrame(g, SHOT_STARTS[next])
      noteSeq.current += 1
      setSkipNote({ n: next + 1, m: SHOT_STARTS.length, seq: noteSeq.current })
    }
    skipRef.current = skip

    const loop = (): void => {
      if (stopped || finished) return
      const t = nowT()

      // 音效锚点：跳到 15s 才换场景（窗外那三段是夜，之后是大厅）
      while (beatIdx < CF_BEATS.length && t >= CF_BEATS[beatIdx].t) {
        const beat = CF_BEATS[beatIdx]
        beatIdx++
        if (beat.sfx) Snd.sfx(beat.sfx)
      }
      if (!sceneFired && t >= CF_SCENE_AT) {
        sceneFired = true
        Snd.setScene('interior')
      }

      renderFrame(g, Math.min(t, CF_TOTAL))
      if (t >= CF_TOTAL) {
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
      mountedRef.current = false
      // 真的被外面拔掉（切标题 / 读档）时把 flag 与 modal 交还，但不切章节：
      // 章节卡的切换只属于「播完」这一条路。推迟一轮事件循环，避开 StrictMode。
      window.setTimeout(() => {
        if (!mountedRef.current) abortChapterFinale()
      }, 0)
    }
  }, [demo])

  return (
    <div className="chapter-finale-overlay" onClick={() => skipRef.current()}>
      <canvas
        ref={canvasRef}
        width={CF_W}
        height={CF_H}
        className="chapter-finale-canvas"
      />
      <div className="chapter-finale-hint">任意键跳过 · 每次跳一段</div>
      {skipNote && (
        <div key={skipNote.seq} className="cutscene-skip">
          跳过 · {skipNote.n} / {skipNote.m}
        </div>
      )}
    </div>
  )
}
