# Readme: Structured Design Documentation Project Overview

This project aims to 
-define a way to capture structure in interaction design diagrams, 
-provide ways to produce and consume such "Structured Design Documents" as part of (software-) product creation work,
-enabling people (designers and other product-creation participants) and LLMs to meaningfully harness interaction design as a contributing domain in product creation.

For orientation, read the documents

- initial_concepts/Structured Design Artifacts to Advance the Software Product Design Practice.md
- initial_concepts/Initial Concepts1 a 6-Diagram Suite v0dot1.md
- initial_concepts/Initial Concepts2 One-page Schema v0dot1.md

Other folders:

- definitions/vXXX/ houses definitions and rationale for version XXX (currently version 0.1)
- bundle/vXXX/ houses tight, machine-readable specifications for version XXX (currently version 0.1). These specifications are meant to drive tooling (so that encoding of actual language spec is done outside tooling).

## v0.1 Source-of-Truth Policy (Transitional Split)

- During extraction, markdown files in `definitions/v0.1/` are the normative input.
- After extraction, files in `bundle/v0.1/` are the machine-readable source of truth for tools.
- Markdown remains explanatory commentary and rationale, and should stay consistent with the bundle.

## Current Project Goals

### 1. Create a well-defined set of specs for version 0.1, in folder bundle/v0.1/

See docs/bundle_creation_guidance_sdd_text_v_0_dot_1.md

### 2. Create initial tool chain: Compiler, Validator, Renderer

Actual steps and architecture to be determined.
