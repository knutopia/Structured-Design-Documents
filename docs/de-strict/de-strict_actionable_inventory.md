# Actionable Inventory for Replacing Strict Profile Default

The CLI (except `sdd add`) uses profile `strict` as the default. That will be replaced with a global-setting default profile. 

Since the existing codebase assumed default profile `strict`, there is  actionable inventory to make the codebase profile-robust:

## 1. Bundle-owned default profile — required

Add a general CLI/tool default to [bundle/v0.1/manifest.yaml](/home/knut/projects/sdd/bundle/v0.1/manifest.yaml), separate from Guided Addition’s `default_display_profile_id`.

Required supporting changes:

- Extend the manifest type in [src/bundle/types.ts](/home/knut/projects/sdd/src/bundle/types.ts).
- Validate that the default names a declared profile during `loadBundle(...)`.
- Add a generic accessor for the loaded bundle’s default profile.
- Add a bundle-mutation test proving that changing only this field changes omitted-profile behavior.
- Add a negative test for an unknown default profile.

This is necessary for bundle authority; replacing `"strict"` literals with `"simple"` literals would be incomplete.

## 2. Five CLI defaults — required

Remove the hardcoded Commander defaults from:

- `validate`: [program.ts:669](/home/knut/projects/sdd/src/cli/program.ts:669)
- `render`: [program.ts:688](/home/knut/projects/sdd/src/cli/program.ts:688)
- `dot`: [program.ts:710](/home/knut/projects/sdd/src/cli/program.ts:710)
- `mmd`: [program.ts:730](/home/knut/projects/sdd/src/cli/program.ts:730)
- `show`: [program.ts:753](/home/knut/projects/sdd/src/cli/program.ts:753)

Each command should resolve an omitted profile after loading its selected bundle. Explicit `--profile` must continue to override the bundle default.

## 3. Library rendering fallback — required

Replace both `?? "strict"` expressions:

- [renderView.ts:46](/home/knut/projects/sdd/src/renderer/renderView.ts:46)
- [renderView.ts:70](/home/knut/projects/sdd/src/renderer/renderView.ts:70)

Resolve the profile once from `options.profileId` or the loaded bundle default, then use that same value for both validation and rendering.

Add tests proving:

- omitted `profileId` uses the bundle default;
- explicit `profileId` overrides it;
- validation and display use the same resolved profile;
- bundle-only default mutation changes the result.

## 4. CLI tests — make ordinary tests explicit

There are 37 effective omitted-profile CLI invocations in [tests/cli.spec.ts](/home/knut/projects/sdd/tests/cli.spec.ts).

Refined treatment:

- Retain omission only in focused default-resolution tests.
- Give every unrelated validation/rendering test an explicit profile—`strict`, `simple`, or another profile chosen for that test’s purpose.
- Do not mechanically change expected `.strict.*` filenames to `.simple.*`; preserve stable expectations by specifying the intended profile.

The existing default-path test at [line 311](/home/knut/projects/sdd/tests/cli.spec.ts:311) can remain omitted and become the focused shipped-bundle-default test.

The following should become explicit:

- Different views: [line 336](/home/knut/projects/sdd/tests/cli.spec.ts:336)
- Different profiles—explicit strict and explicit simple: [line 362](/home/knut/projects/sdd/tests/cli.spec.ts:362)
- Backend-specific filename: [line 391](/home/knut/projects/sdd/tests/cli.spec.ts:391)
- Other diagnostic, rendering, and backend tests where profile selection is not their subject

Also add focused tests for:

- omitted profile resolving through the bundle;
- bundle-default mutation;
- explicit override;
- all five CLI commands using the same resolution mechanism.

## 5. CLI help — wording only

The 27 profile-omitting help examples can remain omitted. They correctly demonstrate normal default behavior.

Update:

- `strict governance (default)` at [program.ts:588](/home/knut/projects/sdd/src/cli/program.ts:588)
- Its assertion at [cli.spec.ts:1360](/home/knut/projects/sdd/tests/cli.spec.ts:1360)
- Option/help wording so omission means “the selected bundle’s default,” not a hardcoded profile

The explicit strict-governance example at line 592 remains unchanged.

## 6. Current documentation

There are now 17 concrete omitted-profile commands:

- 14 in [development.md](/home/knut/projects/sdd/docs/toolchain/development.md:95)
- 2 in [sdd_cli_tools/index.md](/home/knut/projects/sdd/docs/doc_site/sdd_cli_tools/index.md:126)
- 1 in [AGENTS.md](/home/knut/projects/sdd/AGENTS.md:61)

These can remain omitted because they demonstrate ordinary default behavior rather than promising strict output.

Update the three statements that explicitly identify strict as the current default:

- [sdd_cli_tools/index.md:21](/home/knut/projects/sdd/docs/doc_site/sdd_cli_tools/index.md:21)
- [sdd_cli_tools/index.md:52](/home/knut/projects/sdd/docs/doc_site/sdd_cli_tools/index.md:52)
- [sdd_cli_tools/index.md:108](/home/knut/projects/sdd/docs/doc_site/sdd_cli_tools/index.md:108)

The Service Blueprint tutorial is resolved: its commands are explicitly strict, and the backup page is deleted.

After documentation changes, rebuild the VitePress output rather than editing `docs/doc_site/.vitepress/dist` directly.

## 7. Explicitly unaffected

No changes should be needed for:

- Rendered-corpus generation—it already passes every profile explicitly.
- Renderer goldens that already specify `profileId`.
- `sdd-helper validate` and `preview`—profile is required.
- SDD Skill validation/render workflows—they carry an explicit profile.
- Guided Addition’s separate `default_display_profile_id`.
- Active scripts or GitHub automation—no implicit profile-consuming invocations were found.