# Local VitePress Markdown extensions

This directory contains repository-owned Markdown-it extensions used by the
documentation site. They are installed in `../config.ts` and should have
focused renderer tests under the repository's `tests/` directory.

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

## `accordionScrollExpander`

`accordionScrollExpander.ts` turns consecutive level-two Markdown sections
into an accessible, scroll-responsive accordion through the globally
registered `AccordionScrollExpander.vue` component:

```md
::: accordionScrollExpander
## First section
First section content.

## Second section
Second section content.
:::
```

The container must begin with a `##` heading and contain at least two
top-level `##` sections. Lower-level headings and ordinary Markdown remain in
the section above them. The generated native `details` and `summary` elements
start closed, allow direct mouse and keyboard activation, and preserve the
original VitePress heading IDs, outline entries, and permalink anchors.

Scrolling opens the last section title to cross the component's activation
line and closes its siblings. The sections remain in normal document flow so
long content does not create an inner scroll area. When nesting another
colon-delimited container, use more markers for the outer
`accordionScrollExpander` container. Fenced Markdown examples are left
untouched, and invalid structure fails the documentation build with source
page and line context.

### Maintenance checklist

- Keep the directive's generated `details` structure aligned with the DOM
  contract in `../theme/components/AccordionScrollExpander.vue`.
- Keep plugin installation in `../config.ts` and global component registration
  in `../theme/index.ts`.
- Run the focused `docsAccordionScrollExpander` tests and `pnpm run docs:build`
  after parser or component changes.
