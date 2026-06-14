#Requires -Version 5.1
<#
.SYNOPSIS
  Start or verify the local Hermes UI + Hermes API (WSL) + Brain Memory (Docker) dev stack.

.DESCRIPTION
  Windows-friendly orchestrator for local development. It:
  - ensures Docker Desktop / engine is running (starts Desktop when needed);
  - delegates Brain Memory startup to brain-memory/scripts/start-brain-memory.ps1;
  - starts Hermes gateway in WSL via the installed `hermes` CLI when API health is down;
  - starts or verifies the Hermes UI dev server via npm run studio:web;
  - probes /health and /ready endpoints without printing secrets or env values.

  Idempotent: safe when services are already healthy.

  Does NOT modify .env files, install packages, or expose API keys.
#>
[CmdletBinding()]
param(
    [switch]$Help,
    [switch]$DryRun,
    [switch]$SkipUi,
    [switch]$SkipBrainMemory,
    [switch]$SkipHermes,
    [switch]$SkipDocker,
    [int]$UiPort = 3000,
    [string]$WslDistro = $(if ($env:STUDIO_WSL_DISTRO) { $env:STUDIO_WSL_DISTRO } else { "Ubuntu" }),
    [string]$BrainMemoryRepo = $(if ($env:STUDIO_BRAIN_MEMORY_REPO) { $env:STUDIO_BRAIN_MEMORY_REPO } else { "" }),
    [int]$DockerWaitSec = 180,
    [int]$HermesWaitSec = 90,
    [int]$UiWaitSec = 90
)

$ErrorActionPreference = "Stop"

$HermesUiRoot = Split-Path -Parent $PSScriptRoot
if (-not $BrainMemoryRepo -or $BrainMemoryRepo.Trim() -eq "") {
    $BrainMemoryRepo = Join-Path (Split-Path -Parent $HermesUiRoot) "brain-memory"
}

$HermesHealthUrl = "http://127.0.0.1:8642/health"
$BrainMemoryHealthUrl = "http://127.0.0.1:8080/health"
$BrainMemoryReadyUrl = "http://127.0.0.1:8080/ready"
$WebUiUrl = "http://127.0.0.1:$UiPort/"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[ok] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[!!] $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "[fail] $Message" -ForegroundColor Red
}

function Show-Help {
    @"
Brain Memory Studio local stack launcher
=======================================
Starts or verifies Docker, Brain Memory Gateway, Hermes API (WSL), and Hermes UI.

Usage (from Hermes UI repo root):
  npm run studio:stack
  npm run studio:stack -- -DryRun
  powershell -ExecutionPolicy Bypass -File .\scripts\studio-stack.ps1 -Help

Options:
  -DryRun              Print planned actions only; do not start services.
  -SkipUi              Do not start or wait for the Web UI dev server.
  -SkipBrainMemory     Skip Brain Memory / Docker startup.
  -SkipHermes          Skip Hermes gateway startup in WSL.
  -SkipDocker          Skip Docker Desktop / engine checks (Brain Memory only if already up).
  -UiPort <n>          Web UI port (default: 3000).
  -WslDistro <name>    WSL distro for Hermes (default: Ubuntu, override: STUDIO_WSL_DISTRO).
  -BrainMemoryRepo     Path to brain-memory repo (default: sibling ../brain-memory).

Environment overrides:
  STUDIO_WSL_DISTRO
  STUDIO_BRAIN_MEMORY_REPO

What this script does NOT do:
  - modify apps/web/.env.local or any secret files;
  - install Hermes, Brain Memory, Docker, or npm packages;
  - stop/kill existing processes;
  - start Hermes through arbitrary high-privilege commands.

Brain Memory startup delegates to:
  <brain-memory-repo>/scripts/start-brain-memory.ps1

Hermes startup uses the WSL-installed CLI only:
  hermes gateway status
  hermes gateway start

After startup, verify manually:
  npm run studio:launch -- --check --base-url http://127.0.0.1:$UiPort
  npm run studio:doctor
"@
}

function Test-HttpOk {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSec = 8
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec $TimeoutSec -UseBasicParsing
        return [pscustomobject]@{
            Ok = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300)
            StatusCode = $response.StatusCode
        }
    } catch {
        return [pscustomobject]@{
            Ok = $false
            StatusCode = $null
        }
    }
}

function Test-DockerEngine {
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "SilentlyContinue"
        $null = docker info 2>&1
        return $LASTEXITCODE -eq 0
    } finally {
        $ErrorActionPreference = $previousPreference
    }
}

