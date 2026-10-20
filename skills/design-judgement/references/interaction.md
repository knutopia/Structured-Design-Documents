# Core interaction principles

Curated sources checked 2026-10-11 · IDs: `UX-*` · [Provenance](provenance.md)

Use this module when deciding what an interaction communicates, how a task proceeds, and how people recover. It is an original, contextual synthesis of the sources cited below. Examples are hypothetical. For organization and navigation decisions, use [information architecture](information-architecture.md). These principles do not determine a unique layout.

## UX-01 — Use heuristics to find questions, then investigate

**Basis: practice heuristics.** Nielsen’s ten heuristics are inspection lenses, not a scoring formula or a substitute for observing use. The following is a compact paraphrase of their concerns, in the original order. [Nielsen’s source](https://www.nngroup.com/articles/ten-usability-heuristics/)

| Concern | Question to investigate |
| --- | --- |
| Status | What happened; what is pending? |
| Familiar meaning | Are terms and sequences understandable? |
| Control | Can unwanted actions be left or repaired? |
| Consistency | Do controls follow expectations? |
| Prevention | Can error-prone conditions be removed? |
| Recognition | Is needed information available? |
| Efficiency | Is repeated work efficient? |
| Relevance | Is current-task information prominent? |
| Recovery | Is failure understandable and fixable? |
| Assistance | Is help available when needed? |

**Application in this KB:** turn a suspected violation into a concrete consequence. “No save status” is incomplete; “after editing an amount, a reviewer cannot tell whether leaving will lose the edit” names a task and risk. Record whether that happened, was reported, or is only predicted. Prioritize by consequence, exposure, and recoverability; do not invent numerical severity or frequency from a screenshot.

**Counterexample:** an intentionally exploratory game may withhold information that a transaction tool should expose. The task changes the evaluation. A compliance check and a heuristic critique should also remain distinct.

## UX-02 — Connect intention, available action, and interpretable result

**Basis: conceptual design theory.** An affordance concerns what an actor can do in an environment; a signifier is a perceivable clue about an action or meaning. A decorative shadow does not itself create an interaction. Norman’s explanation is useful for keeping possible action separate from perceived action. [Norman on affordances](https://jnd.org/affordances-and-design/), [Norman on signifiers](https://jnd.org/signifiers-not-affordances/)

**Decision:** for each important action, explain the affected object, the action, its scope, and its result. Consider both the difficulty of working out what to do and of interpreting what happened; those are different failure points. [Laubheimer on mistakes and the execution/evaluation gulfs](https://www.nngroup.com/articles/user-mistakes/)

**Example:** a document tool has an action labelled “Share.” Does it copy a link, grant access, or send a notification? Propose labels and feedback that expose that distinction. “Copy viewing link” and “Invite editor” describe different consequences even if both use a link icon.

**Tradeoff:** copying domain terminology helps experts only when the audience understands it. A label such as “Post” may be precise for accountants and ambiguous elsewhere. Establish the audience’s interpretation before replacing it with supposedly simpler vocabulary.

**Evaluate:** ask someone to predict the result before activation, then explain the result afterward. A successful click without a correct understanding is weak evidence that the interaction works.

## UX-03 — Reduce memory work without inventing a menu quota

**Basis: bounded research, followed by design inference.** Miller’s 1956 paper concerns absolute judgment, immediate memory, and recoding information into meaningful units. It does not prescribe how many visible navigation items a product may have. Treating “7 ± 2” as a menu, card, or section limit changes the claim’s domain without evidence. [Original paper, university-hosted reproduction](https://psychclassics.yorku.ca/Miller/)

**Application:** keep information needed for comparison available together; retain meaningful context after navigation; use labels people can recognize. Group by relationships the audience understands, not by arbitrary group size.

**Example:** an approver needs an invoice amount, receipt amount, and discrepancy reason together. Splitting them into separate short screens may increase memory work even though every screen looks simpler.

**Counterexample:** a long, alphabetized list of countries can remain useful. The person is locating a familiar item, not memorizing every entry. Decide whether search, grouping, or a different control improves the actual task.

**Evaluate:** look for repeated navigation, copied notes, forgotten values, and comparison errors. Do not replace seven with another supposedly universal magic number.

## UX-04 — Disclose according to relevance and dependency

**Basis: bounded model plus practice pattern.** Hick–Hyman models relate choice time to information in a set of alternatives under particular task conditions. They do not determine an entire navigation architecture. Hinckley’s discussion also cautions against treating model coefficients as universal. [Input Technologies and Techniques, §4.1](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/Input-Technologies-and-Techniques-HCI-Handbook-2nd-Edition.pdf)

Progressive disclosure makes less frequently needed options available through a discoverable secondary path. Staged disclosure sequences required work; these are different decisions. [Nielsen on progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)

**Decision:** distinguish information people need now, specialist choices they may need, and later questions whose relevance depends on an earlier answer. Hide a rarely used export encoding only if the default is suitable and people who need the alternative can find it. Keep cost and consequential restrictions visible before commitment.

**Tradeoff:** spreading a comparison across tabs can make the comparison harder. An expert configuration surface may benefit from simultaneous visibility. “Advanced” is a poor label if it conceals ordinary tasks for a different user group.

**Evaluate:** test discovery of secondary functions as well as speed on the common path. Compare total completion, backtracking, and errors, rather than congratulating the design for fewer initial options.

## UX-05 — Treat pointing as one part of interaction cost

**Basis: empirical motor-performance model.** Fitts’s law connects movement time with target distance and width in a defined pointing task. Its parameters and fit depend on conditions and devices; it is not a law of product importance, navigation depth, or conversion. [MacKenzie’s research review](https://www.yorku.ca/mack/hci1992.html)

**Application:** inspect target size, spacing, repeated travel, and accidental activation on the actual device. A compact toolbar can be efficient with a mouse and difficult with touch. Making a destructive action easier to hit is not automatically a better experience.

**Example:** after selecting a table row, an action at the opposite end of a large screen may require repeated travel. A nearby action or keyboard path is a candidate improvement, provided the affected row is unambiguous and controls do not appear under the pointer unexpectedly.

**Evaluate:** observe repeated use, errors, touch occlusion, and non-pointer access. Accessibility criteria supply separate obligations; see [inclusive interaction](inclusion-and-content.md).

## UX-06 — Give truthful feedback about the work that matters

**Basis: response-time practice guidance.** Nielsen’s response-time discussion relates delay to continuity and attention. Use it to investigate perceived responsiveness; it does not require a spinner on every asynchronous request or establish a universal product service-level agreement. [Response-time guidance](https://www.nngroup.com/articles/response-times-3-important-limits/)

**Application:** distinguish input accepted, work underway, work committed, and work failed. Show progress only when it represents something meaningful. Decide whether a user can continue elsewhere, cancel, or return later.

**Example:** an upload can finish transferring before processing finishes. “Upload complete” should not imply the document is ready to use if it is still being processed. For autosave, distinguish an edit held locally from one confirmed saved; do not promise persistence the system cannot provide.

**Tradeoff:** an immediate result may be sufficient feedback without animation. A long background operation may need a persistent status destination. A progress estimate that repeatedly jumps backward may be less useful than a clear stage description.

**Evaluate:** include slow, interrupted, failed, repeated, and late-success operations. Check what a person believes happened before they retry or leave. Status must be available through the relevant access modes, not merely movement or color.

## UX-07 — Design prevention and recovery together

**Basis: practice guidance.** A slip is an unintended execution error; a mistake can follow from an incorrect understanding of the task or system. Constraints and forgiving input can prevent some slips, while better explanations and previews address misunderstandings. [Slips](https://www.nngroup.com/articles/slips/), [mistakes](https://www.nngroup.com/articles/user-mistakes/)

**Application:** choose the safeguard according to consequence and reversibility. An undoable archive operation, sending a message to another person, and permanently deleting shared material have different recovery possibilities. A confirmation dialog is useful only if it reveals enough to make a meaningful decision; repetitive generic confirmation can become habitual clicking.

**Example:** “Delete 42 selected records?” is still insufficient if the selection spans hidden pages. A useful review identifies the selection scope and consequences. If deletion is recoverable, explain the recovery path and any limits. If only part of a batch succeeds, identify what happened to each affected subset before offering retry.

**Counterexample:** disabling submission without showing what prevents it leaves people stuck. Permitting a submission attempt that explains errors can sometimes be more usable; the form and accessibility context matter.

**Evaluate:** deliberately use wrong formats, stale data, lost connectivity, repeated submissions, and interrupted sessions. Check preservation of valid input and whether retry could repeat an already completed action. See the forms guidance in [inclusive interaction](inclusion-and-content.md).

## UX-08 — Make visual grouping express the intended meaning

**Basis: visual-design practice.** Relative scale, contrast, spacing, and grouping guide attention. A hierarchy should make priority and relationships legible; a page full of equally prominent elements cannot communicate much priority. [Gordon on visual hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/)

**Application:** decide what users need to notice and compare before choosing emphasis. Check that a label is visually associated with its field, a warning with its affected decision, and a section with its own actions. Whitespace can separate unrelated tasks or accidentally separate related content.

**Example:** a bright promotional panel should not obscure the status of an unfinished application. A dense operational table can be appropriate when users need to compare many records; large decorative cards may reduce useful comparison without improving comprehension.

**Tradeoff:** visual hierarchy is not semantic hierarchy. A large heading styled as a paragraph remains a problem for assistive navigation. Brand expression and aesthetic pleasure matter, but do not prove that a task is understandable.

**Evaluate:** test realistic content, long labels, narrow viewports, zoom, empty results, and large datasets. Ask users to identify the current task, available action, and result. A structural diagram does not by itself demonstrate pixel layout, readable text, or a usable focus order.

## UX-09 — Resolve competing principles explicitly

**Basis: this KB’s design synthesis.** No single rule selects the best design when discoverability, efficiency, control, and simplicity conflict.

Consider an expense approval tool:

| Candidate | Potential benefit | Cost or uncertainty | Useful test |
| --- | --- | --- | --- |
| One request per page | Focus and room for explanation | Slow repeated comparison | Observe a realistic approval batch |
| List with detail pane | Preserves list context and nearby evidence | May be cramped on small displays | Test comparison and responsive behavior |
| Batch approval | Fast for routine cases | Easy to miss exceptions or hidden selection | Include an exception and partial failure |

A defensible recommendation states which user/task is primary, what evidence favors the choice, what remains unknown, and when the choice should change. “Minimalist,” “intuitive,” and a named law do not supply that argument. Record the rationale with the [decision template](evidence-and-decisions.md).

## Source notes and boundaries

All links above were consulted on 2026-10-11. This module uses short paraphrases and original examples.

- **Nielsen, ten heuristics:** originator’s public practitioner reference. Useful inspection coverage; not an exhaustive standard or evidence of this product’s usability.
- **Norman, affordance and signifier essays:** author’s public conceptual explanations. Useful terminology; not a component catalog.
- **Miller (1956):** primary research paper reproduced by York University. Historical evidence with a specific experimental scope, not a modern interface item limit.
- **Hinckley, Input Technologies and Techniques:** Microsoft-hosted author draft, especially §4.1. Model context and caveats; the copy is explicitly a draft, not a newly verified edition of the handbook.
- **MacKenzie (1992):** author-hosted research review. Use its methodological boundaries when applying pointing models.
- **NN/g disclosure, response-time, error, and visual-hierarchy articles:** public practitioner guidance. Their examples are contextual and sometimes dated; local decisions still require evaluation.

Further work: deeper coverage of expert tools, direct manipulation, collaborative editing, notification attention, data visualization, and aesthetics. These are separate research areas, not missing justifications to be filled with invented laws.
