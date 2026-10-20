// 像素画构建器:用字符网格 + 调色板生成 offscreen canvas
export const TILE = 16

export type Pal = Record<string, string>

// 全局哥特调色板
export const P = {
  K: '#05060b', // 虚空
  k: '#0d0f18', // 描边黑
  s1: '#161c2c', s2: '#232c44', s3: '#33405e', s4: '#4a5878', // 石
  b1: '#251b30', b2: '#38294a', b3: '#4c3a62', // 紫调砖
  w1: '#241a10', w2: '#3f2f1c', w3: '#5c4630', w4: '#77603f', // 木
  g1: '#ffd97a', g2: '#e8942a', g3: '#a34e1a', // 煤气灯
  r1: '#c22f2f', r2: '#7c1c1c', // 血红
  or: '#e8762a', od: '#a34e1a', // 玛德蕾娜橙
  wt: '#e6e2d6', pp: '#d8d3c4', pd: '#9a9484', // 白/纸
  gy: '#6e7688', gd: '#454e63',
  hr: '#b08968', hd: '#8a6a4f', // 浅棕发
  sk: '#e8c8a8', sd: '#c09878', // 皮肤
  gr: '#4a7a52', gD: '#2e4e34', // 罗莎绿裙
  pu: '#9a5cc8', pv: '#5c2a80', // 疯狂紫
  sb: '#7ab0d4', sd2: '#31567c', // 理智蓝
  br: '#6e3a2a', bd: '#4a2418', // 赭褐
} as const

export function px(rows: string[], pal: Pal): HTMLCanvasElement {
  const h = rows.length
  const w = Math.max(...rows.map(r => r.length))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.' || ch === ' ') continue
      const col = pal[ch]
      if (!col) continue
      g.fillStyle = col
      g.fillRect(x, y, 1, 1)
    }
  })
  return c
}

export function flipX(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const g = c.getContext('2d')!
  g.translate(src.width, 0)
  g.scale(-1, 1)
  g.drawImage(src, 0, 0)
  return c
}

// 把精灵整体染色(用于彩绘之眼的"墨线世界"等)
export function tinted(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const g = c.getContext('2d')!
  g.drawImage(src, 0, 0)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = color
  g.fillRect(0, 0, c.width, c.height)
  return c
}
