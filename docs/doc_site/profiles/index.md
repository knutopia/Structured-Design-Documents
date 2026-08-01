# Profiles in SDD

When using SDD for light-touch exploration and communication, the structure of an SDD needs to be clear and valid. Too many details will get in the way. 

When using SDD to deliver engineering specifications, details must be present and complete. 

Profiles are a way to distinguish between those uses. Using the same SDD syntax and graph, profiles differ in how strongly they enforce document completeness and how much detail they display.

| Profile | Intended Use | Diagram Detail | Validation Posture |
|---|---|---|---|
| `simple` | Exploration and design communication | Low-noise | Make sure the stucture isn't broken, otherwise stay out of the way"|
| `permissive` | Iterative specification and implementation planning | Detailed | Structural errors; governance issues mostly warn |
| `strict` | Complete, reviewable engineering references | Detailed | Structural and governance issues: block as errors |

`simple` is the low-noise drafting profile, for exploration and communicating structure and flow. `simple` covers many uses of SDD, using a light touch. It requires very little annotation detail, to be quick to work with. It does use strict structural validation, to ensure consistency such as valid references and relationship endpoints. Its diagrams are simple, without detailed annotations.

`strict` is very different: it is intended for complete, reviewable, production-grade specifications. With `strict`, SDD becomes a no-nonsense specification delivery format. It makes detailed metadata and traceability mandatory, rejecting missing ownership, routes, component contracts, data requirements, event references, system dependencies, and other governance failures. Deep dive: [Using the Strict Profile](strict_profile.md)

`permissive` sits between `simple` and `strict`. It checks the same completeness and governance concerns as `strict`, but reports most missing details as warnings instead of blocking errors. Diagrams retain richer information such as routes, access rules, branch labels, instrumentation, and supporting UI contracts. `permissive` is useful when `strict`is the goal but the content isn't there yet, or when `simple` is just a little too simple.

In practice, profiles are used for validation and for rendering:

- Validation checks that everything that needs to be in an SDD document actually is there. The profile tells the validator how relaxed / serious to be with that task.

- Rendering creates a diagram from an SDD document. The profile tells the renderer which details to include in the diagram.

See `show`, `compile`, `validate`, `render` in [SDD Command Line Tools](../sdd_cli_tools).
