# FigJam Height-Threshold Series

Fine series to pin the exact FigJam scramble cap. Group A of
`../make_figjam_test_variants.py` bracketed it:

- `outcome.scale-0.45.svg` → h=468 → **CLEAN**
- `outcome.scale-0.60.svg` → h=625 → **SCRAMBLED**

So the trigger height is in the open interval **(468, 625)**. This series fills
that gap at 20px steps, using the **same** uniform-scale mechanism
(`<g transform="scale(s)">` + proportionally reduced `width`/`height`/`viewBox`)
so results are directly comparable to group A.

Regenerate with:

```
python3 ../make_figjam_threshold_series.py
```

## Files

| file | canvas height | scale | RESULT (fill in) |
|---|---|---|---|
| `outcome.h-480.svg` | 480 | 0.461 | CLEAN |
| `outcome.h-500.svg` | 500 | 0.480 | SCRAMBLED |
| `outcome.h-520.svg` | 520 | 0.500 | SCRAMBLED |
| `outcome.h-540.svg` | 540 | 0.519 | SCRAMBLED |
| `outcome.h-560.svg` | 560 | 0.538 | SCRAMBLED |
| `outcome.h-580.svg` | 580 | 0.557 | SCRAMBLED |
| `outcome.h-600.svg` | 600 | 0.576 | SCRAMBLED |
| `outcome.h-620.svg` | 620 | 0.596 | SCRAMBLED |

## How to read

Import each into FigJam and mark **CLEAN** or **SCRAMBLED**. The **clean →
scrambled crossover** is the cap:

- last CLEAN height = safe export ceiling (use a margin below it).
- first SCRAMBLED height = the cap itself.

## Result — threshold PINNED

Crossover found: **h=480 CLEAN → h=500 SCRAMBLED** (520–620 all SCRAMBLED).

- **Cap is in (480, 500] px canvas height.**
- **Safe export ceiling: 480 px** (use a margin below it for production).

Aspect was held constant across the series (uniform scale, w/h ≈ 1.152), so the
crossover isolates **absolute height** — not width, area, or aspect. Cross-checked
against the originals: width is ruled out (clean `journey_map` is 4314 wide >
scrambled `outcome` at 1199) and area is ruled out (clean `journey_map` 2.05M >
scrambled `outcome` 1.25M). See `../figjam_test_variants/README.md` for the full
conclusion and fix direction.

All eight are XML well-formed; heights, viewBox, and scale were validated.
