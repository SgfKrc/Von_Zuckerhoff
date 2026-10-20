import { useEffect, useState } from 'react'
import { addToast, changeConviction, setFlag, setModal, startScript, unlockAch, useGame } from '../game/store'

/** 扣墨水；返回是否足够 */
function spendInk(n: number): boolean {
  const g = useGame.getState()
  if (g.ink < n) return false
  useGame.setState({ ink: g.ink - n })
  return true
}

const COLS = 5
const ROWS = 3
const BLOCKED = new Set(['2,2'])
const START: [number, number] = [0, 2]
const GOAL: [number, number] = [4, 2]
const key = (x: number, y: number): string => x + ',' + y

export function BlueprintRepair() {
  const active = useGame(s => !!s.flags['archRepairActive'])
  const [path, setPath] = useState<string[]>([key(...START)])
  const [cursor, setCursor] = useState<[number, number]>(START)

  useEffect(() => {
    if (active) {
      setPath([key(...START)])
      setCursor(START)
      setModal('repair')
    } else {
      setModal(null)
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent): void => {
      const [x, y] = cursor
      let nx = x
      let ny = y
      if (e.key === 'ArrowLeft' || e.key === 'a') nx--
      else if (e.key === 'ArrowRight' || e.key === 'd') nx++
      else if (e.key === 'ArrowUp' || e.key === 'w') ny--
      else if (e.key === 'ArrowDown' || e.key === 's') ny++
      else if (e.key === 'Escape') {
        setFlag('archRepairActive', false)
        addToast('（他放下了笔。）', 'info')
        e.preventDefault()
        return
      } else if (e.key === 'e' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (nx === x && ny === y) {
          // 落笔
          if (x === GOAL[0] && y === GOAL[1]) {
            const cost = path.length - 1
            if (!spendInk(cost)) {
              addToast('墨水不够。', 'warn')
              return
            }
            setFlag('archRepairActive', false)
            setFlag('archRepaired', true)
            changeConviction(8)
            unlockAch('firstRepair')
            addToast(`补图完成。墨水 -${cost}`, 'info')
            startScript('archDone')
          } else {
            // 落笔失败：留不下线，但确信要掉
            changeConviction(-8)
            addToast('线断在半路。图纸上多了一道擦不干净的痕。', 'warn')
            setPath([key(...START)])
            setCursor(START)
          }
        }
        return
      } else {
        return
      }
      e.preventDefault()
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
        addToast('墙。', 'warn')
        return
      }
      if (BLOCKED.has(key(nx, ny))) {
        addToast('承重柱。穿不过去。', 'warn')
        return
      }
      setCursor([nx, ny])
      setPath(p => [...p, key(nx, ny)])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, cursor])

  if (!active) return null

  return (
    <div className="repair-overlay">
      <div className="repair-panel">
        <div className="repair-title">门厅拱肋 · 补图</div>
        <div className="repair-hint">方向键移动铅笔　E 落笔　Esc 放弃</div>
        <div className="repair-grid" style={{ width: COLS * 64, height: ROWS * 64 }}>
          {Array.from({ length: ROWS * COLS }, (_, i) => {
            const x = i % COLS
            const y = Math.floor(i / COLS)
            const k = key(x, y)
            const inPath = path.includes(k)
            const isCursor = cursor[0] === x && cursor[1] === y
            const isStart = k === key(...START)
            const isGoal = k === key(...GOAL)
            const isBlocked = BLOCKED.has(k)
            return (
              <div
                key={i}
                className={
                  'repair-cell' +
                  (inPath ? ' in-path' : '') +
                  (isCursor ? ' cursor' : '') +
                  (isStart ? ' start' : '') +
                  (isGoal ? ' goal' : '') +
                  (isBlocked ? ' blocked' : '')
                }
                style={{ left: x * 64, top: y * 64 }}
              >
                {isStart ? '起' : isGoal ? '终' : isBlocked ? '■' : ''}
              </div>
            )
          })}
        </div>
        <div className="repair-count">已画 {path.length - 1} 格</div>
      </div>
    </div>
  )
}
