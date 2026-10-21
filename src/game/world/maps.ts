// ============================================================
// 地图数据（垂直切片：序章 7 张 + 第一章 7 张）
// 图例见 art/tiles.ts
// struct 层字符见 types.ts 的 STRUCT_CHARS
// 规则：tiles 每行等宽；struct 与 tiles 尺寸完全一致
// ============================================================
import type { GameMap } from '../types'

// ---------------- 序章 ----------------

const train: GameMap = {
  id: 'train',
  name: '南下黑森林的列车',
  ambient: 'indoor',
  dark: 0.34,
  // 一节老式车厢的俯视：36×9。
  // 上下两排厢座：每个厢座 = 两把单人椅夹一张小桌（J K J，两座相对），
  // 厢座之间空一格；上下两排在 x 上对齐 —— 上排椅 'J' 靠背朝上、下排椅 'j' 靠背朝下，
  // 同一 x 的上下两把椅子隔着地毯相对，中间是过道。
  // 中间三行是过道地毯：最上一行 c（上包边 + 流苏）、中间 C（纯毯面）、最下一行 d（下包边 + 流苏），
  // 这样整条毯子只有最外两行带边，不会每一行都带边而读成三条地毯。
  // 两侧各一行木地板 -（座椅搁脚的空当）。
  // 车窗 N 开在两侧车壁上、每 4 格一扇，正好落在厢座小桌的正上方/正下方。
  // 两端是车门洞 D（左端通下一节车厢，右端下车去糖堡站）。
  tiles: [
    '===N===N===N===N===N===N===N===N====',
    '=-JKJ-JKJ-JKJ-JKJ-JKJ-JKJ-JKJ-JKJ--=',
    '=----------------------------------=',
    'DccccccccccccccccccccccccccccccccccD',
    'DCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCD',
    'DddddddddddddddddddddddddddddddddddD',
    '=----------------------------------=',
    '=-jKj-jKj-jKj-jKj-jKj-jKj-jKj-jKj--=',
    '===N===N===N===N===N===N===N===N====',
  ],
  struct: [
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    'SFJFJFJFJFJFJFJFJFJFJFJFJFJFJFJFJFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT',
    'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT',
    'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFJFJFJFJFJFJFJFJFJFJFJFJFJFJFJFJFFS',
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
  ],
  entities: [
    // 主线：猫与艾玛。信、胸针、线图不在场景里 —— 开局就在背包中（见 store.ts）。
    // 猫趴在过道地毯上。
    { id: 'cat', x: 9, y: 4, sprite: 'cat', interact: 'lookCat' },
    // 艾玛坐在第 5 个厢座里：坐标取该厢座靠过道那把 J 椅子旁的可走格（座椅前的木地板）。
    { id: 'emmaSeat', x: 20, y: 2, sprite: 'emma_down', solid: true, interact: 'talkEmmaTrain' },

    // ---- 上排厢座（y1，窗在桌子正上方的 x3/7/11/15/19/23/27/31）----
    // 睡着的老人：第 2 个厢座，坐在靠窗那把椅子上
    // （24×32 的角色精灵由 renderer 的 isChar 统一底对齐到格子底边，
    //   地图实体不要再写 tall —— 叠上会双重上抬一格）
    { id: 'sleeper', x: 6, y: 1, sprite: 'npc_sleeper_down', solid: true, interact: 'trainSleeper' },
    // 看报的先生：第 4 个厢座
    { id: 'newspaper', x: 14, y: 1, sprite: 'npc_reader_down', solid: true, interact: 'trainNewspaper' },
    // 行李架：第 7 与第 8 个厢座之间的车壁（y0 = 车壁那一行），
    // 32×16 的横长精灵：一根金属杆 + 三件挂在杆下的行李，杆下留空露出车壁。
    // 不复用 bookshelf —— 那是书架，车厢里的行李架不长那样。
    { id: 'rack', x: 29, y: 0, sprite: 'luggageRack', solid: true, interact: 'trainRack' },

    // ---- 下排厢座（y7，与上排同一套 x）----
    // 抱孩子的女人：第 6 个厢座的靠窗椅。（同上：isChar 已底对齐，不写 tall）
    { id: 'mother', x: 22, y: 7, sprite: 'npc_mother_down', solid: true, interact: 'trainMother' },
    // 孩子：同一个厢座里、母亲对面那把椅子（新增实体，纯装饰，没有交互脚本）
    { id: 'child', x: 24, y: 7, sprite: 'npc_child_down', solid: true },
    // 空座与手杖：第 7 个厢座靠窗那把椅子（座位空着，手杖靠在座垫上）
    { id: 'cane', x: 28, y: 7, sprite: 'tableSmall', solid: true, interact: 'trainCane' },

    // ---- 氛围：沿车身均匀分布 ----
    // 煤烟味：车头方向，左端地毯上（味从地板下面来）
    { id: 'smoke', x: 2, y: 3, sprite: 'notice', solid: false, interact: 'trainSmoke' },
    // 湿脚印：过道地毯上
    { id: 'footstep', x: 5, y: 5, sprite: 'notice', solid: false, interact: 'trainFootstep' },
    // 窗帘：x15 那扇窗正下方的座椅前木地板
    { id: 'curtain', x: 15, y: 2, sprite: 'notice', solid: false, interact: 'trainCurtain' },
    // 结霜：x23 那扇窗（窗户下半截落在座椅前）
    { id: 'frost', x: 23, y: 2, sprite: 'notice', solid: false, interact: 'trainFrost' },
    // 垃圾桶：右端最后一个厢座的座位底下
    { id: 'bin', x: 33, y: 7, sprite: 'tableSmall', solid: true, interact: 'trainBin' },

    // ---- 不可交互的装饰：毛毯 / 挂在窗边的大衣 / 地上的一只手套 ----
    { id: 'blanket', x: 10, y: 2, sprite: 'notice', solid: false },
    { id: 'coat', x: 17, y: 1, sprite: 'bookshelf', solid: false, tall: true },
    { id: 'glove', x: 26, y: 5, sprite: 'notice', solid: false },
    // 彩蛋：车厢左端的门洞里多出的人。默认不可见，调查满 4 件东西后 dsOpen 才为真；
    // 说过一次话就 dsGone，永远不再出现（见 events.ts 的 noteTrainLook）。
    // facePlayer：她是四方向角色，玩家站到哪一侧她就转向哪一侧（renderer 的 facingToPlayer）。
    { id: 'dsCameo', x: 0, y: 4, sprite: 'ds_down', solid: false, showFlag: 'dsOpen', hideFlag: 'dsGone', interact: 'dsCameo', facePlayer: true },
  ],
  portals: [
    // 右端车门：列车还在走的时候锁着。
    // 到站演出（engine.ts 的到站序列）最后一句落下 canDisembark，门才开。
    {
      x: 35, y: 4, to: 'station', tx: 4, ty: 6, dir: 'right',
      lockFlag: 'canDisembark', lockMsg: '车门锁着。列车还在走。',
    },
  ],
}