function Get-DockerDesktopPath {
    @(
        (Join-Path ${env:ProgramFiles} "Docker\Docker\Docker Desktop.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Docker\Docker\Docker Desktop.exe")
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
}

function Ensure-DockerEngine {
    if ($SkipDocker) {
        Write-Warn "Skipping Docker checks (-SkipDocker)."
        return $true
    }

    if (Test-DockerEngine) {
        Write-Ok "Docker engine is running."
        return $true
    }

    if ($DryRun) {
        Write-Host "[dry-run] Would start Docker Desktop and wait up to ${DockerWaitSec}s for docker info."
        return $true
    }

    $dockerDesktop = Get-DockerDesktopPath
    if (-not $dockerDesktop) {
        Write-Fail "Docker Desktop executable was not found. Install Docker Desktop or start the engine manually."
        return $false
    }

    Write-Step "Starting Docker Desktop"
    Start-Process -FilePath $dockerDesktop | Out-Null

    $deadline = (Get-Date).AddSeconds($DockerWaitSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-DockerEngine) {
            Write-Ok "Docker engine became ready."
            return $true
        }
        Start-Sleep -Seconds 3
    }

    Write-Fail @"
Docker engine did not become ready within ${DockerWaitSec}s.
Manual steps:
  1. Open Docker Desktop from the Start menu.
  2. Complete any login, license, update, or WSL integration prompts in the GUI.
  3. Wait until Docker shows 'Engine running'.
  4. Verify: docker ps
  5. Re-run: npm run studio:stack
"@
    return $false
}

function Ensure-BrainMemory {
    if ($SkipBrainMemory) {
        Write-Warn "Skipping Brain Memory startup (-SkipBrainMemory)."
        return $true
    }

    $health = Test-HttpOk -Url $BrainMemoryHealthUrl
    $ready = Test-HttpOk -Url $BrainMemoryReadyUrl
    if ($health.Ok -and $ready.Ok) {
        Write-Ok "Brain Memory Gateway already healthy at $BrainMemoryHealthUrl and $BrainMemoryReadyUrl"
        return $true
    }

    $startScript = Join-Path $BrainMemoryRepo "scripts\start-brain-memory.ps1"
    if (-not (Test-Path -LiteralPath $startScript)) {
        Write-Fail "Brain Memory start script not found: $startScript"
        Write-Host "Set STUDIO_BRAIN_MEMORY_REPO or clone brain-memory next to hermes-ui."
        return $false
    }

    if ($DryRun) {
        Write-Host "[dry-run] Would run: powershell -ExecutionPolicy Bypass -File `"$startScript`""
        return $true
    }

    Write-Step "Starting Brain Memory via sanctioned script"
    & powershell -ExecutionPolicy Bypass -File $startScript
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Brain Memory startup script exited with code $LASTEXITCODE"
        return $false
    }

    $health = Test-HttpOk -Url $BrainMemoryHealthUrl
    $ready = Test-HttpOk -Url $BrainMemoryReadyUrl
    if (-not $health.Ok -or -not $ready.Ok) {
        Write-Fail "Brain Memory probes failed after startup (health=$($health.Ok), ready=$($ready.Ok))."
        return $false
    }

    Write-Ok "Brain Memory Gateway is healthy and ready."
    return $true
}

function Invoke-WslHermes {
    param([Parameter(Mandatory = $true)][string]$Command)

    & wsl -d $WslDistro -- bash -lc $Command
    return $LASTEXITCODE
}

function Ensure-HermesApi {
    if ($SkipHermes) {
        Write-Warn "Skipping Hermes startup (-SkipHermes)."
        return $true
    }

    $health = Test-HttpOk -Url $HermesHealthUrl
    if ($health.Ok) {
        Write-Ok "Hermes API already reachable at $HermesHealthUrl"
        return $true
    }

    $hermesPath = (& wsl -d $WslDistro -- bash -lc "command -v hermes" 2>$null | Out-String).Trim()
    if (-not $hermesPath) {
        Write-Fail "Hermes CLI not found in WSL distro '$WslDistro'."
        Write-Host @"
Install Hermes Agent in WSL, then verify:
  wsl -d $WslDistro -- bash -lc "command -v hermes"
  wsl -d $WslDistro -- bash -lc "hermes gateway status"
Or set STUDIO_WSL_DISTRO to the distro where Hermes is installed.
"@
        return $false
    }

    if ($DryRun) {
        Write-Host "[dry-run] Would run in WSL ($WslDistro): hermes gateway start"
        Write-Host "[dry-run] Would wait up to ${HermesWaitSec}s for $HermesHealthUrl"
        return $true
    }

    Write-Step "Starting Hermes gateway in WSL ($WslDistro)"
    $statusExit = Invoke-WslHermes -Command "hermes gateway status >/dev/null 2>&1; echo `$?"
    Invoke-WslHermes -Command "hermes gateway start" | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "hermes gateway start returned exit code $LASTEXITCODE; checking health anyway."
    }

    $deadline = (Get-Date).AddSeconds($HermesWaitSec)
    while ((Get-Date) -lt $deadline) {
        $health = Test-HttpOk -Url $HermesHealthUrl
        if ($health.Ok) {
            Write-Ok "Hermes API is reachable at $HermesHealthUrl"
            return $true
        }
        Start-Sleep -Seconds 2
    }

    Write-Fail @"
Hermes API did not become reachable at $HermesHealthUrl within ${HermesWaitSec}s.
Manual steps in WSL:
  wsl -d $WslDistro
  hermes gateway status
  hermes gateway start
  curl http://127.0.0.1:8642/health
If no systemd service is installed, run in a dedicated terminal:
  hermes gateway run
"@
    return $false
}

