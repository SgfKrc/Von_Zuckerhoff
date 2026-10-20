import { useEffect, useState } from 'react'
import { newGame, getMeta, loadAuto, useGame } from '../game/store'
import { GOTHIC_BG_SRC } from '../game/constants'
import { Snd } from '../game/audio'

/**
 * 程序化齿轮：外圈齿廓 + 中心轴孔（evenodd 挖空）。
 * 不引图、不用 canvas，纯 SVG path，几十个点。
 */
function gearPath(teeth: number, rTip: number, rRoot: number, rHole: number): string {
  const step = (Math.PI * 2) / teeth
  const points: string[] = []
  const ring: Array<[number, number]> = [
    [-step * 0.30, rRoot],
    [-step * 0.15, rTip],
    [step * 0.15, rTip],
    [step * 0.30, rRoot],
  ]
  for (let i = 0; i < teeth; i++) {
    const base = i * step
    for (const [offset, radius] of ring) {
      const angle = base + offset
      points.push(`${(100 + Math.cos(angle) * radius).toFixed(2)} ${(100 + Math.sin(angle) * radius).toFixed(2)}`)
    }
  }
  const outline = `M ${points[0]} L ${points.slice(1).join(' L ')} Z`
  const hole = `M ${100 - rHole} 100 a ${rHole} ${rHole} 0 1 0 ${rHole * 2} 0 a ${rHole} ${rHole} 0 1 0 ${-rHole * 2} 0 Z`
  return `${outline} ${hole}`
}

function Gear({ teeth, rTip, rRoot, rHole }: { teeth: number; rTip: number; rRoot: number; rHole: number }) {
  return (
    <svg viewBox="0 0 200 200" className="gear-svg" aria-hidden="true" focusable="false">
      <path d={gearPath(teeth, rTip, rRoot, rHole)} fill="currentColor" fillRule="evenodd" />
    </svg>
  )
}

export function TitleScreen() {
  const meta = getMeta()
  const achievements = useGame(s => s.achievements)
  const [bgmOn, setBgmOn] = useState(() => Snd.isBgmOn())
  const [spin, setSpin] = useState(false)

  // BGM 必须先由用户手势解锁；解锁成功后 0.5s，齿轮才起转
  useEffect(() => {
    let timer: number | null = null
    const beginSpin = (): void => {
      if (timer != null) return
      timer = window.setTimeout(() => setSpin(true), 500)
    }
    const unlock = (): void => {
      if (Snd.enterTitle()) beginSpin()
    }
    if (Snd.enterTitle()) beginSpin()
    window.addEventListener('pointerdown', unlock, { capture: true })
    window.addEventListener('keydown', unlock, { capture: true })
    return () => {
      if (timer != null) window.clearTimeout(timer)
      window.removeEventListener('pointerdown', unlock, { capture: true })
      window.removeEventListener('keydown', unlock, { capture: true })
    }
  }, [])

  return (
    <div className="title-screen">
      {/* 远景素材（写实图）：cover 铺满，靠冷蓝叠加与暗角压到背景里 */}
      <div className="title-bg" style={{ backgroundImage: `url("${GOTHIC_BG_SRC}")` }} />
      <div className="title-tint" />
      <div className="title-vignette" />
      {/* 左下角的齿轮：暗铜色、极慢、互不咬合地差速转 */}
      <div className={`title-gears${spin ? ' running' : ''}`} aria-hidden="true">
        <div className="gear gear-a">
          <Gear teeth={16} rTip={86} rRoot={70} rHole={17} />
        </div>
        <div className="gear gear-b">
          <Gear teeth={12} rTip={84} rRoot={66} rHole={16} />
        </div>
        <div className="gear gear-c">
          <Gear teeth={10} rTip={82} rRoot={62} rHole={14} />
        </div>
      </div>
      <div className="title-main">
        <div className="title-sub">像素风黑暗哥特解谜</div>
        <h1 className="title-cn">冯·祖克霍夫</h1>
        <div className="title-gem">宝 石</div>
        <div className="title-latin">VON ZUCKERHOFF · THE GEM</div>
        <div className="title-quote">「甜是生命，亦是死亡。」</div>
        <div className="title-buttons">
          <button className="btn-primary" onClick={() => newGame()}>开始新的阅读</button>
          {meta.completedRuns > 0 && (
            <button className="btn" onClick={() => { if (!loadAuto()) newGame() }}>继续上次</button>
          )}
          <button className="btn" onClick={() => newGame()}>读取存档（进入后按 F5）</button>
        </div>
        <div className="title-foot">
          成就 {achievements.length} / 7　·　按 Enter 开始
        </div>
      </div>
      <button
        className={`title-bgm${bgmOn ? '' : ' off'}`}
        onClick={() => setBgmOn(Snd.toggleBgm())}
        aria-label={bgmOn ? '关闭背景音乐' : '开启背景音乐'}
        aria-pressed={bgmOn}
        title="背景音乐"
      >
        ♪
      </button>
    </div>
  )
}
