import { useState } from 'react'
import { deleteSlot, exportSaveText, importSaveText, listSaves, loadFrom, saveTo, useGame } from '../game/store'
import { CHAPTERS } from '../game/data/chapters'

export function SaveScreen({ onClose }: { onClose: () => void }) {
  const [slots, setSlots] = useState(() => listSaves())
  const [tab, setTab] = useState<'save' | 'load'>('save')
  const current = useGame(s => s.chapter)

  const refresh = (): void => setSlots(listSaves())

  const doExport = (): void => {
    const text = exportSaveText()
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'von-zuckerhoff-save.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const doImport = (): void => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = () => {
      const f = input.files?.[0]
      if (!f) return
      const r = new FileReader()
      r.onload = () => { importSaveText(String(r.result)); refresh() }
      r.readAsText(f)
    }
    input.click()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel panel-wide" onClick={e => e.stopPropagation()}>
        <div className="panel-head">
          <h3>存档</h3>
          <div className="tabs">
            <button className={tab === 'save' ? 'tab on' : 'tab'} onClick={() => setTab('save')}>保存</button>
            <button className={tab === 'load' ? 'tab on' : 'tab'} onClick={() => setTab('load')}>读取</button>
          </div>
          <button className="close" onClick={onClose}>✕</button>
        </div>
        <div className="slot-grid">
          {slots.map(s => {
            const empty = !s.savedAt
            return (
              <div key={s.slot} className={'slot' + (empty ? ' empty' : '')}>
                <div className="slot-no">槽 {s.slot + 1}</div>
                {empty ? (
                  <div className="slot-empty">空</div>
                ) : (
                  <>
                    <div className="slot-chapter">
                      {CHAPTERS[s.chapter]?.num} {CHAPTERS[s.chapter]?.name}
                    </div>
                    <div className="slot-meta">确信 {s.conviction}　糖 {s.sugar}</div>
                    <div className="slot-time">{new Date(s.savedAt).toLocaleString('zh-CN')}</div>
                  </>
                )}
                <div className="slot-actions">
                  {tab === 'save' && (
                    <button onClick={() => { saveTo(s.slot); refresh() }}>保存</button>
                  )}
                  {tab === 'load' && !empty && (
                    <button onClick={() => { loadFrom(s.slot); onClose() }}>读取</button>
                  )}
                  {!empty && <button className="danger" onClick={() => { deleteSlot(s.slot); refresh() }}>删除</button>}
                </div>
              </div>
            )
          })}
        </div>
        <div className="panel-foot">
          <span>当前进度：{CHAPTERS[current]?.num} {CHAPTERS[current]?.name}</span>
          <div>
            <button onClick={doExport}>导出 JSON</button>
            <button onClick={doImport}>导入 JSON</button>
          </div>
        </div>
      </div>
    </div>
  )
}
