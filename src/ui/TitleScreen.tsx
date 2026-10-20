import { newGame, getMeta, loadAuto, useGame } from '../game/store'
import { GOTHIC_BG_SRC } from '../game/constants'

export function TitleScreen() {
  const meta = getMeta()
  const achievements = useGame(s => s.achievements)
  return (
    <div className="title-screen">
      {/* 远景素材（写实图）：cover 铺满，靠冷蓝叠加与暗角压到背景里 */}
      <div className="title-bg" style={{ backgroundImage: `url("${GOTHIC_BG_SRC}")` }} />
      <div className="title-tint" />
      <div className="title-vignette" />
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
    </div>
  )
}
