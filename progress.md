# Daily Progress (progress.md)

## Open Issues

-feature: "render a diagram from a starting node"

-service blueprint: track the sidecar placement regression
-service blueprint etc - were did the labels go?
-effect needs a contract decision, not just a regex. Is the request field a raw source atom, a logical string value, or a typed atom like { kind, value }? Today quoted effects are valid bundle atoms, but a plain JSON string cannot safely distinguish SA-010 from "side effect" without clear serialization rules.
-Tightening effect can accidentally reject valid quoted-string effects or double-quote/escape them if normalization is unclear.

-generalizing the skill beyond this repository layout
-remove service_blueprint DOT output
-how to enrich the diagram type with deeper content (link?)
-horizontal / vertical per level / per parent
-"render all" CLI ?
-a style that shows node type for all nodes
-a way to clearly differentiate soft-hierarchy vs true-peer for sibling node rendering

## Wed 7-22

- Remediation plan completed (minus gate 8 dense)
- Reviewed visual proofs, issues found

## Sat 7-18

- Plan partially completed (to gate 7 - 8 rejected - 9 closed incomplete)

## Fri 7-17

- Renamed staged_journey_map_renderer_verification_contract.md
- Created a visual review doc
- Capturing visual issues
- Mapped captured issues to prerecorded issues
- Merged journey_map branch into main, deleted worktree, branched refine_journey_map
- Created visual remediation plan

## Tue 7-14

- Out of tokens somewhere in Gate 8
- Gate 10 completed - plan done

## Mon 7-13

- Gate 4 done
- Gate 6 done (mislabeled)
- Gate 6 join family
- Actual Gate 6

## Sun 7-12

- Added doc: Path to Replacing Legacy Rendering Pipeline with Staged Renderers
- Added journey map architecture doc
- Added journey map plan prompt
- Created journey_map branch
- Created implementation plan
- Gate 0 done
- Gate 2 done

## Sat 7-11

-Docs cleanup
-Renamed the multiple outcomes example

## Tue 7-7

-Added summary label titles for complex case
-Made summary label titles uppercase
-Transformed dense example into canonical example
-Added renderer authoring guide

## Mon 7-6

-Much cleaner label placement
-Clean but repetitive individual label placement

## Sun 7-5

-Restored previous commit
-Small-step connector priority adjustment
-Small-step connnector termination routing adjustment
-Another termination improvement
-Half-failed label placement change
-Label placement salvaged, still rough

## Thu 7-2

-Further incremental routing fixes
-Lost in the weeds

## Mon 6-29

-Identified routing failures in outcome-opportunity map
-Created arch doc to fix routing failures
-Executed fixes, routing inrementally improved
-Closed logic delta to service blueprint routing, slight regression

## Sat 6-27

-Made IMPLEMENTED_BY edge visible, profile-based 
-Increased label gutter spacing
-Aligned label gutter code structure with scenario-flow
-Added descriptions to diagram types page

## Fri 6-26

-Explored syntax highlighting opportunity
-Removed redundant cell visuals in oom
-Improved column alignment in oom
-Explored options for adding details to diagrams
-Created list of shown / not shown edges per diagram type

## Sat 5-16

-finished oom implementation (raw)

## Fri 5-15

-reviewed, refined implementation plan
-updated AGENTS
-started implementing the oom plan

## Wed 5-13

-created implementation plan for outcome_opportunity_map

## Sat 5-09

-skill run diagnostics
-cleansed the repo-local wrapper language again
-adjusted --purpose request plan remainder after diagnostics
-implemented adjusted plan, it reverted wrapper fix
-manually reverted wrapper fix, aligned tests
-updated skiil & helper doc pages
-analyzed skill execution, found improvement

## Fri 5-08

-made local run_helper.sh executable
-updated skill to point to installed helper wrapper instead of local
-added docs/skill/README.md
-sdd-helper partial-write fix
-corepack install fix
-captured helper payload subdivision issue
-created helper payload subdivision design
-added --purpose request for helper.command.author

## Thu 5-07

-patched Corepack tmp dir for skill
-debugged Playwright installation
-testing skill across thinking levels
-exposed ssh key to non-interactive shells so codex can use git
-another helper hardening
-ran architecture experiment with odd results
-added outcome opportunity map renderer design

## Wed 5-06

-clarified edges per node in specifications readme
-installed Playwright MCP

## Fri 5-01

-updated docs / tests to catch up with scenario_flow staged renderer

## Tue 4-27

-third iteration fix, and a fourth one for wide swerve routing
-fifth iteration for swerve spacing
-sixth for swerve turn reduction
-seventh for label placement parity
-eighth for label gutter space

## Mon 4-27-26

-planned, built fix for scenario_flow stages shortcomings, partial success
-second fix iteration, 2 steps forward, 1 step back

## Sat 4-25-26

-planned scenario_flow
-implemented (raw)

## Fri 4-24-26

-strategic potential now usable
-spellchecking
-updated Quick Start and package.json
-skill installation guidance

## Wed 4-22-26

-repo docs language clarity edits
-small de-ifyouwanting
-caught up sdd-helper readme
-improving strategic potential doc

## Tue 4-21-26

-found & addressed skill nesting recession
-found & addressed skill source sequencing regression
-reintroduced skill guide page with examples

## Mon 4-20-26

-fighting failing skill after refactor
-resolved confirmation issue by updating codex twice
-restored pre-refactor skill for reference
-created another skill-ops improvement design doc
-created, executed matching plan
-skill now better behaved, still artifact creation issues
-refined further

## Sun 4-19-26

-added request-loading contract detail + skill guidance
-created skill ops reliability design, bad codex laziness
- reated, executed gated plan

## Sat 4-18-26

