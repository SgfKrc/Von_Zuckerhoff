import { openInventory, useGame } from '../game/store'

export function HUD() {
  const conviction = useGame(s => s.conviction)
  const sugar = useGame(s => s.sugar)
  const ink = useGame(s => s.ink)
  const blueprint = useGame(s => s.blueprint)
  const chapter = useGame(s => s.chapter)

  return (
    <>
      <div className={'hud' + (blueprint ? ' hud-blueprint' : '')}>
        <div className="hud-item">
          <span className="hud-label">确信</span>
          <div className="bar">
            <div className="bar-fill" style={{ width: conviction + '%' }} />
          </div>
          <span className="hud-num">{conviction}</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">糖</span>
          {/* 点糖数字 = 打开背包并选中糖，方便直接吃掉一块 */}
          <span
            className="hud-num hud-num-btn"
            title="打开背包（I）"
            onClick={() => openInventory('sugar')}
          >
            {sugar}
          </span>
        </div>
        <div className="hud-item">
          <span className="hud-label">墨水</span>
          <span className="hud-num">{ink}</span>
        </div>
        <div className="hud-item hud-chapter">
          {chapter === 0 ? '序章' : '第一章'}
        </div>
        {blueprint && <div className="hud-mode">图纸　[Tab] 退出</div>}
      </div>
      {/* 很轻的入口提示：右上角，不抢注意力 */}
      <div className={'hud-keys' + (blueprint ? ' hud-keys-blueprint' : '')}>
        背包<span className="hud-keys-key">I</span>
      </div>
    </>
  )
}
