# Security Policy

## Supported Version

Security fixes are applied to the latest mainline version of MikaCLI.

## Reporting a Vulnerability

Please do not open public GitHub issues for security-sensitive bugs.

Use one of these private paths instead:

1. Open a GitHub Security Advisory for this repository.
2. If advisories are not enabled for you, contact the maintainer privately through GitHub and include:
   - affected command or provider
   - steps to reproduce
   - impact
   - suggested mitigation if you have one

## Sensitive Data Handling

- Never include live cookies, tokens, session exports, or QR state in bug reports.
- Redact account identifiers, personal data, and workspace URLs where possible.
- If a report needs headers or payloads, remove secrets before sharing.

## Scope

Please report issues such as:

- authentication bypass
- session leakage
- unsafe local file writes
- command injection
- secret exposure in logs or outputs
- provider actions executing against the wrong account or workspace
