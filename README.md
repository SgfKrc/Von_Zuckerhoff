# 冯·祖克霍夫 · 宝石

像素风黑暗哥特解谜 RPG。改编自小说《冯·祖克霍夫》第一部《宝石》。

> **当前状态：垂直切片（序章 + 第一章）**
> 引擎、图纸、对话、存档、成就已跑通；美术与剧本仍在精修。

---

## 运行

```bash
npm install
npm run dev        # http://127.0.0.1:5180
npm run build      # 产物在 dist/
npm run web:single # 单文件 HTML（后续接）
```

## 操作

| 键 | 功能 |
| --- | --- |
| 方向键 / WASD | 移动 |
| E / 空格 / 回车 | 调查、对话推进、选项确认 |
| Tab | 图纸（Blueprint）开 / 关 |
| **I** | **背包**（查物品、用糖、看线索） |
| **K** | 成就 |
| 1–9 | 对话选项快选 |
| F5 | 存档 / 读档 |
| Esc | 暂停菜单 / 关闭面板 |

背包内：方向键选择、`Enter` / `空格` / `E` 使用、`K` 切到成就、`I` / `Esc` 关闭。调查到的关键物（信、胸针、行李箱里的线图）会**收进背包**，之后从背包查看，而不是在场景里反复读同一段文本。

## 切片范围

- **序章 · 糖堡站**：列车 → 站台 → 雾中山路 → 古堡正门 → 门厅 → 夜游 → 卧室
- **第一章 · 糖庄**：早餐 → 图书室（家族史）→ 画廊 → 石桥（时计塔测量）→ 地窖（铁门）→ 花园 → 接待厅

已实装系统：

| 系统 | 状态 |
| --- | --- |
| 移动 / 碰撞 / 相机 / 传送 | ✅ |
| 地图三层数据（tiles / struct / revisions） | ✅ |
| 对话解释器（line / choice / do）、flag、选项条件 | ✅ |
| 图纸模式（Tab）：线框渲染、结构符号、缺笔 / 缺页 | ✅ |
| 补图小游戏（门厅拱肋） | ✅ |
| 确信 Conviction（含归零结局「弃婴」） | ✅ |
| 糖 / 甜度 / 墨水 | ✅ |
| 存档（8 槽 + 自动）、JSON 导出导入 | ✅ |
| 成就（7 项） | ✅ |
| 章节卡、标题、结局画面 | ✅ |
| WebAudio 场景音频（drone / 钟 / 雨 / 铁轨） | ✅ |
| 背包与物品（I 键，7 件物品，可使用糖/墨水） | ✅ |

## 校验

```bash
node scripts/check-map.mjs       # 地图网格：等宽、struct 对齐、传送点越界
node scripts/check-content.mjs   # 内容引用：未注册精灵、无效交互、断掉的 next
node scripts/check-entity.mjs    # 实体可达性：四周全阻挡 = 玩家点不到
npx tsc --noEmit                 # 类型
```

四个检查各有分工，`check-entity` 是最新补的——它抓到了门厅里两幅被墙完全围住的画像（玩家根本走不到），这类问题肉眼看不出来。

**改动地图后必须跑 `check-map`**——这是本项目最容易出错的地方（每行必须等宽、struct 与 tiles 尺寸一致）。

## 调试入口

URL 参数可直接跳场景：

```
?start=1&map=hall&x=13&y=8        # 直接进入门厅
?start=1&map=hall&bp=1            # 同时打开图纸
?start=1&map=hall&bp=1&repair=1   # 直接打开补图小游戏
```

## 目录

```
src/
├── App.tsx                 主布局与全局键盘
├── styles.css              哥特 UI 样式
├── game/
│   ├── types.ts            全部类型契约（改前先看）
│   ├── constants.ts        视口常量（避免循环依赖）
│   ├── store.ts            状态 + 对话解释器 + 存档 + 成就
│   ├── tinyStore.ts        微型状态库
│   ├── bridge.ts           引擎 ↔ 应用 的桥
│   ├── audio.ts            WebAudio 合成
│   ├── engine/
│   │   ├── engine.ts       主循环、碰撞、交互、传送、图纸节流
│   │   └── input.ts        键盘
│   ├── render/
│   │   └── renderer.ts     瓦片 / 实体 / 角色 / 光照 / 雾 / 图纸层
│   ├── art/
│   │   ├── build.ts        像素构建器（px / flipX / tinted）
│   │   ├── tiles.ts        19+ 块瓦片 + 调色板 + 结构符号
│   │   ├── sprites.ts      角色（16×24）与家具
│   │   └── (portraits)     立绘（进行中）
│   ├── world/
│   │   ├── maps.ts         14 张地图（tiles + struct + entities + portals）
│   │   └── events.ts       交互分派与入场脚本
│   └── data/
│       ├── script.ts       剧本（序章 + 第一章）
│       ├── chapters.ts     章节定义
│       └── achievements.ts 成就
└── ui/                     标题 / 章节卡 / 对话框 / HUD / 存档 / 成就 / 补图 / 结局
```

## 设计文档

全部在 `docs/`。**开工前先读**：

- `docs/design/GAME_CONCEPT.md` — 游戏概念
- `docs/design/SYSTEM_DESIGN.md` — 系统规则
- `docs/design/MYTHOS.md` — 里线神话（剧透，一周目完前别看）
- `docs/story/CHAPTER_OUTLINE.md` — 13 章剧本
- `docs/levels/LEVEL_DESIGN.md` — 13 章关卡
- `docs/README.md` — 索引与一致性约定

## 声明

基于 sgfd8314 的小说《冯·祖克霍夫》的非商业改编。含恐怖氛围与轻度暴力暗示，无血腥直接描写。
