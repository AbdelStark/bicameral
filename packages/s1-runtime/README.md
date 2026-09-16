# `@bicameral/s1-runtime`

System 1 runtime for [Bicameral](../../README.md): backends, cache, speculation, redaction, policy, and reflex decisions.

```ts
import {
  DEFAULT_POLICY,
  FakeBackend,
  evaluateGate,
  decideGate,
} from "@bicameral/s1-runtime";
```

Workspace package (this repo). Not on the public npm registry yet. See the [root README](../../README.md#library) for the Gate quickstart, data flow, and fail-safe behavior.
