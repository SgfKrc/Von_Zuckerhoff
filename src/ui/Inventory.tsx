// ============================================================
// 背包界面：全屏遮罩 + 居中面板（视觉语言同 Achievements / SaveScreen）
// 图标不用 emoji，也不用 sprites.ts（另一个 agent 在改）：
// 在本文件里用 16×16 字符网格 + tiles.ts 的调色板 C 现画。
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { ITEMS, ITEM_KIND_LABEL } from '../game/data/items'
import type { ItemId } from '../game/data/items'
import { C } from '../game/art/tiles'
import { toggleInventory, useGame, useItem } from '../game/store'

/** 网格列数：与 CSS 里的 repeat(4, 56px) 保持一致 */
const COLS = 4

/** 字符 → 颜色。字符表沿用 tiles.ts 的 PAL 约定（'.' 为透明） */
const ICON_PAL: Record<string, string> = {
  '0': C.night, '1': C.shadow, '2': C.graphite, '3': C.stone,
  '4': C.cold, '5': C.mist, '6': C.pale, '7': C.bone,
  '8': C.sugar, '9': C.bloodDark, a: C.blood, b: C.fire,
  c: C.teal, d: C.moss, e: C.brass, f: C.gold,
}

/**
 * 7 个 16×16 图标（逐像素字符网格）。
 * 每行必须 16 字符；`.` 为透明。颜色见 ICON_PAL。
 */
const ICONS: Record<ItemId, string[]> = {
  // 信：薄信纸 + 两道折痕 + 火漆
  letter: [
    '................',
    '................',
    '................',
    '..777777777777..',
    '..788888888887..',
    '..788666666887..',
    '..788888888887..',
    '..788888888887..',
    '..7888a99a8887..',
    '..7888a9a88887..',
    '..788888888887..',
    '..777777777777..',
    '................',
    '................',
    '................',
    '................',
  ],
  // 胸针：铁十字（银）+ 中央黑色秃鹫
  brooch: [
    '................',
    '................',
    '.......6666.....',
    '.......6776.....',
    '.......6776.....',
    '..666666776666..',
    '..666666226666..',
    '..666666226666..',
    '.......6776.....',
    '.......6776.....',
    '.......6666.....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  // 线图：卷起的图纸 + 黄铜系绳
  luggage: [
    '................',
    '................',
    '................',
    '....77777777....',
    '..778888888877..',
    '..788888888887..',
    '..e8888888888e..',
    '..e8888888888e..',
    '..788888888887..',
    '..778888888877..',
    '....77777777....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  // 糖：方形糖块 + 黄铜纸带
  sugar: [
    '................',
    '................',
    '................',
    '....88888888....',
    '...8888888888...',
    '..888888888888..',
    '..886666666688..',
    '..8888ee888888..',
    '..8888ee888888..',
    '..886666666688..',
    '..888888888888..',
    '...8888888888...',
    '....88888888....',
    '................',
    '................',
    '................',
  ],
  // 墨水：软木塞 + 墨水瓶
  ink: [
    '................',
    '................',
    '.......ee.......',
    '......eeee......',
    '......e..e......',
    '.....888888.....',
    '....88888888....',
    '....82222228....',
    '....82222228....',
    '....82222228....',
    '....82222228....',
    '....88888888....',
    '.....888888.....',
    '................',
    '................',
    '................',
  ],
  // 怀表：金壳 + 骨白表盘 + 黑指针
  watch: [
    '................',
    '................',
    '......eeee......',
    '....ffffffff....',
    '...ff888888ff...',
    '..ff88888888ff..',
    '..f8888888888f..',
    '..f8888228888f..',
    '..f8888228888f..',
    '..f8888888888f..',
    '..ff88888888ff..',
    '...ff888888ff...',
    '....ffffffff....',
    '................',
    '................',
    '................',
  ],
  // 骨骼：两端膨大的月兽肋骨
  bone: [
    '................',
    '................',
    '................',
    '...77......77...',
    '..7777....7777..',
    '..7788....8877..',
    '....88888888....',
    '....88888888....',
    '....88888888....',
    '..7788....8877..',
    '..7777....7777..',
    '...77......77...',
    '................',
    '................',
    '................',
    '................',
  ],
}

/** 把 16×16 字符网格画到 canvas 上（CSS 放大，保持像素硬边） */
function ItemIcon({ id, size }: { id: ItemId; size: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const g = ref.current?.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, 16, 16)
    const rows = ICONS[id]
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y]
      for (let x = 0; x < row.length; x++) {
        const col = ICON_PAL[row[x]]
        if (!col) continue
        g.fillStyle = col
        g.fillRect(x, y, 1, 1)
      }
    }
  }, [id])
  return (
    <canvas
      ref={ref}
      width={16}
      height={16}
      className="inv-icon"
      style={{ width: size, height: size }}
    />
  )
}

