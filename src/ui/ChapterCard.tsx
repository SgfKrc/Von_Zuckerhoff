import { beginExplore, useGame } from '../game/store'

export function ChapterCard() {
  const card = useGame(s => s.chapterCard)
  if (!card) return null
  return (
    <div className="chapter-card" onClick={() => beginExplore()}>
      <div className="card-inner">
        <div className="card-num">{card.num}</div>
        <div className="card-name">{card.name}</div>
        <div className="card-rule" />
        <div className="card-quote">{card.quote}</div>
        <div className="card-hint">按任意键继续</div>
      </div>
    </div>
  )
}
