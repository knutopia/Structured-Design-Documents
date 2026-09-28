# SDD-Text v0.2 definitions

The machine-readable contract for v0.2 lives in [`bundle/v0.2/manifest.yaml`](../../bundle/v0.2/manifest.yaml) and the bundle files it names. These definitions explain decisions and rationale; they do not override bundle behavior.

v0.2 starts from the preserved [`bundle/v0.1/`](../../bundle/v0.1/) baseline. The historical [`definitions/v0.1/`](../v0.1/) documents explain that baseline and its original extraction into a bundle. They are not a separate v0.2 specification.

When a v0.2 language feature is added, update the relevant bundle contract and generic runtime path first, then document the change here or in a focused v0.2 definition. State how it differs from v0.1 and link the bundle fields that govern it. Keep the two versions' examples and snapshot checks aligned with their own bundles.