const station: GameMap = {
  id: 'station',
  name: '糖堡站',
  ambient: 'fog',
  // 站台几乎全在雨里。原来的 0.58 会把三层森林远景连同煤气灯的暖光一起吃掉，
  // 压到 0.36 —— 暗角仍然在（边缘是黑的），但画面中央那盏灯亮得出来。
  dark: 0.36,
  // 26×18。地图改成"横向一条站台"，远景才有地方露出来：
  //   y0..5    虚空 —— 远景窗口（96px）：远山脊 / 冷杉林 / 雾带从这 6 行透出来
  //   y6..10   木站台（z）：月台本身，只铺木板，装饰全是实体
  //   y11      站台边缘（k）：石压条 + 骨白警示线，往外就下不去了
  //   y12      铁轨（r）：一道夜里的钢轨，锈在轨面上
  //   y13..17  虚空 —— 远景的暗部：站台边缘外的那片黑
  // 站在 y6 这一头（从车厢下来）时，画面正好是：
  // 上 96px 森林远景，中间 80px 月台，底下十几像素的站台边与铁轨。
  tiles: [
    '                          ',
    '                          ',
    '                          ',
    '                          ',
    '                          ',
    '                          ',
    'zzzzzzzzzzzzzzzzzzzzzzzzzz',
    'zzzzzzzzzzzzzzzzzzzzzzzzzz',
    'zzzzzuzzzzzzzzzzzzzzzzzzzz',
    'zzzzzzzzzzzzzzzzzzzzzuzzzz',
    'zzzzzzzzzzzzzzzzzzzzzzzzzz',
    'kkkkkkkkkkkkkkkkkkkkkkkkkk',
    'rrrrrrrrrrrrrrrrrrrrrrrrrr',
    '                          ',
    '                          ',
    '                          ',
    '                          ',
    '                          ',
  ],
  struct: [
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVMVVVVVVMVVVVVVMVVVVVV',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'TTTTTTTTTTTTTTTTTTTTTTTTTT',
    'RRRRRRRRRRRRRRRRRRRRRRRRRR',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
  ],
  entities: [
    // ---- 主线：站牌 / 两盏煤气灯 / 艾玛 ----
    { id: 'sign', x: 13, y: 6, sprite: 'notice', solid: true, interact: 'stationSign' },
    // 两盏煤气灯：整张雨夜画面里唯一稳定的暖源（fore 层的暖光晕按这两个位置算，
    // 所以实体 id 改成 stationLamp* —— 别和别的房间那支烛台（id 也叫 lamp）混了）
    { id: 'stationLampL', x: 3, y: 6, sprite: 'candelabra', solid: true, tall: true, interact: 'stationLamp' },
    { id: 'stationLampR', x: 22, y: 6, sprite: 'candelabra', solid: true, tall: true },
    { id: 'emma2', x: 19, y: 6, sprite: 'emma_right', solid: true, interact: 'talkEmmaStation' },

    // ---- 精细化：月台上该有的东西 ----
    // 雨棚立柱：站在月台根上（y5 是虚空那一行，柱子立不住人，只立柱子）。
    // 三根等距，中间那根能查；画见 art/tiles.ts 的 DECOR_SPRITES.stationCanopy。
    { id: 'stationCanopyA', x: 5, y: 5, sprite: 'gateArch', tall: true },
    { id: 'stationCanopy', x: 12, y: 5, sprite: 'gateArch', tall: true, interact: 'stationCanopy' },
    { id: 'stationCanopyB', x: 19, y: 5, sprite: 'gateArch', tall: true },
    // 行李推车：两格宽，车板歪着，三件行李没人取（sprite 只是占位 + 碰撞宽度）
    { id: 'stationCart', x: 7, y: 7, sprite: 'table', solid: true, interact: 'stationCart' },
    // 长椅：靠背朝月台根，坐面是湿的
    { id: 'stationBench', x: 16, y: 8, sprite: 'table', solid: true, interact: 'stationBench' },
    // 水洼：瓦片负责画（'u'），实体只负责"能按 E 看一眼"
    { id: 'stationPuddle', x: 5, y: 8, sprite: 'notice', interact: 'stationPuddle' },
    // 乌鸦：站在月台边缘的警示线里侧，雨里一动不动
    { id: 'stationCrow', x: 10, y: 10, sprite: 'cat', interact: 'stationCrow' },

    // ---- 图纸模式专属：告示牌（现实里看不见，是绘图员读出来的标注） ----
    { id: 'bpStationEdge', x: 20, y: 10, sprite: 'notice', blueprintOnly: true, interact: 'bpStationEdge' },
    { id: 'bpStationPost', x: 12, y: 7, sprite: 'notice', blueprintOnly: true, interact: 'bpStationPost' },
  ],
  portals: [
    // 回到列车：落点改到车厢右端过道（x34），正好在车门内侧，不再是旧图的中段
    { x: 1, y: 9, to: 'train', tx: 34, ty: 4, dir: 'left' },
    // 去山路：落点挪到 (2,6) —— 原来正落在山路自己的回程传送门上，站住不动就会被弹回来
    { x: 24, y: 9, to: 'road', tx: 2, ty: 6, dir: 'right' },
  ],
}
const road: GameMap = {
  id: 'road',
  name: '雾中的山路',
  ambient: 'fog',
  // 原来 0.72 的暗角是为"夜里的石地"设的；现在这条路的两侧就是林子，
  // 远景本身已经压得很黑，暗角只留 0.44 —— 再重，四层视差就只剩一层。
  dark: 0.44,
  // 48×18。把路从"一条走廊"改成"一条山道"：
  //   y0..4    虚空 —— 远景窗口（80px）：远山 / 更密的树线（中间一条缝）/ 斜插的近景树干
  //   y5..8    山道（x）：夯土与碎石，两道浅车辙。x33 那两格是塌下来的林子，
  //                      路在这里收窄成一个拐角（图上的路在别处是直的）
  //   y9       路的下一步就是林子（^）：下坡那一侧，x20..27 是一段铁链护栏（y，阻挡）
  //   y10..17  冷杉林（^）：树封到画面下缘，走不进去
  tiles: [
    '                                                ',
    '                                                ',
    '                                                ',
    '                                                ',
    '                                                ',
    'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    'xxxxxxxxxxxxxxxxxxxxxxxxxxxx^^xxxxxxxxxxxxxxxxxx',
    'xxxxxxxxxxxxxxxxxxxxxxxxxxxx^^xxxxxxxxxxxxxxxxxx',
    'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    '^^^^^^^^^^^^^^^^^^^^yyyyyyyy^^^^^^^^^^^^^^^^^^^^',
    'hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
    '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
    '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
    '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
    '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
    '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
    '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
    '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
  ],
  struct: [
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    'FFFFFFFFFFFFFFFFFFFFFFFFFFFFIIFFFFFFFFFFFFFFFFFF',
    'FFFFFFFFFFFFFFFFFFFFFFFFFFFFIIFFFFFFFFFFFFFFFFFF',
    'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
    'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  ],
  entities: [
    // ---- 主线：三处停下来（原样保留，只是从 y4/y5 挪进了路里） ----
    { id: 'roadStep1', x: 12, y: 6, sprite: 'notice', solid: false, interact: 'roadStop1' },
    { id: 'roadStep2', x: 26, y: 7, sprite: 'notice', solid: false, interact: 'roadStop2' },
    { id: 'roadStep3', x: 38, y: 6, sprite: 'notice', solid: false, interact: 'roadStop3' },

    // ---- 精细化：一条修过的山路该有的东西 ----
    // 路标：木杆两块牌，上面那块削成箭头指向右（聚斯霍芬堡的方向）
    { id: 'roadSign', x: 8, y: 5, sprite: 'notice', solid: true, interact: 'roadSign' },
    // 倒塌的树干：横在路中间，两格宽（占 x18..19），人得从上下绕
    { id: 'roadTrunk', x: 18, y: 7, sprite: 'table', solid: true, interact: 'roadTrunk' },
    // 玛尼堆：路边三块石头码起来的记号，没人知道是谁码的
    { id: 'roadCairn', x: 33, y: 5, sprite: 'notice', interact: 'roadCairn' },
    // 界碑：碑是旧的，底座是新凿的（碑面朝路，读得出笔画数）
    { id: 'roadMilestone', x: 24, y: 6, sprite: 'notice', solid: true, interact: 'roadMilestone' },
    // 护栏铁链：瓦片画链子（'y'），实体只要一个能调查的点
    { id: 'roadChain', x: 23, y: 9, sprite: 'notice', interact: 'roadChain' },

    // ---- 图纸模式专属：告示牌 ----
    // 两处都放在山路中段：站在 (20,5) 一按 Tab 就都看得见 —— 这个位置本身
    // 也在说：它们不是"路边的牌子"，是图纸上的标注。
    { id: 'bpRoadStone', x: 25, y: 5, sprite: 'notice', blueprintOnly: true, interact: 'bpRoadStone' },
    { id: 'bpRoadBend', x: 27, y: 6, sprite: 'notice', blueprintOnly: true, interact: 'bpRoadBend' },
  ],
  portals: [
    { x: 1, y: 5, to: 'station', tx: 23, ty: 6, dir: 'left' },
    { x: 46, y: 5, to: 'gate', tx: 11, ty: 16, dir: 'up' },
  ],
}
const gate: GameMap = {
  id: 'gate',
  name: '聚斯霍芬堡 · 正门',
  ambient: 'night',
  // 远景（gate-castle.webp）压到 0.30，这层暗角就不能再重：0.40 时
  // 画面上缘的钟楼还认得出窗棂，石阶与门洞仍然沉在暗里。
  dark: 0.40,
  camBiasY: -72,
  // 26×20。城墙压到三行，远景那 120px 才空得出来：
  //   y0..9    虚空 —— 远景窗口：城堡正面（钟楼在右上、石像鬼在两侧）
  //   y10      城垛（# 一格隔一格）：墙顶的齿，衬在远景上
  //   y11..13  城墙与门洞：x11..13 是门洞，y13 是门槛（w）
  //   y14..17  门前院子：石阶、水沟（s，横贯 y15）、从山路走上来的那一头
  //   y18..19  山脊上的冷杉与外墙
  // 门前的空地上站着人（13,14），抬头就是城堡正面 —— 相机 bias 让这一段
  // 正好落在画面上方：y11 的墙顶停在屏幕 120px 处，上面全是远景。
  tiles: [
    '                          ',
    '                          ',
    '                          ',
    '                          ',
    '                          ',
    '                          ',
    '                          ',
    '                          ',
    '                          ',
    '                          ',
    '##..##..##..##..##..##..##',
    '##########################',
    '###########...############',
    '###########www############',
    '#........................#',
    '#ssssssssssssssssssssssss#',
    '#........................#',
    '#........................#',
    '#^^^^^^^^^^^^^^^^^^^^^^^^#',
    '##########################',
  ],
  struct: [
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVV',
    'SS..SS..SS..SS..SS..SS..SS',
    'SSSSSSSSSSSSSSSSSSSSSSSSSS',
    'SSSSSSSSSSSFFFSSSSSSSSSSSS',
    'SSSSSSSSSSSFFFSSSSSSSSSSSS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SVVVVVVVVVVVVVVVVVVVVVVVVS',
    'SSSSSSSSSSSSSSSSSSSSSSSSSS',
  ],
  entities: [
    // ---- 主线：门 / 旗 / 艾玛（门与旗挪到了新的墙面上） ----
    { id: 'gateDoor', x: 12, y: 12, sprite: 'gateArch', solid: false, interact: 'knockGate', tall: true },
    // 旗：挂在门右侧的墙面下端（原来挂在虚空里，现在那上面是远景）
    { id: 'flag', x: 17, y: 13, sprite: 'bigPainting', solid: false, tall: true, interact: 'gateFlag' },
    { id: 'emma3', x: 14, y: 16, sprite: 'emma_up', solid: true, interact: 'talkEmmaGate' },

    // ---- 精细化：门前的五件东西 ----
    // 石像鬼：门两侧各一尊，蹲在墙脚上（画见 DECOR_SPRITES，16×32 底对齐）
    { id: 'gateGargoyleL', x: 9, y: 13, sprite: 'gateArch', tall: true, interact: 'gateGargoyle' },
    { id: 'gateGargoyleR', x: 15, y: 13, sprite: 'gateArch', tall: true, interact: 'gateGargoyleR' },
    // 吊闸的铁链：垂在门洞左侧的门槛上，钩子空着（原来放在右侧，被站在 (13,14) 的
    // 主角背影挡住了一半）
    { id: 'gateChain', x: 11, y: 13, sprite: 'notice', tall: true, interact: 'gateChain' },
    // 枯树：院子右侧，一根没有叶子的黑树干
    { id: 'gateTree', x: 19, y: 14, sprite: 'gateArch', solid: true, tall: true, interact: 'gateTree' },
    // 水沟：瓦片画沟（s，y15 横贯），实体在院子里给一个调查点
    { id: 'gateDitch', x: 18, y: 15, sprite: 'notice', interact: 'gateDitch' },
    // 门槛上的刻痕：站在门洞下低头看
    { id: 'gateThreshold', x: 13, y: 13, sprite: 'notice', interact: 'gateThreshold' },

    // ---- 图纸模式专属：告示牌 ----
    { id: 'bpGateArch', x: 12, y: 14, sprite: 'notice', blueprintOnly: true, interact: 'bpGateArch' },
    { id: 'bpGateGargoyle', x: 9, y: 14, sprite: 'notice', blueprintOnly: true, interact: 'bpGateGargoyle' },
  ],
  portals: [
    { x: 12, y: 17, to: 'road', tx: 45, ty: 5, dir: 'down' },
    { x: 12, y: 13, to: 'hall', tx: 12, ty: 14, dir: 'up', lockFlag: 'gateOpen', lockMsg: '门闩沉重。' },
  ],
}
const hall: GameMap = {
  id: 'hall',
  name: '聚斯霍芬堡 · 门厅',
  ambient: 'indoor',
  dark: 0.44,
  tiles: [
    '##########################',
    '##########################',
    '##########################',
    '##########################',
    '#........................#',
    '#.LL..................LL.#',
    '#........................#',
    '#........................#',
    '#.........,,,,,,.........#',
    '#.........,,,,,,.........#',
    '#........................#',
    '#.LL..................LL.#',
    '#........................#',
    '#.........,,,,,,.........#',
    '#........................#',
    '##########################',
  ],
  struct: [
    'SSSSSSSSSSSSSSSSSSSSSSSSSS',
    'SSSSSSSSSSSSSSSSSSSSSSSSSS',
    'SSSSSSSSSSSSSSSSSSSSSSSSSS',
    'SSSAASSSSSSSSSSSSSSSAASSSS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFMFFFFFFFFFFFFFFFFFFFFMFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFMMFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFMFFFFFFFFFFFFFFFFFFFFMFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SSSSSSSSSSSSSSSSSSSSSSSSSS',
  ],
  entities: [
    { id: 'victoria', x: 12, y: 3, sprite: 'bigPainting', solid: false, tall: true, interact: 'lookVictoria' },
    { id: 'ancestors', x: 4, y: 3, sprite: 'bigPainting', solid: false, tall: true, interact: 'hallAncestors' },
    { id: 'ancestors2', x: 20, y: 3, sprite: 'bigPainting', solid: false, tall: true, interact: 'hallAncestors' },
    { id: 'candL', x: 2, y: 5, sprite: 'candelabra', solid: true, tall: true, interact: 'lightCandle' },
    { id: 'candR', x: 22, y: 5, sprite: 'candelabra', solid: true, tall: true, interact: 'lightCandle' },
    { id: 'candL2', x: 2, y: 11, sprite: 'candelabra', solid: true, tall: true },
    { id: 'candR2', x: 22, y: 11, sprite: 'candelabra', solid: true, tall: true },
    { id: 'hermannHall', x: 18, y: 8, sprite: 'hermann_down', solid: true, interact: 'talkHermannHall' },
    { id: 'hallArch', x: 13, y: 9, sprite: 'notice', solid: false, interact: 'hallArch' },
  ],
  portals: [
    { x: 12, y: 14, to: 'gate', tx: 9, ty: 16, dir: 'down' },
    { x: 1, y: 10, to: 'cellar', tx: 10, ty: 2, dir: 'left', lockFlag: 'cellarOpen', lockMsg: '铁门锁着。' },
    { x: 24, y: 10, to: 'corridorE', tx: 2, ty: 6, dir: 'right', lockFlag: 'hallOpen' },
  ],
}
const corridorE: GameMap = {
  id: 'corridorE',
  name: '东翼走廊',
  ambient: 'indoor',
  dark: 0.62,
  tiles: [
    '############################',
    '#..........................#',
    '#..p..p..p..p..p..p..p..p..#',
    '#..........................#',
    '#..........................#',
    '#..........................#',
    '#..........................#',
    '#..p..p..p..p..p..p..p..p..#',
    '#..........................#',
    '############################',
  ],
  struct: [
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFMFFFFFFFFMFFFFFFFFMFFFFFMS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFMFFFFFFFFMFFFFFFFFMFFFFFMS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSS',
  ],
  entities: [
    { id: 'paint1', x: 3, y: 2, sprite: 'bigPainting', solid: false, tall: true, interact: 'lookPainting' },
    { id: 'paint2', x: 9, y: 2, sprite: 'bigPainting', solid: false, tall: true, interact: 'lookPainting' },
    { id: 'paint3', x: 15, y: 2, sprite: 'bigPaintingGem', solid: false, tall: true, interact: 'lookWilliam' },
    { id: 'paint4', x: 21, y: 2, sprite: 'bigPainting', solid: false, tall: true, interact: 'lookPainting' },
    { id: 'hermannNight', x: 18, y: 6, sprite: 'hermann_left', solid: true, showFlag: 'nightWalk', interact: 'talkHermannNight' },
    { id: 'bedroomDoor', x: 26, y: 6, sprite: 'notice', solid: false, interact: 'enterBedroom' },
    { id: 'loopMark', x: 12, y: 6, sprite: 'notice', solid: false, interact: 'nightCorridorLoop' },
  ],
  portals: [
    { x: 1, y: 6, to: 'hall', tx: 20, ty: 12, dir: 'left' },
    { x: 26, y: 6, to: 'bedroom1', tx: 2, ty: 7, dir: 'right' },
  ],
}

const bedroom1: GameMap = {
  id: 'bedroom1',
  name: '东翼卧室',
  ambient: 'indoor',
  dark: 0.38,
  tiles: [
    '######################',
    '#....................#',
    '#..ppp..........bbbb.#',
    '#....................#',
    '#..BBB.........EE....#',
    '#..BBB.............. #',
    '#....................#',
    '#....................#',
    '#..bbbb......EE......#',
    '#....................#',
    '#....................#',
    '#..........L.........#',
    '#....................#',
    '######################',
  ],
  struct: [
    'SSSSSSSSSSSSSSSSSSSSSS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFMFFFFFFFFFFFFFFMMFFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFMFFFFFFFFFFFFFFFFMFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SSSSSSSSSSSSSSSSSSSSSS',
  ],
  entities: [
    { id: 'bed', x: 3, y: 4, sprite: 'bed', solid: true, interact: 'lookBed' },
    { id: 'desk', x: 15, y: 4, sprite: 'table', solid: true, interact: 'readChronicle' },
    { id: 'shelf', x: 16, y: 2, sprite: 'bookshelf', solid: true, tall: true, interact: 'lookShelf' },
    { id: 'shelf2', x: 17, y: 2, sprite: 'bookshelf', solid: true, tall: true },
    { id: 'lamp', x: 11, y: 11, sprite: 'candelabra', solid: true, tall: true },
    { id: 'mirror', x: 8, y: 2, sprite: 'bigPainting', solid: false, tall: true, interact: 'lookMirror' },
    { id: 'shelfLow', x: 3, y: 8, sprite: 'bookshelf', solid: true, tall: true },
    { id: 'shelfLow2', x: 4, y: 8, sprite: 'bookshelf', solid: true, tall: true },
    { id: 'ceiling', x: 10, y: 12, sprite: 'notice', solid: false, interact: 'bedroomCeiling' },
  ],
  portals: [
    { x: 1, y: 7, to: 'corridorE', tx: 26, ty: 6, dir: 'left' },
  ],
}

// ---------------- 第一章 ----------------

const dining: GameMap = {
  id: 'dining',
  name: '餐厅',
  ambient: 'indoor',
  dark: 0.36,
  tiles: [
    '##########################',
    '#........................#',
    '#...WWWW........WWWW.....#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#...ffff.................#',
    '#........................#',
    '##########################',
  ],
  struct: [
    'SSSSSSSSSSSSSSSSSSSSSSSSSS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFMMMMFFFFFFFFFFMMMMFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SSSSSSSSSSSSSSSSSSSSSSSSSS',
  ],
  entities: [
    { id: 'longTable', x: 5, y: 4, sprite: 'table', solid: true },
    { id: 'longTable2', x: 8, y: 4, sprite: 'table', solid: true },
    { id: 'longTable3', x: 5, y: 6, sprite: 'table', solid: true },
    { id: 'longTable4', x: 8, y: 6, sprite: 'table', solid: true },
    { id: 'fireDine', x: 4, y: 11, sprite: 'fireplace', solid: true, tall: true },
    { id: 'martaSpot', x: 19, y: 5, sprite: 'marta_down', solid: true, interact: 'talkMarta' },
    { id: 'emmaDine', x: 21, y: 10, sprite: 'emma_up', solid: true, interact: 'talkEmmaDining' },
    { id: 'hermannDine', x: 12, y: 2, sprite: 'hermann_down', solid: true, interact: 'talkHermannDining' },
    { id: 'silver', x: 7, y: 5, sprite: 'notice', solid: false, interact: 'diningSilver' },
  ],
  portals: [
    { x: 1, y: 12, to: 'corridorMain', tx: 20, ty: 8, dir: 'left' },
    { x: 24, y: 12, to: 'library', tx: 2, ty: 8, dir: 'right' },
  ],
}
const library: GameMap = {
  id: 'library',
  name: '图书室',
  ambient: 'indoor',
  dark: 0.42,
  tiles: [
    '##############################',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '##############################',
  ],
  struct: [
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
  ],
  entities: [
    { id: 'shelfA', x: 3, y: 2, sprite: 'bookshelf', solid: true, tall: true, interact: 'lookShelfLibrary' },
    { id: 'shelfB', x: 7, y: 2, sprite: 'bookshelf', solid: true, tall: true, interact: 'libraryShelfLangs' },
    { id: 'shelfC', x: 18, y: 2, sprite: 'bookshelf', solid: true, tall: true },
    { id: 'shelfD', x: 22, y: 2, sprite: 'bookshelf', solid: true, tall: true },
    { id: 'shelfE', x: 3, y: 11, sprite: 'bookshelf', solid: true, tall: true },
    { id: 'shelfF', x: 22, y: 11, sprite: 'bookshelf', solid: true, tall: true },
    { id: 'mapTable', x: 8, y: 5, sprite: 'table', solid: true, interact: 'lookMapTable' },
    { id: 'emmaLib', x: 24, y: 7, sprite: 'emma_left', solid: true, interact: 'talkEmmaLibrary' },
    { id: 'chronicleSpot', x: 14, y: 6, sprite: 'notice', solid: false, interact: 'readChronicleLibrary' },
  ],
  portals: [
    { x: 1, y: 12, to: 'dining', tx: 23, ty: 12, dir: 'left' },
    { x: 28, y: 12, to: 'parlor', tx: 2, ty: 7, dir: 'right' },
  ],
}
const corridorMain: GameMap = {
  id: 'corridorMain',
  name: '大走廊与画廊',
  ambient: 'indoor',
  dark: 0.52,
  tiles: [
    '########################################',
    '#......................................#',
    '#......................................#',
    '#......................................#',
    '#......................................#',
    '#......................................#',
    '#......................................#',
    '#......................................#',
    '#......................................#',
    '########################################',
  ],
  struct: [
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
  ],
  entities: [
    { id: 'williamPaint', x: 18, y: 2, sprite: 'bigPaintingGem', solid: false, tall: true, interact: 'lookWilliam' },
    { id: 'paintA', x: 3, y: 2, sprite: 'bigPainting', solid: false, tall: true, interact: 'lookPainting' },
    { id: 'paintB', x: 9, y: 2, sprite: 'bigPainting', solid: false, tall: true, interact: 'lookPainting' },
    { id: 'paintFace', x: 30, y: 2, sprite: 'bigPainting', solid: false, tall: true, interact: 'corridorPaintingFace' },
    { id: 'paintD', x: 35, y: 2, sprite: 'bigPainting', solid: false, tall: true, interact: 'lookPainting' },
    { id: 'bridgeDoor', x: 38, y: 4, sprite: 'notice', solid: false, interact: 'toBridge' },
  ],
  portals: [
    { x: 20, y: 8, to: 'dining', tx: 1, ty: 12, dir: 'up' },
    { x: 1, y: 4, to: 'garden', tx: 25, ty: 10, dir: 'left' },
    { x: 38, y: 4, to: 'bridge', tx: 7, ty: 22, dir: 'up' },
  ],
}
const bridge: GameMap = {
  id: 'bridge',
  name: '峡谷石桥',
  ambient: 'night',
  // 桥上几乎没有环境光：桥面自己亮，两侧的远景靠四层视差撑起来。
  // dark 压到 0.34 —— 暗角太重会把两侧远景压成纯黑，深谷就看不见了。
  dark: 0.34,
  // 镜头上抬 16px：桥上玩家略偏画面下方，头顶多露出一点夜空与远山，
  // 让人先看见「桥是往上走的」。gate 用 -72 是同一套机制，这里只要一点。
  camBiasY: -16,
  // 12×24 的纵向窄桥。以前它是 24×14 的「石砌房间」：四边全是悬崖瓦片、
  // 中间一块空地，玩家看不到自己站在高处。现在反过来 —— 窄、高、两侧全是深渊。
  //
  // 宽 12 格 = 192px，比视口（384px）窄一半：相机横向居中，
  // 屏幕左右各露出 96px 的远景（见 render/bridgeBackdrop.ts 的四层视差）。
  // 高 24 格 = 384px，相机纵向行程 384−216 = 168px —— 这 168px 就是纵深感。
  //
  //   y0..1    虚空（天空）：相机顶到最上方时，屏幕顶端露出 32px 夜空
  //   y2..4    北端平台（8 格宽，比桥面两侧各宽出 1 格），塔就在平台外
  //   y5..20   桥面：中间 4 格可走，两侧各 1 格栏杆
  //   y21..23  南端平台（同上），回大走廊的拱门在这一头
  //
  // 桥面占 x3..8：'[' ']' 是桥缘 + 栏杆（阻挡），'(' ')' 是栏杆断口（也当平台石沿），
  // 中间 x4..7 的 '_' 可走。'H' 是横向石板接缝，每 5 格一道 —— 栏杆断口与接缝错开两格，
  // 两者不会在同一行叠成一条横贯的黑带。两侧 ' ' 是深渊（在 SOLID_TILES 里，掉不下去）。
  tiles: [
    '            ',
    '            ',
    ' (________) ',
    ' (________) ',
    ' (________) ',
    '   [____]   ',
    '   [____]   ',
    '   (____)   ',
    '   [____]   ',
    '   [HHHH]   ',
    '   [____]   ',
    '   [____]   ',
    '   (____)   ',
    '   [____]   ',
    '   [HHHH]   ',
    '   [____]   ',
    '   [____]   ',
    '   (____)   ',
    '   [____]   ',
    '   [HHHH]   ',
    '   [____]   ',
    ' (________) ',
    ' (________) ',
    ' (________) ',
  ],
  struct: [
    'VVVVVVVVVVVV',
    'VVVVVVVVVVVV',
    'CSSSSSSSSSSC',
    'CSSSSSSSSSSC',
    'CSSSSSSSSSSC',
    'CCCSSSSSSCCC',
    'CCCSSSSSSCCC',
    'CCCSSSSSSCCC',
    'CCCSSSSSSCCC',
    'CCCSSSSSSCCC',
    'CCCSSSSSSCCC',
    'CCCSSSSSSCCC',
    'CCCSSSSSSCCC',
    'CCCSSSSSSCCC',
    'CCCSSSSSSCCC',
    'CCCSSSSSSCCC',
    'CCCSSSSSSCCC',
    'CCCSSSSSSCCC',
    'CCCSSSSSSCCC',
    'CCCSSSSSSCCC',
    'CCCSSSSSSCCC',
    'CSSSSSSSSSSC',
    'CSSSSSSSSSSC',
    'CSSSSSSSSSSC',
  ],
  entities: [
    // 看塔：站在桥面中段正对北岸 —— 塔的剪影在第 3 层远景上（render/bridgeBackdrop.ts）
    { id: 'towerView', x: 5, y: 10, sprite: 'notice', solid: false, interact: 'lookTower' },
    // 艾玛：桥面靠左栏杆。桥面只有 4 格宽，她一站，路就窄了一半
    { id: 'emmaBridge', x: 5, y: 15, sprite: 'emma_left', solid: true, interact: 'talkEmmaBridge' },
    // 风：靠右栏杆，从桥洞里上来的那股风
    { id: 'wind', x: 7, y: 17, sprite: 'notice', solid: false, interact: 'bridgeWind' },
  ],
  portals: [
    // 南端平台：回大走廊（从走廊右端的拱门出来，落点在南平台右侧、朝北看桥）
    { x: 4, y: 22, to: 'corridorMain', tx: 37, ty: 4, dir: 'left' },
    // 北端平台：塔的方向。桥到这里就到头了 —— 这一头封着，暂时过不去
    {
      x: 6, y: 3, to: 'bridge', tx: 6, ty: 8, dir: 'down',
      neverOpen: true, lockMsg: '桥的尽头塌了。石阶断在雾里，没有落脚的边。',
    },
  ],
}
const cellar: GameMap = {
  id: 'cellar',
  name: '地窖',
  ambient: 'indoor',
  dark: 0.78,
  tiles: [
    '####################',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#....++++..........#',
    '#..................#',
    '#..................#',
    '#..................#',
    '####################',
  ],
  struct: [
    'SSSSSSSSSSSSSSSSSSSS',
    'SFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFS',
    'SFFFCCCCFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFS',
    'SSSSSSSSSSSSSSSSSSSS',
  ],
  entities: [
    { id: 'barrel1', x: 4, y: 2, sprite: 'tableSmall', solid: true, interact: 'cellarBarrels' },
    { id: 'barrel2', x: 6, y: 2, sprite: 'tableSmall', solid: true },
    { id: 'barrel3', x: 4, y: 4, sprite: 'tableSmall', solid: true },
    { id: 'barrel4', x: 14, y: 4, sprite: 'tableSmall', solid: true },
    { id: 'ironDoor', x: 5, y: 7, sprite: 'gateArch', solid: false, tall: true, interact: 'lookIronDoor' },
    { id: 'emmaCellar', x: 14, y: 8, sprite: 'emma_up', solid: true, interact: 'talkEmmaCellar' },
  ],
  portals: [
    { x: 10, y: 1, to: 'hall', tx: 10, ty: 12, dir: 'down' },
  ],
}
const garden: GameMap = {
  id: 'garden',
  name: '后花园',
  ambient: 'night',
  dark: 0.50,
  tiles: [
    '############################',
    '#^^^^^^^^^^^^^^^^^^^^^^^^^^#',
    '#~~~~~~~~~~~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~~~~~~~~~~~~#',
    '#~~~~~...~~~~~~~~~~~~~~~~~~#',
    '#~~~~~...~~~~~~~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~~qqq~~~~~~~~~~#',
    '#~~~~~~~~~~~~qqqqq~~~~~~~~~#',
    '#~~~~~~~~~~~~~qqq~~~~~~~~~~#',
    '#~~~~~~~~~~~~~~~~~~~~~~~~~~#',
    '#^^^^^^^^^^^^^^^^^^^^^^^^^^#',
    '############################',
  ],
  struct: [
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFCCCCFFFFFFFFFS',
    'SFFFFFFFFFFFFCCCCCCFFFFFFFFS',
    'SFFFFFFFFFFFFFCCCCFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFFFFFFFS',
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSS',
  ],
  entities: [
    { id: 'pond', x: 14, y: 8, sprite: 'notice', solid: false, interact: 'lookPond' },
    { id: 'rod', x: 6, y: 6, sprite: 'easel', solid: true, interact: 'gardenRod' },
    { id: 'emmaGarden', x: 9, y: 10, sprite: 'emma_down', solid: true, interact: 'talkEmmaGarden' },
  ],
  portals: [
    { x: 25, y: 9, to: 'corridorMain', tx: 2, ty: 4, dir: 'right' },
  ],
}

const parlor: GameMap = {
  id: 'parlor',
  name: '接待厅',
  ambient: 'indoor',
  dark: 0.44,
  tiles: [
    '######################',
    '#....................#',
    '#...WWWW..........WW.#',
    '#....................#',
    '#....................#',
    '#....................#',
    '#....................#',
    '#....................#',
    '#...ffff.............#',
    '#....................#',
    '#....................#',
    '######################',
  ],
  struct: [
    'SSSSSSSSSSSSSSSSSSSSSS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFFMMMMFFFFFFFFFFMMFFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SFFFFFFFFFFFFFFFFFFFFS',
    'SSSSSSSSSSSSSSSSSSSSSS',
  ],
  entities: [
    { id: 'parlorTable', x: 6, y: 5, sprite: 'table', solid: true },
    { id: 'parlorFire', x: 4, y: 8, sprite: 'fireplace', solid: true, tall: true },
    { id: 'emmaParlor', x: 16, y: 5, sprite: 'emma_left', solid: true, interact: 'talkEmmaParlor' },
    { id: 'chairs', x: 9, y: 4, sprite: 'notice', solid: false, interact: 'parlorChairs' },
  ],
  portals: [
    { x: 1, y: 7, to: 'library', tx: 28, ty: 12, dir: 'left' },
  ],
}

// ---------------- 注册表 ----------------

export const MAPS: Record<string, GameMap> = {
  train, station, road, gate, hall, corridorE, bedroom1,
  dining, library, corridorMain, bridge, cellar, garden, parlor,
}

export const START_MAP = 'train'