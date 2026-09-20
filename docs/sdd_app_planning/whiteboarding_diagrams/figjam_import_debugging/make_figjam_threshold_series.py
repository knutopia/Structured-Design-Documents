#!/usr/bin/env python3
"""
Fine FigJam height-threshold series.

Group A of make_figjam_test_variants.py bracketed the FigJam scramble threshold:
  outcome.scale-0.45.svg  h=468  -> CLEAN
  outcome.scale-0.60.svg  h=625  -> SCRAMBLED
So the trigger height lies in the open interval (468, 625).

This script fills that gap at a fixed step so the exact cap can be pinned by
importing each file into FigJam and finding the clean->scrambled crossover.

It REUSES the exact scale mechanism from make_figjam_test_variants.py (uniform
<g transform="scale(s)"> + proportionally reduced width/height/viewBox) so these
variants are directly comparable to the group-A results already collected.

Scale is derived from a TARGET HEIGHT: s = target_height / original_height
(original outcome_opportunity_map height = 1041).

Usage:  python3 make_figjam_threshold_series.py
Output: ./figjam_threshold_series/
"""

import os

# Reuse the validated helpers from the group-A generator (same directory).
import make_figjam_test_variants as base

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "figjam_threshold_series")

# Target canvas heights to probe, spanning the confirmed (468, 625) bracket.
# 20px steps give a clean crossover read without excessive manual imports.
TARGET_HEIGHTS = [480, 500, 520, 540, 560, 580, 600, 620]


def write(name, text):
    os.makedirs(OUT_DIR, exist_ok=True)
    dest = os.path.join(OUT_DIR, name)
    with open(dest, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    print(f"  wrote {name}  ({len(text)} bytes)")


def main():
    print("Generating FigJam height-threshold series ->", OUT_DIR)
    outcome = base.read(base.OUTCOME)
    _, orig_h = base.root_dims(outcome)
    print(f"  original outcome height = {base.fmt(orig_h)}")
    print(f"  confirmed bracket: 468 CLEAN .. 625 SCRAMBLED\n")

    for target in TARGET_HEIGHTS:
        s = target / orig_h
        svg, nh = base.variant_scale(outcome, s)
        name = f"outcome.h-{target}.svg"
        write(name, svg)
        print(f"      target {target} -> scale {s:.4f} -> actual height {base.fmt(nh)}")

    print("\nDone. Import each into FigJam; the clean->scrambled crossover is the cap.")


if __name__ == "__main__":
    main()
