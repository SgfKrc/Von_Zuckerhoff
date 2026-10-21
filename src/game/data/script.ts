// ============================================================
// 剧本数据（垂直切片：序章 + 第一章）
// 台词风格见 docs/design/NARRATIVE_DESIGN.md §7
// 标「原」者引自原作，行号见 docs/story/SOURCE_SYNOPSIS.md
// ============================================================
import type { Step } from '../types'

// 每一条台词都写成完整的 Step 对象：{ t: 'line', sp, text }。
// sp：none 旁白 / ftz 主角 / ftzCold 主角（冷）/ emma 艾玛 /
//     emmaQuiet 艾玛（极轻）/ hermann 赫尔曼 / marta 玛尔塔 / voice 无形之声。
// 纪律：单条 ≤64 字；艾玛 ≤12 字，只陈述、不劝阻；全篇感叹号 ≤5 个。

export const SCRIPTS: Record<string, Step[]> = {
  // ================= 序章 · 列车 =================


  // 进车厢时的入场对白。
  // 注意：开场分镜已经用字幕交代过「六月的雨」「从法兰克福出发」这些背景，
  // 并演过主角起身去盥洗室，所以这里不再重复，直接从他已经离开座位写起。
  // 进车厢时的入场对白。
  // 开场分镜已经用字幕交代过「六月的雨」「从法兰克福出发」这些背景，
  // 并演过主角起身去盥洗室，所以这里不重复，只补两句只有进到车厢才知道的事。
  arriveTrain: [
    { t: 'line', sp: 'none', text: '过道比座位宽不了多少。地毯把脚步声吃掉了。' },
    { t: 'line', sp: 'ftz', text: '（车厢一头的钟停在四点十七分。三天了，没有人去上发条。）' },
    { t: 'do', do: [{ flag: ['tutMove', true], toast: '方向键 / WASD 移动　E 或 空格 调查　Tab 图纸' }] },
  ],

  trainBox: [
    { t: 'line', sp: 'none', text: '行李箱是硬纸板做的，边角用麻绳缠了两道。' },
    { t: 'line', sp: 'ftz', text: '（两件换洗衬衫。一条备用的领子。一块肥皂。）' },
    { t: 'line', sp: 'none', text: '箱底压着一卷图纸。' },
    { t: 'line', sp: 'ftz', text: '（基尔造船厂第七船台的肋材线图。我抄的。）' },
    { t: 'line', sp: 'ftz', text: '（抄一份要三马克。抄的时候，我的手比在船台上还稳。）' },
    { t: 'line', sp: 'ftz', text: '（图上有一条线我改了三次。到今天还是错的。）' },
    { t: 'line', sp: 'ftz', text: '（公差两格。图纸上标的是三点五。）' },
    { t: 'line', sp: 'none', text: '图纸被卷回去，用一根旧鞋带系紧。' },
    { t: 'line', sp: 'none', text: '箱子的锁扣是坏的。铜片上有一道新的划痕。' },
    { t: 'line', sp: 'ftz', text: '（新的。有人开过这只箱子。或者只是我开的时候划的。）' },
    { t: 'line', sp: 'ftz', text: '（我不知道带它来有什么用。可是不带，我睡不着。）' },
    { t: 'line', sp: 'none', text: '图纸上有一条用红铅笔画的线。不是我画的。' },
    { t: 'line', sp: 'ftz', text: '（红铅笔。船台的图纸不用红铅笔。）' },
    { t: 'do', do: [{ flag: ['trainBoxSeen', true] }] },
  ],

  trainBrooch: [
    { t: 'line', sp: 'none', text: '胸针别在内袋的衬布上。别针弯过一次，又被掰直了。' },
    { t: 'line', sp: 'ftz', text: '（银的。不是纯银，掺了镍。边上有一圈磨白的痕迹。）' },
    { t: 'line', sp: 'ftz', text: '（秃鹫的翅膀有十九根羽毛。我数过。数了三遍。）' },
    { t: 'line', sp: 'ftz', text: '（十字的四条臂，每条一指宽。我的小指。）' },
    { t: 'line', sp: 'ftz', text: '（别针是新焊的。旧孔的印子还在衬布上。）' },
    { t: 'line', sp: 'ftz', text: '（有人把它从一件衣服上取下来，别到另一件上。）' },
    { t: 'line', sp: 'ftz', text: '（它在我襁褓里。嬷嬷说，捡到我的那天，它就别在布上。）' },
    { t: 'line', sp: 'none', text: '胸针的背面刻着两个字母和一行年份。年份被磨得只剩两个数字。' },
    { t: 'line', sp: 'ftz', text: '（不是我的名字。我的名字是嬷嬷给的。）' },
    { t: 'line', sp: 'ftz', text: '（弗里茨·施密特。施密特的意思是铁匠。）' },
    { t: 'choice', opts: [
      { text: '别在外套上', do: [{ flag: ['broochOn', true] }, { toast: '铜扣很凉。' }] },
      { text: '放回内袋', do: [{ toast: '我把它按回衬布上。' }] },
    ] },
  ],

  trainLetter: [
    { t: 'line', sp: 'none', text: '信纸很薄，对着窗能看见背面的字。' },
    { t: 'line', sp: 'ftz', text: '（第二十七遍。）' },
    { t: 'line', sp: 'ftz', text: '（第一遍我数了邮戳里的日期：主后XX年，五月十七日。）' },
    { t: 'line', sp: 'ftz', text: '（信是四月写的。它在路上走了一个月，才走到我手里。）' },
    { t: 'line', sp: 'ftz', text: '（第二遍我数了行数：十四行。第九行有一个墨点。）' },
    { t: 'line', sp: 'none', text: '「您是本家族最后的血裔。请于六月的第一场雨后动身。」' },
    { t: 'line', sp: 'ftz', text: '（第三遍我数了字数。一百零七个。不多不少。）' },
    { t: 'line', sp: 'none', text: '信末只有一个签名。火漆盖住了签名的一半。' },
    { t: 'line', sp: 'ftz', text: '（那个字母我认不出来。它像 H，也像 M。）' },
    { t: 'line', sp: 'emma', text: '信纸会烂的。' },
    { t: 'line', sp: 'ftz', text: '（她说得对。可我还是又读了一遍。）' },
    { t: 'line', sp: 'none', text: '我把信折回原来的三道折痕里。折痕已经很软了。' },
    { t: 'do', do: [{ flag: ['readLetter27', true] }] },
  ],

  trainWindow: [
    { t: 'line', sp: 'none', text: '窗外是东弗里斯兰群山中最古老的黑森林。' },
    { t: 'line', sp: 'none', text: '冷杉和云杉密密匝匝地挤在一起，树冠遮天蔽日，连雨水都漏不进来。' },
    { t: 'line', sp: 'ftz', text: '（森林在往后退。像一个人终于松开了手。）' },
    { t: 'line', sp: 'none', text: '有一瞬间，树林里亮起一点光，像有人举着灯站在树后。' },
    { t: 'line', sp: 'none', text: '再看的时候，没有了。' },
    { t: 'line', sp: 'ftz', text: '（一千步。走到那盏灯，大概要一千步。）' },
    { t: 'line', sp: 'ftz', text: '（也可能只是一滴雨。雨落在叶子上，也会亮一下。）' },
    { t: 'line', sp: 'ftz', text: '（我在心里记下了那棵树的位置。第三排，左起第七棵。）' },
  ],

  lookCat: [
    { t: 'line', sp: 'none', text: '一只三花猫蹲在座位底下。它不怕人。' },
    { t: 'line', sp: 'ftz', text: '（它比我先上车的。）' },
    { t: 'line', sp: 'none', text: '猫的左耳缺了一角，尾巴尖是白的。' },
    { t: 'line', sp: 'ftz', text: '（缺一角。我的左眉梢也有一道疤，浅的。）' },
    { t: 'choice', opts: [
      { text: '伸手摸它', do: [{ toast: '它把头偏开了。' }] },
      { text: '算了', do: [] },
    ] },
    { t: 'line', sp: 'none', text: '过了一会儿，它又把头偏回来，看着我。' },
    { t: 'line', sp: 'ftz', text: '（它看我的时候，不看我的脸。看我的手。）' },
    { t: 'line', sp: 'ftz', text: '（我摊开手。手上没有面包。）' },
  ],

  talkEmmaTrain: [
    { t: 'line', sp: 'emma', text: '您还是吃点东西吧。' },
    { t: 'line', sp: 'ftz', text: '我不饿。' },
    { t: 'line', sp: 'emma', text: '您已经一整天没吃东西了。' },
    { t: 'line', sp: 'ftz', text: '我说了，我不饿。' },
    { t: 'line', sp: 'none', text: '艾玛没有说话。她从手提袋里取出一块黑面包，掰成两半，把其中一半放在小桌上。' },
    { t: 'line', sp: 'none', text: '然后她拿起另一半，安静地咬了一口。' },
    { t: 'line', sp: 'ftz', text: '（面包很硬，很干，带着一丝若有若无的甜味——老式白糖的甜味。）' },
    { t: 'line', sp: 'ftz', text: '（祖克霍夫。糖庄。）' },
    { t: 'line', sp: 'none', text: '三花猫从座位底下钻出来，在两人之间坐下，看着那块面包。' },
    { t: 'line', sp: 'emma', text: '它不吃面包。' },
    { t: 'line', sp: 'none', text: '车厢晃了一下。面包在桌上滑了半寸。' },
    { t: 'line', sp: 'ftz', text: '（半寸。车厢的震动刚好让它滑半寸。这个我能算。）' },
    { t: 'choice', opts: [
      {
        text: '拿起面包',
        do: [{ flag: ['ateBread', true] }, { toast: '面包很硬。甜味很淡。' }],
        next: 'trainAskWhy',
      },
      { text: '把面包推回去', next: 'trainPushBack' },
    ] },
  ],

  trainPushBack: [
    { t: 'line', sp: 'none', text: '艾玛看了一眼那块被推回来的面包，没有说什么。' },
    { t: 'line', sp: 'none', text: '她把它收进手提袋里。' },
    { t: 'line', sp: 'emma', text: '到地方再吃也好。' },
    { t: 'line', sp: 'none', text: '她把袋子扣好，放在膝盖上，两只手叠在袋口。' },
    { t: 'line', sp: 'ftz', text: '（她一直这样叠着手。像在按住什么东西。）' },
    { t: 'do', do: [{ next: 'trainAskWhy' }] },
  ],

  trainAskWhy: [
    { t: 'line', sp: 'ftz', text: '艾玛。' },
    { t: 'line', sp: 'emma', text: '嗯。' },
    { t: 'line', sp: 'ftz', text: '我在想，为什么是我。' },
    { t: 'line', sp: 'emma', text: '您是祖克霍夫家的血裔。' },
    { t: 'line', sp: 'ftz', text: '我不是。我是孤儿院的弃婴。我没有姓氏，没有家谱，没有任何证据。' },
    { t: 'line', sp: 'none', text: '艾玛看着我。那双灰色的眼睛里没有任何情绪波动。' },
    { t: 'line', sp: 'emma', text: '凭那枚胸针。' },
    { t: 'line', sp: 'emma', text: '凭您的红发。' },
    { t: 'line', sp: 'emma', text: '凭您母亲临终前的话。' },
    { t: 'line', sp: 'ftz', text: '我母亲？' },
    { t: 'line', sp: 'none', text: '艾玛低下头，重新开始咀嚼那块黑面包。' },
    { t: 'line', sp: 'none', text: '咀嚼停了一下。只有半秒。然后她又继续了。' },
    { t: 'line', sp: 'emma', text: '您会知道的。' },
    { t: 'line', sp: 'emma', text: '到了堡里，您就都知道了。' },
    { t: 'line', sp: 'ftz', text: '（她回避了。她只回避过这一个问题。）' },
    { t: 'do', do: [{ flag: ['askedWhy', true] }] },
  ],

  // ================= 序章 · 糖堡站 =================

  arriveStation: [
    { t: 'line', sp: 'none', text: '列车在第四个傍晚到达了终点站。' },
    { t: 'line', sp: 'none', text: '这是东弗里斯兰群山中最小的车站，只有一条铁轨，一个木制的站台，和一盏摇摇欲坠的煤气灯。' },
    { t: 'line', sp: 'ftz', text: '（糖堡站。）' },
    { t: 'line', sp: 'none', text: '雨已经停了，但空气还是湿的。浓雾从森林深处涌出来，裹住了整座车站。' },
    { t: 'line', sp: 'none', text: '我回头看了一眼。列车已经消失在雾气中，连汽笛声都没有留下。' },
    { t: 'line', sp: 'ftz', text: '（二十三步。站台从头到尾，二十三步。）' },
    { t: 'line', sp: 'none', text: '铁轨上有一层薄锈。锈上落着雨。' },
    { t: 'line', sp: 'ftz', text: '（这条铁轨至少半年没有过车了。锈是从底下长上来的。）' },
    { t: 'line', sp: 'ftz', text: '（可我今天就是坐它来的。）' },
    { t: 'line', sp: 'none', text: '站台的木板上有一道很长的刮痕，从站牌一直拖到铁轨边。' },
    { t: 'line', sp: 'ftz', text: '（行李箱拖出来的。拖的人没有回头。）' },
    { t: 'line', sp: 'emma', text: '走吧。' },
    { t: 'do', do: [{ toast: '调查站牌、煤气灯，然后向右走出车站' }] },
  ],

  stationSign: [
    { t: 'line', sp: 'none', text: '一块褪色的木牌，上面用哥特体写着三个字。' },
    { t: 'line', sp: 'ftz', text: '（糖堡站。Süsshofen。）' },
    { t: 'line', sp: 'ftz', text: '（Süss 是甜。Hofen 是院子，是庄园。）' },
    { t: 'line', sp: 'ftz', text: '（甜味的庄园。一个站名，就是一句话。）' },
    { t: 'line', sp: 'none', text: '木牌的右下角钉着一枚铁钉，钉帽锈成了一个黑点。' },
    { t: 'line', sp: 'ftz', text: '（彼时的我尚不明白那意味着什么。）' },
    { t: 'do', do: [{ flag: ['sawSign', true] }] },
  ],

  stationLamp: [
    { t: 'line', sp: 'none', text: '一盏煤气灯。玻璃罩上有裂纹，火苗在下雨的时候大概灭过很多次。' },
    { t: 'line', sp: 'ftz', text: '（没有人来修。这里没有活人。）' },
    { t: 'line', sp: 'none', text: '灯里还剩一点气。火苗有气无力地立着，照出一小块十步见方的地面。' },
    { t: 'line', sp: 'ftz', text: '（十步。再往外就是雾。）' },
    { t: 'line', sp: 'none', text: '灯柱上刻着一道道横杠。我数了数。' },
    { t: 'line', sp: 'ftz', text: '（十四道。有人在这里等过。等了十四次。）' },
  ],

  talkEmmaStation: [
    { t: 'line', sp: 'emma', text: '来时的路您还记得吗？' },
    { t: 'line', sp: 'ftz', text: '记得。' },
    { t: 'line', sp: 'emma', text: '那就好。' },
    { t: 'line', sp: 'none', text: '她提着马灯往前走。她没有问的是别的事。' },
    { t: 'line', sp: 'none', text: '雾在两个人之间合拢，又从两侧散开。' },
    { t: 'line', sp: 'ftz', text: '（她问的是路。可她问的时候，看的是别的地方。）' },
    { t: 'line', sp: 'ftz', text: '（这件事我很久以后才想明白。她问的不是路。）' },
    { t: 'line', sp: 'none', text: '马灯的光在雾里画出一个圆。圆之外全是白的。' },
    { t: 'line', sp: 'ftz', text: '（圆的直径是四步。这个数我算得出来。）' },
  ],

  // ================= 序章 · 山路 =================

  arriveRoad: [
    { t: 'line', sp: 'none', text: '雾很浓。马灯的光只能照亮前方三五步的距离，更远的地方全是灰白色的虚空。' },
    { t: 'line', sp: 'none', text: '森林在雾气中发出各种声音——树枝折断的脆响、落叶被踩碎的沙沙声、某种鸟的凄厉鸣叫。' },
    { t: 'line', sp: 'ftz', text: '（三个小时的山路。我的鞋底只有一层皮革。）' },
    { t: 'line', sp: 'ftz', text: '（我量过。）' },
    { t: 'line', sp: 'none', text: '路面是碎石和夯土。坡度一直在往上，平均每十步抬高半格。' },
    { t: 'line', sp: 'ftz', text: '（一千八百步。三个小时。这是一条修过的路。）' },
    { t: 'line', sp: 'ftz', text: '（修路的人是按时间修的，不是按距离。他知道有人要走多久。）' },
    { t: 'line', sp: 'none', text: '雾里有一盏灯在动。不是艾玛的马灯——那盏灯在更高的地方。' },
    { t: 'line', sp: 'ftz', text: '（山脊上。有人在等。）' },
    { t: 'line', sp: 'ftz', text: '（也可能只是雾。雾也会亮。）' },
    { t: 'do', do: [{ toast: '沿山路向右走。路上有三处可以停下来。' }] },
  ],

  roadStop1: [
    { t: 'line', sp: 'none', text: '我停下脚步。脚底的水泡破了。' },
    { t: 'line', sp: 'none', text: '血水浸透了袜子，黏在皮鞋里，每一步都像踩在刀刃上。' },
    { t: 'line', sp: 'ftz', text: '（喊累没有任何用处。活干不完，工头不会让你走。）' },
    { t: 'line', sp: 'none', text: '我把鞋脱下来，把袜子拧干，又穿回去。用了四分钟。' },
    { t: 'line', sp: 'ftz', text: '（四分钟。船台上换一块板要两个钟头。这个便宜。）' },
    { t: 'do', do: [{ conviction: -2, flag: ['roadBlisters', true] }] },
  ],

  roadStop2: [
    { t: 'line', sp: 'none', text: '森林深处，有什么东西动了一下。' },
    { t: 'line', sp: 'none', text: '不是鸟，也不是风。' },
    { t: 'line', sp: 'ftz', text: '（雾里有一个人形。又不像人形。）' },
    { t: 'line', sp: 'none', text: '那个轮廓很高。比门框高。肩膀是斜的。' },
    { t: 'line', sp: 'ftz', text: '（它站着没有动。是我在动。）' },
    { t: 'line', sp: 'none', text: '我眨了一下眼。那里什么都没有了。' },
    { t: 'line', sp: 'ftzCold', text: '（鸟叫停了。整片森林都停了。）' },
    { t: 'line', sp: 'none', text: '我往前走。脚步比刚才快了一点点。只快了一点点。' },
    { t: 'do', do: [{ conviction: -3 }, { shake: 8 }, { sound: 'sting' }] },
  ],

  roadStop3: [
    { t: 'line', sp: 'ftz', text: '（如果我没有接那封信。）' },
    { t: 'line', sp: 'ftz', text: '（如果我在法兰克福下了车。）' },
    { t: 'line', sp: 'none', text: '我没有停下。' },
    { t: 'line', sp: 'ftz', text: '（列车没有在法兰克福停。它一路开到这里。）' },
    { t: 'line', sp: 'none', text: '前面的雾里，艾玛的马灯停在一棵倒下的树旁边，等我。' },
    { t: 'line', sp: 'ftz', text: '（她从来不催。她只是等。）' },
  ],

  // ================= 序章 · 正门 =================

  arriveGate: [
    { t: 'line', sp: 'none', text: '雾气渐渐稀薄了。月光从云层的缝隙里漏下来，照亮了前方的路。' },
    { t: 'line', sp: 'none', text: '山路在森林中蜿蜒而上，尽头是一座山脊。山脊之上，有一个巨大的、黑色的轮廓。' },
    { t: 'line', sp: 'none', text: '聚斯霍芬堡。' },
    { t: 'line', sp: 'none', text: '哥特式的尖顶刺向天空，像一排排肋骨从大地里长出来。' },
    { t: 'line', sp: 'none', text: '铁十字黑秃鹫的旗帜从最高的塔楼上垂下来，在夜风中微微飘动。' },
    { t: 'line', sp: 'ftz', text: '（它不是人类建造的——不，它是人类建造的。但建造它的人，一定已经不把自己当人了。）' },
    { t: 'line', sp: 'none', text: '我站在山脊上，没有往前走。' },
    { t: 'line', sp: 'ftz', text: '（正面四十六格宽。两侧各有一个塔楼，左边的比右边高两格。）' },
    { t: 'line', sp: 'ftz', text: '（不对称。一栋房子可以不漂亮，但不该不对称。）' },
    { t: 'line', sp: 'ftz', text: '（除非有一边本来打算再长高。）' },
    { t: 'do', do: [{ conviction: -2 }] },
  ],

  gateFlag: [
    { t: 'line', sp: 'none', text: '旗面很大，垂下来有三格长。铁十字在正中，秃鹫张开翅膀，压在十字上面。' },
    { t: 'line', sp: 'ftz', text: '（风从峡谷那边来。旗鼓着，可旗布不响。）' },
    { t: 'line', sp: 'ftz', text: '（布不响。或者风声被别的东西盖住了。）' },
    { t: 'line', sp: 'none', text: '旗杆底座上刻着年份：主后XX年。' },
    { t: 'line', sp: 'ftz', text: '（和那枚胸针背面的年份一样。）' },
    { t: 'line', sp: 'ftz', text: '（秃鹫的爪子里抓着一件东西。看不清是蛇，还是绳子。）' },
    { t: 'line', sp: 'none', text: '我仰头看了很久。旗一直朝同一个方向飘，没有变过。' },
    { t: 'line', sp: 'ftz', text: '（三个小时的山路，风一直从背后吹我。）' },
    { t: 'line', sp: 'ftz', text: '（如果我转过身，它会吹我的脸。）' },
    { t: 'do', do: [{ flag: ['sawFlag', true] }] },
  ],

  talkEmmaGate: [
    { t: 'line', sp: 'ftz', text: '艾玛。' },
    { t: 'line', sp: 'emma', text: '嗯。' },
    { t: 'line', sp: 'ftz', text: '你说我母亲临终前说了一句话。她说了什么？' },
    { t: 'line', sp: 'none', text: '艾玛停下脚步。她没有回头，只是举着灯。' },
    { t: 'line', sp: 'emma', text: '她说，她不曾后悔。' },
    { t: 'line', sp: 'ftz', text: '什么意思？' },
    { t: 'line', sp: 'emma', text: '您会知道的。' },
    { t: 'line', sp: 'none', text: '灯芯忽然跳了一下。她用手掌挡住了风。' },
    { t: 'line', sp: 'none', text: '她说这句话的时候，语气和报一个时辰一样。' },
    { t: 'line', sp: 'ftz', text: '（她没有说她不后悔什么。她只说不曾后悔。）' },
    { t: 'line', sp: 'ftz', text: '（这不是回答。这是一个句子，被剪掉了后半截。）' },
    { t: 'do', do: [{ conviction: 3, flag: ['heardLastWords', true] }] },
  ],

  knockGate: [
    { t: 'line', sp: 'none', text: '橡木大门包着铁皮，钉满拳头大的铁钉。铜环铸成秃鹫头，喙部衔着圆环。' },
    { t: 'line', sp: 'none', text: '艾玛拉环，敲了三下。' },
    { t: 'line', sp: 'none', text: '声音沉闷而悠长，像一声叹息。' },
    { t: 'line', sp: 'none', text: '门开了。' },
    { t: 'line', sp: 'ftz', text: '（门开得太快了。敲门声还没有走完。）' },
    { t: 'line', sp: 'ftz', text: '（门轴没有响。这么大的门，门轴应该会响。）' },
    { t: 'do', do: [{ flag: ['gateOpen', true] }, { sound: 'door' }, { toast: '门开了。' }] },
  ],

  gateAlreadyOpen: [
    { t: 'line', sp: 'none', text: '门开着。门缝里透出一线暖光。' },
    { t: 'line', sp: 'ftz', text: '（暖光。可从门缝里透出来的风是冷的。）' },
    { t: 'line', sp: 'none', text: '我把手放在门上。门自己往里退了一寸。' },
  ],

  // ================= 序章 · 门厅 =================

  arriveHall: [
    { t: 'line', sp: 'none', text: '门后的大厅是整个古堡最宏伟、也最阴森的地方。' },
    { t: 'line', sp: 'none', text: '挑高的拱顶。肋架从四面升起，在中央汇成复杂的星形图案。' },
    { t: 'line', sp: 'none', text: '墙上挂满巨幅油画。两排烛台亮着，火苗一动不动。' },
    { t: 'line', sp: 'none', text: '尽头是巨大的壁炉。火光把那些画中人的眼睛映得活了过来。' },
    { t: 'line', sp: 'ftz', text: '（大厅长二十六格，宽十二格。拱顶最高处离地九格。）' },
    { t: 'line', sp: 'ftz', text: '（九格。石头的拱，九格高，跨十二格。这个跨度不该撑得住。）' },
    { t: 'line', sp: 'hermann', text: '弗里德里希少爷。您终于来了。' },
    { t: 'line', sp: 'ftz', text: '（他从哪里走过来的？我没有听见脚步声。）' },
    { t: 'line', sp: 'hermann', text: '我是赫尔曼，聚斯霍芬堡的管家。' },
    { t: 'line', sp: 'hermann', text: '从今天起，这座古堡和它所承载的一切，都属于您。' },
    { t: 'line', sp: 'none', text: '老人鞠躬。那个动作优雅得不像一个老人，倒像是一个排练了千百遍的宫廷舞者。' },
    { t: 'line', sp: 'ftz', text: '（他说都属于您。他没有说请您享用，也没有说请您保管。）' },
    { t: 'line', sp: 'ftz', text: '（属于是一个很干净的词。）' },
    { t: 'line', sp: 'ftz', text: '（门在我身后关上了。我没有听见关门的声音。）' },
    { t: 'do', do: [{ flag: ['metHermann', true] }, { toast: '调查画像、壁炉与拱肋。按 Tab 看图纸。' }] },
  ],

  hallAncestors: [
    { t: 'line', sp: 'none', text: '门厅两侧各挂着六幅画像。加上壁炉上方那一幅，一共十三幅。' },
    { t: 'line', sp: 'ftz', text: '（十三。吊灯十三盏，台阶十三级。这里的人喜欢十三。）' },
    { t: 'line', sp: 'none', text: '最左边一幅是一个穿中世纪商人长袍的男人，手里握着一根像甘蔗的权杖。' },
    { t: 'line', sp: 'none', text: '克劳斯的手画得很细。指甲缝里有一圈白。' },
    { t: 'line', sp: 'ftz', text: '（糖粉。画师连这个都画了。）' },
    { t: 'line', sp: 'ftz', text: '（杖头是一块白色的方糖。他把糖举在手上，像别人举十字架。）' },
    { t: 'line', sp: 'none', text: '画框下面钉着一块铜牌，刻着名字和年份。' },
    { t: 'line', sp: 'ftz', text: '（克劳斯·冯·祖克霍夫。主后XX年。）' },
    { t: 'line', sp: 'ftz', text: '（他是第一个。这个姓氏是他自己挑的。）' },
    { t: 'line', sp: 'ftz', text: '（十三张脸，相貌不一样，可看起来像同一个人。）' },
    { t: 'line', sp: 'none', text: '铜牌上的字我一个个读过去。读到第七块，停了。' },
    { t: 'line', sp: 'ftz', text: '（第七块上没有年份。铜牌是空的。）' },
    { t: 'line', sp: 'ftz', text: '（他们的眼睛都朝着一个方向。不是看我，是看壁炉。）' },
    { t: 'do', do: [{ flag: ['sawAncestors', true] }] },
  ],

  lookVictoria: [
    { t: 'line', sp: 'none', text: '壁炉上方最大的一幅画。' },
    { t: 'line', sp: 'none', text: '一个女人。红发。深蓝色的眼睛。苍白的、几乎透明的皮肤。' },
    { t: 'line', sp: 'none', text: '黑长裙。胸前别着一枚铁十字黑秃鹫的银胸针。手里握着一本合拢的书。' },
    { t: 'line', sp: 'ftz', text: '（红头发。和我一样。）' },
    { t: 'line', sp: 'ftz', text: '（书脊上的烫金字母。我从来没有学过那行文字。）' },
    { t: 'line', sp: 'ftz', text: '（但我就是能读懂。）' },
    { t: 'line', sp: 'ftz', text: '卡美洛。' },
    { t: 'line', sp: 'none', text: '我往后退了一步。画框上的金漆有一块剥落了。' },
    { t: 'line', sp: 'none', text: '画布上有一层薄薄的黄。是清漆，也是时间。' },
    { t: 'line', sp: 'ftz', text: '（画这幅画的人，把她的左手画在裙子外面。右手藏在裙子里面。）' },
    { t: 'line', sp: 'ftz', text: '（一只手上没有戒指。另一只手看不见。）' },
    { t: 'line', sp: 'ftz', text: '（她像是在笑。嘴角的弧度只有一点点。）' },
    { t: 'line', sp: 'ftz', text: '（也可能本来就画成那样。看久了，什么都会动。）' },
    { t: 'line', sp: 'none', text: '画框的右下角有一个很小的签名，被金漆盖住了。' },
    { t: 'line', sp: 'ftz', text: '（看不清。画师不想让人知道名字。）' },
    { t: 'do', do: [{ conviction: -4 }, { flag: ['sawVictoria', true] }] },
  ],

  lightCandle: [
    { t: 'line', sp: 'none', text: '一支落地烛台。铜座上的蜡已经换过很多次了。' },
    { t: 'line', sp: 'ftz', text: '（有人在维护。每天。）' },
    { t: 'line', sp: 'none', text: '烛泪顺着铜座流下来，一层压着一层，像树的年轮。' },
    { t: 'line', sp: 'ftz', text: '（十七层。十七天。）' },
    { t: 'line', sp: 'ftz', text: '（今天早上刚换过。也就是说，他知道我今天到。）' },
  ],

  talkHermannHall: [
    { t: 'line', sp: 'ftz', text: '那是谁？' },
    { t: 'line', sp: 'hermann', text: '那是您的曾祖母，维多利亚·冯·祖克霍夫。来自卡美洛的公主。' },
    { t: 'line', sp: 'ftz', text: '来自卡美洛？' },
    { t: 'line', sp: 'hermann', text: '是的，少爷。' },
    { t: 'line', sp: 'ftz', text: '卡美洛的公主，为什么会嫁给一个糖贩子的后代？' },
    { t: 'line', sp: 'none', text: '赫尔曼沉默了一会儿。壁炉里的柴火爆开一个火星。' },
    { t: 'line', sp: 'hermann', text: '您想知道的一切，都在古堡里。' },
    { t: 'line', sp: 'hermann', text: '在那些您从未见过的房间里，在那些您从未读过的书里。' },
    { t: 'line', sp: 'ftz', text: '我问的不是古堡。我问的是她。' },
    { t: 'line', sp: 'none', text: '赫尔曼微微低了一下头，像是在为一件不属于他的事道歉。' },
    { t: 'line', sp: 'hermann', text: '您有足够的时间，少爷。您有一辈子的时间。' },
    { t: 'line', sp: 'ftz', text: '（他说一辈子。语气像在说一个下午。）' },
    { t: 'line', sp: 'ftz', text: '（我没有再问。他把话头收起来的样子，像收起一把餐刀。）' },
    { t: 'do', do: [{ flag: ['hHermannPromise', true] }, { conviction: -2 }] },
  ],

  archNeedBlueprint: [
    { t: 'line', sp: 'none', text: '门厅中央的拱肋。' },
    { t: 'line', sp: 'ftz', text: '（这一段的承重线……画不出来。）' },
    { t: 'line', sp: 'none', text: '我眯起眼睛。有什么东西在我的视野里折叠了一下。' },
    { t: 'line', sp: 'ftz', text: '（需要图纸。按 Tab。）' },
    { t: 'line', sp: 'ftz', text: '（图纸不是眼睛。图纸是尺子。）' },
    { t: 'do', do: [{ toast: '按 Tab 打开图纸，再调查这里' }] },
  ],

  archRepairStart: [
    { t: 'line', sp: 'none', text: '图纸展开了。' },
    { t: 'line', sp: 'none', text: '门厅的拱肋在中轴处断开两格——不是坏了，是画的时候就没有连上。' },
    { t: 'line', sp: 'ftz', text: '（补上它。）' },
    { t: 'line', sp: 'ftz', text: '（两格。一格半米。这不是修补，这是校对。）' },
    { t: 'do', do: [{ next: 'archRepairRun' }] },
  ],

  archRepairRun: [
    { t: 'line', sp: 'none', text: '（按压方向键沿着虚线把线接上。）' },
    { t: 'line', sp: 'ftz', text: '（笔要稳。落笔之前先看清落点。）' },
    { t: 'do', do: [{ toast: '按方向键连线，E 落笔，Esc 放弃' }, { flag: ['archRepairActive', true] }] },
  ],

  archDone: [
    { t: 'line', sp: 'none', text: '拱肋上的线已经补好了。' },
    { t: 'line', sp: 'ftz', text: '（两侧的烛台亮了。原来它们一直是好的。）' },
    { t: 'line', sp: 'none', text: '大厅亮了一倍。画像里的脸也跟着亮了一倍。' },
    { t: 'line', sp: 'ftz', text: '（补一条线，点亮十三盏灯。图纸上写着这件事，只是没有人去读。）' },
  ],

  // ================= 序章 · 走廊与卧室 =================

  arriveCorridorE: [
    { t: 'line', sp: 'none', text: '东翼走廊很长，很暗，很深。' },
    { t: 'line', sp: 'none', text: '每隔几米就是一幅祖克霍夫历代成员的油画。面孔瘦削，苍白，眼睛很深。' },
    { t: 'line', sp: 'ftz', text: '（每一条走廊看起来都一样。每一幅画像都似曾相识。）' },
    { t: 'line', sp: 'none', text: '走廊尽头有一扇窗。窗外的月亮被云挡住了一半。' },
    { t: 'line', sp: 'ftz', text: '（走廊宽三格。两侧墙厚一格。可这里的地板比门厅高两格。）' },
    { t: 'line', sp: 'ftz', text: '（九级台阶，每级半格。加起来是四点五格。可地板只高了两格。）' },
    { t: 'line', sp: 'none', text: '烛台之间的距离是七步。我数了两遍。' },
    { t: 'do', do: [{ toast: '按 Tab 分辨哪条走廊是真的' }] },
  ],

  lookPainting: [
    { t: 'line', sp: 'none', text: '一幅祖克霍夫的肖像。' },
    { t: 'line', sp: 'none', text: '瘦削，苍白，眼睛很深，像是一直在看着什么东西。' },
    { t: 'line', sp: 'ftz', text: '（他们都在看同一个方向。）' },
    { t: 'line', sp: 'none', text: '画框上的铜牌被擦得发亮，字反而看不太清。' },
    { t: 'line', sp: 'ftz', text: '（生年XX，卒年XX。中间有二十年是空的。）' },
    { t: 'line', sp: 'ftz', text: '（二十年的空白。画里的人一直停在这二十年里面。）' },
  ],

  nightCorridorLoop: [
    { t: 'line', sp: 'none', text: '我走了一段。又走了一段。' },
    { t: 'line', sp: 'none', text: '墙上的画像还是那四幅。第一幅的右下角有一道裂痕，形状像一道闪电。' },
    { t: 'line', sp: 'ftz', text: '（这道裂痕我刚才看见过。）' },
    { t: 'line', sp: 'ftz', text: '（十二步。从这幅画到下一幅，十二步。）' },
    { t: 'line', sp: 'ftz', text: '（第一遍是十二步，第二遍也是十二步。）' },
    { t: 'line', sp: 'ftz', text: '（两条走廊一样长，一样宽，一样四幅画。这不可能。）' },
    { t: 'line', sp: 'none', text: '伸手推了推墙上的一扇门。门是画上去的。' },
    { t: 'line', sp: 'none', text: '打开它，后面是砖。' },
    { t: 'line', sp: 'none', text: '手按在墙上。墙是实的。墙里的砖是冷的。' },
    { t: 'line', sp: 'ftz', text: '（画上去的门，后面是砖。也就是说，有人先画了门，再砌了墙。）' },
    { t: 'line', sp: 'ftzCold', text: '（不。是有人先砌了墙，再画上门。）' },
    { t: 'line', sp: 'ftz', text: '（这两个说法，只有一个能说明我为什么在这里。）' },
    { t: 'line', sp: 'ftz', text: '（图纸会告诉我哪条是假的。可我更想知道，是谁先画的。）' },
    { t: 'do', do: [{ conviction: -3, flag: ['corridorLoopSeen', true] }, { toast: '按 Tab 打开图纸，分辨两条走廊' }] },
  ],

  lookWilliam: [
    { t: 'line', sp: 'none', text: '一个穿黑色军服的男人。胸前挂满勋章，腰间佩长剑。' },
    { t: 'line', sp: 'none', text: '深棕色的头发，浅灰色的眼睛，方下巴。' },
    { t: 'line', sp: 'none', text: '一道伤疤从左边的眉骨一直延伸到右边的颧骨，斜着划过整个面孔，像一道闪电。' },
    { t: 'line', sp: 'ftz', text: '（我突然觉得疼。）' },
    { t: 'line', sp: 'ftz', text: '（不是脸上的疼。是某种更深处的、更古老的、不属于我的疼。）' },
    { t: 'line', sp: 'none', text: '我往后退，撞到了墙。墙是冷的。' },
    { t: 'line', sp: 'none', text: '画中人的手按在剑柄上。右手的食指上有一枚印章戒指。' },
    { t: 'line', sp: 'ftz', text: '（十九幅画里，只有这一双手是画出来的。）' },
    { t: 'line', sp: 'ftz', text: '（他看着我。不是看画外。是看着我。）' },
    { t: 'line', sp: 'none', text: '我抬手摸了摸眉梢。那道旧疤还在。' },
    { t: 'line', sp: 'ftz', text: '（一样的走向。短了半指。）' },
    { t: 'do', do: [{ conviction: -3, flag: ['sawWilliam', true] }] },
  ],

  talkHermannNight: [
    { t: 'line', sp: 'hermann', text: '您也注意到了那道伤疤？' },
    { t: 'line', sp: 'none', text: '赫尔曼端着油灯，站在几步之外。' },
    { t: 'line', sp: 'none', text: '他的脸色比白天更苍白了，眼窝更深了，瞳孔更大了。' },
    { t: 'line', sp: 'none', text: '他身上的气味……不是陈木和灰尘。是机油，还有别的什么，更刺鼻，更陌生。' },
    { t: 'line', sp: 'hermann', text: '我送您回房间，少爷。这条路确实不太好认，尤其是晚上。' },
    { t: 'line', sp: 'ftz', text: '我刚才走错了。同一段走廊，我走了两次。' },
    { t: 'line', sp: 'none', text: '赫尔曼把油灯换了只手。灯芯晃了一下，他的影子没有跟着晃。' },
    { t: 'line', sp: 'hermann', text: '走廊是老的。老了的东西都会绕。' },
    { t: 'line', sp: 'ftz', text: '（这不是回答。这是把问题放进柜子，然后关上柜门。）' },
    { t: 'line', sp: 'ftz', text: '（我没有问他为什么在这里。因为他不会给我真正的答案。）' },
    { t: 'do', do: [{ flag: ['hermannSawNight', true] }, { conviction: -2 }] },
  ],

  enterBedroom: [
    { t: 'line', sp: 'none', text: '门是橡木的。门板上没有锁孔。' },
    { t: 'line', sp: 'ftz', text: '（没有锁孔。主人不需要从外面进来。）' },
    { t: 'line', sp: 'none', text: '我推门进去。屋里有一股淡淡的薰衣草味。' },
    { t: 'line', sp: 'none', text: '桌上的一盏灯，已经点着了。' },
    { t: 'do', do: [{ next: 'arriveBedroom' }] },
  ],

  arriveBedroom: [
    { t: 'line', sp: 'none', text: '卧室比我想象的要小。比我想象的要旧。但比我想象的要温暖。' },
    { t: 'line', sp: 'none', text: '深红色的壁纸，暗金的花纹，在烛光中像一层褪了色的血。' },
    { t: 'line', sp: 'none', text: '靠墙整整一面墙，全是书架。' },
    { t: 'line', sp: 'ftz', text: '（四排，每排七格。二十八格。）' },
    { t: 'line', sp: 'none', text: '书架最上层放着一把铜脚量尺，落满了灰。' },
    { t: 'line', sp: 'ftz', text: '（量尺。这间屋子以前住过一个会量东西的人。）' },
    { t: 'line', sp: 'ftz', text: '（也可能只是忘了带走。）' },
    { t: 'do', do: [{ toast: '可以调查书架、书桌、床和镜子。' }] },
  ],

  bedroomArrive: [
    { t: 'line', sp: 'none', text: '我关上门。门缝里没有透出灯光。' },
    { t: 'line', sp: 'none', text: '桌上那本《祖克霍夫家族编年史》摊开着，停在一页上。' },
    { t: 'line', sp: 'ftz', text: '（我走的时候，它是合着的。）' },
    { t: 'line', sp: 'none', text: '我翻了翻前面的书页。纸是干的，没有一点潮气。' },
    { t: 'line', sp: 'ftz', text: '（这间屋子在山上。山上的纸会潮。）' },
    { t: 'do', do: [{ conviction: -3 }, { flag: ['bookOpened', true] }] },
  ],

  bedroomCeiling: [
    { t: 'line', sp: 'none', text: '天花板是木头的。四条肋架在正中交叉，交叉的地方钉着一块圆形的木头。' },
    { t: 'line', sp: 'ftz', text: '（星形。八条线。不是装饰。）' },
    { t: 'line', sp: 'ftz', text: '（这是受力点。四条肋架把屋顶的重量收到这一个圆心上。）' },
    { t: 'line', sp: 'ftz', text: '（门厅的拱顶也是这样收的。只是大四倍。）' },
    { t: 'line', sp: 'ftz', text: '（有人建这栋房子的时候，先画了线，再砌石头。和我画船一样。）' },
    { t: 'line', sp: 'none', text: '我数了数肋架上的钉子。每一根肋材上六颗。' },
    { t: 'line', sp: 'none', text: '烛火晃了一下。影子在天花板上动了，可肋架没有动。' },
    { t: 'line', sp: 'ftz', text: '（我数错了。或者它动了。）' },
    { t: 'line', sp: 'none', text: '圆木的中央有一个孔，孔里塞着一团布。' },
    { t: 'line', sp: 'ftz', text: '（塞布是为了堵缝。可这个孔不通风。）' },
    { t: 'do', do: [{ flag: ['sawCeiling', true] }] },
  ],

  lookBed: [
    { t: 'line', sp: 'none', text: '铁架床。白亚麻床单。被褥厚实而柔软，带着薰衣草的气味。' },
    { t: 'line', sp: 'ftz', text: '（我睡不着。）' },
    { t: 'line', sp: 'none', text: '床头挂着一幅小小的铜版画：一艘三桅船，在浪里斜着走。' },
    { t: 'line', sp: 'ftz', text: '（干舷太低。这个画法，船一出港就会进水。）' },
    { t: 'line', sp: 'ftz', text: '（画这幅画的人没有上过船。）' },
    { t: 'choice', opts: [
      { text: '躺下（结束这一夜）', next: 'endPrologue' },
      { text: '再走走', do: [] },
    ] },
  ],

  readChronicle: [
    { t: 'line', sp: 'none', text: '书桌上摊着一本很厚的书：《祖克霍夫家族编年史》。' },
    { t: 'line', sp: 'none', text: '「祖克霍夫。在高哥特语中意为『糖庄』。糖果的庄园。甜味的庄园。」' },
    { t: 'line', sp: 'none', text: '「这个家族的历史，和白糖的历史密不可分。」' },
    { t: 'line', sp: 'ftz', text: '（糖。我以为它只是糖。）' },
    { t: 'line', sp: 'none', text: '书页的边角有一行铅笔小字，写得很轻。' },
    { t: 'line', sp: 'none', text: '「读到这一页的人，请往下读。」' },
    { t: 'line', sp: 'ftz', text: '（铅笔字是新的。石墨还没有被纸吃掉。）' },
    { t: 'line', sp: 'none', text: '书的纸边是毛的。这本书不是买来的，是自己装订的。' },
    { t: 'line', sp: 'ftz', text: '（家族的账，自己装。）' },
    { t: 'do', do: [{ flag: ['readChroniclePrologue', true] }] },
  ],

  lookShelf: [
    { t: 'line', sp: 'none', text: '书架上有高哥特语的账簿，拉丁语的族谱，还有几本字母根本认不出来的书。' },
    { t: 'line', sp: 'ftz', text: '（这些字迹的墨，都不一样。）' },
    { t: 'line', sp: 'ftz', text: '（账簿的墨发褐。族谱的墨发蓝。第三种书的墨发青。）' },
    { t: 'line', sp: 'none', text: '我抽出一本。书脊上有一道用刀片划开的裂口。' },
    { t: 'line', sp: 'ftz', text: '（书名被人刮掉了。刮得很干净，只留下毛边。）' },
    { t: 'line', sp: 'ftz', text: '（这间屋子里有人不想让某本书被找到。可他没有把书拿走。）' },
  ],

  lookMirror: [
    { t: 'line', sp: 'none', text: '一面穿衣镜。镜面有点雾。' },
    { t: 'line', sp: 'ftz', text: '（红头发。蓝色眼睛。因为疲惫和饥饿而微微凹陷的脸颊。）' },
    { t: 'line', sp: 'ftz', text: '（这是我。至少今天还是。）' },
    { t: 'line', sp: 'none', text: '镜框的右下角刻着一行小字。我弯腰去看。' },
    { t: 'line', sp: 'ftz', text: '（不要看太久。）' },
    { t: 'line', sp: 'ftz', text: '（字刻得很深。刻字的人用了很大的力气。）' },
    { t: 'line', sp: 'none', text: '我直起身。镜子里的我，比我慢了半拍。' },
    { t: 'line', sp: 'ftz', text: '（镜子里没有雾。有雾的是我的这一边。）' },
  ],

  endPrologue: [
    { t: 'line', sp: 'none', text: '我躺下。天花板上的拱形肋架在中央汇成一个星形图案。' },
    { t: 'line', sp: 'ftz', text: '（和楼下大厅的拱顶一模一样，只是小了很多。）' },
    { t: 'line', sp: 'none', text: '月光在窗帘的缝隙里，在天花板上画出一条细细的白线。' },
    { t: 'line', sp: 'none', text: '远处有钟声。不是教堂的钟，是更沉、更慢的东西。' },
    { t: 'line', sp: 'ftz', text: '（十一下。这座城堡里没有钟楼。）' },
    { t: 'line', sp: 'none', text: '第十一下之后，还有一声。很轻。像是有人用手按住了钟。' },
    { t: 'line', sp: 'ftz', text: '（十二下。可我数的时候，只到十一。）' },
    { t: 'line', sp: 'none', text: '我吹灭了灯。' },
    { t: 'line', sp: 'none', text: '黑暗里，天花板上的星形图案还在。像印在眼皮内侧。' },
    { t: 'do', do: [
      { shake: 6 },
      { sound: 'bell' },
    ] },
  ],

  // ================= 第一章 · 餐厅 =================

  arriveDining: [
    { t: 'line', sp: 'none', text: '我被鸟叫吵醒。不是乌鸦，不是渡鸦。是麻雀。' },
    { t: 'line', sp: 'none', text: '早餐摆在长桌上。面包、黄油、煎蛋、香肠、一壶黑咖啡。' },
    { t: 'line', sp: 'ftz', text: '（五样。一个人吃不完。）' },
    { t: 'line', sp: 'ftz', text: '（面包是热的。热气从布巾的缝里冒出来。）' },
    { t: 'line', sp: 'none', text: '桌边只摆了一副餐具。银勺擦得很亮，亮得能照见天花板。' },
    { t: 'line', sp: 'marta', text: '少爷！' },
    { t: 'line', sp: 'none', text: '一个胖胖的中年女人从厨房探出头来，脸红得像一只被夸奖的母鸡。' },
    { t: 'line', sp: 'marta', text: '我是玛尔塔，厨房管事。您叫我玛尔塔就好。' },
    { t: 'line', sp: 'marta', text: '面包是今天早上烤的，黄油是多特蒙德来的。' },
    { t: 'line', sp: 'marta', text: '香肠是我自己灌的。灌香肠的肠衣要泡三遍水，少一遍就腥。' },
    { t: 'line', sp: 'marta', text: '我可以做您喜欢的任何东西——任何东西，只要您开口。' },
    { t: 'line', sp: 'none', text: '她把两只手在围裙上擦了擦，又擦了擦。' },
    { t: 'line', sp: 'ftz', text: '（她在紧张。厨房管事不该在自己的厨房里紧张。）' },
    { t: 'line', sp: 'ftz', text: '（她在等我说话。等我说的，不是谢谢。）' },
    { t: 'choice', opts: [
      { text: '面包', do: [{ flag: ['likeBread', true] }], next: 'diningAfterOrder' },
      { text: '香肠', do: [{ flag: ['likeSausage', true] }], next: 'diningAfterOrder' },
      { text: '汤', do: [{ flag: ['likeSoup', true] }], next: 'diningAfterOrder' },
      { text: '不必麻烦', do: [{ flag: ['likeNothing', true] }], next: 'diningAfterOrder' },
    ] },
  ],

  diningSilver: [
    { t: 'line', sp: 'none', text: '银器擦得很亮。刀、叉、勺，按顺序摆成三组。' },
    { t: 'line', sp: 'ftz', text: '（三组。一顿早餐，三把刀。）' },
    { t: 'line', sp: 'none', text: '桌布上绣着纹章：三根甘蔗，交叉成束，下面一行高哥特语。' },
    { t: 'line', sp: 'ftz', text: '（三根甘蔗。不是剑，不是狮鹫。是甘蔗。）' },
    { t: 'line', sp: 'ftz', text: '（绣线的针脚很密。一格里有十一针。）' },
    { t: 'line', sp: 'ftz', text: '（绣这个的人，手上一定很稳。）' },
    { t: 'line', sp: 'none', text: '我按住桌角。桌布下面不是木头。' },
    { t: 'line', sp: 'ftz', text: '（是石头。这张长桌是从地面上砌起来的。）' },
    { t: 'line', sp: 'none', text: '刀柄的末端刻着两个字母：V.S.。' },
    { t: 'line', sp: 'ftz', text: '（不是祖克霍夫。祖克霍夫是 Z。）' },
    { t: 'line', sp: 'ftz', text: '（这两个字母，祖克霍夫家一个都用不上。）' },
    { t: 'line', sp: 'ftz', text: '（刀口朝里。这是摆给客人看的方向。）' },
    { t: 'line', sp: 'none', text: '我把刀放下。刀和桌面接触，没有发出声音。' },
    { t: 'do', do: [{ flag: ['sawSilver', true] }] },
  ],

  diningAfterOrder: [
    { t: 'line', sp: 'marta', text: '好嘞！' },
    { t: 'line', sp: 'none', text: '她缩回厨房。厨房里传出锅盖碰撞的声音。' },
    { t: 'line', sp: 'marta', text: '汤要再等一刻钟——火不能大，大了汤就浑，少爷您别催我。' },
    { t: 'line', sp: 'ftz', text: '（一刻钟。三点七五格。我算过。）' },
    { t: 'line', sp: 'marta', text: '哎呀，盐罐子忘在柜子上了，我去拿。' },
    { t: 'do', do: [{ flag: ['metMarta', true] }, { toast: '可以跟玛尔塔、艾玛、赫尔曼说话，或去图书室。' }] },
  ],

  talkMarta: [
    { t: 'line', sp: 'marta', text: '少爷，您多吃点。您太瘦了。' },
    { t: 'line', sp: 'marta', text: '我在这儿做了很多年了。这厨房里的每一样东西我都知道放在哪儿。' },
    { t: 'line', sp: 'ftz', text: '很多年？' },
    { t: 'line', sp: 'marta', text: '很多年啦。' },
    { t: 'line', sp: 'marta', text: '胡椒在左边第三格，肉桂在第二格。最里面那一格锁着，钥匙在管家那儿。' },
    { t: 'line', sp: 'marta', text: '那把钥匙我从来没见他用过。' },
    { t: 'line', sp: 'ftz', text: '（她的脸，看起来才四十岁。）' },
    { t: 'line', sp: 'ftz', text: '（她说很多年的时候，没有停。可她的手停了。）' },
    { t: 'line', sp: 'marta', text: '少爷，您喜欢吃甜的吗？我还会做糖渍栗子，可惜这季节没有栗子。' },
    { t: 'line', sp: 'ftz', text: '甜？' },
    { t: 'line', sp: 'marta', text: '栗子要等秋天。秋天一到，我给您做，做一大碗——' },
    { t: 'line', sp: 'marta', text: '做多了也没关系，反正厨房里就我一个人吃。' },
    { t: 'line', sp: 'ftz', text: '（她说就我一个人。可这栋房子里有管家，有女仆。）' },
    { t: 'line', sp: 'marta', text: '甜的东西，厨房里从来不缺。糖罐就在您手边。' },
    { t: 'line', sp: 'none', text: '桌上果然有一只小糖罐，白瓷的，盖子没有盖严。' },
    { t: 'line', sp: 'ftz', text: '（糖罐里的糖是满的。没有人用过。）' },
    { t: 'do', do: [{ flag: ['martaManyYears', true] }] },
  ],

  talkEmmaDining: [
    { t: 'line', sp: 'emma', text: '用餐的时候不该多话。' },
    { t: 'line', sp: 'ftz', text: '我只是想问——' },
    { t: 'line', sp: 'ftz', text: '艾玛在这里很久了吗？' },
    { t: 'line', sp: 'emma', text: '很久了，少爷。' },
    { t: 'line', sp: 'ftz', text: '多久？' },
    { t: 'line', sp: 'emma', text: '比这张桌子久。' },
    { t: 'line', sp: 'ftz', text: '（按她的面孔，最多二十五岁。而赫尔曼说她在我母亲小时候就在。）' },
    { t: 'line', sp: 'none', text: '她把一盘煎蛋推到我面前，推得很轻，盘底没有发出声音。' },
    { t: 'line', sp: 'ftz', text: '你多大？' },
    { t: 'line', sp: 'emma', text: '少爷不该问这个。' },
    { t: 'line', sp: 'ftz', text: '（她没有生气。她只是把这句话折好了，放回原处。）' },
    { t: 'do', do: [{ conviction: -4, flag: ['emmaAgeDoubt', true] }] },
  ],

  talkHermannDining: [
    { t: 'line', sp: 'hermann', text: '今天的早餐还合口味吗，少爷？' },
    { t: 'line', sp: 'ftz', text: '赫尔曼，你在这里多久了？' },
    { t: 'line', sp: 'hermann', text: '比您想象的要久，少爷。' },
    { t: 'line', sp: 'ftz', text: '那你知道我母亲的事吗？' },
    { t: 'line', sp: 'none', text: '赫尔曼把餐巾叠好，放在桌上。' },
    { t: 'line', sp: 'none', text: '他折了三下。第一下对齐，第二下压平，第三下收边。' },
    { t: 'line', sp: 'hermann', text: '您母亲……她是这座古堡里唯一一个让赫尔曼大人笑过的人。' },
    { t: 'line', sp: 'ftz', text: '（他说赫尔曼大人。）' },
    { t: 'line', sp: 'ftz', text: '（他为什么用别人的口气说他自己？）' },
    { t: 'line', sp: 'none', text: '赫尔曼没有停。他把咖啡壶提起来，给我添了半杯。' },
    { t: 'line', sp: 'hermann', text: '赫尔曼大人不常笑。' },
    { t: 'line', sp: 'ftz', text: '你刚才说赫尔曼大人。' },
    { t: 'line', sp: 'hermann', text: '是的，少爷。' },
    { t: 'line', sp: 'none', text: '他把壶放下。壶底和瓷盘接触，没有发出声音。' },
    { t: 'line', sp: 'none', text: '他把餐巾重新展开，又折了一遍。' },
    { t: 'line', sp: 'hermann', text: '您还要咖啡吗，少爷？' },
    { t: 'line', sp: 'ftz', text: '（他把问题还给了我。用一个提问。）' },
    { t: 'line', sp: 'ftz', text: '（这一桌上有两个人。可他说起自己的时候，像在说第三个人。）' },
    { t: 'line', sp: 'none', text: '咖啡很烫。赫尔曼的手离壶身只有一寸。' },
    { t: 'line', sp: 'ftz', text: '（一寸。这个距离会烫伤。他的手没有缩。）' },
    { t: 'do', do: [{ conviction: -3 }, { flag: ['hermannThirdPerson', true] }] },
  ],

  // ================= 第一章 · 图书室 =================

  arriveLibrary: [
    { t: 'line', sp: 'none', text: '图书室比卧室大得多。书架一直堆到天花板，用一道可以移动的木梯才能够到最高层。' },
    { t: 'line', sp: 'none', text: '房间中央摆着一张巨大的桌子，桌面上摊着一张地图。' },
    { t: 'line', sp: 'ftz', text: '（书架三十四排。木头是新的，可书是旧的。）' },
    { t: 'line', sp: 'ftz', text: '（新木头，旧书。有人先做柜子，再往里放书。）' },
    { t: 'line', sp: 'none', text: '屋子里的灰尘很少。纸的味道比灰尘重。' },
    { t: 'line', sp: 'ftz', text: '（扫得很干净。可书脊上的灰，比地上多。）' },
    { t: 'line', sp: 'emma', text: '您要找什么，少爷？' },
    { t: 'line', sp: 'ftz', text: '随便看看。' },
    { t: 'line', sp: 'none', text: '艾玛把木梯推到窗边，用手按了按梯脚，试它稳不稳。' },
    { t: 'line', sp: 'ftz', text: '（她试了两次。第三次才爬上去。）' },
    { t: 'line', sp: 'none', text: '木梯的踏板中间有一块被磨得发亮。' },
    { t: 'line', sp: 'ftz', text: '（站久了才会这样。有人在这架梯子上站过很多次。）' },
    { t: 'do', do: [{ toast: '可以调查书架、地图桌，跟艾玛说话。' }] },
  ],

  libraryShelfLangs: [
    { t: 'line', sp: 'none', text: '三种语言的书混在一排里。高哥特语的账簿，拉丁语的族谱，第三种连字母都认不出。' },
    { t: 'line', sp: 'ftz', text: '（三种语言。三种纸。三种墨。）' },
    { t: 'line', sp: 'ftz', text: '（账簿的纸最薄，拉丁文的纸最厚，第三种纸发青。）' },
    { t: 'line', sp: 'none', text: '我抽出一本。书脊上没有任何标记，只有一道用刀片划开的裂口。' },
    { t: 'line', sp: 'ftz', text: '（有人把书名刮掉了。刮得很干净，只留下毛边。）' },
    { t: 'line', sp: 'ftz', text: '（四开本。一手指厚。三百页上下。）' },
    { t: 'line', sp: 'none', text: '我翻开。里面全是手写的符号，一行连着一行，没有一个字。' },
    { t: 'line', sp: 'ftz', text: '（不是字。是线。每一页都在画同一样东西，画了三百页。）' },
    { t: 'line', sp: 'none', text: '我把书往光里倾了一点。那些线开始互相咬合。' },
    { t: 'line', sp: 'ftz', text: '（这些线有承重关系。上面一条压着下面一条。）' },
    { t: 'line', sp: 'emma', text: '那一本不该动，少爷。' },
    { t: 'line', sp: 'none', text: '她把书放回去了。放回原来的位置，一格里差半指。' },
    { t: 'line', sp: 'ftz', text: '（半指。她记得它原来在哪里。）' },
    { t: 'do', do: [{ flag: ['sawThirdTongue', true] }] },
  ],

  lookShelfLibrary: [
    { t: 'line', sp: 'none', text: '书架上什么都有：农书、账本、地质报告、神学论著、一本没有任何插图的诗集。' },
    { t: 'line', sp: 'ftz', text: '（这些书的排列没有规律。像是有人按自己的顺序放过一次，然后再没有人动过。）' },
    { t: 'line', sp: 'none', text: '我抽出那本诗集。书页是裁开的。' },
    { t: 'line', sp: 'ftz', text: '（裁开了。有人读过。）' },
    { t: 'line', sp: 'ftz', text: '（读到第三十七页，就停了。后面的页还连着。）' },
    { t: 'line', sp: 'none', text: '第三十七页上有一行被指甲划过的痕。' },
    { t: 'line', sp: 'ftz', text: '（从山上往下看，房子比人小。）' },
    { t: 'line', sp: 'ftz', text: '（这个人读到这一行，停下来了。为什么？）' },
    { t: 'line', sp: 'none', text: '我把书插回去，插到一半，又抽出来，翻到第一页。' },
    { t: 'line', sp: 'ftz', text: '（没有题献。没有名字。连一个印章都没有。）' },
  ],

  lookMapTable: [
    { t: 'line', sp: 'none', text: '一张很大的地图。东弗里斯兰群山，黑森林，多特蒙德行省。' },
    { t: 'line', sp: 'none', text: '有些地方用红墨水圈了出来，有些地方打了叉。' },
    { t: 'line', sp: 'ftz', text: '（这个比例不对。从这里到法兰克福，按图上的距离，只需走三天。）' },
    { t: 'line', sp: 'ftz', text: '（但实际上，我坐了两天火车。）' },
    { t: 'line', sp: 'none', text: '地图的右下角有一个很小的注记，被墨涂掉了。' },
    { t: 'line', sp: 'ftz', text: '（涂得很用力。纸都起毛了。）' },
    { t: 'line', sp: 'ftz', text: '（地图上还有一个红圈，圈在聚斯霍芬堡自己身上。）' },
    { t: 'line', sp: 'ftz', text: '（圈自己的房子。这是标记，不是路线。）' },
    { t: 'line', sp: 'none', text: '我把手指按在那个红圈上。纸是凉的，圈里比圈外更凉。' },
    { t: 'do', do: [{ conviction: -5, flag: ['mapWrong', true] }, { achievement: 'threeProofs' }] },
  ],

  // 全章最重的一段：甜 → 甜 → 甜 → 苦
  readChronicleLibrary: [
    { t: 'line', sp: 'none', text: '艾玛把那本书放在桌上。书很厚，落在桌面上没有声音。' },
    { t: 'line', sp: 'emma', text: '这是您要的。' },
    { t: 'line', sp: 'ftz', text: '《祖克霍夫家族编年史》。' },
    { t: 'line', sp: 'none', text: '我翻开。第一页是一张折了三折的族谱，第二页开始才是字。' },
    { t: 'line', sp: 'none', text: '「第一页。主后XX年，克劳斯·施密特在吕贝克开了一间糖作坊。」' },
    { t: 'line', sp: 'none', text: '「他把糖煮到极白，白得像雪。他说，糖要比任何人都洁白。」' },
    { t: 'line', sp: 'none', text: '「他给自己起了一个新姓氏。祖克霍夫。甜的庄园。」' },
    { t: 'line', sp: 'ftz', text: '（旧的姓是施密特。施密特，铁匠。）' },
    { t: 'line', sp: 'ftz', text: '（和我一样。）' },
    { t: 'line', sp: 'none', text: '我往下翻。' },
    { t: 'line', sp: 'none', text: '「第二页。糖的生意比盐好做。盐会咸，糖只会甜。」' },
    { t: 'line', sp: 'none', text: '「战争来了又走。糖价涨了三倍，又落回原处。」' },
    { t: 'line', sp: 'none', text: '「仓库里的糖袋堆到屋檐。老鼠吃了糖，死在糖袋上。」' },
    { t: 'line', sp: 'none', text: '「旧贵族叫他们糖贩子。」' },
    { t: 'line', sp: 'ftz', text: '（糖贩子。和红毛怪一样。）' },
    { t: 'line', sp: 'ftz', text: '（都是别人用来提醒你，你不属于这里的方式。）' },
    { t: 'line', sp: 'none', text: '我翻到第三页。' },
    { t: 'line', sp: 'none', text: '「第三页。招工。包吃住，工钱按日结。来的人排到门外，排了一整条街。」' },
    { t: 'line', sp: 'none', text: '「糖粉很细。筛糖的人一天要筛三百磅。」' },
    { t: 'line', sp: 'none', text: '「手上有伤口的人，伤口里会结出白色的硬壳。」' },
    { t: 'line', sp: 'ftz', text: '（三百磅。我搬过最重的东西是铸件，一天两百磅。）' },
    { t: 'line', sp: 'ftz', text: '（搬完了可以坐下。筛糖的人不能坐。）' },
    { t: 'line', sp: 'none', text: '我翻到第四页。第四页的纸比前三页都软，像被翻过很多次。' },
    { t: 'line', sp: 'none', text: '「长期吸入糖粉的人，肺里会长满白色的结节。硬得像糖块。」' },
    { t: 'line', sp: 'none', text: '「她们死的时候，咳出来的痰都是甜的。」' },
    { t: 'line', sp: 'ftz', text: '（……）' },
    { t: 'line', sp: 'none', text: '屋子里很静。静得能听见我自己的呼吸。' },
    { t: 'line', sp: 'ftz', text: '（她们。不是他们。筛糖的是女人。）' },
    { t: 'line', sp: 'none', text: '我把手放在这一页上。纸很凉，凉得像铁。' },
    { t: 'line', sp: 'ftz', text: '（甜的。这个词在这一页以前，一直是好的。）' },
    { t: 'line', sp: 'ftz', text: '（一页纸。十一行字。写这一页的人，用的也是同一个词。）' },
    { t: 'line', sp: 'ftz', text: '（这一页我读了两遍。第二遍比第一遍慢。）' },
    { t: 'line', sp: 'emma', text: '要翻页吗，少爷？' },
    { t: 'line', sp: 'ftz', text: '（她没有问我读到了什么。）' },
    { t: 'line', sp: 'ftz', text: '（她问我要不要继续。她知道我停在哪里。）' },
    { t: 'line', sp: 'ftz', text: '不用了。' },
    { t: 'line', sp: 'none', text: '我合上书。书脊发出一声很轻的响。' },
    { t: 'line', sp: 'ftz', text: '（甜是生命，亦是死亡。）' },
    { t: 'line', sp: 'ftz', text: '（这句话不是比喻。是两个事实，写在同一页上。）' },
    { t: 'do', do: [
      { conviction: 6 },
      { flag: ['readChronicleFull', true] },
      { achievement: 'threeProofs' },
    ] },
  ],

  talkEmmaLibrary: [
    { t: 'line', sp: 'ftz', text: '艾玛，你读过这些书吗？' },
    { t: 'line', sp: 'emma', text: '读过一部分，少爷。' },
    { t: 'line', sp: 'ftz', text: '哪一部分？' },
    { t: 'line', sp: 'emma', text: '有用的那一部分。' },
    { t: 'line', sp: 'ftz', text: '（她的回答永远精确，且永远只是索引。）' },
    { t: 'line', sp: 'ftz', text: '这里有没有关于糖的书？' },
    { t: 'line', sp: 'emma', text: '有一本。' },
    { t: 'line', sp: 'ftz', text: '哪一本？' },
    { t: 'line', sp: 'emma', text: '就是桌上那本。' },
    { t: 'line', sp: 'ftz', text: '（编年史。她指的是桌上那一本。）' },
    { t: 'line', sp: 'ftz', text: '什么叫有用？' },
    { t: 'line', sp: 'emma', text: '需要的时候会有用的。' },
    { t: 'line', sp: 'ftz', text: '（她没有说对谁有用。）' },
    { t: 'line', sp: 'none', text: '她把手搭在书脊上，顺着书脊滑过去，像在数。' },
    { t: 'line', sp: 'none', text: '她数到第十三本，停住，抽出来，又放回去。' },
  ],

  // ================= 第一章 · 走廊与画廊 =================

  arriveCorridorMain: [
    { t: 'line', sp: 'none', text: '大走廊比东翼那条宽，也亮一些。两排画像从地板挂到接近天花板。' },
    { t: 'line', sp: 'ftz', text: '（宽五格。顶高四格。比东翼宽两格。）' },
    { t: 'line', sp: 'ftz', text: '（两排画像，一共十九幅。）' },
    { t: 'line', sp: 'none', text: '走廊尽头是拱门，拱门外是白光。' },
    { t: 'line', sp: 'ftz', text: '（光从外面来。走廊里没有窗。）' },
    { t: 'line', sp: 'ftz', text: '（可这条走廊是亮的。）' },
    { t: 'line', sp: 'none', text: '地上的石板是干的。山里的石头，不会这么干。' },
    { t: 'line', sp: 'none', text: '走廊那头传来玛尔塔的声音，隔着两扇门，只听清了一半。' },
    { t: 'line', sp: 'marta', text: '少爷——吃饭了——' },
    { t: 'line', sp: 'ftz', text: '（喊了三遍。第三遍比前两遍低半度。）' },
    { t: 'do', do: [{ toast: '细看画像，或继续往右去石桥。' }] },
  ],

  corridorPaintingFace: [
    { t: 'line', sp: 'none', text: '我站在墙边，从左往右看了一遍。' },
    { t: 'line', sp: 'ftz', text: '（十九张脸。瘦削、苍白、眼睛很深。）' },
    { t: 'line', sp: 'ftz', text: '（第一遍我看脸。第二遍我看手。）' },
    { t: 'line', sp: 'none', text: '我把每一幅画的下半截都看了一遍。' },
    { t: 'line', sp: 'ftz', text: '（没有手。）' },
    { t: 'line', sp: 'ftz', text: '（十九幅画，十九双手都藏在衣褶里、袖子里、阴影里。）' },
    { t: 'line', sp: 'ftz', text: '（画师会给脸画上皱纹，会给勋章画上刻纹，却不给一双手。）' },
    { t: 'line', sp: 'none', text: '只有一幅是例外。那幅有伤疤的画里，一只手按在剑柄上。' },
    { t: 'line', sp: 'ftz', text: '（手是全身最难画的部分。藏起手，是画师偷懒。）' },
    { t: 'line', sp: 'ftz', text: '（十九次偷懒。同一个人？）' },
    { t: 'line', sp: 'ftz', text: '（不。是同一双手，不能画。）' },
    { t: 'line', sp: 'none', text: '我退开两步。十九幅画一起看着我。' },
    { t: 'do', do: [{ flag: ['sawHands', true] }] },
  ],

  // ================= 第一章 · 石桥 =================

  arriveBridge: [
    { t: 'line', sp: 'none', text: '石桥横跨峡谷。风穿过桥洞，发出一种像古老乐器在无人演奏时自己发出的悲鸣。' },
    { t: 'line', sp: 'none', text: '峡谷对面，那座塔立在山脊边缘。' },
    { t: 'line', sp: 'ftz', text: '（塔身上有四个巨大的圆形凹槽。像是用来安装钟面的。）' },
    { t: 'line', sp: 'ftz', text: '（不像楼梯。不像钟楼。）' },
    { t: 'line', sp: 'none', text: '桥面很宽，两侧的栏杆齐腰高。石板上没有青苔。' },
    { t: 'line', sp: 'ftz', text: '（没有青苔。山里的桥，没有青苔。）' },
    { t: 'line', sp: 'ftz', text: '（桥面每隔两格有一道接缝。二十三道。）' },
    { t: 'line', sp: 'ftz', text: '（有人在扫。或者石头里有别的东西，苔长不出来。）' },
    { t: 'do', do: [{ toast: '按 Tab 打开图纸，测量这座塔。' }] },
  ],

  bridgeWind: [
    { t: 'line', sp: 'none', text: '我停下来，听桥洞里的风。' },
    { t: 'line', sp: 'ftz', text: '（四孔。孔高两格，宽一格半。）' },
    { t: 'line', sp: 'ftz', text: '（按这个跨度，桥能过一辆四匹马拉的车，或者两门六磅炮。）' },
    { t: 'line', sp: 'ftz', text: '（石板上没有车辙。一道也没有。）' },
    { t: 'line', sp: 'ftz', text: '（这座桥不是用来过车的。）' },
    { t: 'line', sp: 'emma', text: '风是从下面来的，少爷。' },
    { t: 'line', sp: 'ftz', text: '（峡谷底没有河。）' },
    { t: 'line', sp: 'none', text: '我往下看。雾在桥洞里打转，方向跟风相反。' },
    { t: 'line', sp: 'ftz', text: '（雾在往山上走。）' },
    { t: 'line', sp: 'none', text: '风把我的外套掀起来，又放下。桥没有晃。' },
    { t: 'line', sp: 'ftz', text: '（这么大的风，桥没有晃。它不挡风，它在把风送走。）' },
    { t: 'do', do: [{ conviction: -2, flag: ['bridgeWindHeard', true] }] },
  ],

  lookTower: [
    { t: 'line', sp: 'none', text: '塔。灰白色的石墙。四个巨大的圆形凹槽，像眼睛，像钟面。' },
    { t: 'line', sp: 'ftz', text: '（钟楼不会做成这样。钟楼需要的是能看的窗，不是能装东西的洞。）' },
    { t: 'line', sp: 'ftz', text: '（塔高大约四十格。凹槽的直径是九格。）' },
    { t: 'line', sp: 'ftz', text: '（九格。一个洞里能站下十八个人。）' },
    { t: 'line', sp: 'ftz', text: '（如果它是钟面，钟的直径是九格。没有那么大的钟。）' },
    { t: 'line', sp: 'none', text: '塔壁上没有一道裂缝。四十格高的石墙，一道裂缝也没有。' },
    { t: 'line', sp: 'ftz', text: '（这不合常理。石头的墙会裂。除非它不是墙。）' },
    { t: 'line', sp: 'none', text: '塔身上，四个凹槽之间有一道极细的浅槽，把它们连在一起。' },
    { t: 'line', sp: 'ftz', text: '（浅槽宽半格。四个洞不是四个洞。是一条路。）' },
    { t: 'do', do: [{ toast: '按 Tab 打开图纸。用标尺量塔壁和凹槽。' }] },
  ],

  talkEmmaBridge: [
    { t: 'line', sp: 'emma', text: '您在看什么，少爷？' },
    { t: 'line', sp: 'ftz', text: '那座塔。它不是钟楼。' },
    { t: 'line', sp: 'emma', text: '您比大多数人看得仔细。' },
    { t: 'line', sp: 'ftz', text: '（这是她第一次接近赞美。）' },
    { t: 'line', sp: 'ftz', text: '（也是第一次让我觉得这是句坏话。）' },
    { t: 'line', sp: 'none', text: '艾玛把马灯换到左手，右手在裙子上按了一下。' },
    { t: 'line', sp: 'ftz', text: '（她的右手一直垂着。从下车起就是。）' },
    { t: 'line', sp: 'ftz', text: '大多数人是谁？' },
    { t: 'line', sp: 'emma', text: '来过这里的人。' },
    { t: 'line', sp: 'ftz', text: '（来过。不是住过。）' },
    { t: 'line', sp: 'none', text: '艾玛转过身，看着塔，看了很久。她没有眨眼。' },
    { t: 'do', do: [{ conviction: 4, flag: ['emmaPraised', true] }] },
  ],

  toBridge: [
    { t: 'line', sp: 'none', text: '走廊尽头是一道拱门。门外的光很白，照得石地上没有影子。' },
    { t: 'line', sp: 'ftz', text: '（光太白了。山里的月光不是这个颜色。）' },
    { t: 'line', sp: 'none', text: '再往外，是峡谷和风。桥面很窄。' },
    { t: 'line', sp: 'ftz', text: '（两格宽。走十步就到对面。）' },
    { t: 'line', sp: 'none', text: '风从拱门里灌进来，把走廊里的烛火压得很低。' },
    { t: 'do', do: [{ toast: '向右走出拱门，就是石桥。' }] },
  ],

  // ================= 第一章 · 地窖 =================

  arriveCellar: [
    { t: 'line', sp: 'none', text: '地窖的空气又冷又湿，有酒、橡木和某种更古老的气味。' },
    { t: 'line', sp: 'none', text: '酒桶排成三列。最老的一排后面，有一扇很小、很窄、很低的铁门。' },
    { t: 'line', sp: 'ftz', text: '（铁门上有一个十字架。不是铁十字黑秃鹫。）' },
    { t: 'line', sp: 'ftz', text: '（只是一个简单的、两条直线垂直交叉的十字架。）' },
    { t: 'line', sp: 'none', text: '梯子最后一级上有一道磨痕，像有人在这里站过很久。' },
    { t: 'line', sp: 'ftz', text: '（站在最后一级上，刚好能看见那扇门。）' },
    { t: 'line', sp: 'none', text: '头顶的木梁上挂着一盏灯。灯罩里有一只死了的蛾子。' },
    { t: 'line', sp: 'ftz', text: '（第三列桶比前两列矮半格。地面不平。）' },
    { t: 'do', do: [{ toast: '调查那扇铁门。' }] },
  ],

  cellarBarrels: [
    { t: 'line', sp: 'none', text: '酒桶上有烙铁印的年份。我把最近的一排读了一遍。' },
    { t: 'line', sp: 'ftz', text: '（主后XX年。XX年。XX年。XX年。）' },
    { t: 'line', sp: 'ftz', text: '（最老的一排是XX年。比我大一百岁。）' },
    { t: 'line', sp: 'ftz', text: '（桶是满的。空桶一百二十磅，满桶三百磅。这些桶我推不动。）' },
    { t: 'line', sp: 'none', text: '我推了推最里面那只桶。桶没有动，桶底下的木板响了一声。' },
    { t: 'line', sp: 'ftz', text: '（下面是空的。）' },
    { t: 'line', sp: 'ftz', text: '（地窖的地面是石头的。石头下面是空的。）' },
    { t: 'line', sp: 'none', text: '很远的地方，有什么声音。像是有人在数数。' },
    { t: 'line', sp: 'voice', text: '……二十九。三十。' },
    { t: 'line', sp: 'ftz', text: '（我数错了。或者它在等我数完。）' },
    { t: 'do', do: [{ conviction: -2, flag: ['sawBarrels', true] }, { sound: 'sting' }] },
  ],

  lookIronDoor: [
    { t: 'line', sp: 'none', text: '门是黑的。铁皮上钉着拳头大的钉子。' },
    { t: 'line', sp: 'none', text: '我把手放上去。门是冷的。' },
    { t: 'line', sp: 'ftz', text: '（门后面有风。）' },
    { t: 'line', sp: 'ftz', text: '（地窖后面是山。门后面不该有风。）' },
    { t: 'line', sp: 'none', text: '门缝里塞着一条旧布，布已经被风吹得发硬了。' },
    { t: 'line', sp: 'ftz', text: '（有人塞过布，想把风堵住。）' },
    { t: 'line', sp: 'ftz', text: '（堵不住。风不是从缝里来的，是从门里面来的。）' },
    { t: 'line', sp: 'none', text: '我把耳朵贴上去。里面很安静。' },
    { t: 'line', sp: 'ftzCold', text: '（安静得像有人也在听。）' },
    { t: 'line', sp: 'none', text: '门上的十字架是用两条铁条焊上去的。焊口很新。' },
    { t: 'line', sp: 'ftz', text: '（门上没有锁孔。锁在另一面。）' },
    { t: 'line', sp: 'none', text: '门角上有一个铁槽，槽里本该卡着一块石头。槽是空的。' },
    { t: 'line', sp: 'ftz', text: '（配重槽。这扇门的重量，靠一块石头来平衡。）' },
    { t: 'line', sp: 'ftz', text: '（石头不见了。门还是关着。那是什么在把它压住？）' },
    { t: 'do', do: [{ conviction: -6, flag: ['sawIronDoor', true] }, { achievement: 'threeProofs' }, { sound: 'sting' }] },
  ],

  talkEmmaCellar: [
    { t: 'line', sp: 'none', text: '脚步声从楼梯上下来。' },
    { t: 'line', sp: 'emma', text: '少爷。' },
    { t: 'line', sp: 'ftz', text: '艾玛。这扇门后面是什么？' },
    { t: 'line', sp: 'emma', text: '储藏室，少爷。' },
    { t: 'line', sp: 'emma', text: '没什么好看的。' },
    { t: 'line', sp: 'ftz', text: '（她不是在回答我。她是在让我停下。）' },
    { t: 'line', sp: 'ftz', text: '储藏室需要这么好的锁吗？' },
    { t: 'line', sp: 'none', text: '艾玛没有看那扇门。她一直看着我。' },
    { t: 'line', sp: 'emma', text: '风大，少爷。回去吧。' },
    { t: 'line', sp: 'ftz', text: '（她说风大。可这里没有风。风在门里面。）' },
    { t: 'line', sp: 'none', text: '她把灯举高了一点。灯光照不到门。' },
    { t: 'do', do: [{ flag: ['emmaStopCellar', true] }, { conviction: -2 }] },
  ],

  // ================= 第一章 · 花园 =================

  arriveGarden: [
    { t: 'line', sp: 'none', text: '后花园比想象中大。草坪修剪过，但修剪得不太整齐，像是每隔很久才有人来一次。' },
    { t: 'line', sp: 'none', text: '角落里有一片小水塘。' },
    { t: 'line', sp: 'ftz', text: '（花园三十二步长。石墙围了三面。）' },
    { t: 'line', sp: 'ftz', text: '（第四面没有墙。是崖。）' },
    { t: 'line', sp: 'none', text: '靠墙有一排剪成方块的灌木，剪口是新的。' },
    { t: 'line', sp: 'ftz', text: '（剪口新的。人不在。剪刀也不在。）' },
    { t: 'line', sp: 'none', text: '远处，山脊上的塔露在树梢上面。' },
    { t: 'do', do: [{ toast: '调查鱼塘和旧竹竿。' }] },
  ],

  lookPond: [
    { t: 'line', sp: 'none', text: '水塘不大，大概只有我的卧室那么宽。边缘砌着灰白色的石头，石上长满青苔。' },
    { t: 'line', sp: 'none', text: '水面有极细微的波纹，从塘心向外扩散，慢到不仔细看根本注意不到。' },
    { t: 'line', sp: 'emma', text: '下面是泉眼。' },
    { t: 'line', sp: 'emma', text: '源头在黑森林里。' },
    { t: 'line', sp: 'ftz', text: '（那座塔的凹槽比塔壁还深。）' },
    { t: 'line', sp: 'ftz', text: '（如果山上到处是空的，那这座城堡是建在什么上面的？）' },
    { t: 'line', sp: 'none', text: '我往水里扔了一粒石子。水面没有响。' },
    { t: 'line', sp: 'ftz', text: '（没有响。石头沉下去了，水没有合上。）' },
    { t: 'line', sp: 'ftz', text: '（水是黑的。黑得能看见底——如果底下有底的话。）' },
    { t: 'line', sp: 'none', text: '石子落下去的地方没有波纹。塘心那一圈还在。' },
    { t: 'line', sp: 'ftz', text: '（水没有收下我的石头。）' },
    { t: 'do', do: [{ conviction: -4, flag: ['sawPond', true] }] },
  ],

  gardenRod: [
    { t: 'line', sp: 'none', text: '旧竹竿靠在墙边。漆剥落了大半，竹节上有一圈一圈的刻痕。' },
    { t: 'line', sp: 'ftz', text: '（刻痕不是随意划的。每一圈之间隔着一格。）' },
    { t: 'line', sp: 'ftz', text: '（有人用它量过东西。量得很准。）' },
    { t: 'line', sp: 'none', text: '竿子的末端缠着线，线的另一头系着一枚弯了的鱼钩。' },
    { t: 'line', sp: 'ftz', text: '（钩子是自己弯的。用一根针。）' },
    { t: 'line', sp: 'ftz', text: '（我十一岁的时候也这么干过。用嬷嬷的缝衣针，被罚了一顿晚饭。）' },
    { t: 'line', sp: 'ftz', text: '（那根针我后来还回去了。）' },
    { t: 'line', sp: 'none', text: '艾玛不知什么时候站到了墙边。' },
    { t: 'line', sp: 'emma', text: '没人记得它是谁的。' },
    { t: 'line', sp: 'ftz', text: '（没人记得。可是漆是新的。竿身没有灰。）' },
    { t: 'line', sp: 'none', text: '竿子靠在墙上，竿尖指着鱼塘的方向。' },
    { t: 'line', sp: 'ftz', text: '（不是随便靠的。是量过的角度。）' },
    { t: 'do', do: [{ flag: ['sawRod', true] }] },
  ],

  lookRod: [
    { t: 'line', sp: 'none', text: '一根旧竹鱼竿，漆已经剥落大半。' },
    { t: 'line', sp: 'ftz', text: '（什么时候来钓一次鱼。）' },
    { t: 'line', sp: 'none', text: '竿子上有一段用布缠过，布已经和漆粘在一起。' },
    { t: 'line', sp: 'ftz', text: '（缠布是为了握得稳。握得稳，是为了提得动。）' },
    { t: 'line', sp: 'ftz', text: '（有人在这根竿子上想过很久。）' },
  ],

  talkEmmaGarden: [
    { t: 'line', sp: 'ftz', text: '这花园是谁修的？' },
    { t: 'line', sp: 'emma', text: '没人说得清。' },
    { t: 'line', sp: 'emma', text: '花的名字，数量，价钱。' },
    { t: 'line', sp: 'emma', text: '贵族该认得出这些。' },
    { t: 'line', sp: 'emma', text: '别人问起你的花园。' },
    { t: 'line', sp: 'emma', text: '只说美丽是不够的。' },
    { t: 'line', sp: 'emma', text: '会被当成敷衍。' },
    { t: 'line', sp: 'ftz', text: '（在船厂，我们评价一艘军舰从不说好看。）' },
    { t: 'line', sp: 'ftz', text: '（我们说：舰艏的弧线不够流畅，上层建筑的重心偏高，炮塔的布局影响射界。）' },
    { t: 'line', sp: 'ftz', text: '（每一个词都有具体的含义。每一个判断都有具体的依据。）' },
    { t: 'line', sp: 'ftz', text: '（那才是看懂了。）' },
    { t: 'line', sp: 'ftz', text: '那这花园呢？' },
    { t: 'line', sp: 'emma', text: '您自己看，少爷。' },
    { t: 'line', sp: 'ftz', text: '（东边那排灌木剪得比西边低半格。不是因为地形。）' },
    { t: 'line', sp: 'ftz', text: '（是因为从东边的窗户看出去，要能看见山脊上的塔。）' },
    { t: 'line', sp: 'none', text: '艾玛没有点头，也没有摇头。她只是把手里的剪子换了一只手。' },
    { t: 'do', do: [{ conviction: 5, flag: ['learnedGarden', true] }] },
  ],

  // ================= 第一章 · 接待厅 =================

  arriveParlor: [
    { t: 'line', sp: 'none', text: '接待厅是个用来让客人等候的房间。' },
    { t: 'line', sp: 'none', text: '三把椅子，一张小桌，一面壁炉，两扇朝西的窗。' },
    { t: 'line', sp: 'emma', text: '这里接待过求婚的人。' },
    { t: 'line', sp: 'ftz', text: '求婚？' },
    { t: 'line', sp: 'emma', text: '是的，少爷。' },
    { t: 'line', sp: 'emma', text: '那一带，还有几户人家。' },
    { t: 'line', sp: 'ftz', text: '现在呢？' },
    { t: 'line', sp: 'emma', text: '现在没有了。' },
    { t: 'line', sp: 'none', text: '窗玻璃上有一层均匀的灰。壁炉里是冷的。' },
    { t: 'line', sp: 'ftz', text: '（椅子是给客人坐的。可这里二十年没有客人。）' },
    { t: 'line', sp: 'none', text: '墙上没有画像。整座古堡，只有这一间墙上没有画像。' },
    { t: 'line', sp: 'none', text: '两扇窗朝西。太阳已经落到山后，玻璃上只剩一层灰白。' },
    { t: 'line', sp: 'ftz', text: '（朝西的窗，冬天会有风。）' },
    { t: 'do', do: [{ flag: ['parlorStory', true] }] },
  ],

  parlorChairs: [
    { t: 'line', sp: 'none', text: '三把椅子，一把朝门，两把朝窗。' },
    { t: 'line', sp: 'ftz', text: '（三把。可这个房间能坐十二个人。）' },
    { t: 'line', sp: 'ftz', text: '（椅子腿在地板上磨出了印子。印子只有三处。）' },
    { t: 'line', sp: 'ftz', text: '（也就是说，这里从来没有坐过第四个人。）' },
    { t: 'line', sp: 'none', text: '我坐在朝门的那把上。椅子矮了半寸。' },
    { t: 'line', sp: 'ftz', text: '（一条腿短了。有人垫过纸。）' },
    { t: 'line', sp: 'none', text: '椅子底下压着一张纸。我抽出来。' },
    { t: 'line', sp: 'none', text: '纸上是一幅铅笔速写：三把椅子，和一个站着的人。' },
    { t: 'line', sp: 'ftz', text: '（站着的那个人没有画脸。）' },
    { t: 'line', sp: 'ftz', text: '（画得很轻。画的时候，手在抖。）' },
    { t: 'do', do: [{ conviction: -2, flag: ['sawChairs', true] }] },
  ],

  talkEmmaParlor: [
    { t: 'line', sp: 'ftz', text: '艾玛，你有姓氏吗？' },
    { t: 'line', sp: 'none', text: '艾玛停了一下。' },
    { t: 'line', sp: 'emma', text: '没有，少爷。' },
    { t: 'line', sp: 'none', text: '她没有解释。她没有说但是，也没有说不过。' },
    { t: 'line', sp: 'ftz', text: '（四个字。没有，少爷。）' },
    { t: 'line', sp: 'ftz', text: '（我问了七个字。她答了四个。）' },
    { t: 'line', sp: 'none', text: '她把手放在椅背上，手指并拢，很规矩。' },
    { t: 'line', sp: 'ftz', text: '（椅背是凉的。她的手放上去，椅子没有变暖。）' },
    { t: 'line', sp: 'ftz', text: '那赫尔曼叫你艾玛。' },
    { t: 'line', sp: 'emma', text: '所有人都叫我艾玛。' },
    { t: 'line', sp: 'ftz', text: '（没有姓氏的人，教区的册子上写不全。）' },
    { t: 'line', sp: 'ftz', text: '（她站在这里，名字只有两个字。这两个字是别人给的。）' },
    { t: 'line', sp: 'none', text: '窗外有风。窗玻璃轻轻震了一下，灰落下来一层。' },
    { t: 'line', sp: 'emma', text: '快到晚饭的时间了。' },
    { t: 'line', sp: 'ftz', text: '（她答得很快。快得像是早就准备好了。）' },
    { t: 'line', sp: 'none', text: '她转身往门口走。走了三步，停下，等我。' },
    { t: 'do', do: [{ conviction: -3, flag: ['askedEmmaSurname', true] }] },
  ],

  // ================= 第一章 · 收束 =================

  endChapter1: [
    { t: 'line', sp: 'none', text: '入夜。' },
    { t: 'line', sp: 'none', text: '我在床上躺了很久，听着古堡的声音。' },
    { t: 'line', sp: 'ftz', text: '（这不是一栋房子。这是一台机器。）' },
    { t: 'line', sp: 'ftz', text: '（有人在维护它。）' },
    { t: 'line', sp: 'none', text: '远处，地板下面，有什么东西在响。一下，又一下。' },
    { t: 'line', sp: 'ftz', text: '（二十八下。停了。又从头开始。）' },
    { t: 'line', sp: 'ftz', text: '（塔上的凹槽比塔壁深。这座塔是空的。）' },
    { t: 'line', sp: 'ftz', text: '（而地窖那扇门后面，有人在数数。）' },
    { t: 'line', sp: 'ftz', text: '（明天我要再去一次石桥。）' },
    { t: 'line', sp: 'none', text: '屋顶上的雨又下起来了，敲在瓦上，很轻。' },
    { t: 'line', sp: 'none', text: '我把被子拉到下巴。布很软。' },
    { t: 'line', sp: 'none', text: '我睡着了。' },
    { t: 'do', do: [{ achievement: 'ch1' }, { toast: '垂直切片到此结束。' }] },
  ],

  // ================= 彩蛋 · 车厢左端的门洞 =================
  // 玩家在列车上调查满 4 件不同的东西之后，左端门洞里才会多出这个人
  // （events.ts 的 noteTrainLook 设 dsOpen）。她说一次话就消失（dsGone）。
  // 她的口吻是冷的陈述句：她知道一点不该知道的事，但不解释自己是谁。
  dsCameo: [
    { t: 'line', sp: 'none', text: '门洞里站着一个人。' },
    { t: 'line', sp: 'ds', text: '您来得比上一次早。' },
    { t: 'line', sp: 'ftz', text: '（上一次。）' },
    { t: 'line', sp: 'ds', text: '这一节车厢后面没有下一节。' },
    { t: 'line', sp: 'ds', text: '您会在这里坐很久，然后下车。' },
    { t: 'line', sp: 'ftz', text: '你是谁。' },
    { t: 'line', sp: 'ds', text: '一个名字。别人给的。' },
    { t: 'line', sp: 'ds', text: '和您的一样。' },
    { t: 'line', sp: 'none', text: '她的头发是蓝的。这节车厢里没有第二样东西是蓝的。' },
    { t: 'line', sp: 'ds', text: '地板下面有一个数。' },
    { t: 'line', sp: 'ds', text: '二十八下。不是钟。' },
    { t: 'line', sp: 'ftz', text: '（二十八这个数，我没有跟任何人提过。）' },
    { t: 'line', sp: 'ds', text: '去吧。门要开了。' },
    { t: 'line', sp: 'none', text: '她退进门洞的暗处。没有脚步声。' },
    { t: 'do', do: [
      { flag: ['dsGone', true] },
      { toast: '（门后又是黑的。）' },
      { achievement: 'cameo' },
    ] },
  ],
}

