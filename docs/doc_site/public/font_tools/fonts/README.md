# Font-tool assets

The complete font registry is maintained in
`docs/doc_site/public/font_tools/font-sources.txt`. It includes every family,
weight, style, source kind, and URL used by both font exploration tools.

The registry can point at:

- a remote CSS stylesheet, such as Google Fonts or a pinned Fontsource CDN URL;
- a direct remote font file; or
- a local file in this directory.

Edit `font-sources.txt` to add, remove, or dislike a family. Then regenerate the
derived `font-manifest.js` and `fonts.css` files with:

```text
pnpm run font-tools:generate
```

Only local files referenced by the registry are used. Keep the upstream license
and attribution requirements for each font family when refreshing or replacing
these assets.
