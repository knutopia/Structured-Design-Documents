# Local VitePress Markdown extensions

This directory contains repository-owned Markdown-it extensions used by the
documentation site. They are installed in `../config.ts` and should have
focused renderer tests under the repository's `tests/` directory.

## `showSource`

`showSource.ts` renders a repository file as a titled code block. Paths are
resolved relative to the containing Markdown page. An optional numeric range
highlights source lines, while `{lines START-END}` selects an excerpt:

```md
showSource ../../../examples/example.sdd
showSource ../../../examples/example.sdd {6, 12-15}
showSource ../../../examples/example.sdd {12-15} {lines 6-20}
```

Selections may omit either bound, as in `{lines 60-}` or `{lines -70}`.
Highlights continue to refer to original file line numbers and are remapped
into the selected excerpt. The plugin tracks the source file as a VitePress
dependency, leaves fenced authoring examples untouched, and reports invalid
directives with source page and line context.

## `showRepoLink`

`showRepoLink.ts` creates a link to a file or directory in this repository on GitHub:

```md
showRepoLink examples/rendered/v0.1
```

The default label is `Repo folder`. Add a display name (which may contain spaces)
before the path to use a custom label after the GitHub icon:

```md
showRepoLink views.yaml /bundle/v0.1/core/views.yaml
showRepoLink views.yaml /bundle/v0.1/core/views.yaml {pos: up}
```

For example:

```md
showRepoLink presentation model src/renderer/uiContractsPresentationModel.ts {pos: inline}
```

The final whitespace-separated word before `{pos: ...}` (or the end of the
line) is the repository path; preceding words form the display name.
Display names are rendered as literal text, preserving their capitalization.
Both forms use the same repository URL and link behavior.

By default the link is a standalone right-aligned block. `{pos: up}` attaches
it to the preceding prose block, which is useful immediately above a
`showSource` directive:

```md
Source for this example
showRepoLink examples/rendered/v0.1 {pos: up}
showSource ../../../examples/example.sdd
```

Use `{pos: inline}` to flow the link within the surrounding paragraph without
right alignment. Keep the directive on its own source line, without blank
lines separating it from the surrounding text:

```md
before
showRepoLink fileDisplayName /bundle/v0.1/core/views.yaml {pos: inline}
after
```

This renders as `before (GitHub icon) fileDisplayName after`. Inline positioning
also works with the default label. Blank lines still separate paragraphs.

Repository paths may start with `/`. Fenced authoring examples are left
untouched, and invalid directives or options fail with source page and line
context.


### Links inside table cells and prose

Use `{{showRepoLink DISPLAY_NAME /repo/path}}` on the same line as surrounding
Markdown. The display name is optional (defaults to `Repo folder`) and is literal
text rendered with code formatting (equivalent to Markdown backticks), not parsed
as Markdown. This form always renders inline and takes no position option.
Existing standalone directives and their position options are unchanged.

```md
| Responsibility | Source |
| --- | --- |
| Presentation policy | {{showRepoLink bundle/v0.1/core/views.yaml /bundle/v0.1/core/views.yaml}} |
```

Multiple links can share a cell. Inline directives in code spans or fenced code
blocks remain literal examples.

## `dropdownSwitch`

`dropdownSwitch.ts` turns authored Markdown choices into the globally
registered `DropdownSwitch.vue` component:

```md
::: dropdownSwitch Diagram type
== Outcome-Opportunity Map
Content for the first choice.

== Journey Map
Content for the second choice.
:::
```

The text after `dropdownSwitch` is an optional visible label for the selector.
It defaults to `Select an option`. Choice labels follow `==`; labels must be
non-empty and unique, and every switch must contain at least two choices. The
first authored choice is initially selected.

The plugin generates an `options` array whose values are opaque indexes and a
named slot for each choice. Authors should rely on choice labels and order, not
on generated values. The component still accepts direct Vue usage with
`options` and an optional `v-model`.

### Parser and nesting contract

The plugin owns its container parser instead of using
`markdown-it-container`. This is intentional: `vitepress-plugin-tabs` treats
`==` in any generic container as a tab marker. The dedicated
`dropdownSwitch` parent context prevents the two extensions from claiming each
other's choices.

Ordinary Markdown is supported inside each choice. When nesting another
colon-delimited container, use more markers for the outer switch than for the
inner container:

```md
:::: dropdownSwitch Example
== First
::: details More
Nested content.
:::

== Second
Other content.
::::
```

Fenced Markdown examples are left untouched. A documentation build fails with
the source page and line number when a switch has too few choices, a blank or
duplicate label, or content before the first `==` marker.

### Maintenance checklist

- Keep the generated `DropdownSwitch` props and named slots aligned with
  `../theme/components/DropdownSwitch.vue`.
- Keep plugin installation in `../config.ts` and global component registration
  in `../theme/index.ts`.
- Run the focused `docsDropdownSwitch` tests and `pnpm run docs:build` after
  parser or component changes.

## `sideBySide`

`sideBySide.ts` renders arbitrary Markdown content in two columns through the
globally registered `SideBySide.vue` component. A line containing only `==`
divides the columns:

```md
::: sideBySide
### First heading
First column content.

==

### Second heading
Second column content.
:::
```

The container requires exactly one divider. Content on either side is
otherwise unrestricted: headings are optional, retain their normal VitePress
IDs and anchor links, and may be nested inside other Markdown containers such
as `info`. The columns have equal widths and stack vertically on narrow
screens.

When nesting another colon-delimited container, use more markers for the outer
`sideBySide` container than for the inner container. Fenced Markdown examples
are left untouched. A documentation build fails with the source page and line
number when the container contract is invalid.
