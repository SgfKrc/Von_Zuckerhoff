# calabiyau-mdl 引擎复用评估

> 参考项目：`G:\C\VUE\calabiyau-mdl`（React 18 + TypeScript + Vite，384×216 内部分辨率 Canvas 像素恐怖解谜）
> 本文所有函数名、文件名、常量、行号均取自当前工作树（HEAD）实测源码，不含推测 API。
> 统计口径：行号 = `read` 工具输出的 1-based 行号；行数 = 文件含空行总行数。
>
> **版本脉络（实测）**
>
> | 文件 | `8fe2260`（fable5，前半部分） | 当前 HEAD | 差值 |
> |---|---:|---:|---:|
> | `src/game/engine/engine.ts` | 290 | 352 | +62 |
> | `src/game/engine/input.ts` | 43 | 64 | +21 |
> | `src/game/render/renderer.ts` | 332 | 754 | +422 |
> | `src/game/store.ts` | 638 | 1229 | +591 |
> | `src/game/world/maps.ts` | 520 | 611 | +91 |
> | `src/game/data/script.ts` | 396 | 417 | +21 |
> | `src/game/data/script2.ts` | 384 | 404 | +20 |
> | `src/game/art/build.ts` | 68 | 68 | 0 |
> | `src/game/audio.ts` | 110 | 1336 | +1226 |
>
> 结论先行：**`build.ts` / `tiles.ts` / `chars.ts` / `props.ts` / `engine.ts` / `renderer.ts` 的骨架在 fable5 版本就已定型**（美术管线 0 改动，engine 仅 +62 行且是增量的传送/UI 互斥补丁），后续扩张集中在 `store.ts`、`audio.ts`、`renderer.ts` 的战斗/列车/二周目分支。这正是"骨架可复用、数据不可复用"的技术依据。

---

## 1. 技术栈与工程结构

### 1.1 真实依赖（`package.json:29-45`）

运行时依赖只有两个：

```json
"dependencies": {
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
}
```

开发依赖：

| 包 | 版本 | 用途 |
|---|---|---|
| `typescript` | ^5.6.3 | `tsc -b` 类型检查（`noEmit: true`，只检查不产出） |
| `vite` | ^5.4.11 | 构建与服务 |
| `@vitejs/plugin-react` | ^4.3.4 | JSX/Fast Refresh |
| `@types/react` / `@types/react-dom` | ^18.3.12 / ^18.3.1 | 类型 |
| `@types/node` | ^26.1.1 | 构建脚本与 electron 侧 |
| `electron` | ^43.2.0 | 桌面壳（可选，见 §12） |
| `electron-builder` | ^26.15.3 | 桌面打包 |
| `esbuild` | 0.21.5 | `scripts/export-bgm.mjs` 的离线 BGM 渲染 |
| `concurrently` / `wait-on` | ^10.0.4 / ^9.1.0 | `electron:dev` 编排 |

**没有** zustand、redux、pixi、phaser、howler、tailwind、styled-components —— 状态库与音频库都是手写的（`tinyStore.ts` 45 行、`audio.ts` 纯 WebAudio 合成）。这是复用价值最高的一点：依赖面极窄，无版本迁移债。

### 1.2 构建脚本（`package.json:8-28`）

| 脚本 | 实际命令 | 产物 |
|---|---|---|
| `dev` | `node scripts/dev-launcher.mjs` | 交互式选择 first / sequel / both 后 spawn vite（`scripts/dev-launcher.mjs:1-60`） |
| `dev:first` / `dev:sequel` / `dev:both` | 同上，带参数 | — |
| `dev:bgm` | `vite --host 127.0.0.1 --open /bgm.html` | BGM 编辑器（独立调试页） |
| `build` | `tsc -b && vite build` | `dist/`：三入口 `index.html` / `sequel.html` / `bgm.html` + `assets/` |
| `web:single` | `tsc -b && vite build --mode single-html && node scripts/package-single-html.mjs` | `release/Calabiyau MDL <version> 单文件网页版.html` |
| `web:sequel` | `... --mode single-html-sequel && node scripts/package-single-html.mjs sequel` | `release/sequel.html` |
| `electron:build` | `tsc -p tsconfig.electron.json` | `dist-electron/` |
| `electron:package` | `build:desktop && node scripts/package-electron.mjs` | electron-builder portable exe |
| `check:audio` / `check:narrative` / `check:achievements` / `check:ngplus` / `check:finale` | `node scripts/check-sequel-*.mjs` | 纯 Node 断言脚本，无测试框架 |
| `export:bgm` | `node scripts/export-bgm.mjs` | 把合成曲渲染成 wav（离线素材导出，不进运行时） |

注意 `build` 里是 `tsc -b` 而非 `tsc --noEmit`：`tsconfig.json` 开了 `noEmit: true`（`tsconfig.json:12`），所以 `-b` 只做类型检查，实际编译由 Vite/esbuild 完成。

### 1.3 入口链路

```
index.html  →  /src/main.tsx   →  initInput() + useGame.hydratePersistence() + <App/>
sequel.html →  /src/sequel/main.tsx  （第二部，独立引擎，见 §10 附注）
bgm.html    →  /src/bgm/main.tsx     （BGM 编辑器，独立页）
```

`index.html` 是 12 行的极简壳，只有 `<div id="root">` 和 `<script type="module" src="/src/main.tsx">`。

`src/main.tsx`（15 行）做了三件事：

```ts
initInput()                                    // main.tsx:8  注册键盘监听
void useGame.getState().hydratePersistence()   // main.tsx:9  从 localStorage 读档索引
ReactDOM.createRoot(...).render(<React.StrictMode><App /></React.StrictMode>)  // main.tsx:11-15
```

**StrictMode 双挂载**是这套引擎必须处理的现实约束，`engine.ts` 的 `engineGeneration` 计数因此存在（见 §2.4）。

`App.tsx`（114 行）是唯一的布局根：一个 `.stage` 居中容器 → 一个固定 `VIEW_W*scale × VIEW_H*scale` 的 `.viewport` → `<GameCanvas>` + 若干条件渲染的 React 覆盖层。

### 1.4 目录结构（`src/`，实测文件与字节数）

```
src/
├─ main.tsx 378        App.tsx 4046        styles.css 24130
├─ game/
│  ├─ engine/engine.ts 10607   input.ts 1882
│  ├─ render/renderer.ts 26598
│  ├─ store.ts 45911     tinyStore.ts 1238   types.ts 6627   bridge.ts 407
│  ├─ audio.ts 51865
│  ├─ art/  build.ts 2160  tiles.ts 8107  chars.ts 7913  props.ts 12340
│  │        portraits.ts 51150  boss.ts 2680  case2.ts 18778  train.ts 5306
│  ├─ data/ script.ts 21402  script2.ts 24471  script3.ts 20751  script45.ts 34266
│  │        clues.ts 11643  deduction.ts 10711  endings.ts 10106  enemies.ts 6320
│  │        chapters.ts 1902  achievements.ts 3770  paperFragments.ts 9600
│  │        hiddenEnding.ts 3187
│  └─ world/ maps.ts 29148   events.ts 10537
├─ ui/  Achievements 2659  BattleUI 2217  DeductionBoard 3078  DialogBox 3795
│      EndingScreen 4774  EvidenceBook 4768  GameCanvas 524  HUD 4529
│      PixelView 707  RichText 636  SaveScreen 6721  Screens 6090  Toasts 303
├─ platform/  localBackend.ts 6622  localBackendContract.ts 1759
├─ bgm/       BgmEditor.tsx 34137  arrangement.ts 6250  assets.ts 5433
└─ sequel/    engine.ts 305754  App.tsx 49018  store.ts 47596  …（第二部，独立引擎）
```

**跨版本耦合警告**：`src/game/art/portraits.ts:2` 有 `import { MADDELENA_PORTRAITS } from '../../sequel/art/maddelena'`，而 `portraits.ts:894-895` 把 `PORTRAITS.mdl` / `PORTRAITS.mdlWorry` 直接指向第二部的立绘。**主引擎并非完全自包含**——迁移时必须把这两行换回第一部的本地 `mdl` / `mdlWorry` 常量（它们仍然存在于同文件 `portraits.ts:18` 与 `:70`），或一并搬走 `sequel/art/maddelena.ts`。

### 1.5 打包产物形态（实测）

| 产物 | 路径 | 大小 |
|---|---|---|
| Web 多入口 | `dist/index.html` + `dist/assets/main-*.js`（345,110 B）+ `main-*.css`（20,332 B）+ `client-*.js`（142,535 B）+ `PixelView-*.js`（12,581 B） | 合计约 520 KB |
| 单文件 HTML | `release/Calabiyau MDL 0.1.0 单文件网页版.html` | **520,934 B（509 KiB）** |
| Electron portable | `release/Calabiyau MDL 0.1.0 绿色免安装版.exe` | 90,091,699 B |
| Inno Setup 安装包 | `release/Calabiyau MDL 0.1.0 Inno6 Setup.exe` | 103,492,789 B |

`dist/` 里那些 `.wav`（`title-*.wav`、`battle-*.wav` 等，单文件最大 29.5 MB）**不是运行时资源**，是 `scripts/export-bgm.mjs` 用 esbuild + Node 离线渲染 `TRACKS` 得到的副产品。游戏运行时一个音频文件都不加载——全部 WebAudio 实时合成。这直接决定了单文件 HTML 只有 520 KB 而不是几十 MB（见 §12）。

`electron-builder.yml` 关键项：`appId: com.calabiyau.mdl`、`asar: true`、`win.target: portable`（单 arch x64）、`files: dist/**/* + dist-electron/**/* + package.json`。

---

## 2. 渲染管线

### 2.1 内部分辨率与缩放

| 参数 | 值 | 出处 |
|---|---:|---|
| 内部分辨率 | `VIEW_W = 384`、`VIEW_H = 216` | `engine.ts:12-13` |
| 瓦片尺寸 | `TILE = 16` | `build.ts:2` |
| 视口格数 | 24 × 13.5 格 | `maps.ts:4` 注释；384/16=24、216/16=13.5 |
| 渲染缩放 | 整数倍，`Math.max(1, Math.min(5, Math.floor(min(innerWidth/384, innerHeight/216))))` | `App.tsx:20-24` |
| 缩放实现 | canvas 的 `width/height` 固定 384×216，**CSS 尺寸**拉伸到 `384*scale × 216*scale` | `GameCanvas.tsx:16-18` |
| 像素放大 | `image-rendering: pixelated` + `crisp-edges` | `styles.css:33,38-39,287` |

关键设计：**不缩放 Canvas backing store，只缩放 CSS 盒**。这样 GPU 放大纹理，CPU 每帧只画 82,944 像素，且天然最近邻。`scale` 上限写死 5（1920×1080 恰好是 5 倍）。

`GameCanvas` 只有 21 行：`useEffect` 里 `startEngine(ref.current)`，清理时 `stopEngine()`。

### 2.2 分层与每帧绘制顺序

`drawScene(ctx)`（`renderer.ts:84-242`）是唯一的场景绘制入口，**固定 14 段顺序**，无中间 FBO、无 WebGL、纯 Canvas2D：

| # | 图层 | 代码 | 备注 |
|---:|---|---|---|
| 0 | 清屏 | `renderer.ts:86-88` | `imageSmoothingEnabled=false`；`fillRect` 底色 `#05060b` |
| 1 | 模式分支 | `renderer.ts:90-96` | `battle` → `drawBattle` 后 return；非 explore/chapter/ending → 标题背景后 return |
| 2 | 抖动偏移 | `renderer.ts:98-101` | `shakeX = (rand-0.5)*min(8,shakeT)`、`shakeY = ...*min(6,shakeT)`，相机取整 |
| 3 | 瓦片 | `renderer.ts:103-115` | **视锥剔除**：只遍历 `[x0..x1] × [y0..y1]` |
| 4 | 列车专属外壳 | `renderer.ts:117-120` | `map.id === 'train'` 时 `drawTrainCarriageShell` + `drawTrainWindows` |
| 5 | 实体 + 玩家 | `renderer.ts:122-148` | 按 `drawDepth` 排序，玩家作为 `null` 插入 `drawOrder` |
| 6 | 黑暗层 | `renderer.ts:150-167` | 独立 384×216 缓存 canvas：`source-over` 填半透明黑 → `destination-out` 打光洞 → 整体 `drawImage` 叠加 |
| 7 | 灯暖光 | `renderer.ts:169-183` | `globalCompositeOperation='lighter'` + 径向渐变闪烁 |
| 8 | 雾 | `renderer.ts:185-199` | 仅 `map.ambient !== 'indoor'`；每个粒子一个径向渐变 |
| 9 | 彩绘之眼滤镜 | `renderer.ts:201-226` | `multiply` 玫红色罩 → `lighter` 线索光晕 → 脉动暗角 → `visionAnomalyFx` |
| 10 | 常规暗角 | `renderer.ts:225` | 非 vision 时 `vignette(ctx, 0.42)` |
| 11 | 交互提示 | `renderer.ts:228-238` | 9×9 黑底 + `7px monospace` 的橙色 "E"，y 方向 `sin(t/12)*2` 浮动 |
| 12 | 低理智扭曲 | `renderer.ts:240-242` | `sanityFx(ctx, g.san)` |

**深度排序（`renderer.ts:28-35`）**：

```ts
function drawDepth(entity: EntityDef | null): number {
  if (!entity) return world.py + 4                      // 玩家：脚底 y
  return entity.sprite === 'painting' || entity.sprite === 'graffiti'
    ? -999                                              // 挂墙物永远最底层
    : entity.y * TILE + TILE                            // 实体：格底边
}
```

`drawOrder` 是模块级复用数组（`renderer.ts:23`），每帧 `length = 0` 后重填，避免 GC。

**实体绘制细节（`renderer.ts:129-147`）**：
- `const spr = SPRITES[e.sprite]` —— 名字不在注册表里会得到 `undefined`，`ctx.drawImage(undefined)` 直接抛 TypeError（没有兜底）。
- `e.tall` 时按 `sy - (spr.height - TILE)` 向上对齐底部（`renderer.ts:136`）。
- `BOBBING_SPRITES` 集合（`renderer.ts:26`，7 个 NPC 名）以 `Math.floor(world.t / 40) % 2` 做 1px 呼吸起伏。
- `visionOnly` 实体额外加 `shadowColor='#c22f2f'` + `shadowBlur=6` + 透明度脉动（`renderer.ts:138-144`）。

### 2.3 光照 / 雾 / SAN 扭曲 / 滤镜的数值

**黑暗层（`renderer.ts:150-167`）**

```ts
const darkness = (map.dark ?? 0.3) + (g.vision ? 0.18 : 0)   // renderer.ts:155
dctx.fillStyle = `rgba(4,6,16,${darkness})`                   // renderer.ts:156
dctx.globalCompositeOperation = 'destination-out'             // renderer.ts:158
```

打光洞的点（`renderer.ts:160-166`，参数为 `punchLight(ctx, x, y, r, alpha)`）：

| 光源 | 半径 | alpha | 锚点 |
|---|---:|---:|---|
| `sprite === 'lamp'` | 52 | 0.95 | `(x*16+8, y*16-10)` |
| `sprite === 'fireplace'` | 46 | 0.85 | `(x*16+16, y*16+8)` |
| `sprite === 'easel'` | 26 | 0.5 | `(x*16+8, y*16)` |
| `train` 地图的 `trainWindow` | 42 | 0.52 | `((x+3)*16, 23)` |
| 玩家 | 40 | 0.6 | `(px, py-8)` |

