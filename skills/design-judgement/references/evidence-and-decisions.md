# Evidence and decision records

Original working guidance · IDs: `EV-*` · [Provenance](provenance.md)

Use these optional records to make consequential design reasoning reviewable. They are an original working convention, not a published research method or a machine-readable schema. Use ordinary prose or tables, scaled to the decision.

## EV-01 — Identify which kind of work is being done

**Analysis of an existing product:** describe what the available evidence supports. A supplied screenshot supports claims about that captured surface. A walkthrough supports claims about the states and paths visited. A requirements document supports claims about intended behavior. None establishes every role, platform, or failure path.

**Synthesis of a proposed product:** choose a structure under stated assumptions. A functional brief can constrain features without determining navigation, ownership, or task flow. Make important alternatives and their costs visible.

**Evaluation:** assess a current or proposed experience against an explicit task and source of guidance. Separate a demonstrated failure, a standards issue, a heuristic concern, and a preference. Each needs different evidence and may warrant different action.

A request can involve all three. Keep the outputs distinguishable; a proposed improvement must not silently replace the observed product in a descriptive model. See the claim record below and [PD-02](discovery-and-evaluation.md#pd-02--keep-observation-explanation-and-proposal-separate).

## EV-02 — Preserve provenance at the claim level

Use as much of the following record as the consequence of the claim warrants:

| Field | What it records |
| --- | --- |
| Claim | One specific assertion about a task, structure, or behavior |
| Status | Observed, reported, inferred, proposed, or unknown |
| Evidence | File/URL, screenshot identifier, recording timestamp, research note, or requirement locator |
| Conditions | Date/build, account role, device, viewport, input method, data state, task |
| Interpretation | What the evidence supports and what it does not establish |
| Competing explanation | A plausible alternative if the claim is inferred |
| Open question | What further evidence would resolve uncertainty |
| Model impact | The location, interaction, relationship, or scope affected |

“Reported” preserves testimony without treating it as direct observation. A support report that work disappeared is evidence of the report; reproducing the behavior is a separate step. Conflicting reports should remain visible until differences in version, permissions, conditions, or recollection are understood.

Do not invent precision. “Inspected in an administrator session; member behavior untested” is more informative than “92% confident.” A user-visible confirmation is evidence of feedback, while durable persistence or delivery may require another observation.

## EV-03 — Explain consequential choices, not every small preference

A useful decision record connects the problem to the choice. It can be a paragraph or the following compact table:

| Field | Hypothetical example |
| --- | --- |
| Decision | Where reviewers compare receipts with expense amounts |
| Task and outcome | Identify discrepancies before approval |
| Evidence and limits | Brief requires comparison; actual reviewer frequency is unknown |
| Options | Separate receipt page; detail with adjacent receipt; batch comparison table |
| Provisional choice | Detail with adjacent receipt |
| Reason | Keeps the two values available during comparison; fits individual review |
| Cost | Uses space; may be inefficient for reviewers comparing many expenses |
| Constraint | Must work on the supported small viewport and access modes |
| Next test | Observe representative reviewers resolving an amount discrepancy |
| Reconsider when | Work is primarily cross-expense comparison, or the pane obstructs use |

This is an original worked example, not evidence for a real product. The recognition and comparison rationale is discussed in [UX-03](interaction.md#ux-03--reduce-memory-work-without-inventing-a-menu-quota). The example deliberately does not claim a measured time saving.

Weak rationale: “A split pane is best practice.” Stronger rationale: “A split pane is a candidate because the task requires simultaneous comparison; its small-screen and batch-work costs remain to be tested.”

## EV-04 — Let uncertainty determine the next check

| Uncertainty | Useful next check | What it would not prove |
| --- | --- | --- |
| Does this path exist? | Inspect that path under stated conditions | Everyone can find it |
| Does this category make sense? | Research grouping and test finding tasks | Full interaction usability |
| Can people recover after a failed submission? | Exercise a realistic failure in a prototype or implementation | Long-term product value |
| Can a keyboard user operate the dialog? | Test focus, traversal, actions, dismissal, and return | Conformance of the entire product |
| Is this new structure useful in repeated work? | Observe a realistic work session or pilot | A causal population-wide improvement |
| Is a formal model valid? | Check it against its governing contract | Fidelity to the product or good UX |

The method boundaries are developed with sources in [product discovery](discovery-and-evaluation.md), [IA](information-architecture.md), and [inclusive interaction](inclusion-and-content.md). An expert review can identify a credible issue before research is available. Label its basis accurately and choose a proportionate response.

## EV-05 — Review model fidelity and design quality separately

For a **descriptive model**, review evidence coverage, exact labels where relevant, role/state differences, conceptual distinctions, relationship meaning, and unknowns. A beautifully simplified diagram that erases an observed awkward path is a poor record of the current product.

For a **proposal**, review need, alternatives, consequences, recovery, inclusion, and evaluation plan. A perfectly valid hierarchy that mirrors the feature list may still be a poor product structure.

For **both**, assess representational correctness separately from the design evidence that supports meaning. Keep an explicit scope statement: what task, roles, platform, and paths are covered; what was unobserved or deliberately excluded. Record gaps without fabricating content to make a diagram look complete.

## EV-06 — Resolve disagreements by source role

Apply an applicable standard to its actual scope; use product evidence to test a claim about this product; use a practice pattern to generate candidates. A pattern borrowed from a government service is not automatically optimal for a creative tool. A usability preference does not override an applicable accessibility requirement. An attractive screenshot does not determine the semantics of a formal model.

When evidence and guidance point in different directions, record the tension and inspect the mechanism. For example, simplifying a page by hiding instructions may make it shorter while preventing occasional users from completing it. The disputed quantity is not visual simplicity alone; it is whether the necessary task information remains available and understood.

If a source cannot be checked, narrow the claim. If a book has only a publisher summary available, use it as a reading lead. Do not present an imagined chapter summary as collected knowledge.
