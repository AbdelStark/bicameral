# `pi-bicameral`

[Pi](https://pi.dev) extension for [Bicameral](../../README.md): Gate, Honest Finish, Stuck Detector, HUD, `/why`, `/s1`.

```ts
import { createBicameralExtension } from "pi-bicameral";

export default createBicameralExtension();
```

Peer: `@earendil-works/pi-coding-agent` **0.85.1** (optional so unit tests skip native TUI deps). Manifest: `pi.extensions: ./src/index.ts`.

Install from this checkout (`pi install "$(pwd)/packages/pi-bicameral"`). The GitHub remote is private until launch. `pi install npm:pi-bicameral` is for when the package is published; it is not on the public registry yet.

See the [root README](../../README.md#install) for policy files, `TYPESAFE_API_KEY`, and fail-safe fallback.
