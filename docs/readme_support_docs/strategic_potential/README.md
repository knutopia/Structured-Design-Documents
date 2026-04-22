# SDD in the Product Lifecycle: Strategically Aligned Design and Design Souvereignity for Implementation

As an element in the software product lifecycle, SSD can provide two benefits: design souvereignity and strategic alignment.

## 1. Design Sovereignity for Development

This is the more "tactical" value of SDD. Software implementation is driven by requirements documentation and techical design documents. Those inputs can be weak on structural design and user experience. When actual UX- and UI design documentation is used to drive implementation, that design documentaiton is sometimes mis-aligned with the technical side (drift) or incomplete. The code that gets written *will* contain a structural design - but not necessarily the right one, because the structural design can be a side effect of other implementation decisions. While LLMs are very good coders, they are poor design decison makers.

By capturing structural design design before writing / generating code, you create a real structure that a coding model (or a visual design creation model, or a developer) can work from. That is a much stronger foundation than asking an LLM to "implement these requirements" and hoping it invents a good product shape that meets your structural design ideas. Once code is written, it wants to stay in place. Changes take effort and create risk, blast radius and token burn.

SSD allows us to be ahead of implementation with structural design, and (because SSD is maintainable and open) to stay ahead: we can maintain design sovereignity. LLMs will become better designers or design-helpers. Once they do, we can have better conversations with them about design, without writing code, by using SSD.

## 2. Strategically Aligned Design for the Product Lifecycle

Sometimes we design something from scratch. Often, design work in a product business is concerned with changing, improving, and growing an existing product. In this work, the creative ideal of envisioning something great meets the realities of business goals and constraints.

When working on an existing product, design *is* valuable, but its value is often driven by its relationship to what already exists. Traditionally, design documentation is not well equipped to deal with this reality. Design documentation tends to be stand-alone, separated from the tooling and documents that the non-designers on the product team use.

Since product design is not the only input that drives actual product development, design drift is a common occurence, resulting in a status quo where the shipped product looks and behaves differently from what is designed. That, in turn, makes design less valuable as an input for product decisons. This potential friction is countered by good process, clear communication and mutual respect between the product contributors. 

SDD can help, by providing a full picture of a structural design from top to bottom. This picture shows how design structure on various levels works together and aligns with high-level goals and journeys. Since SDD is easily edited, the picture can stay current, and variations are easily explored.

## Product-Grounding for Alignment

We (designers, but also other people like product managers and developers) can use SDD to map an existing product realistically, creating visibility. This as-is-visibility can serve as grounding for making product decisions: where to improve what, and what to leave alone. 

Product decisions that are grounded will be better product decisions than those made based on a vague understanding that mixes "what we want" with "what we assume we might have."

The SDD diagrams types **IA Place Map**, **UI Contracts** and (future) **Scenario Flow** cover this topic.

## Goal-Driven Alignment

Product decisions should align with goals. SDD provides the (future) **Outcome-Opportunity Map** diagram type to document goals and where they are expressed in the product.

## Structure-Driven Alignment

Product decisions are best made with a structural perspective in mind, not by solving isolated details. SDD provides **Journey Map**, (future) **Scenario Flow** and **Service BluePrint** to capture structure (along with **IA Place Map** and **UI Contracts**.)

## SDD is a Product Graph

SDD can capture the structural design content from high level (goals) to low level (ui contracts), with everything linked together. In other words, SDD is a **product graph**. 

(Even though some diagram types cannot be rendered yet by SDD tools, all the node types and relationships are already available in the SDD language definition.)

When the product team curates the product graph over time, which takes relatively little work, a powerful tool for design exploration and a source of truth for product development becomes available to raise product quality. 