// 补图成功后的回调（由 UI 调用）
export const REPAIR_DONE_SCRIPT: Step[] = [
  { t: 'line', sp: 'none', text: '拱肋上的线，连上了。' },
  { t: 'line', sp: 'none', text: '两侧的烛台同时亮起。大厅亮了一倍。' },
  { t: 'line', sp: 'ftz', text: '（原来它们一直是好的。）' },
  { t: 'line', sp: 'ftz', text: '（只是没有人把线接上。）' },
  { t: 'do', do: [{ achievement: 'firstRepair' }, { conviction: 8 }, { flag: ['archRepaired', true] }] },
]

// ============================================================
// 追加区（不改动上面任何一条既有脚本）
// 1) 列车上的 NPC 与装饰：只给「世界感」，不给线索、不给物品。
// 2) 第二次及以后的短回应：<id>_again。只给「已经做过了」的反应，
//    不复述信息；主角记数、记账、看变化（§7）。
// 合并方式：写在文件末尾，运行时并进 SCRIPTS。
// ============================================================

const EXTRA_SCRIPTS: Record<string, Step[]> = {
  // ---------------- 列车 · 睡着的老人 ----------------
  trainSleeper: [
    { t: 'line', sp: 'none', text: '靠窗的座位上，一个老人睡着了。' },
    { t: 'line', sp: 'none', text: '帽子从他头上滑下来，落在膝盖上。' },
    { t: 'line', sp: 'ftz', text: '（不打呼噜。胸口起伏的间隔是四秒。）' },
  ],
  trainSleeper_again: [
    { t: 'line', sp: 'ftz', text: '（帽子还在他膝盖上。我没有替他捡。）' },
  ],

  // ---------------- 列车 · 看报的先生 ----------------
  trainNewspaper: [
    { t: 'line', sp: 'none', text: '一个先生在看报。报纸挡住了他的脸。' },
    { t: 'line', sp: 'none', text: '第三版有一则短讯：东弗里斯兰矿脉，勘测队报告，深处有回音。' },
    { t: 'line', sp: 'ftz', text: '（矿里没有回音。写这条的人没有下过井。）' },
  ],
  trainNewspaper_again: [
    { t: 'line', sp: 'ftz', text: '（他翻了一页。还是第三版。）' },
  ],

  // ---------------- 列车 · 抱孩子的女人 ----------------
  trainMother: [
    { t: 'line', sp: 'none', text: '一个妇人抱着孩子。孩子没有睡。' },
    { t: 'line', sp: 'none', text: '孩子把脸贴在窗上，看树一棵一棵往后退。' },
    { t: 'line', sp: 'ftz', text: '（他的呼吸跟着车厢。过一根电线杆，眨一次眼。）' },
  ],
  trainMother_again: [
    { t: 'line', sp: 'ftz', text: '（孩子还在看窗外。窗外已经没有可看的东西了。）' },
  ],

  // ---------------- 列车 · 空座与手杖 ----------------
  trainCane: [
    { t: 'line', sp: 'none', text: '座位空着。一根手杖靠在座垫上。' },
    { t: 'line', sp: 'none', text: '杖头是铜的，磨得发亮。主人不在。' },
    { t: 'line', sp: 'ftz', text: '（杖身上刻着一个字母。M。刻得很浅。）' },
  ],
  trainCane_again: [
    { t: 'line', sp: 'ftz', text: '（M。杖身上的刻痕还是十一道。）' },
  ],

  // ---------------- 列车 · 行李架 ----------------
  trainRack: [
    { t: 'line', sp: 'none', text: '窗上方的行李架。三只箱子，一只旅行袋。' },
    { t: 'line', sp: 'none', text: '最里面那只箱子的锁坏了，扣环挂在锁舌外面。' },
    { t: 'line', sp: 'ftz', text: '（锁坏了，箱子却没开。有东西从里面顶住了它。）' },
  ],
  trainRack_again: [
    { t: 'line', sp: 'ftz', text: '（扣环还挂在锁舌外面。箱子没有动。）' },
  ],

  // ---------------- 列车 · 窗帘 ----------------
  trainCurtain: [
    { t: 'line', sp: 'none', text: '窗帘是厚的，深红，边上一排铜环。' },
    { t: 'line', sp: 'none', text: '我拉了一下。铜环在杆上滑了半格。' },
    { t: 'line', sp: 'none', text: '外面的雾没有变。' },
    { t: 'line', sp: 'ftz', text: '（六月的车厢挂厚窗帘。像是有人早就知道要路过这里。）' },
  ],
  trainCurtain_again: [
    { t: 'line', sp: 'ftz', text: '（拉第二次，雾还在。铜环只响了一声。）' },
  ],

  // ---------------- 列车 · 垃圾桶 ----------------
  trainBin: [
    { t: 'line', sp: 'none', text: '座位底下有一只铁皮垃圾桶。' },
    { t: 'line', sp: 'none', text: '桶里有一张撕掉一半的车票。' },
    { t: 'line', sp: 'ftz', text: '（剩下的一半上没有站名。日期也撕掉了。）' },
  ],
  trainBin_again: [
    { t: 'line', sp: 'ftz', text: '（我没有找那另一半。桶里没有别的东西。）' },
  ],

  // ---------------- 列车 · 湿脚印 ----------------
  trainFootstep: [
    { t: 'line', sp: 'none', text: '地板上有一串湿脚印。' },
    { t: 'line', sp: 'none', text: '从车门一直通向车尾。' },
    { t: 'line', sp: 'ftz', text: '（四十七步。脚印只有去的，没有回来的。）' },
  ],
  trainFootstep_again: [
    { t: 'line', sp: 'ftz', text: '（脚印在变干。边缘已经发白了。）' },
  ],

  // ---------------- 列车 · 车窗上的霜 ----------------
  trainFrost: [
    { t: 'line', sp: 'none', text: '窗玻璃上结了一层霜。' },
    { t: 'line', sp: 'none', text: '霜从四角往中间长，像蕨类的叶子。' },
    { t: 'line', sp: 'ftz', text: '（六月。车厢里二十度。这层霜是六小时前结的。）' },
  ],
  trainFrost_again: [
    { t: 'line', sp: 'ftz', text: '（霜没有化。我用指甲刮过，刮不动。）' },
  ],

  // ---------------- 列车 · 车头方向的煤烟味 ----------------
  trainSmoke: [
    { t: 'line', sp: 'none', text: '车头方向传来一股煤烟味。' },
    { t: 'line', sp: 'none', text: '不是从窗缝进来的，是从地板下面。' },
    { t: 'line', sp: 'ftz', text: '（烧的是硬煤。船台上的锅炉也是这个味道。）' },
  ],
  trainSmoke_again: [
    { t: 'line', sp: 'ftz', text: '（煤烟味还在。风向没有变。）' },
  ],

  // ================= 列车 · 既有交互的第二次 =================
  lookCat_again: [
    { t: 'line', sp: 'none', text: '（它换了个姿势。还是不怕我。）' },
  ],
  talkEmmaTrain_again: [
    { t: 'line', sp: 'none', text: '（艾玛没有回答。她在看窗外。）' },
  ],
  trainWindow_again: [
    { t: 'line', sp: 'ftz', text: '（窗外还是雾。树在退。）' },
  ],
  // 这三条已经不在场景里（信 / 胸针 / 线图在背包中）。
  // 脚本按旧档与后续章节保留，_again 也一并保留：万一再挂回某个实体，行为一致。
  trainBox_again: [
    { t: 'line', sp: 'ftz', text: '（箱子锁着。图纸在箱底。我不用再开一次。）' },
  ],
  trainBrooch_again: [
    { t: 'line', sp: 'ftz', text: '（别针在衬布上。羽毛还是十九根。）' },
  ],
  trainLetter_again: [
    { t: 'line', sp: 'ftz', text: '（十四行。一百零七个字。我没有再数。）' },
  ],

  // ================= 门厅 =================
  lookVictoria_again: [
    { t: 'line', sp: 'ftz', text: '（她还在笑。我没有再看下去。）' },
  ],
  hallAncestors_again: [
    { t: 'line', sp: 'ftz', text: '（十三张脸。我没有再数。）' },
  ],
  lightCandle_again: [
    { t: 'line', sp: 'ftz', text: '（烛还在烧。蜡没有短。）' },
  ],
  talkHermannHall_again: [
    { t: 'line', sp: 'ftz', text: '（赫尔曼还在壁炉边。他没有再看那幅画。）' },
  ],
  archNeedBlueprint_again: [
    { t: 'line', sp: 'ftz', text: '（还是缺图纸。按 Tab。）' },
  ],
  archRepairStart_again: [
    // 放弃过一次修复之后还能再开始：这条短回应要接回修复流程。
    { t: 'line', sp: 'ftz', text: '（图纸还在手上。再量一次。）' },
    { t: 'do', do: [{ next: 'archRepairRun' }] },
  ],
  archDone_again: [
    { t: 'line', sp: 'ftz', text: '（拱肋的线接好了。我没有再数蜡烛。）' },
  ],

  // ================= 图书室 =================
  lookShelfLibrary_again: [
    { t: 'line', sp: 'ftz', text: '（诗集插回去了。书脊还是齐的。）' },
  ],
  libraryShelfLangs_again: [
    { t: 'line', sp: 'ftz', text: '（那本书在原来的位置。差半指。）' },
  ],
  lookMapTable_again: [
    { t: 'line', sp: 'ftz', text: '（我没有再看那个红圈。）' },
  ],
  readChronicleLibrary_again: [
    { t: 'line', sp: 'ftz', text: '（第四页。我已经读过两遍了。）' },
  ],
  talkEmmaLibrary_again: [
    { t: 'line', sp: 'ftz', text: '（艾玛没有再说话。她的手停在第十三本书上。）' },
  ],
}