**注意：只有这 5 种识别分支**。新增光源精灵必须改 `renderer.ts:160-166`，没有数据驱动的 `lightRadius` 字段。

灯暖光叠加（`renderer.ts:172-182`）：半径 44 的径向渐变，中心色 `rgba(232,148,42, 0.16 + flick)`，`flick = 0.05 + |sin(t/13 + x)| * 0.05`（每盏灯相位按 x 错开）。

**雾（`renderer.ts:186-199`）**：颜色固定 `rgba(120,132,160,α)`，vision 开启时 α 减半；粒子在 `seedFog()`（`engine.ts:44-56`）里初始化，室内 5 个、室外 16 个，`spd: 0.08~0.33`、`a: 0.05~0.17`、`r: 24~70`；每帧只做 `f.x += f.spd` 的水平漂移 + 出界回绕（`engine.ts:335-339`）。

**彩绘之眼滤镜（`renderer.ts:201-226`）**：`multiply` 铺 `rgba(140,60,80,0.55)`，然后 `lighter` 给每个 `visionOnly || aura` 实体画半径 `18 + sin(t/8)*4` 的红色光晕。

**SAN 扭曲（`renderer.ts:261-284`）**：`san >= 60` 完全不生效；`san < 60` 时按 `level=(60-san)/60` 概率触发"随机行错位"（把当前 canvas 快照到 `visionFxCanvas`，再按 `(x,y,w,h,offset)` 切片贴回）；`san < 35` 追加红色脉动暗角。

**vision 异常（`renderer.ts:286-361`）**：`age < 75` 帧不生效，`energy = min(1, clarity*0.62 + madness*0.78)`，驱动三条并行效果：水平扫描带错位、`screen` 混合的残影、以及边缘的残缺同心环/放射线（`ctx.ellipse` + `setLineDash`）。

### 2.4 性能要点

1. **四个模块级缓存 canvas**（`renderer.ts:18-21`）：`darkCanvas`、`visionFxCanvas`、`vignetteCanvas`、`sanityVignetteCanvas`，尺寸恒为 384×216，首次使用时创建，之后复用。`getVignetteMask(red)`（`renderer.ts:54-72`）把暗角遮罩烘成一张渐变图，每帧只 `drawImage` + 改 `globalAlpha`。
2. **复用数组**：`renderEntities`（`renderer.ts:22`）、`drawOrder`（`:23`）、`trainWindows`（`:24`）通过参数传入 `visibleEntities(target)` 避免分配（`engine.ts:155-165` 的签名 `visibleEntities(target: EntityDef[] = [])`）。
3. **视锥剔除**只作用于瓦片层，实体始终全量遍历（地图实体数 20~40，可接受）。
4. **`imageSmoothingEnabled = false`** 每帧重设（`renderer.ts:86`），因为 `ctx.save/restore` 与 canvas 重取上下文可能重置它。
5. **`renderer.ts:695` 的 `const t = world.t++`**：`drawBattle` 里自增世界时间。`tick()` 在 `engine.ts:224` 已经 `world.t++`，而 battle 模式下 `tick()` 在 `engine.ts:249` 提前 return —— 所以战斗期间 `world.t` 每帧 **+2**。这是渲染污染逻辑状态的实例，迁移时建议改成只读。
6. **每帧渐变分配量**：室外 16 个雾 + 每盏灯 2 个（`punchLight` 1 + 暖光 1）+ 玩家 1 个 + 线索光晕若干。384×216 下这是主要 CPU 成本，但实测在 60fps 预算内。
7. **`visibleEntities()` 无参调用会分配新数组**：函数默认参数是 `[]`，`entitySolidAt`（`engine.ts:132`）与 `findInteract`（`engine.ts:177`）都不传 target。`blocked()`（4 个采样点）每帧被调用 2 次 + `stuck()` 2 次 = 约 8~10 次 `visibleEntities()` 分配 × 每次全量实体遍历。**这是当前最明显的、可无损优化掉的每帧开销**（改成模块级 scratch 数组即可）。

---

## 3. 世界与地图系统

### 3.1 数据格式

`GameMap`（`types.ts:119-127`）：

```ts
export interface GameMap {
  id: MapId
  name: string
  tiles: string[]        // 字符网格
  entities: EntityDef[]
  portals: Portal[]
  ambient: 'indoor' | 'fog' | 'alley'
  dark?: number          // 0~1 基础黑暗度
}
```

- **`tiles` 是字符串数组**，每字符一瓦片，`TILES: Record<string, HTMLCanvasElement>`（`tiles.ts:247-261`）做字符→离屏 canvas 的查表。
- 字符图例（`tiles.ts:4-5,267-268`）：`#`砖墙 `^`墙檐 `.`/`,`/`;` 三种鹅卵石 `=`木地板 `-`木墙板 `W`亮窗 `w`暗窗 `x`虚空 `B`吧台 `r`地毯 `D`门 `y`后院泥地 `f`木栅栏 `S`停尸间石地 `M`瓷砖墙。
- **`MapId` 是硬编码联合**（`types.ts:91-95`，14 个值），**`MAPS` 是硬编码对象**（`maps.ts:608-611`），**`store.ts:25-28` 还有第三份 `MAP_IDS` 白名单**用于存档校验。新增地图要改三处。

`EntityDef`（`types.ts:97-110`）：

```ts
export interface EntityDef {
  id: string
  x: number            // 瓦片坐标
  y: number
  sprite: string       // sprites 注册名
  solid?: boolean
  visionOnly?: boolean // 仅彩绘之眼可见
  aura?: boolean       // 彩绘之眼下显示线索光晕
  hideFlag?: string    // 该 flag 为真时隐藏
  showFlag?: string    // 该 flag 为真时才显示
  interact?: string    // events.ts 中的处理器 id
  face?: Dir
  tall?: boolean       // 高于一格,底部对齐
}
```

`Portal`（`types.ts:112-117`）：

```ts
export interface Portal {
  x: number; y: number                 // 触发格（玩家脚底中心所在格）
  to: MapId; tx: number; ty: number; dir: Dir
  lockFlag?: string                    // flag 为真才可通行
  lockMsg?: string
}
```

### 3.2 瓦片尺寸与地图最小尺寸

`TILE = 16`（`build.ts:2`）。`maps.ts:4` 的原注释：**"视口为 384x216 (24x13.5 格)，因此每张图至少 26x14 格"**。实测所有 14 张图每行等宽且 ≥ 26 列，行数 ≥ 14。小于视口的图会被相机居中而不是裁切（`engine.ts:65-66` 的 `mw <= VIEW_W ? (mw - VIEW_W) / 2 : ...`）。

### 3.3 碰撞与交互判定

**碰撞（`engine.ts:109-153`）**

```ts
function solidAt(x, y): boolean {           // 像素坐标 → 瓦片查表
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE)
  const row = world.map.tiles[ty]
  if (!row) return true                      // 越界 = 实心
  const ch = row[tx]
  if (ch === undefined) return true           // 行不齐 = 实心（隐形墙）
  if (SOLID_TILES.has(ch)) return true
  return false
}
```

- `SOLID_TILES`（`tiles.ts:263` + `:353-354`）= `{#, ^, -, W, w, x, B, f, M}` 共 9 个。
- 实体碰撞（`engine.ts:131-139`）：只对 `e.solid` 的实体，盒为 `[ex+1, ex+w-1) × [ey+2, ey+TILE)`；宽精灵宽度由 `WIDE` 表 + `entTileW(sprite)`（`engine.ts:121-129`）决定，目前登记了 **18 个** sprite 名（`painting`/`bed`/`fireplace`/`corpse`/`graffiti`/`cart`/`slab`/`sheeted`/`steps`/`sigilProp`/`ponyCart`/`chalkText`/`galleryFrame`/`trainWindow`/`trainBench`/`trainVestibule`/`trainDoor`/`stationSign`）。
- **玩家碰撞盒 10×6**（`engine.ts:141-148`）：以 `(px - 5, py - 3)`、`(px + 5, py - 3)`、`(px - 5, py + 2)`、`(px + 5, py + 2)` 四点采样，任一点实心即阻挡。
- **脱困安全阀**（`engine.ts:151-153` + `:303`）：`stuck()` 检测当前脚底是否已在实心内；若已卡住，则本帧忽略碰撞（`const free = stuck()` → `if (dx && (free || !blocked(...)))`），允许玩家自行走出。
- 移动：`speed = 1.35` px/帧，斜向乘 `0.707`（`engine.ts:294-296`）。

**交互判定（`engine.ts:168-188`）**

```ts
const reach = 18
// dir 决定朝向偏移：up 时 fy -= 18，down 时 fy += 18，left/right 同理
for (const e of visibleEntities()) {
  if (!e.interact) continue
  const w = entTileW(e.sprite)
  const cx = e.x * TILE + (w * TILE) / 2       // 精灵水平中心
  const cy = e.y * TILE + TILE / 2             // 格子垂直中心
  const d1 = Math.hypot(cx - fx, cy - fy)      // 到"朝向探测点"的距离
  const d2 = Math.hypot(cx - world.px, cy - world.py)  // 到玩家本体
  const d = Math.min(d1, d2 * 2.2)             // 近身时放宽
  if (d < 22 && (!best || d < best.d)) best = { ent: e, sx: cx, sy: e.y * TILE, d }
}
```

设计要点：**不是 AABB 重叠检测，而是"朝向探测点 + 距离阈值 22px + 近身惩罚系数 2.2"的三重加权**。这允许玩家站在实体侧面而不是严格面对时也能交互，同时保证多个可交互物重叠时取最近。返回的 `sx/sy` 用于画 "E" 提示（`renderer.ts:230-237`）。

`visibleEntities()`（`engine.ts:155-165`）是唯一可见性过滤点：`hideFlag` 为真则隐藏、`showFlag` 不真则隐藏、`visionOnly` 需 `g.vision`。

### 3.4 传送与相机

**传送门（`engine.ts:309-329`）**

```ts
if (portalCooldown === 0) {
  const tx = Math.floor(world.px / TILE)
  const ty = Math.floor((world.py + 2) / TILE)     // +2 让判定落在脚下而非腰上
  for (const p of world.map.portals) {
    if (p.x === tx && p.y === ty) {
      if (p.lockFlag && ... ) { pushBack(); if (p.lockMsg) g.addToast(p.lockMsg, 'warn'); break }
      bridge.teleport(p.to, p.tx, p.ty, p.dir)
      break
    }
  }
}
```

- **锁定 = 弹回 4px**（`pushBack()`，`engine.ts:347-352`）+ warn toast，不是阻止移动。
- `lockFlag === 'neverOpen'` 是特例：永远锁死（`engine.ts:314,320`），用于"序章时卧室门打不开"这类剧情。
- **`portalCooldown = 18` 帧**（`engine.ts:99`）：落地后 18 帧内不检测传送门，防止目标点的出口格在按键未松开时立刻把玩家弹回去。

**`bridge.teleport`（`engine.ts:91-105`）** 是全套重置序列：

```ts
const token = ++teleportToken          // 用于让排队中的入场脚本失效
world.map = MAPS[map]
world.px = x * TILE + 8                // 注意 +8 / +12 的锚点偏移
world.py = y * TILE + 12
if (dir) world.dir = dir
world.moving = false
world.interactTarget = null
portalCooldown = 18
Input.flush()                          // 清掉本次触发用的按键
seedFog()
syncCamera()
queueMapEntry(map, token)              // 延迟触发 onEnterMap
```

**`queueMapEntry`（`engine.ts:69-83`）** 是一个自轮询的延时器：每 50ms 检查 `mode === 'explore' && !dialog && !battle && !evidenceOpen && !deductionOpen && !menuOpen && !saveScreenOpen`，直到所有覆盖层关闭才调 `onEnterMap(map)`。**这是为了不让"章节卡→传送→入场剧本"三者互相覆盖**——一个很实际的坑，详见 §10。

**相机（`engine.ts:62-67`）**

```ts
world.camX = mw <= VIEW_W ? (mw - VIEW_W) / 2 : Math.max(0, Math.min(mw - VIEW_W, world.px - VIEW_W / 2))
world.camY = mh <= VIEW_H ? (mh - VIEW_H) / 2 : Math.max(0, Math.min(mh - VIEW_H, world.py - VIEW_H / 2))
```

即"玩家居中 + 边界钳制 + 小于视口时居中（负值，产生黑边内缩）"。**没有平滑跟随、没有前瞻（look-ahead）**，纯瞬时跟随，靠 `Math.round` 在渲染时对齐像素（`renderer.ts:100-101`）。

`bridge.shake(frames)` 只写 `world.shakeT`，由 `tick()` 每帧递减（`engine.ts:225`），渲染时读取（`renderer.ts:98`）。

### 3.5 可直接照抄的地图定义样例

> 依赖：`TILES` 里已有的字符、`PROPS`/`CHARS` 里已有的 sprite 名、`events.ts` 里已有的 `interact` id 或自行新增 case。
> 行宽必须全部等于 26 字符，行数 ≥ 14。以下每行已核对宽度。

```ts
// src/game/world/maps.ts
import { GameMap } from '../types'

const workshop: GameMap = {
  id: 'workshop',
  name: '钟表匠的工作间',
  ambient: 'indoor',
  dark: 0.28,
  tiles: [
    '--------------------------',   // 26
    '--------------------------',   // 26
    '-========================-',   // 1 + 24 + 1 = 26
    '-========================-',   // 26
    '-=====rrrrrrrrrrrr=======-',   // 1+5+12+7+1 = 26
    '-========================-',   // 26
    '-========================-',   // 26
    '-========================-',   // 26
    '-========================-',   // 26
    '-========================-',   // 26
    '-========================-',   // 26
    '-========================-',   // 26
    '-========================-',   // 26
    '-------------D------------',   // 13 + 1 + 12 = 26
    '--------------------------',   // 26
  ],
  entities: [
    // 可交互道具：solid+interact，interact 必须能在 events.ts 的 switch 里命中
    { id: 'wBench', x: 4, y: 6, sprite: 'table', solid: true, interact: 'wBench' },
    // 存档点：复用已有的 'easelSave' 处理器
    { id: 'wEasel', x: 20, y: 4, sprite: 'easel', solid: true, interact: 'easelSave', tall: true },
    // 光源：sprite 名必须是 renderer.ts:160-164 识别的那 4 种之一
    { id: 'wLamp1', x: 8, y: 3, sprite: 'lamp', solid: true, tall: true },
    { id: 'wLamp2', x: 17, y: 3, sprite: 'lamp', solid: true, tall: true },
    // 纯装饰遮挡
    { id: 'wCrate', x: 3, y: 10, sprite: 'crate', solid: true },
    { id: 'wBarrel', x: 22, y: 10, sprite: 'barrel', solid: true },
    // 仅彩绘之眼可见 + 光晕
    { id: 'wMark', x: 22, y: 2, sprite: 'graffiti', visionOnly: true, aura: true, interact: 'wMark', tall: true },
    // flag 驱动的显隐：读过之后消失
    { id: 'wLetter', x: 12, y: 6, sprite: 'letterProp', interact: 'wLetter', hideFlag: 'wLetterRead' },
  ],
  portals: [
    // 触发格 (13,13) 正是 'D' 所在格；'D' 不在 SOLID_TILES 里，所以可以站上去
    { x: 13, y: 13, to: 'street', tx: 4, ty: 5, dir: 'down' },
    // 带锁的侧门：flag wSideOpen 为真才可通行，否则弹回 + 提示
    { x: 0, y: 6, to: 'street', tx: 28, ty: 6, dir: 'left', lockFlag: 'wSideOpen', lockMsg: '门从另一侧上了锁。' },
  ],
}

// 3) 注册（maps.ts:608-611 风格的合并对象）
export const MAPS: Record<string, GameMap> = {
  atelier, street, tavern, alley, hanbury, yard, morgue,
  berner, mitre, goulston, millers, train, terminus, gallery,
  workshop,                       // ← 新增
}
```

