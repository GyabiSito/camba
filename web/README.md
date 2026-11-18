# Camba web workspace

Install the locked Angular 22 toolchain with `npm ci --ignore-scripts` from this directory. Run `npm exec -- ng version` to verify the CLI and framework versions. The `projects/` directory is reserved for the SSR storefront (`store`) and the client-rendered administration application (`admin`); application builds and E2E checks are not present yet.

Use the API and local dependencies described in [the infrastructure guide](../infra/README.md). Both UIs will use first-party Sanctum cookies through a same-origin `/api` proxy and keep captured design and browser evidence separate from application code.
