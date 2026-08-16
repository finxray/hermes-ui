[CmdletBinding()]
param(
    [string]$ArchivePath = "",
    [string]$Version = $env:STOIX_VERSION,
    [string]$InstallRoot = $env:STOIX_INSTALL_ROOT,
    [string]$BinDir = $env:STOIX_BIN_DIR,
    [string]$ConfigRoot = $env:STOIX_CONFIG_ROOT,
    [ValidateSet("Auto", "Native", "Wsl", "Skip")]
    [string]$HermesMode = $(if ($env:STOIX_HERMES_MODE) { $env:STOIX_HERMES_MODE } else { "Auto" }),
    [string]$WslDistribution = $env:STOIX_WSL_DISTRO,
    [switch]$SkipHermes,
    [switch]$NoLaunch,
    [switch]$NoIntegrate,
    [switch]$Source
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$Repository = if ($env:STOIX_REPOSITORY) { $env:STOIX_REPOSITORY } else { "finxray/hermes-ui" }
$Branch = if ($env:STOIX_BRANCH) { $env:STOIX_BRANCH } else { "master" }
$NodeVersion = "24.15.0"
$TempRoot = ""
$script:InteractiveUi = -not [Console]::IsOutputRedirected -and
    $env:TERM -ne "dumb" -and
    $env:STOIX_NO_ANIMATION -ne "true" -and
    -not $env:CI
$script:ActivityWidth = 0

function Write-Info([string]$Message) { Write-Host "[Stoix] $Message" -ForegroundColor Cyan }
function Write-WarningMessage([string]$Message) { Write-Host "[Stoix] WARNING: $Message" -ForegroundColor Yellow }
function Fail([string]$Message) { throw $Message }

function Get-ActivityPhrase([int]$Index, [string]$Activity) {
    switch ($Index % 6) {
        0 { return $Activity }
        1 { return "Teaching the browser where Hermes lives..." }
        2 { return "Keeping every credential on this machine..." }
        3 { return "Asking the gateway for a tiny sign of life..." }
        4 { return "Polishing the local control surface..." }
        default { return "Still working -- definitely not contemplating infinity..." }
    }
}

function Show-ActivityFrame([System.Diagnostics.Stopwatch]$Stopwatch, [string]$Activity) {
    if (-not $script:InteractiveUi -or $Stopwatch.Elapsed.TotalSeconds -lt 5) { return }
    $frames = @("S....", "ST...", "STO..", "STOI.", "STOIX", ".TOIX", "..OIX", "...IX")
    $tick = [Math]::Floor($Stopwatch.Elapsed.TotalMilliseconds / 200)
    $frame = $frames[$tick % $frames.Count]
    $phraseIndex = [Math]::Floor(($Stopwatch.Elapsed.TotalSeconds - 5) / 4)
    $line = "$frame  $(Get-ActivityPhrase $phraseIndex $Activity)"
    $script:ActivityWidth = [Math]::Max($script:ActivityWidth, $line.Length)
    Write-Host ("`r" + $line.PadRight($script:ActivityWidth)) -NoNewline -ForegroundColor Cyan
}

function Clear-ActivityFrame {
    if (-not $script:InteractiveUi -or $script:ActivityWidth -eq 0) { return }
    Write-Host ("`r" + (" " * $script:ActivityWidth) + "`r") -NoNewline
    $script:ActivityWidth = 0
}

function Invoke-QuietActivity(
    [string]$Activity,
    [string]$FilePath,
    [string[]]$ArgumentList
) {
    $activityId = [Guid]::NewGuid().ToString("N")
    $stdoutPath = Join-Path $TempRoot "activity-$activityId.out"
    $stderrPath = Join-Path $TempRoot "activity-$activityId.err"
    try {
        $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList `
            -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        while (-not $process.HasExited) {
            Show-ActivityFrame $stopwatch $Activity
            Start-Sleep -Milliseconds 100
        }
        $process.WaitForExit()
        return $process.ExitCode
    } finally {
        Clear-ActivityFrame
        Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
    }
}

function Wait-ForLoopbackPort([int]$Port, [int]$TimeoutSeconds, [string]$Activity) {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
            if (Test-LoopbackPort $Port) { return $true }
            Show-ActivityFrame $stopwatch $Activity
            Start-Sleep -Milliseconds 150
        }
        return $false
    } finally {
        Clear-ActivityFrame
    }
}

function Show-Completion([string]$InstalledVersion) {
    Write-Host ""
    Write-Host "        /\" -ForegroundColor Cyan
    Write-Host "     __/  \__" -ForegroundColor Cyan
    Write-Host "    /  |  |  \" -ForegroundColor Magenta
    Write-Host "       |/\|" -ForegroundColor Magenta
    Write-Host "       STOIX" -ForegroundColor Cyan
    Write-Host "      version $InstalledVersion" -ForegroundColor Magenta
    Write-Host ""
}

function Invoke-Download([string]$Uri, [string]$OutFile) {
    $lastError = $null
    for ($attempt = 1; $attempt -le 3; $attempt += 1) {
        try {
            Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $OutFile -TimeoutSec 120
            return
        } catch {
            $lastError = $_
            if ($attempt -lt 3) { Start-Sleep -Seconds $attempt }
        }
    }
    throw "Download failed: $Uri`n$($lastError.Exception.Message)"
}

function Get-LatestReleaseVersion {
    try {
        $headers = @{ Accept = "application/vnd.github+json"; "User-Agent" = "Stoix-Installer" }
        $release = Invoke-RestMethod -UseBasicParsing -Headers $headers -Uri "https://api.github.com/repos/$Repository/releases/latest" -TimeoutSec 30
        if ($release.draft -or $release.prerelease -or -not $release.tag_name) { return $null }
        return ([string]$release.tag_name).TrimStart("v")
    } catch {
        return $null
    }
}

function Test-Version([string]$Value) {
    return $Value -match "^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$"
}

function Get-FileSha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Assert-Checksum([string]$Path, [string]$ChecksumPath) {
    $firstLine = Get-Content -LiteralPath $ChecksumPath | Where-Object { $_.Trim() } | Select-Object -First 1
    $expected = ([string]$firstLine -split "\s+")[0].ToLowerInvariant()
    if ($expected -notmatch "^[0-9a-f]{64}$") { Fail "The downloaded checksum file is invalid." }
    $actual = Get-FileSha256 $Path
    if ($actual -ne $expected) { Fail "Checksum verification failed for $(Split-Path -Leaf $Path). The file was not installed." }
}

function Get-Architecture {
    # Windows PowerShell can run under x64 emulation on ARM and report the
    # process architecture. Win32_Processor describes the actual machine.
    try {
        $nativeArchitecture = Get-CimInstance Win32_Processor -ErrorAction Stop |
            Select-Object -First 1 -ExpandProperty Architecture
        if ($nativeArchitecture -eq 12) { return "arm64" }
        if ($nativeArchitecture -eq 9) { return "x64" }
    } catch {
        # Environment/runtime fallbacks below cover restricted CIM setups.
    }
    $architecture = if ($env:PROCESSOR_ARCHITEW6432) {
        $env:PROCESSOR_ARCHITEW6432
    } elseif ($env:PROCESSOR_ARCHITECTURE) {
        $env:PROCESSOR_ARCHITECTURE
    } else {
        [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
    }
    switch ($architecture.ToLowerInvariant()) {
        { $_ -in @("amd64", "x64") } { return "x64" }
        { $_ -in @("arm64", "aarch64") } { return "arm64" }
        default { Fail "Unsupported Windows processor architecture: $architecture" }
    }
}

function Expand-StoixArchive([string]$Path, [string]$Destination, [string]$Architecture) {
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    Expand-Archive -LiteralPath $Path -DestinationPath $Destination -Force
    $bundle = Get-ChildItem -LiteralPath $Destination -Directory |
        Where-Object { $_.Name -like "stoix-*-win32-$Architecture" } |
        Select-Object -First 1
    if (-not $bundle -or -not (Test-Path -LiteralPath (Join-Path $bundle.FullName "VERSION.json"))) {
        Fail "The archive is not a Stoix win32-$Architecture package."
    }
    return $bundle.FullName
}

function Get-ReleaseBundle([string]$Architecture) {
    $releaseVersion = if ($Version) { $Version.TrimStart("v") } else { "" }
    if (-not $releaseVersion) { $releaseVersion = Get-LatestReleaseVersion }
    if (-not $releaseVersion) { return $null }
    if (-not (Test-Version $releaseVersion)) { Fail "Invalid Stoix version: $releaseVersion" }

    $asset = "stoix-$releaseVersion-win32-$Architecture.zip"
    $baseUrl = "https://github.com/$Repository/releases/download/v$releaseVersion"
    $archive = Join-Path $TempRoot $asset
    $checksum = "$archive.sha256"
    try {
        Write-Info "Downloading Stoix $releaseVersion for Windows $Architecture..."
        Invoke-Download "$baseUrl/$asset" $archive
        Invoke-Download "$baseUrl/$asset.sha256" $checksum
    } catch {
        if ($Version) { throw }
        return $null
    }
    Assert-Checksum $archive $checksum
    return Expand-StoixArchive $archive (Join-Path $TempRoot "release") $Architecture
}

function Get-NodeRuntime([string]$Architecture) {
    $asset = "node-v$NodeVersion-win-$Architecture.zip"
    $baseUrl = "https://nodejs.org/dist/v$NodeVersion"
    $archive = Join-Path $TempRoot $asset
    $checksums = Join-Path $TempRoot "SHASUMS256.txt"
    Write-Info "Preparing the temporary Node.js $NodeVersion build runtime..."
    Invoke-Download "$baseUrl/$asset" $archive
    Invoke-Download "$baseUrl/SHASUMS256.txt" $checksums
    $match = Get-Content -LiteralPath $checksums |
        Where-Object { $_ -match "^[0-9a-fA-F]{64}\s+$([regex]::Escape($asset))$" } |
        Select-Object -First 1
    if (-not $match) { Fail "Node.js did not publish a checksum for $asset." }
    $expected = ([string]$match -split "\s+")[0]
    Set-Content -LiteralPath (Join-Path $TempRoot "node.sha256") -Value "$expected  $asset" -Encoding ASCII
    Assert-Checksum $archive (Join-Path $TempRoot "node.sha256")
    $destination = Join-Path $TempRoot "node"
    Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force
    $nodeRoot = Join-Path $destination "node-v$NodeVersion-win-$Architecture"
    if (-not (Test-Path -LiteralPath (Join-Path $nodeRoot "node.exe"))) { Fail "The verified Node.js runtime could not be extracted." }
    return $nodeRoot
}

function Build-SourceBundle([string]$Architecture) {
    $nodeRoot = Get-NodeRuntime $Architecture
    $sourceRef = if ($Version) { "refs/tags/v$($Version.TrimStart('v'))" } else { "refs/heads/$Branch" }
    $sourceArchive = Join-Path $TempRoot "stoix-source.zip"
    Write-Info "Downloading Stoix source ($sourceRef)..."
    Invoke-Download "https://github.com/$Repository/archive/$sourceRef.zip" $sourceArchive
    $sourceDestination = Join-Path $TempRoot "source"
    Expand-Archive -LiteralPath $sourceArchive -DestinationPath $sourceDestination -Force
    $sourceRoot = Get-ChildItem -LiteralPath $sourceDestination -Directory | Select-Object -First 1
    if (-not $sourceRoot -or -not (Test-Path -LiteralPath (Join-Path $sourceRoot.FullName "package-lock.json"))) {
        Fail "The Stoix source archive is incomplete."
    }

    $node = Join-Path $nodeRoot "node.exe"
    $npm = Join-Path $nodeRoot "npm.cmd"
    $previousPath = $env:Path
    $previousPlatform = $env:STOIX_RELEASE_PLATFORM
    $previousArchitecture = $env:STOIX_RELEASE_ARCH
    $previousSkipArchive = $env:STOIX_SKIP_ARCHIVE
    try {
        $env:Path = "$nodeRoot;$env:Path"
        $env:STOIX_RELEASE_PLATFORM = "win32"
        $env:STOIX_RELEASE_ARCH = $Architecture
        $env:STOIX_SKIP_ARCHIVE = "true"
        Push-Location $sourceRoot.FullName
        Write-Info "Building the production package. This first install can take several minutes..."
        & $npm ci --no-audit --no-fund | Out-Host
        if ($LASTEXITCODE -ne 0) { Fail "npm ci failed with exit code $LASTEXITCODE." }
        & $npm run build | Out-Host
        if ($LASTEXITCODE -ne 0) { Fail "The Stoix production build failed with exit code $LASTEXITCODE." }
        & $node scripts/package-release.mjs | Out-Host
        if ($LASTEXITCODE -ne 0) { Fail "Stoix packaging failed with exit code $LASTEXITCODE." }
    } finally {
        Pop-Location
        $env:Path = $previousPath
        $env:STOIX_RELEASE_PLATFORM = $previousPlatform
        $env:STOIX_RELEASE_ARCH = $previousArchitecture
        $env:STOIX_SKIP_ARCHIVE = $previousSkipArchive
    }
    $bundle = Get-ChildItem -LiteralPath (Join-Path $sourceRoot.FullName "artifacts\release") -Directory |
        Where-Object { $_.Name -like "stoix-*-win32-$Architecture" } |
        Select-Object -First 1
    if (-not $bundle) { Fail "The Stoix build completed without an installable bundle." }
    return $bundle.FullName
}

function Add-UserPath([string]$Directory) {
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $entries = @($userPath -split ";" | Where-Object { $_ })
    if (-not ($entries | Where-Object { $_.TrimEnd("\") -ieq $Directory.TrimEnd("\") })) {
        [Environment]::SetEnvironmentVariable("Path", (($Directory + ";" + $userPath).TrimEnd(";")), "User")
        Write-Info "Added the Stoix command to your user PATH."
    }
    if (-not (($env:Path -split ";") | Where-Object { $_.TrimEnd("\") -ieq $Directory.TrimEnd("\") })) {
        $env:Path = "$Directory;$env:Path"
    }
}

function Copy-Directory([string]$Source, [string]$Destination) {
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    & robocopy.exe $Source $Destination /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    $robocopyExitCode = $LASTEXITCODE
    if ($robocopyExitCode -ge 8) {
        Fail "Windows could not copy the Stoix application files (robocopy exit code $robocopyExitCode)."
    }
}

function Test-BundleComplete([string]$Path) {
    return (Test-Path -LiteralPath (Join-Path $Path "VERSION.json")) -and
        (Test-Path -LiteralPath (Join-Path $Path "app\apps\web\server.js")) -and
        (Test-Path -LiteralPath (Join-Path $Path "launcher\stoix-launcher.cjs")) -and
        (Test-Path -LiteralPath (Join-Path $Path "launcher\stoix-version.cjs")) -and
        (Test-Path -LiteralPath (Join-Path $Path "updater\install.sh")) -and
        (Test-Path -LiteralPath (Join-Path $Path "updater\install.ps1")) -and
        (Test-Path -LiteralPath (Join-Path $Path "runtime\node.exe")) -and
        (Test-Path -LiteralPath (Join-Path $Path "Stoix.cmd"))
}

function Set-PrivateConfigValue([string]$Path, [string]$Key, [string]$Value) {
    $lines = @(Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue)
    $updated = New-Object System.Collections.Generic.List[string]
    $found = $false
    foreach ($line in $lines) {
        if ($line -match "^$([regex]::Escape($Key))=") {
            $updated.Add("$Key=$Value")
            $found = $true
        } else {
            $updated.Add($line)
        }
    }
    if (-not $found) { $updated.Add("$Key=$Value") }
    Set-Content -LiteralPath $Path -Value $updated -Encoding UTF8
}

function Get-PrivateConfigValue([string]$Path, [string]$Key) {
    if (-not (Test-Path -LiteralPath $Path)) { return "" }
    $line = Get-Content -LiteralPath $Path |
        Where-Object { $_ -match "^$([regex]::Escape($Key))=" } |
        Select-Object -Last 1
    if (-not $line) { return "" }
    return ([string]$line).Substring($Key.Length + 1).Trim()
}

function Find-Hermes {
    $command = Get-Command hermes -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidate = Join-Path $env:LOCALAPPDATA "hermes\hermes-agent\venv\Scripts\hermes.exe"
    if (Test-Path -LiteralPath $candidate) { return $candidate }
    return $null
}

function Get-WslDistributions {
    $wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
    if (-not $wsl) { return @() }
    try {
        $raw = (& $wsl.Source --list --quiet 2>$null | Out-String).Replace([char]0, "")
    } catch {
        return @()
    }
    $seen = @{}
    $distributions = New-Object System.Collections.Generic.List[string]
    foreach ($line in ($raw -split "`r?`n")) {
        $candidate = $line.Trim().TrimStart("*").Trim()
        if ($candidate -notmatch "^[A-Za-z0-9][A-Za-z0-9._ -]{0,79}$") { continue }
        if ($candidate -match "^docker-desktop(?:-data)?$") { continue }
        $key = $candidate.ToLowerInvariant()
        if (-not $seen.ContainsKey($key)) {
            $seen[$key] = $true
            $distributions.Add($candidate)
        }
    }
    return @($distributions | Sort-Object @{ Expression = {
        $name = $_.ToLowerInvariant()
        if ($name -eq "ubuntu") { return 0 }
        if ($name.StartsWith("ubuntu-")) { return 1 }
        if ($name -eq "debian") { return 2 }
        return 3
    } }, @{ Expression = { $_ } })
}

function Find-WslHermes([string]$RequestedDistribution = "") {
    $wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
    if (-not $wsl) { return $null }
    $candidates = if ($RequestedDistribution) {
        if ($RequestedDistribution -notmatch "^[A-Za-z0-9][A-Za-z0-9._ -]{0,79}$") {
            Fail "Invalid WSL distribution name: $RequestedDistribution"
        }
        @($RequestedDistribution)
    } else {
        @(Get-WslDistributions)
    }
    foreach ($distro in $candidates) {
        try {
            $executable = (& $wsl.Source -d $distro -- bash -lc "command -v hermes" 2>$null | Out-String).Trim()
            $executable = ($executable -split "`r?`n" | Select-Object -First 1).Trim()
            if ($LASTEXITCODE -eq 0 -and $executable -match "^/[A-Za-z0-9._/+-]+$") {
                return [pscustomobject]@{
                    Kind = "wsl"
                    Distro = $distro
                    Executable = $executable
                    Wsl = $wsl.Source
                }
            }
        } catch {
            # Continue to the next validated distribution.
        }
    }
    return $null
}

function Install-Hermes {
    $installer = Join-Path $TempRoot "hermes-install.ps1"
    Write-Info "Hermes Agent was not found. Installing it from Nous Research..."
    try {
        Invoke-Download "https://hermes-agent.nousresearch.com/install.ps1" $installer
        & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $installer -NonInteractive -SkipSetup
        if ($LASTEXITCODE -ne 0) { throw "Hermes installer exited with code $LASTEXITCODE." }
        Write-Info "Hermes Agent installed."
    } catch {
        Write-WarningMessage "Stoix is installed, but Hermes installation needs attention."
        Write-WarningMessage "Run in PowerShell: iex (irm https://hermes-agent.nousresearch.com/install.ps1)"
    }
}

function Configure-Hermes([string]$Hermes, [string]$ConfigPath, [string]$RuntimeNode) {
    if (-not $Hermes) { return }
    Set-PrivateConfigValue $ConfigPath "HERMES_DASHBOARD_WINDOWS_MODE" "native"
    Set-PrivateConfigValue $ConfigPath "STUDIO_WSL_DISTRO" ""
    Write-Info "Configuring the local Hermes API for Stoix..."
    $enableExitCode = Invoke-QuietActivity "Enabling the private Hermes API..." $Hermes @(
        "config", "set", "API_SERVER_ENABLED", "true"
    )
    if ($enableExitCode -ne 0) {
        Write-WarningMessage "Hermes is installed, but its API server could not be enabled. Run: hermes config set API_SERVER_ENABLED true"
        return
    }
    $hermesHome = if ($env:HERMES_HOME) { $env:HERMES_HOME } else { Join-Path $env:LOCALAPPDATA "hermes" }
    $hermesEnv = Join-Path $hermesHome ".env"
    $apiKey = ""
    $apiKeyChanged = $false
    if (Test-Path -LiteralPath $hermesEnv) {
        $keyLine = Get-Content -LiteralPath $hermesEnv | Where-Object { $_ -match "^API_SERVER_KEY=" } | Select-Object -Last 1
        if ($keyLine) { $apiKey = $keyLine.Substring("API_SERVER_KEY=".Length).Trim() }
    }
    if ($apiKey.Length -lt 16) {
        $apiKey = (& $RuntimeNode -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")
        if ($LASTEXITCODE -ne 0 -or $apiKey.Length -lt 16) {
            Write-WarningMessage "Could not generate the private Hermes API key."
            return
        }
        $keyExitCode = Invoke-QuietActivity "Securing the local Hermes connection..." $Hermes @(
            "config", "set", "API_SERVER_KEY", $apiKey
        )
        if ($keyExitCode -ne 0) {
            Write-WarningMessage "Hermes did not accept its private API key. Run: hermes config set API_SERVER_KEY YOUR_PRIVATE_KEY"
            return
        }
        $apiKeyChanged = $true
    }
    Set-PrivateConfigValue $ConfigPath "HERMES_API_KEY" $apiKey
    $logDirectory = Join-Path $hermesHome "logs"
    New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
    if ($apiKeyChanged) {
        Invoke-QuietActivity "Stopping the previous Hermes gateway..." $Hermes @("gateway", "stop") | Out-Null
        for ($attempt = 0; $attempt -lt 10 -and (Test-LoopbackPort 8642); $attempt += 1) {
            Start-Sleep -Milliseconds 500
        }
    }
    if (-not (Test-LoopbackPort 8642)) {
        $installExitCode = Invoke-QuietActivity "Installing the local Hermes gateway service..." $Hermes @(
            "gateway", "install"
        )
        $startExitCode = if ($installExitCode -eq 0) {
            Invoke-QuietActivity "Starting the local Hermes gateway..." $Hermes @("gateway", "start")
        } else {
            $installExitCode
        }
        $gatewayReady = $startExitCode -eq 0 -and (Wait-ForLoopbackPort 8642 45 "Waiting for Hermes to answer on the local loopback...")
        if ($gatewayReady) {
            Write-Info "Hermes gateway service is running."
        } else {
            try {
                Start-Process -FilePath $Hermes -ArgumentList @("gateway", "run", "--replace", "--force") `
                    -WindowStyle Hidden `
                    -RedirectStandardOutput (Join-Path $logDirectory "stoix-gateway.log") `
                    -RedirectStandardError (Join-Path $logDirectory "stoix-gateway-error.log")
                if (Wait-ForLoopbackPort 8642 45 "Waiting for the background Hermes gateway...") {
                    Write-Info "Hermes gateway is running in the background."
                } else {
                    Write-WarningMessage "Hermes was configured but its API did not become ready. Check $logDirectory\stoix-gateway-error.log"
                }
            } catch {
                Write-WarningMessage "Hermes could not start automatically. Run: hermes gateway run --replace --force"
            }
        }
    } else {
        Write-Info "Hermes gateway is already running."
    }

    if (-not (Test-LoopbackPort 9119)) {
        try {
            Start-Process -FilePath $Hermes -ArgumentList @("dashboard", "--host", "127.0.0.1", "--port", "9119", "--no-open") `
                -WindowStyle Hidden `
                -RedirectStandardOutput (Join-Path $logDirectory "stoix-dashboard.log") `
                -RedirectStandardError (Join-Path $logDirectory "stoix-dashboard-error.log")
            Write-Info "Hermes Dashboard is starting in the background. Its first start can take about a minute."
        } catch {
            Write-WarningMessage "Hermes Dashboard could not start automatically. Stoix can retry it from Plugins, Config, Keys, or Logs."
        }
    }
}

function Get-WslHermesEnvValue($Target, [string]$Key) {
    try {
        $contents = (& $Target.Wsl -d $Target.Distro -- bash -lc "cat ~/.hermes/.env 2>/dev/null" 2>$null | Out-String)
        if ($LASTEXITCODE -ne 0 -or $contents.Length -gt 65536) { return "" }
        $value = ""
        foreach ($line in ($contents -split "`r?`n")) {
            if ($line.StartsWith("$Key=")) {
                $value = $line.Substring($Key.Length + 1).Trim()
            }
        }
        if (
            $value.Length -ge 2 -and
            $value[0] -eq $value[$value.Length - 1] -and
            ($value[0] -eq '"' -or $value[0] -eq "'")
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        return $value
    } catch {
        return ""
    }
}

function Test-PrivateSecret([string]$Value) {
    return $Value.Length -ge 16 -and $Value.Length -le 512 -and $Value -notmatch "[\x00-\x1f\x7f]"
}

function Configure-WslHermes($Target, [string]$ConfigPath, [string]$RuntimeNode) {
    if (-not $Target) { return $false }
    Write-Info "Configuring Hermes in WSL2 distribution $($Target.Distro)..."
    $enableExitCode = Invoke-QuietActivity "Enabling the private Hermes API in WSL2..." $Target.Wsl @(
        "-d", $Target.Distro, "--", $Target.Executable,
        "config", "set", "API_SERVER_ENABLED", "true"
    )
    if ($enableExitCode -ne 0) {
        Write-WarningMessage "Hermes was found in $($Target.Distro), but its API could not be enabled."
        Write-WarningMessage "Inside that distribution run: hermes config set API_SERVER_ENABLED true"
        return $false
    }

    $apiKey = Get-WslHermesEnvValue $Target "API_SERVER_KEY"
    $apiKeyChanged = $false
    if (-not (Test-PrivateSecret $apiKey)) {
        $apiKey = (& $RuntimeNode -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")
        if ($LASTEXITCODE -ne 0 -or -not (Test-PrivateSecret $apiKey)) {
            Write-WarningMessage "Could not generate the private WSL2 Hermes API key."
            return $false
        }
        $keyExitCode = Invoke-QuietActivity "Securing the WSL2 Hermes connection..." $Target.Wsl @(
            "-d", $Target.Distro, "--", $Target.Executable,
            "config", "set", "API_SERVER_KEY", $apiKey
        )
        if ($keyExitCode -ne 0) {
            Write-WarningMessage "Hermes in $($Target.Distro) did not accept its private API key."
            return $false
        }
        $apiKeyChanged = $true
    }

    Set-PrivateConfigValue $ConfigPath "HERMES_API_BASE_URL" "http://127.0.0.1:8642"
    Set-PrivateConfigValue $ConfigPath "HERMES_API_KEY" $apiKey
    Set-PrivateConfigValue $ConfigPath "HERMES_DASHBOARD_WINDOWS_MODE" "wsl"
    Set-PrivateConfigValue $ConfigPath "STUDIO_WSL_DISTRO" $Target.Distro

    if ($apiKeyChanged) {
        Invoke-QuietActivity "Stopping the previous WSL2 Hermes gateway..." $Target.Wsl @(
            "-d", $Target.Distro, "--", $Target.Executable, "gateway", "stop"
        ) | Out-Null
    }

    if (Test-HermesHealth) {
        Write-Info "Hermes in $($Target.Distro) is already connected."
        return $true
    }

    $logDirectory = Join-Path (Split-Path -Parent $ConfigPath) "logs"
    New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
    try {
        Start-Process -FilePath $Target.Wsl -ArgumentList @(
            "-d", $Target.Distro, "--", $Target.Executable,
            "gateway", "run", "--replace", "--force"
        ) -WindowStyle Hidden `
            -RedirectStandardOutput (Join-Path $logDirectory "stoix-wsl-gateway.log") `
            -RedirectStandardError (Join-Path $logDirectory "stoix-wsl-gateway-error.log") | Out-Null
    } catch {
        Write-WarningMessage "Stoix could not start Hermes in $($Target.Distro)."
        Write-WarningMessage "Inside WSL2 run: hermes gateway run --replace --force"
        return $false
    }

    if (Wait-ForHermesHealth 120 "Waiting for Hermes in WSL2 to answer on Windows localhost...") {
        Write-Info "Hermes in $($Target.Distro) is connected and ready."
        return $true
    }

    Write-WarningMessage "Hermes started in WSL2, but Windows could not reach http://127.0.0.1:8642/health."
    Write-WarningMessage "Keep the API on loopback and check WSL2 localhost forwarding plus $logDirectory\stoix-wsl-gateway-error.log"
    return $false
}

function Test-LoopbackPort([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $task = $client.ConnectAsync("127.0.0.1", $Port)
        return $task.Wait(750) -and $client.Connected
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Test-HermesHealth {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8642/health" -TimeoutSec 2
        if ($response.StatusCode -ne 200) { return $false }
        $payload = $response.Content | ConvertFrom-Json
        return $payload.status -eq "ok" -and $payload.platform -eq "hermes-agent"
    } catch {
        return $false
    }
}

function Wait-ForHermesHealth([int]$TimeoutSeconds, [string]$Activity) {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
            if (Test-HermesHealth) { return $true }
            Show-ActivityFrame $stopwatch $Activity
            Start-Sleep -Milliseconds 350
        }
        return $false
    } finally {
        Clear-ActivityFrame
    }
}

try {
    if (-not [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)) {
        Fail "This installer supports Windows. On macOS or Linux use install.sh."
    }
    if ($Repository -notmatch "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$") { Fail "Invalid STOIX_REPOSITORY value." }
    if ($Branch -notmatch "^[A-Za-z0-9._/-]+$") { Fail "Invalid STOIX_BRANCH value." }
    if ($Version) {
        $Version = $Version.TrimStart("v")
        if (-not (Test-Version $Version)) { Fail "Invalid Stoix version: $Version" }
    }
    if (-not $InstallRoot) { $InstallRoot = Join-Path $env:LOCALAPPDATA "Programs\Stoix" }
    if (-not $BinDir) { $BinDir = Join-Path $InstallRoot "bin" }
    if ($env:STOIX_SKIP_HERMES -eq "true") { $SkipHermes = $true }
    if ($SkipHermes) { $HermesMode = "Skip" }
    if ($env:STOIX_NO_LAUNCH -eq "true") { $NoLaunch = $true }
    if ($env:STOIX_NO_INTEGRATE -eq "true") { $NoIntegrate = $true }
    if ($env:STOIX_FORCE_SOURCE -eq "true") { $Source = $true }

    $architecture = Get-Architecture
    $TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("stoix-install-" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

    if ($ArchivePath) {
        $resolvedArchive = (Resolve-Path -LiteralPath $ArchivePath).Path
        $bundleRoot = Expand-StoixArchive $resolvedArchive (Join-Path $TempRoot "release") $architecture
    } elseif ($Source) {
        $bundleRoot = Build-SourceBundle $architecture
    } else {
        $bundleRoot = Get-ReleaseBundle $architecture
        if (-not $bundleRoot) {
            Write-WarningMessage "No compatible published release was found; using the verified-runtime source build path."
            $bundleRoot = Build-SourceBundle $architecture
        }
    }

    $metadata = Get-Content -LiteralPath (Join-Path $bundleRoot "VERSION.json") -Raw | ConvertFrom-Json
    $packageVersion = [string]$metadata.version
    if (-not (Test-Version $packageVersion)) { Fail "The package version metadata is invalid." }

    $versionsRoot = Join-Path $InstallRoot "versions"
    $targetRoot = Join-Path $versionsRoot $packageVersion
    New-Item -ItemType Directory -Force -Path $versionsRoot, $BinDir | Out-Null
    if (-not (Test-BundleComplete $targetRoot)) {
        if (Test-Path -LiteralPath $targetRoot) {
            $incompleteRoot = Join-Path $versionsRoot (".incomplete-$packageVersion-" + (Get-Date -Format "yyyyMMddHHmmss") + "-" + [Guid]::NewGuid().ToString("N"))
            Write-WarningMessage "The existing Stoix $packageVersion installation is incomplete; preserving it at $incompleteRoot and repairing it."
            Move-Item -LiteralPath $targetRoot -Destination $incompleteRoot
        }
        $stagingRoot = Join-Path $versionsRoot (".install-$packageVersion-" + [Guid]::NewGuid().ToString("N"))
        Copy-Directory $bundleRoot $stagingRoot
        Move-Item -LiteralPath $stagingRoot -Destination $targetRoot
    }

    Set-Content -LiteralPath (Join-Path $InstallRoot "current.txt") -Value $packageVersion -Encoding ASCII
    [System.IO.File]::WriteAllText(
        (Join-Path $InstallRoot "bin-dir.txt"),
        $BinDir,
        (New-Object System.Text.UTF8Encoding($false))
    )
    [System.IO.File]::WriteAllText(
        (Join-Path $BinDir "install-root.txt"),
        $InstallRoot,
        (New-Object System.Text.UTF8Encoding($false))
    )
    $powerShellWrapper = @'
$ErrorActionPreference = "Stop"
$installRoot = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot "install-root.txt")).Trim()
$version = [System.IO.File]::ReadAllText((Join-Path $installRoot "current.txt")).Trim()
if ($version -notmatch "^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$") {
    throw "Stoix installation metadata is invalid. Run the installer again to repair it."
}
$launcher = Join-Path $installRoot "versions\$version\Stoix.cmd"
if (-not (Test-Path -LiteralPath $launcher)) {
    throw "Stoix $version is incomplete. Run the installer again to repair it."
}
& $launcher @args
exit $LASTEXITCODE
'@
    Set-Content -LiteralPath (Join-Path $BinDir "stoix.ps1") -Value $powerShellWrapper -Encoding UTF8
    $wrapper = @"
@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0stoix.ps1" %*
"@
    Set-Content -LiteralPath (Join-Path $BinDir "Stoix.cmd") -Value $wrapper -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $BinDir "stoix.cmd") -Value $wrapper -Encoding ASCII
    if (-not $NoIntegrate) {
        Add-UserPath $BinDir
        try {
            $programs = [Environment]::GetFolderPath("Programs")
            if ($programs) {
                $shortcutPath = Join-Path $programs "Stoix.lnk"
                $shell = New-Object -ComObject WScript.Shell
                $shortcut = $shell.CreateShortcut($shortcutPath)
                $shortcut.TargetPath = (Get-Command powershell.exe -ErrorAction Stop).Source
                $shortcut.Arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$(Join-Path $BinDir 'stoix.ps1')`""
                $shortcut.WorkingDirectory = $InstallRoot
                $shortcut.Description = "Stoix - local Web UI for Hermes Agent"
                $shortcut.WindowStyle = 7
                $shortcut.Save()
            }
        } catch {
            Write-WarningMessage "Stoix installed, but Windows could not create the Start menu shortcut. Use: $BinDir\Stoix.cmd"
        }
    }

    if (-not $ConfigRoot) { $ConfigRoot = Join-Path $env:APPDATA "Stoix" }
    $configPath = Join-Path $ConfigRoot "config.env"
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $configPath) | Out-Null
    if (-not (Test-Path -LiteralPath $configPath)) {
        @(
            "# Stoix local configuration. Keep this file private.",
            "HERMES_API_BASE_URL=http://127.0.0.1:8642",
            "HERMES_API_KEY=",
            "HERMES_UI_ENABLE_REAL_HERMES=true",
            "STOIX_PORT=3210",
            "HERMES_DASHBOARD_BASE_URL=",
            "HERMES_DASHBOARD_SESSION_TOKEN=",
            "HERMES_DASHBOARD_WINDOWS_MODE=",
            "STUDIO_WSL_DISTRO="
        ) | Set-Content -LiteralPath $configPath -Encoding UTF8
    }

    if ($HermesMode -ne "Skip") {
        $effectiveHermesMode = $HermesMode
        $nativeHermes = $null
        $wslHermes = $null

        if ($effectiveHermesMode -eq "Auto") {
            $savedMode = (Get-PrivateConfigValue $configPath "HERMES_DASHBOARD_WINDOWS_MODE").ToLowerInvariant()
            if ($savedMode -eq "wsl") {
                $effectiveHermesMode = "Wsl"
                if (-not $WslDistribution) {
                    $WslDistribution = Get-PrivateConfigValue $configPath "STUDIO_WSL_DISTRO"
                }
            } elseif ($savedMode -eq "native") {
                $effectiveHermesMode = "Native"
            } else {
                $nativeHermes = Find-Hermes
                if ($nativeHermes) {
                    $effectiveHermesMode = "Native"
                } else {
                    $wslHermes = Find-WslHermes $WslDistribution
                    if ($wslHermes) { $effectiveHermesMode = "Wsl" }
                }
            }
        }

        if ($effectiveHermesMode -eq "Native") {
            if (-not $nativeHermes) { $nativeHermes = Find-Hermes }
            if (-not $nativeHermes -and $HermesMode -eq "Native") {
                Install-Hermes
                $nativeHermes = Find-Hermes
            }
            if ($nativeHermes) {
                Configure-Hermes $nativeHermes $configPath (Join-Path $targetRoot "runtime\node.exe")
            } else {
                Write-WarningMessage "Native Hermes was not found. Re-run with -HermesMode Native to install it explicitly."
            }
        } elseif ($effectiveHermesMode -eq "Wsl") {
            if (-not $wslHermes) { $wslHermes = Find-WslHermes $WslDistribution }
            if ($wslHermes) {
                Configure-WslHermes $wslHermes $configPath (Join-Path $targetRoot "runtime\node.exe") | Out-Null
            } else {
                Write-WarningMessage "Hermes was not found in an installed WSL2 distribution."
                Write-WarningMessage "Install Ubuntu with WSL2, install Hermes inside it, then re-run with -HermesMode Wsl."
            }
        } else {
            Write-WarningMessage "Hermes was not found. Stoix is installed, but chat stays offline until Hermes is installed."
            Write-WarningMessage "For the tested Windows path, install Hermes in WSL2 and re-run with -HermesMode Wsl."
        }
    }

    Show-Completion $packageVersion
    Write-Info "Stoix $packageVersion installed successfully."
    Write-Info "Command: $(Join-Path $BinDir 'Stoix.cmd')"
    Write-Info "Configuration: $configPath"
    if (-not $NoLaunch) {
        Write-Info "Starting Stoix; your browser will open when it is ready..."
        $command = "`"$(Join-Path $BinDir 'Stoix.cmd')`""
        Start-Process -FilePath $env:ComSpec -ArgumentList @("/d", "/c", $command) -WindowStyle Hidden
    } else {
        Write-Info "Launch it later with: $(Join-Path $BinDir 'Stoix.cmd')"
    }
} catch {
    Write-Host "[Stoix] ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "[Stoix] Nothing in your existing Stoix configuration or data was removed." -ForegroundColor Yellow
    throw
} finally {
    if ($TempRoot -and (Test-Path -LiteralPath $TempRoot)) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