// 并进 SCRIPTS：上面的对象字面量一个字都不动。
Object.assign(SCRIPTS, EXTRA_SCRIPTS)

// ============================================================
// 追加区 2：列车到站（engine.ts 的到站序列在淡入结束后自动播这一段）
// 艾玛的口吻：≤12 字、只陈述、不劝阻（NARRATIVE_DESIGN §7）。
// 她说三句短的：该下车了 / 行李她拿 / 让主角自己走。
// 最后一句落 canDisembark —— 右端车门的锁这才打开。
// ============================================================

const ARRIVAL_SCRIPTS: Record<string, Step[]> = {
  trainArrivalEmma: [
    { t: 'line', sp: 'emma', text: '糖堡到了。' },
    { t: 'line', sp: 'emma', text: '行李我先拿下去。' },
    { t: 'line', sp: 'none', text: '她从架上提起箱子，箱角在桌沿擦了一下，没有出声。' },
    { t: 'line', sp: 'emma', text: '您自己走。' },
    { t: 'do', do: [
      { flag: ['canDisembark', true] },
      { sound: 'bell' },
      { toast: '车门开了。向右走，下车。' },
    ] },
  ],
}

Object.assign(SCRIPTS, ARRIVAL_SCRIPTS)

// ============================================================
// 追加区 3：糖堡站 / 山路 / 正门 —— 精细化与"告示牌"
// ============================================================
// 三张地图原来太空：只有主线那几件东西，走一圈没有可看的。
// 这一段给每张地图补上"世界里本来就该有的东西"的台词。
//
// 两条规矩：
//   1. 不给物品、不给 flag（没有 conviction / sweetness 变动）—— 纯世界感。
//      主线与线索不靠它们推进，玩家漏看也不吃亏。
//   2. 每条 2–4 句，照 NARRATIVE_DESIGN §7：短句、带数字、工程比喻；
//      主角的独白一律全角括号。
//
// 告示牌（bp*）是另一回事：它们是图纸模式才看得见的标注，
// 写的是"图纸与实际对不上"的地方。克制 —— 只报数，不解释。
// ============================================================

