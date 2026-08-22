# Profiles in SDD

When using SDD for light-touch exploration and communication, the structure of an SDD needs to be clear and valid. Too many details will get in the way. 

When using SDD to deliver engineering specifications, details must be present and complete. 

Profiles distinguish between those uses. Using the same SDD syntax and graph, profiles differ only in how strongly they enforce document completeness and governance. The validator tool (`sdd validate`) examines an SDD file to see if it fits a profile. "Profile" is short for "Validation Profile".

| Profile | Intended Use | Validation Posture |
|---|---|---|
| `simple` | Exploration and design communication | Make sure the structure is not broken; otherwise stay out of the way |
| `permissive` | Iterative specification and implementation planning | Structural errors; governance issues mostly warn |
| `strict` | Complete, reviewable engineering references | Structural and governance issues block as errors |

## Simple

`simple` is the light-touch drafting profile, for exploration and communicating structure and flow. It requires very little annotation detail, while still enforcing structural consistency such as valid references and relationship endpoints.

## Strict

`strict` is very different: it is intended for complete, reviewable, production-grade specifications. With `strict`, SDD becomes a no-nonsense specification delivery format. It makes detailed metadata and traceability mandatory, rejecting missing ownership, routes, component contracts, data requirements, event references, system dependencies, and other governance failures. Deep dive: [Using the Strict Profile](strict_profile.md)

## Permissive

`permissive` sits between `simple` and `strict`. It checks the same completeness and governance concerns as `strict`, but reports most missing details as warnings instead of blocking errors. It is useful when `strict` is the goal but the content is not there yet.

## Profiles vs. Rendering Detail

Profiles are used *only* for validation:

- Validation checks that everything that needs to be in an SDD document actually is there. The profile tells the validator how relaxed / serious to be with that task.

Not to be confused with profiles, there also is a rendering detail setting:

- Rendering detail is used to determine (you guessed it) the amount of detail that is shown in a diagram, distinquishing between `compact` and `detailed`.

See `show`, `compile`, `validate`, `render` in [SDD Command Line Tools](../sdd_cli_tools).
