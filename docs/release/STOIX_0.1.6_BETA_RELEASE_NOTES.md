# Stoix 0.1.6 Community Beta

Stoix 0.1.6 is an early, MIT-licensed community beta of the local visual
interface for Hermes Agent. It is not a stable release. Expect bugs and please
report reproducible failures so the project can improve in public.

Stoix is an independent community project and is not affiliated with or
endorsed by Nous Research.

## Highlights

- Two independent Hermes conversations side by side inside one project.
- Pane-local tabs that can move between the left and right conversations.
- Streaming responses with visible tools, approvals, failures, and completion.
- Project-scoped workspace state, models, skills, plugins, settings, and logs.
- Continuation of Hermes sessions created in connected external channels.
- Windows/WSL2 auto-discovery, private API-key handoff, connection lease, and
  authoritative Hermes model/provider detection.
- Loopback-bound local services with credentials kept out of browser code.

## Validation status

- The source application has received limited maintainer testing on macOS.
- The source application has received limited maintainer testing on Windows
  with Hermes running inside WSL2.
- The packaged download and clean-install path have not yet received maintainer
  validation on any platform.
- Linux has not yet received maintainer testing.
- The automated GitHub Actions package matrix covers six OS/architecture
  targets, but CI evidence is not a clean-machine human test.

The documented Windows beta architecture is Stoix on Windows connected to
Hermes Agent inside WSL2. Native-Windows Hermes is an unvalidated alternate
Stoix path during this beta.

## Known limitations

- No stable GitHub Release is published yet; bootstrap installation currently
  builds the public source branch.
- Packages are unsigned and macOS notarization is not claimed.
- No tested uninstall command is available yet.
- Compatibility is capability-driven and may expose gaps with individual
  Hermes versions, tools, skills, or plugins.
- Beta-to-beta update discovery is not a dedicated release channel yet.

## Help test

Follow [the beta checklist](BETA_TESTING.md), then submit a
[bug report](https://github.com/finxray/hermes-ui/issues/new?template=bug_report.yml)
or [platform test](https://github.com/finxray/hermes-ui/issues/new?template=platform_test.yml).
Remove keys, tokens, private prompts, transcripts, attachments, and personal
paths before posting diagnostics.

## License

Stoix is released under the [MIT License](../../LICENSE) and is provided
without warranty.
