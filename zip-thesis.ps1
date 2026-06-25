#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Bundle the LaTeX thesis into a zip ready to upload to Overleaf.

.DESCRIPTION
  Stages exactly what Overleaf needs into a clean archive:
    main.tex
    figures/*.png        (the rendered figures referenced by \graphicspath{{figures/}})

  Everything else under thesis/ is deliberately excluded -- the PlantUML figure
  sources (figures/src/*.puml), the render script, plantuml.jar, and the docs --
  because Overleaf only compiles the .tex against the rendered images.

  Output defaults to thesis.zip in the repo root (already in .gitignore).

.EXAMPLE
  ./zip-thesis.ps1
  ./zip-thesis.ps1 -Output build/thesis-upload.zip
#>
[CmdletBinding()]
param(
  [string]$Output = "thesis.zip"
)

$ErrorActionPreference = "Stop"

$root   = $PSScriptRoot
$thesis = Join-Path $root "thesis"
$mainTex = Join-Path $thesis "main.tex"
$figuresDir = Join-Path $thesis "figures"

if (-not (Test-Path $mainTex)) {
  throw "thesis/main.tex not found -- run this script from the repo root."
}

$figures = Get-ChildItem $figuresDir -Filter *.png -File -ErrorAction SilentlyContinue
if (-not $figures) {
  throw "No rendered figures (figures/*.png) found. Render them first: thesis/render-figures.ps1"
}

# Warn if any \includegraphics target is missing from the staged figures, so a
# broken upload is caught here rather than on Overleaf.
$referenced = Select-String -Path $mainTex -Pattern '\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}' -AllMatches |
  ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } |
  ForEach-Object { if ($_ -notmatch '\.\w+$') { "$_.png" } else { $_ } } | Sort-Object -Unique
$have = $figures.Name
foreach ($ref in $referenced) {
  if ($have -notcontains $ref) {
    Write-Warning "main.tex references '$ref' but it is not in figures/ -- the PDF may have a missing image."
  }
}

$outPath = if ([System.IO.Path]::IsPathRooted($Output)) { $Output } else { Join-Path $root $Output }
$outDir = Split-Path $outPath -Parent
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
if (Test-Path $outPath) { Remove-Item $outPath -Force }

# Build the archive entry-by-entry with explicit forward-slash names. Windows
# PowerShell's Compress-Archive writes backslash separators, which Overleaf can
# misread as a literal filename instead of a figures/ folder -- so we name each
# entry directly (main.tex at the root, figures/<name>.png alongside it).
Add-Type -AssemblyName System.IO.Compression | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

$zip = [System.IO.Compression.ZipFile]::Open($outPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $mainTex, "main.tex") | Out-Null
  foreach ($f in $figures) {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, "figures/$($f.Name)") | Out-Null
  }
}
finally {
  $zip.Dispose()
}

$sizeKb = "{0:N0} KB" -f ((Get-Item $outPath).Length / 1KB)
Write-Host ""
Write-Host "[OK] Wrote $Output ($sizeKb)" -ForegroundColor Green
Write-Host "     main.tex + $($figures.Count) figure(s): $($figures.Name -join ', ')"
Write-Host "     Upload to Overleaf: New Project -> Upload Project -> select this zip." -ForegroundColor DarkGray
