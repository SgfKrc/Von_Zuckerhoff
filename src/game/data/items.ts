// ============================================================
// 物品定义：背包系统的静态数据
// 文案风格按 docs/design/NARRATIVE_DESIGN.md §7：
// 句号优先、数字精确、内心独白用全角括号、不用现代词。
// 只放数据，不放状态：状态的读写全部在 game/store.ts。
// ============================================================

export type ItemId = 'letter' | 'brooch' | 'luggage' | 'sugar' | 'ink' | 'watch' | 'bone'

/** 物品类型：关键 / 线索 / 食用 / 材料 */
export type ItemKind = 'key' | 'clue' | 'consumable' | 'material'

export interface ItemDef {
  id: ItemId
  name: string
  /** 2–4 句，哥特口吻（§7） */
  desc: string
  kind: ItemKind
  /** 能否在背包里「使用」 */
  usable?: boolean
  /** 使用时的文本（糖 / 墨水在 store 里有专门的副作用，这里的文本作兜底） */
  useText?: string
}

/** 类型 → 背包详情面板上的中文标签 */
export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  key: '关键',
  clue: '线索',
  consumable: '食用',
  material: '材料',
}

export const ITEMS: Record<ItemId, ItemDef> = {
  // ---- 列车上的三件：调查后收进背包，之后从背包栏查看 ----
  letter: {
    id: 'letter',
    name: '继承通知',
    desc:
      '信纸薄得能对着窗看见背面的字。十四行，第九行有一个墨点。\n' +
      '火漆盖住签名的一半，那个字母像 H，也像 M。\n' +
      '（读第二十七遍了。行数、字数、墨点的位置，一个都没变。）',
    kind: 'clue',
  },
  brooch: {
    id: 'brooch',
    name: '黑秃鹫胸针',
    desc:
      '银的，不是纯银，掺了镍。秃鹫的翅膀有十九根羽毛。\n' +
      '十字的四条臂，每条一指宽。别针是新焊的，旧孔的印子还留在衬布上。\n' +
      '（有人在捡到我的那天，把它别在布上。可背面刻的不是我的名字。）',
    kind: 'clue',
  },
  luggage: {
    id: 'luggage',
    name: '战列巡洋舰线图',
    desc:
      '硬纸板箱，边角用麻绳缠了两道，锁扣是坏的。\n' +
      '箱底卷着一份基尔第七船台的肋材线图，公差两格，图纸上标的是三点五。\n' +
      '（铜片上有一道新的划痕。像是有人先我一步打开过这只箱子。）',
    kind: 'clue',
  },
  // ---- 消耗品：糖罐在 HUD 上是数字，物品是那一包糖 ----
  sugar: {
    id: 'sugar',
    name: '老式白糖',
    desc:
      '用一小张纸包着的老式白糖，纸角受了潮。艾玛给的。\n' +
      '含在舌下，苦味会退一点。\n' +
      '（吃完这一包，罐底就只剩三块了。）',
    kind: 'consumable',
    usable: true,
    useText: '糖在舌下化了。老式白糖的味道。',
  },
  // ---- 墨水：本切片只做「查看剩余量」，真正补图在 BlueprintRepair 里 ----
  ink: {
    id: 'ink',
    name: '墨水瓶',
    desc:
      '半瓶黑墨水，软木塞被咬过。\n' +
      '瓶身上有一道用指甲划的线，记着上次的余量。\n' +
      '（线在瓶腰上面。还剩多少，我不用看也知道。）',
    kind: 'material',
    usable: true,
    useText: '墨水瓶晃了晃。',
  },
  // ---- 主角自己的怀表：时间对不上 ----
  watch: {
    id: 'watch',
    name: '黄铜怀表',
    desc:
      '父亲留下的黄铜怀表，壳上有一道浅坑。\n' +
      '秒针比车厢那头停住的钟快半格。他对过三次表，三次都差半格。\n' +
      '（停住的钟也许才是准的。我不愿意这么想。）',
    kind: 'key',
  },
  // ---- 月兽骨骼：后续章节才拿到，这里先定义、不发放 ----
  bone: {
    id: 'bone',
    name: '月兽骨骼',
    desc:
      '月兽的一节肋骨，比同尺寸的鹿骨轻一半。断面是冷的，摸着不凉。\n' +
      '骨头里有一层极细的响，像很远的地方有人在敲铁。\n' +
      '（这东西不该出现在这座堡里。至少不该出现在今晚。）',
    kind: 'material',
  },
}

/** 运行时校验：旧存档 / 导入的 JSON 里可能混进别的字符串 */
export function isItemId(v: unknown): v is ItemId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, v)
}
