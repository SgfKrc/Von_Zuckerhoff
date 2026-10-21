import { useEffect, useRef, useState } from 'react'
import { finishEtiquette, setModal, startScript, useGame } from '../game/store'

/**
 * 场景 11：礼仪课。
 *
 * 画面是《贵族礼仪规范》摊开的一页：
 *   ① 三道选择题（主人坐哪儿 / 两位公爵 / 年限与血缘都一样）
 *   ② 总分 0–3 与她的评价
 *   ③ 第 4 题不算题：皇帝的全称，逐字打出来（纯展示）
 *
 * 结束顺序固定：finishEtiquette(分数) → startScript('etiquetteAfter')。
 * 礼仪分写进 flags.etiquetteScore，第六章千面之月的宴会才用来结账。
 *
 * 键盘：1/2/3 或 ↑↓ + Enter；鼠标也能点。
 * Esc 不退出 —— 那一页还没有讲完。
 */

const EMPEROR_TITLE =
  '全高哥特人的皇帝，巴伐利亚的统治者，罗马人的国王，勃艮第的宗主，' +
  '拿坡里的王冠持有者，神圣罗马帝国的继承者，铁十字黑秃鹫的守护人，' +
  '伟大的大选帝侯'

/** 皇帝全称按码点切开：中文一个字一个码点，逐字打不需要处理代理对 */
const TITLE_CHARS = Array.from(EMPEROR_TITLE)

/** 她的那句玩笑：第 3 题答完以后，无论对错都要出现（原作 L819） */
const JOKE = '这是玩笑，少爷。'
const JOKE_NARR = '（我试图从那张冷淡的面孔上找到一丝说笑过的痕迹。我找不到。）'

interface Quiz {
  /** 她出题前的那句（书页上的一小段话） */
  ask: string
  /** 题目 */
  q: string
  opts: [string, string, string]
  /** 正确项的索引 */
  correct: number
  /** 答错：她纠正 */
  wrong: string
  /** 答错：她再重复一遍正确的 */
  again: string
  /** 答对时她额外的动作（冷记录） */
  rightNote: string
}

const QUIZZES: Quiz[] = [
  {
    ask: '她把木棍横过来，点在长桌中央。',
    q: '主人应该坐在长桌的什么位置？',
    opts: [
      '长桌一端，面向壁炉',
      '长桌中央，背对壁炉，面向大门',
      '随便坐，主人优先',
    ],
    correct: 1,
    wrong: '不对。是长桌中央。背对壁炉，面向大门。',
    again: '再说一遍。长桌中央。背对壁炉，面向大门。',
    rightNote: '她把木棍在页边点了两下，没有抬头。',
  },
  {
    ask: '木棍移到图二。两个名字被圈了出来。',
    q: '如果同时有两位公爵，座位怎么排？',
    opts: [
      '按年龄，年长的优先',
      '按封地年限，更古老的优先',
      '并排坐，不分高下',
    ],
    correct: 1,
    wrong: '不对。是按封地年限。更古老的优先。',
    again: '再说一遍。封地年限。更古老的优先。',
    rightNote: '她在页边写下两个字，笔尖没有停顿。',
  },
  {
    ask: '木棍停住了。她抬起眼睛看他。',
    q: '封地年限一样，与皇室的血缘亲疏也一样。怎么办？',
    opts: [
      '抽签',
      '谁先到谁先坐',
      '请他们去庭院里用剑解决问题',
    ],
    correct: 2,
    wrong: '不对。是请他们去庭院。用剑解决问题。',
    again: '再说一遍。请他们去庭院，用剑解决问题。',
    rightNote: '她看了他一眼。灰色的瞳孔里没有波动。',
  },
]

/** 三道题的总分 → 她的评价（第一行是记录，第二行是评价） */
const SCORE_LINES: [string, string][] = [
  ['零。今天到此为止。', '（她把书合上了。）'],
  ['一题。您还得再来一遍。', '（她说话的时候，木棍没有离手。）'],
  ['两题。够用了。', '（剩下的，宴会那天再补。）'],
  ['三题。没有错。像样的继承人。', '（她第一次没有补上「少爷」。）'],
]

type Phase = 'quiz' | 'result' | 'score' | 'emperor'

