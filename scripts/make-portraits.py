"""把 1:1 参考图处理成游戏立绘：缩放到 96x96、抠背景、量化到有限调色板、输出 RGBA PNG。

背景抠除用「从四角 flood fill」而不是全局阈值——这样人物内部的白色（艾玛的
围裙、帽子）不会被误删，因为轮廓线把它们和外部隔开了。
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "portraits"


def cutout(img: Image.Image, tol: int = 34) -> Image.Image:
    """从四角泛洪填充背景，得到透明底。"""
    img = img.convert("RGBA")
    w, h = img.size
    key = (255, 0, 255, 255)
    for xy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        try:
            ImageDraw.floodfill(img, xy, key, thresh=tol)
        except Exception:
            pass
    px = img.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] == key:
                px[x, y] = (0, 0, 0, 0)
    return img


def quantize_rgb(img: Image.Image, colors: int = 48) -> Image.Image:
    """只量化 RGB，保留 alpha。"""
    alpha = img.getchannel("A")
    rgb = img.convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def process(name: str, src: str, size: int = 96, colors: int = 48) -> None:
    src_path = ROOT / src
    img = Image.open(src_path)
    img = img.resize((size, size), Image.LANCZOS)
    img = cutout(img)
    img = quantize_rgb(img, colors)
    dst = OUT / f"{name}.png"
    img.save(dst, "PNG", optimize=True)
    print(f"{name}: {dst.stat().st_size / 1024:.1f} KB  {size}x{size}")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    process("ftz", "docs/refs/friedrich-ref.png")
    process("emma", "docs/refs/emma-ref.jpeg")
