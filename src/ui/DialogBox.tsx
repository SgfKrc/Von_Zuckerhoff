import { useEffect, useRef } from 'react'
import { advance, choose, useGame } from '../game/store'
import { SPEAKER_NAMES } from '../game/types'
import { PORTRAITS } from '../game/art/sprites'

/**
 * 个别角色不走程序化立绘，而是直接使用外部素材图（白底 jpg）。
 * 这类角色会以"相片"的形式贴在对话框左侧——白底 + 细框，
 * 与程序化立绘的透明背景形成刻意的割裂感。
 * 素材图与程序化立绘一样是 1:1（288×288 → 显示 144×144，见 styles.css）。
 */
const PORTRAIT_PHOTOS: Record<string, string> = {
  ds: './portraits/ds.jpg',
}

export function DialogBox() {
  const dialog = useGame(s => s.dialog)
  const portraitRef = useRef<HTMLDivElement | null>(null)

  const line = dialog?.line
  const choices = dialog?.choices
  const sp = line?.sp ?? null
  const photoSrc = sp && PORTRAIT_PHOTOS[sp] ? PORTRAIT_PHOTOS[sp] : null
  const drawKey = sp && !photoSrc && PORTRAITS[sp] ? sp : null

  useEffect(() => {
    const el = portraitRef.current
    if (!el) return
    el.innerHTML = ''
    if (!drawKey) return
    // 立绘是 48×48 的方形画布，由 CSS 放大到 144×144（3 倍，整数放大不糊）
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

  if (!dialog) return null

  return (
    <div className="dialog-wrap" onClick={() => { if (!choices) advance() }}>
      {line && (
        <div className="dialog-row">
          <div className={'portrait-slot' + (drawKey || photoSrc ? '' : ' empty')}>
            <div ref={portraitRef} />
            {photoSrc && <img src={photoSrc} className="portrait-photo" alt="" />}
          </div>
          <div className={'dialog-box sp-' + (line.sp ?? 'none')}>
            {line.sp && line.sp !== 'none' && (
              <div className="speaker">{SPEAKER_NAMES[line.sp]}</div>
            )}
            <div className="dialog-text">{line.text}</div>
            <div className="dialog-next">▼</div>
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