const SUGARHOFEN_SCRIPTS: Record<string, Step[]> = {
  // ================= 糖堡站 =================
  stationCanopy: [
    { t: 'line', sp: 'none', text: '雨棚只剩三根立柱，顶上的铁皮早没了。' },
    { t: 'line', sp: 'none', text: '柱脚泡在一小片水里，水面上浮着铁锈。' },
    { t: 'line', sp: 'ftz', text: '（柱距四格。中间那根被拔走了，坑还在。）' },
  ],
  stationCart: [
    { t: 'line', sp: 'none', text: '一辆行李推车歪在月台根上，车板上摞着两只箱子。' },
    { t: 'line', sp: 'none', text: '箱角包着铜皮，铜皮上的字磨平了。' },
    { t: 'line', sp: 'ftz', text: '（箱子是空的。抬一头，另一头就翘起来。这车没有货。）' },
  ],
  stationBench: [
    { t: 'line', sp: 'none', text: '月台上有一条长椅，靠背的木板断了一根。' },
    { t: 'line', sp: 'none', text: '坐面上有一片水痕，形状像一个坐着的人。' },
    { t: 'line', sp: 'ftz', text: '（水痕是干的。四边一圈水印。坐了多久才会这样。）' },
  ],
  stationPuddle: [
    { t: 'line', sp: 'none', text: '站台的木板凹下去一块，积了一洼水。' },
    { t: 'line', sp: 'none', text: '水里有一盏灯。' },
    { t: 'line', sp: 'ftz', text: '（灯在上面，倒影在下面。我数了两遍：倒影里的灯比灯本身亮。）' },
  ],
  stationCrow: [
    { t: 'line', sp: 'none', text: '一只乌鸦站在警示线的里侧，羽毛贴在身上。' },
    { t: 'line', sp: 'none', text: '它不动，也不看我。' },
    { t: 'line', sp: 'ftz', text: '（雨下了半个钟头。它的羽毛还是干的。）' },
  ],

  // ================= 雾中的山路 =================
  roadSign: [
    { t: 'line', sp: 'none', text: '一根木杆上钉着两块牌子。上面那块削成箭头，指着路的前方。' },
    { t: 'line', sp: 'none', text: '字被雨泡过，只剩笔画的槽。' },
    { t: 'line', sp: 'ftz', text: '（箭头朝前。这一条路上只有一座房子，不需要指。）' },
  ],
  roadTrunk: [
    { t: 'line', sp: 'none', text: '一棵冷杉倒在山道中间，根翻在外面，土还是新的。' },
    { t: 'line', sp: 'none', text: '树干断成两截，断口发白。' },
    { t: 'line', sp: 'ftz', text: '（根是干的。这一棵倒下不超过一个钟头。）' },
  ],
  roadCairn: [
    { t: 'line', sp: 'none', text: '路边码着一小堆石头，最上面那块压得最正。' },
    { t: 'line', sp: 'none', text: '石头被人摸得发亮，边角都圆了。' },
    { t: 'line', sp: 'ftz', text: '（七块。每块都比下面那块小一圈。有人常来加一块。）' },
  ],
  roadMilestone: [
    { t: 'line', sp: 'none', text: '一块齐膝高的石碑立在路边，碑面朝着路。' },
    { t: 'line', sp: 'none', text: '碑上刻着三列字，被雨磨浅了，笔画还数得出来。' },
    { t: 'line', sp: 'ftz', text: '（碑是旧的。底座是新凿的方石，棱角还割手。谁把一块两百年的石头重新立了起来。）' },
  ],
  roadChain: [
    { t: 'line', sp: 'none', text: '下坡那一侧拉了一道铁链，两根立柱之间垂下去半格。' },
    { t: 'line', sp: 'none', text: '链环上挂着水珠，一颗一颗。' },
    { t: 'line', sp: 'ftz', text: '（链子拉得比柱子低。它不拦人。它量高度。）' },
  ],

  // ================= 聚斯霍芬堡 · 正门 =================
  gateGargoyle: [
    { t: 'line', sp: 'none', text: '门左侧的墙脚蹲着一只石像鬼，翅膀收着，头压得很低。' },
    { t: 'line', sp: 'none', text: '它的爪子扣在压顶石上，指节一块一块分得清。' },
    { t: 'line', sp: 'ftz', text: '（它的嘴是空的。雨水顺着脸直接落下去，一滴也没有留下来。）' },
  ],
  gateGargoyleR: [
    { t: 'line', sp: 'none', text: '门右侧也有一尊。这一尊抬着头，朝着山下来的那条路。' },
    { t: 'line', sp: 'none', text: '它的角断了一根，断面很白。' },
    { t: 'line', sp: 'ftz', text: '（石头断了两百年，断面不该是白的。）' },
  ],
  gateChain: [
    { t: 'line', sp: 'none', text: '门洞里垂下来两股铁链，末端是一个空钩子。' },
    { t: 'line', sp: 'none', text: '链子正下方的门槛被磨出一道浅槽。' },
    { t: 'line', sp: 'ftz', text: '（钩子空着。吊闸不在这道门后面。它吊在别的地方。）' },
  ],
  gateTree: [
    { t: 'line', sp: 'none', text: '院子右侧立着一棵枯树，枝桠全朝着一个方向。' },
    { t: 'line', sp: 'none', text: '树皮上有一圈绳痕，勒进去一指深。' },
    { t: 'line', sp: 'ftz', text: '（绳痕的高度是四格。有一头牲口在这棵树上拴过很久。）' },
  ],
  gateDitch: [
    { t: 'line', sp: 'none', text: '门前横着一道石砌的水沟，沟底有一层水。' },
    { t: 'line', sp: 'none', text: '水不动，也没有味道。' },
    { t: 'line', sp: 'ftz', text: '（沟是通的，水是死的。雨下了三天，这条沟没有涨。）' },
  ],
  gateThreshold: [
    { t: 'line', sp: 'none', text: '门槛的条石被踩出一道凹，凹里有五道刻痕。' },
    { t: 'line', sp: 'none', text: '刻痕的间距不匀，最后一道比前面深。' },
    { t: 'line', sp: 'ftz', text: '（不是尺子刻的。是有人蹲在这儿，一道一道划的。）' },
  ],

  // ================= 图纸模式专属：告示牌 =================
  // 每一处只报"图上"和"眼前"的差，不说破。这是里线的缝：
  // 图纸在骗人，或者世界在改，读者自己选一个。
  bpStationEdge: [
    { t: 'line', sp: 'none', text: '图纸上，月台的边缘是一道直线。' },
    { t: 'line', sp: 'ftz', text: '（月台的边缘比图纸上多了三格。图纸是旧的。）' },
  ],
  bpStationPost: [
    { t: 'line', sp: 'none', text: '雨棚的柱子按四格一根排开，图上画了四根。' },
    { t: 'line', sp: 'ftz', text: '（柱子的间距不对。中间少了一根。）' },
  ],
  bpRoadStone: [
    { t: 'line', sp: 'none', text: '界碑在图上只是一个墨点，没有画底座。' },
    { t: 'line', sp: 'ftz', text: '（界碑的底座是新的。碑是旧的。）' },
  ],
  bpRoadBend: [
    { t: 'line', sp: 'none', text: '这一段路在图上是一根压直的线。' },
    { t: 'line', sp: 'ftz', text: '（这条路在图纸上不弯。是后来弯的。）' },
  ],
  bpGateArch: [
    { t: 'line', sp: 'none', text: '门楼的斗拱画得很细，每一跳都标了尺寸。' },
    { t: 'line', sp: 'ftz', text: '（门楼的斗拱结构不承重。它是装饰。）' },
  ],
  bpGateGargoyle: [
    { t: 'line', sp: 'none', text: '石像鬼在图上只有一个侧影，爪子的位置空着。' },
    { t: 'line', sp: 'ftz', text: '（石像鬼的爪子里没有排水槽。它不排水，它在看。）' },
  ],
}