配套的三处必改（漏一处就静默失败）：

1. `types.ts:91-95` 的 `MapId` 联合加 `| 'workshop'`；
2. `store.ts:25-28` 的 `MAP_IDS` 加 `'workshop'`（否则存档校验 `parseSaveData` 会拒绝该地图的存档）；
3. `events.ts:45-199` 的 `handleInteract` 里加 `case 'wBench': run('wBenchLook'); break` 等（否则 `console.warn('no interact handler:', id)`，见 `events.ts:197`）。

---

## 4. 对话与剧本解释器

### 4.1 数据结构

`Step` 只有 3 种（`types.ts:65-69`）：

```ts
export type Step =
  | { t: 'line'; sp?: SpeakerId; text: string }
  | { t: 'choice'; opts: DialogChoice[] }
  | { t: 'do'; do: Effect[] }
```

`DialogChoice`（`types.ts:59-63`）：

```ts
export interface DialogChoice {
  text: string
  do?: Effect[]
  next?: string          // 跳转到另一个 script id
}
```

`Effect`（`types.ts:72-89`）是**唯一的副作用指令集，共 16 个字段**：

| 字段 | 类型 | 真实行为 | 落点 |
|---|---|---|---|
| `san` | `number` | `changeSan(d)`，归零触发坏结局 | `store.ts:594` |
| `hp` | `number` | `changeHp(d)`，归零触发坏结局 | `store.ts:595` |
| `pigment` | `number` | 钳制到 `[0, maxPigment]` | `store.ts:596` |
| `clue` | `ClueId` | `addClue()`：去重、解锁成就、检查"线索齐了" | `store.ts:598` → `:1083` |
| `item` | `[ItemId, number]` | 加道具数量 | `store.ts:597` |
| `flag` | `[string, boolean\|number]` | 写 `flags[k]`；**3 个保留关键字见下** | `store.ts:599-632` |
| `next` | `string` | 跳到另一个 script，**并 return（中断后续 effect）** | `store.ts:641` |
| `teleport` | `{map,x,y,dir?}` | `bridge.teleport(...)` | `store.ts:636` |
| `battle` | `string` | 关对话 + `startBattle(enemyId)` | `store.ts:638` |
| `toast` | `string` | `addToast(text, toastKind ?? 'info')` | `store.ts:633` |
| `toastKind` | `'info'\|'san'\|'warn'` | 与 `toast` 配对使用 | `store.ts:633` |
| `shake` | `number` | `bridge.shake(frames)` | `store.ts:635` |
| `chapter` | `{num,name,quote}` | `mode='chapter'` + 清空对话 | `store.ts:637` |
| `sound` | `string` | `sfx(name)`，名字须在 `SFX` 表里 | `store.ts:634` |
| `openDeduction` | `CaseId` | 关对话 + 打开推理面板 | `store.ts:640` |
| `ending` | `EndingId \| 'auto'` | `triggerEnding(id)`，**并 return** | `store.ts:639` |

**`flag` 的 3 个伪 flag 关键字**（`store.ts:600-626`）——它们不是真 flag，而是把"动作"塞进 flag 通道：

| 关键字 | 真实效果 |
|---|---|
| `['doSave', 1]` | `openSaveScreen(true)` 后 **`return`（中断整条 effect 链）** |
| `['useSavePointSupplies', 1]` | 恢复 `san +10` 与颜料补满，`continue`（不中断） |
| `['caseNo', n]` | 推进章节号：结算上一案成就（`case_N` / `flawless` / `clear_head`）、回满 HP、`san +30`、颜料补满、重置 `dedMistakes` |

### 4.2 状态机如何运转

`SCRIPT` 的注册方式（`events.ts:43`）：

```ts
Object.assign(SCRIPTS, EXTRA, SCRIPTS2, SCRIPTS3, SCRIPTS45, PAPER_SCRIPTS)
```

4 个剧本文件全部是 `export const SCRIPTS: Record<string, Step[]>` 的**平铺命名空间**，靠 `Object.assign` 合并到同一个 `SCRIPTS` 对象。**没有命名空间隔离，重名静默覆盖**。

**执行器 `settle()`（`store.ts:1061-1081`）** 是整个解释器的核心，只有 21 行：

```ts
function settle(set: SetFn, get: () => GameStore) {
  for (let guard = 0; guard < 60; guard++) {
    const d = get().dialog
    if (!d) return
    const step = d.steps[d.i]
    if (!step) {                                  // 剧本结束
      set({ dialog: null })
      const pending = get().pendingScript         // 交棒给挂起剧本
      if (pending) { set({ pendingScript: null }); get().startScript(pending) }
      return
    }
    if (step.t === 'line' || step.t === 'choice') return   // 停下来等玩家
    set({ dialog: { ...d, i: d.i + 1 } })          // do 步骤：前移
    get().applyEffects(step.do)                    // 执行副作用
    const after = get().dialog
    if (!after || after.scriptId !== d.scriptId) return    // 剧本被换掉就交棒
  }
}
```

要点：
- `line` / `choice` 是**阻塞点**，`do` 是**同步穿透**。所以"连发 5 条 do"在一次 `settle()` 调用里全部跑完。
- `guard < 60` 是死循环保护（最多连续穿透 60 个 do 步骤）。
- 副作用把对话改掉（`next` / `battle` / `ending` / `openDeduction`）时，通过 `after.scriptId !== d.scriptId` 检测并退出，避免在已失效的 `d` 上继续推进。
- `pendingScript` 是"插队"机制：`addClue()`（`store.ts:1097-1099`）在线索集齐时设 `pendingScript = 'cluesReady'`，等当前对话自然结束后由 `settle()` 自动接上。

**推进 API**：
- `advance()`（`store.ts:567-575`）：`t === 'choice'` 时直接 return（选项必须点选），否则 `i+1` + `settle`。
- `choose(idx)`（`store.ts:577-589`）：先 `i+1`，再 `applyEffects(opt.do)`，若 `opt.next` 则 `startScript(next)` **并 return（不再 settle 原剧本）**，否则在"剧本没被换掉"的前提下 `settle`。

### 4.3 触发链路

```
玩家按 E → engine.tick() 的 findInteract() → handleInteract(ent.interact)
         ↓
events.ts:45-199 的 switch，根据 flags 选择具体 script id
         ↓
g.startScript(id) → set({ dialog: { steps, i: 0, scriptId } }) → settle()
```

`handleInteract` 里大量使用"flag 三元选择"的惯用法（`events.ts:69-73`）：

```ts
case 'guardTalk':
  if (!F.caseOpen) run('guardFirst')
  else if (!F.guardDone) run('guardTalk')
  else run('guardAfter')
  break
```

`onEnterMap(mapId)`（`events.ts:202-225`）是入场剧本，用 `once(flag, script)` 闭包保证只触发一次：

```ts
const once = (flag: string, script: string) => {
  if (F[flag]) return
  g.setFlag(flag, true)
  g.startScript(script)
}
if (mapId === 'atelier' && !F.introStarted) g.startScript('intro')
else if (mapId === 'street') once('streetSeen', 'streetArrive')
// …每个地图一条
```

### 4.4 可直接照抄的剧本节点样例

```ts
// src/game/data/script.ts（或任意 SCRIPTS 合并模块）
import { Step } from '../types'

export const SCRIPTS: Record<string, Step[]> = {
  // ① 最小对话：plain line + 说话人
  wBenchLook: [
    { t: 'line', sp: 'none', text: '工作台上摆着一排拆开的齿轮,按大小排得整整齐齐。' },
    { t: 'line', sp: 'mdl', text: '(他连拆零件都要排出**构图**。)' },   // **…** 会被 RichText 渲染成 <span class="rich-em">
  ],

  // ② 选项分支：do 做副作用，next 跳另一个 script
  wLetter: [
    { t: 'line', sp: 'mdl', text: '一封没有封口的信。' },
    {
      t: 'choice',
      opts: [
        {
          text: '抽出信纸读完',
          do: [
            { clue: 'letter' },                                  // → addClue：解锁成就 + 检查线索齐否
            { flag: ['wLetterRead', true] },                     // → 让 wLetter 实体因 hideFlag 消失
            { san: -4, toastKind: 'san', toast: '理智 -4' },      // 同一 Effect 里可叠加数值
            { sound: 'clue' },                                   // SFX 表里的名字
            { toast: '获得证物:委托人的密码信' },
          ],
          next: 'wLetterRead',                                   // 跳转，原剧本的后续步骤不再执行
        },
        { text: '原样放回', do: [], next: 'wLetterBack' },
      ],
    },
  ],

  wLetterRead: [
    { t: 'line', sp: 'voice', text: '「致那位在雾里作画的人。」' },
    { t: 'line', sp: 'mdlWorry', text: '这封信不是写给杰克的。' },
    // 纯 do 步骤（无 line）：settle() 会连续穿透
    { t: 'do', do: [{ flag: ['caseOpen', true] }, { toast: '目标更新:查看告示板' }] },
  ],

  wLetterBack: [{ t: 'line', sp: 'mdl', text: '现在还不是时候。' }],

  // ③ 传送 + 章节卡 + 战斗 + 结局：4 种"重锤"副作用的真实写法
  wClimax: [
    { t: 'do', do: [{ shake: 18, sound: 'sting' }] },
    { t: 'line', sp: 'none', text: '墙上的钟同时停了。' },
    {
      t: 'do',
      do: [
        { flag: ['wClimaxStarted', true] },
        { teleport: { map: 'alley', x: 8, y: 4, dir: 'right' } },   // → bridge.teleport
        {
          chapter: {                                               // → mode='chapter'，章节卡覆盖层
            num: '第一案',
            name: '巴克巷的红颜料',
            quote: '「1888 年,秋。雾都的夜里,有人开始作画。」',
          },
        },
      ],
    },
    { t: 'do', do: [{ battle: 'shade1' }] },                       // → startBattle，enemyId 须在 ENEMIES 里
  ],

  wEnding: [
    { t: 'line', sp: 'mdl', text: '(已经没有什么需要画的了。)' },
    { t: 'do', do: [{ ending: 'auto' }] },                          // 'auto' = 按真相层级自动判定
  ],
}
```

已验证的调用样例（真实代码，来自 `script.ts:406-414`）：

```ts
{
  t: 'do',
  do: [
    { flag: ['deduced', true] },
    { teleport: { map: 'alley', x: 8, y: 4, dir: 'right' } },
    { shake: 20, sound: 'sting' },
    { battle: 'shade1' },
  ],
},
```

**执行顺序陷阱**：`applyEffects` 是 `for` 循环顺序执行，但 `next` / `ending` / `doSave` 三处 `return` 会**丢掉后面所有 effect**。所以 `battle` 必须写在 `teleport` 之后单独一个 `do` 步骤（如上）—— 若同一 `do` 里 `battle` 在 `teleport` 前面，传送就不会发生。

### 4.5 其他剧本触发源

| 触发源 | 机制 | 落点 |
|---|---|---|
| 交互 | `handleInteract(id)` 的 switch | `events.ts:45-199` |
| 进图 | `onEnterMap(mapId)`，由 `queueMapEntry` 延迟调用 | `events.ts:202-225` |
| 线索集齐 | `addClue()` 设 `pendingScript` | `store.ts:1093-1099` |
| 推理完成 | `DEDUCTION_DONE[caseNo]` → `startScript` | `DeductionBoard.tsx:52` |
| 战斗胜利 | `def.winScript` → `startScript` | `store.ts:1128` |
| 存档点 | 剧本里的 `['doSave',1]` / `['useSavePointSupplies',1]` | `script.ts:82-92` |

---

## 5. 状态与存档

### 5.1 store 结构

`GameStore`（`store.ts:309-374`）：**31 个状态字段 + 34 个 action**。

状态字段分组：

| 组 | 字段 |
|---|---|
| 流程 | `mode`（`title`/`chapter`/`explore`/`battle`/`ending`）、`chapterInfo`、`caseNo` |
| 数值 | `hp/maxHp`（60/60）、`san/maxSan`（100/100）、`pigment/maxPigment`（12/12） |
| 进度 | `items`（`{sedative, bandage}`）、`clues: ClueId[]`、`flags: Record<string, boolean \| number>` |
| 能力 | `vision: boolean` |
| 对话 | `dialog: { steps, i, scriptId } \| null`、`pendingScript` |
| 覆盖层 | `evidenceOpen`、`deductionOpen`、`deductionCase`、`menuOpen`、`saveScreenOpen`、`saveScreenCanSave` |
| 战斗 | `battle: BattleState \| null` |
| 结局 | `ending: EndingId \| null` |
| UI 杂项 | `toasts`、`achToast` |
| 持久化 | `hasSave`、`saveSlots`、`runMeta`、`achievements` |
| 统计 | `dedMistakes`、`caseMinSan` |

**状态库是 45 行手写的 zustand 替代品**（`tinyStore.ts`）：`create<S>(init)` 返回一个既是 hook 又是 store 的函数；`set` 做浅合并（`{...state, ...patch}`）后遍历 listeners；hook 内部走 `useSyncExternalStore`（`tinyStore.ts:34-38`）。**每帧引擎与 React 之间只通过 `useGame.getState()` 单向读取，不 subscribe**——这是性能关键：Canvas 主循环完全不触发 React 重渲染。

### 5.2 flags 机制

`flags: Record<string, boolean | number>` 是引擎里唯一的"世界状态总线"，**无 schema、无类型、无命名规范**，实际承担 5 类语义：

| 语义 | 实例 | 消费方 |
|---|---|---|
| 剧情进度 | `caseOpen`、`introDone`、`deduced4`、`jackDefeated` | `events.ts` 的 switch、`HUD.objective()` |
| 实体显隐 | `hideFlag` / `showFlag` 指向的 flag | `visibleEntities()`（`engine.ts:159-160`） |
| 传送门锁 | `Portal.lockFlag` | `engine.ts:314` |
| 二周目 | `ngPlus`（由 `runFlags()` 注入） | 散页实体、HUD、标题 |
| 成就判定 | `HIDDEN_FLAGS` 列表里的隐藏收集 flag | `hiddenCount()`（`store.ts:1102-1104`） |

命名约定（**靠人肉维持，代码不校验**）：
- `xxxDone` = 一次性剧情已看完
- `xxxSeen` = 首次进图
- `xxxOpen` = 区域/案件已解锁
- `xxxReady` / `cluesReady{caseNo}` = 线索齐了可以推理
- `hidden_xxx` = 彩绘之眼才能看见的隐藏线索
- `paper_{fragmentId}` = 二周目散页已收集

`runFlags(meta, ordinal)`（`store.ts:60-66`）在每次开新档/读档时强制注入到 flags 里：

```ts
return {
  ngPlus: ordinal >= 2,
  ...Object.fromEntries(PAPER_FRAGMENT_IDS.map(id => [`paper_${id}`, collected.has(id)])),
}
```

即 **周目级 flag 不存进存档，而是每次载入时从 `runMeta` 重新计算**。这避免了"存档里的 ngPlus 与 runMeta 不一致"这一类脏数据。

### 5.3 存档数据结构

**单一存档槽（`SaveData`，`types.ts:179-189`）**