function Test-WebUiHealthy {
    try {
        $response = Invoke-WebRequest -Uri $WebUiUrl -Method Get -TimeoutSec 8 -UseBasicParsing
        if ($response.StatusCode -ne 200) {
            return $false
        }
        return $response.Content -match "Brain Memory Studio"
    } catch {
        return $false
    }
}

function Ensure-WebUi {
    if ($SkipUi) {
        Write-Warn "Skipping Web UI startup (-SkipUi)."
        return $true
    }

    if (Test-WebUiHealthy) {
        Write-Ok "Hermes UI already healthy at $WebUiUrl"
        return $true
    }

    if ($DryRun) {
        Write-Host "[dry-run] Would start detached: npm run studio:web -- --port $UiPort"
        Write-Host "[dry-run] Would wait up to ${UiWaitSec}s for $WebUiUrl"
        return $true
    }

    Write-Step "Starting Hermes UI dev server on port $UiPort"
    $startArgs = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command",
        "Set-Location -LiteralPath '$HermesUiRoot'; npm run studio:web -- --port $UiPort"
    )
    Start-Process -FilePath "powershell.exe" -ArgumentList $startArgs -WindowStyle Minimized | Out-Null

    $deadline = (Get-Date).AddSeconds($UiWaitSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-WebUiHealthy) {
            Write-Ok "Hermes UI is healthy at $WebUiUrl"
            return $true
        }
        Start-Sleep -Seconds 2
    }

    Write-Fail "Hermes UI did not become healthy at $WebUiUrl within ${UiWaitSec}s."
    Write-Host "Try manually: npm run studio:web -- --port $UiPort"
    return $false
}

function Show-Summary {
    param([bool]$Success)

    Write-Step "Health summary"
    foreach ($entry in @(
        @{ Name = "Brain Memory /health"; Url = $BrainMemoryHealthUrl },
        @{ Name = "Brain Memory /ready"; Url = $BrainMemoryReadyUrl },
        @{ Name = "Hermes API /health"; Url = $HermesHealthUrl },
        @{ Name = "Hermes UI"; Url = $WebUiUrl }
    )) {
        if ($entry.Name -like "Hermes UI*") {
            $ok = Test-WebUiHealthy
        } else {
            $ok = (Test-HttpOk -Url $entry.Url).Ok
        }
        if ($ok) {
            Write-Ok "$($entry.Name): $($entry.Url)"
        } else {
            Write-Fail "$($entry.Name): $($entry.Url)"
        }
    }

    Write-Host ""
    if ($Success) {
        Write-Host "Stack launcher finished successfully." -ForegroundColor Green
        Write-Host "Next: npm run studio:launch -- --check --base-url http://127.0.0.1:$UiPort"
    } else {
        Write-Host "Stack launcher finished with failures." -ForegroundColor Red
    }
}

if ($Help) {
    Show-Help
    exit 0
}

Write-Host "Brain Memory Studio stack launcher"
Write-Host "=================================="
Write-Host "Hermes UI repo: $HermesUiRoot"
Write-Host "Brain Memory repo: $BrainMemoryRepo"
Write-Host "WSL distro: $WslDistro"
Write-Host "Web UI URL: $WebUiUrl"
if ($DryRun) {
    Write-Warn "Dry run mode: no services will be started."
}

$allOk = $true
if (-not (Ensure-DockerEngine)) { $allOk = $false }
if ($allOk -and -not (Ensure-BrainMemory)) { $allOk = $false }
if ($allOk -and -not (Ensure-HermesApi)) { $allOk = $false }
if ($allOk -and -not (Ensure-WebUi)) { $allOk = $false }

Show-Summary -Success:$allOk
if (-not $allOk) {
    exit 1
}
exit 0