export function Inventory() {
  const inventory = useGame(s => s.inventory)
  const pick = useGame(s => s.inventoryPick)
  // 打开时若指定了预选（HUD 点糖数字），直接选中；否则选第一件
  const [sel, setSel] = useState<ItemId | null>(() => pick ?? inventory[0] ?? null)

  // 物品被移除 / 背包空时，选中项回退，避免详情面板指向不存在的东西
  useEffect(() => {
    if (inventory.length === 0) {
      if (sel !== null) setSel(null)
      return
    }
    if (!sel || !inventory.includes(sel)) setSel(inventory[0])
  }, [inventory, sel])

  // 背包内的键盘：方向键选择、Enter/空格 使用、I/Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === 'i' || e.key === 'I') {
        toggleInventory()
        e.preventDefault()
        return
      }
      if (inventory.length === 0) return
      const idx = sel ? inventory.indexOf(sel) : 0
      let next = idx
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') next = idx - 1
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') next = idx + 1
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') next = idx - COLS
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') next = idx + COLS
      else if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        const cur = sel ?? inventory[0]
        if (cur) useItem(cur)
        return
      } else return
      e.preventDefault()
      const clamped = Math.max(0, Math.min(inventory.length - 1, next))
      setSel(inventory[clamped])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inventory, sel])

  const def = sel ? ITEMS[sel] : null

  // 补足到整行 / 至少 2 行，让网格有固定的空槽
  const slots: (ItemId | null)[] = [...inventory]
  const minSlots = Math.max(8, Math.ceil(slots.length / COLS) * COLS)
  while (slots.length < minSlots) slots.push(null)

  return (
    <div className="overlay" onClick={toggleInventory}>
      <div className="panel panel-wide inv-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-head">
          <h3>背包 · {inventory.length} 件</h3>
          <span className="inv-hint">I 关闭</span>
          <button className="close" onClick={toggleInventory}>✕</button>
        </div>
        <div className="inv-body">
          <div className="inv-grid">
            {slots.map((id, i) => id ? (
              <button
                key={id}
                className={'inv-cell' + (sel === id ? ' sel' : '')}
                onClick={() => setSel(id)}
                title={ITEMS[id].name}
              >
                <ItemIcon id={id} size={32} />
                <span className="inv-cell-name">{ITEMS[id].name}</span>
              </button>
            ) : (
              <div key={'empty' + i} className="inv-cell empty" />
            ))}
          </div>
          <div className="inv-detail">
            {def ? (
              <>
                <div className="inv-detail-head">
                  <ItemIcon id={def.id} size={48} />
                  <div>
                    <div className="inv-detail-name">{def.name}</div>
                    <div className="inv-detail-kind">
                      {ITEM_KIND_LABEL[def.kind]}{def.usable ? ' · 可使用' : ' · 只能查看'}
                    </div>
                  </div>
                </div>
                <div className="inv-detail-desc">{def.desc}</div>
                <div className="inv-detail-actions">
                  <button
                    className="inv-use"
                    disabled={!def.usable}
                    onClick={() => useItem(def.id)}
                  >
                    {def.usable ? '使用' : '不可使用'}
                  </button>
                </div>
              </>
            ) : (
              <div className="inv-detail-empty">
                背包是空的。
                <br />
                调查过的东西会先收进这里。
              </div>
            )}
          </div>
        </div>
        <div className="panel-foot">
          <span>调查过的东西会收进背包，从这里查看与使用。</span>
          <div>
            <span className="inv-keys">↑↓←→ 选择　Enter 使用</span>
          </div>
        </div>
      </div>
    </div>
  )
}
