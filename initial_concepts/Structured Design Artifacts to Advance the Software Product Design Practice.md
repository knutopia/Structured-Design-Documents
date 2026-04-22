# **Structured Design Artifacts to Advance the Software Product Design Practice**

Change history:
v0.4 added SDD-Repo note
v0.3 changed SDML to SDD-Text   
v0.2 …changed surface-level approach  
v0.1 initial draft

This is the original concept, written before the creation of the [SDD project](../).

# *Introduction*

This document outlines a vision to create well-Structured Design Artifacts, specifically diagrams, to software product creation activities, to replace commonly used unstructured diagrams.

The value proposition is that well-structured diagrams will unlock modern collaboration practices, providing *more grip* for design to make an impact in software production by leveraging interoperability, composability, reusability, automation and standards network effects, instead of isolating design diagrams in the designer’s domain.

Product design can bring tremendous value to software product creation. The unstructured nature of traditional design deliverables (that are meant to communicate structure) handicaps the effectiveness and integration of product design in modern software product creation. Let’s change that.

## *Design As Code?*

This could be called *Design as Code.* While code-based design documentation becomes a possibility under the vision (including the use of LLMs to work on Structured Design Artifacts), Structured Design Artifacts are also simply a way to better capture traditional, manual structural design work products.

# *Today…*

In software product design, high-level artifacts like journey maps, flows, information architecture diagrams are meant to capture ideas, set direction, inform downstream design work and implementation, and shape products.

Yet those types of artifacts exist as one-off drawings of boxes and arrows in whiteboard apps, in visual design apps and in PDF files. The actual real-life impact of such deliverables relies on an audience of participants in the product organization that brings…

1. Goodwill / incentives towards engaging with design, understanding its value  
2. Patience to deal with design tools and to link / integrate design artifacts into their own creations  
3. Design maturity to understand what they are looking at

On the creation side, success depends on designers that bring a healthy amount of cross-functional interest to the table, and who invest constant energy in making their output relevant to their audience.

This works in healthy product organizations, with high design maturity.

## *High Level Design Artifacts Often Lack Visibility*

More often than not, high-level design artifacts end up on the sidelines of product creation, separated from the shipping product by *drift* \- the gap of what the product could / should be and what it is.

Designers consider their high-level artifacts when they create lower-level solutions, but many product managers, architects, engineers and executives will simply go about their day, creating their own work products, without ever giving these exotic, hard-to-find, hard-to-deal-with design things any thought at all.

With LLMs creating code, product definition and product execution move closer together, tightening the product delivery loop. Design, especially high-level structural design, ends up on the sidelines, a speed bump, or simply excluded from the loop.

As this happens, some of the strategic value of high-level product design is replaced by other  product definition practices (epics / stories). Some design value is simply left unrealized.

Product design as a contributing discipline runs the risk of becoming marginalized.

## *How Can High-Level Design be More Relevant?*

Answering this question will make products better: design has a lot to give. Answering it will also give the design profession more relevance in the product process: design has a lot to lose.

# *Capture Semantic Design Structure: SDD-Text*

Here is the core idea: create SDD-Text (Structured Design Documents \- Text), a domain-specific language (DSL) to semantically capture the structure of product design artifacts. Make it simple to read and simple to write (“Text” in the name), for people and for LLMs. Then create tools to create, edit, track, integrate *“Structured Design Artifacts” based on the DSL*. Leverage them with existing common product design-, product management- and product development tools.

The language will define…

* Types of nodes  
* Node attributes  
* Connection types between nodes  
* Ways to link external content  
* Ways to specify user actions  
* Validation rules  
* Room for customization  
* Template mechanics  
* Ways to design visually expressive diagrams  
* A crisp markup format  
* Versioning of the language

(…or something similar. Actually designing the markup language will be serious work. A good part of the challenge is to keep the design lightweight, and flexible to adapt to different designer’s existing habits. We can learn from successes and failures of existing formats like Mermaid and UML.)

Structured Design Artifacts will be just as easily created as today’s boxes-and-arrows.

