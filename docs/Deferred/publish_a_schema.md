# Publish a Schema (?)

Conversation about the current fictional public schema and the potential benefits of actually publishing one.

We should consider publishing a schema to reference in the future SDD editor/viewer app.

## Investigate projection schema $id

> What is the use of carrying the (fictional) line 3 \` "$id": "https\://example.org/sdd-text/0.2/projection_schema.json",\` in [projection_schema.json](bundle/v0.2/core/projection_schema.json) (and the corresponding entry for v0.1)? Draw your conclusions from research and code review, not from lazy speculation.

<details><summary>4 previous messages</summary>

> I’ll check how both schemas are loaded and referenced in this repository, then compare that with the JSON Schema rules for `$id`.
>
> <details><summary>Explored 6 files, 2 searches, 2 lists, ran 3 commands, searched the web</summary>
>
> - Ran `pwd && rg --files -g AGENTS.md -g '*projection*schema*' -g package.json -g '*bundle*' -g '*schema*'`
>
> - Ran `git status --short && rg -n 'projection_schema|example\.org/sdd-text|\$id|Ajv|ajv|jsonschema|json-schema' bundle/v0.2/core/projection_schema.json bundle/v0.1/core/projection_schema.json src test tests scripts package.json pnpm-lock.yaml`
>
> Searched the web for `https://json-schema.org/draft/2020-12/json-schema-core.html`
>
> <details><summary>Explored 5 files, a search, a list</summary>
>
> - Read `./AGENTS.md`
> - Read `./bundle/v0.2/core/projection_schema.json`
> - Read `./bundle/v0.1/core/projection_schema.json`
> - Read `./src/projector/shared.ts`
> - Read `./package.json`
> - Searched for `projectionSchema|projection_schema|example\.org/sdd-text|addSchema\(|getSchema\(|compileAsync|loadSchema|\$id` in `src`
> - Listed files in `bundle`
>
> </details>
>
> Searched the web for `'8.2.1.' in https://json-schema.org/draft/2020-12/json-schema-core`
>
> - Ran `cat AGENTS.md && nl -ba src/bundle/loadBundle.ts | sed -n '1,108p' && nl -ba src/bundle/fingerprint.ts | sed -n '30,80p' && nl -ba bundle/v0.2/core/projection_schema.json | sed -n '1,110p' && head -15 bundle/v0.2/core/schema.json && diff -u bundle/v0.1/core/projection_schema.json bundle/v0.2/core/projection_schema.json && node --version`
>
> <details><summary>Explored 2 files, a search, a list</summary>
>
> - Searched for `example.org/sdd-text` in `projection_schema.json`
> - Read `./src/projector/shared.ts`
> - Read `./tests/projectionServicePublicApi.spec.ts`
> - Listed files in `v0.2`
>
> </details>
>
> </details>
>
> The `$id` is active in the current code: Ajv uses it to resolve references such as `./schema.json#/$defs/id` to the graph schema already loaded in memory. I’m testing removal and renaming on copies of both versions to distinguish what is required from what is merely a naming choice.
>
> <details><summary>Explored 6 files, 3 searches, a list, ran 3 commands, searched the web</summary>
>
> - Ran ``TMPDIR=/tmp node --input-type=module <<'NODE'
> import fs from 'node:fs';
> import assert from 'node:assert/strict';
> import Ajv2020 from 'ajv/dist/2020.js';
> import { createRequire } from 'node:module';
> const require = createRequire(import.meta.url);
> console.log(JSON.stringify({node:process.version, ajv:require('ajv/package.json').version}));
> for (const version of ['0.1', '0.2']) {
>   const read = name => JSON.parse(fs.readFileSync(`bundle/v${version}/core/${name}.json`, 'utf8'));
>   const originalGraph = read('schema');
>   const originalProjection = read('projection_schema');
>   const sample = {schema:'sdd-text-view-projection', version, view_id:originalProjection.properties.view_id.enum[0], source_example:'schema-id-probe', nodes:[{id:'probe',type:originalGraph.$defs.nodeType.enum[0],name:'Probe'}],edges:[],derived:{node_annotations:[],edge_annotations:[],node_groups:[],view_metadata:{}},omissions:[],notes:[]};
>   const cases = [
>     ['unchanged', (g,p)=>{}, true],
>     ['remove projection $id', (g,p)=>{delete p.$id;}, false],
>     ['remove both $ids', (g,p)=>{delete g.$id;delete p.$id;}, false],
>     ['rename projection leaf only', (g,p)=>{p.$id=p.$id.replace('projection_schema.json','renamed.json');}, true],
>     ['change projection host only', (g,p)=>{p.$id=p.$id.replace('example.org','schema-probe.invalid');}, false],
>     ['change both hosts together', (g,p)=>{g.$id=g.$id.replace('example.org','schema-probe.invalid');p.$id=p.$id.replace('example.org','schema-probe.invalid');}, true],
>     ['cross-version projection $id only', (g,p)=>{p.$id=p.$id.replace(`/${version}/`,version==='0.1'?'/0.2/':'/0.1/');}, false],
>     ['remove projection $id, make external refs absolute', (g,p)=>{delete p.$id; const visit=x=>{if(!x||typeof x!=='object')return;for(const [k,v]of Object.entries(x)){if(k==='$ref'&&v.startsWith('./schema.json'))x[k]=g.$id+v.slice('./schema.json'.length);else visit(v);}};visit(p);}, true]
>   ];
>   for (const [label, mutate, expectedCompile] of cases) {
>     const g = structuredClone(originalGraph), p = structuredClone(originalProjection);
>     mutate(g,p);
>     const ajv = new Ajv2020({allErrors:true,strict:false});
>     let result;
>     try {
>       ajv.addSchema(g);
>       const validate=ajv.compile(p);
>       const good = validate(sample);
>       const badSample = structuredClone(sample); badSample.nodes[0].type='__not_a_node_type__';
>       const bad = validate(badSample);
>       result={version,case:label,compiled:true,validAccepted:good,invalidRejected:!bad};
>       assert.equal(good,true);
>       assert.equal(bad,false);
>     } catch (error) { result={version,case:label,compiled:false,error:error.message}; }
>     assert.equal(result.compiled,expectedCompile,JSON.stringify(result));
>     console.log(JSON.stringify(result));
>   }
> }
> NODE``
>
> <details><summary>Explored 3 files, 2 searches</summary>
>
> - Read `./src/bundle/loadBundle.ts`
> - Read `./bundle/v0.1/core/schema.json`
> - Read `./bundle/v0.1/core/projection_schema.json`
> - Searched for `addSchema\(|_addSchema\(|_checkUnique\(|resolveUrl\(|resolveSchema\(|schemaId` in `core.ts`
> - Searched for `projection_schema.json` in `$id`
>
> </details>
>
> Searched the web for `https://ajv.js.org/guide/combining-schemas.html`
>
> <details><summary>Explored 5 files, a search, a list</summary>
>
> - Read `./bundle/v0.1/core/schema.json`
> - Read `./node_modules/ajv/lib/core.ts`
> - Read `./node_modules/ajv/lib/compile/index.ts`
> - Read `./node_modules/ajv/lib/core.ts`
> - Read `./src/projector/shared.ts`
> - Listed files in `goldens`
> - Searched for `(projection|project).*json$`
>
> </details>
>
> - Ran `sed -n '28,46p' bundle/v0.1/core/schema.json && sed -n '1,38p' tests/projectionServicePublicApi.spec.ts && sed -n '1,50p' src/bundle/fingerprint.ts && git log -1 --format='%h %s' -- bundle/v0.1/core/projection_schema.json`
>
> - Ran ``TMPDIR=/tmp node --import tsx --input-type=module <<'NODE'
> import fs from 'node:fs';
> import assert from 'node:assert/strict';
> import { validateProjection } from './src/projector/shared.ts';
> for (const version of ['0.1', '0.2']) {
>   const read = name => JSON.parse(fs.readFileSync(`bundle/v${version}/core/${name}.json`, 'utf8'));
>   const originalGraph = read('schema'), originalProjection = read('projection_schema');
>   const sample = {schema:'sdd-text-view-projection',version,view_id:originalProjection.properties.view_id.enum[0],source_example:'schema-id-probe',nodes:[{id:'O-001',type:originalGraph.$defs.nodeType.enum[0],name:'Probe'}],edges:[],derived:{node_annotations:[],edge_annotations:[],node_groups:[],view_metadata:{}},omissions:[],notes:[]};
>   const cases = [
>     ['unchanged', (g,p)=>{}, true],
>     ['remove projection $id', (g,p)=>{delete p.$id;}, false],
>     ['remove both $ids', (g,p)=>{delete g.$id;delete p.$id;}, false],
>     ['rename projection leaf only', (g,p)=>{p.$id=p.$id.replace('projection_schema.json','renamed.json');}, true],
>     ['change projection host only', (g,p)=>{p.$id=p.$id.replace('example.org','schema-probe.invalid');}, false],
>     ['change both hosts together', (g,p)=>{g.$id=g.$id.replace('example.org','schema-probe.invalid');p.$id=p.$id.replace('example.org','schema-probe.invalid');}, true],
>     ['cross-version projection $id only', (g,p)=>{p.$id=p.$id.replace(`/${version}/`,version==='0.1'?'/0.2/':'/0.1/');}, false],
>     ['remove projection $id, make external refs absolute', (g,p)=>{delete p.$id; const visit=x=>{if(!x||typeof x!=='object')return;for(const [k,v]of Object.entries(x)){if(k==='$ref'&&v.startsWith('./schema.json'))x[k]=g.$id+v.slice('./schema.json'.length);else visit(v);}};visit(p);}, true]
>   ];
>   for (const [label, mutate, expectedCompile] of cases) {
>     const schema = structuredClone(originalGraph), projectionSchema = structuredClone(originalProjection);
>     mutate(schema,projectionSchema);
>     const bundle={schema,projectionSchema};
>     let result;
>     try {
>       const good=validateProjection(bundle,sample,'schema-id-probe');
>       const invalid=structuredClone(sample);invalid.nodes[0].type='__not_a_node_type__';
>       const bad=validateProjection(bundle,invalid,'schema-id-probe');
>       result={version,case:label,compiled:true,validAccepted:!!good.projection,invalidRejected:!bad.projection,diagnostics:good.diagnostics};
>     } catch(error) {result={version,case:label,compiled:false,error:error.message};}
>     console.log(JSON.stringify(result));
>     assert.equal(result.compiled,expectedCompile);
>     if(result.compiled){assert.equal(result.validAccepted,true);assert.equal(result.invalidRejected,true);}
>   }
> }
> NODE``
>
> </details>
</details>

