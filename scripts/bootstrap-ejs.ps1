<#
.SYNOPSIS
    Bootstrap the Engineering Journey System into an existing repository.

.DESCRIPTION
    Adds EJS to an existing repo by copying the agent profile, agent skills,
    templates, and tooling. Appends the EJS Silent Recording Contract to your
    existing copilot-instructions.md (does NOT replace it).

    EJS is additive and non-competing — it layers silent collaboration
    recording onto whatever agents you already have.

.PARAMETER Target
    Path to the target repository (must be a git repo).

.PARAMETER WithHooks
    Also install git commit/push reminder hooks.

.PARAMETER WithPr
    Also copy the PR template.

.PARAMETER Full
    Copy everything (hooks + PR template).

.PARAMETER DryRun
    Show what would be done without making changes.

.EXAMPLE
    .\scripts\bootstrap-ejs.ps1 -Target C:\repos\my-project

.EXAMPLE
    .\scripts\bootstrap-ejs.ps1 -Target C:\repos\my-project -Full

.EXAMPLE
    .\scripts\bootstrap-ejs.ps1 -Target C:\repos\my-project -Full -DryRun
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Target,

    [switch]$WithHooks,
    [switch]$WithPr,
    [switch]$Full,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# ── Resolve flags ───────────────────────────────────────────────────

if ($Full) {
    $WithHooks = $true
    $WithPr    = $true
}

# ── Resolve EJS source directory ────────────────────────────────────

$EjsSource = $null
$TempDir   = $null

function Resolve-EjsSource {
    $scriptDir = Split-Path -Parent $PSCommandPath
    $parentDir = Split-Path -Parent $scriptDir

    if (Test-Path (Join-Path $parentDir '.github\agents\ejs-journey.agent.md')) {
        return (Resolve-Path $parentDir).Path
    }
    elseif (Test-Path (Join-Path $PWD '.github\agents\ejs-journey.agent.md')) {
        return (Resolve-Path $PWD).Path
    }
    else {
        Write-Host 'EJS: Cloning starter repo to temporary directory...'
        $script:TempDir = Join-Path ([System.IO.Path]::GetTempPath()) "ejs-bootstrap-$(Get-Random)"
        git clone --depth 1 https://github.com/McFuzzySquirrel/Engineering-Journey-System.git $script:TempDir 2>$null
        return $script:TempDir
    }
}

# ── Validate target ─────────────────────────────────────────────────

$Target = (Resolve-Path $Target -ErrorAction SilentlyContinue).Path
if (-not $Target) {
    Write-Error "EJS: error - target directory does not exist."
    exit 1
}

if (-not (Test-Path $Target -PathType Container)) {
    Write-Error "EJS: error - target is not a directory: $Target"
    exit 1
}

try {
    $gitDir = git -C $Target rev-parse --git-dir 2>$null
} catch { $gitDir = $null }

if (-not $gitDir) {
    Write-Error "EJS: error - target is not a git repository: $Target"
    exit 1
}

# ── Resolve source ──────────────────────────────────────────────────

$EjsSource = Resolve-EjsSource

Write-Host "EJS: bootstrapping into $Target"
Write-Host "EJS: source: $EjsSource"
Write-Host ''

# ── Helper: copy file ──────────────────────────────────────────────

function Copy-EjsFile {
    param(
        [string]$Src,
        [string]$Dest,
        [string]$Label
    )
    if (-not $Label) { $Label = $Dest }

    $destPath = Join-Path $Target $Dest

    if ($DryRun) {
        if (Test-Path $destPath) {
            Write-Host "  [skip] $Label (already exists)"
        } else {
            Write-Host "  [copy] $Label"
        }
        return
    }

    if (Test-Path $destPath) {
        Write-Host "  [skip] $Label (already exists)"
        return
    }

    $destDir = Split-Path -Parent $destPath
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }

    Copy-Item (Join-Path $EjsSource $Src) $destPath -Force
    Write-Host "  [done] $Label"
}

# ── Helper: append to copilot-instructions.md ───────────────────────