## *Unlocking Value*

The well-formed granular nature of a Structured Design Artifact levels up its usefulness:

* Specific details in diagrams can be referenced by 3rd party tools.  
  * as links (for example from a Jira issue)  
  * to parse / understand a diagram (for example, to generate a prototype)  
  * to edit a diagram (with a simple markup editor, or from within a code editor, or from within a QA tool)  
* Versioning and source control become actually useful because they track details.  
  * Deltas are easily identified (like deltas in a code base)  
    * Useful for co-creation  
    * Useful for benchmarking alternative structures  
* Tracking content relationships can be automated or assisted by tools. This encourages structural integrity and completeness from journeys to flows to surfaces to components to states, and back.  
  * Linting to highlight inconsistencies  
  * Diffing to track edits  
  * Querying to search for details  
  * Auto-complete (tabbing) to simplify editing  
* Different diagrams can be easily combined, since they fit together by default.  
* Patterns and elements are easily reused across different contexts  
* More people can make contributions  
  * Without tribal knowledge  
  * Without design tool skills that may intimidate non-designers  
* LLMs can accurately read and create diagram content, without burning tokens to guess meaning.  
  * Design artifacts get more presence in LLM workflows.  
  * LLMs can create front end code that is driven by design documents, as opposed to being generated solely “backwards from code.”

In other words, we’ll get to do structural design that leverages interoperability, composability, reusability, automation leverage and standards network effects. Won’t that be nice?

## *Consolidating Design in the Product Development Loop*

In engineering and in product management practice, those types of features have been around for a while, shaping the product development loop. When design levels up its tooling and deliverables, it will be a better, more open partner in the product organization, even with LLMs involved.

When design artifacts exist *“within”* the product development loop (as opposed to *“somewhere near it”*), design drift becomes obvious, and it becomes *“everybody’s problem”*… or better, *“improvement opportunity”.*

Drift does not just occur between the product definition and the implementation. It also happens on higher levels, where design, and product management details (requirements or stories) go off in their own directions. All of these possible points of friction become more addressable.

This is how design becomes more relevant, and the product benefits.

## *What Design Artifacts?*

Representations of flow:

* Journey maps (customer journey map, user journey map)  
* Feature-level and screen-level flows *(„wireflows“)*

Representations of composition / information architecture:

* Application map  
* Navigation structure  
* Screens, Surface Level Structure  
* State diagrams  
* Patterns

Non-standard diagrams that I find useful in my practice:

* Domain map  
* Story-to-feature map

These types of documents have always been created by designers and by others in the product organization, as visual artifacts: boxes and arrows, without semantic representation of their content.

### *About “Surface”, “Surface Level Structure” and Screens*

Conceptually, one can think of the user interface as the *“surface”* of a software product: it’s what a user sees and interacts with. In this perspective, *“above”* the surface is the conceptual structure (as represented in journeys and flows). *“Below” the surface are the components that the UI is composed from, the* state sequences that express its changes over time, the design system and its components, and *the code that runs the product.*

*With this concept in mind, „Screen“* is a core concept in UX design work. We have great tools to create screen designs. We draw a lot more screens than journey maps, flows, and architecture diagrams. Screens are where a lot of visual design happens. Screens are also a grippy, simple concept for information architecture.

Under close consideration, a screen is not actually a good *„boundary“* for user experiences anymore, if it ever was. Solutions make use of state transitions of components, regardless of screen boundaries. Commonly, many things happen on a single screen, to the point of the existing paradigm of the single-screen application.

Notwithstanding the structural disconnect between *„screen as design unit“* and *„reality being more nuanced“,* screen-based design is an expressive, useful practice. Screen design provides a lot more value than simple capture of structure and states.“

For SDD-Text and its tooling, screens should be available as a surface-level unit, but they should be accompanied by other, more flexible concepts that can accurately capture surface structure when needed. 

Representing screens and other surface-level structures is not meant to replace visual design: no need to reinvent the wheel. SDD-Text should enable a way to capture the structure that goes with visual design work, acting as a compliment to visual design.

