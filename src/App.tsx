import { useEffect, useState } from 'react'
import { useGame, advance, choose, toTitle, newGame, beginExplore, loadAuto, setFlag, setBlueprint, startScript, toggleInventory, openInventory, addItem, finishMontage, finishClockInterlude, startRoadEnd, finishRoadEnd } from './game/store'
import { isItemId } from './game/data/items'
import { bridge } from './game/bridge'
import type { MapId } from './game/types'
import { initInput } from './game/engine/input'
import { startEngine, stopEngine } from './game/engine/engine'
import { GameCanvas } from './ui/GameCanvas'
import { DialogBox } from './ui/DialogBox'
import { HUD } from './ui/HUD'
import { TitleScreen } from './ui/TitleScreen'
import { Opening } from './ui/Opening'
import { ChapterCard } from './ui/ChapterCard'
import { EndingScreen } from './ui/EndingScreen'
import { SaveScreen } from './ui/SaveScreen'
import { Achievements } from './ui/Achievements'
import { Inventory } from './ui/Inventory'
import { BlueprintRepair } from './ui/BlueprintRepair'
import { TowerMeasure } from './ui/TowerMeasure'
import { EtiquetteQuiz } from './ui/EtiquetteQuiz'
import { GrimmBook } from './ui/GrimmBook'
import { Montage } from './ui/Montage'
import { RoadEnd } from './ui/RoadEnd'
import { ClockInterlude } from './ui/ClockInterlude'
import { Toasts } from './ui/Toasts'
import { Snd } from './game/audio'
import './styles.css'

