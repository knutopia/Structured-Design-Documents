# [Done] Test Failures 

8-04-2026

knut@KGPC:~/projects/sdd$ TMPDIR=/tmp pnpm test

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/docsAccordionScrollExpander.spec.ts [ tests/docsAccordionScrollExpander.spec.ts ]
Error: Failed to load url ../docs/doc_site/.vitepress/markdown/accordionScrollExpander (resolved id: ../docs/doc_site/.vitepress/markdown/accordionScrollExpander) in /home/knut/projects/sdd/tests/docsAccordionScrollExpander.spec.ts. Does the file exist?
 ❯ loadAndTransform node_modules/.pnpm/vite@5.4.21_@types+node@22.19.15_lightningcss@1.32.0/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:51969:17

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/diagramTypeNodeEdgeReference.spec.ts > diagram type node-and-edge reference > tracks staged renderer views and their bundle-owned endpoint contracts
AssertionError: invalid minimal edge line: INSTRUMENTED_AT J-001 "a Step" # (shown with strict profile): expected null not to be null
 ❯ tests/diagramTypeNodeEdgeReference.spec.ts:161:69
    159|               /^([A-Z_]+) [A-Z]{1,3}-[0-9]{3,}(?:[a-z][a-z0-9]*)? "(?:a|an) ([A-Za-z]+)"$/
    160|             )
    161|             expect(match, `invalid minimal edge line: ${line}`).not.toBeNull()
       |                                                                     ^
    162|             return `${match![1]} ${match![2]}`
    163|           })
 ❯ tests/diagramTypeNodeEdgeReference.spec.ts:157:12

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  tests/sddSkillSource.spec.ts > canonical sdd-skill source > keeps the helper README aligned with helper authority routing
Error: ENOENT: no such file or directory, open '/home/knut/projects/sdd/docs/doc_site/sdd-helper/README.md'
 ❯ tests/sddSkillSource.spec.ts:93:26
     91|
     92|   it("keeps the helper README aligned with helper authority routing", async () => {
     93|     const helperReadme = await readFile(helperReadmePath, "utf8");
       |                          ^
     94|     const documentedCommands = extractHelperReadmeCommandNames(helperReadme).sort();
     95|     const capabilityCommands = createHelperCapabilities().commands.map((command) => command.name).sort();

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯

 Test Files  3 failed | 78 passed (81)
      Tests  2 failed | 704 passed (706)
   Start at  19:00:30
   Duration  48.37s (transform 11.34s, setup 0ms, collect 78.63s, tests 245.37s, environment 40ms, prepare 16.56s)

 ELIFECYCLE  Test failed. See above for more details.
knut@KGPC:~/projects/sdd$