# UI Contracts Diagram Detail Levels

What the `--detail` option does for UI Contracts:

  | Content | Compact | Detailed |
  | --- | --- | --- |
  | Hierarchy and immediate parent/child context | Shown | Shown |
  | ViewState sequences and complete transition labels | Shown | Shown |
  | Secondary State sequences and supporting contracts | Hidden when ViewStates are present | Shown |
  | State-only fallback sequences and contracts | Shown | Shown |
  | Place primary navigation | Shown when supplied | Shown when supplied |
  | Place route, access, entry points and description | Hidden | Shown when supplied |
  | ViewState required data; focal Component description, inputs and outputs | Hidden | Shown when supplied |
  | Empty Place scopes | Omitted with a coverage note | Retained |

 `--decorators none`, `type`, `id`, or `type,id` independently controls semantic-node headers in either detail. Omitting the option uses the user preference, then the bundle fallback.
