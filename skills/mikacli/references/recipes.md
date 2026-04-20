# MikaCLI Recipes

Use this file when the user intent is clear and you want the fastest correct MikaCLI command.

## Fast Defaults

- Prefer one direct command with `--json`.
- Do not run discovery commands first unless the task is unclear.
- If the direct command fails, do one recovery step only.

## Common Intents

| User intent | Run this first | If blocked |
| --- | --- | --- |
| Check Flipkart cart | `mikacli shopping flipkart cart --json` | `mikacli shopping flipkart capabilities --json` |
| Add item to Flipkart cart | `mikacli shopping flipkart add-to-cart <pid> --qty 1 --json` | `mikacli shopping flipkart capabilities --json` |
| Check Amazon cart | `mikacli shopping amazon cart --json` | `mikacli shopping amazon cart --browser --json` |
| Add item to Amazon cart | `mikacli shopping amazon add-to-cart <asin> --qty 1 --json` | `mikacli shopping amazon capabilities --json` |
| Get GitHub profile | `mikacli developer github me --json` | `mikacli developer github login --browser` |
| Inspect GitHub support | `mikacli developer github capabilities --json` | none |
| Post text to LinkedIn | `mikacli social linkedin post "..." --json` | `mikacli social linkedin login --browser` |
| Post image or video to LinkedIn | `mikacli social linkedin post-media <path> --caption "..." --json` | `mikacli social linkedin login --browser` |
| Search Reddit | `mikacli social reddit search "<query>" --json` | `mikacli social reddit capabilities --json` |
| Comment on Reddit | `mikacli social reddit comment <threadUrl> "..." --json` | `mikacli social reddit login --browser` |
| Post to X | `mikacli social x post "..." --json` | `mikacli social x login --browser` |
| Post image to X | `mikacli social x post "..." --image <path> --json` | `mikacli social x post "..." --image <path> --browser --json` |
| Generate Grok text | `mikacli llm grok text "..." --json` | retry with `mikacli llm grok text "..." --browser --json` if supported by the current flow |
| Generate Grok image | `mikacli llm grok image "..." --json` | `mikacli llm grok login --browser` |
| Generate Grok video | `mikacli llm grok video "..." --json` | `mikacli llm grok login --browser` |
| Upload to YouTube | `mikacli social youtube upload <videoPath> --title "..." --visibility private --json` | `mikacli social youtube login --browser` |
| Inspect downloadable media for a URL | `mikacli tools download info <url> --json` | `mikacli doctor --json` |
| Download video from a supported site | `mikacli tools download video <url> --json` | retry with `--platform <provider> --account <name>` or `--cookies <path>` if auth is required |
| Download audio from a supported site | `mikacli tools download audio <url> --audio-format mp3 --json` | `mikacli doctor --json` |
| Download many URLs from a file | `mikacli tools download batch ./urls.txt --mode video --json` | `mikacli doctor --json` |
| Inspect a playlist URL | `mikacli tools download info <playlistUrl> --playlist --limit 5 --json` | none |
| Check provider sessions | `mikacli sessions --json` | none |
| Diagnose missing local tools | `mikacli doctor --json` | none |
| Inspect a logged-in GitHub web session | `mikacli tools http github inspect --json` | `mikacli login --browser` |
| Capture logged-in traffic for a site | `mikacli tools http <provider-or-domain> capture --summary --json` | `mikacli login --browser` |
| Filter results by field value | `mikacli <category> <provider> <action> --json --filter '<condition>'` | none |
| Select only specific fields | `mikacli <category> <provider> <action> --json --select <field1,field2>` | none |
| Filter and select together | `mikacli <category> <provider> <action> --json --filter '<condition>' --select <fields>` | none |
| Export to CSV | `mikacli <category> <provider> <action> --json --format csv` | none |
| Display as table | `mikacli <category> <provider> <action> --json --format table` | none |
| Generate markdown | `mikacli <category> <provider> <action> --json --format markdown` | none |
| Create HTML report | `mikacli <category> <provider> <action> --json --format html > report.html` | none |
| YAML output | `mikacli <category> <provider> <action> --json --format yaml` | none |

## Filtering & Selection Examples

| User intent | Command |
| --- | --- |
| High-star TypeScript repos | `mikacli developer github repos --json --filter 'stargazers_count > 1000 AND language = "TypeScript"' --select name,stargazers_count,url` |
| Popular Reddit posts | `mikacli social reddit search "ai" --json --filter 'score > 100' --select title,author,score,url` |
| Production Vercel projects | `mikacli devops vercel projects --json --filter 'production_environment != null' --select name,updated_at,environment` |
| Recently updated Jira tickets | `mikacli developer jira issues --json --filter 'updated_at >= today' --select key,summary,priority,assignee` |
| High-engagement LinkedIn posts | `mikacli social linkedin feed --json --filter 'engagement_count > 500' --select content,engagement_count,timestamp` |
| Node.js packages on npm | `mikacli tools npm search node --json --select name,version,downloads --filter 'downloads > 10000'` |
| Top TypeScript repos to CSV | `mikacli developer github repos --json --filter 'language = "TypeScript" AND stargazers_count > 100000' --format csv > top-ts.csv` |
| GitHub repos as html table | `mikacli developer github repos --json --select name,language,stargazers_count --format html > repos.html` |
| DevOps services as YAML | `mikacli devops railway services --json --format yaml --select name,status > services.yaml` |
| Reddit hot posts as markdown | `mikacli social reddit search "trending" --json --format markdown --filter 'score > 1000' --select title,score` |

## Quick Recovery Rules

- Auth error: run the provider `login` command.
- Browser-authenticated site needed: prefer `login --browser`.
- Unsupported or unclear action: run `capabilities --json`.
- Missing local dependency: run `doctor --json`.
- Provider action missing but session exists: use `tools http`.
