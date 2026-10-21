import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { advance, choose, useGame } from '../game/store'
import { SPEAKER_NAMES } from '../game/types'
import type { SpeakerId } from '../game/types'
import { PORTRAITS } from '../game/art/sprites'
import { Snd } from '../game/audio'

/**
 * 立绘分两类：
 *
 * 1. 素材立绘 —— 参考图经 scripts/make-portraits.py 用 NEAREST 还原到 256×256
 *    原生尺度（素材本身就是像素画，不能做任何平滑），四角 flood fill 抠背景，
 *    保留 alpha。显示 192×192。所有有参考图的角色都走这条。
 *
 * 2. 程序化 canvas —— 没有参考图的角色兜底（目前仅剩端口占位用）。
 */
const PORTRAIT_IMAGES: Record<string, string> = {
  ftz: './portraits/ftz.webp',
  ftzCold: './portraits/ftz-cold.webp',
  emma: './portraits/emma.webp',
  emmaQuiet: './portraits/emma-quiet.webp',
  hermann: './portraits/hermann.webp',
  hermannVoid: './portraits/hermann-void.webp',
  marta: './portraits/marta.webp',
  // 彩蛋角色：素材本身带透明通道，走普通立绘路径（不再是白底相片）
  ds: './portraits/ds.webp',
}
const PORTRAIT_PHOTOS: Record<string, string> = {}

// ---------------- 打字机参数 ----------------

/** 基础速度（字/秒，中文按码点算，不按字节） */
const CPS_DEFAULT = 28
/** 艾玛：她说话慢，像是在斟酌措辞 */
const CPS_EMMA = 20
/** 年长者的从容（赫尔曼）/ 厨娘的爽利（玛尔塔）/ 广播 */
const CPS_BRISK = 36

/** 标点之后的额外停顿（ms） */
const PAUSE_STOP = 220       // 。？！
const PAUSE_BREAK = 90       // ，、；：
const PAUSE_DASH = 340       // ——
const PAUSE_ELLIPSIS = 300   // ……
const PAUSE_CLOSE = 140      // 」）

/** 说话人名字先出现，给一个呼吸再开始出字 */
const START_DELAY = 120
/** 整句显示完整之后，至少这么久才接受推进（防手滑连按一次补完 + 一次推进） */
const ADVANCE_COOLDOWN = 120
/** 击键音：每 3 个字响一次（每个字都响太吵） */
const SFX_EVERY_CHARS = 3

interface TypePlan {
  /** 字/秒 */
  cps: number
  /** 是否吃标点停顿（广播是机械匀速，不停） */
  punct: boolean
}

/**
 * 按说话人 + 文本决定这一句的节奏。
 * 广播类优先级最高：台词里带【或以「[ 」开头 —— 机器念的，匀速且不吃标点停顿。
 */
function typePlan(sp: SpeakerId | null, text: string): TypePlan {
  if (text.includes('【') || text.trimStart().startsWith('[ ')) {
    return { cps: CPS_BRISK, punct: false }
  }
  switch (sp) {
    case 'emma':
    case 'emmaQuiet':
      return { cps: CPS_EMMA, punct: true }
    case 'hermann':
    case 'hermannVoid':
    case 'marta':
      return { cps: CPS_BRISK, punct: true }
    default:
      // none 旁白 / ftz 主角 / ftzCold / voice / ds
      return { cps: CPS_DEFAULT, punct: true }
  }
}

/**
 * 刚揭示的字符之后要额外等多久。
 * —— / …… 是两个字组成的标点串：只在收尾那个字上停一次，否则会停双份。
 */
function pauseAfter(chars: string[], idx: number): number {
  const c = chars[idx]
  if (c === '—') return chars[idx + 1] === '—' ? 0 : PAUSE_DASH
  if (c === '…') return chars[idx + 1] === '…' ? 0 : PAUSE_ELLIPSIS
  switch (c) {
    case '。': case '？': case '！': return PAUSE_STOP
    case '，': case '、': case '；': case '：': return PAUSE_BREAK
    case '」': case '）': return PAUSE_CLOSE
    default: return 0
  }
}

/** 一句台词的打字状态：只活在 DialogBox 内部，不进全局 store */
interface TypeState {
  /** 已揭示字数 */
  shown: number
  /** 是否已完整显示（自然打完或被补完） */
  done: boolean
  /** 可以推进的时刻 = 完成时刻 + ADVANCE_COOLDOWN */
  readyAt: number
  /** 立刻显示整句 */
  skip: () => void
}

/**
 * 一次推进输入（E / 空格 / 回车 / 点击）的归属：
 * - 打字中 → 补完整句，这次输入到此为止（绝不推进）
 * - 刚补完的 120ms 内 → 吞掉（同一次连按的余震）
 * - 已完整显示 → 放行给 advance()
 */
function consumeAdvanceInput(t: TypeState | null): boolean {
  if (!t) return false
  if (!t.done) {
    t.skip()
    return true
  }
  return performance.now() < t.readyAt
}