function Append-RecordingContract {
    $targetFile = Join-Path $Target '.github\copilot-instructions.md'
    $sourceFile = Join-Path $EjsSource '.github\copilot-instructions.md'
    $marker     = '## EJS Recording Contract'

    $alreadyPresent = $false
    if (Test-Path $targetFile) {
        $content = Get-Content $targetFile -Raw -ErrorAction SilentlyContinue
        if ($content -and $content.Contains($marker)) {
            $alreadyPresent = $true
        }
    }

    if ($DryRun) {
        if ($alreadyPresent) {
            Write-Host '  [skip] .github/copilot-instructions.md (EJS block already present)'
        } elseif (Test-Path $targetFile) {
            Write-Host '  [append] EJS Recording Contract (micro-instruction) -> .github/copilot-instructions.md'
        } else {
            Write-Host '  [create] .github/copilot-instructions.md (with EJS recording contract)'
        }
        return
    }

    $githubDir = Join-Path $Target '.github'
    if (-not (Test-Path $githubDir)) {
        New-Item -ItemType Directory -Path $githubDir -Force | Out-Null
    }

    if ($alreadyPresent) {
        Write-Host '  [skip] .github/copilot-instructions.md (EJS block already present)'
        return
    }

    # Extract just the recording contract block (from --- line onwards)
    $sourceContent = Get-Content $sourceFile -Raw
    $separatorIndex = $sourceContent.IndexOf("`n---`n")
    if ($separatorIndex -lt 0) {
        # fallback: try Windows line endings
        $separatorIndex = $sourceContent.IndexOf("`r`n---`r`n")
    }

    if (Test-Path $targetFile) {
        if ($separatorIndex -ge 0) {
            $contract = $sourceContent.Substring($separatorIndex)
        } else {
            $contract = "`n`n$sourceContent"
        }
        Add-Content -Path $targetFile -Value "`n$contract" -NoNewline
        Write-Host '  [done] Appended EJS Recording Contract (micro-instruction) to .github/copilot-instructions.md'
    } else {
        Copy-Item $sourceFile $targetFile -Force
        Write-Host '  [done] Created .github/copilot-instructions.md (with EJS recording contract)'
    }
}

# ── Core files (always copied) ──────────────────────────────────────

Write-Host 'Core files:'
Copy-EjsFile '.github\agents\ejs-journey.agent.md' '.github\agents\ejs-journey.agent.md' 'Agent profile (.github/agents/ejs-journey.agent.md)'
Append-RecordingContract
Copy-EjsFile '.github\skills\ejs-session-init\SKILL.md' '.github\skills\ejs-session-init\SKILL.md' 'Agent skill (.github/skills/ejs-session-init/SKILL.md)'
Copy-EjsFile '.github\skills\ejs-session-wrapup\SKILL.md' '.github\skills\ejs-session-wrapup\SKILL.md' 'Agent skill (.github/skills/ejs-session-wrapup/SKILL.md)'
Copy-EjsFile '.github\skills\ejs-sub-agent-capture\SKILL.md' '.github\skills\ejs-sub-agent-capture\SKILL.md' 'Agent skill (.github/skills/ejs-sub-agent-capture/SKILL.md)'
Copy-EjsFile 'ejs-docs\journey\_templates\journey-template.md' 'ejs-docs\journey\_templates\journey-template.md' 'Journey template (ejs-docs/journey/_templates/journey-template.md)'
Copy-EjsFile 'ejs-docs\adr\0000-adr-template.md' 'ejs-docs\adr\0000-adr-template.md' 'ADR template (ejs-docs/adr/0000-adr-template.md)'
Copy-EjsFile 'scripts\adr-db.py' 'scripts\adr-db.py' 'adr-db.py (scripts/adr-db.py)'
Copy-EjsFile 'scripts\tests\test_adr_db.py' 'scripts\tests\test_adr_db.py' 'Tests (scripts/tests/test_adr_db.py)'
Write-Host ''

# ── Copilot hooks (Layer 0 — guaranteed structural automation) ──────

Write-Host 'Copilot hooks (Layer 0):'
Copy-EjsFile '.github\hooks\ejs-hooks.json' '.github\hooks\ejs-hooks.json' 'Hook config (.github/hooks/ejs-hooks.json)'
Copy-EjsFile 'scripts\hooks\session-start.sh' 'scripts\hooks\session-start.sh' 'Hook script (scripts/hooks/session-start.sh)'
Copy-EjsFile 'scripts\hooks\session-end.sh' 'scripts\hooks\session-end.sh' 'Hook script (scripts/hooks/session-end.sh)'
Copy-EjsFile 'scripts\hooks\subagent-stop.sh' 'scripts\hooks\subagent-stop.sh' 'Hook script (scripts/hooks/subagent-stop.sh)'
Copy-EjsFile 'scripts\hooks\log-prompt.sh' 'scripts\hooks\log-prompt.sh' 'Hook script (scripts/hooks/log-prompt.sh)'

