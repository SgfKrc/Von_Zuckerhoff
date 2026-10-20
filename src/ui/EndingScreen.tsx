import { toTitle, useGame } from '../game/store'

const ENDINGS: Record<string, { name: string; lines: string[] }> = {
  foundling: {
    name: '弃婴',
    lines: [
      '他撕掉了那封信。',
      '雾里没有列车。他在糖堡站的长椅上坐了一夜。',
      '第二天清晨，车站的工作人员发现一个红头发的年轻人，手里握着一枚银胸针。',
      '没有呼吸。脸上没有痛苦。',
      '他没有名字。',
      '——他没有过名字。',
    ],
  },
  void: {
    name: '（未完成的结局）',
    lines: ['这里还没有被写。'],
  },
}

export function EndingScreen() {
  const ending = useGame(s => s.ending)
  if (!ending) return null
  const def = ENDINGS[ending] ?? ENDINGS.void
  return (
    <div className="ending-screen" onClick={() => toTitle()}>
      <div className="ending-name">{def.name}</div>
      <div className="ending-lines">
        {def.lines.map((l, i) => <p key={i}>{l}</p>)}
      </div>
      <div className="ending-hint">按任意键回到标题</div>
    </div>
  )
}
