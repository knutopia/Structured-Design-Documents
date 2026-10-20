# Inclusive interaction and content

Use this reference for product entry, operation, comprehension, and recovery. Keyboard navigation and assistive-technology observations are evidence of the real product; a screenshot alone cannot establish its behavior.

**Authority:** Check exact WCAG 2.2 criteria for the chosen conformance target. Understanding documents, APG, and cognitive guidance are informative; GOV.UK patterns are contextual. This selection and its examples are design synthesis, not a complete audit or additional requirements. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## AX-01 — Describe operable controls and meaningful relationships

**Decision:** Identify what each control does, its accessible name, current state, and expected interaction. Prefer established controls with familiar keyboard behavior. Organize headings, groups, labels, and reading order around the task. Styling a text fragment to resemble a button does not establish its semantics or behavior. Relevant normative criteria include 1.3.1, 1.3.2, 2.1.1, 2.1.2, 2.5.3, and 4.1.2. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

**Example and tradeoff:** A selectable table needs distinguishable selection and keyboard focus. A custom grid can make repeated editing efficient, but requires coherent movement within the grid. Ordinary links in a simple results table may serve the task with less interaction complexity. APG describes the distinction between movement among components and movement within composite widgets. [APG keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)

**Verify:** Complete a task and correct mistakes without a pointer. Inspect accessibility-tree names and states. Record the browser and assistive-technology combinations checked.

## AX-02 — Preserve orientation across dialogs and changes

