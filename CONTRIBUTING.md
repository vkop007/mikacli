# Contributing to MikaCLI

Thanks for helping improve MikaCLI.

## Development Setup

1. Install Bun `1.3.6` or newer.
2. Install dependencies:

```bash
bun install
```

3. Run the local CLI directly while developing:

```bash
bun run dev --help
bun run dev status
```

4. Link the CLI globally if you want to test the installed command shape:

```bash
bun run link:global
mikacli --help
```

## Useful Scripts

Use these scripts instead of updating generated files by hand:

```bash
bun run generate:platform-registry
bun run generate:readme
bun run generate:skill-providers
bun run sync:skills
bun run sync:docs
```

- `bun run generate:platform-registry` rebuilds generated platform metadata and runtime registry files.
- `bun run generate:readme` refreshes the generated sections inside `README.md`.
- `bun run generate:skill-providers` rebuilds provider reference docs under `skills/mikacli/references/providers`.
- `bun run sync:skills` regenerates skill provider references and syncs the installed Codex skill.
- `bun run sync:docs` refreshes the README, regenerates skill provider references, and syncs the installed Codex skill.

## Testing and Verification

Pick the smallest useful check for the change you made, then run the full set before a release-sensitive change or broad refactor.

### Fast checks

For docs or generated-reference changes:

```bash
bun run sync:docs
```

For code changes:

```bash
bun run typecheck
bun run build
```

For a focused test while iterating:

```bash
bun test src/path/to/test-file.test.ts
```

### Pre-pull-request checks

Before opening a pull request, run the core checks:

```bash
bun run sync:docs
bun run typecheck
bun test
bun run build
```

`prepublishOnly` runs this same high-level flow automatically for release builds.

## Project Structure

- `src/platforms/<category>/<provider>` contains provider logic.
- `src/commands` contains only root-level commands such as `status`, `doctor`, and `sessions`.
- Providers should always be category-based. Do not add new root provider commands.

## Contribution Guidelines

- Keep command surfaces consistent with the rest of the CLI.
- Add or update tests for new behavior.
- Regenerate docs when command surfaces, provider counts, auth requirements, or skill references change.
- Prefer clear, structured `--json` output for anything an agent might consume.
- Mark partial or experimental support honestly in manifests and docs.
- List results should use the stable `data.items` alias to work with `--filter` and `--select` global flags.
- When adding new output functions, pass the optional `context?: Partial<CommandContext>` parameter so filtering can be applied transparently.
- Prefer updating the source manifest/metadata and then running the generators instead of editing generated files manually.

## Docs and Generated Files

- `README.md` contains generated marker-based sections. Use `bun run generate:readme` or `bun run sync:docs` after provider or metadata changes.
- `skills/mikacli/references/providers` is generated. Use `bun run generate:skill-providers` or `bun run sync:skills`.
- Platform registry files under `src/platforms/generated-*` are generated from provider manifests. Use `bun run generate:platform-registry`.
- If a generated file changes unexpectedly, review the source manifest or shared runtime metadata first.

## Auth, Sessions, and Test Fixtures

- Never commit live cookies, tokens, QR session state, or personal exports.
- Use redacted, synthetic, or clearly fake fixtures in tests.
- If a provider needs manual verification, document the expected setup without storing private data in the repo.

## Pull Requests

- Keep pull requests focused.
- Include the user-facing command examples for new providers or commands.
- Mention any new system dependencies such as `ffmpeg`, `qpdf`, or `tesseract`.
- Mention which verification steps you ran, especially if you only ran targeted tests instead of the full suite.

## Questions and Ideas

If you are unsure where a provider belongs, prefer grouping by user intent:

- `llm`
- `social`
- `developer`
- `music`
- `movie`
- `shopping`
- `editor`
- `maps`
- `news`
- `finance`
- `tools`
- `data`
- `bot`