Object.assign(SCRIPTS, SUGARHOFEN_SCRIPTS)

// ============================================================
// 追加区 4：第一章的两处低成本缺口
// 依据 docs/story/CHAPTER1_GAP.md 第三节（补丁 A / 补丁 B）
// ------------------------------------------------------------
// 本区只在文件末尾追加，上面的字一个都不动。
//   缺口 A：场景 8 的「房间索引」——必须插在 arriveCorridorMain 的**开头**，
//          所以先取旧数组、在前面拼 5 句再覆盖回去。Object.assign 在模块
//          加载时执行，早于任何 startScript，覆盖是安全的。
//   缺口 B：场景 10 的「母亲」——新脚本 talkEmmaMother，
//          挂在 hall 新增的 emmaHall 实体上（maps.ts）。
// 口吻照 NARRATIVE_DESIGN §7：艾玛 ≤12 字、只陈述、不劝阻；
// 主角独白一律全角括号；本区一个感叹号都没有。
// ============================================================

const CHAPTER1_GAP_SCRIPTS: Record<string, Step[]> = {
  // ---- 缺口 A：房间索引（原作 L604–L610） ----
  // 只念四个房间名，不做十八个：要的是「数不清」这个体验，不是清单本身。
  arriveCorridorMain: [
    // ① 艾玛报名字：匀速、不停顿、不解释。
    { t: 'line', sp: 'none', text: '艾玛在前头带路，一路报房间名。不快不慢，像在执行一项精确到秒的任务。' },
    { t: 'line', sp: 'emma', text: '起居室。图书室。' },
    { t: 'line', sp: 'emma', text: '音乐室。台球室。' },
    // ② 主角试图数。③ 数不清，放弃。
    { t: 'line', sp: 'ftz', text: '（……第十一个。第十二个。）' },
    { t: 'line', sp: 'ftz', text: '（她不停，也不解释。我数到第十七个。也可能是十九个。）' },
    ...(SCRIPTS.arriveCorridorMain ?? []),
  ],

  // ---- 缺口 B：母亲（原作 L746–L782，关键句 L766） ----
  talkEmmaMother: [
    // 他先提早餐那句「很复杂的人」。
    { t: 'line', sp: 'ftz', text: '早餐的时候，你说我母亲是很复杂的人。' },
    { t: 'line', sp: 'ftz', text: '可以多告诉我一些吗？' },
    // 沉默：久到弗里德里希以为她不会回答了。
    { t: 'line', sp: 'none', text: '艾玛没有立刻回答。也没有抬头。' },
    { t: 'line', sp: 'none', text: '久到我以为她不会回答了。' },
    // 原句拆成三行念出来（L766）。
    { t: 'line', sp: 'emma', text: '您母亲，' },
    { t: 'line', sp: 'emma', text: '她是唯一一个' },
    { t: 'line', sp: 'emma', text: '让赫尔曼大人笑过的人。' },
    // 他追问，她不再说。
    { t: 'line', sp: 'ftz', text: '她做了什么，他才笑？' },
    { t: 'line', sp: 'none', text: '艾玛没有再说别的。' },
    // 他自己看画像，找不到「真实」的痕迹（L770–L772）。
    { t: 'line', sp: 'ftz', text: '（画上的女人在笑。嘴角只有一点点。）' },
    { t: 'line', sp: 'ftz', text: '（我在这张脸上找了很久。找不到「真实」的痕迹。）' },
    // 落点：明天去看塔楼（L776）。
    { t: 'line', sp: 'ftz', text: '（明天，我要去看那座塔楼。）' },
  ],
}