```ts
export interface SaveData {
  hp: number; san: number; pigment: number
  items: Partial<Record<ItemId, number>>
  clues: ClueId[]
  flags: Record<string, boolean | number>
  map: MapId; x: number; y: number
  caseNo: CaseId
  runId?: string          // 旧存档没有，载入时补齐
  runOrdinal?: number
}
```

注意**没有** `dialog` / `battle` / `ending` / `vision` / `chapterInfo` —— 存档只保存"探索态"，读档一律回到 `mode: 'explore'`（`store.ts:509`）。这是刻意的：不可能在战斗中途存档。

**槽位包装（`StoredSaveSlot`，`store.ts:162-168`）**

```ts
interface StoredSaveSlot {
  format: 'calabiyau-mdl-slot'
  version: 1
  slot: number
  savedAt: string        // ISO 时间
  game: SaveData
}
```

**跨周目资料（`RunMeta`，`types.ts:214-222`）**——不随"开始新的一夜"重置：

```ts
export interface RunMeta {
  version: 1
  completedRuns: number
  endingHistory: EndingHistoryEntry[]      // {ending, completedAt, run, runId}
  activeRun: ActiveRun | null              // {runId, ordinal}
  paperFragments: string[]                 // 《幻源录》散页 id
  secretEndingSeen: boolean
}
```

**可移植存档（`SaveFileData`，`types.ts:224-232`）**——导入导出用，`game` + `meta` + `achievements` 三合一，`parseSaveFile` 会校验 `meta.activeRun.runId === game.runId`（`store.ts:267`）以防拼接篡改。

**8 个槽位**（`SAVE_SLOT_COUNT = 8`，`store.ts:23`；`localBackendContract.ts:1` 有一份重复定义）。

### 5.4 localStorage 后端

真实键名（全部实测）：

| 键 | 出处 | 内容 |
|---|---|---|
| `calabiyau-mdl-save-slot-v1-{n}` | `store.ts:19` / `localBackend.ts:12` | `StoredSaveSlot` |
| `calabiyau-mdl-runs-v1` | `store.ts:20` | `RunMeta` |
| `calabiyau-mdl-profile-v1` | `localBackend.ts:13` | `PersistentProfile`（RunMeta + achievements） |
| `calabiyau-mdl-achievements-v1` | `localBackend.ts:15` | 成就 id 数组（旧键，仍双写） |
| `calabiyau-mdl-save-v2` | `store.ts:18` | 旧版单槽存档，仅用于迁移 |
| `calabiyau-mdl-audio-v1` | `audio.ts:23` | 音量设置 |

**双写策略**：`doSave()`（`store.ts:728-730`）先 `await localBackend.writeSlot(...)`，再 `writeSaveSlot(slot, ...)` 写 localStorage。`localBackend` 在浏览器里就是 localStorage（`localBackend.ts:83-193` 的 `browserBackend`），在 Electron 里是 `window.localGameBackend`（`localBackend.ts:196`）。**接口抽象（`localBackendContract.ts` 57 行、8 个方法）是这套存档系统唯一为"换后端"预留的扩展点**，且已经实装了两套后端。

**迁移链**（三层，全部有真实代码）：
1. `migrateLegacySave()`（`store.ts:205-217`）：`calabiyau-mdl-save-v2` → 槽位 1；
2. `hydratePersistence()`（`store.ts:427-460`）：Electron 首次启动时把 localStorage 的槽位批量复制进 Electron 数据目录（`if (localBackend.kind === 'electron' && backendSlots.length === 0)`，`store.ts:443`）；
3. `parseSaveData()`（`store.ts:127-160`）对旧存档缺 `runId`/`runOrdinal` 的情况自动补齐（`store.ts:501-506`）。还有一次业务级迁移：`needsTrainMigration`（`store.ts:507`）把旧版"画廊"存档重定向到"列车"起点（`store.ts:521`）。

**反序列化是手写校验器，不是 `as` 断言**：`parseSaveData` 逐字段检查 `validCount`（整数且范围合法）、`MAP_IDS.has`、`ClueId` 的 `hasOwnProperty`、拒绝 `__proto__`/`prototype`/`constructor` 作为 flag key（`store.ts:148`）。`parseRunMeta`（`store.ts:68-107`）同理，且对 `endingHistory` 长度设 1000 上限。**这是这套代码里质量最高的部分之一，值得原样搬走。**

### 5.5 单文件 HTML 如何内联资源

`scripts/package-single-html.mjs`（80 行）的完整流程：

1. 读 `dist/index.html`（或 `dist/sequel.html`）；
2. 正则抓 `<link rel="stylesheet" href="…">` 与 `<script src="…"></script>`；
3. **CSS**：读文件内容 → 检查里面没有外部 `url(...)`（`package-single-html.mjs:54-58`，`data:` 和 `#` 除外）→ 替换成 `<style>…</style>`，并把内容里的 `</style` 转义成 `<\/style`（`:37-39`）；
4. **JS**：读文件内容 → 替换成 `<script type="module">…</script>`，同样转义 `</script`；
5. **兜底校验**：把已内联的 `<script>`/`<style>` 块挖掉后，剩余 HTML 里**不允许**出现任何 `<script|img|audio|video|source src>` 或 `<link href>`（`:70-73`），否则抛错终止；
6. 输出到 `release/<productName> <version> 单文件网页版.html`。

因为**美术全是代码里的字符网格、音频全是 WebAudio 合成**，这套内联逻辑根本没有二进制资源要处理——最终产物 520,934 B，其中 JS 约 500 KB（含 React 运行时）。

---

## 6. 战斗系统

### 6.1 数据驱动敌人定义

`EnemyDef`（`types.ts:140-151`）：

```ts
export interface EnemyDef {
  id: string
  name: string
  hp: number
  sprite: 'boss1' | 'boss2' | 'boss3' | 'bossJack'
  enrageAt: number
  moves: EnemyMove[]
  pool: number[]        // 意图抽取权重池(索引)
  intro: { text: string; cls?: string }[]
  winScript: string
  winText?: string
}
```

`EnemyMove`（`types.ts:132-138`）：

```ts
export interface EnemyMove {
  name: string
  kind: MoveKind
  dmg?: [number, number]   // 伤害区间
  san?: number             // 理智伤害
  desc: string             // 命中日志，{d} 会被替换成实际数值
}
```

实测 `ENEMIES` 有 5 个敌人（`enemies.ts:4-120`）：`shade1`（HP 62，狂化线 24）、`shade2`（66/24）、`shade3`（72/28）、`jack`（88/36）、`garden`（84/34）。**每个敌人 = 一段纯数据**，新增敌人只需加一条记录 + 一张立绘，零逻辑改动。

### 6.2 招式 kind

`MoveKind` 8 种（`types.ts:130`），全部在 `enemyAct()`（`store.ts:1132-1225`）的 `switch (move.kind)` 里手工实现：

| kind | 行为 | 代码 |
|---|---|---|
| `claw` / `slash` | 单次物理伤害，`dmg ?? [5,8]` | `store.ts:1153-1156` |
| `double` | 物理伤害 ×2（`hit(dmg, 2)`） | `store.ts:1158-1160` |
| `stare` | SAN 伤害（`san ?? 8`）；若有蜡底则反而 `san +2` | `store.ts:1162-1173` |
| `charge` | 置 `charged=true`，自身 `san -3`，下一击 +5 伤害 | `store.ts:1175-1179` |
| `erase` | 清玩家的 `guard` + `revealed`，并抹掉最多 3 点颜料 | `store.ts:1182-1191` |
| `split` | `rnd(4,6)*2 + bonus`，不受蓄势加成 | `store.ts:1194-1202` |
| `mimic` | 读 `b.lastPlayerCmd`：splash→`rnd(8,11)`、attack→`rnd(5,7)`、gaze→`san -7`、其他→无效果 | `store.ts:1205-1223` |

公共规则：`bonus = enraged ? 2 : 0`（`store.ts:1138`）；`charged` 时再 `+5`（`store.ts:1143`）；`guard` 时伤害 `Math.ceil(dmg/2)`（`:1144`）；`slash`/`double` 触发 `bridge.shake(14)`，其余 `shake(8)`（`:1146`）。

**玩家侧指令 7 种**，硬编码在 `battleCmd(cmd)`（`store.ts:962-1054`）的 `switch` 里：

| cmd | 效果 | 约束 |
|---|---|---|
| `attack` | `rnd(7,10)` 伤害 | 无 |
| `splash` | `rnd(14,18)` 伤害 | 消耗 4 颜料（`store.ts:983`） |
| `gaze` | 置 `revealed=true`，`san +4` | 已 revealed 时按钮禁用 |
| `guard` | 置 `guard=true`，本回合受击减半 | 无 |
| `sedative` | 走 `useItem('sedative')`，`san +25` | 有库存 |
| `bandage` | 走 `useItem('bandage')`，`hp +20` | 有库存 |
| `flee` | **固定失败**（`store.ts:1015-1018`），只打一行日志 | — |

### 6.3 意图预读

意图是 `BattleState.intent`（`types.ts:160`），指向 `moves` 的下标。

- **抽取**：`nextIntent(enemyId, prev, charged)`（`store.ts:383-395`）
  - 若 `charged`，强制返回第一个 `kind === 'slash' || kind === 'double'` 的下标（"蓄势后必接最重一击"）；
  - 否则从 `def.pool` 均匀随机（`pool: number[]` 是**可重复的加权池**，例如 `shade2` 的 `[0,0,1,1,2,3,3,4]` 让 `0` 出现 2/8、`3` 出现 2/8）；
  - 50% 概率避免与上一次相同（`if (pick === prev && Math.random() < 0.5)`）。
- **可见性**：`BattleState.revealed`。三条获取途径：
  1. 用一次 `gaze` 指令（本回合可见）；
  2. 拥有 `'watch'` 线索（第一案隐藏线索"停摆的怀表"）→ 战斗开场即 `revealed: true`（`store.ts:941,955`），且每回合重置为 `true`（`store.ts:1044`）；
  3. 否则 UI 显示 `???`（`BattleUI.tsx:23`）。
- `erase` 招式会把 `revealed` 打回 `false`（`store.ts:1186`），这是对"怀表流"的反制设计。

### 6.4 回合流程

全部用**三层嵌套 `setTimeout`** 编排，没有状态机 / async：

```
battleCmd(cmd)                          store.ts:962
 ├─ setB({busy:true, guard:false, lastPlayerCmd:cmd})     :972
 ├─ switch(cmd) 结算玩家行动                             :974-1019
 └─ setTimeout(550ms)                                    :1021
     ├─ 若 enemyHp <= 0 → winBattle()                     :1024
     ├─ 若 hp <= enrageAt 且未狂化 → 置 enraged + 日志      :1027-1034
     └─ setTimeout(550ms)                                  :1036
         ├─ enemyAct() 结算敌人行动                        :1038
         └─ setTimeout(650ms)                              :1040
             └─ nextIntent() → set({intent, revealed, phase:'command', busy:false, turn+1})  :1043-1050
```

所以**一个回合的墙钟时间约 1.75 秒**（550 + 550 + 650）。`winBattle()`（`store.ts:1116-1130`）另有 1400ms 延迟后 `set({mode:'explore', battle:null})` 并 `startScript(def.winScript)`。

`BattleState` 有 `phase: 'command' | 'resolve' | 'won' | 'lost'`（`types.ts:158`），但实测**只用到 `command` 和 `won`**，`resolve` / `lost` 从未被赋值（玩家死亡走 `changeHp` → `endingOnCollapse` → `triggerEnding`）。

日志：`log` 数组 `slice(-7)` 保留 8 条（`store.ts:968`），`BattleUI` 只显示最后 5 条（`BattleUI.tsx:29`）。

### 6.5 可扩展性与局限

**扩展容易的部分**

- 新敌人：`ENEMIES` 加一条 + `art/` 加立绘 + `sprite` 字段加入 `EnemyDef.sprite` 联合（`types.ts:144` 是硬编码的 4 个值，**这里是唯一要改类型的地方**）。
- 新招式数值：`moves` 数组加一条，`pool` 加索引即可。
- 新狂化阈值 / 胜利剧本：纯字段。

**扩展困难的部分**

| 局限 | 证据 | 影响 |
|---|---|---|
| 新 `kind` 必须改 `store.ts` | `MoveKind` 是联合类型（`types.ts:130`），`enemyAct` 是 `switch`（`store.ts:1152`） | 无法用数据描述"召唤小怪""上毒"等，必须写代码 |
| 玩家指令集写死在 store | `battleCmd` 的 `switch`（`store.ts:974-1019`），7 个 cmd 的字符串在 `GameStore` 接口里也硬编码（`store.ts:373`） | 加一个技能要同时改类型 + switch + `BattleUI.tsx` |
| 只有一个敌人 | `BattleState` 是扁平单敌结构（`types.ts:153-168`），无 `enemies[]` | 群战要重写整个 `BattleState` 与 UI |
| 无属性/等级/装备 | 伤害是 `rnd(7,10)` 常量（`store.ts:976`） | 成长曲线只能靠 `hp/san/pigment` 三条 |
| 结算靠 `setTimeout` 链 | `store.ts:1021,1036,1040` | 切标签页/掉帧会错位；无法暂停；组件卸载后 timer 不会自动清理（只靠 `if (!get().battle \|\| get().mode !== 'battle') return` 兜底） |
| `flee` 是假指令 | `store.ts:1015-1018` | 想做"可逃跑的战斗"要改逻辑 |
| `phase` 字段半废 | `resolve`/`lost` 从未使用（`types.ts:158`） | 想做战斗内动画/分支，得先补状态机 |

---

## 7. UI 层

### 7.1 React 与 Canvas 的联动方式

**一句话：Canvas 独占游戏画面，React 只做「覆盖层 + 文字 + 按钮」，两者唯一的数据通道是 `useGame` 单例 store。**

`App.tsx:87-113` 是完整的合成关系（注意层级与 z-index）：

```tsx
<div className="stage">
  <div className="viewport" style={{ width: VIEW_W*scale, height: VIEW_H*scale, '--game-scale': scale }}>
    <GameCanvas scale={scale} />                                  {/* Canvas：宽高 384×216，CSS 放大 */}
    {mode === 'title'   && <TitleScreen onAchievements={...} />}   {/* .screen z-index:40 */}
    {mode === 'chapter' && <ChapterCard />}                        {/* .screen z-index:40 */}
    {(mode === 'explore' || mode === 'battle') && <HUD />}          {/* .hud  z-index:20，pointer-events:none */}
    {mode === 'explore' && (<>
      <DialogBox />                                                 {/* .dialog-wrap z-index:30 */}
      <EvidenceBook />                                             {/* .overlay-center z-index:45 */}
      <DeductionBoard />                                           {/* .overlay-center z-index:45 */}
      <MenuOverlay />                                              {/* .overlay-center z-index:45 */}
    </>)}
    {mode === 'battle' && <BattleUI />}
    {mode === 'ending' && <EndingScreen />}
    <SaveScreen />                                                 {/* .screen z-index:40 */}
    {achOpen && <AchievementPanel onClose={...} />}
    <AchievementToast />
    <Toasts />                                                     {/* z-index:35，pointer-events:none */}
  </div>
</div>
```

**Canvas 侧**：`GameCanvas.tsx` 挂载时 `startEngine(canvas)`，卸载时 `stopEngine()`。它**不接收任何 props 变化**（除了 `scale` 只影响 CSS 尺寸），所以 React 重渲染不会重启动画循环。

**React 侧**：每个组件都用细粒度 selector 订阅，例如 `const hp = useGame(s => s.hp)`（`HUD.tsx:49`）。因为 `tinyStore` 用 `useSyncExternalStore` + 浅合并（`tinyStore.ts:20-25`），任何 `set` 都会通知所有 listener，但 selector 的返回值相同则 React 不重渲染。

