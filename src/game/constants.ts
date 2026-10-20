// 视口常量（独立文件，避免 engine 与 renderer 的循环依赖在模块顶层求值）
export const VIEW_W = 384
export const VIEW_H = 216
export const TILE_SIZE = 16

// 远景素材（ART_AUDIO_SPEC §6：远景允许外部图片）。
// Vite 的 public/ 原样服务，base 为 './'，所以用相对路径；单文件打包脚本会把
// 这个字面量替换成 base64 data URI。
export const GOTHIC_BG_SRC = './bg/gothic.jpg'
