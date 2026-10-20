import { ACHIEVEMENTS } from '../game/data/achievements'
import { useGame } from '../game/store'

export function Achievements({ onClose }: { onClose: () => void }) {
  const unlocked = useGame(s => s.achievements)
  const groups: { key: 'chapter' | 'explore' | 'secret'; title: string }[] = [
    { key: 'chapter', title: '章节' },
    { key: 'explore', title: '探索与解谜' },
    { key: 'secret', title: '隐秘' },
  ]
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel" onClick={e => e.stopPropagation()}>
        <div className="panel-head">
          <h3>成就 · {unlocked.length} / {ACHIEVEMENTS.length}</h3>
          <button className="close" onClick={onClose}>✕</button>
        </div>
        {groups.map(g => (
          <div key={g.key} className="ach-group">
            <h4>{g.title}</h4>
            {ACHIEVEMENTS.filter(a => a.group === g.key).map(a => {
              const on = unlocked.includes(a.id)
              return (
                <div key={a.id} className={'ach' + (on ? ' on' : '')}>
                  <div className="ach-name">{on ? a.name : a.secret ? '？？？' : a.name}</div>
                  <div className="ach-desc">{on || !a.secret ? a.desc : '（隐藏成就）'}</div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