Object.assign(SCRIPTS, CHAPTER1_GAP_SCRIPTS)

// ============================================================
// 追加区 5：场景 11 · 礼仪课（原作 L787–L891）
// ------------------------------------------------------------
// 流程：
//   etiquetteClass  下午的餐厅 · 长桌 · 那根「不是用来打人的」木棍 → 出题
//     └ do [{ quiz: 'etiquette' }] → EtiquetteQuiz.tsx 接管画面：
//         三道选择题（座位 / 两位公爵 / 年限与血缘都一样）
//         + 皇帝全称（第 4 题，纯展示，组件里自己逐字打）
//   答完写 flags.etiquetteScore（0–3），再接：
//   etiquetteAfter  她的脸很近（压迫感）+ 年龄之谜（不给答案）
//
// 口吻照 NARRATIVE_DESIGN §7：艾玛只陈述、不劝阻；主角独白一律全角括号。
// 礼仪分先埋线，第六章千面之月的宴会上才结账。
// 本区只在文件末尾追加，上面的字一个都不动。
// ============================================================

const ETIQUETTE_SCRIPTS: Record<string, Step[]> = {
  // ---- 开场：下午的餐厅（L787–L799） ----
  etiquetteClass: [
    { t: 'line', sp: 'none', text: '下午的阳光斜着切进餐厅。长桌上摊着《贵族礼仪规范》，封面压着双头鹰徽记。' },
    { t: 'line', sp: 'ftz', text: '（罗严克拉姆王朝的徽记。帝国统一之前的东西。）' },
    { t: 'line', sp: 'none', text: '艾玛站在长桌一侧，手里拿一根细长的木棍。' },
    { t: 'line', sp: 'emma', text: '不是用来打人的，少爷。是用来指着书上的图。' },
    { t: 'line', sp: 'ftz', text: '这一节不能跳过吗。在船厂吃饭，没有人管我用哪只手拿叉子。' },
    { t: 'line', sp: 'emma', text: '基尔的船厂不是祖克霍夫家的宴会厅。' },
    { t: 'line', sp: 'none', text: '她把木棍横过来，点在书页的第一幅图上。然后抬起眼睛。' },
    { t: 'line', sp: 'emma', text: '我先问。您答。' },
    { t: 'do', do: [{ quiz: 'etiquette' }] },
  ],

  // ---- 再交互：书合上了 ----
  etiquetteClass_again: [
    { t: 'line', sp: 'none', text: '礼仪书合上了，压在长桌中央。木棍搁在书脊上。' },
    { t: 'line', sp: 'emma', text: '今天的课已经上完了，少爷。' },
    { t: 'line', sp: 'ftz', text: '（她说第二节是社交礼仪。她说的时候，我看着那根木棍。）' },
  ],

  // ---- 收尾：脸很近 + 年龄之谜（L829–L845） ----
  etiquetteAfter: [
    { t: 'line', sp: 'none', text: '她把书合上，扣好铜搭扣。' },
    { t: 'line', sp: 'none', text: '然后她没有退开。' },
    { t: 'line', sp: 'ftz', text: '（她的脸很近。近到我能看清银色卷发上每一缕光泽的走向。）' },
    { t: 'line', sp: 'ftz', text: '（近到能感觉到她呼吸的温度，落在我的手背上。）' },
    { t: 'line', sp: 'none', text: '灰色的瞳孔里没有情绪。没有不耐烦，也没有温和。' },
    { t: 'line', sp: 'ftz', text: '（像一把没出鞘的刀，抵在喉咙上。刀没出鞘，可我知道它在。）' },
    { t: 'line', sp: 'ftz', text: '你到底多大。' },
    { t: 'line', sp: 'emma', text: '很久，少爷。' },
    { t: 'line', sp: 'ftz', text: '很久是多久。' },
    { t: 'line', sp: 'emma', text: '足够久。' },
    { t: 'line', sp: 'none', text: '她直起身，把木棍收回袖子里。' },
    { t: 'line', sp: 'ftz', text: '（她的皮肤没有皱纹。头发里没有一根灰白。动作里没有任何衰老的痕迹。）' },
    { t: 'line', sp: 'ftz', text: '（她看起来最多二十五岁。）' },
    { t: 'line', sp: 'ftz', text: '（——像那些画像上的人。被时间忘在某一年，再也走不动的。）' },
    { t: 'line', sp: 'emma', text: '第二节。社交礼仪。' },
    { t: 'line', sp: 'none', text: '我闭上了眼睛。' },
    { t: 'line', sp: 'ftz', text: '（见鬼。）' },
  ],
}

