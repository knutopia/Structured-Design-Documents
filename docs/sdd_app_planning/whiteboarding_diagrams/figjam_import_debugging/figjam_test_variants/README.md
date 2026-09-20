# FigJam Import Test Variants

Purpose: isolate **why** three staged-renderer SVGs import "scrambled" into
FigJam (text too large, strokes too fat) while three others import correctly.

- ❌ fail: `scenario_flow`, `ui_contracts`, `outcome_opportunity_map`
- ✅ ok:   `ia_place_map`, `journey_map`, `service_blueprint`

These are **import-probe artifacts only**. They do not change the renderer.
Regenerate with:

```
python3 make_figjam_test_variants.py
```

## The discriminator under test

Static comparison of the six originals found one clean split — **absolute canvas
height**:

| result | view | width × height |
|---|---|---|
| ✅ ok | service_blueprint | 3304 × **152** |
| ✅ ok | ia_place_map | 912 × **392** |
| ✅ ok | journey_map | 4314 × **475** |
| ❌ fail | outcome_opportunity_map | 1199 × **1041** |
| ❌ fail | scenario_flow | 1572 × **2322** |
| ❌ fail | ui_contracts | 1776 × **3056** |

All successes are ≤ 475 tall; all failures are ≥ 1041 tall. **Width does not
separate them** (journey is 4314 wide and OK; ui_contracts is 1776 wide and
fails). **Orientation does not separate them** (outcome is wider-than-tall yet
fails). The `<defs>` CSS of failing `outcome_opportunity_map` is byte-identical
to succeeding `journey_map`, so "FigJam ignores `<style>`" alone cannot explain
the split.

The symptom (text too large **and** strokes too fat **and** scrambled) is
consistent with a **uniform scale-up** applied by the importer, not with CSS
being dropped (dropping CSS would make strokes *thinner*, not fatter).

## How to run the test

Import each file below into FigJam (drag-and-drop or File → Place image) and
record whether it renders **correctly** or **scrambled**. Compare against the
"expected if hypothesis H is true" columns.

## Variant groups

### A. Size series — `outcome.scale-*.svg`

The smallest failing file (`outcome_opportunity_map`, h=1041) uniformly scaled
via a root `<g transform="scale(s)">`, with `width`/`height`/`viewBox` reduced to
match. Everything (text, strokes, geometry) shrinks together.

| file | height | expected if **height-threshold** is the cause | expected if **CSS-drop** is the cause | RESULT |
|---|---|---|---|
| `outcome.scale-1.00.CONTROL.svg` | 1041 | scrambled (control) | scrambled | SCRAMBLED |
| `outcome.scale-0.60.svg` | 625 | scrambled (still > 475) | scrambled | SCRAMBLED |
| `outcome.scale-0.45.svg` | 468 | **correct** (just under 475) | scrambled | CLEAN |
| `outcome.scale-0.30.svg` | 312 | **correct** | scrambled | CLEAN |

**Read:** if the small variants flip to correct while the control stays
scrambled, a size/height threshold is confirmed. If all stay scrambled, size is
not the trigger. RESULT: CONFIRMED

### B. Width padding — `outcome.width-pad-4000.svg`

Same drawing, height kept at **1041**, canvas widened to 4000 (landscape).

**Read:** if it **still fails**, height (not width, not orientation) is the
trigger. If it now succeeds, the trigger is orientation/aspect, not height.

RESULT: SCRAMBLED

### C. CSS control — `ia_place_map.no-css.svg`

A **succeeding** file with its rule-bearing `<style>` block removed
(`@font-face` kept). This proves the `<style>` CSS is what sets text size and
stroke width.

**Read:** if it now scrambles, CSS is confirmed as the size/stroke source — which
means the failing files (carrying identical CSS) must fail for a *different*
reason (size), reinforcing groups A/B. If it still renders correctly, FigJam is
sourcing size from somewhere other than this CSS, and the CSS hypothesis is
wrong.

RESULT: SOLID BLACK

### D. CSS inlined — `outcome.css-inlined.svg`

A **failing** file with simple `.class { … }` declarations baked into
per-element presentation attributes (`font-size`, `font-family`, `font-weight`,
`fill`, `stroke`, `stroke-width`, `stroke-dasharray`, `line-height`,
`letter-spacing`); the rule `<style>` block is removed, `@font-face` kept, and
**absolute size is unchanged** (h=1041).

RESULT: SCRAMBLED

**Read:**
- still scrambled → **size dominates**; CSS delivery is not the cause.
- now correct → **CSS-dropping was the real cause**; the fix is to inline
  presentation attributes in the renderer.

> Note: only single-class selectors are inlined. Descendant-only rules (e.g.
> `.shared-node .scene-text { fill: … }`) set **color only**, not size or stroke
> width, so omitting them cannot affect the "too large / too fat" symptom.

