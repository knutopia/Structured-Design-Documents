# [Done] Absans Title Font — Implementation Plan

**Goal:** Adopt the **Absans** typeface as the *title/display* font for the documentation
site (`docs/doc_site`), covering the home hero and the large/inline headings across pages,
while leaving **Inter** as the body font.

**Status:** Implemented and verified on 2026-09-16 (Phases 0–7 complete; see §11).

**Scope boundary:** This is a VitePress **theme-CSS + asset** task. The font exploration
tools under `docs/doc_site/public/font_tools/` are the *decision surface* and *asset
registry* only — they explicitly do not change live site fonts ("These tools do not change
live fonts on the site."). Adoption happens in `.vitepress/theme/` and, if needed,
`.vitepress/config.ts`.

---

## 1. Verified Current State

All values below were read from the installed VitePress default theme
(`node_modules/vitepress/dist/client/theme-default/`) and the repo theme.

### 1.1 Live-site typography today

- The site `extends: DefaultTheme` (`.vitepress/theme/index.ts`) and adds **no font CSS**.
  - `custom.css` → brand color variables + page-class tweaks (`kinda-important`, `wide-sidebar`).
  - `style.css` → `source-scroll`, `repo-link`, code-block tweaks.
  - `index.ts` → imports FontAwesome CSS; **no webfont**.
- All type therefore comes from the default theme, which loads **Inter** (variable,
  weights 100–900, optical sizing) via `theme-default/styles/fonts.css` and sets:
  - `--vp-font-family-base: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif, …`
  - `:root { font-optical-sizing: auto; }`
- There is **no separate title font today**; headings and hero inherit Inter.

### 1.2 Default heading / hero values to override

| Selector | font-size | line-height | letter-spacing | font-weight |
| --- | --- | --- | --- | --- |
| `.vp-doc h1…h6` (base) | — | — | — | **600** |
| `.vp-doc h1` | 28px | 40px | −0.02em | 600 |
| `.vp-doc h2` | 24px | 32px | −0.02em | 600 |
| `.vp-doc h3` | 20px | 28px | −0.01em | 600 |
| `.vp-doc h4` | 18px | 24px | −0.01em | 600 |
| `.VPHero .name` / `.text` | 32 → 48 → 56px (responsive) | 40 → 56 → 64px | −0.4px | **700** |
| `.VPHero .tagline` | 18 → 20 → 24px | 28 → 32 → 36px | — | 500 |

Notes:
- `.VPHero .name` uses `background-clip: text` with `--vp-home-hero-name-background`
  (brand gradient clip) and `-webkit-text-fill-color`. Any title font must still read well
  clipped, at the hero's large sizes.
- `.kinda-important .vp-doc h1` (in `custom.css`) restyles size/margins but does **not**
  set `font-family`, so a title-font rule on `.vp-doc h1` still applies there.

### 1.3 Absans specifics (verified)

From `docs/doc_site/public/font_tools/font-sources.txt` and the generated
`fonts.css` / `font-manifest.js`:

```
[font]
name = Absans
fallback = sans-serif
kind = local
format = woff2
face = 400 normal fonts/04-Absans.woff2
```

- **Single weight: 400. Single style: normal.** No 500/600/700, no italic.
- Local file: `docs/doc_site/public/font_tools/fonts/04-Absans.woff2` (~56 KB), present on disk.
- Generated `@font-face` (in `fonts.css`, used only by the explorer pages):
  `font-family: "Absans"; font-style: normal; font-weight: 400; src: url("fonts/04-Absans.woff2")`.
- The explorer's title-variable model (`fonts_in_context.html`) is:
  `--title-font`, `--title-weight` (default **400**), `--title-style`, `--title-kerning`
  (default `normal`), `--title-letter-spacing` (default **−0.035em**, or `normal` when
  "natural title spacing" is toggled). Selections persist in `localStorage` / URL params
  and are **not exported as config** — values are transcribed manually.

> **Critical constraint:** Absans ships only weight 400. VitePress headings ask for 600 and
> the hero asks for 700. Without handling this, the browser applies **faux (synthetic)
> bold**, which renders poorly. Section 3 resolves this.

---

## 2. Authority & Non-Negotiable Invariants

Applied in order:

1. `AGENTS.md` — repo conventions; `TMPDIR=/tmp` for any Node/test command; WSL `node`/`pnpm` via `~/.profile`.
2. `~/.claude/CLAUDE.md` — **do not assume CSS/dimension values; verify them.** No glossing over regressions.
3. The verified theme values in Section 1 are the baseline being changed.
4. The font-tools registry (`font-sources.txt`) is the source of truth for the *explorer*;
   `fonts.css` / `font-manifest.js` are **generated** (`pnpm run font-tools:generate`, which
   also runs as `predocs:dev` / `predocs:build`) and must not be hand-edited.

Invariants this work must preserve:

- **Body text stays Inter.** Only title/display selectors change.
- The font explorer tools keep working unchanged (their `fonts.css`, manifest, and local
  font files remain intact).
- `pnpm run font-tools:prune` must **not** delete the explorer's Absans file — it only
  removes files unreferenced by `font-sources.txt`, and Absans **is** referenced, so it is
  safe **as long as the registry entry stays**.
- Production builds must emit the font at the correct site base
  (`/Structured-Design-Documents/`).
- No layout regressions: heading line-heights, header-anchor links, outline/sidebar,
  and the `kinda-important` / `wide-sidebar` page classes must keep working.
- Deterministic, reproducible build (`pnpm run docs:build`).

---

## 3. Key Design Decisions

### 3.1 Weight strategy (resolves the single-weight constraint) — REQUIRED

DECISION: follow your recommendation. Only use actual weight 400.

Declare the production `@font-face` with a **weight range** so the single 400 face covers
the weights the cascade asks for, with **no synthetic bold**:

```css
@font-face {
  font-family: 'Absans';
  src: url('./fonts/Absans.woff2') format('woff2');
  font-weight: 400 700;   /* range → browser uses the one face, never synthesizes */
  font-style: normal;
  font-display: swap;
}
```

Then set the title selectors to an **explicit, intentional weight** rather than inheriting
600/700:

- Recommended: `--sdd-title-weight: 400` (Absans's natural design weight). Absans is a
  distinctive display grotesque meant to stand out at its own weight; forcing it heavier
  via synthesis is the failure mode we are avoiding.
- The weight range on `@font-face` is the safety net: even if a selector still computes
  600/700, the browser maps it to the 400 face instead of emboldening it.

**Decision to confirm during Phase 4:** whether titles sit at 400 (clean, lighter than
today's 600/700) or whether the hero specifically needs a heavier visual treatment
(see risk 5.2). Do **not** resolve this by allowing faux bold.

### 3.2 Letter-spacing — VERIFY, do not assume

DECISION: follow your recommedation - start neutral

VitePress's −0.02em / −0.01em and the explorer's −0.035em are tuned for Inter. Absans has
different default sidebearings. Per `CLAUDE.md`, the title tracking must be **visually
verified** at real heading sizes, not copied. Expose it as a variable with a starting value
and tune in Phase 4:

- `--sdd-title-letter-spacing: normal;` (start neutral; Absans display faces often want
  little or no negative tracking at large sizes). Adjust only after visual review.

### 3.3 Optical sizing

DECISION: follow your recommendation, but document the previous setting (for Inter) in comments.

`:root { font-optical-sizing: auto; }` targets Inter's `opsz` axis. Absans is not a
variable font, so this is harmless, but for cleanliness set
`font-optical-sizing: none;` on the title selectors.

### 3.4 Selector scope (tiered)

DECISION: follow your recommendation

"Unique large titles … with inline titles across the pages" maps to:

- **Tier 1 (mandatory):** home hero `.VPHero .name`, `.VPHero .text`; page titles `.vp-doc h1`.
- **Tier 2 (recommended):** section headings `.vp-doc h2` (the "inline titles across pages").
- **Tier 3 (optional, decide in Phase 4):** `.vp-doc h3` / `h4`, `.VPFeature h2` (home
  feature cards), `.VPHero .tagline`.
- **Out of scope (keep Inter/body):** nav bar, sidebar, outline, body paragraphs, lists,
  code, badges, buttons — to limit blast radius and preserve UI legibility.

### 3.5 Tagline decision

DECISION: follow your recommendation, but add commented-out code to easily switch to Absans.

`.VPHero .tagline` is prose-like. Default recommendation: **keep it on the body font**
(Inter) for contrast against the Absans hero title. Revisit in Phase 4 if the pairing looks
unbalanced.

---

## 4. Asset Strategy

The site base is `/Structured-Design-Documents/` (`siteBase` in `config.ts`). Files in
`public/` are copied verbatim to the output root, so the explorer copy is served at
`/Structured-Design-Documents/font_tools/fonts/04-Absans.woff2`. Theme CSS cannot easily
use VitePress's `withBase`, so a root-relative `url('/font_tools/...')` would **miss the
base** and 404 in production.

**Chosen approach (primary): theme-owned asset, Vite-processed.**

1. Copy the single woff2 to `docs/doc_site/.vitepress/theme/fonts/Absans.woff2`.
2. Reference it **relatively** from theme CSS: `url('./fonts/Absans.woff2')`.
3. Vite then treats it as a bundled asset: it fingerprints it and emits it under
   `/assets/…` **with the correct base automatically** — no hardcoded base, no `public/`
   anti-pattern.

This intentionally creates a **second copy** of the font (explorer copy + production copy).
That is acceptable and keeps clean separation:
- The explorer keeps its registry-driven copy under `public/font_tools/fonts/` (prune-safe
  because `font-sources.txt` references it).
- The site theme owns its production asset under `.vitepress/theme/fonts/`.

**Alternative (rejected):** reference the `public/` path with a hardcoded base, or inject
`@font-face` via `transformHead` in `config.ts` using `site.base`. More fragile / more
complex; only revisit if duplicating the ~56 KB file is unacceptable.

**Also rejected:** importing the generated `fonts.css` into the theme — it pulls in ~40
families (heavy) and is a generated artifact.

---

## 5. Risks & Mitigations

1. **Faux bold from single-weight face.** Mitigated by the `font-weight: 400 700` range on
   `@font-face` (§3.1) plus explicit title weight. Verify no synthesis in Phase 7.
2. **Hero gradient clip + lighter weight.** `.VPHero .name` clips a brand gradient to text.
   At Absans 400 (thinner than today's 700) the big "SDD" title may look weak at 56px.
   **Verify visually**; if too thin, options are: keep hero on a heavier treatment, adjust
   the gradient/contrast, or accept the lighter display look intentionally. Do not fix by
   enabling faux bold.
3. **Base-path 404 in production.** Mitigated by the theme-owned, Vite-processed asset
   (§4). Verify the emitted URL in `docs:build` output (Phase 6).
4. **Prune deleting the explorer asset.** `font-tools:prune` removes local files not
   referenced by `font-sources.txt`. Keep the Absans `[font]` block. Verify after any
   registry edit.
5. **Letter-spacing tuned for Inter.** Mitigated by §3.2 (start neutral, verify).
6. **Absans readability / pairing.** Absans has distinctive letterforms; confirm it reads
   well at heading sizes and pairs acceptably with Inter body across light + dark themes.
7. **License / attribution.** Absans is a third-party typeface. **Verify its license and any
   attribution requirement before shipping** (Phase 0). The repo's `fonts/README.md` already
   says to "keep the upstream license and attribution requirements for each font family."
   Confirm whether the OFL/attribution applies and whether a credit line is needed on the
   site or in the repo.
8. **Generated-file drift.** Never hand-edit `fonts.css` / `font-manifest.js`; they are
   regenerated on every `docs:dev` / `docs:build`.

---

## 6. Implementation Phases

### Phase 0 — Decisions & license (no code)
- Confirm Absans license + attribution requirements; record the outcome here.
- Confirm selector scope tiers (§3.4) and the tagline decision (§3.5).
- Confirm starting title weight (400) and that faux bold is disallowed.

### Phase 1 — Asset placement
- Create `docs/doc_site/.vitepress/theme/fonts/`.
- Copy `public/font_tools/fonts/04-Absans.woff2` → `.vitepress/theme/fonts/Absans.woff2`.
- Leave the explorer copy and `font-sources.txt` untouched.

### Phase 2 — Font face + title variables
- Add a dedicated stylesheet, e.g. `docs/doc_site/.vitepress/theme/title-font.css`, containing:
  - the `@font-face` from §3.1 (relative `url('./fonts/Absans.woff2')`, `font-weight: 400 700`);
  - `:root` title variables: `--sdd-title-font: 'Absans', sans-serif;`,
    `--sdd-title-weight: 400;`, `--sdd-title-letter-spacing: normal;`,
    `--sdd-title-kerning: normal;`.
- Import it in `.vitepress/theme/index.ts` **before** `custom.css` so the face is available
  and cascade order is predictable:
  `import './title-font.css'` then existing `import './style.css'` / `import './custom.css'`.

### Phase 3 — Apply to selectors (tiered)
- In `title-font.css` (or `custom.css`), apply the title font to:
  - Tier 1: `.VPHero .name`, `.VPHero .text`, `.vp-doc h1`.
  - Tier 2: `.vp-doc h2`.
  - Tier 3 (if approved): `.vp-doc h3`, `.vp-doc h4`, `.VPFeature h2`.
- Each rule sets `font-family: var(--sdd-title-font); font-weight: var(--sdd-title-weight);
  letter-spacing: var(--sdd-title-letter-spacing); font-kerning: var(--sdd-title-kerning);
  font-optical-sizing: none;`.
- Do **not** change `--vp-font-family-base` (body stays Inter).

### Phase 4 — Per-font tuning (visual, iterative)
- Run the dev server (`scripts/lvps.sh` or `TMPDIR=/tmp pnpm run docs:dev`).
- Tune `--sdd-title-letter-spacing` and confirm weight at real sizes (hero 56px, h1 28px,
  h2 24px). Verify against `CLAUDE.md` "do not assume CSS values".
- Resolve the hero gradient-clip appearance (risk 5.2).
- Finalize Tier 3 + tagline decisions.

### Phase 5 — Dark mode & responsive
- Verify light + dark themes (the site mirrors `vitepress-theme-appearance`).
- Verify hero responsive breakpoints (32/48/56px) and that line-heights/anchors still align.
- Verify `kinda-important` and `wide-sidebar` pages.

### Phase 6 — Build verification
- `TMPDIR=/tmp pnpm run docs:build`.
- Confirm the font is emitted under `.vitepress/dist/assets/…` and referenced with the
  `/Structured-Design-Documents/` base (grep the built CSS/HTML).
- Confirm `predocs:build` ran `font-tools:generate` without error and the explorer copy survives.

### Phase 7 — Visual acceptance
- On the built/previewed site, confirm via DevTools "Rendered Fonts" that **Absans** (not a
  fallback) renders on hero + h1 + h2.
- Confirm **no synthetic bold** (computed weight maps to the 400 face; glyphs not artificially thickened).
- Confirm body text still renders Inter.
- Spot-check: home, a diagram-types page, the CLI page, a `kinda-important` page.

---

## 7. Acceptance Criteria

- [x] Absans license/attribution verified and recorded (Phase 0).
- [x] Hero (`.VPHero .name`/`.text`) and `.vp-doc h1` (+ `h2` if Tier 2 approved) render in
      **Absans**, confirmed by computed font / "Rendered Fonts".
- [x] **No faux-bold synthesis**: titles use the single 400 face via the `400 700` range.
- [x] Body text, nav, sidebar, outline, code remain **Inter**.
- [x] Production build references the font with the correct base
      (`/Structured-Design-Documents/assets/…`); no 404.
- [x] `pnpm run docs:build` succeeds; `font-tools:generate` runs clean.
- [x] Explorer Absans file still present after build/prune (registry entry intact).
- [x] No layout regressions: heading line-heights, header anchors, outline, `kinda-important`,
      `wide-sidebar`.
- [x] Light + dark themes both acceptable; hero gradient clip reads well.
- [x] Title letter-spacing/weight visually verified (not assumed).

---

## 8. Files Touched (actual)

| File | Change |
| --- | --- |
| `docs/doc_site/.vitepress/theme/fonts/Absans-Regular.woff2` | **New** — production copy of the official font (SHA-256 verified). |
| `docs/doc_site/.vitepress/theme/fonts/Absans-OFL-1.1.txt` | **New** — OFL 1.1 license text (attribution compliance). |
| `docs/doc_site/.vitepress/theme/title-font.css` | **New** — `@font-face` + title variables + selector rules. |
| `docs/doc_site/.vitepress/theme/index.ts` | Import `title-font.css` before `style.css`/`custom.css`. |
| `docs/title_font/absans_title_font_implementation_plan.md` | This plan (status + §11 record). |

**Not touched:** `font-sources.txt`, `fonts.css`, `font-manifest.js`,
`public/font_tools/fonts/04-Absans.woff2`, `config.ts`, `custom.css`.

---

## 9. Rollback

- Remove the `title-font.css` import from `index.ts` (and the file), and delete
  `.vitepress/theme/fonts/Absans.woff2`. The site reverts to all-Inter immediately; no other
  subsystem is affected.

---

## 10. Open Questions (resolved in Phase 0)

1. **Absans license + attribution:** SIL Open Font License 1.1, Copyright © 2023
   Collletttivo (https://www.collletttivo.it/ | collletttivo@gmail.com). Verified against the
   **official** repository `github.com/collletttivo/absans` (`LICENSE.txt`). OFL 1.1
   condition 2 requires the copyright notice + license to travel with each copy of the Font
   Software, so the license text ships at
   `.vitepress/theme/fonts/Absans-OFL-1.1.txt` alongside the woff2. No separate on-site
   credit line is required by the OFL for web embedding.
2. **Final selector scope:** Tier 1 + Tier 2 implemented (hero `.name`/`.text`, `.vp-doc h1`,
   `.vp-doc h2`). Tier 3 (h3/h4/feature cards) left as commented-out code in `title-font.css`.
3. **Tagline:** kept on the body font (Inter). A commented-out rule in `title-font.css`
   allows switching it to Absans easily.
4. **Hero treatment:** Absans 400 under the gradient clip verified visually in both light and
   dark themes; it reads well. No heavier treatment needed; faux bold remains disallowed.
5. **Asset duplication:** accepted. The theme owns its production copy
   (`.vitepress/theme/fonts/Absans-Regular.woff2`); the explorer keeps its registry-driven
   copy. Both are byte-identical to the official source.

---

## 11. Implementation Record (2026-09-16)

### Source authenticity

The production font was sourced from the **official** repository
`github.com/collletttivo/absans` (`fonts/Absans-Regular.woff2`), per instruction. The
downloaded file's SHA-256 is `d99eeb41d82e7bd23b4c92483267143e10d5c9686ad299056ac057c03a34b68f`,
which is **byte-identical** to the pre-existing explorer copy
`public/font_tools/fonts/04-Absans.woff2` — confirming that copy was already authentic. The
theme copy and the explorer copy both match the official hash.

### Files created / changed

- `docs/doc_site/.vitepress/theme/fonts/Absans-Regular.woff2` — official woff2 (SHA-256 verified).
- `docs/doc_site/.vitepress/theme/fonts/Absans-OFL-1.1.txt` — OFL 1.1 license text.
- `docs/doc_site/.vitepress/theme/title-font.css` — `@font-face` (weight range `400 700`,
  `font-display: swap`), `:root` tokens (`--sdd-title-font`, `--sdd-title-weight: 400`,
  `--sdd-title-letter-spacing: normal`, `--sdd-title-kerning: normal`), Tier 1+2 selector
  rules with `font-optical-sizing: none`, plus commented-out Tier 3 and tagline rules.
- `docs/doc_site/.vitepress/theme/index.ts` — imports `./title-font.css` before
  `./style.css` and `./custom.css`.

### Build verification (Phase 6)

- `TMPDIR=/tmp pnpm run docs:build` succeeded; `predocs:build` ran `font-tools:generate`
  cleanly (48 families, 373 faces).
- Font emitted fingerprinted as `dist/assets/Absans-Regular.BSsZ2PF_.woff2`.
- Built CSS references it with the correct base:
  `url(/Structured-Design-Documents/assets/Absans-Regular.BSsZ2PF_.woff2)` — no 404 risk.
- Built `@font-face` carries `font-weight:400 700`.
- Built title rule present:
  `.VPHero .name,.VPHero .text,.vp-doc h1,.vp-doc h2{font-family:var(--sdd-title-font);…;font-optical-sizing:none}`.
- `--vp-font-family-base` still Inter (body untouched).
- Explorer copy `public/font_tools/fonts/04-Absans.woff2` intact after build (prune-safe).

### Visual acceptance (Phase 7)

Verified on the built site via `docs:preview` (computed styles + screenshots):

- Home hero: `.VPHero .name` ("SDD") and `.VPHero .text` render **Absans**, weight 400,
  `letter-spacing: normal`, `font-optical-sizing: none`. `document.fonts.check('400 16px Absans')`
  = true; the `Absans` face reports `status: loaded`, `weight: "400 700"`.
- Content page (`sdd_cli_tools/`): `.vp-doc h1` and `.vp-doc h2` render **Absans** (400);
  `.vp-doc h3` correctly remains **Inter** (Tier 3 not enabled).
- Body paragraphs render **Inter** (`--vp-font-family-base`), confirming the title/body split.
- **No faux bold:** computed title weight is 400 and maps to the real 400 face via the range.
- Hero gradient clip reads well at Absans 400 in **both** light and dark themes (screenshots).
- Diagram-types page h1/h2 render Absans cleanly in light mode.

### Outcome

All acceptance criteria in §7 are satisfied. The site now uses Absans for hero and h1/h2
titles with Inter retained for body text. Rollback remains a one-line import removal (§9).
