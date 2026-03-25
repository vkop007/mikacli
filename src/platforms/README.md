# Platform Structure

Each platform lives under `src/platforms/<name>/`.

There are two supported patterns:

1. `buildCommand`
- Use this when a platform already has a large custom command builder.
- Required files:
  - `manifest.ts`
  - `command.ts`
  - `adapter.ts` if the platform uses a shared adapter instance

2. `capabilities`
- Use this for new platforms or when splitting an existing large platform.
- Required files:
  - `manifest.ts`
  - `adapter.ts` when the platform has an adapter-backed implementation
  - `capabilities/*.ts`

Recommended layout:

```text
src/platforms/<name>/
  adapter.ts
  command.ts
  manifest.ts
  capabilities/
    login.ts
    post.ts
    like.ts
    comment.ts
```

Rules:

- Register every platform in `src/platforms/index.ts`.
- Put shared platform metadata in `src/platforms/config.ts`.
- Keep root CLI wiring out of `src/index.ts`; the root only loads platform definitions.
- Use `manifest.ts` as the single entrypoint for a platform.
- Prefer `capabilities` for new work.
- Keep `src/commands/*` as compatibility wrappers only.

Current examples:

- All current platforms are capability-based.
- Small capability sets: `src/platforms/facebook/`, `src/platforms/linkedin/`, `src/platforms/tiktok/`
- Larger capability sets with platform-local helpers: `src/platforms/x/`, `src/platforms/instagram/`, `src/platforms/youtube/`
