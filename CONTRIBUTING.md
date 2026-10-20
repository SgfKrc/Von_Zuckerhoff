# 贡献约定

本项目以「文档先行 + 数据驱动」的方式开发。改动代码前，先确认它对应哪份设计文档。

## 开工前必读

| 文档 | 何时读 |
| --- | --- |
| [docs/README.md](docs/README.md) | 第一次进入项目 |
| [docs/design/GAME_CONCEPT.md](docs/design/GAME_CONCEPT.md) | 改玩法、加系统 |
| [docs/design/WORLD_SETTING.md](docs/design/WORLD_SETTING.md) | 写任何文本 |
| [docs/story/CHAPTER_OUTLINE.md](docs/story/CHAPTER_OUTLINE.md) | 写剧本 |
| [docs/levels/LEVEL_DESIGN.md](docs/levels/LEVEL_DESIGN.md) | 做地图、配谜题 |
| [docs/design/MYTHOS.md](docs/design/MYTHOS.md) | **只在实现里线时**（含重大剧透） |

## 提交前必须跑

```bash
npx tsc --noEmit
node scripts/check-map.mjs
node scripts/check-content.mjs
node scripts/check-entity.mjs
npm run build
```

CI 会跑同样的五步。四个脚本各有分工，别跳过：

- `check-map` —— 地图网格等宽、struct 对齐、传送点不越界
- `check-content` —— 未注册精灵、无效交互、断掉的 `next` 目标
- `check-entity` —— 带交互的实体是否至少一侧可走（防"画像挂在墙里永远点不到"）

## 几条硬规则

1. **不要用正则整块替换 `maps.ts` 里的地图定义**。`(?s)const X: GameMap = \{.*?\n\}\n\n` 在文件末尾会吃掉下一个定义。用锚点 `IndexOf` 插入，或人工编辑。
2. **同一块瓦片密排会变成另一种东西**：石地密排成墙、桌子密排成文件柜。判断方法——把画面给没看过设计的人看，问"这是哪里"。
3. **参考图只用于提炼形象**，立绘与行走图必须是代码内像素绘制。远景图是唯一例外。
4. **台词标「原」必须能对到原作行号**（见 `docs/story/SOURCE_SYNOPSIS.md`），标「新」的必须过 `NARRATIVE_DESIGN.md §7` 的口吻检查。
5. **眼部下方不许画暗线**——见 `ART_AUDIO_SPEC.md §11.6`，那是"显老"的元凶。

## 分支

- `main` 保持可构建、校验全绿
- 功能分支用 `feat/<名字>`，修 bug 用 `fix/<名字>`
- 一个 PR 只做一件事；改设计的 PR 必须同时改对应文档
