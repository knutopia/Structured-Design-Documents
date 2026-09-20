#!/usr/bin/env python3
"""
Generate FigJam-import test variants to isolate WHY three staged-renderer SVGs
(scenario_flow, ui_contracts, outcome_opportunity_map) import "scrambled"
(text too large, strokes too fat) while three others (ia_place_map, journey_map,
service_blueprint) import correctly.

Empirical discriminator found by static comparison: ABSOLUTE CANVAS HEIGHT.
  succeed: heights 152, 392, 475   (all <= 475)
  fail:    heights 1041, 2322, 3056 (all >= 1041)
Width does NOT separate them; orientation does NOT separate them
(outcome_opportunity_map is wider-than-tall yet fails).

This script produces four variant groups. Each changes exactly ONE thing so the
FigJam result is attributable. NOTHING here edits the renderer; these are
import-probe artifacts only.

Groups
------
A. size-series   (on outcome_opportunity_map, the smallest failing file)
   Uniformly scale the whole drawing so absolute height lands at/around the
   success band. Pins whether a height/size threshold flips the behavior.
     outcome.scale-1.00.svg  (control == original, expected FAIL)
     outcome.scale-0.60.svg  (h ~ 625)
     outcome.scale-0.45.svg  (h ~ 468, just under the 475 success ceiling)
     outcome.scale-0.30.svg  (h ~ 312)

B. width-pad     (on outcome_opportunity_map)
   Keep height = 1041, widen the canvas to 4000 (landscape). If it STILL fails,
   height (not width, not orientation) is the trigger.
     outcome.width-pad-4000.svg

C. css-control   (on ia_place_map, a SUCCEEDING file)
   Remove the rule-bearing <style> block. If it now scrambles, that confirms the
   <style> CSS is what sets text size / stroke width, and therefore the failing
   files (which carry identical CSS) fail for a DIFFERENT reason (size).
     ia_place_map.no-css.svg

D. css-inlined   (on outcome_opportunity_map, a FAILING file)
   Bake simple `.class { ... }` declarations into per-element presentation
   attributes (font-size, font-family, font-weight, fill, stroke, stroke-width,
   stroke-dasharray, line-height, letter-spacing) and drop the rule <style>
   block, keeping absolute size unchanged. If it STILL fails -> size dominates.
   If it imports correctly -> CSS-dropping was the real cause.
     outcome.css-inlined.svg
   NOTE: only simple single-class selectors are inlined. Descendant-only rules
   (e.g. `.shared-node .scene-text { fill: ... }`) set COLOR only, not size or
   stroke width, so omitting them cannot affect the "too large / too fat"
   symptom under test. @font-face blocks are preserved.

Usage:  python3 make_figjam_test_variants.py
Output: ./figjam_test_variants/
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FAIL_DIR = os.path.join(HERE, "failing_figma_svg")
OK_DIR = os.path.join(HERE, "success_figma_svg")
OUT_DIR = os.path.join(HERE, "figjam_test_variants")

OUTCOME = os.path.join(FAIL_DIR, "tmp.outcome_opportunity_map.compact.decorators-type-id.svg")
SCENARIO = os.path.join(FAIL_DIR, "tmp.scenario_flow.compact.decorators-type-id.svg")
UICONTRACTS = os.path.join(FAIL_DIR, "tmp.ui_contracts.compact.decorators-type-id.svg")
IA = os.path.join(OK_DIR, "tmp.ia_place_map.compact.decorators-type-id.svg")

FONT_RE = re.compile(r'data:font/woff;base64,[A-Za-z0-9+/=]+')


def read(path):
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def write(name, text):
    os.makedirs(OUT_DIR, exist_ok=True)
    dest = os.path.join(OUT_DIR, name)
    with open(dest, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    print(f"  wrote {name}  ({len(text)} bytes)")


def split_defs(svg):
    """Return (head_including_defs, body_after_defs)."""
    idx = svg.index("</defs>") + len("</defs>")
    return svg[:idx], svg[idx:]


def split_body_and_close(svg):
    """Return (head_including_defs, painted_body, close_svg).

    painted_body is everything between </defs> and the final </svg>, so a scale
    wrapper can enclose the drawing without swallowing the root close tag.
    """
    head, rest = split_defs(svg)
    idx = rest.rindex("</svg>")
    return head, rest[:idx], rest[idx:]


def root_dims(svg):
    m = re.search(r'<svg[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"', svg)
    w, h = float(m.group(1)), float(m.group(2))
    return w, h


def set_root(svg, width=None, height=None, viewbox=None):
    if width is not None:
        svg = re.sub(r'(<svg[^>]*\bwidth=")[\d.]+(")', lambda m: m.group(1) + fmt(width) + m.group(2), svg, count=1)
    if height is not None:
        svg = re.sub(r'(<svg[^>]*\bheight=")[\d.]+(")', lambda m: m.group(1) + fmt(height) + m.group(2), svg, count=1)
    if viewbox is not None:
        svg = re.sub(r'(<svg[^>]*\bviewBox=")[^"]*(")', lambda m: m.group(1) + viewbox + m.group(2), svg, count=1)
    return svg


def fmt(v):
    r = round(v, 3)
    return str(int(r)) if float(r).is_integer() else f"{r:.3f}".rstrip("0").rstrip(".")


# --------------------------------------------------------------------------
# Group A: uniform scale series
# --------------------------------------------------------------------------
def variant_scale(svg, s):
    head, body, close = split_body_and_close(svg)
    w, h = root_dims(svg)
    nw, nh = w * s, h * s
    # Wrap the painted body in a scale transform; markers are userSpaceOnUse so
    # they scale with the group. Root chrome lives in the body, so it scales too.
    # The final </svg> stays OUTSIDE the wrapper group.
    scaled_body = f'\n  <g transform="scale({fmt(s)})">{body}\n  </g>\n'
    out = head + scaled_body + close
    out = set_root(out, width=nw, height=nh, viewbox=f"0 0 {fmt(nw)} {fmt(nh)}")
    return out, nh


# --------------------------------------------------------------------------
# Group B: width padding (height unchanged)
# --------------------------------------------------------------------------
def variant_width_pad(svg, new_width):
    w, h = root_dims(svg)
    out = set_root(svg, width=new_width, height=h, viewbox=f"0 0 {fmt(new_width)} {fmt(h)}")
    return out


# --------------------------------------------------------------------------
# CSS parsing helpers (Groups C and D)
# --------------------------------------------------------------------------
def find_style_blocks(svg):
    """Yield (start, end, inner_text) for each <style>...</style> in the doc."""
    blocks = []
    for m in re.finditer(r'<style>(.*?)</style>', svg, flags=re.DOTALL):
        blocks.append((m.start(), m.end(), m.group(1)))
    return blocks


def is_rule_block(inner):
    """A <style> block that carries selectors (not an @font-face block)."""
    return ".staged-svg" in inner or ".scene-" in inner or ".text-role-" in inner


def parse_simple_rules(inner):
    """Parse `.class { prop: value; ... }` simple single-class selectors.

    Returns dict: class_name -> {prop: value}. Descendant/compound selectors and
    the `.staged-svg { --custom: ... }` variable block are skipped (they do not
    carry the size/stroke declarations under test, or are custom properties).
    """
    rules = {}
    # strip CDATA wrapper
    text = re.sub(r'<!\[CDATA\[|\]\]>', '', inner)
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', text):
        selector, body = m.group(1).strip(), m.group(2).strip()
        # only single simple class selectors like `.foo`
        if not re.fullmatch(r'\.[A-Za-z0-9_-]+', selector):
            continue
        cls = selector[1:]
        decls = {}
        for decl in body.split(';'):
            if ':' not in decl:
                continue
            prop, val = decl.split(':', 1)
            decls[prop.strip()] = val.strip()
        if decls:
            rules.setdefault(cls, {}).update(decls)
    return rules


INLINE_PROPS = [
    "font-family", "font-size", "font-weight", "line-height", "letter-spacing",
    "fill", "stroke", "stroke-width", "stroke-dasharray",
]


def variant_css_inlined(svg):
    rules = {}
    for _, _, inner in find_style_blocks(svg):
        if is_rule_block(inner):
            for cls, decls in parse_simple_rules(inner).items():
                rules.setdefault(cls, {}).update(decls)

    def style_for_classes(class_attr):
        merged = {}
        for cls in class_attr.split():
            if cls in rules:
                merged.update(rules[cls])
        parts = [f'{p}: {merged[p]}' for p in INLINE_PROPS if p in merged]
        return "; ".join(parts)

    def repl_tag(m):
        whole = m.group(0)
        cm = re.search(r'\bclass="([^"]*)"', whole)
        if not cm:
            return whole
        style = style_for_classes(cm.group(1))
        if not style:
            return whole
        if ' style="' in whole:
            return whole  # do not clobber an existing style attr (none expected)
        attr = f' style="{style}"'
        # Preserve self-closing tags: insert the attribute before the trailing '/>'.
        if whole.endswith('/>'):
            return whole[:-2] + attr + '/>'
        return whole[:-1] + attr + '>'

    # Remove rule-bearing <style> blocks; keep @font-face blocks.
    out = svg
    for start, end, inner in reversed(find_style_blocks(svg)):
        if is_rule_block(inner):
            out = out[:start] + out[end:]

    # Add presentation style attrs to every element that has a class attribute.
    out = re.sub(r'<[a-zA-Z][^>]*\bclass="[^"]*"[^>]*>', repl_tag, out)
    return out


def variant_no_css(svg):
    out = svg
    for start, end, inner in reversed(find_style_blocks(svg)):
        if is_rule_block(inner):
            out = out[:start] + out[end:]
    return out


def main():
    print("Generating FigJam import test variants ->", OUT_DIR)

    outcome = read(OUTCOME)
    ia = read(IA)

    print("\n[A] size-series (outcome_opportunity_map):")
    for s in (1.0, 0.60, 0.45, 0.30):
        if s == 1.0:
            write(f"outcome.scale-1.00.CONTROL.svg", outcome)
        else:
            v, nh = variant_scale(outcome, s)
            write(f"outcome.scale-{s:.2f}.svg", v)
            print(f"      -> height {fmt(nh)}")

    print("\n[B] width-pad (outcome_opportunity_map, height unchanged):")
    write("outcome.width-pad-4000.svg", variant_width_pad(outcome, 4000))

    print("\n[C] css-control (ia_place_map, succeeding file, CSS removed):")
    write("ia_place_map.no-css.svg", variant_no_css(ia))

    print("\n[D] css-inlined (outcome_opportunity_map, failing file, size unchanged):")
    write("outcome.css-inlined.svg", variant_css_inlined(outcome))

    print("\nDone.")


if __name__ == "__main__":
    main()