**像素画进 DOM**：`PixelView.tsx`（20 行）把 offscreen canvas 按整数倍 `drawImage` 到 DOM canvas，样式 `imageRendering: 'pixelated'`。用于立绘（`scale=3`，`DialogBox.tsx:94`）和证物图标（`scale=4`，`EvidenceBook.tsx:42`）。

**唯一共享的"像素"资产**是：`SPRITES`（`renderer.ts:13-15`，51 个精灵）、`PORTRAITS`（17 个，`portraits.ts:893-900`）、`ICONS`（`portraits.ts:1043-...`）。它们都是模块级 `HTMLCanvasElement`，在 import 时同步创建。

### 7.2 覆盖层与主循环的互斥（`wasUiOpen` 及其同伴）

这是这套引擎最微妙的一段，`engine.ts:249-273`：

```ts
if (g.mode !== 'explore') { Input.flush(); return }              // :249

const uiOpen = !!g.dialog || g.evidenceOpen || g.deductionOpen
             || g.menuOpen || g.saveScreenOpen                    // :251

// UI 刚关闭的那一帧：吞掉残留按键。
// 否则关闭对话框的那次 Enter/E 会在下一帧立刻重新触发同一个交互（对话无限重开）
if (wasUiOpen && !uiOpen) {                                      // :255
  wasUiOpen = false
  Input.flush()
  world.moving = false
  return
}
wasUiOpen = uiOpen                                               // :261

if (g.vision && !uiOpen) { ...每 90 帧 san -1... }                // :264-271
if (uiOpen) { Input.flush(); world.moving = false; return }       // :273
```

**这套机制有三层，缺一不可：**

1. **`wasUiOpen` 边沿检测**：UI 从开到关的那一帧，`Input.flush()` + `return`，即"吞掉这一帧的一切"。因为按键是**边沿触发**（`pressed` Set，见 `input.ts:3`），关闭对话框的 `Enter/E` 在 `keydown` 时已进 `pressed`；如果同一帧允许交互，`findInteract()` 会重新命中同一个 NPC → 对话无限重开。
2. **每帧末尾的 `Input.flush()`**（`engine.ts:344`）：清空"本帧新按下"集合，防止按键滞留到很久以后才被消费。副作用是**任何非 explore 的 mode 都必须显式 flush**（`engine.ts:249` 与 `:273` 两处）。
3. **多个 `Input.consume()` 不能写 `||`**：`engine.ts:279-282` 的注释写得很清楚——

   ```ts
   // 不能用 || ,短路会让未消费的按键滞留到下一帧
   const pE = Input.consume('e')
   const pSpace = Input.consume(' ')
   const pEnter = Input.consume('Enter')
   if (pE || pSpace || pEnter) { ... }
   ```

**新增任何覆盖层，必须同步改 3 处，否则"面板打开时角色还能走"：**

| 位置 | 内容 |
|---|---|
| `engine.ts:251` | `uiOpen` 的表达式里加上新字段 |
| `renderer.ts:230` | 交互提示 "E" 的显示条件里加上新字段（否则面板开着还画 E 提示） |
| `engine.ts:75` | `queueMapEntry` 的等待条件里加上新字段（否则入场剧本会在面板打开时触发） |

另外 **React 层的全局快捷键**（`App.tsx:55-85`）自成一套，与引擎的 `Input` **并行存在**：

- `Tab` → 成就面板（在 `saveScreenOpen` 时直接 return，`:58`）
- `I` → 证物（`if (g.dialog) return`，`:67`）
- `R` → 推理（需 `cluesReady && !deduced`，`:74-76`）
- `Esc` → 逐级关闭（evidence → deduction → menu，`:77-81`）
- 移动 / `E` / `V` 在引擎侧（`engine.ts:276-290`）

两套键盘监听都以 `window` 为 target，靠**状态门控**而不是 `stopPropagation` 来避免冲突。`DialogBox.tsx:55-72` 还有第三套：对话时的 `E/空格/Enter` 推进 + `1~9` 选选项。

### 7.3 各组件职责（实测行数与关键行号）

| 组件 | 行数 | 关键实现 |
|---|---:|---|
| `GameCanvas.tsx` | 21 | `startEngine/stopEngine` 生命周期 |
| `PixelView.tsx` | 20 | offscreen → DOM canvas，整数倍放大 |
| `DialogBox.tsx` | 117 | 打字机（26ms/字，`chars % 3 === 0` 时 `sfx('blip')`，`:45-50`）；`rich(rawText)` 渲染 `**强调**`；`1~9` 选择；说话人名表（`:9-27`，17 个 `SpeakerId`） |
| `HUD.tsx` | 97 | `objective(flags, caseNo)`（`:4-46`）是**唯一的目标提示逻辑**，用嵌套 if 覆盖 5 个案件的所有阶段；`hp/san` 条用 `transform: scaleX()` 而非 `width` |
| `EvidenceBook.tsx` | 123 | 按 `CHAPTERS` 分组；`CLUES[id].hidden/truth` 决定样式；二周目额外一组散页 |
| `DeductionBoard.tsx` | 92 | 逐题推进；答对 1600ms 后进下一题（`:56`）；答错 `changeSan(-5)` + `noteDeductionMistake()`（`:59-61`）；全部答完 `startScript(DEDUCTION_DONE[dedCase])`（`:52`） |
| `BattleUI.tsx` | 51 | 敌方血条 + 意图显示（`revealed` 决定显示招式名或 `???`）；7 个指令按钮 `disabled={busy \|\| 资源不足}` |
| `EndingScreen.tsx` | 121 | 逐行演出 400ms/1500ms（`:29`）；`scrollIntoView` 跟随（`:35`）；点击跳过（`:45-47`）；`isBad` 时显示"从上次写生处继续" |
| `SaveScreen.tsx` | 153 | 8 槽网格；`PendingAction = 'save'\|'load'\|'delete'\|'import'` 四态确认（`:6`）；占用槽位才弹确认，空槽直接执行（`:51-59`） |
| `Screens.tsx` | 142 | `AudioSettings`（3 滑杆 + 静音）、`TitleScreen`、`ChapterCard`（3200ms 自动 `chapterDone()`，`:96`）、`MenuOverlay` |
| `Achievements.tsx` | 74 | 3 组分类；`secret && !unlocked` 时显示 `？？？` |
| `RichText.tsx` | 20 | `rich()` 按 `**` split 成交替的纯文本 / `<span class="rich-em">`；`stripMarks()` 供打字机算长度 |
| `Toasts.tsx` | 13 | 纯展示；`toasts` 最多 4 条（`store.ts:647` 的 `slice(-3)` + 新条），3600ms 自动消失（`:648`） |

---

## 8. 像素美术管线

### 8.1 `build.ts` 的字符网格 → Canvas 机制

整个美术系统的核心只有 **68 行**（`build.ts`，且 `8fe2260` 版本与 HEAD 完全一致，0 改动）。

```ts
export const TILE = 16
export type Pal = Record<string, string>        // 字符 → CSS 颜色

export function px(rows: string[], pal: Pal): HTMLCanvasElement {
  const h = rows.length
  const w = Math.max(...rows.map(r => r.length))     // 宽度取最长行
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.' || ch === ' ') continue          // '.' 与空格 = 透明
      const col = pal[ch]
      if (!col) continue                              // 调色板里没有的字符 = 透明（静默跳过）
      g.fillStyle = col
      g.fillRect(x, y, 1, 1)                          // 一个字符 = 一个物理像素
    }
  })
  return c
}
```

实现的三个关键决定：

1. **不是 ImageData 逐像素写 buffer，而是 `fillRect(x, y, 1, 1)`**。因为每个字符不同色，`fillStyle` 每像素设一次。**对 48×48 立绘是 2304 次 fillRect**，但仍只在模块加载时执行一次，可接受。若做更大量产，改成 `ImageData` + 一次性 `putImageData` 会快 5~10 倍。
2. **模块顶层同步执行**：所有 `px(...)` 调用都在 import 时跑完，得到模块级 `HTMLCanvasElement`。**没有懒加载、没有异步**。全部美术约 51 个精灵 + 17 个立绘 + 若干图标，首屏构建成本约 10~30ms。
3. **宽容解析**：行不等长时以最长行为宽；未定义的字符静默透明。这允许用 `'...'.slice(0,16)` / `.padEnd(31,'s')` 这种运行时切片来凑宽度（`props.ts:75-91` 里大量使用），但也埋了"少打一个字符导致整行错位"的隐患。

另外两个辅助函数：

```ts
export function flipX(src: HTMLCanvasElement): HTMLCanvasElement   // build.ts:46-55
// translate(width,0) + scale(-1,1) + drawImage

export function tinted(src: HTMLCanvasElement, color: string): HTMLCanvasElement  // build.ts:58-67
// source-in 方式整体染色（注释说是给"墨线世界"用，实测未被 renderer 调用）
```

实测 `flipX` 只用于角色左右朝向（`chars.ts:354`：`mdlLeftA: flipX(mdlRightA)`），**即"左右朝向不单独画，靠水平翻转"**，省一半工作量。

### 8.2 调色板

全局哥特调色板 `P`（`build.ts:6-24`）**29 个键**，按材质分组，每组 3~4 阶：

```ts
export const P = {
  K: '#05060b',                                    // 虚空
  k: '#0d0f18',                                    // 描边黑
  s1: '#161c2c', s2: '#232c44', s3: '#33405e', s4: '#4a5878',   // 石（4 阶）
  b1: '#251b30', b2: '#38294a', b3: '#4c3a62',                  // 紫调砖（3 阶）
  w1: '#241a10', w2: '#3f2f1c', w3: '#5c4630', w4: '#77603f',   // 木（4 阶）
  g1: '#ffd97a', g2: '#e8942a', g3: '#a34e1a',                  // 煤气灯（3 阶）
  r1: '#c22f2f', r2: '#7c1c1c',                                 // 血红
  or: '#e8762a', od: '#a34e1a',                                 // 玛德蕾娜橙
  wt: '#e6e2d6', pp: '#d8d3c4', pd: '#9a9484',                  // 白/纸
  gy: '#6e7688', gd: '#454e63',
  hr: '#b08968', hd: '#8a6a4f',                                 // 浅棕发
  sk: '#e8c8a8', sd: '#c09878',                                 // 皮肤
  gr: '#4a7a52', gD: '#2e4e34',                                 // 罗莎绿裙
  pu: '#9a5cc8', pv: '#5c2a80',                                 // 疯狂紫
  sb: '#7ab0d4', sd2: '#31567c',                                // 理智蓝
  br: '#6e3a2a', bd: '#4a2418',                                 // 赭褐
} as const
```

**三阶明暗约定**：每个材质族都提供 `浅/中/深`（或 4 阶），符号通常是 `<材质><数字>`，数字越大越亮（`s1 < s2 < s3 < s4`）。命名里的 **`d` 后缀 = dark**（`od`、`gd`、`sd`、`bd`、`hd`、`pd`），**大写 = 更亮**（`P.g1` 比 `P.g2` 亮；`w1` 最暗）。

**光源约定**：`portraits.ts:4` 的原注释 —— **"对话立绘 48x48(每个字符 = 1 像素,光源统一来自左上方)"**。实测所有立绘的明暗分布都遵循左上亮、右下暗；角色精灵（`chars.ts`）同样把高光放在左肩/左脸，阴影在右侧和下方。

局部调色板**按精灵单独定义**，覆盖在 `P` 之上：

- `chars.ts:4-8` 的 `M`：13 个键，加了 `o: P.or`（橙发）、`W: P.wt`（白领）、`m: '#b06a5a'`（嘴）等。
- `portraits.ts:8-16` 的 `MDL_PAL`：**30 个键**（这是最复杂的一个），包含 `k/z/Z/L` 四档头发阴影、`j/D/b` 三档棕发、`s/t/S/N` 四档皮肤、`q/Q` 两档高光蓝。
- 图标用 `I`（`portraits.ts:903-906`，12 个键）。

### 8.3 精灵规格（全部实测）

| 类别 | 尺寸 | 出处 | 数量 | 备注 |
|---|---|---:|---:|---|
| 瓦片 | 16×16 | `tiles.ts` 全部 | 17 个字符 | `TILES` 注册表 13 + 后续 4 |
| 角色（玩家） | 16×24 | `chars.ts:11-63` 的 `mdlDownA` 等 | 8 帧 | 4 向 × 2 帧；左向由 `flipX` 生成 |
| 角色（NPC） | 16×24 | `chars.ts` | 6 个 | `rosa/guard/doc/rabbit/shadowA/shadowB` |
| 场景道具 | 16×16 ~ 32×32，高可到 32 | `props.ts` | 19 个 | 路灯 16×32、画架 16×24、挂画 32×32、床 32×28 |
| 立绘 | 48×48 | `portraits.ts:5` 的 `PORTRAIT_SIZE = 48` | 17 个 | 界面按 `scale=3` 显示为 144×144（`styles.css:284-288`） |
| 证物图标 | 12×12 | `portraits.ts:902` 注释 | **34 个键** | `portraits.ts:1043` 先定义 9 项字面量，再由 `:1200-1225` 的 25 次 `ICONS.xxx = ...` 逐条追加（第三案以后大量复用已有图标，如 `ICONS.petal = iconSigil`）；界面按 `scale=4` 显示为 48×48 |
| Boss 立绘 | 40×48 | `boss.ts:3` 注释；`case2.ts:300` 同 | 4 组 × 2 态 | 战斗里 `scale = 2` 放大（`renderer.ts:725`）→ 显示 80×96 |
| 列车专属 | 16×24 ~ 96×80 | `train.ts` | 6 个 | `trainWindow` 被 `WIDE` 登记为 6 格宽 |

**渲染锚点约定**（容易踩坑，必须对齐）：

- 实体左上角 = `(e.x * TILE, e.y * TILE)`；`tall` 时向上抬 `spr.height - TILE`（`renderer.ts:136`）。
- 玩家绘制位置 = `(px - 8, py - 20)`（`renderer.ts:131`）：即**精灵宽 16 → 水平居中；高 24 → 脚底对齐 py**。
- 玩家出生/传送锚点 = `(x * TILE + 8, y * TILE + 12)`（`engine.ts:94-95`）：`+8` 是 16 宽的一半，`+12` 让脚底落在格子下方 3/4 处。
- 因此 `bridge.getPos()` 反算时是 `Math.round((px - 8) / TILE)` 和 `Math.round((py - 12) / TILE)`（`engine.ts:88-89`）。

### 8.4 可直接照抄的极小精灵样例

```ts
// src/game/art/props.ts（或任意 art 模块）
import { px, P } from './build'

// 8×8 的小道具：一支立在桌上的蜡烛。
// 每个字符 = 1 物理像素；'.' = 透明；每行 8 字符。
const candle = px([
  '...kk...',   // 8   烛芯
  '..kggk..',   // 8   火焰外圈（P.g2 暗橙）
  '..kgGk..',   // 8   火焰内芯（P.g1 亮黄）
  '...kk...',   // 8
  '..kwwk..',   // 8   蜡身左亮右暗（w=pp 亮,c=pd 暗）
  '..kwck..',   // 8
  '..kwck..',   // 8
  '.kwwcck.',   // 8   蜡油堆积
], { k: P.k, g: P.g2, G: P.g1, w: P.pp, c: P.pd })

// 注册进 PROPS（props.ts:446-450 的风格）
// export const PROPS = { lamp, easel, ..., candle }
```

