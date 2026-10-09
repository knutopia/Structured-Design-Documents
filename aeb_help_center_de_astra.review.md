# AEB Help Center Review

Site observation: 2026-10-05. Final validation and diagrams: 2026-10-06.

## Deliverables

- `aeb_help_center_de_astra.sdd`: SDD-Text 0.2, validated with the `simple` profile.
- `aeb_help_center_de_astra.ia.svg`: named diagram `DG-001`, compact information architecture with native IDs displayed.
- `aeb_help_center_de_astra.ui_contracts.svg`: named diagram `DG-002`, compact UI composition and local mode changes, with node types and IDs displayed.

## Coverage And Sources

The public German inventory contains **8 categories and 73 sections**. Every category and section is represented as a real Place with its original German name, numeric Zendesk ID, source URL, description and explicit parentage. Native IDs are also used in SDD identifiers, for example `P-360004885357`.

- [German home](https://service.aeb.com/hc/de)
- [Category inventory](https://service.aeb.com/api/v2/help_center/de/categories.json?per_page=100)
- [Section inventory](https://service.aeb.com/api/v2/help_center/de/sections.json?per_page=100)
- [Public community topic inventory](https://service.aeb.com/api/v2/community/topics.json?per_page=100)

All eight category pages and representative section, glossary, article, search and community pages were inspected in a browser. The SDD explicitly distinguishes API-inventoried sections from pages whose UI was individually inspected. The UI diagram selects ten concrete pages and describes 30 shared or page-specific components, including their inputs and outputs.

Only [article 33937234420881](https://service.aeb.com/hc/de/articles/33937234420881-Wie-bearbeite-ich-Adresstreffer-in-Compliance-Screening) is expanded, as an actual example of an article page. Other articles and community posts remain collections consumed by list components. There are no synthetic article-template or section-template Places.

## Navigation And Local State

- Clicking an article on [section 360004885357](https://service.aeb.com/hc/de/sections/360004885357) generated a main-frame document request and changed `performance.timeOrigin`. The model uses `NAVIGATES_TO` for this page change.
- Clicking **Import Filing** on [section 360005333058](https://service.aeb.com/hc/de/sections/360005333058) fetched the section article API with `label_names=Import%20Filing`, replaced the list, and preserved the URL and document time origin. Its two ViewStates belong to this same Place.
- **Jetzt abonnieren** on the [community home](https://service.aeb.com/hc/de/community/topics) opened a newsletter overlay. Its open/closed ViewStates both belong to the community Place.
- Sign-in redirected through Zendesk to AEB Identity. Search facets and collection pagination expose navigation URLs; they are not represented as cross-Place ViewState transitions.

`CONTAINS` records actual content parentage or component nesting. `COMPOSED_OF` connects real pages to their observed front-end structures. These distinctions follow `bundle/v0.2/core/vocab.yaml`, `contracts.yaml` and `views.yaml`; visual grouping does not introduce extra semantic Places or Areas.

## Diagram Scope

The SDD retains the complete authored graph. The named overviews intentionally select less:

- IA shows the content hierarchy and home-level utility/external exits. Parallel browse edges, breadcrumbs and the secondary community post-creation destination remain in the SDD rather than being repeated in the overview.
- UI shows composition and changes between distinct local modes. Repeated filter changes within the already-filtered mode retain their self-loop in the SDD and their behavior in the component contract, but the loop is not drawn in the overview.

The initial larger selections exposed staged-renderer routing errors. Legacy rendering lost important hierarchy/reuse information and was rejected. The final explicitly scoped selections render with the default staged SVG backends, without forcing output or changing semantic edge endpoints. No renderer code was modified. The broader routing limitations remain unresolved.

## Limits And Verification

The request route `/hc/de/requests/new` returned a Cloudflare verification page. Its form fields and authentication requirements are therefore not invented. Authenticated content, post creation, subscription persistence, votes, comments and support submissions were not exercised. External portals and the English site are navigation boundaries, not recursively reviewed sites. The restricted discussion topic ID `6348340965009` is preserved from the new-post link without asserting an inspected topic page.

Final checks: zero `simple` validation errors or warnings; every inventoried category/section ID and parent relationship present; all nodes described; one article sample; no template Places; all ViewState transitions stay within one owning Place. Both saved diagrams render without diagnostics. Native-scale portions were visually checked for legible labels and unobstructed connectors.

## Reproduce

Run from the repository root:

```sh
TMPDIR=/tmp pnpm sdd show aeb_help_center_de_astra.sdd --diagram DG-001 --bundle /home/knut/projects/sdd/bundle/v0.2/manifest.yaml --profile simple --detail compact --decorators id --out aeb_help_center_de_astra.ia.svg
TMPDIR=/tmp pnpm sdd show aeb_help_center_de_astra.sdd --diagram DG-002 --bundle /home/knut/projects/sdd/bundle/v0.2/manifest.yaml --profile simple --detail compact --decorators type,id --out aeb_help_center_de_astra.ui_contracts.svg
```
