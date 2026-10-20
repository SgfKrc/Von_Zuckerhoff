import { useEffect, useRef } from 'react'
import { advance, choose, useGame } from '../game/store'
import { SPEAKER_NAMES } from '../game/types'
import { PORTRAITS } from '../game/art/sprites'

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
