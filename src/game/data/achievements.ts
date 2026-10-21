import type { Achievement } from '../types'

/** 垂直切片：7 项 */
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'ch0', name: '糖堡站', desc: '抵达聚斯霍芬堡。', group: 'chapter' },
  { id: 'ch1', name: '糖庄', desc: '读完家族史，见过时计塔。', group: 'chapter' },
  { id: 'firstBlueprint', name: '量过它了', desc: '第一次打开图纸。', group: 'explore' },
  { id: 'firstRepair', name: '补上那条线', desc: '第一次补图成功。', group: 'explore' },
  { id: 'threeProofs', name: '不对劲', desc: '找到古堡的三处结构异常。', group: 'explore' },
  { id: 'firstSugar', name: '老式白糖', desc: '吃下第一块糖。', group: 'explore' },
  { id: 'firstItem', name: '收进背包', desc: '第一次把东西收进背包。', group: 'explore' },
  { id: 'etiquettePerfect', name: '像样的继承人', desc: '礼仪课三道题全对。座位、封地、血缘，一个都没错。', group: 'explore' },
  { id: 'grimmRead', name: '黑格林童话', desc: '读完了那本没有作者名字的书。最后一页是一幅木刻。', group: 'explore' },
  { id: 'frankfurtDream', name: '纱锭与煤气灯', desc: '在梦里重走了一遍法兰克福的前半生。醒来时手上还有墨迹。', group: 'chapter' },
  { id: 'portraitBreath', name: '她在笑', desc: '在图纸模式下看过维多利亚的画像。', group: 'secret', secret: true },
  { id: 'cameo', name: '不是这个世界的蓝', desc: '在车厢尽头和一个不该在那里的女仆说过话。', group: 'secret', secret: true },
]

export function ach(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id)
}
