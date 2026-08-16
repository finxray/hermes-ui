# Stoix Beta Testing

Stoix `0.1.x` is an early community beta. It is useful software under active
development, not a stable or fully validated release.

## Current validation status

| Surface | Maintainer status |
| --- | --- |
| Application from source on macOS | Tested in active development; coverage is not exhaustive. |
| Application from source on Windows | Tested with Hermes running inside WSL2; coverage is not exhaustive. |
| Packaged download and clean install | Not yet validated by the maintainer on any platform. |
| Linux application and installer | Not yet validated by the maintainer. |
| Native-Windows Hermes integration | Supported by the code as an alternate path but not part of the maintainer-tested Stoix configuration. |
| Automated package matrix | CI evidence only; it does not replace a clean-machine human test. |

The tested Windows architecture is:

```text
Windows browser -> Stoix on Windows -> Hermes Agent in WSL2
```

On August 16, 2026, the source workflow on Windows discovered Hermes 0.20 in
the `Ubuntu` WSL2 distribution, authenticated without exposing its key, and
reported the configured `DeepSeek V4 Flash` / `OpenRouter` route with 45 model
options. A follow-up status probe remained connected after 30 seconds. This is
live source-workflow evidence, not a packaged clean-install result.

The official Hermes project also offers native Windows support. During this
Stoix beta, WSL2 is the documented Windows path because it is the configuration
used by the maintainer.

## What testers should check

1. Install or start Stoix and record the exact path used.
2. Run `stoix --doctor` and redact secrets before saving output.
3. Create a project and open two conversations side by side.
4. Send a short prompt in each pane and observe streaming and tool activity.
5. Confirm the model/provider label matches the route configured in Hermes.
6. Exercise one approval or failure path when available.
7. Restart Stoix and confirm project and tab state return.
8. Report failures through the
   [beta bug form](https://github.com/finxray/hermes-ui/issues/new?template=bug_report.yml).

## Reporting standard

Include the operating system, architecture, Stoix commit or version, Hermes
version, Hermes installation mode, clean-machine status, reproduction steps,
and redacted diagnostics. Never publish keys, tokens, private prompts, or
attachments.
