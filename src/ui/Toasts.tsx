import { useGame } from '../game/store'

export function Toasts() {
  const toasts = useGame(s => s.toasts)
  if (!toasts.length) return null
  return (
    <div className="toasts">
      {toasts.map(t => (
        <div key={t.id} className={'toast toast-' + t.kind}>{t.text}</div>
      ))}
    </div>
  )
}
