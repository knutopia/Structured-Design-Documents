# [Done] Skill Use Log 04-14-26: Missing IA Artifact

## Note: Better Execution Speed

With expanded shared authoring capabilites, skill execution time has been cut in half. 

## Issue: Missing Rendering

The skill fails to produce the information architecture as a user-facing artifact. A corresponding preview IS produced as part of the tool use by the skill, but it does not get saved to be available to the user.

### Expected Outcome

When asked for an "Information Architecture" the skill should produce an ia_place_map artifact, in the same folder as the SDD document it produces (or is working on.)

### Prompt & Response

## Issue: Odd File Placement

The generated SDD file is placed at docs/readme_support_docs/community_food_pantry_example

The LLM justifies this position as being in the documentation path for the current project, along with other examples. 

While that is a plausible motivation for choosing a folder, it does look random when the rationale is not known.

### Expected Outcome 

A more "predictable" output location: the current working directory is a good default choice. if the prompt asks for (or implies) a specific output location, then that request should be honored.

## Prompt & Response

(kg:)

Using Sdd Skill to design a volunteer scheduling app for a community food pantry.   

Create a new SDD for it and show the information architecture. Include: 
- Dashboard
- a Volunteer Scheduling area with Open Shifts, Shift Detail, My Schedule

(codex:)

Worked for 4m 6s
I’m using the sdd-skill workflow for this and starting by reading the skill instructions plus the repo’s existing SDD layout, so I can create the new document in the right place and render the IA view cleanly.


Explored 1 file, 2 lists
Listed files
Read Sdd Skill skill
Listed files
I’ve got the helper workflow loaded. Next I’m checking a couple of existing SDD examples and the helper’s available commands so we can model the new pantry app with the repo’s native structure instead of guessing at syntax.


Explored 3 files, ran 1 command
I’ve confirmed the helper surface and found a simple IA example to mirror. Now I’m looking up the exact author request shape so I can create the new SDD through the helper instead of hand-editing the .sdd file.


Explored 6 files, 1 search
I’ve got enough context to move from exploration into authoring.

Plan:

Create a new repo-local example SDD for the food pantry app in docs/readme_support_docs/.
Use the SDD helper’s create + author flow to scaffold the IA: Dashboard, Volunteer Scheduling, Open Shifts, Shift Detail, and My Schedule.
Validate and project the document with the IA view, then render a preview so we have both the source and a confirmed information-architecture output.
Share the new SDD path plus the resulting IA structure back to you.

Explored 1 list, ran 1 command
Listed files in readme_support_docs
Background terminal finished with TMPDIR=/tmp skills/sdd-skill/scripts/run_helper.sh search --query Dashboard --under docs/readme_support_docs --limit 10
I’m placing this alongside the existing support examples under docs/readme_support_docs/. I also kicked off a quick search to avoid colliding with an existing pantry-style document and to sanity-check naming.


Explored 1 file, 1 search
Non-negotiable invariants I’m following for this SDD pass:

Use the helper-first workflow: create/author instead of hand-editing the .sdd.
Keep the document repo-relative and .sdd-scoped under docs/readme_support_docs/.
Gate the result with a clean dry run plus validate_profile, then commit, then project/preview the committed state under that same profile.
Make the IA behavior come from the SDD structure itself so the ia_place_map projection is the authoritative “show” step.
I’m starting the actual authoring now: create the new example document, inspect its fresh revision, then I’ll dry-run the scaffold against the strict profile before I commit anything.


Explored 2 files, 3 searches, 2 lists, ran 2 commands
Background terminal finished with mkdir -p docs/readme_support_docs/community_food_pantry_example
Background terminal finished with TMPDIR=/tmp skills/sdd-skill/scripts/run_helper.sh create docs/readme_support_docs/community_food_pantry_example/volunteer_scheduling_app.sdd --template empty --version 0.1
Searched for children\?|insert_node_scaffold|CONTAINS|COMPOSED_OF|edges in authoringIntents.ts
Read authoringIntents.ts
Read README.md
Searched for staged_ia_place_map_preview|ia_place_map in docs
Listed files in examples
Listed files
Searched for volunteer_scheduling_v[123].*\.sdd|volunteer_scheduling.*\.png|volunteer_scheduling.*\.svg
I found the repo’s own SDD-skill guide uses this exact volunteer-scheduling scenario as its walkthrough, which is a nice confirmation that the structure we’re creating is aligned with the intended workflow. I’m turning that into a concrete strict-profile document now so the IA can be projected and previewed cleanly.


Ran 1 command
The dry run came back clean under strict and the inline ia_place_map projection matches the requested app shape, so I’m committing that helper-authored document and then I’ll confirm it with standalone validation and preview on the persisted file.


Ran 1 command
I’ve committed the SDD. I’m in the confirmation pass now: checking the persisted file, re-running validation and projection directly, and then hitting preview so we know the committed state is the one that actually renders.


Explored 1 file, ran 3 commands
Background terminal finished with TMPDIR=/tmp skills/sdd-skill/scripts/run_helper.sh validate docs/readme_support_docs/community_food_pantry_example/volunteer_scheduling_app.sdd --profile strict
Background terminal finished with TMPDIR=/tmp skills/sdd-skill/scripts/run_helper.sh project docs/readme_support_docs/community_food_pantry_example/volunteer_scheduling_app.sdd --view ia_place_map
Read volunteer_scheduling_app.sdd
Background terminal finished with TMPDIR=/tmp skills/sdd-skill/scripts/run_helper.sh preview docs/readme_support_docs/community_food_pantry_example/volunteer_scheduling_app.sdd --view ia_place_map --profile strict --format svg --backend staged_ia_place_map_preview
The committed file validates with 0 errors and 0 warnings, and the staged ia_place_map preview rendered successfully. I’m just pulling line numbers and the exact saved path now so I can hand back a clean reference to the new SDD and the IA structure.


Explored 1 file, ran 1 command
New SDD is at volunteer_scheduling_app.sdd (line 1). The requested IA is defined at Dashboard (line 2) and Volunteer Scheduling (line 12).

The information architecture is:

Dashboard navigates to Open Shifts and My Schedule.
Volunteer Scheduling contains Open Shifts, Shift Detail, and My Schedule.
Open Shifts leads to Shift Detail.
Shift Detail and My Schedule link back and forth.
I validated the persisted document under strict with 0 errors and 0 warnings, and the staged ia_place_map preview rendered successfully. The new .sdd file is created locally and is currently untracked in git.