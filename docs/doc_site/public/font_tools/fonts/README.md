# Font-tool assets

These font files are the local assets used by the two font exploration tools.

- Google-hosted families were downloaded from the Google Fonts CSS API and are
  served locally so the tools do not depend on a network connection at runtime.
  This includes Josefin Sans and the available italic source faces for the
  existing Google font families.
- The custom families were extracted from the previously bundled font-tool
  artifact in `docs/doc_site/.vitepress/dist/font_tools/`.
- `scripts/generate-font-tools-assets.mjs` reads the files in this directory and
  generates the shared `font-manifest.js` and `fonts.css` files.

Keep the upstream license and attribution requirements for each font family when
refreshing or replacing these assets.