**Decision:** For each overlay or dynamic replacement, specify how users enter it, recognize its purpose, leave it, and resume work. A modal dialog needs an appropriate initial focus location, contained keyboard navigation, an accessible name, and an exit. On closing, focus normally returns to its invoker; if that control disappeared, choose a sensible continuation. Initial focus depends on content and consequences, rather than always selecting the first input. [APG modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

**Example and tradeoff:** After deleting a row through a dialog, place focus at a useful neighboring row or list control. A long comparison task may deserve a page instead of a modal that hides essential context. Document the actual observed behavior when analyzing an existing product; proposed repairs belong separately.

**Verify:** Test opening, dismissal, submission, and deletion with a keyboard at enlarged text sizes. Check criterion 2.4.3 for order, 2.4.7 for visibility, and 2.4.11 for author-created content entirely obscuring the focused component. Do not confuse the AA minimum with the stronger AAA criterion 2.4.12. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## AX-03 — Make forms forgiving and recovery specific

**Decision:** Ask only for information needed to complete the task. Distinguish an invalid answer from lack of eligibility, permission, or service availability. Keep entered values after a validation failure; explain what needs changing. Accept harmless formatting differences where interpretation remains unambiguous. GOV.UK's validation guidance is a useful model, including its warning against premature validation while someone is still typing. Its implementation rules are specific to that design system. [GOV.UK validation](https://design-system.service.gov.uk/patterns/validation/)

**Example and tradeoff:** If an identifier is incomplete, describe the required format near the field. If the service is unavailable, repeating the same input is not a repair. A summary linked to affected fields supports recovery in a long submitted form; GOV.UK pairs that summary with field-level messages. A compact inline editor may need a different presentation while preserving equivalent clarity. [GOV.UK error summary](https://design-system.service.gov.uk/components/error-summary/)

**Verify:** Exercise multiple errors, server failure, and retry. Check 3.3.1–3.3.3, 3.3.7, and applicable 3.3.4 requirements against their exact scope and exceptions. Confirmation dialogs are not required for every submission. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## AX-04 — Communicate progress without taking over

**Decision:** Distinguish waiting, completion, partial completion, and failure. For a displayed status message that does not move focus or change context, provide a programmatic announcement appropriate to its urgency. Do not announce every minor DOM update or repeatedly interrupt typing. Criterion 4.1.3 concerns qualifying status messages; it does not mandate a new status message for every content change. [Understanding 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

**Example and tradeoff:** An attachment upload can report completion and identify a failed file while preserving the draft. An actual progress estimate helps planning; an invented percentage misrepresents what the system knows. If cancellation only stops future work, show any completed effects instead of implying that nothing happened.

**Verify:** Listen to announcements while performing another task. Check whether completion is discoverable, whether retries preserve work, and whether a persistent message has enough context to be understood independently. A spinner that disappears is weak evidence of what happened.

## AX-05 — Preserve tasks through resizing and input variation

**Decision:** Design responsive behavior around retained information and capabilities. For vertical scrolling content, criterion 1.4.10 tests reflow at a width equivalent to 320 CSS pixels; required two-dimensional content has an exception. That exception does not automatically cover the surrounding page. Avoid hiding essential actions when rearranging a layout. [Understanding 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

**Example and tradeoff:** A schedule grid may need two-dimensional navigation, while its filters and booking form can reflow. A list alternative can help people perform a task that does not require the grid's spatial relationships. Enlarging every control can reduce the visible context, so test density choices against actual tasks.

**Verify:** Test text enlargement, narrow viewports, and pointer precision. Criterion 2.5.8 has a 24-by-24 CSS-pixel minimum with five specified exceptions; it is not a universal ideal target size. Use the criterion's spacing test and definitions instead of substituting a remembered platform number. [Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

## AX-06 — Reduce language and memory barriers

**Decision:** Put instructions where they are needed, use familiar terms, explain unfamiliar ones, and expose the information required to continue. Group content around a meaningful task rather than a fixed number of items. Let people revisit earlier answers without reconstructing them from memory. Cognitive accessibility also requires research with people whose needs differ; plain language alone cannot resolve every barrier. [W3C cognitive-accessibility guidance](https://www.w3.org/TR/coga-usable/)

**Example and tradeoff:** A review step should show the relevant choices with a way to change them. “Continue” is appropriate for moving through a form, but a final action should communicate its consequence. Concision must not remove conditions needed for an informed decision. Specialized vocabulary can be useful to experts; provide contextual explanations where audiences differ.

**Verify:** Ask participants to explain what happens next in their own words. Test interrupted use and return visits. Reading-level scores and an LLM's assessment of clarity do not establish comprehension.

## AX-07 — Treat localization as a structural requirement

**Decision:** Plan for different scripts, reading directions, text lengths, names, addresses, date formats, and units. A locale is not evidence of every individual's identity or preferences. Use explicit context where a value would otherwise be ambiguous, and preserve a user's work when changing language. W3C's internationalization guidance provides practical starting points. [Internationalization quick tips](https://www.w3.org/International/quicktips/)

**Example and tradeoff:** A fixed-width “first name / last name” layout can fail both visually and conceptually. Ask for the form of name the service actually needs. A translated label can require more space; truncating it may remove the distinguishing word.

**Verify:** Review with relevant language and cultural expertise. Test representative scripts, long labels, and right-to-left layouts. Pseudolocalization can expose layout defects but cannot validate meaning.

## AX-08 — Make refusal and changing one's mind usable

**Decision:** Treat informed choice as product quality: explain consequences, keep refusal understandable, and provide a route to revisit choices. Avoid confusing negations, guilt-laden decline text, concealed optional charges, and barriers that make leaving substantially harder than entering. These are design recommendations; a particular jurisdiction's obligations require separate assessment.

**Example and tradeoff:** GOV.UK's cookie pattern visibly supports accepting and rejecting nonessential cookies, then managing preferences. Use that as a concrete example of meaningful choice, not a universal legal template. [GOV.UK cookie banner](https://design-system.service.gov.uk/components/cookie-banner/)

**Verify:** Run the decline and withdrawal journeys, not only acceptance. Ask what users believe they agreed to. Check whether defaults, button prominence, and persistence of the choice support that understanding.

## Source notes and collection gaps

All linked sources checked **2026-10-11**; public HTML was accessible.

| Source | Type and practical value | Limits |
| --- | --- | --- |
| WCAG 2.2 | W3C Recommendation; exact criteria, levels, and exceptions | A conformance framework, not a complete account of usability or every disability |
| W3C Understanding pages | Informative interpretation and examples | Supporting guidance; read the linked normative criterion for conformance |
| APG keyboard and modal pages | Official implementation guidance; interaction conventions | Examples require testing in the target technology environment |
| Cognitive-accessibility guidance | W3C Working Group Note; needs, patterns, and research prompts | Advisory; its users and recommendations are not a single homogeneous profile |
| W3C internationalization tips | Official introductory guidance; localization considerations | An entry point, not a complete multilingual product specification |
| GOV.UK validation, error summary, cookie banner | Maintainer-authored patterns from deployed services | Their exact implementation policies and legal context are not universal |

Further collection should cover authentication, media alternatives, motion and timing, nonvisual data exploration, assisted-digital support, and research with disabled participants. A design document can identify intended interactions and checks; it cannot prove an implementation meets them.
