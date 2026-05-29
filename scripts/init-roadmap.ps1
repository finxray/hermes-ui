# Run from C:\Users\Alexey\.cursor\projects\hermes-ui after extracting this package.

if (-not (Test-Path ".git")) {
  git init
}

git status
Write-Host "Roadmap files are ready. Suggested next step:"
Write-Host "git add . && git commit -m 'chore: add initial Hermes UI roadmap'"
Write-Host "Then give Codex docs/codex/PROMPT_SLICE_00_DISCOVERY.md using high reasoning."