/** 皇帝全称的打字节奏：逗号停一下，句号停久一点 */
function charDelay(ch: string): number {
  if (ch === '，' || ch === '、') return 110
  if (ch === '。') return 200
  return 26
}

export function EtiquetteQuiz() {
  const active = useGame(s => !!s.flags['etiquetteQuizActive'])
  const wasActive = useRef(false)

  const [phase, setPhase] = useState<Phase>('quiz')
  const [qi, setQi] = useState(0)
  const [sel, setSel] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [tilt, setTilt] = useState(-5)
  const [typed, setTyped] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  /** 答对题数。用 ref 存：finish 时拿到的永远是最新值，不受 setState 延迟影响 */
  const hitsRef = useRef(0)
  /** 结束只走一次 */
  const doneRef = useRef(false)
  const noticeTimer = useRef<number | null>(null)

  // ---- 打开 / 关闭 ----
  useEffect(() => {
    if (active) {
      setPhase('quiz')
      setQi(0)
      setSel(0)
      setPicked(null)
      setTilt(-5)
      setTyped(0)
      setNotice(null)
      hitsRef.current = 0
      doneRef.current = false
      setModal('etiquette')
    } else if (wasActive.current) {
      // 只在「从打开变成关闭」时清模态：初次挂载时不要把别人的模态关掉
      setModal(null)
    }
    wasActive.current = active
  }, [active])

  // ---- 计时器的清理 ----
  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
  }, [])

  // ---- 皇帝全称：逐字打 ----
  useEffect(() => {
    if (!active || phase !== 'emperor' || typed >= TITLE_CHARS.length) return
    const delay = typed === 0 ? 280 : charDelay(TITLE_CHARS[typed - 1])
    const t = window.setTimeout(() => {
      setTyped(n => Math.min(TITLE_CHARS.length, n + 1))
    }, delay)
    return () => window.clearTimeout(t)
  }, [active, phase, typed])

  const flash = (msg: string): void => {
    setNotice(msg)
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2200)
  }

  // ---- 结束：写分 → 收尾剧本 ----
  const finish = (): void => {
    if (doneRef.current) return
    doneRef.current = true
    finishEtiquette(hitsRef.current)
    startScript('etiquetteAfter')
  }

  const pick = (i: number): void => {
    const q = QUIZZES[qi]
    if (!q || i < 0 || i > 2) return
    setSel(i)
    setPicked(i)
    if (i === q.correct) hitsRef.current += 1
    setPhase('result')
  }

  const next = (): void => {
    if (qi >= QUIZZES.length - 1) { setPhase('score'); return }
    setQi(qi + 1)
    setSel(0)
    setPicked(null)
    setPhase('quiz')
  }

  const advance = (): void => {
    if (phase === 'result') next()
    else if (phase === 'score') setPhase('emperor')
    else if (phase === 'emperor') {
      if (typed < TITLE_CHARS.length) setTyped(TITLE_CHARS.length)
      else finish()
    }
  }

  // ---- 键盘：捕获阶段接管，别让 App 的 Esc / I / K 钻进来 ----
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  onKeyRef.current = (e: KeyboardEvent): void => {
    const k = e.key
    const isAdvance = k === 'Enter' || k === ' ' || k === 'e' || k === 'E'
    const isHandled =
      isAdvance || k === '1' || k === '2' || k === '3' ||
      k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' ||
      k === 'ArrowRight' || k === 'Escape'
    if (!isHandled) return
    e.preventDefault()
    e.stopPropagation()

    if (phase === 'quiz') {
      if (k === '1' || k === '2' || k === '3') { pick(Number(k) - 1); return }
      if (k === 'ArrowUp' || k === 'ArrowLeft') {
        const n = (sel + 2) % 3
        setSel(n)
        setTilt(-7 + n * 3.5)
        return
      }
      if (k === 'ArrowDown' || k === 'ArrowRight') {
        const n = (sel + 1) % 3
        setSel(n)
        setTilt(-7 + n * 3.5)
        return
      }
      if (isAdvance) { pick(sel); return }
      if (k === 'Escape') flash('（这一页还没有讲完。）')
      return
    }

    if (phase === 'result' || phase === 'score') {
      if (isAdvance) advance()
      return
    }

    // emperor：第一次 Enter 补完整段，第二次才合上书
    if (isAdvance) advance()
  }

  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent): void => onKeyRef.current(e)
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [active])

  if (!active) return null

  const q = QUIZZES[qi]
  const isHit = picked !== null && picked === q.correct
  const score = hitsRef.current
  const typedFull = typed >= TITLE_CHARS.length

  const foot =
    notice ??
    (phase === 'quiz'
      ? '1 / 2 / 3 或 ↑ ↓ + Enter　·　Esc 合不上这一页'
      : phase === 'result'
        ? 'Enter 继续'
        : phase === 'score'
          ? 'Enter 翻到下一页'
          : typedFull
            ? 'Enter 合上书'
            : 'Enter 让他一口气念完')

  return (
    <div className="etq-overlay">
      <div
        className="etq-panel"
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          const t = (e.clientX - r.left) / Math.max(1, r.width)
          setTilt(-7 + Math.max(0, Math.min(1, t)) * 9)
        }}
      >
        <div className="etq-title">贵族礼仪规范</div>
        <div className="etq-sub">
          {phase === 'emperor'
            ? '四 · 省略版'
            : phase === 'score'
              ? '评阅'
              : `艾玛 · 第 ${qi + 1} / ${QUIZZES.length} 题`}
        </div>

        <div className="etq-page">
          {/* 艾玛手里那根木棍投在书页上的影子：随鼠标 / 方向键轻微摆动 */}
          <div className="etq-rod" style={{ transform: `rotate(${tilt}deg)` }} aria-hidden />

          <div className="etq-folio">
            <span>{phase === 'emperor' ? '§ 四 · 称号' : '§ 一 · 餐桌礼仪'}</span>
            <span>FOL. XI</span>
          </div>

          {/* ---------- 三道题 ---------- */}
          {phase === 'score' ? (
            <div className="etq-score">
              <div className="etq-score-num">
                {score}<span> / 3</span>
              </div>
              <p className="etq-line emma">{SCORE_LINES[score][0]}</p>
              <p className="etq-line narr">{SCORE_LINES[score][1]}</p>
            </div>
          ) : phase !== 'emperor' ? (
            <>
              <div className="etq-ask">{q.ask}</div>
              <div className="etq-q">{q.q}</div>

              {phase === 'quiz' && (
                <div className="etq-opts">
                  {q.opts.map((o, i) => (
                    <button
                      key={i}
                      className={'etq-opt' + (sel === i ? ' sel' : '')}
                      onMouseEnter={() => setSel(i)}
                      onClick={() => pick(i)}
                    >
                      <span className="etq-no">{i + 1}</span>
                      <span className="etq-opt-text">{o}</span>
                    </button>
                  ))}
                </div>
              )}

              {phase === 'result' && picked !== null && (
                <div className="etq-result">
                  {isHit ? (
                    <>
                      <p className="etq-line ok">记录。正确。</p>
                      <p className="etq-line note">{q.rightNote}</p>
                    </>
                  ) : (
                    <>
                      <p className="etq-line bad">{q.wrong}</p>
                      <p className="etq-line bad">{q.again}</p>
                    </>
                  )}
                  {/* 第 3 题：无论对错，她都补那句玩笑 */}
                  {qi === QUIZZES.length - 1 && (
                    <>
                      <p className="etq-line emma">{JOKE}</p>
                      <p className="etq-line narr">{JOKE_NARR}</p>
                    </>
                  )}
                  <p className="etq-answer">正确答案 · {q.opts[q.correct]}</p>
                </div>
              )}
            </>
          ) : null}

          {/* ---------- 第 4 题：皇帝全称（纯展示） ---------- */}
          {phase === 'emperor' && (
            <div className="etq-emperor">
              <p className="etq-ask">她把木棍搁在页边。</p>
              <p className="etq-line emma">那么，少爷。正式的称呼。</p>
              <p className="etq-title-big">
                {TITLE_CHARS.slice(0, typed).join('')}
                {!typedFull && <span className="etq-caret" aria-hidden />}
              </p>
              {typedFull && (
                <div className="etq-verdict">
                  <p className="etq-line narr">（念完，我觉得自己快要窒息了。）</p>
                  <p className="etq-line emma">
                    为了让您知道省略版省略了什么，少爷。
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="etq-foot">{foot}</div>
      </div>
    </div>
  )
}
