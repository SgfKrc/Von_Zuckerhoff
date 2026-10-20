// 键盘输入:持续按键 + 边沿触发
const down = new Set<string>()
const pressed = new Set<string>()

const PREVENT = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter',
])

export function initInput(): () => void {
  const globalWindow = window as Window & { __mdlInputController?: AbortController }
  globalWindow.__mdlInputController?.abort()
  const controller = new AbortController()
  globalWindow.__mdlInputController = controller
  const options = { signal: controller.signal }

  window.addEventListener('keydown', (e) => {
    if (PREVENT.has(e.key)) e.preventDefault()
    const k = normalize(e.key)
    if (!down.has(k)) pressed.add(k)
    down.add(k)
  }, options)
  window.addEventListener('keyup', (e) => {
    down.delete(normalize(e.key))
  }, options)
  window.addEventListener('blur', () => { down.clear(); pressed.clear() }, options)
  return () => {
    controller.abort()
    if (globalWindow.__mdlInputController === controller) delete globalWindow.__mdlInputController
    down.clear()
    pressed.clear()
  }
}

function normalize(key: string): string {
  if (key.length === 1) return key.toLowerCase()
  return key
}

export const Input = {
  held: (k: string) => down.has(k),
  setHeld(k: string, active: boolean) {
    const key = normalize(k)
    if (active) {
      if (!down.has(key)) pressed.add(key)
      down.add(key)
    } else {
      down.delete(key)
    }
  },
  axis(): { x: number; y: number } {
    let x = 0, y = 0
    if (down.has('ArrowLeft') || down.has('a')) x -= 1
    if (down.has('ArrowRight') || down.has('d')) x += 1
    if (down.has('ArrowUp') || down.has('w')) y -= 1
    if (down.has('ArrowDown') || down.has('s')) y += 1
    return { x, y }
  },
  consume(k: string): boolean {
    const has = pressed.has(k)
    if (has) pressed.delete(k)
    return has
  },
  flush() { pressed.clear() },
}
