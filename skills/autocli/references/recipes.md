# AutoCLI Recipes

Use this file when the user intent is clear and you want the fastest correct AutoCLI command.

## Fast Defaults

- Prefer one direct command with `--json`.
- Do not run discovery commands first unless the task is unclear.
- If the direct command fails, do one recovery step only.

## Common Intents

| User intent | Run this first | If blocked |
| --- | --- | --- |
| Check Flipkart cart | `autocli shopping flipkart cart --json` | `autocli shopping flipkart capabilities --json` |
| Add item to Flipkart cart | `autocli shopping flipkart add-to-cart <pid> --qty 1 --json` | `autocli shopping flipkart capabilities --json` |
| Check Amazon cart | `autocli shopping amazon cart --json` | `autocli shopping amazon cart --browser --json` |
| Add item to Amazon cart | `autocli shopping amazon add-to-cart <asin> --qty 1 --json` | `autocli shopping amazon capabilities --json` |
| Get GitHub profile | `autocli developer github me --json` | `autocli developer github login --browser` |
| Inspect GitHub support | `autocli developer github capabilities --json` | none |
| Post text to LinkedIn | `autocli social linkedin post "..." --json` | `autocli social linkedin login --browser` |
| Post image or video to LinkedIn | `autocli social linkedin post-media <path> --caption "..." --json` | `autocli social linkedin login --browser` |
| Search Reddit | `autocli social reddit search "<query>" --json` | `autocli social reddit capabilities --json` |
| Comment on Reddit | `autocli social reddit comment <threadUrl> "..." --json` | `autocli social reddit login --browser` |
| Post to X | `autocli social x post "..." --json` | `autocli social x login --browser` |
| Post image to X | `autocli social x post "..." --image <path> --json` | `autocli social x post "..." --image <path> --browser --json` |
| Generate Grok text | `autocli llm grok text "..." --json` | retry with `autocli llm grok text "..." --browser --json` if supported by the current flow |
| Generate Grok image | `autocli llm grok image "..." --json` | `autocli llm grok login --browser` |
| Generate Grok video | `autocli llm grok video "..." --json` | `autocli llm grok login --browser` |
| Upload to YouTube | `autocli social youtube upload <videoPath> --title "..." --visibility private --json` | `autocli social youtube login --browser` |
| Inspect downloadable media for a URL | `autocli tools download info <url> --json` | `autocli doctor --json` |
| Download video from a supported site | `autocli tools download video <url> --json` | retry with `--platform <provider> --account <name>` or `--cookies <path>` if auth is required |
| Download audio from a supported site | `autocli tools download audio <url> --audio-format mp3 --json` | `autocli doctor --json` |
| Download many URLs from a file | `autocli tools download batch ./urls.txt --mode video --json` | `autocli doctor --json` |
| Inspect a playlist URL | `autocli tools download info <playlistUrl> --playlist --limit 5 --json` | none |
| Check provider sessions | `autocli sessions --json` | none |
| Diagnose missing local tools | `autocli doctor --json` | none |
| Inspect a logged-in GitHub web session | `autocli tools http github inspect --json` | `autocli login --browser` |
| Capture logged-in traffic for a site | `autocli tools http <provider-or-domain> capture --summary --json` | `autocli login --browser` |

## Quick Recovery Rules

- Auth error: run the provider `login` command.
- Browser-authenticated site needed: prefer `login --browser`.
- Unsupported or unclear action: run `capabilities --json`.
- Missing local dependency: run `doctor --json`.
- Provider action missing but session exists: use `tools http`.
