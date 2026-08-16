# Contributing to Stoix

Stoix is an early community beta. Testing, reproducible bug reports,
documentation corrections, and focused pull requests are welcome.

Stoix is an independent interface for
[Hermes Agent](https://github.com/NousResearch/hermes-agent). Hermes remains the
agent runtime; changes must preserve the boundaries in [AGENTS.md](AGENTS.md).

## Test the beta

The current source application has received limited maintainer testing on
macOS and on Windows with Hermes running inside WSL2. The packaged download and
clean-install path have not yet received maintainer validation. Linux has not
yet received maintainer testing.

Useful reports include:

- operating system, processor architecture, and whether the machine was clean;
- Stoix commit or version and Hermes version;
- whether Hermes runs on macOS, Linux, native Windows, or WSL2;
- the exact steps that produced the problem;
- expected and actual behavior;
- redacted output from `stoix --doctor`, the browser console, or Stoix logs.

Never include API keys, provider tokens, private prompts, attachments, or
unredacted personal paths in a public issue.

## Report a bug

Use the [bug report form](https://github.com/finxray/hermes-ui/issues/new?template=bug_report.yml).
Search existing issues first, then create one report per reproducible problem.

## Propose a change

1. Open an issue before a large or architectural change.
2. Fork the repository and create a focused branch.
3. Run `npm ci` followed by `npm run release:check`.
4. Add or update a smoke check for behavior changes.
5. Explain the user-visible result, validation performed, and residual risk in
   the pull request.

By contributing, you agree that your contribution is licensed under the
[MIT License](LICENSE).
