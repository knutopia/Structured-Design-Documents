## Practical Use of SDD

SDD makes design structure available as content in a project, using a lightweight text-based syntax. This can be useful in a variety of ways:

### UX Inventory: Status Quo Map

With an existing software product, especially while using continuous delivery over a long period of time, it can be hard to track what actually exists in production. Using SDD as a lightweight document format, capturing the currently existing information architecture can provide a "status quo map" of what is available where. 

Such a map can be used as a decision making tool when prioritizing the backlog, instead of relying on "blind" issue- or feature descriptions alone. 

Besides an inventory on the information-architecture level, "higher level" inventories of flows, journeys, and opportunities can reveal how well the current product is actually aligned with higher-level intentions.

When creating, evaluating, and comparing new designs (wireframes, visuals or prototypes) having the status quo map available as a point of reference provides clear visibility of how the new designs fit it - or don't - with the existing structure.

The status quo map keeps tabs on continuous delivery, and supports making well-informed planning- and implementation choices.

### Making Competing Solutions Visible

A special case of the UX inventory addresses the situation where a SaaS product exists in several parallel, similar-but-different versions. This is often the case when the specific needs of different large customers are being served.

In that situation, opportunities for re-using structures between product versions are not always clear. By inventorying structural variations, and identifying best-in-class solutions, different product versions can be structured to be aligned where possible, making variations a deliverate, clear choice. This can save a lot of development resources over time.

### Contextualizing New Designs

When designing, we create wireframes, visuals or prototypes. Those artifacts communicate a proposed solution.

Designs, especially high-fidelity designs, sometimes look "complete" to non-designers, because they look "good". That can lead to misunderstandings about the complexity of a design: when looking at a screen, a non-designer sometimes does not understand that there may be many different states, flows and neighboring screens involved to "make the screen work". 

Using SDD, we can fill in the context for a design artefact: where does this screen live, what else is needed, what are the relevant details? A complete picture can be provided, framing the design exploration, without having to actually create design artifacts for all the peripheral elements. 

The design exploration can focus on its key elements. SDD provides the surrounding context. The design exploration can be judged on its merits, while seeing the context. This visibility avoids expensive scope surprises in the future.

### Making High-Level Drivers Visible

"Above" the actual product, there is a high-level understanding of what the product is supposed to do. Sometimes this information exists in "ambient" form, as shared understanding between shareholders, and sometimes it is documented in slide decks or as epics in the backlog.

Sometimes, different stakeholders actually have different views on what the product is supposed to do. This can be healthy, but it can also lead to misplaced use of development resources. It pays to have stakeholders aligned.

With SDD, we can capture high-level product drivers (such as opportunities, journeys). This can be done "from scratch", for example as part of a workshop to align different stakeholders points of view. It can also be done based on existing documentation. 

The advantage of SDD is that this high-level information can be connected to the actual product: which flows / areas / places actually realize which opportunity? Which ones are covered well? Which ones are being left out? How do new features map to the high-level drivers? This connection between product reality and high-level drivers provides clarity for making product decisions.

### Coordinating Similar Solutions

Sometimes, a product is offered in several similar-but-different variations, for example to serve different enterprise customers with separate needs. Coordinating development- and support activities across such parallel tracks is challenging. By documenting the information architecture variations as SDD across product variations, coordinating updates becomes easier, avoiding blind spots. Beyond information architecture, tracking screen composition and state handling variations with Ui contracts information in SDD can help with coordinating front end changes. When it's time to stand up another product variations (for a new enterprise customer, for example), the clear picture available in SDD can accelerate planning and show opportunities for reusing existing solutions, focusing development.

### Aligning New Designs With a Design System & Component Library

When there is an existing design system and a matching front-end component library, real components can be mapped to SDD nodes, to be used to express structural composition of screens (what component is used where.) Logical state sequences that are expressed by real components can be expressed as ViewState and State sequences in SDD. 

This SDD-representation of front-end reality provides an opportunity to align new designs with actual front end capabilities, providing predictability and revealing gaps in design work.

### Alignment For Implementing a Well-Structured Front End

Just like the design process, actual implementation also benefits from clear references to actual, existing front-end structures in a clear format. Both front-end developers and LLMs can easily read and reference SDD. 

If the SDD is well-curated, it can contain technical details like API dependencies or links to actual front-end components. How much detail makes sense depends on the specifics of a given situation. There is a clear value proposition for structural clarity.

### Providing UX Guidance for Vibe-Coded Prototypes

Sometimes vibe-coded prototypes are used to explore new features for existing products, and even to guide implementation of new features. 

When generating a prototype, the LLM will focus on responding to the prompt's ask, and the resulting structural design of the prototype (the screens, states, steps, details) will be "byproducts", that may or (more like) may not match existing architecture and conventions, resulting in drift. This drift becomes expensive once the prototype is used as a reference for implementation and the gap becomes exposed. 

Authoring prompts to create well-aligned prototypes is hard, especially when the author is focused on their idea, not on alignment. Attaching SDD to the prompt can help: the SDD can contain examples of information architecture that serve as templates or as examples. Beyond information architecture, common flows, and UI contracts could be included. The LLM can rely on this guidance to create a well-aligned protoype, instead of genrating a random structure. 

By providing prototypers with a well-defined set of SDDs to use as prompt attachements, drift can be kept at bay.

### Issue Triage With UX Perspective

When triaging bugs and other issues, it is often hard (and time-intensive) to pin down where exactly in the product the issue happens. ("How does this feature actually look in the app, how does it work?")

By making SDD node IDs available as part of issue documentation, it becomes immediately clear where an issue occurs. With this information, it then becomes possible to see "hotspots" in the app, where issues are concentrated. That in turn helps with issue triage.

SDD node IDs can be added to issues manually, but a better approach is to capture them automatically using tooling. For example, a screenshot attached to a bug report can include a page footer, which is barely visible to the end user of the product, but shows encoded SDD node identifiers that map to a location. The "location" can be a simple place ID, or include more detail such as component IDs or viewState IDs. The functionality to provision such page footers does need to be built.

### Accountability for Product Success

(...)

# **Concrete Examples of Use**

## Comparing as-planned to as-built


...works best together with a design system, healthy process etc

...it's about signal, not ceremony