## *Using This*

The tooling is meant to be simple to be accessible to everyone in the product organization (product managers, engineers), while being rich enough to provide designers with a satisfying graphing experience. Here is how this might play out in practice:

* Flexible modes of creation & editing  
  * A designer creates and edits an application map or a journey map with a graphical tool.  
  * A designer starts with a legacy application map that was created in Figma, quickly creating a structured version that shows linted omissions and bugs.  
  * A designer takes a structured application map or a structured journey map, dropping it into Figma as a reference for visual design work.  
  * Multiple members of the product organization collaborate on the map in the graphical editor without having to learn a „Design Tool“  
* LMMs read & write reusable artifacts  
  * A designer explores a new concept using an LLM. The LLM generates maps and journeys using the markup language.  
  * A designer explores refinements to an existing application using an LLM. The LLM clearly understands the existing application structure by reading the markup.  
  * A front-end developer maps the front end components used by an application, creating a full bottom-to-top view connecting implementation details to design intent \- identifying and tracking issues, minimizing design drift  
* Heat mapping / issue tracking across information architecture (and journeys)  
  * A product manager reviews an application map showing jira tasks, stories and bugs mapped to areas of the application.  
  * A tester attaches a bug to a node in the application map  
  * A customer success team member tracks a support issue for a node in the application map

## *Tooling*

Tools that use SDD-Text should be authored independently of the actual language specification, so that the spec can mature without forcing updates to the tools. This implies some level of abstraction between the actual simple language, and a technically-complete, more formal (but less readable) “internal” representation. 

The initial tooling, to get the concept of the ground, consists of:

* Compiler \- turn SDD-Text into YAML.  
* Validator \- identify issues and errors  
* Renderer \- generate graphical diagrams


These three CLI tools will provide a foundation for experimenting with actual content, rules and conventions for the language.

Looking further ahead, other tools will help to make SDD-Text viable for practical work, to provide hands-on editing, headless editing and 3rd party integrations:

* Graphical editor  
  * Projects server editing, local file editing  
  * Provides auto-layout but respects manual adjustments  
  * Linting  
  * Auto Complete  
  * Versioned edits  
    * Github integrations  
* Projects server  
  * Handle flagship editors access  
    * Provide realtime collaboration expected by designers  
  * API Access  
    * For third-party tool integrations (Figma plugin, Jira plugin)  
    * For programmatic creation editing from any source  
  * MCP access for LLMs  
* 3rd Party Tool Integrations  
  * Figma Plugin: Figma as source of structure, Figma as destination for externally created UX structure \- align visual design and layout work in Figma with UX structure  
  * Jira Plugin: map issues (stories, tasks, bugs, defects…) to nodes in the UX structure \- use UX structure as a reference for triage & work planning  
  * Jellyfish Plugin: connect development activities to nodes in UX structure \- use UX structure to inform engineering management  
  * Source Control Integration (Git / GitHub / bitBucket / Subversion)  
  * VS Code Plugin (creating, editing, linting, rendering markup)  
  * LLM Viewer Plugin (render, edit diagrams within preview pane)

This list is rough. Tools will be shaped by actual practical needs. The beauty of a standardized format is that never-before-imagined tools will create value together using it.

## *Why Do Markup At All?*

Some design tools today use production code as the design environment. Many tools exist that provide automated ways to translate design documents to code (and eventually they will be good enough to use). LLMs can translate screenshots or photos of napkin drawings into code. So why even bother with markup? Why not just keep the boxes-and-arrows drawings and let the machines do the work?

### *Actually Using Product Design Input*

None of the tooling improvements and their more direct workflows actually solve to promote product design as a contribution to the decision-making processes that shape the product. If anything, the “tightening of the product loop”, leads to more tactical decisions in the product process, fewer strategic decisions \- in other words, product quality drops. Today, the tight product loop works better without involving design guidance.

