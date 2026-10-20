import type { Dir, MapId } from './types'

// 引擎与应用之间的桥。engine.ts 启动后会覆盖这些实现。
export const bridge = {
  getPos: (): { map: MapId; x: number; y: number } => ({ map: 'train', x: 0, y: 0 }),
  teleport: (_map: MapId, _x: number, _y: number, _dir?: Dir) => {},
  shake: (_frames: number) => {},
}
