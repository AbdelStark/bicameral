# `@bicameral/packs`

Judgment packs (YAML) and loader for [Bicameral](../../README.md) System 1 reflexes. Builtins: `gate`, `edit_review`, `finish_check`, `progress`.

```ts
import { loadBuiltinPacks } from "@bicameral/packs";

const packs = loadBuiltinPacks();
packs.gate.questions;
packs.gate.packHash;
```

Loader compiles YAML with `@typesafe-ai/sdk` `noul()` / `score()` / `choice()` and sets `packHash` to the SHA-256 of canonical `{ pack, version, questions }`. Schema: [`schema.json`](./schema.json). Workspace package; not on the public npm registry yet.
