# Test inputs and baselines

Run the suite from the repository root with `TMPDIR=/tmp pnpm test`.

## Choosing inputs

- Use `tests/fixtures/` for fixed regression inputs. Working documents under
  `real_world_exploration/`, planning documents, and archived implementation
  folders are provenance, not runtime fixture locations.
- Use a canonical example from `bundle/vX.Y/examples/` when a test exercises
  that bundle's maintained example. Load the matching manifest explicitly.
  Current-example validation and compilation/projection snapshot tests should
  continue to read the canonical examples.
- Documentation and skill-content tests intentionally read the published source
  they check. Their purpose is to detect changes to that content.
- Keep accepted rendering evidence under `tests/goldens/`. Freeze any files
  read indirectly through a baseline manifest as well as the manifest itself.

Do not rewrite or strip a loaded document's version header to make it fit a
selected bundle. Use a matching versioned fixture, or construct a small inline
document with an explicit version. Helpers that construct a complete document
from a headerless test snippet should be separate from helpers that consume an
existing complete document.

Tests that deliberately mutate a copied bundle to prove bundle authority remain
valid. For example, the helper integration test changes the copied bundle's
creation version to `7.7` and checks the resulting newly created document.

## Frozen input provenance

The following files were copied byte-for-byte from commit
`567ebf0b69e8544282e2deed7f857d24529b336b`. They are independent test inputs;
subsequent edits to the originals must not automatically update them.

| Test fixture | Original source | Bundle |
| --- | --- | --- |
| `fixtures/render/billSage_structure.sdd` | `real_world_exploration/billSage_example/billSage_structure.sdd` | v0.2 |
| `fixtures/validation/billSage_simple_structure.sdd` | `real_world_exploration/billSage_example/billSage_simple_structure.sdd` | v0.2 |
| `fixtures/render/unified_node.sdd` | `docs/Done/[Done] good_node_rendering/unified_node.sdd` | v0.1 |

Departure Desk already has versioned canonical examples. The historical UI
Contracts tests use `bundle/v0.1/examples/departure_desk.sdd`, which is identical
to the archived B5 input. Its original hash is checked by the B5 replay test.
The v0.2 example stays covered by the canonical bundle tests. Do not substitute
one version for the other in historical geometry tests.

`fixtures/guided_addition_acceptance.sdd` and
`fixtures/guided_addition_acceptance_v0_2.sdd` are explicit v0.1 and v0.2 inputs
for the CLI's matching/mismatched-bundle tests. Each is compiled against its
matching bundle before testing persistence.

See [the B5 baseline notes](goldens/ui-contracts-b5/README.md) for the relocated
historical evidence and reference files.

## Updating regression evidence

First establish the expected behavior from the versioned bundle and the test's
acceptance assertions. Review the proof case before changing a fixture or
refreshing any expected rendering. A changed working document alone is not a
reason to refresh regression evidence. Record the reason and provenance when
an intentional fixture change is necessary.