The good news is that introducing Structured Design Artifacts does not get in the way of a quick, tight product loop. The use of Structured Design Artifacts can keep a tight, fast product loop “on the rails”, aligned with higher-level product goals. It can also efficiently set new directions, getting the tight product loop aligned with new goals when they appear.

### *Giving Tools Better Information*

While LLMs clearly can extract meaning from all kinds of document formats (and they will only get better at this), the process is tremendously wasteful, and error-prone.

Even if “compute is almost free” and resources are “unlimited” (neither being the case), it’s still better to actually have clearly encoded meaning in LLM inputs, instead of having the LLM “make meaning from pixel sauce”.

“Better” in this case means “more precise, higher quality outcomes”, not just “saving tokens.” This improvement does not only apply to the “Design as Input” use of LLMs as code generators, but also to “Design as Output”. By having a way to express product design, it becomes a domain that LLMs can specifically work with (instead of product design being encoded and implied in front end code.)  
Code is the soup, design is the ingredients.

## *A Similar Initiative*

There is IxM, by Adam Rotmil: [https://blog.gopenai.com/introducing-interaction-markup-ixm-a-new-way-for-designers-to-collaborate-with-llms-like-gpt-4-c0163be11455](https://blog.gopenai.com/introducing-interaction-markup-ixm-a-new-way-for-designers-to-collaborate-with-llms-like-gpt-4-c0163be11455)

It’s from 2023, and not widely adopted. It does look useful for working with LLMs on interaction design, and contains some of the ideas that I am pursuing. It does not provide a way to integrate with product process outside the design domain.

# 

# *Background: Looking at Product Creation as a Graph*

*”Product creation”* is what a product business does (thinking of software products here). It’s also something that a service business does. In that case (one could say), the product is the infrastructure that enables the service. *“Creation”* is meant to encompass *“definition”* and *“delivery”* using *“the Process”* in a general sense, keeping in mind that in reality there are other critical activities that are part of making products happen.

Product creation could be looked at as a graph. Not a bar graph or a line graph, but a system of nodes connected by defined relationships.

## *Interconnected Sub-Graphs*

At the top there’s the overall purpose of the product. At the bottom there is code, and the real-world outcomes created by the product (benefits to its users, profits for the business in some cases.) The information that lives within the various parts of a product organization could also be considered graphs:

* The product management sub-graph, consisting of requirements, stories, epics and the like. Bugs could be considered part of this sub-graph too.  
* The engineering sub-graph. Besides the actual code, it contains change history, technical architecture from high levels to details, and dev-ops information. (Quality assurance could be counted here too.)  
* The product design sub-graph, containing design expressions (information architecture, features, wireframes, screens, patterns, components) and abstract design structure (flows, journeys, and service blueprints.)

The content of these sub-graphs is product definition information, of various kinds and at various levels of specificity. Other types of information that could be considered part of the product graph are:

* Time dimension, capturing changes over time, planning and execution and the rules of product process  
* Organizational structure, capturing the parts of the business involved in product creation, their relationships, the roles and the people filling the roles (org chart.)

## *Perspective of Product Creation Health*

Product creation as a graph is a mental model that provides a tangible perspective of the connected nature of its subject matter.

The actual information that constitutes the graph exists in the files, databases and tools used by the product creation people, in their various domains.

The *“health”* or *“robustness”* of the product creation (including but not limited to its processes) can be glanced by looking at the quality of the information:

* What exists or is missing  
* How fresh or stale it is  
* How isolated is it / how interconnected is it?  
  * Within its own domain  
  * Beyond its own domain  
* How is it consumed?  
  * By whom?  
  * When?  
  * To what effect?  
* How is it created?  
  * By whom?  
  * When?  
  * With what inputs?

This set of analytics criteria  could probably be improved. The gist is this:  if one traverses the product graph and scores the nodes according to criteria like the ones listed here, then one will find areas that are “healthy” and areas that need attention.

Looked at from this perspective, I think that high level product design artifacts (definition of journeys, flows, information architecture) tends to be not-so-healthy. Structured documents could improve this situation.  