Object.assign(SCRIPTS, ETIQUETTE_SCRIPTS)

// ============================================================
// 追加区 6：场景 12 · 深夜书房《黑格林童话：苍蓝革新的箱庭》
// 依据 docs/_research/novel-01.md 场景 12（L893–L1041）
// ------------------------------------------------------------
// 流程：
//   readGrimm   晚饭后回到房间 → 榨干的柠檬 → 船厂 / 工头那句「你还有家族」
//               → 逐本翻书架（四句否决）→ 第五本让他停住 → 翻开
//     └ do [{ book: 'grimm' }] → GrimmBook.tsx 接管画面：十页书 + 木刻插图
//   读完后组件自己接：
//   grimmAfter  三个问题 + 「明天，我要去那座塔楼」+ 灯不吹，让它亮着
//
// 三处原句一字不动（全书最重要的符号与伦理句）：
//   「这个世界是【】创造的。」
//   「写故事的人要对故事里的人负责。」
//   「维多利亚。」
// 那段原文在书本组件里（src/ui/GrimmBook.tsx 的 PAGES），这里只写书房这一侧。
// 口吻照 NARRATIVE_DESIGN §7：主角独白全角括号；本区一个感叹号都没有。
// 本区只在文件末尾追加，上面的字一个都不动。
// ============================================================

