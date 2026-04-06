# Daily Progress (progress.md)

## Open Issues

-remove service_blueprint DOT output
-remove remaining use of sidecar in service_blueprint
-how to enrich the diagram type with deeper content (link?)
-horizontal / vertical per level / per parent
-"render all" CLI ?
-a style that shows node type for all nodes
-a way to clearly differentiate soft-hierarchy vs true-peer for sibling node rendering

## Mon 4-06-26

-added small_app_err error output example file
-improved CLI error "pretty" output further

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