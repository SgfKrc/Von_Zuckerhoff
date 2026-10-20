"""把参考图处理成游戏立绘。

素材本身就是像素画（256 级别原生，无抗锯齿），所以：
- NEAREST 还原到 256×256 原生尺度，**不做任何平滑**
- 从四角 flood fill 抠背景（泛洪而非阈值：围裙、领子上的白色被轮廓线围住，不会误删）
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "portraits"
NATIVE = 256

# (输出名, 源文件)
JOBS = [
    ("ftz", "docs/refs/friedrich-ref.png"),
    ("emma", "docs/refs/emma-ref.jpeg"),
    ("hermann", "docs/refs/hermann-ref.png"),
    ("hermann-void", "docs/refs/hermann-void-ref.png"),
    ("marta", "docs/refs/marta-ref.png"),
]


def cutout(img: Image.Image, tol: int = 28) -> Image.Image:
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


def process(name: str, src: str) -> None:
    path = ROOT / src
    if not path.exists():
        print(f"跳过 {name}（缺 {src}）")
        return
    img = Image.open(path).convert("RGBA")
    img = img.resize((NATIVE, NATIVE), Image.NEAREST)
    img = cutout(img)
    dst = OUT / f"{name}.png"
    img.save(dst, "PNG", optimize=True)
    print(f"{name}: {dst.stat().st_size / 1024:.1f} KB  {NATIVE}x{NATIVE}")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, src in JOBS:
        process(name, src)
