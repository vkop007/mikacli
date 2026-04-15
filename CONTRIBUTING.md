# Contributing to AutoCLI

Thanks for helping improve AutoCLI.

## Development Setup

1. Install Bun `1.3.6` or newer.
2. Install dependencies:

```bash
bun install
```

3. Run the core checks before opening a pull request:

```bash
bun run typecheck
bun test
bun run build
```

4. For local CLI testing:

```bash
bun run link:global
autocli --help
```

## Project Structure

- `src/platforms/<category>/<provider>` contains provider logic.
- `src/commands` contains only root-level commands such as `status`, `doctor`, and `sessions`.
- Providers should always be category-based. Do not add new root provider commands.

## Contribution Guidelines

- Keep command surfaces consistent with the rest of the CLI.
- Add or update tests for new behavior.
- Update `README.md` when command surfaces or auth requirements change.
- Prefer clear, structured `--json` output for anything an agent might consume.
- Mark partial or experimental support honestly in manifests and docs.
- List results should use the stable `data.items` alias to work with `--filter` and `--select` global flags.
- When adding new output functions, pass the optional `context?: Partial<CommandContext>` parameter so filtering can be applied transparently.

## Auth, Sessions, and Test Fixtures

- Never commit live cookies, tokens, QR session state, or personal exports.
- Use redacted, synthetic, or clearly fake fixtures in tests.
- If a provider needs manual verification, document the expected setup without storing private data in the repo.

## Pull Requests

- Keep pull requests focused.
- Include the user-facing command examples for new providers or commands.
- Mention any new system dependencies such as `ffmpeg`, `qpdf`, or `tesseract`.

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