**That line has a real operational purpose: it supplies the base URI that lets Ajv resolve the projection schema’s references to the graph schema. The particular `example.org` address is replaceable; deleting `$id` alone breaks the current implementation.**

JSON Schema defines `$id` as the schema’s canonical identifier and a base for resolving relative references. The identifier does **not** have to serve a downloadable document. An HTTPS-shaped identifier with no schema hosted there is valid. [JSON Schema 2020-12, §8.2.1](https://json-schema.org/draft/2020-12/json-schema-core)

The repository uses it through this concrete path:

1. [`loadBundle()`](./src/bundle/loadBundle.ts:47) reads both schema files from local paths given in the manifest. It passes parsed JSON objects onward.
2. [`validateProjection()`](./src/projector/shared.ts:219) creates Ajv and runs:
   ```ts
   ajv.addSchema(bundle.schema);
   const validate = ajv.compile(bundle.projectionSchema);
   ```
   Ajv registers the graph schema using its `$id`.
3. The [v0.2 projection schema](./bundle/v0.2/core/projection_schema.json:79) contains references such as:
   ```json
   "$ref": "./schema.json#/$defs/id"
   ```
   Against the projection’s `$id`, this resolves to:
   ```text
   https://example.org/sdd-text/0.2/schema.json#/$defs/id
   ```
   That matches the [graph schema’s identifier](./bundle/v0.2/core/schema.json:3), so Ajv finds the already registered schema in memory. The [v0.1 schema](./bundle/v0.1/core/projection_schema.json:79) works identically.

**There is no HTTP retrieval in this path.** Also, `./schema.json` is resolved against the schema identifier—not the file’s directory. Ajv explicitly documents both behaviors. [Ajv reference-resolution documentation](https://ajv.js.org/guide/combining-schemas.html#combining-schemas-with-ref)

I verified this by calling the repository’s actual `validateProjection()` function with in-memory copies of **both versions**, using installed Ajv **8.18.0**:

| Modification | Result in both versions |
|---|---|
| Original schemas | Validation works |
| Delete projection `$id` | Schema compilation fails |
| Change only projection `$id`’s hostname | Schema compilation fails |
| Change both schemas’ hostnames consistently | Validation works |
| Rename only `projection_schema.json` in its `$id`, retaining the directory | Validation works |
| Delete projection `$id` and make its external `$ref`s absolute | Validation works |

The deletion error was:
```text
can't resolve reference ./schema.json#/$defs/id from id #
```
Successful cases accepted a valid projection and rejected an invalid node type.

My recommendation is to **retain `$id`, but use a stable project-controlled namespace if you want to remove the placeholder naming**. Update the graph and projection identifiers consistently. Hosting schemas at those addresses is optional.

The version segment provides separate reference namespaces; it does not itself enforce the projection’s version. That check comes from [`properties.version.const`](./bundle/v0.2/core/projection_schema.json:22). The exact `example.org` spelling contributes no special functionality.

No repository files were changed.

### In Plain English...

> Please re-format the response to address a product manager instead of a name space geek.

**Keep the line: it serves a real purpose, even though the web address is fictional.**

The validation system uses it to connect the projection’s rules with shared rules defined elsewhere in the bundle. The address acts as an internal identifier; it does not need to point to a working website, and the current code never downloads anything from it.

I checked the implementation and tested both v0.1 and v0.2:

- **Deleting the line breaks projection validation.**
- **Replacing the fictional address works**, provided the corresponding identifiers in both schema files are updated consistently.

**Recommendation:** leave it in place. Replacing `example.org` with a project-owned address would make the files less confusing, but it is housekeeping rather than a functional improvement. There is no need to build or host a website to support it.

This conclusion comes from the [validation code](./src/projector/shared.ts:219), direct tests, and the [JSON Schema specification](https://json-schema.org/draft/2020-12/json-schema-core).

## Benefits of a Public Schema

> If we theoretically DID build a page at a project-controlled URL and referenced it, what would that page contain? What would the existence of such a page improve?

<details><summary>2 previous messages</summary>

> I’ll check what publishing the schema would enable for external tools, then explain the practical benefits.
>
> <details><summary>Searched the web</summary>
>
> Searched the web for `https://json-schema.org/understanding-json-schema/structuring`
>
> Searched the web for `'Schema association' in https://code.visualstudio.com/docs/languages/json`
>
> </details>
</details>

**It would give SDD a public, usable specification that other people’s tools could access directly.**

At the address ending in `projection_schema.json`, we would publish the actual JSON schema—the file describing required fields, allowed values, and the structure of projection output. We would also publish its companion `schema.json`, because it supplies shared definitions that the projection schema references.

A separate documentation page could explain what a projection is, show an example, describe each field, and link to the downloadable schemas for each version.

The practical improvements would be:

- **Easier integrations.** Someone building an SDD viewer, importer, or reporting tool could retrieve the rules and check incoming projection data without downloading our repository. Validators can be configured to fetch published schemas. [Ajv documentation](https://ajv.js.org/guide/managing-schemas.html#asynchronous-schema-loading)
- **Better developer assistance.** Compatible editors could use the published schema to flag mistakes and suggest valid fields when working with projection JSON. This requires an editor configuration connecting those files to the schema; publishing alone does not activate it. [VS Code documentation](https://code.visualstudio.com/docs/languages/json#json-schemas-and-settings)
- **A clear reference for each release.** Documentation, bug reports, and integration agreements could point to the exact rules for v0.1 or v0.2. We should preserve published versions so those references remain dependable.

**The existing SDD toolchain would gain no immediate validation improvement:** it already reads these rules from the local bundle. Hosting them would mainly improve distribution, discoverability, and support for external integrations. It would also create a small maintenance commitment: keep the published files synchronized with releases and their URLs stable.

For SDD, I would treat this as useful infrastructure when encouraging others to build tools around its output.