-revising skill examples
-ran into a chat-safe preview bug roadblock
-re-ordered preview response payload to handle truncation better
-refactored preview response to use path / uri and external file

## Fri 4-17-26

-skill doc updates to match new helper contract
-added semantic guidance to skill
-added chat-safe previews for skill
-tightened preview guidance after finding shortfalls
-added nesting emphasis to skill guidance after nesting disappeared

## Thu 4-16-26

-pushed Skill examples page forward
-added strategic potential note
-fixed show filename collisions
-renamed prompt examples
-sharpened skill workflow rules by intent
-planned, implemented machine readable contract for helper (except gate 5 for MCP server later)

## Tue 4-14-26

-researched template options. conclusion: not yet
-planned, implemented expanded shared authoring capabilities
-removed ineffective create --template option
-strengthened skill guidance
-planned to fix show-filename collisions
-manually curated examples for Skill (incomplete)

## Mon 4-13-26

-added examples to skill doc page, but they are problematic
-found & fixed template-use bug for helper create
-restored missing skill content
-created deferred note for template use
-fixed run_helper.sh location documentation drift that the earlier skill content action caused
-made run_helper.sh executable (!!)
-created "manual" skill example, encountered preview failure
-created helper hardening plan (poor messaging etc), executed it
-added validation gate before preview in skill

## Sun 4-12-26

-created sdd-helper documentation page
-created sdd-cli documentation page
-updated readme, agents.md
-created codex skill
-installed skill
-clarified skill language
-added doc page for skill

## Sat 4-11-26

-created helper app execution plan
-implemented plan
-added discoverability surfaces

## Fri 4-10-26

-planned MCP path
-planned projection service exposure as pre-step for mcp work
-implemented projection service exposure
-created mcp server design doc
-updated AGENTS.md

## Wed 4-08-26

-added License And Contributions footer to readme
-changed "recommended" profile name to "strict"
-removed dead, definition-only default_severity_mode
-removed dead conformance_levels
-identified lazy parser implementation ignoring large parts of syntax.yaml
-made parser-alignment plan, implemented it
-added strict-profile example

## Tue 4-07-26

-further readme improvements
-removed stray bundle example visuals
-refined contributing.md
-added MIT license and CLA
-removed DOT/MMD cli options

## Mon 4-06-26

-added small_app_err error output example file
-improved CLI error "pretty" output further
-added inline example to readme
-added separate service blueprint example
-marked not-ready example folders
-restructured readme further
-created separate diagram types page
 
## Sun 4-05-26

-created simple example file to include in readme
-removed empty containers from simple-profile ui_contracts diagram
-restructured diagnostic pretty CLI output for readability

## Fri 4-03-26

-edited readme intro

## Thu 4-02-26

-edited README.md for github use
-created CONTRIBUTING.md

## Wed 4-01-26

-tackling service_blueprint layout authority alignment:
-expanding service_blueprint placement rules to accomodate multi-node per slot handling
-created, executed Service Blueprint Support Placement Implementation Plan
-revisited to actually achieve adjacent spill columns
-capitalized lane labels, added line labels
-analyzed style-logic separation

## Tue 3-31-26

-cleaning up service_blueprint rendering code:
-removed orphaned styling
-integrated lane titles and separators into scene contract
-discovered missing merge for label branch - corrected
-refactored service_blueprint renderer for structural semantics to no longer depend on  class tokens or `viewId` branches

## Mon 3-30-26

-increased swerve routing distance
-cleaned bottom-gutter routing

## Sun 3-29-26

-tracked and scrubbed ungrounded 'sidecar' placement rule in service_blueprint docs
-build detailed service blueprint routing rules
-implemented routing, rough but reasonably successful

## Fri 3-28-26

-ripped out elk routing from service_blueprint
-ripped elk out of documentation
-created second service blueprint reset document

## Thu 3-27-26

-added pre-routing output to debug, found node placement failing
-node placement fixed

## Wed 3-26-26

-new, hard-failing elk based service_blueprint
-switched to non-elk node layoutm still failing

## Mon 3-24-26

-completed service_blueprint layout rules
-updated service_blueprint reference design

## Sat 3-22-26

-drafted service_blueprint layout rules
-created service_blueprint reference design

## Fri 3-21-26

-improved lanes issues on ui_contracts
-implemented elk-based, flawed service_blueprint

## Thu 3-20-26

-created reference design & notes for ia_place_map
-successful build without elk
-resolved issues with label lane in ui_contracts
-created elk primer for service_blueprint (next diagram type)

## Wed 3-19-26

-abandoned visual fixes mess
-got stuck with git revert when rollback was needed
-attempted navigate-based indent for IA but failed
-restored repo, giving up for now.

## Mon 3-17-26

-pushed remaining stages of master plan, completed renderer migration for ia_place_map and ui_contracts
-revised rendering details

## Sun 3-16-26

-Preparing renderer migration to elkjs / generic
-Started master plan based renderer migration

## Sat 3-15-26

-Cleaned up Readme.md
-Added content to AGENTS.md

## Fri 3-14-26

-attempted more ui_contracts rendering variations. Graphviz is a failure.
-attempted Context7 MCP install, failed

## Thu 3-12-26

-added mermaid for new diagram types
-added full set of examples across all types - they look pretty bad.
-reshuffled rendering of ui_contracts type - still not good enough

## Wed 3-11-26

-debugged font issue
-implemented remaining diagram types
-started researching Figma

## Tue 3-10-26

-fixed element order / preserving order from source
-visual / layout improvements (font, title alignment)

## Mon 3-9-26

-added simple profile
-sorted out CRLF issues
-tested initial toolchain implementation
-switched git to ssh key
-installed Graphviz
-expanded cli options
-created real-world example source
