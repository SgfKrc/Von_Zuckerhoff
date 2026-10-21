import { useEffect, useState } from 'react'
import { useGame, advance, choose, toTitle, newGame, beginExplore, loadAuto, setFlag, setBlueprint, startScript, toggleInventory, openInventory, addItem } from './game/store'
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
import { Toasts } from './ui/Toasts'
import { Snd } from './game/audio'
import './styles.css'

export default function App() {
  const mode = useGame(s => s.mode)
  const inventoryOpen = useGame(s => s.inventoryOpen)
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
        setFlag('nightWalk', true)
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
          <HUD />
          <DialogBox />
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
      <Toasts />
    </div>
  )
}
