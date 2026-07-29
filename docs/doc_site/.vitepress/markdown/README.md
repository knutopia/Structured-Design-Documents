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
- Use `diagram_types/dropdown_switch_example.md` as the end-to-end authoring
  example. Its SDD node and edge reference is downstream documentation derived
  from the v0.1 bundle and protected by a bundle-drift test.
