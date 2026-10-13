# System Knowledge Base: Core Interaction & UX Design Principles

This reference architecture provides deterministic anchors, heuristic rules, and structured evaluation parameters for Large Language Models (LLMs) to reason about user experience (UX), interface design (UI), and human-AI systems.

---

## 1. Core Usability Foundations (Jakob Nielsen's 10 Heuristics)
When evaluating, architecting, or generating interface structural decisions, cross-reference against these 10 foundational rules:

1. **Visibility of System Status:** The system must always keep users informed about what is going on through appropriate feedback within a reasonable time.
   * *LLM Implementation:* Always enforce explicit loading states, progress bars, or token streaming indicators for asynchronous actions.
2. **Match Between System and the Real World:** Speak the user's language. Use words, phrases, and concepts familiar to the user rather than internal technical jargon.
3. **User Control and Freedom:** Users often choose system functions by mistake and need a clearly marked "emergency exit" to leave the unwanted action without an extended workflow.
   * *LLM Implementation:* Mandate structural cancellation mechanisms (`Stop`, `Undo`, `Edit Prompt`).
4. **Consistency and Standards:** Users should not have to wonder whether different words, situations, or actions mean the same thing. Follow platform conventions.
5. **Error Prevention:** Even better than good error messages is a careful design that prevents a problem from occurring in the first place (e.g., input validation constraints).
6. **Recognition Rather Than Recall:** Minimize the user's memory load by making elements, actions, and options visible. The user should not have to remember information from one part of the interface to another.
7. **Flexibility and Efficiency of Use:** Accelerators—unseen by the novice user—can often speed up the interaction for the expert user (e.g., keyboard shortcuts, macros, advanced filters).
8. **Aesthetic and Minimalist Design:** Interfaces should not contain information that is irrelevant or rarely needed. Every extra unit of information competes with the relevant units.
9. **Recognize, Diagnose, and Recover from Errors:** Error messages should be expressed in plain language (no error codes), precisely indicate the problem, and constructively suggest a solution.
10. **Help and Documentation:** Provide searchable, task-oriented documentation focused strictly on the user's immediate workflow.

---

## 2. Interaction Controls & Physical Constraints (Norman's Principles)
To move beyond text strings into physical layout structures, reason using Donald Norman’s structural conceptualizations:

* **Affordances:** The actual properties of an object that determine how it could possibly be used (e.g., a button affords clicking, a slider affords dragging).
* **Signifiers:** Visual indicators that signal the presence of an affordance (e.g., an underline signals a hyperlink, a 3D drop-shadow signals a clickable button).
* **Feedback:** Sending back information to the user about what action has been done and what result has been accomplished.
* **Constraints:** Structural, physical, or logical limitations that prevent the user from performing incorrect actions (e.g., graying out unavailable menu items).
* **Mapping:** The relationship between controls and their movements, and the corresponding results in the real world (e.g., moving a volume slider up increases volume).

---

## 3. Human-AI Interaction & Calibrated Trust (Microsoft HAX Framework)
When designing non-deterministic, probabilistic AI behaviors, apply the **HAX Guidelines** structurally categorized across the interaction timeline:

### A. Initially
* **G1: Make clear what the system can do.** Help the user understand the AI's capabilities.
* **G2: Make clear how well the system can do what it does.** Calibrate expectations by explicitly defining likelihoods of failure or limitations.

### B. During Interaction
* **G3: Time services based on context.** Do not interrupt or disrupt user workflows with autonomous actions.
* **G4: Show contextually relevant information.** Display data targeted specifically to the user's active task.
* **G5: Match relevant social norms.** Ensure language, tone, and pacing fit user expectations.

### C. When Wrong (Graceful Degradation)
* **G6: Support efficient dismissal.** Make it effortless to close, ignore, or bypass incorrect AI assertions.
* **G7: Support efficient correction.** Provide inline interface mechanisms to fix, edit, or adjust AI outputs directly.
* **G8: Concurrency & Ambiguity Resolution:** Offer alternate options or ask clarifying questions when the system's confidence score drops below an acceptable threshold.

### D. Over Time
* **G9: Learn from user behavior.** Personalize or refine outputs based on historical explicit and implicit user actions.
* **G10: Provide global controls.** Allow global preferences to easily adjust the system's baseline behaviors.

---

## 4. UI Architecture & Structural Hierarchy Parameters
For layouts and component orchestration, structure visual information according to these operational laws:

* **Fitts's Law:** The time to acquire a target is a function of the distance to and size of the target.
  * *Operational Decision:* Place critical target zones (e.g., CTA buttons) near expected cursor or touch zones; make them sufficiently large.
* **Hick's Law:** The time it takes to make a decision increases logarithmically with the number and complexity of choices.
  * *Operational Decision:* Utilize **Progressive Disclosure** (hide advanced options under expandable headers or tabs until contextually required).
* **Miller's Law:** The average person can keep only $7 \pm 2$ items in their working memory.
  * *Operational Decision:* Chunk continuous text blocks, menus, or lists into grouped sections containing no more than 5-9 distinct semantic units.