export default function App() {
  const mode = useGame(s => s.mode)
  const inventoryOpen = useGame(s => s.inventoryOpen)
  /** 正在播放的木刻蒙太奇（游戏里由 store.startMontage 起播） */
  const montage = useGame(s => s.montage)
  /** 时钟转场：剧本在 cannotSleep 末尾立 flags.clockInterlude，这里挂播放器 */
  const clockInterlude = useGame(s => !!s.flags.clockInterlude)
  /** 山路尽头的第一视角过场（走到山路右端起播，见 store.startRoadEnd） */
  const roadEnd = useGame(s => s.roadEnd)
  /** 调试入口 ?ui=montage：不进游戏，直接把七张木刻铺在标题画面上 */
  const [montageDemo, setMontageDemo] = useState(false)
  /** 调试入口 ?ui=roadend：同样的用法，单独看山路尽头那一段 */
  const [roadEndDemo, setRoadEndDemo] = useState(false)
  const [showSave, setShowSave] = useState(false)
  const [showAch, setShowAch] = useState(false)
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    const dispose = initInput()
    return () => { dispose() }
  }, [])

  // 调试入口：?start=1 直接开始；?map=hall 跳场景；?bp=1 同时开图纸
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (!q.has('start')) {
      // 单独调小游戏（?ui=quiz）：不进游戏，直接把那本礼仪书铺在标题画面上。
      // 不写开场剧本：验收 1 关心的是「三题可答、答完出总分」。
      if (q.get('ui') === 'quiz') setFlag('etiquetteQuizActive', true)
      // 单独调书（?ui=book）：十页书直接摊在标题画面上，翻完为止。
      if (q.get('ui') === 'book') setFlag('grimmBookActive', true)
      // 单独调蒙太奇（?ui=montage）：七张木刻直接铺在标题画面上，放完为止。
      // 配 &montage=<秒> 可以定帧（静音），截图就用那个。
      if (q.get('ui') === 'montage') setMontageDemo(true)
      // 单独调山路尽头的过场（?ui=roadend）：第一视角那 16 秒铺在标题画面上。
      // 配 &roadend=<秒> 定帧（静音），截图用那个。
      if (q.get('ui') === 'roadend') setRoadEndDemo(true)
      return
    }
    newGame()
    const map = q.get('map')
    if (map) {
      setTimeout(() => {
        const g = useGame.getState()
        g.dialog && advance()
        useGame.setState({ dialog: null, mode: 'explore', chapterCard: null })
        // 默认把该地图的入场脚本标记成「已看过」，免得调试时每次都被对话挡住。
        // 加 &fresh=1 就保留入场脚本 —— 想验证 arriveXxx 这类脚本时用它。
        if (!q.has('fresh')) setFlag('seen_' + map, true)
        setFlag('gateOpen', true)
        setFlag('hallOpen', true)
        setFlag('cellarOpen', true)
        // nightWalk 现在有剧情含义（第一夜睡不着才开放东走廊），
        // 不再无条件预设；要验证夜游请加 &night=1
        if (q.has('night')) setFlag('nightWalk', true)
        bridge.teleport(map as MapId, Number(q.get('x') ?? 12), Number(q.get('y') ?? 8), 'down')
        if (q.has('bp')) setBlueprint(true)
        if (q.has('repair')) setFlag('archRepairActive', true)
        if (q.has('ds')) { setFlag('dsOpen', true); setFlag('dsCount', 4) } // 调试：直接放出车厢左端的彩蛋角色
        // 调试：自动推进 n 句对话
        const adv = Number(q.get('adv') ?? 0)
        if (adv > 0) {
          let done = 0
          const step = (): void => {
            if (done >= adv) return
            done++
            advance()
            window.setTimeout(step, 320)
          }
          window.setTimeout(step, 400)
        }
        const dlg = q.get('dialog')
        if (dlg) { startScript(dlg) }
        const ui = q.get('ui')
        if (ui === 'save') setShowSave(true)
        if (ui === 'ach') setShowAch(true)
        if (ui === 'tower') setFlag('towerMeasureActive', true)
        if (ui === 'quiz') setFlag('etiquetteQuizActive', true)
        if (ui === 'book') setFlag('grimmBookActive', true)
        // 调试：?ui=montage 在游戏里直接看这段蒙太奇（不走睡下那条路）
        if (ui === 'montage') setMontageDemo(true)
        // 调试：?ui=roadend 在游戏里直接看山路尽头那一段（不写任何状态）
        if (ui === 'roadend') setRoadEndDemo(true)
        // 调试：?item=letter,brooch,sugar 直接发放物品；?ui=inv 打开背包
        const items = q.get('item')
        if (items) {
          for (const raw of items.split(',')) {
            const id = raw.trim()
            if (isItemId(id)) addItem(id)
          }
        }
        if (ui === 'inv') {
          const pick = q.get('pick')
          openInventory(pick && isItemId(pick) ? pick : null)
        }
      }, 200)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'explore' && mode !== 'ending') {
      stopEngine()
      return
    }
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null
    if (canvas) startEngine(canvas)
    return () => stopEngine()
  }, [mode])

  /**
   * 山路尽头的过场：走到路的右端就起播。
   *
   * 为什么不用传送门：传送门是「走过去立刻换图」，而这一段要**停在山路上**
   * 把镜头交给过场（雨、脚步、雾里浮出来的城堡），换图只能发生在过场结束那一刻
   * （finishRoadEnd 里 bridge.teleport 到门前）。所以 maps.ts 里那个
   * road→gate 的传送门已经删掉了，触发改由这里盯着玩家位置：
   *
   *   x ≥ 44（离尽头还有两格）就起播 —— 早一点，玩家不会先撞到地图边缘；
   *   只在探索模式、没有对话 / 模态、这一段还没播过的时候触发。
   *
   * 80ms 一次：玩家 90px/s ≈ 0.45 格/次，从 x44 到 x47 有半秒多的余量。
   */
  useEffect(() => {
    if (mode !== 'explore') return
    const id = window.setInterval(() => {
      const g = useGame.getState()
      if (g.roadEnd || g.modal || g.dialog || g.chapterCard) return
      if (g.flags.roadEndSeen) return
      const p = bridge.getPos()
      if (p.map !== 'road') return
      // 只在路面上（y5..8 是山道，y9 是下坡那一侧的林子）
      if (p.x >= 44 && p.y >= 4 && p.y <= 9) startRoadEnd()
    }, 80)
    return () => window.clearInterval(id)
  }, [mode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const g = useGame.getState()
      if (g.mode === 'title') {
        Snd.setScene('title')
        if (e.key === 'Enter' || e.key === 'e' || e.key === ' ') { Snd.start(); newGame(); e.preventDefault() }
        return
      }
      if (g.mode === 'opening') return
      if (g.mode === 'chapter') {
        if (e.key === 'Escape') { toTitle(); e.preventDefault(); return }
        beginExplore()
        e.preventDefault()
        return
      }
      // 背包打开时：方向键 / 使用 / 关闭都由 Inventory 组件自己处理。
      // 这里只拦一个 K（从背包直接切到成就）。
      if (g.inventoryOpen) {
        if (e.key === 'k' || e.key === 'K') {
          toggleInventory()
          setShowAch(true)
          e.preventDefault()
        }
        return
      }
      if (showSave || showAch) {
        if (e.key === 'Escape') { setShowSave(false); setShowAch(false); e.preventDefault() }
        return
      }
      if (g.dialog) {
        if (g.dialog.choices) {
          if (e.key >= '1' && e.key <= '9') {
            choose(Number(e.key) - 1)
            e.preventDefault()
          }
          return
        }
        if (e.key === 'e' || e.key === ' ' || e.key === 'Enter') {
          advance()
          e.preventDefault()
        }
        return
      }
      if (e.key === 'Escape') { setMenu(m => !m); e.preventDefault(); return }
      // K = 成就（原 I 键），I = 背包
      if (e.key === 'k' || e.key === 'K') { setShowAch(true); e.preventDefault(); return }
      if (e.key === 'i' || e.key === 'I') {
        toggleInventory()
        setMenu(false)
        e.preventDefault()
        return
      }
      if (e.key === 'F5') { setShowSave(true); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showSave, showAch])

  return (
    <div className="app">
      {mode === 'title' && <TitleScreen />}
      {mode === 'opening' && <Opening />}
      {mode === 'chapter' && <ChapterCard />}
      {(mode === 'explore' || mode === 'ending') && (
        <>
          <GameCanvas />
          {/* 全屏过场期间藏起 HUD 与对话框：蒙太奇 / 时钟转场 / 山路尽头
              都是"画面就是全部"的时刻，顶上的状态栏会把黑场戳破。 */}
          {!montage && !clockInterlude && !roadEnd && <HUD />}
          {!montage && !clockInterlude && !roadEnd && <DialogBox />}
          {mode === 'ending' && <EndingScreen />}
        </>
      )}
      {mode === 'explore' && menu && (
        <div className="menu-overlay" onClick={() => setMenu(false)}>
          <div className="menu-panel" onClick={e => e.stopPropagation()}>
            <h3>暂停</h3>
            <button onClick={() => { setShowSave(true); setMenu(false) }}>存档 / 读档（F5）</button>
            <button onClick={() => { toggleInventory(); setMenu(false) }}>背包（I）</button>
            <button onClick={() => { setShowAch(true); setMenu(false) }}>成就（K）</button>
            <button onClick={() => { loadAuto() }}>读取自动存档</button>
            <button onClick={() => { setMenu(false); toTitle() }}>回到标题</button>
            <button onClick={() => setMenu(false)}>继续</button>
          </div>
        </div>
      )}
      {showSave && <SaveScreen onClose={() => setShowSave(false)} />}
      {showAch && <Achievements onClose={() => setShowAch(false)} />}
      {mode === 'explore' && inventoryOpen && <Inventory />}
      <BlueprintRepair />
      <TowerMeasure />
      <EtiquetteQuiz />
      <GrimmBook />
      {/* 木刻蒙太奇：法兰克福的前半生。游戏里由 store.startMontage 挂起；
          ?ui=montage 走 demo（播完只关掉自己，不写 sawFrankfurt）。 */}
      {montage
        ? <Montage key="montage" onFinish={finishMontage} />
        : montageDemo
          ? <Montage key="montage-demo" demo onFinish={() => setMontageDemo(false)} />
          : null}
      {/* 时钟转场：第一夜睡不着的那两个小时（淡出 → 时钟特写 → 淡入）。
          由 cannotSleep 末尾的 flags.clockInterlude 起播，播完自己清掉。 */}
      {mode === 'explore' && clockInterlude && (
        <ClockInterlude onFinish={finishClockInterlude} />
      )}
      {/* 山路尽头的过场：第一视角，雨中走到尽头，雾里浮出聚斯霍芬堡。
          游戏里由 store.startRoadEnd 挂起（App 的 x ≥ 44 检测触发），
          播完 finishRoadEnd 把玩家落在大门前；?ui=roadend 走 demo（不写任何状态）。 */}
      {roadEnd
        ? <RoadEnd key="roadend" onFinish={finishRoadEnd} />
        : roadEndDemo
          ? <RoadEnd key="roadend-demo" demo onFinish={() => setRoadEndDemo(false)} />
          : null}
      <Toasts />
    </div>
  )
}