验证要点：
1. 每行 8 字符 → 生成 8×8 canvas；
2. 字符都在调色板里（`k/g/G/w/c`），否则静默透明；
3. 在 `maps.ts` 里用 `{ id: 'candle1', x: 12, y: 4, sprite: 'candle' }` 引用——但**必须同时把它加进 `PROPS` 导出对象**，否则 `renderer.ts:134` 的 `SPRITES[e.sprite]` 是 `undefined` → `drawImage` 抛 TypeError；
4. 8×8 精灵不满足 `tall`（`tall` 只对高于 16px 的精灵有意义），直接放在格子左上角。

**立绘同款写法**（`px([...48 行 × 48 字符...], MDL_PAL)`），唯一区别是行数/列数多，且要在 `PORTRAITS`（`portraits.ts:893`）里注册，同时在 `types.ts:54-57` 的 `SpeakerId` 与 `DialogBox.tsx:9-27` 的 `NAMES` 里各加一条——**一个说话人 = 3 处改动**。

---

## 9. 音频管线

### 9.1 总体结构

`audio.ts`（1336 行）是纯 WebAudio 实时合成器，**零素材文件**。文件头注释（`audio.ts:1-5`）：

```
输出链   各分轨 -> 总线 -> 压限器 -> 扬声器
BGM      NES 风格脉冲波/三角波/噪声通道 + 前瞻式步进音序器
SFX      短促芯片音效,统一走 sfx 总线,音量可调并持久化
```

**节点图（`initAudio()`，`audio.ts:75-215`）**

```
                        ┌─ musicSubCut(highpass 34Hz) ─ musicBassShelf(lowshelf 135Hz +5.5dB)
trackGain ──┐           │
            ├─ musicFilter(lowpass 5200Hz, Q 0.45) ─┤
各 Chan ────┘                                        ├─ musicBus ─┐
                                                     ├─ musicEchoSend ─ delay 0.285s ─ lowpass 2400 ─ echoReturn 0.34 ─ feedback 0.19
                                                     └─ cathedralSend ─ delay 0.61s ─ lowpass 1650 ─ return 0.27 ─ feedback 0.31

主旋律 ── visionBus ─ visionFilter(lowpass 620Hz, Q 1.2) ─ visionLayerGain ──┐
drone(3 osc) ─ droneGain ── ambBus ─────────────────────────────────────────┤
心跳 / SFX ── sfxBus ───────────────────────────────────────────────────────┤
                                                                             └─ master ─ DynamicsCompressor(-8dB, knee 8, ratio 4, attack 3ms, release 250ms) ─ destination
```

关键调音常量（都有实测注释解释为什么）：

| 常量 | 值 | 出处 | 原因 |
|---|---:|---|---|
| 默认音量 | `master 0.9 / music 0.6 / sfx 0.95` | `audio.ts:33` | 注释："默认值刻意偏大:旧版本的问题就是基础音量太小" |
| `MUSIC_MAKEUP` | 2 | `audio.ts:39` | 音乐总线整体补一档；峰值交给压限器 |
| `LOOKAHEAD` | 0.12 s | `audio.ts:804` | 前瞻式音序器的调度窗口 |
| `TICK_MS` | 25 ms | `audio.ts:805` | 音序器轮询间隔 |
| 高通 | 34 Hz | `audio.ts:113` | 切掉小喇叭放不出来的低频，别占压限器余量 |
| 低搁架 | +5.5 dB @ 135 Hz | `audio.ts:118` | "低音听得清"靠 80~200Hz |
| 主低通 | 5200 Hz | `audio.ts:103` | 收掉数字振荡器过亮的高频 |
| echo | delay 0.285 / return 0.34 / feedback 0.19 | `audio.ts:122-130` | 8-bit 教堂回声 |
| cathedral | delay 0.61 / return 0.27 / feedback 0.31 | `audio.ts:134-144` | 标题曲专用的长空间尾音 |

### 9.2 合成器声部

`VoiceKind` 9 种（`audio.ts:270`）：

```ts
type VoiceKind = 'p12' | 'p25' | 'p50' | 'tri' | 'saw' | 'pipe' | 'bell' | 'choir' | 'reed'
```

| kind | 实现 | 用途 |
|---|---|---|
| `p12` / `p25` / `p50` | `pulseWave(duty)`（`audio.ts:222-239`），12.5% / 25% / 50% 占空比脉冲，`PeriodicWave` 带缓存（`waveCache`，`:220`） | 主旋律（p12 很细）、和声（p25/p50） |
| `tri` | 三角波 | 贝斯 |
| `saw` | 锯齿 | 惊吓音效 |
| `pipe` | 管风琴式叠加 | 圣咏铺底 |
| `bell` | `playBell()`（`audio.ts:362`） | 钟声 |
| `choir` | `playChoir()`（`audio.ts:405`） | 唱诗班 |
| `reed` | `playReed()`（`audio.ts:463`） | 簧管 |

打击乐只有 4 个键（`audio.ts:524`）：`'k'` 底鼓、`'s'` 军鼓、`'h'` 闭镲、`'o'` 开镲、`'-'` 空；鼓谱字符串**可叠写**（`'kh'` 同时底鼓 + 闭镲，见 `audio.ts:605` 注释）。

音高工具：`SEMI` 音名→半音表（`audio.ts:258`）+ `freq(note)`（`:259-269`）。

### 9.3 BGM 曲目组织

`TRACKS: Record<string, Track>`（`audio.ts:611-802`），实测 **7 条曲**：

| key | BPM | 场景 | 特征 |
|---|---:|---|---|
| `title` | 56 | 标题 / 章节卡 | D 小调葬礼圆舞曲，12 段 `dynamics`，`gothicTitle: true`（额外钟楼 + 唱诗班段落事件，`audio.ts:967`） |
| `safe` | 64 | 室内（`ambient: 'indoor'`） | E 弗里吉亚圣咏，F-E 半音摩擦 |
| `fog` | — | `ambient: 'fog'` | 雾都街道 |
| `alley` | — | `ambient: 'alley'` 或 `mapId === 'train'` | 巷道；**列车地图复用这条** |
| `battle` | — | 战斗（未狂化） | — |
| `enraged` | — | 战斗（`enraged: true`） | — |
| `ending` | — | 结局 | — |

`Track` 结构（`audio.ts:593-607`）：

```ts
interface Track {
  bpm: number
  stepsPerBeat?: 2 | 3 | 4
  echo?: number                  // echo 送出量
  cathedral?: number             // 教堂残响送出量
  tone?: number                  // 低通截止
  drone?: [string, string, string]   // 三音持续低音
  dynamics?: number[]            // 每八格一个段落力度
  gothicTitle?: boolean
  chans: Chan[]
  drums?: string[]
  drumGain?: number
}
interface Chan {
  kind: VoiceKind
  gain: number
  vib?: number       // 颤音深度
  gate?: number      // 音符门限长度
  notes: string[]    // 空格分隔的音名，'.' 延长，'-' 休止
}
```

谱面是**空格分隔的音名字符串**，用 `P = (s) => s.trim().split(/\s+/)`（`audio.ts:609`）解析。一个声部可以跨多行书写（模板字符串），靠 `split(/\s+/)` 拍平。

**曲目切换**：`setTrack(name)`（`audio.ts:1072-1100`）用 `curTrack`/`pendingTrack`/`swapAt` 三变量做"到小节线才切换"的淡入淡出（`trackGain` 是各分轨与 `musicBus` 之间的中间增益，`audio.ts:807`）。**重复请求同一曲不会打断**（引擎每帧都调，靠这里去重）。

音序器：`startSequencer()`（`audio.ts:1030-1071`）+ `scheduleStep()`（`:998-1029`），用 `LOOKAHEAD 0.12s` + `TICK_MS 25ms` 的经典 WebAudio 调度模式——**不用 `setInterval` 直接发声，而是提前 120ms 排进 `AudioContext` 时间轴**，避免 JS 主线程抖动导致节奏不稳。

### 9.4 场景切换选曲

`updateAudioScene(scene)`（`audio.ts:1314-1332`）由引擎**每帧调用**（`engine.ts:238-247`）：

```ts
updateAudioScene({
  mode: g.mode,
  mapId: world.map.id,
  ambient: world.map.ambient,
  dark: world.map.dark,
  san: g.san,
  enraged: !!g.battle?.enraged,
  vision: g.vision,
  visionSeconds: world.visionT / 60,
})
```

内部逻辑：

```ts
setTrack(pickTrack(s))                        // 选曲（去重）
setHeartbeat(mode 是 explore/battle && 0 < san < 35)      // 低理智心跳
if (!visionChanged && ctx.currentTime - lastSceneAutomationAt < 0.125) return   // 连续参数限流 ~8Hz
const lvl = mode === 'battle' ? 1.5
          : mode === 'explore' ? (mapId === 'train' ? 1.65 : (dark ?? 0.3) * 1.6 + 0.4)
          : 0.35
setDroneLevel(lvl)                             // 持续低音音量随黑暗度
setVisionLayer(vision, visionHeld, san)        // 彩绘之眼专属音层
```

`pickTrack`（`audio.ts:1293-1308`）：

```ts
case 'title': case 'chapter': return 'title'
case 'battle':  return s.enraged ? 'enraged' : 'battle'
case 'ending':  return 'ending'
case 'explore':
  if (s.mapId === 'train') return 'alley'
  return s.ambient === 'alley' ? 'alley' : s.ambient === 'fog' ? 'fog' : 'safe'
```

**这是"场景 → 曲目"的唯一映射点**，新游戏换曲只需改这一个函数 + `TRACKS` 加条目。

### 9.5 音效

`SFX` 表（`audio.ts:1234-1273`）**12 个音效**：

| name | 合成方式 |
|---|---|
| `blip` | 单音 `E6` p25 75ms —— **专门为对话打字机设计**（每 3 字一次，`DialogBox.tsx:47`） |
| `confirm` / `cancel` | 双音琶音 `s_arp` |
| `visionOn` / `visionOff` | 多层：`s_shimmer` + 滑音 + 钟声 |
| `sting` | 下滑锯齿 `A4→C2` + 低频噪声 + `thump` |
| `hit` | bandpass 噪声 + `E3→A2` |
| `hurt` | 低通噪声 + `A2→D2` 锯齿 |
| `heal` | 四音上行琶音 `C5-E5-G5-C6` |
| `save` | 三音琶音 `G4-C5-E5` |
| `clue` | 三音琶音 `E5-A5-C6` |
| `step` | 极短低通噪声 |

`sfx(name)`（`audio.ts:1275-1279`）是唯一入口，**未初始化 AudioContext 时静默 return**，所以引擎可以无脑调用。名字拼错则静默无效果（`const f = (SFX as Record<...>)[name]; if (f) f()`）——没有校验，这也是个小坑。

**音频解锁**在 React 层（`App.tsx:41-52`）：`pointerdown` + `keydown` 都挂 `initAudio(); resumeAudio()`，并且监听 `visibilitychange` 在回到前台时 `resumeAudio()`（浏览器会把后台标签页的 AudioContext 挂起）。这三件事缺一都会导致"切标签页回来没声音"。

---

## 10. 复用结论

### 10.1 模块评估表

**复用价值分三档**：`直接复用`（原样拷贝可用）／`改后复用`（搬走骨架 + 换数据/换少量实现）／`重写`（结构与新需求冲突，只借思路）。

| 模块 | 复用价值 | 理由 | 迁移成本估算 |
|---|---|---|---|
| `art/build.ts`（68 行） | **直接复用** | 零依赖、零业务耦合；`px / flipX / tinted / TILE / P` 就是一套完整 DSL | **0.5 人日**（只需决定是否保留调色板配色） |
| `art/tiles.ts` 的**机制** | 改后复用 | `TILES` 查表 + `SOLID_TILES` 集合是干净的；但 17 个瓦片的美术与图例是恐怖雾都专有的 | 机制 1 人日；**美术全换 ≈ 每瓦片 20~40 分钟** |
| `art/chars.ts` 的**机制** | 改后复用 | 4 向 × 2 帧 + `flipX` 省半的工作流极佳；`CHARS` 对象与 `renderer` 靠 `sprite` 字符串约定耦合 | 机制 0.5 人日；每个角色 4 向 × 2 帧 ≈ **0.5~1 人日** |
| `art/props.ts` | 改后复用 | 同上；`WIDE` 表（`engine.ts:121-126`）需要为新宽精灵登记 | 0.5 人日 + 每道具 20~40 分钟 |
| `art/portraits.ts` | 改后复用 | 48×48 立绘管线可复用；但 **HEAD 依赖 `sequel/art/maddelena`**（`portraits.ts:2`），迁移时要断开 | 机制 0.5 人日；每张立绘 **4~8 小时**（1225 行里最贵的资产） |
| `render/renderer.ts`（754 行） | **改后复用（骨架直接可用）** | 14 段固定绘制顺序、4 个缓存 canvas、视锥剔除、暗角烘图，全部与题材无关。需删：`train` 专属 4 个函数（`drawNightmarePane` 68 行 + `drawTrainCarriageShell` 78 行 + `drawTrainWindows` 21 行 + `drawTrainBattleBackground` 19 行 = 186 行）、SUSPENSE 特化的 `visionAnomalyFx`（76 行） | **2~3 人日**（删 + 调色 + 接新瓦片/实体） |
| `engine/engine.ts`（352 行） | **改后复用（优先级最高的可复用件）** | 主循环 / 碰撞 / 交互判定 / 传送 / 相机 / 雾 / `wasUiOpen` 全是成熟实现。需删：`vision` 相关（`visionT`/`visionDrainT`/彩绘之眼理智消耗，约 20 行）、`train` 特判 | **2 人日** |
| `engine/input.ts`（64 行） | **直接复用** | 持续按键 + 边沿触发 + `AbortController` 清理 + `blur` 清空。唯一限制：**只有键盘**，无鼠标/手柄/触屏 | **0.2 人日**（如需加输入源，+1 人日） |
| `tinyStore.ts`（45 行） | **直接复用** | 比 zustand 更小，`useSyncExternalStore` 正确实现，无坑 | **0 人日** |
| `types.ts` 的**结构范式** | 改后复用 | `Step`/`Effect`/`EntityDef`/`Portal`/`GameMap`/`SaveData` 的**设计思路**完全可用；但 `ClueId`/`MapId`/`CaseId`/`SpeakerId`/`EndingId`/`MoveKind` 全是本作专有联合类型 | **1 人日**（重写联合类型 + 保留接口形状） |
| `types.ts` 的**枚举值** | **重写** | 44 个 `ClueId`、14 个 `MapId`、17 个 `SpeakerId`、8 个 `MoveKind` 全是本作数据 | 随内容量线性 |
| `store.ts`（1229 行） | **改后复用（拆开用）** | `settle()`（21 行）、`applyEffects()`（53 行）、`parseSaveData` + `parseRunMeta`（34 + 40 = 74 行）、`addClue()` 是**可直接抄的高质量内核**；`startBattle` + `battleCmd` + `winBattle` + `enemyAct` + `nextIntent`（25 + 93 + 15 + 94 + 13 = 240 行战斗）与新玩法强绑定 | 内核 **2 人日**；战斗部分视需求 **重写 3~5 人日** |
| `world/maps.ts`（611 行） | **重写（仅借格式）** | 14 张地图全是本作关卡数据。可复用的是 `GameMap` 的**写法**（字符网格 + entities + portals） | 每张图 **0.5~1 人日** |
| `world/events.ts`（225 行） | **重写** | 140 行的 `switch`（`events.ts:59-198`）全是对白剧本路由，与本作剧情一一对应。但 `handleInteract` / `onEnterMap` / `once()` 的**结构**值得照抄 | 骨架 1 人日；每交互点 10~20 分钟 |
| `data/script*.ts`（4 个文件，1000+ 行） | **重写** | 全部是剧本与对白。**这正是"不能复用"的部分** | 按字数算 |
| `data/enemies.ts`（120 行） | 改后复用 | 数据格式极干净（`EnemyDef` 一条记录一个敌人），保留 schema 换数值即可 | 每个敌人 **0.5~1 小时** |
| `data/clues.ts` / `deduction.ts` / `endings.ts` / `chapters.ts` | 改后复用（schema） | `ClueDef`（`clues.ts:3-12`）、`DeductionQ`（`deduction.ts:10-13`）、`EndingDef`（`endings.ts:4-12`）、`ChapterDef`（`chapters.ts:3-16`）的字段设计通用；内容全换 | 每案 1~2 天 |
| `audio.ts`（1336 行） | **改后复用** | 合成器架构、调度器、总线、`SFX` 表、`pickTrack` 全部可留。需要重写的是 `TRACKS`（7 条曲的谱面，约 190 行） | 架构 **0~1 人日**；**每条新曲 0.5~1 人日**（乐理工作量大） |
| `ui/` 全部 13 个组件（1044 行） | 改后复用 | React 覆盖层 + CSS 像素风 chrome 的范式很好（`.pixel-panel` / `.screen` / `.overlay-center` 三层）。`DialogBox`/`HUD`/`Toasts`/`PixelView`/`RichText` 近乎直接可用；`EvidenceBook`/`DeductionBoard`/`BattleUI`/`EndingScreen`/`SaveScreen` 与玩法强绑定 | `DialogBox`+`HUD`+`Toasts`+`PixelView`+`RichText` **1 人日**；其余每个 **0.5~1.5 人日** |
| `styles.css`（512 行，24 KB） | **直接复用** | 13 个 CSS 变量 + `.pixel-panel` + 按钮 + 血条 + 弹幕 + 覆盖层，全部主题中性 | **0.5 人日**（换配色变量即可） |
| `platform/localBackend*.ts`（263 行） | **直接复用** | 8 方法接口 + 浏览器实现 + 完整校验器，无业务耦合 | **0.5 人日**（可进一步简化：纯网页项目删掉 electron 分支即可） |
| `scripts/package-single-html.mjs`（80 行） | **直接复用** | 通用 Vite 单文件内联器，只需改 `targets` 里的入口名与输出名 | **0.3 人日** |
| `electron/`（4 文件）+ `installer/` + `tsconfig.electron.json` | **不需要**（纯网页方案） | 见 §12 | 删除 ≈ 0.2 人日 |
| `src/sequel/**`（约 650 KB 源码） | **重写 / 不复用** | 第二部是另一套引擎（`sequel/engine.ts` 305 KB 单文件），与第一部架构不同 | — |
| `src/bgm/**`（4 文件，50 KB） | 视需要 | BGM 编辑器是独立调试工具，不影响运行时 | 0 人日（不搬） |