# Create logs directory for audit JSONL files
if (-not $DryRun) {
    $logsDir = Join-Path $Target 'logs'
    if (-not (Test-Path $logsDir)) {
        New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
    }
    $gitkeep = Join-Path $logsDir '.gitkeep'
    if (-not (Test-Path $gitkeep)) {
        New-Item -ItemType File -Path $gitkeep -Force | Out-Null
        Write-Host '  [done] Created logs/.gitkeep'
    }
} else {
    Write-Host '  [create] logs/.gitkeep'
}
Write-Host ''

# Add EJS entries to .gitignore
if (-not $DryRun) {
    $gitignorePath = Join-Path $Target '.gitignore'
    $entriesToAdd = @('.ejs.db', '.ejs-session-active', '.ejs-session-incomplete', 'logs/*.jsonl')

    if (Test-Path $gitignorePath) {
        $gitignoreContent = Get-Content $gitignorePath -Raw -ErrorAction SilentlyContinue
        foreach ($entry in $entriesToAdd) {
            if (-not $gitignoreContent -or -not $gitignoreContent.Contains($entry)) {
                Add-Content -Path $gitignorePath -Value $entry
                Write-Host "  [done] Added $entry to .gitignore"
            }
        }
    } else {
        Set-Content -Path $gitignorePath -Value ($entriesToAdd -join "`n")
        Write-Host '  [done] Created .gitignore with EJS entries'
    }
} else {
    Write-Host '  [append] .ejs.db, .ejs-session-active, .ejs-session-incomplete, logs/*.jsonl -> .gitignore'
}
Write-Host ''

# ── Optional: PR template ──────────────────────────────────────────

if ($WithPr) {
    Write-Host 'PR template:'
    Copy-EjsFile '.github\copilot\pull_request_template.md' '.github\copilot\pull_request_template.md' 'PR template (.github/copilot/pull_request_template.md)'
    Write-Host ''
}

# ── Optional: git hooks ────────────────────────────────────────────

if ($WithHooks) {
    Write-Host 'Git hooks:'
    Copy-EjsFile '.githooks\post-commit' '.githooks\post-commit' 'post-commit hook (.githooks/post-commit)'
    Copy-EjsFile '.githooks\pre-push' '.githooks\pre-push' 'pre-push hook (.githooks/pre-push)'
    Copy-EjsFile 'scripts\install-githooks.sh' 'scripts\install-githooks.sh' 'Hook installer (scripts/install-githooks.sh)'
    Copy-EjsFile 'scripts\install-githooks.ps1' 'scripts\install-githooks.ps1' 'Hook installer PS1 (scripts/install-githooks.ps1)'

    if (-not $DryRun) {
        git -C $Target config core.hooksPath .githooks 2>$null
        Write-Host '  [done] Activated hooks (core.hooksPath=.githooks)'
    } else {
        Write-Host '  [activate] git config core.hooksPath .githooks'
    }
    Write-Host ''
}

# ── Cleanup ─────────────────────────────────────────────────────────

if ($TempDir -and (Test-Path $TempDir)) {
    Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}

# ── Summary ─────────────────────────────────────────────────────────

if ($DryRun) {
    Write-Host '--- Dry run complete (no changes made) ---'
    Write-Host ''
    Write-Host 'Run without -DryRun to apply changes.'
} else {
    Write-Host '--- EJS bootstrap complete ---'
    Write-Host ''
    Write-Host 'What happens now:'
    Write-Host '  * Layer 0 (hooks): Copilot hooks automatically create journey files,'
    Write-Host '    sync the database, validate completeness, and log sub-agent events.'
    Write-Host '  * Tier 1 (always-on): Active immediately -- every Copilot agent'
    Write-Host '    in this repo will silently record to Session Journey files.'
    Write-Host '    Agent skills auto-load for session init, wrap-up, and sub-agent capture.'
    Write-Host '  * Tier 2 (bookend): Say ''@ejs-journey initialize session'' to start'
    Write-Host '    and ''@ejs-journey finalize session'' to end.'
    Write-Host '  * Tier 3 (coordinator): Select ejs-journey from the agent dropdown.'
    Write-Host ''
    Write-Host 'Next steps:'
    Write-Host '  1. git add -A && git commit -m ''chore: bootstrap EJS'''
    Write-Host '  2. Merge to default branch (hooks activate from default branch only)'
    Write-Host '  3. Start working -- EJS records automatically'
}
