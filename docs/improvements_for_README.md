# Improvements for README.md

10. Add a small “Project metadata” footer. I didn’t find `LICENSE`, `CONTRIBUTING`, or `CODE_OF_CONDUCT` files in the repo root, so the README should at least state whether the project is open to contributions, who maintains it, and what the current usage/contribution expectations are.

## Done:

1. [Done] Put “what it is” and “how to try it” above the long rationale. Right now [Readme.md](/home/knut/projects/sdd/Readme.md#L3) does a good job on vision, but it doesn’t help a new visitor get started. Add a short intro, then a `Quick start` section with exact commands such as `pnpm install`, `pnpm run build`, `TMPDIR=/tmp pnpm sdd --help`, and one `sdd show ...` example from the CLI.

2. [Done] Add one small SDD example and one rendered output image near the top. For this repo, code samples and images belong in the README. A short snippet from [metric_event_instrumentation.sdd](/home/knut/projects/sdd/bundle/v0.1/examples/metric_event_instrumentation.sdd) plus one rendered PNG/SVG from the committed corpus would make the project immediately legible on GitHub.

4. [Done] Clarify the repository’s source-of-truth model. The current `Orientation` section in [Readme.md](/home/knut/projects/sdd/Readme.md#L41) links to useful docs, but it should explicitly say that `bundle/v0.1/` is the machine-readable source of truth for tooling and `definitions/v0.1/` is explanatory commentary. That distinction is important in this repo and should be visible to GitHub visitors.

5. [Done] Turn the README into a standard GitHub flow: `What it is` -> `Why it exists` -> `Quick start` -> `Example` -> `Repo layout` -> `Current status`. GitHub’s own guidance is basically “what the project does, why it’s useful, how to get started, where to get help, who maintains it,” and the current README is heavy on vision but light on the middle three.

6. [Done] Rewrite the `Current State` section to be more scannable and accurate. In [Readme.md](/home/knut/projects/sdd/Readme.md#L76), the bullets are malformed Markdown (`-Solid`, `-Completed`), so they may not render as a list. This section should become a clear `Status` block with `Working now`, `Known limitations`, and maybe `Current migration focus`.

7. [Done] Make the limitations more concrete. The current text says rendering is poor, but for GitHub readers it would help to say something like: staged SVG renderer is in progress, Graphviz is still used for some legacy preview paths, and example quality is still evolving.

8. [Done] Tighten and simplify the headings. `A simple, Well-Stuctured Language to Express Product Design` in [Readme.md](/home/knut/projects/sdd/Readme.md#L11) is long and has a typo. `Again, Why?` in [Readme.md](/home/knut/projects/sdd/Readme.md#L58) is conversational but not very scannable. Conventional headings like `Overview`, `Why SDD`, `Quick Start`, and `Repository Layout` will work better on GitHub.

9. [Done] Do a proofreading pass. There are several visible issues in the current file: `Well-Stuctured`, `easy read and to write`, `suitabe`, `typr`, inconsistent `SDD-Text`/`SDDT` casing, and inconsistent list formatting. On GitHub, these small issues reduce credibility more than they do in internal docs.

11. [Done] Consider renaming `Readme.md` to `README.md`. This is mostly a convention/readability improvement, not a blocker, but it’s the standard casing people expect in GitHub repos.

## Skipped

3. [Skipped] Link the rendered example corpus directly. You already have a reviewer-friendly gallery in [examples/rendered/v0.1/README.md](/home/knut/projects/sdd/examples/rendered/v0.1/README.md). The root README should surface that instead of forcing visitors to infer what the tool produces.

12. [Skipped] Skip badges unless they convey something real. There doesn’t appear to be visible CI metadata in the repo, so I wouldn’t add badge clutter yet. A strong example snippet and one diagram image would help much more.