## Decision matrix

Each column is normalized to one axis: **does the result SUPPORT that hypothesis?
(yes / no)**. The probes work in two directions, which is why the raw observations
differ:

- A, B, D start from a **failing** file and try to **fix** it → `correct` = yes.
- C starts from a **succeeding** file and tries to **break** it (negative control)
  → `scrambled/black` = yes (proves the `<style>` CSS carries the paint).

| probe | question (normalized) | OBSERVED | supports? |
|---|---|---|---|
| A | small height → correct? | clean at h≤468, scrambled at h≥625 | **YES** |
| B | wide canvas → correct? | scrambled (h still 1041) | **NO** |
| C | remove CSS from a good file → broken? | SOLID BLACK (default `fill:black`) | **YES** |
| D | inline CSS into attrs (same size) → correct? | scrambled | **NO** |

**Outcome row: A=yes, B=no, C=yes, D=no → HEIGHT/SIZE THRESHOLD.**

## Conclusion (from actual FigJam results)

**The trigger is absolute canvas HEIGHT, not CSS, width, area, or orientation.**

- **C (solid black)** proves FigJam *does* read and apply the `<style>` CSS: with
  CSS present the file renders correctly; with CSS removed, every shape falls back
  to SVG's default `fill: black`. So CSS is **not** being ignored in the failures.
- **D (scrambled)** — inlining the same CSS into per-element attributes at the same
  size changes nothing → CSS *delivery* is not the cause.
- **B (scrambled)** — widening to 4000 while keeping height 1041 does not help →
  width/orientation is not the trigger.
- **A (clean when small)** — uniform scale-down flips to clean between h=625
  (scrambled) and h=468 (clean).

Cross-check with the originals confirms **height alone** splits them:
`journey_map` is 4314 **wide** × 475 tall and imports **clean**, so width and area
are irrelevant. All clean files are ≤ 475 tall; all scrambled files are ≥ 1041 tall.
Width is ruled out (clean journey_map at 4314 wide > scrambled outcome at 1199);
area is ruled out (clean journey_map at 2.05M > scrambled outcome at 1.25M).

**Threshold: PINNED to (480, 500] px canvas height.** The fine series in
`../figjam_threshold_series/` (uniform scale, aspect held constant at w/h=1.152)
found h=480 CLEAN and h=500 SCRAMBLED, with 520–620 all SCRAMBLED. Use **480 px**
as the safe export ceiling (or lower, with margin).

### Likely mechanism (hypothesis, symptom-consistent)

The scale variants are *visually identical* to the original in a browser (the
`<g transform="scale(s)">` and the reduced `viewBox` cancel), yet FigJam scrambles
the large-coordinate version and not the small one. So FigJam reacts to the
**absolute coordinate/dimension magnitude**. The symptom — geometry compressed but
text too large and strokes too fat — fits: **above a height cap FigJam scales the
shape geometry down to fit, but applies `font-size` and `stroke-width` at their
authored absolute values**, so they look oversized relative to the shrunk geometry.

### Important framing

This is a **FigJam importer limitation, not an SDD renderer defect.** The SVGs are
spec-correct: the `png/` renders and browser rendering are both faithful. The
"fix" is an **export accommodation** for FigJam, not a correction to the diagram
semantics or the staged pipeline.

### Fix direction (proven by variant A)

Variant A imported **clean** by uniformly scaling the whole drawing so the canvas
height falls under the cap (`<g transform="scale(s)">` + proportionally reduced
`width`/`height`/`viewBox`). The accommodation is therefore a **FigJam-targeted
export that caps canvas height by uniform down-scaling** — e.g. a `--max-height`
export option or a `figjam` render-detail. Width needs no cap (4314 px imported
fine). Rotating tall diagrams is *not* a fix (B showed height, not orientation, is
the trigger; rotating outcome would make height = 1199, worse).

This belongs in the shared SVG backend / export path (`src/renderer/staged/svgBackend.ts`
and the CLI export surface), per the AGENTS.md "fix the shared layer" constraint —
not as per-view patches.

## Files

```
figjam_test_variants/
  outcome.scale-1.00.CONTROL.svg   (h=1041, control)
  outcome.scale-0.60.svg           (h=625)
  outcome.scale-0.45.svg           (h=468)
  outcome.scale-0.30.svg           (h=312)
  outcome.width-pad-4000.svg       (h=1041, w=4000)
  ia_place_map.no-css.svg          (succeeding file, CSS removed)
  outcome.css-inlined.svg          (failing file, CSS inlined, size unchanged)
```

All seven are XML well-formed and were validated for dimensions and CSS
transform correctness before use.