export function DialogBox() {
  const dialog = useGame(s => s.dialog)
  const portraitRef = useRef<HTMLDivElement | null>(null)
  /** 台词由 rAF 直接写 textContent：不逐帧 setState，避免整框跟着重渲染 */
  const textRef = useRef<HTMLDivElement | null>(null)
  const typerRef = useRef<TypeState | null>(null)
  /** 整句是否出完 —— 只用来控制 ▼ 的出现时机 */
  const [lineDone, setLineDone] = useState(false)

  const line = dialog?.line
  const choices = dialog?.choices
  const sp = line?.sp ?? null
  const photoSrc = sp && PORTRAIT_PHOTOS[sp] ? PORTRAIT_PHOTOS[sp] : null
  const imgSrc = sp && PORTRAIT_IMAGES[sp] ? PORTRAIT_IMAGES[sp] : null
  const drawKey = sp && !photoSrc && !imgSrc && PORTRAITS[sp] ? sp : null

  useEffect(() => {
    const el = portraitRef.current
    if (!el) return
    el.innerHTML = ''
    if (!drawKey) return
    // 程序化立绘是 96×96 方形画布，由 CSS 放大到 192×192
    const src = PORTRAITS[drawKey]
    const c = document.createElement('canvas')
    c.width = src.width
    c.height = src.height
    const g = c.getContext('2d')
    if (g) {
      g.imageSmoothingEnabled = false
      g.drawImage(src, 0, 0)
    }
    c.className = 'portrait-canvas'
    el.appendChild(c)
  }, [drawKey])

  /**
   * 逐字揭示：requestAnimationFrame 驱动。
   * - 台词变化 / 组件卸载都会在 cleanup 里 cancelAnimationFrame，不留挂起帧
   * - 台词文本直接写 textContent，React 这一侧永远渲染空节点，不会被 reconcile 覆盖
   */
  useLayoutEffect(() => {
    const el = textRef.current
    typerRef.current = null
    setLineDone(false)
    if (!el) return
    el.textContent = ''
    if (!line) return

    const chars = Array.from(line.text)
    const plan = typePlan(line.sp, line.text)
    const baseStep = 1000 / plan.cps
    const st: TypeState = {
      shown: 0,
      done: false,
      readyAt: Number.POSITIVE_INFINITY,
      skip: () => {},
    }
    let raf = 0
    let alive = true
    /** 第一个字的时刻：名字先亮，再让字开始走 */
    let nextAt = performance.now() + START_DELAY

    const stop = (): void => {
      if (raf) { cancelAnimationFrame(raf); raf = 0 }
    }

    const complete = (): void => {
      if (st.done) return
      st.done = true
      st.shown = chars.length
      stop()
      el.textContent = line.text
      st.readyAt = performance.now() + ADVANCE_COOLDOWN
      if (alive) setLineDone(true)
    }

    st.skip = complete

    const tick = (now: number): void => {
      raf = 0
      if (!alive || st.done) return
      // 一口气追平：标签页被节流回来时不会把动画拖很久，停顿仍然生效
      let ping = false
      while (now >= nextAt && st.shown < chars.length) {
        st.shown++
        if (st.shown % SFX_EVERY_CHARS === 0) ping = true
        nextAt += baseStep + (plan.punct ? pauseAfter(chars, st.shown - 1) : 0)
      }
      // 同一帧最多响一次：掉帧追赶时不会把几声叠成一声爆音
      if (ping) Snd.sfx('type')
      if (st.shown > 0) el.textContent = chars.slice(0, st.shown).join('')
      if (st.shown >= chars.length) { complete(); return }
      raf = requestAnimationFrame(tick)
    }

    typerRef.current = st
    raf = requestAnimationFrame(tick)

    // 兜底一：rAF 在后台标签页、部分无头/虚拟时间环境里可能完全不推进，
    // 那样文字会永远停在空白。按理论总时长再加 1.5 秒，超时就整句补完。
    const totalMs = START_DELAY + chars.reduce(
      (acc, _ch, i) => acc + baseStep + (plan.punct ? pauseAfter(chars, i) : 0), 0,
    )
    const guard = window.setTimeout(complete, totalMs + 1500)

    // 兜底二：页面被切到后台时立刻补完 —— 玩家切回来不该看到半句话
    const onVis = (): void => { if (document.hidden) complete() }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      alive = false
      stop()
      window.clearTimeout(guard)
      document.removeEventListener('visibilitychange', onVis)
      st.done = true
      if (typerRef.current === st) typerRef.current = null
    }
  }, [line])

  /**
   * 拦在 App.tsx 的推进键之前（捕获阶段）：
   * 打字中按 E / 空格 / 回车只补完整句，不推进；冷却期内直接吞掉。
   * 只有「已出完 + 冷却结束」才放行，让原来的 advance() 照常推进。
   */
  useEffect(() => {
    if (!line) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'e' && e.key !== ' ' && e.key !== 'Enter') return
      if (!consumeAdvanceInput(typerRef.current)) return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [line])

  if (!dialog) return null

  const onWrapClick = (): void => {
    if (choices) return
    // 打字中点击 = 补完整句；补完后的 120ms 内点击被吞掉；之后才推进
    if (consumeAdvanceInput(typerRef.current)) return
    advance()
  }

  return (
    <div className="dialog-wrap" onClick={onWrapClick}>
      {line && (
        <div className="dialog-row">
          <div className={'portrait-slot' + (drawKey || photoSrc || imgSrc ? '' : ' empty')}>
            <div ref={portraitRef} />
            {imgSrc && <img src={imgSrc} className="portrait-image" alt="" />}
            {photoSrc && <img src={photoSrc} className="portrait-photo" alt="" />}
          </div>
          <div className={'dialog-box sp-' + (line.sp ?? 'none')}>
            {line.sp && line.sp !== 'none' && (
              <div className="speaker">{SPEAKER_NAMES[line.sp]}</div>
            )}
            <div className="dialog-text" ref={textRef} />
            {lineDone && <div className="dialog-next enter">▼</div>}
          </div>
        </div>
      )}
      {choices && (
        <div className="choices">
          {choices.map((c, i) => (
            <button
              key={i}
              className="choice"
              onClick={e => { e.stopPropagation(); choose(i) }}
            >
              <span className="choice-no">{i + 1}</span>
              {c.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