const GRIMM_SCRIPTS: Record<string, Step[]> = {
  // ---- 开书之前：床、船厂、工头、书架上的四句否决（L893–L935） ----
  readGrimm: [
    { t: 'line', sp: 'none', text: '晚饭后我回到房间，把自己扔上床。像一块被榨干的柠檬。' },
    { t: 'line', sp: 'ftz', text: '（船厂现在应该在开工。三班的汽笛，四点二十分。）' },
    { t: 'line', sp: 'none', text: '走之前我请了一周的假。工头问什么事。我说，家族事务。' },
    { t: 'line', sp: 'none', text: '工头笑了一下，说：你还有家族。' },
    { t: 'line', sp: 'ftz', text: '（那不是「我批准了」的笑。那是「你回来的时候位子已经没了」的笑。）' },
    { t: 'line', sp: 'none', text: '窗外的太阳落进黑森林。星星亮起来。' },
    { t: 'line', sp: 'none', text: '为了把那些念头从脑子里赶出去，我开始逐本翻书架。' },
    { t: 'line', sp: 'ftz', text: '（家族史。看过了。）' },
    { t: 'line', sp: 'ftz', text: '（纹章学。不想看。）' },
    { t: 'line', sp: 'ftz', text: '（帝国贵族谱系。不想看。）' },
    { t: 'line', sp: 'ftz', text: '（巴伐利亚建筑史。不想看。）' },
    { t: 'line', sp: 'none', text: '第五本让我停住了。' },
    { t: 'line', sp: 'none', text: '烫金的标题，黑色的皮革封面。书脊上没有作者名字，没有出版社，没有任何我认得的出版标识。' },
    { t: 'line', sp: 'none', text: '《黑格林童话：苍蓝革新的箱庭》。旁边还有同系列的两本：《不可思议之国的爱丽丝》，《小红帽之森》。' },
    { t: 'line', sp: 'none', text: '纸很厚，白得不像话，更像手工做的羊皮纸，却又比羊皮纸光滑。每一页的字都不多，留白很大。' },
    { t: 'line', sp: 'none', text: '标题页下面有一行小字：威廉·斯卡里特·冯·祖克霍夫 著。' },
    { t: 'line', sp: 'ftz', text: '（祖克霍夫。）' },
    { t: 'line', sp: 'none', text: '我翻开了第一页。' },
    { t: 'do', do: [{ book: 'grimm' }] },
  ],

  // ---- 再交互：那本书已经合上了 ----
  readGrimm_again: [
    { t: 'line', sp: 'none', text: '那本书还在书架上。烫金的标题在暗处发亮。' },
    { t: 'line', sp: 'ftz', text: '（读过了。可是我还想再翻一遍。）' },
    { t: 'do', do: [{ book: 'grimm' }] },
  ],

  // ---- 合上书之后：三个问题 / 明天去塔楼 / 灯不吹（L1019–L1039） ----
  grimmAfter: [
    { t: 'line', sp: 'none', text: '我合上书。手在封面上停了一下，才放开。' },
    { t: 'line', sp: 'ftz', text: '（那个【】是什么。）' },
    { t: 'line', sp: 'ftz', text: '（威廉·斯卡里特·冯·祖克霍夫是谁。）' },
    { t: 'line', sp: 'ftz', text: '（那座时计塔里面有什么。）' },
    { t: 'line', sp: 'none', text: '我有很多问题。没有答案。至少现在没有。' },
    { t: 'line', sp: 'none', text: '我躺回床上。没有吹灭油灯，让那盏灯在我床头亮着。光晕在天花板上晃动，像一只不安分的萤火虫。' },
    { t: 'line', sp: 'ftz', text: '（明天。明天我要去那座塔楼。）' },
    { t: 'line', sp: 'none', text: '那本书还摊开在书桌上，翻到最后一页。月光照在那幅插图上。' },
    { t: 'line', sp: 'none', text: '风吹过窗帘，书页轻轻翻动了一下。' },
    { t: 'do', do: [{ flag: ['readGrimmFull', true] }] },
  ],
}

Object.assign(SCRIPTS, GRIMM_SCRIPTS)

// ============================================================
// 追加区 7：场景 4 · 法兰克福的前半生（木刻蒙太奇之后的那个早上）
// 依据 docs/_research/novel-01.md 场景 4（L250–L332）
// ------------------------------------------------------------
// 流程：
//   第一夜 lookBed 睡下 → endPrologue → 章节卡 → beginExplore()
//     └ startMontage('frankfurt')：七张木刻，31.6s
//        孤儿院门口 / 工厂车间 / 夜校阁楼 / 考场 / 放榜 / 船厂 / 回到古堡
//        Montage.tsx 播完自己调 finishMontage()（立 flags.sawFrankfurt）
//   醒来  wakeAfterMontage：他以为是梦，但手指上有干掉的墨迹 —— 这不是梦
//
// 墨迹这个细节是全段的支点：它把「前半生」从回忆钉成了经历。
// 口吻照 NARRATIVE_DESIGN §7：主角独白全角括号；本区一个感叹号都没有。
// 本区只在文件末尾追加，上面的字一个都不动。
// ============================================================

const FRANKFURT_SCRIPTS: Record<string, Step[]> = {
  wakeAfterMontage: [
    { t: 'line', sp: 'none', text: '我睁开眼。窗帘缝里已经有一线亮光，落在床脚。' },
    { t: 'line', sp: 'ftz', text: '（法兰克福。孤儿院。工厂。我梦见了一整段前半生。）' },
    { t: 'line', sp: 'none', text: '我坐起来，掀被子。手在床单上停住了。' },
    { t: 'line', sp: 'ftz', text: '（右手的食指和中指上，有一小片黑。）' },
    { t: 'line', sp: 'none', text: '我用拇指去搓。搓不开。墨已经吃进了指甲缝里。' },
    { t: 'line', sp: 'ftz', text: '（那就不是梦。我在梦里抄了一夜的书。）' },
    { t: 'do', do: [
      { flag: ['inkOnHand', true] },
      { flag: ['chapter1', true] },
      { shake: 5 },
      { sound: 'bell' },
      { chapter: { num: '第一章', name: '糖庄', quote: '「甜是生命，亦是死亡。」' } },
    ] },
  ],
}

Object.assign(SCRIPTS, FRANKFURT_SCRIPTS)