**总体估算**：保留 fable5 时代的骨架（`build`/`tiles` 机制/`chars` 机制/`engine`/`renderer` 骨架/`tinyStore`/`input`/`styles`/`localBackend`/`package-single-html`）≈ **10~13 人日**；换成新题材的美术与音乐是最大的不确定性（立绘 4~8 小时/张、曲 0.5~1 人日/条）。

### 10.2 这个引擎已知的坑

以下 5 条全部有真实代码依据，按"踩中概率 × 排查难度"排序。**新项目开工前应该把这张表贴在看板上。**

**① 地图每行必须等宽，而且短的行会变成"隐形墙"（不报错）**

`renderer.ts:107-108` 用 `map.tiles[0].length` 和 `map.tiles.length` 算地图边界；`engine.ts:109-118` 的 `solidAt` 在 `row[tx] === undefined` 时返回 `true`。所以如果某一行少打了一个字符：渲染时 `TILES[undefined]` 为 `undefined` → **静默跳过不画**（`renderer.ts:112-113`）；碰撞时 → **当成实心墙**。表现为"地图右边有一片看不见的墙，走不过去但地上是空的"。

同类问题：`props.ts:75-91` 里的 `'...'.padEnd(31, 's') + 'f'` / `.slice(0, 31) + 'f'` 这类"凑列宽"写法，一旦算错一位，整行像素错位。

**② 传送点的目标坐标不能落在实体或实心瓦片上**

`bridge.teleport`（`engine.ts:91-105`）无条件把 `px/py` 设到目标格，**不检查目标是否可站立**。如果 `tx,ty` 落在 `solid: true` 的实体或 `SOLID_TILES` 上，玩家一落地就卡在里面。`stuck()` 安全阀（`engine.ts:151-153`）会让玩家能穿墙走出来，但观感是"走进墙里消失了三秒"。

还有两个连带的坐标陷阱：
- 传送门触发格用的是 `Math.floor((py + 2) / TILE)`（`engine.ts:311`），**不是 `py`** —— 配置 `Portal.y` 时要按"脚下那一格"算，不是按精灵中心；
- 落地后 `portalCooldown = 18` 帧内不检测传送门（`engine.ts:99`），所以**不要在目标点 1 格内放反向传送门**，否则玩家会看到"落地 → 停 18 帧 → 被弹回去"。

**③ 对话/面板关闭的同一帧必须吞键，否则对话无限重开**

`engine.ts:255-261` 的 `wasUiOpen` 边沿检测就是为这个存在的（源码注释直接写了"对话无限重开"）。新项目如果重写主循环，**必须保留这三件事的组合**：

1. UI 从开到关那一帧 `Input.flush()` + `return`；
2. 每帧末尾 `Input.flush()`（`engine.ts:344`）；
3. `Input.consume()` 多次调用不能写 `||`（`engine.ts:279-282` 的注释）。

漏掉任何一条的表现都一样：按 E 打开对话 → 按 E 关闭 → **立刻又打开同一段对话**，玩家感觉"按键卡住了"。而且 `queueMapEntry`（`engine.ts:69-83`）也在等同一批 UI 关闭，漏了会让入场剧本在面板打开时抢跑。

**④ `applyEffects` 的顺序敏感 + `flag` 命名空间被 3 个"伪 flag"污染**

`store.ts:591-643` 是一个 53 行的 `for` 循环，其中 **3 处 `return` 会丢掉后面的所有 effect**：

| 位置 | 触发条件 |
|---|---|
| `store.ts:601` | `flag[0] === 'doSave'` → 打开存档面板后 `return` |
| `store.ts:639` | `e.ending` → 触发结局后 `return` |
| `store.ts:641` | `e.next` → 跳转剧本后 `return` |

所以 `[{ flag: ['doSave', 1] }, { toast: '已存档' }]` 里的 toast **永远不会执行**。

`battle` / `teleport` / `chapter` / `openDeduction` **不截断**循环，它们会继续执行后面的 effect，但彼此会覆盖状态。最容易踩的组合是 `battle` 后面跟 `next`：

```ts
{ t: 'do', do: [{ battle: 'shade1' }, { next: 'afterBattle' }] }   // ❌
```

`battle` 分支先 `set({ dialog: null })` 再 `startBattle()`（`store.ts:638`），循环继续；随后的 `next` 会 `startScript('afterBattle')` 把 `dialog` 重新设上。但此时 `mode` 已是 `'battle'`，而 `App.tsx:105` 只在 `mode === 'explore'` 时渲染 `<DialogBox />` —— **这段对话永远不会显示，玩家表现为"战斗结束后卡住"**。正确写法是：`teleport` 在前、`battle` 单独一个 `do` 步骤、战斗后的剧情全部交给 `EnemyDef.winScript`（`store.ts:1128` 会 `startScript(def.winScript)`）。

另外 `flag` 通道被挤进了 3 个关键字：`'doSave'`、`'useSavePointSupplies'`、`'caseNo'`（`store.ts:600,606,608`）。**它们会占用 flags 的键名**，如果新项目里真的有一个叫 `caseNo` 的剧情 flag，行为会被劫持。`caseNo` 那条还附带一整套副作用（解锁成就 + 回满血 + san+30 + 颜料补满 + toast，`store.ts:611-626`）—— 想要"只改章节号不恢复状态"必须改代码。

**⑤ `visibleEntities()` 无参调用每帧堆分配 + `SPRITES` 查表无兜底**

- `visibleEntities(target: EntityDef[] = [])`（`engine.ts:155`）的默认参数是 `[]`，**每次无参调用都新建数组**。`entitySolidAt`（`engine.ts:132`）和 `findInteract`（`engine.ts:177`）都不传 target，而 `blocked()`（4 采样点）每帧被调 2 次 + `stuck()` 2 次 → 每帧约 **8~10 次数组分配 + 全量实体遍历**。改成一个模块级 scratch 数组即可，纯收益。
- `renderer.ts:134` 的 `const spr = SPRITES[e.sprite]` 没有 `if (!spr) continue` 兜底。**在 `maps.ts` 里写了一个不存在的 `sprite` 名 → 整个渲染循环抛 TypeError → 画面冻结在上一帧**，而控制台报错的位置（`drawImage`）离真正的原因（地图数据）很远。同理 `PROPS`/`CHARS` 的注册漏一项就是同样症状。

**附加坑（不影响开工但要提前知道）**

- `drawBattle` 在渲染函数里 `world.t++`（`renderer.ts:695`），战斗时世界时间每帧 +2。
- `SFX` 名字拼错静默无效果（`audio.ts:1277-1278`）。
- **注册表"先 export 再追加"的写法**：`ICONS`（`portraits.ts:1043` 定义 9 项 → `:1200-1225` 追加 25 项）、`TILES`（`tiles.ts:247` 定义 13 项 → `:349-352` 追加 4 项）、`SCRIPTS`（`events.ts:43` 的 `Object.assign`）都是这种模式。**定义处与填充处相隔 100~200 行**，做静态分析或删减文件时容易漏掉后半段，漏了就是"图标空白/瓦片不画/剧本找不到"。
- `SpeakerId` 加一个人要改 3 处（`types.ts:54-57`、`DialogBox.tsx:9-27`、`portraits.ts:893-900`）。
- 加地图要改 3 处（`types.ts:91-95`、`maps.ts:608-611`、`store.ts:25-28`）。
- `handleInteract` 是 140 行的 `switch`（`events.ts:59-198`），无注册表；漏 case 只 `console.warn`（`events.ts:197`）。
- 4 个剧本文件靠 `Object.assign` 合并到一个 `SCRIPTS` 命名空间（`events.ts:43`），**重名静默覆盖**。

---

## 11. 若要换一套玩法（不再是"解谜+回合制"），这套引擎哪些部分会挡路

先把结论说清楚：**这套引擎是"俯视角 2D 探索 + 分支对话 + 数据驱动回合战"的专用骨架**。它能低成本支持：地图探索、NPC 对话、分支选择、证物收集、推理问答、点数式回合战、多结局、多周目。

它会**主动挡路**的地方，按严重程度排序：

### 11.1 全球单例 `world` —— 挡"多实体模拟"

`engine.ts:32-42`：

```ts
export const world: World = {
  map: MAPS.atelier,
  px: 6 * TILE + 8, py: 5 * TILE + 12,
  dir: 'down', moving: false, animT: 0,
  camX: 0, camY: 0, shakeT: 0,
  fog: [], t: 0,
  visionDrainT: 0, visionT: 0,
  interactTarget: null,
}
```

`World` 是一个模块级 `const`，里面**只有一个玩家**（`px/py/dir`）、**一张地图**（`map`）、**一个相机**（`camX/camY`）。`startEngine` 不会重置它（只 `seedFog()`，`engine.ts:202`）。

挡路场景：
- **要多个可控角色 / 队友跟随 / 敌人在地图上巡逻** → `World` 必须重构成实体列表 + 各自的移动逻辑；
- **要关卡切换后重置世界状态** → 现在没有 reset 入口，只能手动改字段；
- **要多场景同时存在（比如小地图预览、双世界并置）** → 单例直接把路封死。

改造成本：`World` 接口 + `tick()` 的移动段（`engine.ts:292-306`）+ 渲染的玩家段（`renderer.ts:124-132`），**约 2~3 人日**，且会连带影响 `bridge.getPos`/`bridge.teleport` 的所有调用点。

### 11.2 只有键盘输入 —— 挡"鼠标/触屏/手柄玩法"

`input.ts:1-64` 全部围绕 `keydown`/`keyup` 和 `Set<string>`。接口只有 `held / setHeld / axis / consume / flush`。

- **要鼠标点击地面移动、点选目标** → 需要新增 pointer 事件层 + 世界坐标换算（`canvas.getBoundingClientRect` + `scale`）；
- **要触屏** → 现在完全没有虚拟摇杆/按钮，`App.tsx` 里也没有任何 touch 监听；
- **要手柄** → 需接 Gamepad API 并映射进 `Input.axis()`。

改造是**加法，不是改法**（`Input` 的 `pressed`/`down` 双集合抽象是通用的），成本约 **1~2 人日**。但注意 `PREVENT` 集合（`input.ts:5-7`）会 `preventDefault` 方向键/空格/Enter，加鼠标时不要误依赖这个。

### 11.3 固定 5 种 `GameMode` —— 挡"新流程层"

`types.ts:2-7`：

```ts
export type GameMode = 'title' | 'chapter' | 'explore' | 'battle' | 'ending'
```

这 5 个值散落在：
- `engine.ts:74,249`（模式门控）
- `renderer.ts:90-96`（绘制分支）
- `App.tsx:94-106`（React 覆盖层条件渲染）
- `audio.ts:1294-1307`（选曲）
- `store.ts` 里 12 处 `set({ mode })`

**新增一个模式（比如"地图编辑模式""卡牌布阵模式""实时动作段"）要同时改这 5 个地方**，漏一处就是"进了新模式但画面还是旧模式"或"进了新模式但没声音"。

更麻烦的是 `mode !== 'explore'` 就 `Input.flush(); return`（`engine.ts:249`）—— **任何新模式都会天然冻结世界模拟**。如果新模式需要世界继续跑（比如"边打边跑"），这条 early return 就是直接的阻碍。

### 11.4 对话解释器是同步的 —— 挡"带演出/动画/等待的对白"

`settle()`（`store.ts:1061-1081`）是一个**同步 `for` 循环**，`do` 步骤立即穿透，`line`/`choice` 立即阻塞。`Effect` 里**没有 `wait` / `async` / 回调**字段。

挡路场景：
- **"说完这句，镜头推近，等 2 秒，再继续"** → 现在做不到，只能拆成多个 script + 手动 `setTimeout`（`store.ts` 里的战斗就是被迫这么干的，见 `store.ts:1021-1053` 三层嵌套 `setTimeout`）；
- **"打字机念完才能继续"** → 现在由 `DialogBox` 的本地 state 管（`:52` 的 `done`），**引擎不知道打字进度**，所以剧本层面无法做条件分支；
- **"对话中播放一段 Canvas 动画"** → 没有钩子。

改造成本：给 `Step` 加 `{ t: 'wait'; ms: number }` 并把 `settle` 改成 async 生成器，**约 2 人日**，但会波及 `advance`/`choose`/`applyEffects` 的调用者（都是同步的）。

### 11.5 战斗是"三条 setTimeout + 单敌扁平状态" —— 挡"实时/群战/技能树"

见 §6.5。具体挡路的点：

