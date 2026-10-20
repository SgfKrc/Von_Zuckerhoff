import { useEffect, useRef, useState } from 'react'
import { addToast, changeConviction, setFlag, setModal, unlockAch, useGame } from '../game/store'
import { C } from '../game/art/tiles'

/**
 * 第一章高潮：量时计塔。
 * 图纸模式下，塔身展开成一张剖面图。玩家要用标尺量两处：
 *   ① 塔壁厚度 → 正确答案 3 格
 *   ② 凹槽深度 → 正确答案 9 格
 * 因为凹槽比塔壁还深，结论是：那不是装饰，是穿透的通道。
 */

const SCALE = 14
const BASE_X = 26
const WALL = 3
const GROOVE = 9

type Phase = 'wall' | 'groove' | 'done'

export function TowerMeasure() {
  const active = useGame(s => !!s.flags['towerMeasureActive'])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [phase, setPhase] = useState<Phase>('wall')
  const [len, setLen] = useState(1)
  const [wallVal, setWallVal] = useState(0)

  useEffect(() => {
    if (active) {
      setPhase('wall')
      setLen(1)
      setWallVal(0)
      setModal('tower')
    } else {
      setModal(null)
    }
  }, [active])

  // 绘制剖面
  useEffect(() => {
    if (!active) return
    const cv = canvasRef.current
    if (!cv) return
    const g = cv.getContext('2d')
    if (!g) return
    g.imageSmoothingEnabled = false
    g.fillStyle = '#e8e0d0'
    g.fillRect(0, 0, cv.width, cv.height)

    // 塔剖面：壁 3 + 槽 9 + 壁 3 = 15 格
    const total = WALL * 2 + GROOVE
    const startX = BASE_X
    const top = 30
    const h = 96

    for (let i = 0; i < total; i++) {
      const x = startX + i * SCALE
      const isWall = i < WALL || i >= WALL + GROOVE
      if (isWall) {
        // 塔壁：浅灰石块 + 横向砖缝
        g.fillStyle = '#c3bba9'
        g.fillRect(x, top, SCALE - 1, h)
        g.strokeStyle = '#a49c8a'
        g.beginPath()
        for (let yy = 0; yy < h; yy += 6) {
          g.moveTo(x, top + yy + 0.5)
          g.lineTo(x + SCALE - 1, top + yy + 0.5)
        }
        g.stroke()
        g.fillStyle = '#d8d0bd'
        g.fillRect(x, top, 1, h)
      } else {
        // 凹槽：越往里越暗，表示深度
        const depth = (i - WALL) / GROOVE
        const v = Math.round(190 - depth * 110)
        g.fillStyle = `rgb(${v},${v - 6},${v - 18})`
        g.fillRect(x, top, SCALE - 1, h)
      }
      g.strokeStyle = 'rgba(120,112,98,.35)'
      g.strokeRect(x + 0.5, top + 0.5, SCALE - 1, h - 1)
    }

    // 凹槽中央那根"穿到底"的深色竖条
    g.fillStyle = '#4a4437'
    g.fillRect(startX + (WALL + 4) * SCALE, top + 6, SCALE - 1, h - 12)
    // 槽口的高光边
    g.fillStyle = '#e8e0d0'
    g.fillRect(startX + WALL * SCALE - 1, top, 1, h)
    g.fillRect(startX + (WALL + GROOVE) * SCALE, top, 1, h)
    // 标尺：第二阶段从凹槽左边缘开始
    const rx = phase === 'wall' ? startX : startX + WALL * SCALE
    const ry = top + h + 12
    g.strokeStyle = '#2f4a6b'
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(rx + 0.5, ry + 6)
    g.lineTo(rx + len * SCALE + 0.5, ry + 6)
    g.moveTo(rx + 0.5, ry + 2)
    g.lineTo(rx + 0.5, ry + 10)
    g.moveTo(rx + len * SCALE + 0.5, ry + 2)
    g.lineTo(rx + len * SCALE + 0.5, ry + 10)
    g.stroke()

    g.fillStyle = '#2f4a6b'
    g.font = '11px monospace'
    g.fillText(String(len), rx + len * SCALE + 6, ry + 9)
  }, [active, len, phase])


  useEffect(() => {
    if (!active || phase === 'done') return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        setLen(v => Math.max(1, v - 1)); e.preventDefault(); return
      }
      if (e.key === 'ArrowRight' || e.key === 'd') {
        setLen(v => Math.min(15, v + 1)); e.preventDefault(); return
      }
      if (e.key === 'Escape') {
        setFlag('towerMeasureActive', false)
        addToast('（他收起了标尺。）', 'info')
        e.preventDefault(); return
      }
      if (e.key === 'e' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (phase === 'wall') {
          if (len === WALL) {
            setWallVal(len)
            setPhase('groove')
            setLen(1)
            addToast('塔壁。三格。', 'info')
          } else {
            addToast('不是这里。墙面没有这么厚。', 'warn')
          }
        } else if (phase === 'groove') {
          if (len === GROOVE) {
            setPhase('done')
            setFlag('towerMeasureActive', false)
            setFlag('towerMeasured', true)
            changeConviction(8)
            unlockAch('threeProofs')
            addToast('凹槽比塔壁还深。它不是装饰——是穿透的通道。', 'conviction')
          } else {
            addToast('不是这里。再往深处量。', 'warn')
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, phase, len])

  if (!active) return null

  const total = WALL * 2 + GROOVE
  const width = BASE_X * 2 + total * SCALE

  return (
    <div className="repair-overlay">
      <div className="repair-panel" style={{ paddingBottom: 18 }}>
        <div className="repair-title">
          {phase === 'wall' ? '时计塔 · 量塔壁' : phase === 'groove' ? '时计塔 · 量凹槽' : '时计塔'}
        </div>
        <div className="repair-hint">← → 调整标尺　E 确认　Esc 收起</div>
        <canvas
          ref={canvasRef}
          width={Math.max(384, width)}
          height={180}
          style={{ display: 'block', margin: '0 auto', imageRendering: 'pixelated' }}
        />
        <div className="repair-count">
          {phase === 'wall'
            ? '他要先量墙。'
            : phase === 'groove'
              ? `壁厚 ${wallVal} 格。现在量凹槽的深度。`
              : '结论：凹槽比塔壁深。'}
        </div>
      </div>
    </div>
  )
}
