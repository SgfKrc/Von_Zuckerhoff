import { useEffect, useRef } from 'react'
import { advance, choose, useGame } from '../game/store'
import { SPEAKER_NAMES } from '../game/types'
import { PORTRAITS } from '../game/art/sprites'

/**
 * 立绘分三类：
 *
 * 1. 素材立绘 —— 由参考图经 scripts/make-portraits.py 处理成 96×96 透明 PNG，
 *    离线生成好表情变体。主角与艾玛走这条。显示 192×192（2 倍整数放大）。
 *    为什么这么做：程序化 fillRect 在 96×96 上画不出参考图的神态，
 *    连续五轮返工都失败了，最终改用「参考图 → 像素化」的管线。
 *
 * 2. 素材相片 —— 白底 jpg 加相框，彩蛋角色专用，刻意的异物感。
 *
 * 3. 程序化 canvas —— 赫尔曼、玛尔塔等没有参考图的角色，仍由 sprites.ts 生成。
 */
const PORTRAIT_IMAGES: Record<string, string> = {
  ftz: './portraits/ftz.png',
  ftzCold: './portraits/ftz-cold.png',
  emma: './portraits/emma.png',
  emmaQuiet: './portraits/emma-quiet.png',
}
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

  if (!dialog) return null

  return (
    <div className="dialog-wrap" onClick={() => { if (!choices) advance() }}>
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
