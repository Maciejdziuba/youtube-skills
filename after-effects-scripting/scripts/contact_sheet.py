#!/usr/bin/env python3
"""contact_sheet.py <shots-dir> <out-dir> [cols]

Stitches proof frames into one image you can actually look at.
Writes a timestamped filename so a viewer never shows you a stale sheet.
"""
import sys, glob, time, os
from PIL import Image, ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

shots = sys.argv[1]
outdir = sys.argv[2] if len(sys.argv) > 2 else shots
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3

files = sorted(glob.glob(os.path.join(shots, "*.png")))
if not files:
    print("no frames found in", shots); sys.exit(1)

W = 1410 // cols
ims = []
for f in files:
    im = Image.open(f).convert("RGB")
    ims.append(im.resize((W, int(W * im.height / im.width)), Image.LANCZOS))

h = ims[0].height
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (W * cols, h * rows), (12, 12, 14))
for i, im in enumerate(ims):
    sheet.paste(im, ((i % cols) * W, (i // cols) * h))

out = os.path.join(outdir, "sheet_%s.png" % time.strftime("%H%M%S"))
sheet.save(out)
print("SHEET:", out, "(%d frames)" % len(ims))