| 想要 | 现状 | 改造量 |
|---|---|---|
| 多个敌人 | `BattleState` 是扁平单敌（`types.ts:153-168`） | 重写 `BattleState` + `enemyAct` + `BattleUI`，**5~8 人日** |
| 实时战斗（ATB / 动作） | 结算靠 `setTimeout` 链（`store.ts:1021,1036,1040`），无游戏内时钟 | 重写，**10+ 人日** |
| 技能/装备系统 | 玩家 7 个指令硬编码（`store.ts:373,974-1019`） | 拆出指令表 + 效果解释器，**3~5 人日** |
| 战斗中逃跑 | `flee` 固定失败（`store.ts:1015-1018`） | 半小时 |
| 战斗暂停 | 无暂停概念，timer 不能挂起 | 1~2 人日 |

**注意**：敌人的**数据层**（`EnemyDef` / `EnemyMove` / `pool` 权重池 / `enrageAt`）设计得很干净，**这部分可以原样保留**，换玩法时真正要重写的只有 `battleCmd` + `enemyAct` 的 `switch`。

### 11.6 瓦片网格碰撞 + 4 点采样 —— 挡"非网格移动"

`blocked()`（`engine.ts:141-148`）是 4 点采样，移动是**逐轴独立推进**（`engine.ts:304-305`：

```ts
if (dx && (free || !blocked(world.px + dx, world.py))) world.px += dx
if (dy && (free || !blocked(world.px, world.py + dy))) world.py += dy
```

）—— 这是经典的"贴墙滑行"实现，**高度依赖轴对齐的瓦片网格**。

挡路场景：
- **斜坡 / 高低差 / 跳跃** → 需要地形高度层；
- **圆形/多边形碰撞** → 4 点采样完全不够（会卡角）；
- **大体积物体（>2 格）的实体碰撞** → 现在只有 `WIDE` 表按格数横向扩展（`engine.ts:121-129`），不支持任意包围盒；
- **高速移动穿透** → `speed = 1.35` 远小于 `TILE`，所以现在不会穿透；一旦加速到 >16 px/帧就会穿墙（没有 swept AABB）。

改造成本：**5~10 人日**，取决于目标玩法。

### 11.7 存档 schema 与新玩法脱钩 —— 挡"复杂进度"

`SaveData`（`types.ts:179-189`）里只有 `hp/san/pigment/items/clues/flags/map/x/y/caseNo`。

- 如果新玩法有**卡组 / 背包 / 技能树 / 任务列表** → 全部得塞进 `flags`（`Record<string, boolean|number>` 装不下数组和对象）或新增字段 + 改 `parseSaveData`（`store.ts:127-160`，100 行的严格校验器，加字段要同步加校验）+ 改 `SaveFileData` 版本号。
- 存档版本是 `version: 1` 硬编码（`store.ts:22`，`types.ts:227`），**没有版本迁移框架**，只有针对旧版的两个一次性补丁（`store.ts:205-217` 和 `:501-506`）。第 2 版 schema 要做向后兼容，得自己搭迁移链。

好消息：`localBackend` 抽象（`localBackendContract.ts`）已经把"存储"和"格式"分开了，加字段只需改 `parseSaveData` 与 `SaveData`，不必动后端。

### 11.8 会被 UI 层"锁死"的交互假设

React 覆盖层与引擎的互斥是**字段级硬编码**的（§7.2）。新玩法如果需要：

- **HUD 实时显示（不是每帧重渲染 React）** → 现在 HUD 全走 store 订阅，`san` 每 90 帧变化一次还好；如果改成每帧变化，React 会每帧重渲染。需要改成向 Canvas 内画或用 CSS 变量 + `requestAnimationFrame` 直接改 DOM。
- **面板叠面板（比如存档面板里再开一个确认框）** → 现在 `uiOpen` 是 `||` 并联布尔（`engine.ts:251`），没有"栈"的概念。`SaveScreen` 的 `pending` 确认框是靠组件内部 state 实现的（`SaveScreen.tsx:26`），属于特例。
- **拖拽 / 长按 / 双击** → 现在所有 UI 都是 `onClick`。

---

## 12. 纯网页单文件交付的可行性

**结论：完全可行，而且这套代码天然就是为这件事写的。** 实测已有产物 `release/Calabiyau MDL 0.1.0 单文件网页版.html` = **520,934 字节**，双击即可运行，无需服务器。

### 12.1 为什么天然可行

| 依赖项 | 现状 | 单文件影响 |
|---|---|---|
| 美术资源 | 全部是代码里的字符网格，`px()` 在模块加载时生成 `HTMLCanvasElement` | **零文件** |
| 音频资源 | 全部 WebAudio 实时合成，`TRACKS` 是谱面字符串，`SFX` 是函数 | **零文件** |
| 字体 | 系统字体栈 `"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif`（`styles.css:19`）+ `monospace`（Canvas 用，`renderer.ts:236`） | **零文件** |
| 图片 | 无 `<img>`，无 `url()` | **零文件** |
| 网络请求 | 无 `fetch`、无 `XMLHttpRequest`、无 CDN | **可离线** |
| 存储 | `localStorage`（8 槽 × ~2 KB）+ 可选 JSON 导入导出 | 受 5 MB 配额限制，实际用不到 1% |

`vite.config.ts:7` 的 `base: './'` 已经为相对路径部署准备好（这一项对单文件**不是必需**，但对"直接打开 index.html"有用）。

### 12.2 打包链路（已实装，无需新写）

```
npm run web:single
  = tsc -b                                    // 类型检查
  && vite build --mode single-html            // 单入口构建，产出 dist/index.html + assets
  && node scripts/package-single-html.mjs     // 内联 CSS/JS，校验无外部引用，输出 release/
```

`package-single-html.mjs` 的 3 道保险（见 §5.5）：CSS 里的 `url()` 必须全是 `data:`/`#`；内联后不能残留任何 `<script|img|audio|video|source src>` 或 `<link href>`；`</script`/`</style` 要转义。**新项目照抄这个脚本，改两行即可**：

```js
const targets = {
  main: {
    entryName: 'index.html',
    outputName: `你的游戏名 ${packageData.version} 单文件网页版.html`,
  },
}
```

### 12.3 需要**保留**的部分

| 保留项 | 理由 |
|---|---|
| `src/game/**` 全部（除数据） | 引擎本体 |
| `src/ui/**` + `src/styles.css` | 覆盖层 UI，纯 DOM，无外部依赖 |
| `src/platform/localBackend.ts`（**只保留 `browserBackend`**） | `getLocalGameBackend()` 在 `window.localGameBackend` 不存在时自动回退（`localBackend.ts:196`），所以**不改代码也能跑** |
| `index.html` + `src/main.tsx` | 入口 |
| `vite.config.ts`（`base: './'`） | 相对路径 |
| `scripts/package-single-html.mjs` | 内联器 |
| `package.json` 的 `web:single` 脚本 | 一键出包 |
| `tsconfig.json` | `noEmit: true` 的检查配置 |

**关键点：`localBackend.ts` 不需要任何改动。** `getLocalGameBackend()` 的签名是：

```ts
export function getLocalGameBackend(): LocalGameBackend {
  return typeof window !== 'undefined' ? (window.localGameBackend ?? browserBackend) : browserBackend
}
```

纯浏览器环境下 `window.localGameBackend` 永远是 `undefined` → 永远走 `browserBackend`（localStorage + Blob 下载 + `<input type=file>` 导入）。**Electron 分支是纯粹的加装，不构成依赖。**

### 12.4 需要**删掉**的部分

| 删除项 | 大小 | 说明 |
|---|---|---|
| `electron/`（`main.ts` 4.6 KB、`backend.ts` 5.5 KB、`preload.cts` 1.7 KB、`tsconfig.json`） | ~12 KB | 桌面壳 |
| `dist-electron/` | 构建产物 | 同上 |
| `tsconfig.electron.json` | 501 B | 同上 |
| `electron-builder.yml` | 277 B | 同上 |
| `installer/calabiyau-mdl.iss` | 1.5 KB | Inno Setup 脚本 |
| `scripts/package-electron.mjs` | 3.4 KB | 同上 |
| `package.json` 里的 `electron` / `electron-builder` / `concurrently` / `wait-on` 四个 devDependencies | 约 30 MB node_modules | 打包器不需要 |
| `package.json` 里的 `main` 字段（`dist-electron/electron/main.js`） | — | 会误导 `npm start` |
| `package.json` 里的 `electron:build` / `electron:dev` / `build:desktop` / `electron:package` 四个脚本 | — | 同上 |
| `src/bgm/**`（5 文件 55 KB）+ `bgm.html` + `dev:bgm` / `export:bgm` | 约 55 KB | BGM 编辑器（可选：留着当调音工具，`vite build` 多入口会把它打进 dist，但 `web:single` 模式只取 `index.html` 一个入口，**不影响单文件产物**） |
| `src/sequel/**`（约 650 KB + `sequel/engine.ts` 305 KB 单文件） | 约 650 KB | 第二部；`portraits.ts:2` 的依赖要一并断开 |
| `sequel.html` + `src/sequel/main.tsx` | — | 同上 |
| `scripts/check-sequel-*.mjs`（5 个） | 约 30 KB | 第二部的校验脚本 |
| `scripts/dev-launcher.mjs` | 4.4 KB | 可选保留（多入口时有用），单入口时可换回 `vite` |
| `dist/` 里的 `*.wav` | 最大 29.5 MB | `export-bgm.mjs` 的副产品，**不在 git 里应被 ignore**，但会污染构建目录 |

**删除顺序注意事项**：先删 `src/sequel/`，再改 `portraits.ts:2` 的 import 和 `:894-895` 的 `PORTRAITS.mdl` / `PORTRAITS.mdlWorry`（改回本文件里的 `mdl` / `mdlWorry`），否则 `tsc -b` 会因为找不到模块而失败。

### 12.5 纯网页交付的 3 个真实风险

| 风险 | 严重度 | 说明与对策 |
|---|---|---|
| **`file://` 下的 `type="module"` 限制** | 中 | 单文件 HTML 内联的 `<script type="module">` 在 `file://` 协议下，**现代浏览器是可以执行的**（因为无跨域 import），但部分旧 WebView/内嵌浏览器的 CORS 策略更严。对策：若目标环境不确定，可在 `package-single-html.mjs` 里把 `type="module"` 去掉（Vite 默认输出 ESM，但单 chunk 内联后已是自执行代码，通常可行；需实测）。当前项目的实测产物是保留 `type="module"` 的（`package-single-html.mjs:64`）。 |
| **`localStorage` 在 `file://` 下的隔离** | 中 | Chrome/Edge 对 `file://` 的 localStorage 按"文件路径"隔离，且部分版本会在隐私设置下禁用。对策：①保持"导出/导入 JSON 存档"这条兜底路径（已实装，`store.ts:753-829`）；②文档里告知玩家"存档在浏览器内，换电脑请导出"。 |
| **`AudioContext` 自动播放策略** | 低（已解决） | 浏览器要求首次用户手势后才能出声。`App.tsx:41-52` 已经用 `pointerdown` + `keydown` 双保险 + `visibilitychange` 恢复，实测可用。新项目**必须保留这段**，否则玩家会以为游戏没声音。 |

### 12.6 交付清单（纯网页单文件）

```
交付物
├─ <游戏名> <version> 单文件网页版.html      ← 唯一的运行文件（约 500 KB ~ 1.5 MB，取决于代码量）
└─ README.md                                 ← 操作说明 + 存档位置说明 + 免责声明

构建命令
  npm run web:single

验收清单
□ 双击 HTML 能进标题画面
□ 能听到 BGM（首次点击后）
□ 能存/读/删档，刷新浏览器后存档仍在
□ 能导出 JSON 并重新导入
□ 断网后功能完全正常（DevTools → Network → Offline 验证）
□ 页面缩放到 1920×1080 时是整数 5 倍，像素不糊
```

---

## 附录：关键行号速查表

| 主题 | 位置 |
|---|---|
| 内部分辨率 | `engine.ts:12-13` |
| 世界单例 | `engine.ts:32-42` |
| 雾初始化 | `engine.ts:44-56` |
| 相机 | `engine.ts:62-67` |
| 传送入口 | `engine.ts:91-105` |
| 延迟入场 | `engine.ts:69-83` |
| 瓦片碰撞 | `engine.ts:109-118` |
| 宽精灵表 | `engine.ts:121-129` |
| 实体碰撞 | `engine.ts:131-139` |
| 玩家碰撞盒 | `engine.ts:141-148` |
| 脱困安全阀 | `engine.ts:151-153, 303` |
| 交互判定 | `engine.ts:168-188` |
| 主循环 | `engine.ts:196-211` |
| 单帧逻辑 | `engine.ts:223-345` |
| UI 互斥 | `engine.ts:249-273` |
| 彩绘之眼消耗 | `engine.ts:264-271` |
| 传送门 | `engine.ts:309-329` |
| 场景绘制总入口 | `renderer.ts:84-242` |
| 深度排序 | `renderer.ts:28-35` |
| 瓦片剔除 | `renderer.ts:103-115` |
| 实体绘制 | `renderer.ts:122-148` |
| 黑暗层 | `renderer.ts:150-167` |
| 打光 | `renderer.ts:244-252` |
| 雾 | `renderer.ts:185-199` |
| vision 滤镜 | `renderer.ts:201-226` |
| SAN 扭曲 | `renderer.ts:261-284` |
| vision 异常 | `renderer.ts:286-361` |
| 战斗画面 | `renderer.ts:692-754` |
| 像素画构建器 | `build.ts:26-44` |
| 调色板 | `build.ts:6-24` |
| 瓦片注册表 | `tiles.ts:247-261` |
| 实心瓦片集 | `tiles.ts:263, 353-354` |
| 地图样例 | `maps.ts:7-44`（atelier） |
| 地图注册 | `maps.ts:608-611` |
| 交互路由 | `events.ts:45-199` |
| 入场剧本 | `events.ts:202-225` |
| 类型总表 | `types.ts:2-237` |
| 状态库 | `tinyStore.ts:14-45` |
| store 接口 | `store.ts:309-374` |
| 剧本解释器 | `store.ts:1061-1081` |
| Effect 派发 | `store.ts:591-643` |
| 存档校验 | `store.ts:127-160` |
| 成就/周目校验 | `store.ts:68-107` |
| 存/读/导/入 | `store.ts:707-829` |
| 结局判定 | `store.ts:837-891` |
| 战斗指令 | `store.ts:962-1054` |
| 敌人行动 | `store.ts:1132-1225` |
| 意图抽取 | `store.ts:383-395` |
| 敌人数据 | `enemies.ts:4-120` |
| localStorage 后端 | `localBackend.ts:83-193` |
| 后端接口 | `localBackendContract.ts:47-57` |
| 单文件内联 | `scripts/package-single-html.mjs:41-80` |
| 音频总线 | `audio.ts:75-215` |
| 曲目表 | `audio.ts:611-802` |
| 音序器 | `audio.ts:804-805, 1030-1071` |
| 切歌 | `audio.ts:1072-1100` |
| 音效表 | `audio.ts:1234-1273` |
| 场景选曲 | `audio.ts:1293-1308` |
| 场景联动 | `audio.ts:1314-1332` |
| React 合成根 | `App.tsx:87-113` |
| 缩放计算 | `App.tsx:20-24` |
| 全局快捷键 | `App.tsx:55-85` |
| Canvas 生命周期 | `GameCanvas.tsx:7-10` |
| 打字机 | `DialogBox.tsx:42-50` |
| 目标提示 | `HUD.tsx:4-46` |
| 推理流程 | `DeductionBoard.tsx:37-64` |
| 战斗 UI | `BattleUI.tsx:13-49` |
| 存档界面 | `SaveScreen.tsx:86-153` |
